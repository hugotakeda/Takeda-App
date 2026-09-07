const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

function runPS(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, maxBuffer: 1024 * 1024 * 32 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve((stdout || '').trim());
      }
    );
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

// Escaneia uma pasta e devolve: maiores subpastas/arquivos diretos,
// os N maiores arquivos (recursivo) e um resumo por extensão.
async function scanFolder(rootPath) {
  const safeRoot = rootPath.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $root = '${safeRoot}'

    $children = @()
    Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $size = 0
      if ($_.PSIsContainer) {
        $size = (Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
        if (-not $size) { $size = 0 }
      } else {
        $size = $_.Length
      }
      $children += [PSCustomObject]@{ name=$_.Name; path=$_.FullName; size=[int64]$size; isDir=[bool]$_.PSIsContainer }
    }

    $topFiles = Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue |
      Sort-Object Length -Descending | Select-Object -First 25 |
      ForEach-Object { [PSCustomObject]@{ name=$_.Name; path=$_.FullName; size=[int64]$_.Length; ext=$_.Extension } }

    $extGroups = Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue |
      Group-Object Extension | ForEach-Object {
        [PSCustomObject]@{
          ext = if ($_.Name) { $_.Name } else { '(sem extensão)' }
          count = $_.Count
          size = [int64]([long]($_.Group | Measure-Object -Property Length -Sum).Sum)
        }
      } | Sort-Object size -Descending | Select-Object -First 12

    $rootTotal = (Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
    if (-not $rootTotal) { $rootTotal = 0 }

    @{
      root = $root
      totalSize = [int64]$rootTotal
      children = @($children | Sort-Object size -Descending)
      topFiles = @($topFiles)
      byExtension = @($extGroups)
    } | ConvertTo-Json -Compress -Depth 5
  `;

  const out = await runPS(script, 90000);
  if (!out) return { root: rootPath, totalSize: 0, children: [], topFiles: [], byExtension: [] };
  return JSON.parse(out);
}

module.exports = { shortcuts, scanFolder };
