const { contextBridge, ipcRenderer } = require('electron');

function boundedString(value, name, maxLength = 512) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new TypeError(name + ' inválido');
  }
  return value;
}

function boundedArray(value, name, maxItems = 100) {
  if (!Array.isArray(value) || value.length > maxItems) throw new TypeError(name + ' inválida');
  return value;
}

function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Callback inválido');
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('pulso', {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  resize: (w, h) => {
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new TypeError('Dimensões inválidas');
    ipcRenderer.send('win:resize', w, h);
  },
  ready: () => ipcRenderer.send('app:ready'),

  // Diagnostic
  runDiagnostic: () => ipcRenderer.invoke('diagnostic:run'),

  // Monitor
  startMonitor: (interval) => {
    if (interval !== undefined && !Number.isFinite(interval)) throw new TypeError('Intervalo inválido');
    return ipcRenderer.invoke('monitor:start', interval);
  },
  stopMonitor: () => ipcRenderer.invoke('monitor:stop'),
  onMonitorData: (callback) => subscribe('monitor:data', callback),
  removeMonitorListener: () => {
    ipcRenderer.removeAllListeners('monitor:data');
  },

  // Cleanup
  getCleanupSizes: () => ipcRenderer.invoke('cleanup:sizes'),

  executeCleanup: (items) => ipcRenderer.invoke('cleanup:execute', boundedArray(items, 'Itens de limpeza', 30)),

  // Power Plan
  applyPowerPlan: () => ipcRenderer.invoke('powerplan:apply'),
  getCurrentPlan: () => ipcRenderer.invoke('powerplan:current'),

  // Apps
  installApps: (appIds) => ipcRenderer.invoke('apps:install', boundedArray(appIds, 'Aplicativos', 50)),
  onAppsProgress: (callback) => subscribe('apps:progress', callback),
  removeAppsListener: () => {
    ipcRenderer.removeAllListeners('apps:progress');
  },

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  saveHistory: (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Histórico inválido');
    return ipcRenderer.invoke('history:save', data);
  },
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // System
  getUsername: () => ipcRenderer.invoke('system:username'),
  getLocale: () => ipcRenderer.invoke('system:locale'),

  // Auth
  auth: {
    getHwid: () => ipcRenderer.invoke('auth:get-hwid'),
    loginWithDiscord: (clientId) => ipcRenderer.invoke('auth:login-with-discord', {
      clientId: boundedString(clientId, 'Client ID', 32)
    }),
    saveSession: (token) => ipcRenderer.invoke('auth:save-session', boundedString(token, 'Token', 16384)),
    loadSession: () => ipcRenderer.invoke('auth:load-session'),
    clearSession: () => ipcRenderer.invoke('auth:clear-session'),
  },

  // Updater
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('updater:version'),
  onUpdateAvailable: (cb) => subscribe('updater:update-available', cb),
  onDownloadProgress: (cb) => subscribe('updater:download-progress', cb),
  onUpdateDownloaded: (cb) => subscribe('updater:update-downloaded', cb),
  onUpdateError: (cb) => subscribe('updater:error', cb),

  // Limpeza Avançada (regras)
  getRuleSizes: () => ipcRenderer.invoke('cleanup:ruleSizes'),
  executeRules: (ids) => ipcRenderer.invoke('cleanup:executeRules', boundedArray(ids, 'Regras', 100)),

  // Registro & Inicialização
  listStartup: () => ipcRenderer.invoke('registry:listStartup'),
  disableStartup: (item) => ipcRenderer.invoke('registry:disableStartup', item),
  enableStartup: (item) => ipcRenderer.invoke('registry:enableStartup', item),
  scanOrphanedRegistry: () => ipcRenderer.invoke('registry:scanOrphaned'),
  removeOrphanedRegistry: (entries) => ipcRenderer.invoke(
    'registry:removeOrphaned',
    boundedArray(entries, 'Entradas de registro', 500)
  ),

  // Analisador de Disco
  getDiskShortcuts: () => ipcRenderer.invoke('disk:shortcuts'),
  scanDisk: (rootPath) => ipcRenderer.invoke('disk:scan', rootPath),
  cancelDiskScan: () => ipcRenderer.invoke('disk:cancel'),
  pickDiskFolder: () => ipcRenderer.invoke('disk:pickFolder'),

  // Exclusão Segura (Shredder)
  shredPickFile: () => ipcRenderer.invoke('shredder:pickFile'),
  shredPickFolder: () => ipcRenderer.invoke('shredder:pickFolder'),
  shredExecute: (targetPath, passes) => {
    boundedString(targetPath, 'Caminho', 32767);
    if (!Number.isInteger(passes) || passes < 1 || passes > 7) throw new RangeError('Passes inválidos');
    return ipcRenderer.invoke('shredder:execute', targetPath, passes);
  },
  onShredProgress: (callback) => subscribe('shredder:progress', callback),
  removeShredProgressListener: () => {
    ipcRenderer.removeAllListeners('shredder:progress');
  },

  // Central de Privacidade
  listPrivacyToggles: () => ipcRenderer.invoke('privacy:list'),
  getPrivacyStatus: () => ipcRenderer.invoke('privacy:status'),
  setPrivacyToggle: (id, protect) => ipcRenderer.invoke('privacy:set', id, protect),

  // Segurança (Windows Defender)
  getMalwareStatus: () => ipcRenderer.invoke('malware:status'),
  runMalwareScan: (type) => ipcRenderer.invoke('malware:scan', type),
  getMalwareThreats: () => ipcRenderer.invoke('malware:threats'),

  // Debloat do Windows
  listDebloatApps: () => ipcRenderer.invoke('debloat:list'),
  removeDebloatApps: (ids) => ipcRenderer.invoke('debloat:remove', boundedArray(ids, 'Aplicativos', 100)),
});
