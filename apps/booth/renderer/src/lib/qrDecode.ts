/**
 * QR reading for the voucher gate: camera frames and pictures from the device.
 *
 * Prefers the browser's native BarcodeDetector (Android Chrome, recent Safari,
 * ChromeOS / macOS Chrome): it copes far better with phone screens, glare,
 * small or tilted codes. Everywhere else (e.g. Electron on Windows / Linux)
 * jsQR runs on a few crops and scales so a code anywhere in view is found.
 */

interface NativeDetector {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

type JsQr = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'attemptBoth' | 'dontInvert' | 'onlyInvert' | 'invertFirst' }) => { data?: string } | null;

/** Largest canvas side used for decoding: big photos break mobile canvases. */
const MAX_SIDE = 4096;

let nativeDetector: Promise<NativeDetector | null> | null = null;
const getNativeDetector = (): Promise<NativeDetector | null> => {
  nativeDetector ??= (async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: { new (opts: { formats: string[] }): NativeDetector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
      return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : null;
    } catch {
      return null;
    }
  })();
  return nativeDetector;
};

let jsQrModule: Promise<JsQr> | null = null;
const getJsQr = () => (jsQrModule ??= import('jsqr').then((m) => m.default as unknown as JsQr));

const detectNative = async (source: ImageBitmapSource): Promise<string | null> => {
  const detector = await getNativeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    return codes.find((code) => code.rawValue)?.rawValue ?? null;
  } catch {
    return null;
  }
};

/** jsQR on a region of `source`, drawn at `scale` into the shared canvas. */
const decodeRegion = (
  jsQR: JsQr,
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  region: { x: number; y: number; width: number; height: number },
  targetSide: number,
): string | null => {
  const scale = Math.min(1, targetSide / Math.max(region.width, region.height), MAX_SIDE / Math.max(region.width, region.height));
  const width = Math.max(1, Math.round(region.width * scale));
  const height = Math.max(1, Math.round(region.height * scale));
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, width, height);
  const found = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'attemptBoth' });
  return found?.data || null;
};

/**
 * Returns a scanner for a live feed: a <video> (webcam) or an <img> showing
 * the latest Canon live-view frame. Each call checks one frame; jsQR
 * alternates between the centre square (where guests aim) and the whole frame.
 */
export const createVideoQrScanner = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let turn = 0;
  return async (source: HTMLVideoElement | HTMLImageElement): Promise<string | null> => {
    const isVideo = source instanceof HTMLVideoElement;
    const w = isVideo ? source.videoWidth : source.naturalWidth;
    const h = isVideo ? source.videoHeight : source.naturalHeight;
    if (isVideo ? source.readyState < 2 : !source.complete) return null;
    if (w === 0 || h === 0) return null;
    const native = await detectNative(source);
    if (native) return native;
    if ((await getNativeDetector()) || !ctx) return null;
    const jsQR = await getJsQr();
    turn += 1;
    if (turn % 2 === 1) {
      const side = Math.min(w, h);
      return decodeRegion(jsQR, ctx, source, { x: (w - side) / 2, y: (h - side) / 2, width: side, height: side }, 560);
    }
    return decodeRegion(jsQR, ctx, source, { x: 0, y: 0, width: w, height: h }, 960);
  };
};

/**
 * Reads a QR from a picture (e.g. the voucher card saved on the guest's phone,
 * a screenshot, or a photo of a printed card). Tries the native detector, then
 * jsQR at several sizes and on the centre of the picture.
 */
export const decodeQrFromFile = async (file: File): Promise<string | null> => {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable image'));
      img.src = url;
    });
    const native = await detectNative(image);
    if (native) return native;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const jsQR = await getJsQr();
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const whole = { x: 0, y: 0, width: w, height: h };
    for (const side of [1000, 1600, 600, 2400, MAX_SIDE]) {
      const found = decodeRegion(jsQR, ctx, image, whole, side);
      if (found) return found;
    }
    // A small QR in a big photo: zoom into the middle half.
    const centre = { x: w / 4, y: h / 4, width: w / 2, height: h / 2 };
    for (const side of [1000, 1800]) {
      const found = decodeRegion(jsQR, ctx, image, centre, side);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};
