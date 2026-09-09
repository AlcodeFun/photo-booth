import { FrameConfig, FramePhotoPlacement, PhotoSlotState } from '@photo-booth/types';
import { resolveFrameTemplate } from './frameTemplateConfig';
import { getSelectedPhotoUrls } from './photoSlots';
import { getCanvasFilter } from './filters';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (src: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(src);
  if (cached) {
    return cached;
  }
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawSlotImage = async (
  ctx: CanvasRenderingContext2D,
  slot: FramePhotoPlacement,
  imageUrl: string | undefined,
  canvasFilter: string,
) => {
  if (!imageUrl) {
    return;
  }

  const image = await loadImage(imageUrl);
  const x = slot.x;
  const y = slot.y;
  const width = slot.width;
  const height = slot.height;
  const radius = slot.borderRadius ?? 0;

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();

  const imgRatio = image.width / image.height;
  const boxRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (slot.objectFit === 'contain') {
    if (imgRatio > boxRatio) {
      drawWidth = height * imgRatio;
      drawHeight = height;
      drawX = x + (width - drawWidth) / 2;
      drawY = y;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = x;
      drawY = y + (height - drawHeight) / 2;
    }
  } else if (imgRatio > boxRatio) {
    drawWidth = height * imgRatio;
    drawHeight = height;
    drawX = x - (drawWidth - width) / 2;
    drawY = y;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    drawX = x;
    drawY = y - (drawHeight - height) / 2;
  }

  ctx.filter = canvasFilter;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.filter = 'none';
  ctx.restore();
};

export interface RenderOptions {
  scale?: number;
  includeFrame?: boolean;
}

/**
 * Renders the photo strip (photo slots + optional frame overlay) onto a canvas,
 * applying the selected filter to the photos. Optionally scales the output.
 */
export async function renderComposition(
  frame: FrameConfig,
  photoSlots: PhotoSlotState[],
  filterId: string | null | undefined,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const { scale = 1, includeFrame = true } = options;
  const photos = getSelectedPhotoUrls(photoSlots);
  const template = resolveFrameTemplate(frame, photoSlots.length);
  const width = Math.round(template.width * scale);
  const height = Math.round(template.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  const canvasFilter = getCanvasFilter(filterId);

  if (scale !== 1) {
    ctx.save();
    ctx.scale(scale, scale);
    await renderTemplated(ctx, template.photoSlots, photos, template, canvasFilter, template.width, template.height, includeFrame);
    ctx.restore();
  } else {
    await renderTemplated(ctx, template.photoSlots, photos, template, canvasFilter, template.width, template.height, includeFrame);
  }

  return canvas;
}
async function renderTemplated(
  ctx: CanvasRenderingContext2D,
  slots: FramePhotoPlacement[],
  photos: Array<string | undefined>,
  template: { width: number; height: number; backgroundColor?: string; assetUrl?: string },
  canvasFilter: string,
  width: number,
  height: number,
  includeFrame: boolean,
) {
  ctx.fillStyle = template.backgroundColor ?? '#111111';
  ctx.fillRect(0, 0, width, height);

  for (const slot of slots) {
    const photoUrl = photos[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1];
    await drawSlotImage(ctx, slot, photoUrl, canvasFilter);
  }

  if (template.assetUrl && includeFrame) {
    try {
      const asset = await loadImage(template.assetUrl);
      ctx.drawImage(asset, 0, 0, width, height);
    } catch {
      // Frame asset is optional; still export the photo composition.
    }
  }
}

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadCanvasAsPng = async (canvas: HTMLCanvasElement, fileName: string) => {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) {
    triggerDownload(blob, fileName);
  }
};

/** Downloads the composed framed photo (with frame + filter applied) as a PNG. */
export async function downloadFramedPhoto(
  frame: FrameConfig,
  photoSlots: PhotoSlotState[],
  filterId: string | null | undefined,
): Promise<void> {
  const canvas = await renderComposition(frame, photoSlots, filterId, { includeFrame: true });
  await downloadCanvasAsPng(canvas, 'photo-booth-result.png');
}

const drawContain = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fitWidth: number,
  fitHeight: number,
  canvasFilter: string,
) => {
  const scale = Math.min(fitWidth / image.width, fitHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.save();
  ctx.filter = canvasFilter;
  ctx.drawImage(image, (fitWidth - drawWidth) / 2, (fitHeight - drawHeight) / 2, drawWidth, drawHeight);
  ctx.filter = 'none';
  ctx.restore();
};

/**
 * Creates an animated GIF of the selected photos shown one after another,
 * looping continuously. The canvas matches the camera's original aspect ratio
 * (from the first photo) and each photo is fit fully — no cropping.
 */
export async function createResultGif(
  photoSlots: PhotoSlotState[],
  filterId: string | null | undefined,
  opts: { width?: number; delay?: number } = {},
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const photos = getSelectedPhotoUrls(photoSlots).filter((url): url is string => Boolean(url));
  if (photos.length === 0) {
    throw new Error('No photos to encode.');
  }

  const { width = 480, delay = 700 } = opts;

  // The camera keeps a fixed aspect ratio across shots, so the canvas is sized
  // from the first photo and every photo is drawn to fit without cropping.
  const firstImage = await loadImage(photos[0]);
  const height = Math.max(1, Math.round((width / firstImage.width) * firstImage.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  const canvasFilter = getCanvasFilter(filterId);
  const gif = GIFEncoder();

  for (const url of photos) {
    try {
      const image = await loadImage(url);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, width, height);
      drawContain(ctx, image, width, height, canvasFilter);

      const imageData = ctx.getImageData(0, 0, width, height);
      const palette = quantize(imageData.data, 256);
      const index = applyPalette(imageData.data, palette);
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0 });
    } catch {
      // Skip photos that fail to load so a valid GIF is still produced.
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
}
