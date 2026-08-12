const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const diagnostic = require('./services/diagnostic');
const cleanup = require('./services/cleanup');
const powerplan = require('./services/powerplan');
const monitor = require('./services/monitor');
const history = require('./services/history');

let mainWindow;
let splashWindow;

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 256,
    height: 256,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, '..', 'assets', 'takeda-icon-1024.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, '..', 'src', 'splash.html'));

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

ipcMain.on('app:ready', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
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

// ── History ──
ipcMain.handle('history:get', async () => {
  return await history.get();
});


ipcMain.handle('history:save', async (event, data) => {
  return await history.save(data);
});

// ── System Info ──
ipcMain.handle('system:username', () => {
  return require('os').userInfo().username;
});
