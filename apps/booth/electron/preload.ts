import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  saveFile: (fileName: string, dataUrl: string) => ipcRenderer.invoke('save-file', { fileName, dataUrl }),
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  },
  camera: {
    available: () => ipcRenderer.invoke('camera:available'),
    getStatus: () => ipcRenderer.invoke('camera:getStatus'),
    initialize: () => ipcRenderer.invoke('camera:initialize'),
    startLiveView: () => ipcRenderer.invoke('camera:startLiveView'),
    stopLiveView: () => ipcRenderer.invoke('camera:stopLiveView'),
    takePicture: () => ipcRenderer.invoke('camera:takePicture'),
    mjpeg: {
      get: () => ipcRenderer.invoke('camera:mjpeg:get'),
      start: () => ipcRenderer.invoke('camera:mjpeg:start'),
      stop: () => ipcRenderer.invoke('camera:mjpeg:stop'),
    },
    onStatus: (callback: (payload: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
      ipcRenderer.on('camera:status', listener);
      return () => ipcRenderer.removeListener('camera:status', listener);
    },
    onLiveView: (callback: (frame: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, frame: unknown) => callback(frame);
      ipcRenderer.on('camera:liveview', listener);
      return () => ipcRenderer.removeListener('camera:liveview', listener);
    },
  },
});