const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulso', {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
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

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  saveHistory: (data) => ipcRenderer.invoke('history:save', data),

  // System
  getUsername: () => ipcRenderer.invoke('system:username'),
});
