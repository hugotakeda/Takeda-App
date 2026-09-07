const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { app } = require('electron');

function runPS(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, maxBuffer: 1024 * 1024 * 16 },
      (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stderr }));
        else resolve((stdout || '').trim());
      }
    );
  });
}

// Roda um script elevado (pede UAC) e espera terminar. Usado só para chaves
// HKLM/operações que exigem admin. O script roda "as-is" numa nova janela.
function runPSElevated(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(app.getPath('temp'), `takeda-elev-${Date.now()}.ps1`);
    fsSync.writeFileSync(tmpFile, script, 'utf-8');
    const wrapper = `
      $ErrorActionPreference = 'SilentlyContinue'
      Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @(
        '-NoProfile','-ExecutionPolicy','Bypass','-File','${tmpFile.replace(/'/g, "''")}'
      )
      Write-Output "DONE"
    `;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', wrapper],
      { timeout },
      (err, stdout) => {
        try { fsSync.unlinkSync(tmpFile); } catch (e) {}
        if (err) reject(err);
        else resolve((stdout || '').trim());
      }
    );
  });
}

function backupFile() {
  return path.join(app.getPath('userData'), 'startup-backup.json');
}

async function readBackup() {
  try {
    const data = await fs.readFile(backupFile(), 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function writeBackup(list) {
  await fs.writeFile(backupFile(), JSON.stringify(list, null, 2), 'utf-8');
}

function startupFolderPaths() {
  return {
    user: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp'),
    common: path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp'),
  };
}

function disabledSubfolder(folder) {
  return path.join(folder, 'Takeda-Disabled');
}

// ── Gerenciador de Inicialização ─────────────────────────────────────────

async function listStartup() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $items = @()
    $keys = @(
      @{ Hive='HKCU'; Path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
      @{ Hive='HKLM'; Path='HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
      @{ Hive='HKLM'; Path='HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' }
    )
    foreach ($k in $keys) {
      if (Test-Path $k.Path) {
        $item = Get-Item -Path $k.Path
        foreach ($name in $item.Property) {
          $val = (Get-ItemProperty -Path $k.Path -Name $name -ErrorAction SilentlyContinue).$name
          $items += [PSCustomObject]@{ name=$name; command="$val"; hive=$k.Hive; key=$k.Path }
        }
      }
    }
    $items | ConvertTo-Json -Compress -Depth 3
  `;

  let regItems = [];
  try {
    const out = await runPS(script);
    const parsed = out ? JSON.parse(out) : [];
    regItems = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch (e) {
    regItems = [];
  }

  const folders = startupFolderPaths();
  const folderItems = [];
  for (const [scope, folder] of Object.entries(folders)) {
    try {
      const entries = await fs.readdir(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() && /\.lnk$/i.test(entry.name)) {
          folderItems.push({
            id: `folder:${scope}:${entry.name}`,
            source: 'folder',
            scope,
            name: entry.name.replace(/\.lnk$/i, ''),
            command: path.join(folder, entry.name),
            enabled: true,
          });
        }
      }
    } catch (e) {}

    try {
      const disabled = disabledSubfolder(folder);
      const entries = await fs.readdir(disabled, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() && /\.lnk$/i.test(entry.name)) {
          folderItems.push({
            id: `folder:${scope}:${entry.name}`,
            source: 'folder',
            scope,
            name: entry.name.replace(/\.lnk$/i, ''),
            command: path.join(disabled, entry.name),
            enabled: false,
          });
        }
      }
    } catch (e) {}
  }

  const enabledRegItems = regItems.map((r) => ({
    id: `reg:${r.hive}:${r.name}`,
    source: 'registry',
    hive: r.hive,
    key: r.key,
    name: r.name,
    command: r.command,
    enabled: true,
  }));

  const backup = await readBackup();
  const disabledRegItems = backup.map((b) => ({
    id: `reg:${b.hive}:${b.name}`,
    source: 'registry',
    hive: b.hive,
    key: b.key,
    name: b.name,
    command: b.command,
    enabled: false,
  }));

  return [...enabledRegItems, ...disabledRegItems, ...folderItems];
}

async function disableStartupItem(itemIn) {
  const item = typeof itemIn === 'string' ? JSON.parse(itemIn) : itemIn;

  if (item.source === 'registry') {
    const safeKey = item.key.replace(/'/g, "''");
    const safeName = item.name.replace(/'/g, "''");
    const script = `
      $ErrorActionPreference = 'SilentlyContinue'
      Remove-ItemProperty -Path '${safeKey}' -Name '${safeName}' -Force
      Write-Output "OK"
    `;
    const runner = item.hive === 'HKLM' ? runPSElevated : runPS;
    await runner(script);

    const backup = await readBackup();
    if (!backup.find((b) => b.hive === item.hive && b.name === item.name)) {
      backup.push({ hive: item.hive, key: item.key, name: item.name, command: item.command });
      await writeBackup(backup);
    }
    return { ok: true };
  }

  if (item.source === 'folder') {
    const folder = path.dirname(item.command);
    const target = disabledSubfolder(folder);
    await fs.mkdir(target, { recursive: true });
    const dest = path.join(target, path.basename(item.command));
    await fs.rename(item.command, dest);
    return { ok: true };
  }

  return { ok: false };
}

async function enableStartupItem(itemIn) {
  const item = typeof itemIn === 'string' ? JSON.parse(itemIn) : itemIn;

  if (item.source === 'registry') {
    const safeKey = item.key.replace(/'/g, "''");
    const safeName = item.name.replace(/'/g, "''");
    const safeCmd = (item.command || '').replace(/'/g, "''");
    const script = `
      $ErrorActionPreference = 'SilentlyContinue'
      if (-not (Test-Path '${safeKey}')) { New-Item -Path '${safeKey}' -Force | Out-Null }
      New-ItemProperty -Path '${safeKey}' -Name '${safeName}' -PropertyType String -Value '${safeCmd}' -Force | Out-Null
      Write-Output "OK"
    `;
    const runner = item.hive === 'HKLM' ? runPSElevated : runPS;
    await runner(script);

    const backup = await readBackup();
    const next = backup.filter((b) => !(b.hive === item.hive && b.name === item.name));
    await writeBackup(next);
    return { ok: true };
  }

  if (item.source === 'folder') {
    const folder = path.dirname(item.command); // .../Takeda-Disabled
    const target = path.dirname(folder);
    const dest = path.join(target, path.basename(item.command));
    await fs.rename(item.command, dest);
    return { ok: true };
  }

  return { ok: false };
}

// ── Limpador de Registro (categorias seguras: Uninstall e App Paths órfãos) ──

async function scanOrphaned() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $results = @()

    $uninstallRoots = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    )
    foreach ($root in $uninstallRoots) {
      if (-not (Test-Path $root)) { continue }
      Get-ChildItem -Path $root | ForEach-Object {
        $p = Get-ItemProperty -Path $_.PSPath
        $name = $p.DisplayName
        if (-not $name) { return }
        $checkPath = $null
        if ($p.InstallLocation -and $p.InstallLocation.Trim() -ne '') {
          $checkPath = $p.InstallLocation
        } elseif ($p.DisplayIcon) {
          $checkPath = ($p.DisplayIcon -split ',')[0].Trim('"')
        } elseif ($p.UninstallString) {
          $m = [regex]::Match($p.UninstallString, '"([^"]+)"')
          if ($m.Success) { $checkPath = $m.Groups[1].Value }
        }
        if ($checkPath -and -not (Test-Path -LiteralPath $checkPath)) {
          $results += [PSCustomObject]@{
            keyPath = $_.PSPath -replace '^Microsoft\\.PowerShell\\.Core\\\\', ''
            displayName = $name
            checkedPath = $checkPath
            category = 'uninstall'
          }
        }
      }
    }

    $appPathsRoot = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'
    if (Test-Path $appPathsRoot) {
      Get-ChildItem -Path $appPathsRoot | ForEach-Object {
        $p = Get-ItemProperty -Path $_.PSPath
        $exe = $p.'(default)'
        if ($exe -and -not (Test-Path -LiteralPath $exe)) {
          $results += [PSCustomObject]@{
            keyPath = $_.PSPath -replace '^Microsoft\\.PowerShell\\.Core\\\\', ''
            displayName = $_.PSChildName
            checkedPath = $exe
            category = 'app-path'
          }
        }
      }
    }

    $results | ConvertTo-Json -Compress -Depth 3
  `;

  try {
    const out = await runPS(script, 45000);
    const parsed = out ? JSON.parse(out) : [];
    const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    return list.map((item, i) => ({ id: `orphan-${i}`, ...item }));
  } catch (e) {
    return [];
  }
}

async function removeOrphaned(entries) {
  const list = typeof entries === 'string' ? JSON.parse(entries) : entries;
  const backupDir = path.join(app.getPath('userData'), 'registry-backups');
  await fs.mkdir(backupDir, { recursive: true });

  const results = [];
  for (const entry of list) {
    const stamp = Date.now();
    const safeName = entry.displayName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
    const backupPath = path.join(backupDir, `${stamp}-${safeName}.reg`);
    const safeKey = entry.keyPath.replace(/'/g, "''");
    const safeBackup = backupPath.replace(/'/g, "''");

    const script = `
      $ErrorActionPreference = 'SilentlyContinue'
      $keyPath = '${safeKey}'
      $regArg = $keyPath -replace '^Registry::HKEY_LOCAL_MACHINE', 'HKLM' -replace '^Registry::HKEY_CURRENT_USER', 'HKCU'
      reg export "$regArg" '${safeBackup}' /y | Out-Null
      Remove-Item -Path $keyPath -Recurse -Force -ErrorAction SilentlyContinue
      if (Test-Path $keyPath) { Write-Output "FALHOU" } else { Write-Output "OK" }
    `;

    const needsElevation = entry.keyPath.includes('HKEY_LOCAL_MACHINE');
    const runner = needsElevation ? runPSElevated : runPS;

    try {
      const status = await runner(script);
      results.push({ id: entry.id, status: status.includes('OK') ? 'OK' : 'FALHOU', backupPath });
    } catch (e) {
      results.push({ id: entry.id, status: 'ERRO', backupPath });
    }
  }

  return results;
}

module.exports = {
  listStartup,
  disableStartupItem,
  enableStartupItem,
  scanOrphaned,
  removeOrphaned,
};
