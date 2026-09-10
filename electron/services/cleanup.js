const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { RULE_CATEGORIES, resolveRulePaths } = require('./rules');
const { runElevated } = require('./elevated');

const BASIC_ITEMS = new Set(['TempUser', 'TempWindows', 'Prefetch', 'CrashDumps', 'Thumbcache', 'RecycleBin']);

function windowsPaths() {
  const systemDrive = process.env.SYSTEMDRIVE || 'C:';
  const home = os.homedir();
  return {
    localAppData: process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
    windir: process.env.WINDIR || path.join(systemDrive, 'Windows'),
    tempUser: process.env.TEMP || process.env.TMP || os.tmpdir(),
  };
}

function runPS(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stderr: String(stderr || '').trim() }));
        else resolve(String(stdout || '').trim());
      },
    );
  });
}

async function getDirSize(dirPath) {
  if (!dirPath) return 0;
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory() && !entry.isSymbolicLink()) size += await getDirSize(fullPath);
        else if (entry.isFile()) size += (await fs.stat(fullPath)).size;
      } catch {
        // Arquivos podem desaparecer ou ficar bloqueados enquanto medimos.
      }
    }
  } catch {
    // Pasta inexistente ou sem permissão: tamanho conhecido é zero.
  }
  return size;
}

async function getMatchingSize(dirPath, predicate) {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !predicate(entry.name)) continue;
      try { size += (await fs.stat(path.join(dirPath, entry.name))).size; } catch { /* raced/locked */ }
    }
  } catch { /* missing/inaccessible */ }
  return size;
}

function getRecycleBinSize() {
  const script = `
    $ErrorActionPreference = 'Stop'
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.Namespace(10)
    [int64]$size = 0
    if ($bin) { foreach ($item in $bin.Items()) { $size += [int64]$item.Size } }
    Write-Output $size
  `;
  return runPS(script).then((output) => Number.parseInt(output, 10) || 0);
}

async function emptyRecycleBin() {
  await runPS("$ErrorActionPreference = 'Stop'; Clear-RecycleBin -Force -Confirm:$false -ErrorAction Stop");
}

async function getSizes() {
  const { localAppData, windir, tempUser } = windowsPaths();
  const [tempUserSize, tempWinSize, prefetchSize, crashDumps1, crashDumps2, thumbcacheSize, recycleBinSize] = await Promise.all([
    getDirSize(tempUser),
    getDirSize(path.join(windir, 'Temp')),
    getMatchingSize(path.join(windir, 'Prefetch'), (name) => /\.pf$/i.test(name)),
    getDirSize(path.join(localAppData, 'CrashDumps')),
    getDirSize(path.join(windir, 'Minidump')),
    getMatchingSize(path.join(localAppData, 'Microsoft', 'Windows', 'Explorer'), (name) => /^thumbcache_.*\.db$/i.test(name)),
    getRecycleBinSize().catch(() => 0),
  ]);

  const result = {
    tempUser: tempUserSize,
    tempWin: tempWinSize,
    prefetch: prefetchSize,
    crashDumps: crashDumps1 + crashDumps2,
    thumbcache: thumbcacheSize,
    recycleBin: recycleBinSize,
  };
  return { ...result, total: Object.values(result).reduce((sum, value) => sum + value, 0) };
}

function emptyStats() {
  return { freed: 0, removed: 0, failed: 0 };
}

function mergeStats(target, source) {
  target.freed += source.freed;
  target.removed += source.removed;
  target.failed += source.failed;
  return target;
}

async function emptyDir(dirPath) {
  const result = emptyStats();
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        mergeStats(result, await emptyDir(fullPath));
        try { await fs.rmdir(fullPath); } catch (error) {
          if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') result.failed += 1;
        }
        continue;
      }

      try {
        const stat = await fs.lstat(fullPath);
        await fs.unlink(fullPath);
        result.freed += entry.isFile() ? stat.size : 0;
        result.removed += 1;
      } catch (error) {
        if (error?.code !== 'ENOENT') result.failed += 1;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') result.failed += 1;
  }
  return result;
}

async function deleteMatchingFiles(dirPath, predicate) {
  const result = emptyStats();
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !predicate(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        await fs.unlink(fullPath);
        result.freed += stat.size;
        result.removed += 1;
      } catch (error) {
        if (error?.code !== 'ENOENT') result.failed += 1;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') result.failed += 1;
  }
  return result;
}

