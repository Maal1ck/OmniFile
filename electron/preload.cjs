const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  buildNativeIndex: () => ipcRenderer.invoke('native:buildIndex'),
  queryNativeIndex: (query, options) => ipcRenderer.invoke('native:queryIndex', { query, options }),
  queryLiveEverything: (query, options) => ipcRenderer.invoke('everything:search', { query, options }),
  getDrives: () => ipcRenderer.invoke('drives:list'),
  openPath: (fullPath) => ipcRenderer.invoke('shell:openPath', fullPath),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:showItemInFolder', fullPath),
});
