import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { GphotoCameraService } from './camera/GphotoCameraService';
import { MjpegLoopbackServer } from './camera/MjpegLoopbackServer';

const rendererPort = Number(process.env.VITE_PORT || 5173);

let mainWindow: BrowserWindow | null = null;
let cameraService: GphotoCameraService | null = null;

const mjpegServer = new MjpegLoopbackServer();

const frameDataUrlToBuffer = (dataUrl: string) =>
  Buffer.from(dataUrl.replace(/^data:[^,]+,/, ''), 'base64');

const forwardCameraEvents = () => {
  if (!cameraService) {
    return;
  }
  cameraService.onStatus((payload) => mainWindow?.webContents.send('camera:status', payload));
  cameraService.onLiveView((frame) => {
    mainWindow?.webContents.send('camera:liveview', frame);
    if (mjpegServer.isRunning()) {
      mjpegServer.push(frameDataUrlToBuffer(frame.dataUrl));
    }
  });
};

async function saveDownloadFile(fileName: string, dataUrl: string) {
  if (!mainWindow) {
    return null;
  }

  const fs = await import('fs/promises');
  const downloadDir = app.getPath('downloads');
  const safeName = path.basename(fileName);
  const parsed = path.parse(safeName);
  let filePath = path.join(downloadDir, safeName);
  for (let counter = 1; ; counter += 1) {
    try {
      await fs.access(filePath);
    } catch {
      break;
    }
    filePath = path.join(downloadDir, `${parsed.name}-${counter}${parsed.ext}`);
  }

  const base64 = dataUrl.replace(/^data:[^,]+,/, '');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

async function printWindowToPdf() {
  if (!mainWindow) {
    return null;
  }

  const pdf = await mainWindow.webContents.printToPDF({
    margins: { marginType: 'none' },
    printBackground: true,
    landscape: false,
    pageSize: 'A4',
  });

  const fs = await import('fs/promises');
  const downloadDir = app.getPath('downloads');
  const fileName = `photo-booth-${Date.now()}.pdf`;
  const filePath = path.join(downloadDir, fileName);

  await fs.writeFile(filePath, pdf);
  return filePath;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !isDev && process.env.BOOTH_WINDOWED !== '1',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Self Photo Booth',
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('print-to-pdf', async () => printWindowToPdf());

  cameraService = new GphotoCameraService();
  forwardCameraEvents();
  ipcMain.handle('camera:available', () => cameraService?.isAvailable() ?? false);
  ipcMain.handle('camera:getStatus', () => cameraService?.getStatus() ?? null);
  ipcMain.handle('camera:initialize', () => cameraService?.initialize() ?? null);
  ipcMain.handle('camera:startLiveView', () => cameraService?.startLiveView() ?? null);
  ipcMain.handle('camera:stopLiveView', () => cameraService?.stopLiveView() ?? null);
  ipcMain.handle('camera:takePicture', () => cameraService?.takePicture() ?? null);

  ipcMain.handle('camera:mjpeg:get', () => ({
    running: mjpegServer.isRunning(),
    port: mjpegServer.port(),
  }));
  ipcMain.handle('camera:mjpeg:start', () => {
    try {
      mjpegServer.start();
      return { running: mjpegServer.isRunning(), port: mjpegServer.port() };
    } catch (error) {
      return { running: false, port: 0, error: String(error) };
    }
  });
  ipcMain.handle('camera:mjpeg:stop', () => {
    mjpegServer.stop();
    return { running: false, port: 0 };
  });

  ipcMain.handle('save-file', async (_event, payload: { fileName: string; dataUrl: string }) =>
    saveDownloadFile(payload.fileName, payload.dataUrl),
  );

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow) {
      return false;
    }
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle('window:is-fullscreen', () => mainWindow?.isFullScreen() ?? false);

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  mjpegServer.stop();
  if (cameraService) {
    cameraService.dispose();
    cameraService = null;
  }
});
