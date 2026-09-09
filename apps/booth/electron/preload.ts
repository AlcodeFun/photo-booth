import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  },
  camera: {
    getStatus: () => ipcRenderer.invoke('camera:get-status'),
    initialize: () => ipcRenderer.invoke('camera:initialize'),
    startLiveView: () => ipcRenderer.invoke('camera:start-live-view'),
    stopLiveView: () => ipcRenderer.invoke('camera:stop-live-view'),
    takePicture: () => ipcRenderer.invoke('camera:take-picture'),
    onStatus: (callback: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => callback(payload);
      ipcRenderer.on('camera:status', listener);
      return () => {
        ipcRenderer.removeListener('camera:status', listener);
      };
    },
    onLiveView: (callback: (frame: unknown) => void) => {
      const listener = (_event: unknown, frame: unknown) => callback(frame);
      ipcRenderer.on('camera:liveView', listener);
      return () => {
        ipcRenderer.removeListener('camera:liveView', listener);
      };
    },
  },
});
