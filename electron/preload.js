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

  // Tweaks
  applyTweak: (id, enable) => ipcRenderer.invoke('tweaks:apply', id, enable),
  getTweaksStatus: () => ipcRenderer.invoke('tweaks:status'),

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
  }
});
