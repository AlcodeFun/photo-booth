/**
 * Position of the photos inside the animated GIF (shared by every GIF frame):
 * zoom, pan and mirror, set by the guest on the GIF preview.
 *
 * Offsets are fractions of the GIF canvas (0.1 = 10% of its width/height).
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
  /** GIF box width / height. */
  boxAspect: number;
  /** `cover` with a GIF frame overlay, `contain` for a plain GIF. */
  mode: 'cover' | 'contain';
}

export const GIF_MAX_SCALE = 3;

/**
 * Extra room (fraction of the box) beyond the photo's own overflow, so a photo
 * that fits the box exactly can still be nudged without zooming first.
 */
const FREE_PAN = 0.2;

export const DEFAULT_GIF_ADJUST: GifAdjust = { scale: 1, offsetX: 0, offsetY: 0, flip: false };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/**
 * Pan limits for a scale: half the difference between the drawn photo and the
 * box (its overflow when bigger, its slack when smaller) plus FREE_PAN.
 * Without geometry the limit is generous (the encoder trusts saved values).
 */
const panLimits = (scale: number, geometry?: GifGeometry | null): { x: number; y: number } => {
  if (!geometry || !(geometry.imageAspect > 0) || !(geometry.boxAspect > 0)) return { x: scale, y: scale };
  const pick = geometry.mode === 'cover' ? Math.max : Math.min;
  const relWidth = pick(1, geometry.imageAspect / geometry.boxAspect);
  const relHeight = pick(1, geometry.boxAspect / geometry.imageAspect);
  return {
    x: Math.abs(scale * relWidth - 1) / 2 + FREE_PAN,
    y: Math.abs(scale * relHeight - 1) / 2 + FREE_PAN,
  };
};

export const clampGifAdjust = (adjust: Partial<GifAdjust> | null | undefined, geometry?: GifGeometry | null): GifAdjust => {
  const scale = clamp(finite(adjust?.scale, 1), 1, GIF_MAX_SCALE);
  const limit = panLimits(scale, geometry);
  return {
    scale,
    offsetX: clamp(finite(adjust?.offsetX, 0), -limit.x, limit.x),
    offsetY: clamp(finite(adjust?.offsetY, 0), -limit.y, limit.y),
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
