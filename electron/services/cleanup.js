const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');

async function getDirSize(dirPath) {
  let size = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        size += (await fs.stat(fullPath)).size;
      }
    }
  } catch (err) {
    // ignore access denied or missing dirs
  }
  return size;
}

async function getPatternSize(dirPath, ext) {
  let size = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (!file.isDirectory() && (!ext || file.name.endsWith(ext))) {
        size += (await fs.stat(path.join(dirPath, file.name))).size;
      }
    }
  } catch (err) {}
  return size;
}

// Recycle Bin requires COM or PowerShell, we'll keep a fast PS call for it
function getRecycleBinSize() {
  return new Promise((resolve) => {
    const script = `
      try {
        $sh = New-Object -ComObject Shell.Application
        $bin = $sh.Namespace(10)
        $s = 0
        if ($bin) { foreach ($i in $bin.Items()) { $s += $i.Size } }
        Write-Output $s
      } catch { Write-Output 0 }
    `;
    execFile('powershell.exe', ['-NoProfile', '-Command', script], (err, stdout) => {
      resolve(parseInt(stdout) || 0);
    });
  });
}

function emptyRecycleBin() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'], () => resolve());
  });
}

async function getSizes() {
  const localAppData = process.env.LOCALAPPDATA;
  const windir = process.env.WINDIR;
  const tempUser = process.env.TEMP;

  const [
    tempUserSize,
    tempWinSize,
    prefetchSize,
    crashDumps1,
    crashDumps2,
    thumbcacheSize,
    recycleBinSize
  ] = await Promise.all([
    getDirSize(tempUser),
    getDirSize(path.join(windir, 'Temp')),
    getPatternSize(path.join(windir, 'Prefetch'), '.pf'),
    getDirSize(path.join(localAppData, 'CrashDumps')),
    getDirSize(path.join(windir, 'Minidump')),
    getPatternSize(path.join(localAppData, 'Microsoft', 'Windows', 'Explorer'), '.db'), // actually thumbcache_*.db but good enough
    getRecycleBinSize()
  ]);

  return {
    tempUser: tempUserSize,
    tempWin: tempWinSize,
    prefetch: prefetchSize,
    crashDumps: crashDumps1 + crashDumps2,
    thumbcache: thumbcacheSize,
    recycleBin: recycleBinSize,
    total: tempUserSize + tempWinSize + prefetchSize + crashDumps1 + crashDumps2 + thumbcacheSize + recycleBinSize
  };
}

async function emptyDir(dirPath) {
  let freed = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      try {
        if (file.isDirectory()) {
          freed += await getDirSize(fullPath);
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          const stats = await fs.stat(fullPath);
          freed += stats.size;
          await fs.unlink(fullPath);
        }
      } catch (err) {}
    }
  } catch (err) {}
  return freed;
}

async function execute(items) {
  let totalFreed = 0;
  const results = [];
  const localAppData = process.env.LOCALAPPDATA;
  const windir = process.env.WINDIR;

  if (items.includes('TempUser')) {
    const freed = await emptyDir(process.env.TEMP);
    totalFreed += freed;
    results.push({ name: 'TempUser', freed });
  }

  if (items.includes('TempWindows')) {
    const freed = await emptyDir(path.join(windir, 'Temp'));
    totalFreed += freed;
    results.push({ name: 'TempWindows', freed });
  }

  if (items.includes('Prefetch')) {
    const freed = await emptyDir(path.join(windir, 'Prefetch'));
    totalFreed += freed;
    results.push({ name: 'Prefetch', freed });
  }

  if (items.includes('CrashDumps')) {
    let freed = await emptyDir(path.join(localAppData, 'CrashDumps'));
    freed += await emptyDir(path.join(windir, 'Minidump'));
    totalFreed += freed;
    results.push({ name: 'CrashDumps', freed });
  }

  if (items.includes('Thumbcache')) {
    // Can't easily delete thumbcache files while explorer is running, 
    // but we can try removing .db files in that folder
    const dir = path.join(localAppData, 'Microsoft', 'Windows', 'Explorer');
    let freed = 0;
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.db')) {
          const p = path.join(dir, file);
          try {
            const size = (await fs.stat(p)).size;
            await fs.unlink(p);
            freed += size;
          } catch(e){}
        }
      }
    } catch(e){}
    totalFreed += freed;
    results.push({ name: 'Thumbcache', freed });
  }

  if (items.includes('RecycleBin')) {
    const size = await getRecycleBinSize();
    await emptyRecycleBin();
    totalFreed += size;
    results.push({ name: 'RecycleBin', freed: size });
  }

  return { results, totalFreed };
}

module.exports = { getSizes, execute };
