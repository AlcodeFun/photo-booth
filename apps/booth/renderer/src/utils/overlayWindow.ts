/**
 * The transparent "window" of a GIF frame overlay: the hole in the artwork the
 * photo shows through. The GIF photo is fitted to this rectangle (not the whole
 * canvas), so the overlay's border never crops it and moving it never exposes
 * an empty background.
 *
 * Found from the PNG's alpha: transparent pixels enclosed by the artwork form
 * the window; transparency that touches the image edge (rounded corners, an
 * open border) is ignored. When nothing is enclosed, every transparent pixel
 * counts; a fully opaque PNG falls back to the whole canvas.
 *
 * Shared by the preview (GifPreview) and the encoder (createResultGif) so both
 * place the photo identically. Results are cached per URL.
 */
export interface OverlayWindow {
  /** Fractions of the overlay's width / height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_WINDOW: OverlayWindow = { x: 0, y: 0, width: 1, height: 1 };

const SAMPLE_WIDTH = 320;
const ALPHA_HOLE = 128;

const cache = new Map<string, Promise<OverlayWindow>>();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load overlay'));
    image.src = src;
  });

const measure = async (url: string): Promise<OverlayWindow> => {
  const image = await loadImage(url);
  const width = Math.min(SAMPLE_WIDTH, image.naturalWidth || SAMPLE_WIDTH);
  const height = Math.max(1, Math.round((width / (image.naturalWidth || 1)) * (image.naturalHeight || 1)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return FULL_WINDOW;
  ctx.drawImage(image, 0, 0, width, height);
  const alpha = ctx.getImageData(0, 0, width, height).data;
  const clear = new Uint8Array(width * height);
  for (let i = 0; i < clear.length; i += 1) clear[i] = alpha[i * 4 + 3] < ALPHA_HOLE ? 1 : 0;

  // Flood the transparency reachable from the edge: that is "outside".
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (clear[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < width * (height - 1)) seed(i + width);
  }

  const bounds = (enclosedOnly: boolean) => {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let i = 0; i < clear.length; i += 1) {
      if (!clear[i] || (enclosedOnly && outside[i])) continue;
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY };
  };
  const box = bounds(true) ?? bounds(false);
  if (!box) return FULL_WINDOW;
  return {
    x: box.minX / width,
    y: box.minY / height,
    width: (box.maxX - box.minX + 1) / width,
    height: (box.maxY - box.minY + 1) / height,
  };
};

/** The overlay's photo window (whole canvas when there is no overlay or it fails to load). */
export const detectOverlayWindow = (url: string | null | undefined): Promise<OverlayWindow> => {
  if (!url) return Promise.resolve(FULL_WINDOW);
  let job = cache.get(url);
  if (!job) {
    job = measure(url).catch(() => FULL_WINDOW);
    cache.set(url, job);
  }
  return job;
};
