/**
 * QR code as a self-contained SVG data URL, so the gallery page can show a
 * scannable code (and let customers open the gallery on their own phone)
 * without loading any external CDN or canvas. Generated on the worker using
 * qrcode-generator, which has no Node/DOM dependencies.
 */
import qrcode from 'qrcode-generator';

export const qrSvgDataUrl = (text: string): string | null => {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
};