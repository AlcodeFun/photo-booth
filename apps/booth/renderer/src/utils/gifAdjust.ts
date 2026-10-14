/**
 * Position of the photos inside the animated GIF (shared by every GIF frame):
 * zoom, pan and mirror, set by the guest on the GIF preview.
 *
 * The photo is drawn over the WHOLE GIF canvas (cover with a GIF frame,
 * contain without) and the frame overlay goes on top; it is never clipped.
 * Offsets are fractions of the canvas (0.1 = 10% of its width / height).
 * Moving is limited so the photo always covers the frame's transparent
 * window, so no empty (black) area can show through it.
 * The same numbers drive the CSS preview (gifAdjustTransform) and the encoder
 * (createResultGif), so what the guest sees is what the GIF contains.
 */
export interface GifAdjust {
  scale: number;
  offsetX: number;
  offsetY: number;
  flip: boolean;
}

/** How the photo sits in the GIF box before the guest's adjustment. */
export interface GifGeometry {
  /** Photo width / height. */
  imageAspect: number;
  /** GIF canvas width / height. */
  boxAspect: number;
  /** `cover` with a GIF frame overlay, `contain` for a plain GIF. */
  mode: 'cover' | 'contain';
  /** The frame's transparent window, as fractions of the canvas (default: whole canvas). */
  window?: { x: number; y: number; width: number; height: number };
}

export const GIF_MAX_SCALE = 3;

export const DEFAULT_GIF_ADJUST: GifAdjust = { scale: 1, offsetX: 0, offsetY: 0, flip: false };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/**
 * Allowed offset range on one axis: the photo (size `rel` of the canvas,
 * centred at 0.5 + offset) must cover the window [start, start + size].
 * A photo smaller than the window (plain GIF, contain) stays centred on it.
 */
const axisRange = (rel: number, start: number, size: number): [number, number] => {
  const lo = start + size - 0.5 - rel / 2;
  const hi = start - 0.5 + rel / 2;
  return lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
};

/** Pan limits for a scale. Without geometry they are generous (the encoder trusts saved values). */
const panLimits = (scale: number, geometry?: GifGeometry | null): { x: [number, number]; y: [number, number] } => {
  if (!geometry || !(geometry.imageAspect > 0) || !(geometry.boxAspect > 0)) {
    return { x: [-scale, scale], y: [-scale, scale] };
  }
  const pick = geometry.mode === 'cover' ? Math.max : Math.min;
  const relWidth = pick(1, geometry.imageAspect / geometry.boxAspect) * scale;
  const relHeight = pick(1, geometry.boxAspect / geometry.imageAspect) * scale;
  const w = geometry.window ?? { x: 0, y: 0, width: 1, height: 1 };
  return { x: axisRange(relWidth, w.x, w.width), y: axisRange(relHeight, w.y, w.height) };
};

export const clampGifAdjust = (adjust: Partial<GifAdjust> | null | undefined, geometry?: GifGeometry | null): GifAdjust => {
  const scale = clamp(finite(adjust?.scale, 1), 1, GIF_MAX_SCALE);
  const limit = panLimits(scale, geometry);
  return {
    scale,
    offsetX: clamp(finite(adjust?.offsetX, 0), limit.x[0], limit.x[1]),
    offsetY: clamp(finite(adjust?.offsetY, 0), limit.y[0], limit.y[1]),
    flip: Boolean(adjust?.flip),
  };
};

export const isDefaultGifAdjust = (adjust: GifAdjust | null | undefined): boolean =>
  !adjust || (adjust.scale === 1 && adjust.offsetX === 0 && adjust.offsetY === 0 && !adjust.flip);

/** CSS transform for a photo element that fills the GIF box. */
export const gifAdjustTransform = (adjust: GifAdjust | null | undefined): string | undefined => {
  if (isDefaultGifAdjust(adjust)) return undefined;
  const a = clampGifAdjust(adjust);
  return `translate(${a.offsetX * 100}%, ${a.offsetY * 100}%) scale(${a.scale}) scaleX(${a.flip ? -1 : 1})`;
};
