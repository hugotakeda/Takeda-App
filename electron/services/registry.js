const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { app } = require('electron');
const { runElevated } = require('./elevated');

const CAPABILITY_TTL_MS = 10 * 60 * 1000;
const STARTUP_REGISTRY_KEYS = new Map([
  ['HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKCU'],
  ['HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKLM'],
  ['HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKLM'],
]);
const ORPHAN_ROOTS = [
  { root: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall', category: 'uninstall' },
  { root: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', category: 'uninstall' },
  { root: 'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall', category: 'uninstall' },
  { root: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths', category: 'app-path' },
];

let startupCapabilities = new Map();
let orphanCapabilities = new Map();
let orphanCapabilitiesExpireAt = 0;

function runPS(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stderr: String(stderr || '').trim() }));
        else resolve(String(stdout || '').trim());
      },
    );
  });
}

async function runMutation(script, requiresAdmin, timeout = 60000) {
  if (requiresAdmin) return runElevated(script, timeout);
  return runPS(script, timeout);
}

function safeText(value, name, maxLength = 4096) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || /[\u0000-\u001f]/u.test(value)) {
    throw new TypeError(`${name} inválido`);
  }
  return value;
}

function stableId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 24);
  return `${prefix}-${digest}`;
}

function backupFile() {
  return path.join(app.getPath('userData'), 'startup-backup.json');
}

function normalizeBackupItem(value) {
  try {
    const key = safeText(value?.key, 'Chave', 512);
    const expectedHive = STARTUP_REGISTRY_KEYS.get(key);
    const hive = safeText(value?.hive, 'Hive', 4);
    if (!expectedHive || hive !== expectedHive) return null;
    return {
      source: 'registry',
      hive,
      key,
      name: safeText(value?.name, 'Nome', 256),
      command: safeText(value?.command, 'Comando', 8192),
      enabled: false,
    };
  } catch {
    return null;
  }
}

