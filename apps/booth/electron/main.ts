import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { GphotoCameraService } from './camera/GphotoCameraService';
import { MjpegLoopbackServer } from './camera/MjpegLoopbackServer';
import { PrinterService } from './printer/PrinterService';
import { PrintJob, PrintQueue } from './printer/PrintQueue';

const rendererPort = Number(process.env.VITE_PORT || 5173);

// Single-instance kiosk: a second launch focuses the running booth instead of
// spawning another process (which would otherwise show a second window).
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

let mainWindow: BrowserWindow | null = null;
let adminWindow: BrowserWindow | null = null;
let cameraService: GphotoCameraService | null = null;
let printQueue: PrintQueue | null = null;

const mjpegServer = new MjpegLoopbackServer();
const printerService = new PrinterService();

/** Sends an IPC event to every open window (booth + dev admin window). */
const broadcast = (channel: string, payload: unknown) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
};

// In-flight framed-image requests from the print queue to the renderer.
const pendingImages = new Map<
  string,
  { resolve: (dataUrl: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

const requestImage = (job: PrintJob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    if (!mainWindow) {
      reject(new Error('No booth window is available to resolve the framed image.'));
      return;
    }
    const timer = setTimeout(() => {
      pendingImages.delete(job.id);
      reject(new Error('Timed out waiting for the framed image.'));
    }, 60000);
    pendingImages.set(job.id, { resolve, reject, timer });
    mainWindow.webContents.send('printer:resolve-image', {
      jobId: job.id,
      token: job.token,
      fileName: job.fileName,
    });
  });

const forwardCameraEvents = () => {
  if (!cameraService) {
    return;
  }
  cameraService.onStatus((payload) => mainWindow?.webContents.send('camera:status', payload));
  cameraService.onLiveView((frame) => {
    mainWindow?.webContents.send('camera:liveview', frame);
    if (mjpegServer.isRunning()) {
      mjpegServer.push(Buffer.from(frame.frame));
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
  // Never create a second window (e.g. a stray `activate` on Windows, or a
  // duplicate launch) — the booth is a single-window kiosk.
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: process.env.BOOTH_WINDOWED !== '1',
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
    // A fullscreen window cannot dock DevTools, so `openDevTools()` makes
    // Electron spawn a second, detached DevTools window. Only open it when
    // explicitly requested (BOOTH_DEVTOOLS=1).
    if (process.env.BOOTH_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Dev-only convenience: opens the admin dashboard in its own window so the
 * booth flow and the admin console can be seen side by side. The booth window
 * remains the one that owns uploads/printing; this window is just the UI.
 */
function createAdminWindow() {
  if (adminWindow) {
    adminWindow.focus();
    return;
  }

  adminWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Self Photo Booth — Admin',
    autoHideMenuBar: true,
  });

  adminWindow.loadURL(`http://localhost:${rendererPort}/#/admin`);
  adminWindow.on('closed', () => {
    adminWindow = null;
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
  ipcMain.handle('camera:prepareCapture', () => cameraService?.prepareCapture() ?? null);
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

  ipcMain.handle('printer:list', () => printerService.listPrinters());
  ipcMain.handle('printer:status', (_event, queueName: string) => printerService.printerStatus(queueName ?? ''));
  ipcMain.handle('printer:print', (_event, payload: import('./printer/PrinterService').PrinterPrintPayload) =>
    printerService.print(payload),
  );

  printQueue = new PrintQueue({
    service: printerService,
    storageDir: path.join(app.getPath('userData'), 'print-queue'),
    emit: (snapshot) => broadcast('printer:job-update', snapshot),
    requestImage,
  });
  void printQueue.init();

  ipcMain.handle('printer:queue', () => printQueue?.getSnapshot() ?? { jobs: [], running: false, activeJobId: null });
  ipcMain.handle(
    'printer:enqueue',
    (_event, payload: import('./printer/PrintQueue').PrintEnqueueInput) =>
      printQueue?.enqueue(payload) ?? Promise.resolve(null),
  );
  ipcMain.handle('printer:start-batch', (_event, ids: string[]) => printQueue?.startBatch(ids ?? []));
  ipcMain.handle('printer:retry', (_event, id: string) => printQueue?.retry(id) ?? Promise.resolve(null));
  ipcMain.handle('printer:cancel', (_event, id: string) => printQueue?.cancel(id));
  ipcMain.handle('printer:remove', (_event, id: string) => printQueue?.remove(id));
  ipcMain.handle(
    'printer:image-ready',
    (_event, payload: { jobId: string; dataUrl?: string; error?: string }) => {
      const entry = pendingImages.get(payload.jobId);
      if (!entry) {
        return false;
      }
      clearTimeout(entry.timer);
      pendingImages.delete(payload.jobId);
      if (payload.error || !payload.dataUrl) {
        entry.reject(new Error(payload.error ?? 'No framed image data was provided.'));
      } else {
        entry.resolve(payload.dataUrl);
      }
      return true;
    },
  );

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
  if (process.env.NODE_ENV === 'development') {
    createAdminWindow();
  }
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
  printQueue?.dispose();
  if (cameraService) {
    cameraService.dispose();
    cameraService = null;
  }
});
