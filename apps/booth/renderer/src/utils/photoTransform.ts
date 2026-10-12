/**
 * Rotate / mirror a captured photo by re-encoding its pixels. Baking the
 * change into the image (instead of a display transform) means every output
 * (screen, print, GIF, live photo, gallery upload) gets it for free.
 */
export type PhotoTransform = 'rotate' | 'flip';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load photo'));
    image.src = src;
  });

/** 'rotate' turns 90° clockwise; 'flip' mirrors left-right. Returns a JPEG data URL. */
export const transformPhotoUrl = async (src: string, op: PhotoTransform, quality = 0.92): Promise<string> => {
  const image = await loadImage(src);
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = op === 'rotate' ? h : w;
  canvas.height = op === 'rotate' ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  if (op === 'rotate') {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
};

/** True when a stored rotate / mirror actually changes the photo. */
export const isIdentityTransform = (t?: { rotate: number; flip: boolean } | null) =>
  !t || (((t.rotate % 360) + 360) % 360 === 0 && !t.flip);

/**
 * Applies a stored rotate / mirror to the original photo: mirror first, then
 * quarter turns clockwise. Used for the organize preview and the final render,
 * so both always agree.
 */
export const applyPhotoTransform = async (
  src: string,
  t: { rotate: number; flip: boolean },
  quality = 0.92,
): Promise<string> => {
  if (isIdentityTransform(t)) return src;
  let url = t.flip ? await transformPhotoUrl(src, 'flip', quality) : src;
  const turns = (((Math.round(t.rotate / 90) % 4) + 4) % 4);
  for (let i = 0; i < turns; i += 1) url = await transformPhotoUrl(url, 'rotate', quality);
  return url;
};
