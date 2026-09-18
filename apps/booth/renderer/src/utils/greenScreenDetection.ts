export interface DetectedGreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedFrameAsset {
  assetUrl: string;
  width: number;
  height: number;
  regions: DetectedGreenRegion[];
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  return [h, max === 0 ? 0 : delta / max, max];
};

const hueDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const isDominantGreen = (r: number, g: number, b: number, a: number): boolean =>
  a > 128 && g >= 60 && g > r + 25 && g > b + 25;

const rectsOverlap = (a: BBox, b: BBox, gap: number): boolean =>
  a.maxX + gap >= b.minX &&
  a.minX - gap <= b.maxX &&
  a.maxY + gap >= b.minY &&
  a.minY - gap <= b.maxY;

/**
 * Detects green-screen (chroma-key) regions in an image and returns
 * bounding boxes suitable for photo-slot placement.
 */
export const detectGreenScreenRegions = async (
  imageUrl: string,
  options?: { minRegionRatio?: number; mergeGapRatio?: number; paddingRatio?: number },
): Promise<DetectedGreenRegion[]> => {
  const minRegionRatio = options?.minRegionRatio ?? 0.004;
  const mergeGapRatio = options?.mergeGapRatio ?? 0.008;
  const paddingRatio = options?.paddingRatio ?? 0.015;

  const image = await loadImage(imageUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (width === 0 || height === 0) {
    return [];
  }

  const scale = Math.min(1, 200 / Math.max(width, height));
  const sw = Math.max(2, Math.round(width * scale));
  const sh = Math.max(2, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return [];
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  const mask = new Uint8Array(sw * sh);
  for (let i = 0; i < mask.length; i++) {
    const pi = i * 4;
    mask[i] = isDominantGreen(data[pi], data[pi + 1], data[pi + 2], data[pi + 3]) ? 1 : 0;
  }

  const visited = new Uint8Array(sw * sh);
  const minArea = Math.max(4, Math.round(sw * sh * minRegionRatio));
  const components: BBox[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    const queue = [start];
    visited[start] = 1;
    let minX = start % sw;
    let maxX = minX;
    let minY = Math.floor(start / sw);
    let maxY = minY;
    let area = 0;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      const x = idx % sw;
      const y = (idx - x) / sw;
      area++;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) {
        visited[idx - 1] = 1;
        queue.push(idx - 1);
      }
      if (x < sw - 1 && mask[idx + 1] && !visited[idx + 1]) {
        visited[idx + 1] = 1;
        queue.push(idx + 1);
      }
      if (y > 0 && mask[idx - sw] && !visited[idx - sw]) {
        visited[idx - sw] = 1;
        queue.push(idx - sw);
      }
      if (y < sh - 1 && mask[idx + sw] && !visited[idx + sw]) {
        visited[idx + sw] = 1;
        queue.push(idx + sw);
      }
    }

    if (area >= minArea) {
      components.push({ minX, minY, maxX, maxY, area });
    }
  }

  if (components.length === 0) {
    return [];
  }

  const mergeGap = Math.max(1, Math.round(sw * mergeGapRatio));
  const merged: BBox[] = [];

  for (const comp of components.sort((a, b) => b.area - a.area)) {
    const existing = merged.find((m) => rectsOverlap(m, comp, mergeGap));

    if (existing) {
      existing.minX = Math.min(existing.minX, comp.minX);
      existing.minY = Math.min(existing.minY, comp.minY);
      existing.maxX = Math.max(existing.maxX, comp.maxX);
      existing.maxY = Math.max(existing.maxY, comp.maxY);
      existing.area += comp.area;
    } else {
      merged.push({ ...comp });
    }
  }

  const inv = 1 / scale;

  return merged
    .map((m) => {
      const rawX = m.minX * inv;
      const rawY = m.minY * inv;
      const rawW = (m.maxX - m.minX + 1) * inv;
      const rawH = (m.maxY - m.minY + 1) * inv;
      const padX = rawW * paddingRatio;
      const padY = rawH * paddingRatio;
      const x = Math.max(0, Math.round(rawX + padX));
      const y = Math.max(0, Math.round(rawY + padY));
      const w = Math.max(24, Math.round(rawW - padX * 2));
      const h = Math.max(24, Math.round(rawH - padY * 2));
      return { x, y, width: Math.min(w, width - x), height: Math.min(h, height - y) };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
};

/**
 * Chroma-keys the green screen out of an image and returns a transparent PNG
 * data URL. Pixel hue is measured against the image's dominant green so any
 * shade of screen-green is removed; fringed edges get soft alpha + despill.
 */
export const removeGreenScreen = async (
  imageUrl: string,
  options?: { hueTolerance?: number; saturationFloor?: number },
): Promise<string> => {
  const hueTolerance = options?.hueTolerance ?? 48;
  const saturationFloor = options?.saturationFloor ?? 0.18;

  const image = await loadImage(imageUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return imageUrl;
  }

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sumH = 0;
  let sumV = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (!isDominantGreen(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      continue;
    }
    const [h, , v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    sumH += h;
    sumV += v;
    count++;
  }

  if (count === 0) {
    return imageUrl;
  }

  const keyHue = sumH / count;
  const keyVal = sumV / count;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, v] = rgbToHsv(r, g, b);

    const hueDist = hueDistance(h, keyHue);
    const satFactor = clamp((s - saturationFloor) / 0.55, 0, 1);
    const valFactor = clamp(1 - Math.abs(v - keyVal) / 0.55, 0, 1);

    if (hueDist >= hueTolerance || satFactor <= 0) {
      continue;
    }

    const hueFactor = 1 - hueDist / hueTolerance;
    const keyness = clamp(hueFactor * satFactor * valFactor, 0, 1);

    if (keyness <= 0) {
      continue;
    }

    const alpha = Math.round(255 * (1 - keyness));

    if (alpha < 255) {
      const spill = clamp((g - Math.max(r, b)) / 255, 0, 1) * keyness;
      data[i] = r;
      data[i + 1] = Math.max(0, Math.round(g - spill * 255 * 0.9));
      data[i + 2] = b;
      data[i + 3] = alpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Convenience pipeline for frame files: loads the frame, detects the green
 * screen regions, chroma-keys the green to transparent, and returns a ready
 * to use asset (PNG data URL) plus the detected slot regions.
 */
export const processFrameAsset = async (
  imageUrl: string,
  options?: { minRegionRatio?: number; mergeGapRatio?: number; paddingRatio?: number },
): Promise<ProcessedFrameAsset> => {
  const image = await loadImage(imageUrl);
  const regions = await detectGreenScreenRegions(imageUrl, options);
  const assetUrl = await removeGreenScreen(imageUrl);

  return {
    assetUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
    regions,
  };
};