/**
 * Position of the photos inside the animated GIF (shared by every GIF frame):
 * zoom, pan and mirror, set by the guest on the GIF preview.
 *
 * Offsets are fractions of the GIF canvas (0.1 = 10% of its width/height) and
 * are clamped so a zoomed photo can never be dragged off the canvas edge. The
 * same numbers drive the CSS preview (gifAdjustTransform) and the encoder
 * (createResultGif), so what the guest sees is what the GIF contains.
 */
export interface GifAdjust {
  scale: number;
  offsetX: number;
  offsetY: number;
  flip: boolean;
}

export const GIF_MAX_SCALE = 3;

export const DEFAULT_GIF_ADJUST: GifAdjust = { scale: 1, offsetX: 0, offsetY: 0, flip: false };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export const clampGifAdjust = (adjust: Partial<GifAdjust> | null | undefined): GifAdjust => {
  const scale = clamp(finite(adjust?.scale, 1), 1, GIF_MAX_SCALE);
  const limit = (scale - 1) / 2;
  return {
    scale,
    offsetX: clamp(finite(adjust?.offsetX, 0), -limit, limit),
    offsetY: clamp(finite(adjust?.offsetY, 0), -limit, limit),
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