async function readBackup() {
  try {
    const parsed = JSON.parse(await fs.readFile(backupFile(), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 500).map(normalizeBackupItem).filter(Boolean);
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error('[Registry] Backup de inicialização inválido:', error);
    return [];
  }
}

async function writeBackup(list) {
  const destination = backupFile();
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(list.slice(0, 500), null, 2), { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

function startupFolderPaths() {
  return {
    user: path.resolve(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp'),
    common: path.resolve(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp'),
  };
}

function disabledSubfolder(folder) {
  return path.join(folder, 'Takeda-Disabled');
}

function isDirectChild(filePath, folder) {
  return path.dirname(path.resolve(filePath)).toLowerCase() === path.resolve(folder).toLowerCase();
}

function normalizeRegistryStartup(value, enabled) {
  try {
    const key = safeText(value?.key, 'Chave', 512);
    const expectedHive = STARTUP_REGISTRY_KEYS.get(key);
    const hive = safeText(value?.hive, 'Hive', 4);
    if (!expectedHive || hive !== expectedHive) return null;
    const item = {
      source: 'registry',
      hive,
      key,
      name: safeText(value?.name, 'Nome', 256),
      command: safeText(value?.command, 'Comando', 8192),
      enabled,
    };
    item.id = stableId('startup', item.source, item.hive, item.key, item.name);
    return item;
  } catch {
    return null;
  }
}

function makeFolderItem(scope, command, enabled) {
  const folders = startupFolderPaths();
  const base = folders[scope];
  if (!base || typeof command !== 'string' || !/\.lnk$/i.test(command)) return null;
  const expectedFolder = enabled ? base : disabledSubfolder(base);
  if (!isDirectChild(command, expectedFolder)) return null;
  const filename = path.basename(command);
  const item = {
    source: 'folder',
    scope,
    name: filename.replace(/\.lnk$/i, ''),
    command: path.resolve(command),
    enabled,
  };
  item.id = stableId('startup', item.source, item.scope, filename);
  return item;
}

async function listStartup() {
  const script = `
    $ErrorActionPreference = 'Stop'
    $items = @()
    $keys = @(
      @{ Hive='HKCU'; Path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
      @{ Hive='HKLM'; Path='HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
      @{ Hive='HKLM'; Path='HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' }
    )
    foreach ($key in $keys) {
      if (-not (Test-Path -LiteralPath $key.Path)) { continue }
      $registryItem = Get-Item -LiteralPath $key.Path -ErrorAction Stop
      foreach ($name in $registryItem.Property) {
        $value = Get-ItemPropertyValue -LiteralPath $key.Path -Name $name -ErrorAction Stop
        $items += [PSCustomObject]@{ name=[string]$name; command=[string]$value; hive=$key.Hive; key=$key.Path }
      }
    }
    @($items) | ConvertTo-Json -Compress -Depth 3
  `;

  const output = await runPS(script);
  const parsed = output ? JSON.parse(output) : [];
  const registryItems = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    .map((item) => normalizeRegistryStartup(item, true))
    .filter(Boolean);

  const folderItems = [];
  for (const [scope, folder] of Object.entries(startupFolderPaths())) {
    for (const [candidateFolder, enabled] of [[folder, true], [disabledSubfolder(folder), false]]) {
      try {
        const entries = await fs.readdir(candidateFolder, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && /\.lnk$/i.test(entry.name)) {
            const item = makeFolderItem(scope, path.join(candidateFolder, entry.name), enabled);
            if (item) folderItems.push(item);
          }
        }
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error;
      }
    }
  }

  const enabledKeys = new Set(registryItems.map((item) => `${item.hive}\u0000${item.name.toLowerCase()}`));
  const disabledRegistryItems = (await readBackup())
    .map((item) => normalizeRegistryStartup(item, false))
    .filter((item) => item && !enabledKeys.has(`${item.hive}\u0000${item.name.toLowerCase()}`));
  const items = [...registryItems, ...disabledRegistryItems, ...folderItems];
  startupCapabilities = new Map(items.map((item) => [item.id, item]));
  return items.map((item) => ({ ...item }));
}

function resolveStartupCapability(input, shouldBeEnabled) {
  const id = safeText(input?.id, 'ID', 64);
  const item = startupCapabilities.get(id);
  if (!item || item.enabled !== shouldBeEnabled) {
    throw new Error('Atualize a lista antes de alterar este item');
  }
  return item;
}

async function moveStartupLink(item, enable) {
  const base = startupFolderPaths()[item.scope];
  if (!base) throw new Error('Escopo de inicialização inválido');
  const sourceFolder = enable ? disabledSubfolder(base) : base;
  const destinationFolder = enable ? base : disabledSubfolder(base);
  if (!isDirectChild(item.command, sourceFolder) || !/\.lnk$/i.test(item.command)) {
    throw new Error('Atalho de inicialização inválido');
  }
  const destination = path.join(destinationFolder, path.basename(item.command));
  await fs.mkdir(destinationFolder, { recursive: true });
  await fs.access(destination).then(
    () => { throw new Error('Já existe um atalho com este nome no destino'); },
    (error) => { if (error?.code !== 'ENOENT') throw error; },
  );

  if (item.scope === 'common') {
    const sourceLiteral = item.command.replace(/'/g, "''");
    const destinationLiteral = destination.replace(/'/g, "''");
    await runElevated(`Move-Item -LiteralPath '${sourceLiteral}' -Destination '${destinationLiteral}' -ErrorAction Stop`);
  } else {
    await fs.rename(item.command, destination);
  }
  item.command = destination;
  item.enabled = enable;
}

async function disableStartupItem(input) {
  const item = resolveStartupCapability(input, true);
  if (item.source === 'folder') {
    await moveStartupLink(item, false);
    return { ok: true };
  }

  const backup = await readBackup();
  if (!backup.some((entry) => entry.hive === item.hive && entry.name.toLowerCase() === item.name.toLowerCase())) {
    backup.push({ hive: item.hive, key: item.key, name: item.name, command: item.command });
    await writeBackup(backup);
  }

  const safeKey = item.key.replace(/'/g, "''");
  const safeName = item.name.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path -LiteralPath '${safeKey}')) { throw 'Chave de inicialização não encontrada.' }
    Remove-ItemProperty -LiteralPath '${safeKey}' -Name '${safeName}' -Force -ErrorAction Stop
    $remaining = Get-ItemPropertyValue -LiteralPath '${safeKey}' -Name '${safeName}' -ErrorAction SilentlyContinue
    if ($null -ne $remaining) { throw 'O item continuou ativo.' }
  `;
  await runMutation(script, item.hive === 'HKLM');
  item.enabled = false;
  return { ok: true };
}

async function enableStartupItem(input) {
  const item = resolveStartupCapability(input, false);
  if (item.source === 'folder') {
    await moveStartupLink(item, true);
    return { ok: true };
  }

  const safeKey = item.key.replace(/'/g, "''");
  const safeName = item.name.replace(/'/g, "''");
  const safeCommand = item.command.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path -LiteralPath '${safeKey}')) { New-Item -Path '${safeKey}' -Force -ErrorAction Stop | Out-Null }
    New-ItemProperty -LiteralPath '${safeKey}' -Name '${safeName}' -PropertyType String -Value '${safeCommand}' -Force -ErrorAction Stop | Out-Null
    $actual = Get-ItemPropertyValue -LiteralPath '${safeKey}' -Name '${safeName}' -ErrorAction Stop
    if ([string]$actual -ne '${safeCommand}') { throw 'O Windows não confirmou o item de inicialização.' }
  `;
  await runMutation(script, item.hive === 'HKLM');

  const backup = await readBackup();
  await writeBackup(backup.filter((entry) => !(entry.hive === item.hive && entry.name.toLowerCase() === item.name.toLowerCase())));
  item.enabled = true;
  return { ok: true };
}

function canonicalRegistryPath(value) {
  return String(value || '')
    .replace(/^Microsoft\.PowerShell\.Core\\/i, '')
    .replace(/^Registry::/i, '')
    .replace(/\//g, '\\')
    .replace(/\\+$/g, '');
}

function normalizeOrphan(value) {
  try {
    const canonical = canonicalRegistryPath(safeText(value?.keyPath, 'Caminho do registro', 1024));
    const allowed = ORPHAN_ROOTS.find(({ root }) => canonical.toLowerCase().startsWith(`${root.toLowerCase()}\\`));
    if (!allowed || value?.category !== allowed.category) return null;
    const item = {
      keyPath: `Registry::${canonical}`,
      displayName: safeText(value?.displayName, 'Nome', 512),
      checkedPath: safeText(value?.checkedPath, 'Caminho verificado', 8192),
      category: allowed.category,
    };
    item.id = stableId('orphan', item.keyPath);
    return item;
  } catch {
    return null;
  }
}

async function scanOrphaned() {
  const script = `
    $ErrorActionPreference = 'Stop'
    $results = @()
    $uninstallRoots = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    )
    foreach ($root in $uninstallRoots) {
      if (-not (Test-Path -LiteralPath $root)) { continue }
      Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object {
        $properties = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
        $name = $properties.DisplayName
        if (-not $name) { return }
        $checkPath = $null
        if ($properties.InstallLocation -and $properties.InstallLocation.Trim() -ne '') {
          $checkPath = $properties.InstallLocation
        } elseif ($properties.DisplayIcon) {
          $checkPath = ($properties.DisplayIcon -split ',')[0].Trim('"')
        } elseif ($properties.UninstallString) {
          $match = [regex]::Match($properties.UninstallString, '"([^\"]+)"')
          if ($match.Success) { $checkPath = $match.Groups[1].Value }
        }
        if ($checkPath -and -not (Test-Path -LiteralPath $checkPath)) {
          $results += [PSCustomObject]@{
            keyPath = $_.PSPath -replace '^Microsoft\\.PowerShell\\.Core\\\\', ''
            displayName = [string]$name
            checkedPath = [string]$checkPath
            category = 'uninstall'
          }
        }
      }
    }

    $appPathsRoot = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'
    if (Test-Path -LiteralPath $appPathsRoot) {
      Get-ChildItem -LiteralPath $appPathsRoot -ErrorAction SilentlyContinue | ForEach-Object {
        $properties = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
        $executable = $properties.'(default)'
        if ($executable -and -not (Test-Path -LiteralPath $executable)) {
          $results += [PSCustomObject]@{
            keyPath = $_.PSPath -replace '^Microsoft\\.PowerShell\\.Core\\\\', ''
            displayName = [string]$_.PSChildName
            checkedPath = [string]$executable
            category = 'app-path'
          }
        }
      }
    }
    @($results) | ConvertTo-Json -Compress -Depth 3
  `;

  const output = await runPS(script, 45000);
  const parsed = output ? JSON.parse(output) : [];
  const items = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    .map(normalizeOrphan)
    .filter(Boolean);
  orphanCapabilities = new Map(items.map((item) => [item.id, item]));
  orphanCapabilitiesExpireAt = Date.now() + CAPABILITY_TTL_MS;
  return items.map((item) => ({ ...item }));
}

function regExePath(keyPath) {
  return canonicalRegistryPath(keyPath)
    .replace(/^HKEY_LOCAL_MACHINE/i, 'HKLM')
    .replace(/^HKEY_CURRENT_USER/i, 'HKCU');
}

async function removeOrphaned(entries) {
  if (!Array.isArray(entries) || entries.length > 500) throw new TypeError('Entradas inválidas');
  if (Date.now() > orphanCapabilitiesExpireAt) throw new Error('Faça uma nova verificação antes de remover entradas');

  const selected = [];
  const seen = new Set();
  for (const input of entries) {
    const id = safeText(input?.id, 'ID', 64);
    const entry = orphanCapabilities.get(id);
    if (!entry || seen.has(id)) throw new Error('Entrada não pertence à verificação atual');
    seen.add(id);
    selected.push(entry);
  }

  const backupDir = path.join(app.getPath('userData'), 'registry-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const results = [];

  for (const entry of selected) {
    const safeName = entry.displayName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'entry';
    const backupPath = path.join(backupDir, `${Date.now()}-${crypto.randomUUID()}-${safeName}.reg`);
    const safeKey = entry.keyPath.replace(/'/g, "''");
    const safeRegKey = regExePath(entry.keyPath).replace(/'/g, "''");
    const safeBackup = backupPath.replace(/'/g, "''");
    const script = `
      $ErrorActionPreference = 'Stop'
      & reg.exe export '${safeRegKey}' '${safeBackup}' /y | Out-Null
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath '${safeBackup}')) { throw 'Falha ao criar backup do registro.' }
      Remove-Item -LiteralPath '${safeKey}' -Recurse -Force -ErrorAction Stop
      if (Test-Path -LiteralPath '${safeKey}') { throw 'A entrada continuou presente.' }
    `;
    const requiresAdmin = canonicalRegistryPath(entry.keyPath).startsWith('HKEY_LOCAL_MACHINE\\');

    try {
      await runMutation(script, requiresAdmin, 60000);
      orphanCapabilities.delete(entry.id);
      results.push({ id: entry.id, status: 'OK', backupPath });
    } catch (error) {
      results.push({ id: entry.id, status: 'ERRO', error: error?.message || String(error), backupPath });
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
  canonicalRegistryPath,
  normalizeOrphan,
};
