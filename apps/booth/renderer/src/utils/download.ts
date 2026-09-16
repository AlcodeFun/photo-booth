const triggerAnchorDownload = (href: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Compact UTC timestamp used to give every download a unique filename
 *  (`20260910T153012`), so a stale file can't be mistaken for a fresh one. */
export const downloadStamp = (): string =>
  new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+$/, '');

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });

/** Saves a data URL to disk. On the booth this goes through the Electron main
 *  process (deterministic download), otherwise it falls back to an anchor. */
export const downloadDataUrl = async (dataUrl: string, fileName: string): Promise<string | null> => {
  if (window.electronAPI?.saveFile) {
    return window.electronAPI.saveFile(fileName, dataUrl);
  }
  triggerAnchorDownload(dataUrl, fileName);
  return null;
};

/** Saves a Blob to disk (Electron main process when available, else anchor). */
export const downloadBlob = async (blob: Blob, fileName: string): Promise<boolean> => {
  if (window.electronAPI?.saveFile) {
    const dataUrl = await blobToDataUrl(blob);
    await window.electronAPI.saveFile(fileName, dataUrl);
    return true;
  }
  const url = URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(url, fileName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return false;
};