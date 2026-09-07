const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulso', {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  resize: (w, h) => ipcRenderer.send('win:resize', w, h),
  ready: () => ipcRenderer.send('app:ready'),

  // Diagnostic
  runDiagnostic: () => ipcRenderer.invoke('diagnostic:run'),

  // Monitor
  startMonitor: (interval) => ipcRenderer.invoke('monitor:start', interval),
  stopMonitor: () => ipcRenderer.invoke('monitor:stop'),
  onMonitorData: (callback) => {
    ipcRenderer.on('monitor:data', (_, data) => callback(data));
  },
  removeMonitorListener: () => {
    ipcRenderer.removeAllListeners('monitor:data');
  },

  // Cleanup
  getCleanupSizes: () => ipcRenderer.invoke('cleanup:sizes'),

  executeCleanup: (items) => ipcRenderer.invoke('cleanup:execute', items),

  // Power Plan
  applyPowerPlan: () => ipcRenderer.invoke('powerplan:apply'),
  getCurrentPlan: () => ipcRenderer.invoke('powerplan:current'),

  // Apps
  installApps: (appIds) => ipcRenderer.invoke('apps:install', appIds),
  onAppsProgress: (callback) => {
    ipcRenderer.on('apps:progress', (_, data) => callback(data));
  },
  removeAppsListener: () => {
    ipcRenderer.removeAllListeners('apps:progress');
  },

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  saveHistory: (data) => ipcRenderer.invoke('history:save', data),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // System
  getUsername: () => ipcRenderer.invoke('system:username'),
  getLocale: () => ipcRenderer.invoke('system:locale'),

  // Auth
  auth: {
    getHwid: () => ipcRenderer.invoke('auth:get-hwid'),
    loginWithDiscord: (clientId) => ipcRenderer.invoke('auth:login-with-discord', { clientId }),
    saveSession: (token) => ipcRenderer.invoke('auth:save-session', token),
    loadSession: () => ipcRenderer.invoke('auth:load-session'),
    clearSession: () => ipcRenderer.invoke('auth:clear-session'),
  },

  // Updater
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('updater:version'),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('updater:update-available', (_, info) => cb(info));
  },
  onDownloadProgress: (cb) => {
    ipcRenderer.on('updater:download-progress', (_, p) => cb(p));
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info));
  },
  onUpdateError: (cb) => {
    ipcRenderer.on('updater:error', (_, err) => cb(err));
  },

  // Limpeza Avançada (regras)
  getRuleSizes: () => ipcRenderer.invoke('cleanup:ruleSizes'),
  executeRules: (ids) => ipcRenderer.invoke('cleanup:executeRules', ids),

  // Registro & Inicialização
  listStartup: () => ipcRenderer.invoke('registry:listStartup'),
  disableStartup: (item) => ipcRenderer.invoke('registry:disableStartup', item),
  enableStartup: (item) => ipcRenderer.invoke('registry:enableStartup', item),
  scanOrphanedRegistry: () => ipcRenderer.invoke('registry:scanOrphaned'),
  removeOrphanedRegistry: (entries) => ipcRenderer.invoke('registry:removeOrphaned', entries),

  // Analisador de Disco
  getDiskShortcuts: () => ipcRenderer.invoke('disk:shortcuts'),
  scanDisk: (rootPath) => ipcRenderer.invoke('disk:scan', rootPath),
  pickDiskFolder: () => ipcRenderer.invoke('disk:pickFolder'),

  // Exclusão Segura (Shredder)
  shredPickFile: () => ipcRenderer.invoke('shredder:pickFile'),
  shredPickFolder: () => ipcRenderer.invoke('shredder:pickFolder'),
  shredExecute: (targetPath, passes) => ipcRenderer.invoke('shredder:execute', targetPath, passes),
  onShredProgress: (callback) => {
    ipcRenderer.on('shredder:progress', (_, data) => callback(data));
  },
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
  removeDebloatApps: (ids) => ipcRenderer.invoke('debloat:remove', ids),
});