async function execute(items) {
  if (!Array.isArray(items)) throw new TypeError('Itens de limpeza inválidos');
  const selected = [...new Set(items)];
  if (selected.some((item) => !BASIC_ITEMS.has(item))) throw new TypeError('Item de limpeza desconhecido');

  const { localAppData, windir, tempUser } = windowsPaths();
  const results = [];
  const add = (name, stats, error = null) => {
    results.push({ name, ...stats, ok: !error && stats.failed === 0, ...(error ? { error } : {}) });
  };

  for (const item of selected) {
    try {
      if (item === 'TempUser') add(item, await emptyDir(tempUser));
      else if (item === 'TempWindows') add(item, await emptyDir(path.join(windir, 'Temp')));
      else if (item === 'Prefetch') add(item, await deleteMatchingFiles(path.join(windir, 'Prefetch'), (name) => /\.pf$/i.test(name)));
      else if (item === 'CrashDumps') {
        const stats = await emptyDir(path.join(localAppData, 'CrashDumps'));
        mergeStats(stats, await emptyDir(path.join(windir, 'Minidump')));
        add(item, stats);
      } else if (item === 'Thumbcache') {
        add(item, await deleteMatchingFiles(
          path.join(localAppData, 'Microsoft', 'Windows', 'Explorer'),
          (name) => /^thumbcache_.*\.db$/i.test(name),
        ));
      } else if (item === 'RecycleBin') {
        const before = await getRecycleBinSize();
        await emptyRecycleBin();
        const after = await getRecycleBinSize().catch(() => 0);
        add(item, { freed: Math.max(0, before - after), removed: before > after ? 1 : 0, failed: after > 0 ? 1 : 0 });
      }
    } catch (error) {
      add(item, emptyStats(), error?.message || String(error));
    }
  }

  return {
    ok: results.every((result) => result.ok),
    results,
    totalFreed: results.reduce((sum, result) => sum + result.freed, 0),
    failed: results.reduce((sum, result) => sum + result.failed + (result.error ? 1 : 0), 0),
  };
}

function findRule(id) {
  for (const category of RULE_CATEGORIES) {
    const rule = category.rules.find((candidate) => candidate.id === id);
    if (rule) return rule;
  }
  return null;
}

async function removeWindowsOld(dirPath) {
  const safePath = dirPath.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    $target = '${safePath}'
    if (Test-Path -LiteralPath $target) {
      & takeown.exe /F $target /R /D Y | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Não foi possível assumir a propriedade de Windows.old.' }
      & icacls.exe $target /grant '*S-1-5-32-544:F' /T /C | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ajustar as permissões de Windows.old.' }
      Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $target) { throw 'Windows.old não foi removida por completo.' }
  `;
  await runElevated(script, 5 * 60 * 1000);
}

async function getRuleSizes() {
  const rules = RULE_CATEGORIES.flatMap((category) => category.rules);
  const sizes = {};
  let cursor = 0;

  async function worker() {
    while (cursor < rules.length) {
      const rule = rules[cursor++];
      let total = 0;
      for (const rulePath of resolveRulePaths(rule)) total += await getDirSize(rulePath);
      sizes[rule.id] = total;
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, rules.length) }, () => worker()));
  return sizes;
}

async function executeRules(ruleIds) {
  if (!Array.isArray(ruleIds)) throw new TypeError('Regras inválidas');
  const selected = [...new Set(ruleIds)];
  const results = [];

  for (const id of selected) {
    const rule = findRule(id);
    if (!rule) throw new TypeError(`Regra desconhecida: ${id}`);
    const paths = resolveRulePaths(rule);
    const stats = emptyStats();
    let error = null;

    try {
      for (const rulePath of paths) {
        if (rule.id === 'windows-old') {
          const before = await getDirSize(rulePath);
          await removeWindowsOld(rulePath);
          const after = await getDirSize(rulePath);
          stats.freed += Math.max(0, before - after);
          stats.removed += before > after ? 1 : 0;
          stats.failed += after > 0 ? 1 : 0;
        } else {
          mergeStats(stats, await emptyDir(rulePath));
        }
      }
    } catch (caught) {
      error = caught?.message || String(caught);
    }

    results.push({ id, ...stats, ok: !error && stats.failed === 0, ...(error ? { error } : {}) });
  }

  return {
    ok: results.every((result) => result.ok),
    results,
    totalFreed: results.reduce((sum, result) => sum + result.freed, 0),
    failed: results.reduce((sum, result) => sum + result.failed + (result.error ? 1 : 0), 0),
  };
}

module.exports = { getSizes, execute, getRuleSizes, executeRules, getDirSize };
