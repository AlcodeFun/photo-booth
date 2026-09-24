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
    prepareCapture: () => ipcRenderer.invoke('camera:prepareCapture'),
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
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    status: (queueName: string) => ipcRenderer.invoke('printer:status', queueName),
    print: (payload: unknown) => ipcRenderer.invoke('printer:print', payload),
    queue: () => ipcRenderer.invoke('printer:queue'),
    enqueue: (payload: unknown) => ipcRenderer.invoke('printer:enqueue', payload),
    startBatch: (ids: string[]) => ipcRenderer.invoke('printer:start-batch', ids),
    retry: (id: string) => ipcRenderer.invoke('printer:retry', id),
    cancel: (id: string) => ipcRenderer.invoke('printer:cancel', id),
    remove: (id: string) => ipcRenderer.invoke('printer:remove', id),
    provideImage: (payload: { jobId: string; dataUrl?: string; error?: string }) =>
      ipcRenderer.invoke('printer:image-ready', payload),
    onJobUpdate: (callback: (snapshot: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot);
      ipcRenderer.on('printer:job-update', listener);
      return () => ipcRenderer.removeListener('printer:job-update', listener);
    },
    onResolveImage: (callback: (request: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, request: unknown) => callback(request);
      ipcRenderer.on('printer:resolve-image', listener);
      return () => ipcRenderer.removeListener('printer:resolve-image', listener);
    },
  },
});