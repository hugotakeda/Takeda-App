const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

let mainWin = null;

/**
 * Initialize the auto-updater.
 * @param {BrowserWindow} win - The main BrowserWindow to send events to.
 */
function init(win) {
  mainWin = win;

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
  try {
    const result = await autoUpdater.checkForUpdates();
    return { checking: true };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Start downloading the available update.
 */
async function download() {
  try {
    await autoUpdater.downloadUpdate();
    return { downloading: true };
  } catch (err) {
    return { error: err.message };
  }
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
