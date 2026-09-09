import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  saveFile: (fileName: string, dataUrl: string) => ipcRenderer.invoke('save-file', { fileName, dataUrl }),
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  },
});
