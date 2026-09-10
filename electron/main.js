const { app, BrowserWindow, ipcMain, shell, dialog, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
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
const { getHwid } = require('./auth/hwid');
const { saveSession, loadSession, clearSession } = require('./auth/secure-store');
const { waitForDiscordRedirect, cancelDiscordRedirect, newState } = require('./auth/oauth-server');
const { OAUTH_LOOPBACK_PORT } = require('./auth/shared-config');

const ENTRY_FILE = path.join(__dirname, '..', 'src', 'index.html');
const ENTRY_URL = pathToFileURL(ENTRY_FILE).href;
const SHREDDER_CAPABILITY_TTL_MS = 10 * 60 * 1000;
const shredderCapabilities = new Map();
let mainWindow = null;
let antiTamperGuard = null;
let updaterCheckTimer = null;
let readyHandled = false;

function isTrustedEvent(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event?.sender !== mainWindow.webContents) return false;
  try {
    const actual = new URL(event.senderFrame?.url || event.sender.getURL());
    const expected = new URL(ENTRY_URL);
    return actual.protocol === 'file:' &&
      decodeURIComponent(actual.pathname).toLowerCase() === decodeURIComponent(expected.pathname).toLowerCase();
  } catch {
    return false;
  }
}

function safeHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedEvent(event)) throw new Error('Origem IPC não autorizada');
    return handler(event, ...args);
  });
}

function safeOn(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedEvent(event)) return;
    try {
      const result = handler(event, ...args);
      Promise.resolve(result).catch((error) => console.error('[IPC] ' + channel + ':', error));
    } catch (error) {
      console.error('[IPC] ' + channel + ':', error);
    }
  });
}

function assertString(value, name, maxLength = 512, pattern = null) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || (pattern && !pattern.test(value))) {
    throw new TypeError(name + ' inválido');
  }
  return value;
}

function assertStringArray(value, name, maxItems = 100) {
  if (!Array.isArray(value) || value.length > maxItems) throw new TypeError(name + ' inválida');
  return value.map((item) => assertString(item, name, 512, /^[\w .:+(){}@%\\/-]+$/u));
}

function assertRecord(value, name, maxBytes = 65536) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(name + ' inválido');
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw new TypeError(name + ' inválido'); }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > maxBytes) throw new RangeError(name + ' muito grande');
  return value;
}

function assertAbsolutePath(value, name = 'Caminho') {
  assertString(value, name, 32767);
  if (!path.isAbsolute(value) || /^\\\\[?.]\\/u.test(value)) throw new TypeError(name + ' inválido');
  return path.resolve(value);
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function registerShredderCapability(targetPath) {
  const normalized = path.resolve(targetPath).toLowerCase();
  shredderCapabilities.set(normalized, Date.now() + SHREDDER_CAPABILITY_TTL_MS);
  return targetPath;
}

function consumeShredderCapability(targetPath) {
  const normalized = path.resolve(targetPath).toLowerCase();
  const expiresAt = shredderCapabilities.get(normalized);
  shredderCapabilities.delete(normalized);
  if (!expiresAt || expiresAt < Date.now()) throw new Error('Selecione novamente o arquivo ou pasta antes de excluir');
}

function configureSessionSecurity() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 970,
    height: 545,
    minWidth: 970,
    minHeight: 545,
    resizable: false,
    frame: false,
    backgroundColor: '#09080d',
    icon: path.join(__dirname, '..', 'assets', 'takeda-icon-1024.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    },
    show: false
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const next = new URL(navigationUrl);
      const expected = new URL(ENTRY_URL);
      if (next.protocol !== 'file:' ||
          decodeURIComponent(next.pathname).toLowerCase() !== decodeURIComponent(expected.pathname).toLowerCase()) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log('[Renderer] ' + message + ' (' + sourceId + ':' + line + ')');
  });

  mainWindow.loadFile(ENTRY_FILE).catch((error) => {
    console.error('Falha ao carregar a interface:', error);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });

  updater.init(mainWindow);
  antiTamperGuard = antiTamper.watch(mainWindow, (reason) => {
    console.log('[AntiTamper] Encerrando — motivo:', reason);
    app.exit(0);
  });

  mainWindow.on('closed', () => {
    monitor.stop();
    apps.stopAll();
    cancelDiscordRedirect('window-closed');
    antiTamperGuard?.stop();
    antiTamperGuard = null;
    shredderCapabilities.clear();
    if (updaterCheckTimer) clearTimeout(updaterCheckTimer);
    updaterCheckTimer = null;
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    configureSessionSecurity();
    createWindow();
  }).catch((error) => {
    console.error('Falha ao iniciar:', error);
    app.quit();
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && gotSingleInstanceLock) createWindow();
});
app.on('before-quit', () => {
  monitor.stop();
  apps.stopAll();
  diskAnalyzer.cancelScan?.();
  cancelDiscordRedirect('app-quit');
});
app.on('window-all-closed', () => app.quit());

safeOn('win:minimize', () => mainWindow?.minimize());
safeOn('win:maximize', () => {});
safeOn('win:close', () => mainWindow?.close());
safeOn('win:resize', (_event, width, height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !mainWindow) return;
  const safeWidth = Math.trunc(Math.min(1920, Math.max(256, width)));
  const safeHeight = Math.trunc(Math.min(1200, Math.max(256, height)));
  mainWindow.setMinimumSize(Math.min(safeWidth, 970), Math.min(safeHeight, 545));
  mainWindow.setSize(safeWidth, safeHeight);
  mainWindow.center();
});

safeOn('app:ready', () => {
  if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  if (readyHandled) return;
  readyHandled = true;
  updaterCheckTimer = setTimeout(() => updater.check(), 5000);
  updaterCheckTimer.unref?.();
});

