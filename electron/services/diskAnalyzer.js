const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

let activeScan = null;

function cancelScan() {
  if (!activeScan) return;
  activeScan.kill();
  activeScan = null;
}

function runScanScript(script, timeout = 90000) {
  cancelScan();
  return new Promise((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (activeScan === child) activeScan = null;
        if (error) {
          reject(Object.assign(error, { stderr: String(stderr || '').trim() }));
          return;
        }
        resolve(String(stdout || '').trim());
      },
    );
    activeScan = child;
  });
}

function shortcuts() {
  const home = os.homedir();
  const systemDrive = process.env.SYSTEMDRIVE || 'C:';
  return [
    { name: 'Pasta do usuário', path: home },
    { name: 'Área de Trabalho', path: path.join(home, 'Desktop') },
    { name: 'Downloads', path: path.join(home, 'Downloads') },
    { name: 'Documentos', path: path.join(home, 'Documents') },
    { name: 'AppData\\Local', path: process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local') },
    { name: 'AppData\\Roaming', path: process.env.APPDATA || path.join(home, 'AppData', 'Roaming') },
    { name: `Unidade ${systemDrive}\\`, path: `${systemDrive}\\` },
  ];
}

// Faz uma única travessia do disco. A versão anterior repetia a mesma
// enumeração quatro vezes para calcular cada painel, multiplicando o custo
// em pastas grandes.
async function scanFolder(rootPath) {
  const safeRoot = rootPath.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    $root = '${safeRoot}'
    $rootItem = Get-Item -LiteralPath $root -Force
    if (-not $rootItem.PSIsContainer) { throw 'O caminho selecionado não é uma pasta.' }

    $rootFull = $rootItem.FullName.TrimEnd('\\')
    $directItems = @(Get-ChildItem -LiteralPath $rootFull -Force -ErrorAction SilentlyContinue)
    $childMap = @{}
    foreach ($item in $directItems) {
      $key = $item.Name.ToLowerInvariant()
      $childMap[$key] = [ordered]@{
        name = $item.Name
        path = $item.FullName
        size = [int64]0
        isDir = [bool]$item.PSIsContainer
      }
    }

    [int64]$total = 0
    $extensions = @{}
    $topFiles = @()

    Get-ChildItem -LiteralPath $rootFull -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
      [int64]$length = $_.Length
      $total += $length

      $relative = $_.FullName.Substring($rootFull.Length).TrimStart('\\')
      $separator = $relative.IndexOf('\\')
      $firstPart = if ($separator -ge 0) { $relative.Substring(0, $separator) } else { $relative }
      $childKey = $firstPart.ToLowerInvariant()
      if ($childMap.ContainsKey($childKey)) { $childMap[$childKey].size += $length }

      $extension = if ($_.Extension) { $_.Extension.ToLowerInvariant() } else { '(sem extensão)' }
      if (-not $extensions.ContainsKey($extension)) {
        $extensions[$extension] = [ordered]@{ ext = $extension; count = 0; size = [int64]0 }
      }
      $extensions[$extension].count += 1
      $extensions[$extension].size += $length

      $record = [PSCustomObject]@{ name=$_.Name; path=$_.FullName; size=$length; ext=$_.Extension }
      if ($topFiles.Count -lt 25) {
        $topFiles += $record
      } else {
        $smallestIndex = 0
        for ($i = 1; $i -lt $topFiles.Count; $i++) {
          if ($topFiles[$i].size -lt $topFiles[$smallestIndex].size) { $smallestIndex = $i }
        }
        if ($length -gt $topFiles[$smallestIndex].size) { $topFiles[$smallestIndex] = $record }
      }
    }

    $children = @($directItems | ForEach-Object { [PSCustomObject]$childMap[$_.Name.ToLowerInvariant()] } | Sort-Object size -Descending)
    $topFiles = @($topFiles | Sort-Object size -Descending)
    $extGroups = @($extensions.Values | ForEach-Object { [PSCustomObject]$_ } | Sort-Object size -Descending | Select-Object -First 12)

    [ordered]@{
      root = $rootItem.FullName
      totalSize = $total
      children = $children
      topFiles = $topFiles
      byExtension = $extGroups
    } | ConvertTo-Json -Compress -Depth 5
  `;

  const output = await runScanScript(script);
  if (!output) return { root: rootPath, totalSize: 0, children: [], topFiles: [], byExtension: [] };
  const parsed = JSON.parse(output);
  return {
    root: String(parsed.root || rootPath),
    totalSize: Number(parsed.totalSize) || 0,
    children: Array.isArray(parsed.children) ? parsed.children : [],
    topFiles: Array.isArray(parsed.topFiles) ? parsed.topFiles : [],
    byExtension: Array.isArray(parsed.byExtension) ? parsed.byExtension : [],
  };
}

module.exports = { shortcuts, scanFolder, cancelScan };
