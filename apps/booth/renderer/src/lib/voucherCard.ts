import { generateQrDataUrl } from '../utils/qr';
import { formatVoucherCode, type Voucher } from './vouchers';

/**
 * Renders a voucher as a shareable PNG card (Kelana logo, QR, code, validity)
 * for the admin to download and send to guests, e.g. over WhatsApp. The QR is
 * large with a full quiet zone so the booth can read it from a phone screen
 * or from the picture file itself.
 */

const W = 720;
const H = 1080;
const NAVY = '#344D66';
const ORANGE = '#F07842';
const CREAM = '#F5EBDD';
const INK = '#29251F';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

let logoPromise: Promise<HTMLImageElement | null> | null = null;
const kelanaLogo = () =>
  (logoPromise ??= loadImage(`${import.meta.env.BASE_URL}brand/kelana-logo.svg`).catch(() => null));

export const renderVoucherCard = async (voucher: Voucher, eventName?: string | null): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Cream card with a navy border and a perforated stub line
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 10;
  ctx.strokeStyle = NAVY;
  roundRect(ctx, 20, 20, W - 40, H - 40, 36);
  ctx.stroke();

  const logo = await kelanaLogo();
  if (logo) {
    const lh = 96;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh || lh * 2.7;
    ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh);
  }

  // Orange "voucher" band
  ctx.fillStyle = ORANGE;
  roundRect(ctx, W / 2 - 170, 196, 340, 54, 27);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VOUCHER PHOTOBOOTH', W / 2, 224);

  // QR on a white tile
  const qr = await loadImage(await generateQrDataUrl(voucher.code, 520));
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, W / 2 - 250, 286, 500, 500, 28);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, W / 2 - 240, 296, 480, 480);
  ctx.imageSmoothingEnabled = true;

  // Code
  ctx.fillStyle = NAVY;
  ctx.font = '800 64px ui-monospace, Consolas, "Courier New", monospace';
  ctx.fillText(formatVoucherCode(voucher.code), W / 2, 850);

  // Dashed tear line
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(52,77,102,0.45)';
  ctx.beginPath();
  ctx.moveTo(70, 910);
  ctx.lineTo(W - 70, 910);
  ctx.stroke();
  ctx.setLineDash([]);

  const details = [
    'Berlaku untuk 1 sesi foto',
    [eventName, voucher.expires_at ? `s/d ${formatDate(voucher.expires_at)}` : null].filter(Boolean).join(' · '),
  ].filter(Boolean);
  ctx.fillStyle = INK;
  ctx.font = '700 30px system-ui, "Segoe UI", sans-serif';
  ctx.fillText(details[0], W / 2, 955);
  if (details[1]) {
    ctx.font = '600 24px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(details[1], W / 2, 995);
  }
  ctx.fillStyle = 'rgba(41,37,31,0.6)';
  ctx.font = '500 21px system-ui, "Segoe UI", sans-serif';
  ctx.fillText('Scan QR ini di kamera booth untuk mulai', W / 2, details[1] ? 1032 : 1000);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png'),
  );
};

export const voucherCardFileName = (voucher: Voucher) => `voucher-${formatVoucherCode(voucher.code)}.png`;

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** One voucher -> its PNG card. */
export const downloadVoucherCard = async (voucher: Voucher, eventName?: string | null) =>
  downloadBlob(await renderVoucherCard(voucher, eventName), voucherCardFileName(voucher));

/** Many vouchers -> a ZIP of PNG cards (zip library loaded on demand). */
export const downloadVoucherCardsZip = async (
  vouchers: Voucher[],
  eventName: (voucher: Voucher) => string | null | undefined,
  zipName: string,
) => {
  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  for (const voucher of vouchers) {
    const blob = await renderVoucherCard(voucher, eventName(voucher));
    files[voucherCardFileName(voucher)] = new Uint8Array(await blob.arrayBuffer());
  }
  // PNGs are already compressed: store them as-is.
  const zipped = zipSync(files, { level: 0 });
  downloadBlob(new Blob([zipped], { type: 'application/zip' }), zipName);
};
