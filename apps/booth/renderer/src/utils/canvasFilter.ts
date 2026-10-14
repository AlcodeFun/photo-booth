/**
 * CSS-filter support for canvas drawing on every browser.
 *
 * `ctx.filter` (used to bake the photo filter into the print) is ignored by
 * some browsers, notably Safari on iPhone / iPad, which silently draws the
 * photo unfiltered. Where it is missing, the filter is applied in JavaScript:
 * every function the presets use (sepia, saturate, hue-rotate, grayscale,
 * brightness, contrast) is a per-pixel color operation defined by the Filter
 * Effects spec, applied in order with clamping, like the browser does.
 */

type Rgb = [number, number, number];
type Op = (c: Rgb) => Rgb;

let nativeSupport: boolean | null = null;

/** True when this browser honors `ctx.filter` (checked once, by drawing). */
export const supportsCanvasFilter = (): boolean => {
  if (nativeSupport !== null) return nativeSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || typeof ctx.filter !== 'string') return (nativeSupport = false);
    ctx.filter = 'grayscale(1)';
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    nativeSupport = Math.abs(r - g) < 8 && Math.abs(g - b) < 8;
  } catch {
    nativeSupport = false;
  }
  return nativeSupport;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Applies a 3x3 color matrix (row-major). */
const matrixOp =
  (m: number[]): Op =>
  ([r, g, b]) => [
    clamp01(m[0] * r + m[1] * g + m[2] * b),
    clamp01(m[3] * r + m[4] * g + m[5] * b),
    clamp01(m[6] * r + m[7] * g + m[8] * b),
  ];

const parseAmount = (raw: string, fallback: number) => {
  const v = raw.trim();
  if (!v) return fallback;
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
};

const parseAngle = (raw: string) => {
  const v = raw.trim();
  const n = parseFloat(v);
  if (v.endsWith('turn')) return n * 360;
  if (v.endsWith('rad')) return (n * 180) / Math.PI;
  return n || 0;
};

/** Spec matrices: https://www.w3.org/TR/filter-effects-1/ */
const buildOp = (name: string, arg: string): Op | null => {
  switch (name) {
    case 'grayscale': {
      const a = 1 - Math.min(1, parseAmount(arg, 1));
      return matrixOp([
        0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
      ]);
    }
    case 'sepia': {
      const a = 1 - Math.min(1, parseAmount(arg, 1));
      return matrixOp([
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
      ]);
    }
    case 'saturate': {
      const s = parseAmount(arg, 1);
      return matrixOp([
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ]);
    }
    case 'hue-rotate': {
      const rad = (parseAngle(arg) * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return matrixOp([
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ]);
    }
    case 'brightness': {
      const k = parseAmount(arg, 1);
      return ([r, g, b]) => [clamp01(r * k), clamp01(g * k), clamp01(b * k)];
    }
    case 'contrast': {
      const k = parseAmount(arg, 1);
      const i = 0.5 - 0.5 * k;
      return ([r, g, b]) => [clamp01(r * k + i), clamp01(g * k + i), clamp01(b * k + i)];
    }
    default:
      return null;
  }
};

const parseFilter = (filter: string): Op[] => {
  const ops: Op[] = [];
  const re = /([a-z-]+)\(([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filter))) {
    const op = buildOp(m[1].toLowerCase(), m[2]);
    if (op) ops.push(op);
  }
  return ops;
};

/** Applies a CSS filter string to an image, returning a new canvas. */
export const applyCssFilterToImage = (
  source: CanvasImageSource & { width: number; height: number },
  filter: string,
  maxSide = 2400,
): HTMLCanvasElement => {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const ops = parseFilter(filter);
  if (ops.length === 0) return canvas;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  // Results only depend on the color: memoize per quantized RGB (photos repeat colors a lot).
  const cache = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let out = cache.get(key);
    if (out === undefined) {
      let c: Rgb = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
      for (const op of ops) c = op(c);
      out = (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
      if (cache.size < 1 << 20) cache.set(key, out);
    }
    d[i] = (out >> 16) & 255;
    d[i + 1] = (out >> 8) & 255;
    d[i + 2] = out & 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

/**
 * What to draw for `source` with `filter`: the source itself plus the native
 * ctx.filter where supported, else a pre-filtered copy drawn with no filter.
 */
export const filteredSource = <T extends CanvasImageSource & { width: number; height: number }>(
  source: T,
  filter: string,
): { image: T | HTMLCanvasElement; ctxFilter: string } => {
  if (!filter || filter === 'none' || supportsCanvasFilter()) return { image: source, ctxFilter: filter || 'none' };
  return { image: applyCssFilterToImage(source, filter), ctxFilter: 'none' };
};
