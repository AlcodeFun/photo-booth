import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';

const rendererPort = Number(process.env.VITE_PORT || 5173);

let mainWindow: BrowserWindow | null = null;

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
  // Camera bridge resources are torn down here when re-enabled.
});
