const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

let mainWin = null;
let initialized = false;
let checkingPromise = null;
let downloadPromise = null;

/**
 * Initialize the auto-updater.
 * @param {BrowserWindow} win - The main BrowserWindow to send events to.
 */
function init(win) {
  mainWin = win;
  if (initialized) return { initialized: false };
  initialized = true;

  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Logging
  autoUpdater.logger = require('electron').app.isPackaged ? null : console;

  // ── Events ──

  autoUpdater.on('update-available', (info) => {
    send('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes || '',
      releaseDate: info.releaseDate || '',
    });
  });

  autoUpdater.on('update-not-available', () => {
    send('updater:update-not-available', {});
  });

  autoUpdater.on('download-progress', (progress) => {
    send('updater:download-progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:update-downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    send('updater:error', {
      message: err?.message || 'Erro desconhecido ao verificar atualizações',
    });
  });

  return { initialized: true };
}

/**
 * Check for available updates.
 */
async function check() {
  if (!app.isPackaged) {
    // In dev mode, don't actually check — just log
    console.log('[Updater] Skipping update check in dev mode');
    return { skipped: true, reason: 'dev-mode' };
  }
  if (checkingPromise) return checkingPromise;
  checkingPromise = autoUpdater.checkForUpdates()
    .then(() => ({ checking: true }))
    .catch((err) => ({ error: err?.message || 'Falha ao verificar atualizações' }))
    .finally(() => { checkingPromise = null; });
  return checkingPromise;
}

/**
 * Start downloading the available update.
 */
async function download() {
  if (downloadPromise) return downloadPromise;
  downloadPromise = autoUpdater.downloadUpdate()
    .then(() => ({ downloading: true }))
    .catch((err) => ({ error: err?.message || 'Falha ao baixar a atualização' }))
    .finally(() => { downloadPromise = null; });
  return downloadPromise;
}

/**
 * Quit and install the downloaded update.
 */
function install() {
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get the current app version.
 */
function getVersion() {
  return app.getVersion();
}

function send(channel, data) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data);
  }
}

module.exports = { init, check, download, install, getVersion };
