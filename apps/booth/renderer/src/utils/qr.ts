import QRCode from 'qrcode';

/** Generates a QR code as a PNG data URL (caches per text+size to avoid re-renders). */
const cache = new Map<string, Promise<string>>();

export const generateQrDataUrl = (text: string, size = 256): Promise<string> => {
  const key = `${size}:${text}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  cache.set(key, promise);
  return promise;
};