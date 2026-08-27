const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const diagnostic = require('./services/diagnostic');
const cleanup = require('./services/cleanup');
const powerplan = require('./services/powerplan');
const monitor = require('./services/monitor');
const history = require('./services/history');
const apps = require('./services/apps');
const updater = require('./services/updater');

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