safeHandle('diagnostic:run', () => diagnostic.run());
safeHandle('monitor:start', (_event, interval) => {
  const safeInterval = interval === undefined ? 2000 : interval;
  if (!Number.isFinite(safeInterval)) throw new TypeError('Intervalo inválido');
  monitor.start(safeInterval, (data) => sendToRenderer('monitor:data', data));
  return true;
});
safeHandle('monitor:stop', () => {
  monitor.stop();
  return true;
});

safeHandle('cleanup:sizes', () => cleanup.getSizes());
safeHandle('cleanup:execute', (_event, items) => cleanup.execute(assertStringArray(items, 'Itens de limpeza', 30)));
safeHandle('powerplan:apply', () => {
  const powFile = app.isPackaged
    ? path.join(process.resourcesPath, 'takeda.pow')
    : path.join(__dirname, '..', 'assets', 'takeda.pow');
  return powerplan.apply(powFile);
});
safeHandle('powerplan:current', () => powerplan.getCurrent());

safeHandle('apps:install', (_event, appIds) => apps.installApps(appIds, (progress) => {
  sendToRenderer('apps:progress', progress);
}));

safeHandle('history:get', () => history.get());
safeHandle('history:save', (_event, data) => history.save(assertRecord(data, 'Histórico', 32768)));
safeHandle('history:clear', () => history.clear());
safeHandle('system:username', () => require('os').userInfo().username);
safeHandle('system:locale', () => app.getLocale());

safeHandle('auth:get-hwid', () => getHwid());
safeHandle('auth:login-with-discord', async (_event, input) => {
  const clientId = assertString(assertRecord(input, 'Solicitação OAuth', 1024).clientId, 'Client ID', 32, /^\d{5,32}$/);
  const state = newState();
  const redirectUri = 'http://127.0.0.1:' + OAUTH_LOOPBACK_PORT + '/callback';
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'identify');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  const redirectPromise = waitForDiscordRedirect(state);
  try {
    await shell.openExternal(authorizeUrl.toString());
  } catch (error) {
    cancelDiscordRedirect('browser-open-failed');
    await redirectPromise.catch(() => {});
    throw error;
  }
  return { code: await redirectPromise };
});
safeHandle('auth:save-session', (_event, token) => saveSession(assertString(token, 'Token', 16384)));
safeHandle('auth:load-session', () => loadSession());
safeHandle('auth:clear-session', () => clearSession());

safeHandle('updater:check', () => updater.check());
safeHandle('updater:download', () => updater.download());
safeHandle('updater:install', () => updater.install());
safeHandle('updater:version', () => updater.getVersion());

safeHandle('cleanup:ruleSizes', () => cleanup.getRuleSizes());
safeHandle('cleanup:executeRules', (_event, ids) => cleanup.executeRules(assertStringArray(ids, 'Regras', 100)));

safeHandle('registry:listStartup', () => registry.listStartup());
safeHandle('registry:disableStartup', (_event, item) => registry.disableStartupItem(assertRecord(item, 'Item de inicialização')));
safeHandle('registry:enableStartup', (_event, item) => registry.enableStartupItem(assertRecord(item, 'Item de inicialização')));
safeHandle('registry:scanOrphaned', () => registry.scanOrphaned());
safeHandle('registry:removeOrphaned', (_event, entries) => {
  if (!Array.isArray(entries) || entries.length > 500) throw new TypeError('Entradas de registro inválidas');
  entries.forEach((entry) => assertRecord(entry, 'Entrada de registro', 8192));
  return registry.removeOrphaned(entries);
});

safeHandle('disk:shortcuts', () => diskAnalyzer.shortcuts());
safeHandle('disk:scan', (_event, rootPath) => diskAnalyzer.scanFolder(assertAbsolutePath(rootPath)));
safeHandle('disk:cancel', () => {
  diskAnalyzer.cancelScan();
  return true;
});
safeHandle('disk:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

safeHandle('shredder:pickFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  return result.canceled ? null : registerShredderCapability(result.filePaths[0]);
});
safeHandle('shredder:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : registerShredderCapability(result.filePaths[0]);
});
safeHandle('shredder:execute', async (_event, targetPath, passes = 3) => {
  let totalFreed = 0;
  let totalCount = 0;
  try {
    const safePath = assertAbsolutePath(targetPath);
    shredder.validatePasses(passes);
    consumeShredderCapability(safePath);
    const result = await shredder.shredPath(safePath, passes, (progress) => {
      totalFreed += progress.size;
      totalCount += 1;
      sendToRenderer('shredder:progress', { path: progress.path, totalFreed, totalCount });
    });
    return { ok: true, freed: result.freed, count: result.count };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

safeHandle('privacy:list', () => privacy.list());
safeHandle('privacy:status', () => privacy.getStatus());
safeHandle('privacy:set', (_event, id, protect) => {
  assertString(id, 'ID de privacidade', 64, /^[a-z0-9_-]+$/i);
  if (typeof protect !== 'boolean') throw new TypeError('Estado de privacidade inválido');
  return privacy.setToggle(id, protect);
});

safeHandle('malware:status', () => malware.getStatus());
safeHandle('malware:scan', (_event, type) => {
  if (type !== 'Quick' && type !== 'Full') throw new TypeError('Tipo de verificação inválido');
  return malware.runScan(type);
});
safeHandle('malware:threats', () => malware.getThreats());
safeHandle('debloat:list', () => debloat.listStatus());
safeHandle('debloat:remove', (_event, ids) => debloat.remove(assertStringArray(ids, 'Aplicativos', 100)));
