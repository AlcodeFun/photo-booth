import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Self Photo Booth',
    fullscreen: !isDev,
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
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
