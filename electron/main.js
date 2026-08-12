const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const diagnostic = require('./services/diagnostic');
const cleanup = require('./services/cleanup');
const powerplan = require('./services/powerplan');
const monitor = require('./services/monitor');
const history = require('./services/history');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 220,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win:close', () => mainWindow?.close());

ipcMain.on('app:ready', () => {
  if (mainWindow) {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(860, 600);
    mainWindow.setSize(1000, 700);
    mainWindow.center();
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
