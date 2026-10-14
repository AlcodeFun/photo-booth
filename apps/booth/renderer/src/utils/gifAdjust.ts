/**
 * Position of the photos inside the animated GIF (shared by every GIF frame):
 * zoom, pan and mirror, set by the guest on the GIF preview.
 *
 * The GIF keeps the original photo ratio: its canvas is shaped so the GIF
 * frame's transparent window has exactly the photo's aspect, and at 1x the
 * whole photo fills that window (nothing cut off). Without a GIF frame the
 * window is the whole canvas, so the GIF is simply the photo. The frame
 * overlay is drawn on top, never clipping the photo.
 *
 * Offsets are fractions of the canvas, measured from the window centre.
 * Moving / zooming is limited so the photo always covers the window, so no
 * empty (black) area can show through. The same numbers drive the CSS preview
 * and the encoder (createResultGif).
 */
export interface GifAdjust {
  scale: number;
  offsetX: number;
  offsetY: number;
  flip: boolean;
}

/** The frame's transparent window, as fractions of the canvas. */
export interface GifWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How the photo sits in the GIF before the guest's adjustment. */
export interface GifGeometry {
  /** Photo width / height. */
  imageAspect: number;
  /** GIF canvas width / height. */
  boxAspect: number;
  /** The frame's window (default: the whole canvas). */
  window?: GifWindow;
}

export const GIF_MAX_SCALE = 3;

export const DEFAULT_GIF_ADJUST: GifAdjust = { scale: 1, offsetX: 0, offsetY: 0, flip: false };

export const FULL_GIF_WINDOW: GifWindow = { x: 0, y: 0, width: 1, height: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/**
 * Canvas width / height for a photo aspect and a frame window: the window
 * (window.width * W) x (window.height * H) gets exactly the photo's aspect.
 */
export const gifCanvasAspect = (photoAspect: number, window: GifWindow = FULL_GIF_WINDOW): number =>
  photoAspect > 0 && window.width > 0 && window.height > 0 ? (photoAspect * window.height) / window.width : photoAspect || 4 / 3;

/** Photo size at 1x, as fractions of the canvas: it covers the window. */
export const gifPhotoBase = (geometry: GifGeometry): { width: number; height: number } => {
  const w = geometry.window ?? FULL_GIF_WINDOW;
  const windowAspect = (geometry.boxAspect * w.width) / w.height;
  const ratio = geometry.imageAspect / windowAspect;
  return ratio >= 1 ? { width: w.width * ratio, height: w.height } : { width: w.width, height: w.height / ratio };
};

export const clampGifAdjust = (adjust: Partial<GifAdjust> | null | undefined, geometry?: GifGeometry | null): GifAdjust => {
  const scale = clamp(finite(adjust?.scale, 1), 1, GIF_MAX_SCALE);
  let limitX = scale;
  let limitY = scale;
  if (geometry && geometry.imageAspect > 0 && geometry.boxAspect > 0) {
    // The photo (centred on the window) may slide as far as it overhangs it.
    const w = geometry.window ?? FULL_GIF_WINDOW;
    const base = gifPhotoBase(geometry);
    limitX = Math.max(0, base.width * scale - w.width) / 2;
    limitY = Math.max(0, base.height * scale - w.height) / 2;
  }
  return {
    scale,
    offsetX: clamp(finite(adjust?.offsetX, 0), -limitX, limitX),
    offsetY: clamp(finite(adjust?.offsetY, 0), -limitY, limitY),
    flip: Boolean(adjust?.flip),
  };
};

export const isDefaultGifAdjust = (adjust: GifAdjust | null | undefined): boolean =>
  !adjust || (adjust.scale === 1 && adjust.offsetX === 0 && adjust.offsetY === 0 && !adjust.flip);
