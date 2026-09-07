const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const diagnostic = require('./services/diagnostic');
const cleanup = require('./services/cleanup');
const powerplan = require('./services/powerplan');
const monitor = require('./services/monitor');
const history = require('./services/history');
const apps = require('./services/apps');
const updater = require('./services/updater');
const antiTamper = require('./services/antiTamper');
const registry = require('./services/registry');
const diskAnalyzer = require('./services/diskAnalyzer');
const shredder = require('./services/shredder');
const privacy = require('./services/privacy');
const malware = require('./services/malware');
const debloat = require('./services/debloat');

let mainWindow;
let splashWindow;

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 970,
    height: 545,
    minWidth: 970,
    minHeight: 545,
    resizable: false,
    frame: false,
    backgroundColor: '#12141a',
    icon: path.join(__dirname, '..', 'assets', 'takeda-icon-1024.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => {
    monitor.stop();
    mainWindow = null;
  });

  // Fecha o app imediatamente se detectar DevTools aberto (ou, se ativado em
  // antiTamper.js, um processo de debug/engenharia reversa conhecido).
  antiTamper.watch(mainWindow, (reason) => {
    console.log('[AntiTamper] Encerrando — motivo:', reason);
    app.exit(0);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// ── Window Controls ──
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => { /* disabled */ });
ipcMain.on('win:close', () => mainWindow?.close());
ipcMain.on('win:resize', (event, width, height) => {
  if (mainWindow) {
    // Allow window to shrink by updating minimum size first
    mainWindow.setMinimumSize(Math.min(width, 970), Math.min(height, 545));
    mainWindow.setSize(width, height);
    mainWindow.center();
  }
});

ipcMain.on('app:ready', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
  }

  // Initialize updater and auto-check after a short delay
  if (mainWindow) {
    updater.init(mainWindow);
    setTimeout(() => updater.check(), 5000);
  }
});

// ── Diagnostic ──
ipcMain.handle('diagnostic:run', async () => {
  return await diagnostic.run();
});

// ── Monitor ──
ipcMain.handle('monitor:start', (event, interval) => {
  monitor.start(interval || 2000, (data) => {
    mainWindow?.webContents.send('monitor:data', data);
  });
  return true;
});

ipcMain.handle('monitor:stop', () => {
  monitor.stop();
  return true;
});

// ── Cleanup ──
ipcMain.handle('cleanup:sizes', async () => {
  return await cleanup.getSizes();
});

ipcMain.handle('cleanup:execute', async (event, items) => {
  return await cleanup.execute(items);
});

// ── Power Plan ──
ipcMain.handle('powerplan:apply', async () => {
  const powFile = app.isPackaged
    ? path.join(process.resourcesPath, 'takeda.pow')
    : path.join(__dirname, '..', 'assets', 'takeda.pow');
  return await powerplan.apply(powFile);
});

ipcMain.handle('powerplan:current', async () => {
  return await powerplan.getCurrent();
});


// ── Apps ──
ipcMain.handle('apps:install', async (event, appIds) => {
  return await apps.installApps(appIds, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('apps:progress', progress);
    }
  });
});

// ── History ──
ipcMain.handle('history:get', async () => {
  return await history.get();
});


ipcMain.handle('history:save', async (event, data) => {
  return await history.save(data);
});

ipcMain.handle('history:clear', async () => {
  return await history.clear();
});

// ── System Info ──
ipcMain.handle('system:username', () => {
  return require('os').userInfo().username;
});

ipcMain.handle('system:locale', () => {
  return app.getLocale();
});

// ── Auth ──
const { getHwid } = require('./auth/hwid');
const { saveSession, loadSession, clearSession } = require('./auth/secure-store');
const { waitForDiscordRedirect, newState } = require('./auth/oauth-server');
const { OAUTH_LOOPBACK_PORT } = require('./auth/shared-config');

ipcMain.handle('auth:get-hwid', () => getHwid());

ipcMain.handle('auth:login-with-discord', async (_evt, { clientId }) => {
  const state = newState();
  const redirectUri = encodeURIComponent(`http://127.0.0.1:${OAUTH_LOOPBACK_PORT}/callback`);
  const authorizeUrl =
    `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&scope=identify&redirect_uri=${redirectUri}&state=${state}`;

  const redirectPromise = waitForDiscordRedirect(state);
  await shell.openExternal(authorizeUrl);
  const code = await redirectPromise;
  return { code };
});

ipcMain.handle('auth:save-session', (_evt, token) => saveSession(token));
ipcMain.handle('auth:load-session', () => loadSession());
ipcMain.handle('auth:clear-session', () => clearSession());

// ── Updater ──
ipcMain.handle('updater:check', async () => {
  return await updater.check();
});

ipcMain.handle('updater:download', async () => {
  return await updater.download();
});

ipcMain.handle('updater:install', () => {
  updater.install();
});

ipcMain.handle('updater:version', () => {
  return updater.getVersion();
});

// ── Limpeza Avançada (regras) ──
ipcMain.handle('cleanup:ruleSizes', async () => {
  return await cleanup.getRuleSizes();
});

ipcMain.handle('cleanup:executeRules', async (event, ids) => {
  return await cleanup.executeRules(ids);
});

// ── Registro & Inicialização ──
ipcMain.handle('registry:listStartup', async () => {
  return await registry.listStartup();
});

ipcMain.handle('registry:disableStartup', async (event, item) => {
  return await registry.disableStartupItem(item);
});

ipcMain.handle('registry:enableStartup', async (event, item) => {
  return await registry.enableStartupItem(item);
});

ipcMain.handle('registry:scanOrphaned', async () => {
  return await registry.scanOrphaned();
});

ipcMain.handle('registry:removeOrphaned', async (event, entries) => {
  return await registry.removeOrphaned(entries);
});

// ── Analisador de Disco ──
ipcMain.handle('disk:shortcuts', () => {
  return diskAnalyzer.shortcuts();
});

ipcMain.handle('disk:scan', async (event, rootPath) => {
  return await diskAnalyzer.scanFolder(rootPath);
});

ipcMain.handle('disk:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});

// ── Exclusão Segura (Shredder) ──
ipcMain.handle('shredder:pickFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('shredder:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('shredder:execute', async (event, targetPath, passes) => {
  let totalFreed = 0;
  let totalCount = 0;
  try {
    const result = await shredder.shredPath(targetPath, passes || 3, (p) => {
      totalFreed += p.size;
      totalCount += 1;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shredder:progress', { path: p.path, totalFreed, totalCount });
      }
    });
    return { ok: true, freed: result.freed, count: result.count };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── Central de Privacidade ──
ipcMain.handle('privacy:list', () => {
  return privacy.list();
});

ipcMain.handle('privacy:status', async () => {
  return await privacy.getStatus();
});

ipcMain.handle('privacy:set', async (event, id, protect) => {
  return await privacy.setToggle(id, protect);
});

// ── Segurança (Windows Defender) ──
ipcMain.handle('malware:status', async () => {
  return await malware.getStatus();
});

ipcMain.handle('malware:scan', async (event, type) => {
  return await malware.runScan(type);
});

ipcMain.handle('malware:threats', async () => {
  return await malware.getThreats();
});

// ── Debloat do Windows ──
ipcMain.handle('debloat:list', async () => {
  return await debloat.listStatus();
});

ipcMain.handle('debloat:remove', async (event, ids) => {
  return await debloat.remove(ids);
});
