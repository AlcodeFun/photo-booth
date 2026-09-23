import { FrameConfig, FramePhotoPlacement, FrameQRPlacement, FrameTemplateConfig, PhotoSlotState } from '@photo-booth/types';
import { resolveFrameTemplate } from './frameConfig';
import { getSelectedPhotoUrls, getSelectedLiveFrames } from './photoSlots';
import { getCanvasFilter } from './filters';
import { downloadBlob, downloadStamp } from './download';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (src: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(src);
  if (cached) {
    return cached;
  }
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Remote frame assets (e.g. Supabase storage) must be fetched as CORS-clean
    // images, otherwise drawing them taints the canvas and toBlob/toDataURL
    // throw — which would silently abort the whole framed-photo upload.
    if (/^https?:/i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
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

const drawQrSlotImage = async (
  ctx: CanvasRenderingContext2D,
  slot: FrameQRPlacement,
  qrCodeUrl: string | undefined,
) => {
  if (!qrCodeUrl) {
    return;
  }
  try {
    const image = await loadImage(qrCodeUrl);
    // QR placeholders are square; fit the QR into the slot centered.
    const size = Math.min(slot.width, slot.height);
    const centerX = slot.x + slot.width / 2;
    const centerY = slot.y + slot.height / 2;
    const drawX = centerX - size / 2;
    const drawY = centerY - size / 2;
    const radius = slot.borderRadius ?? 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    if (slot.rotation) {
      ctx.rotate((slot.rotation * Math.PI) / 180);
    }
    ctx.translate(-centerX, -centerY);
    roundedRect(ctx, drawX, drawY, size, size, radius);
    ctx.clip();
    ctx.drawImage(image, drawX, drawY, size, size);
    ctx.restore();
  } catch {
    // QR image is optional; skip the slot if it can't be drawn.
  }
};

export interface RenderOptions {
  scale?: number;
  includeFrame?: boolean;
  /** Real QR code (PNG/JPEG data URL) to compose into the frame's QR placeholders. */
  qrCodeUrl?: string;
  /**
   * Template override. When given, the composition uses this resolved template
   * instead of re-resolving from `frame` — lets a background print listener
   * rebuild a session's framed sheet from a persisted arrangement whose slot
   * count may differ from the live in-memory session.
   */
  template?: FrameTemplateConfig;
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
  const { scale = 1, includeFrame = true, qrCodeUrl, template: templateOverride } = options;
  const photos = getSelectedPhotoUrls(photoSlots);
  const template = templateOverride ?? resolveFrameTemplate(frame, photoSlots.length);
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
    await renderTemplated(
      ctx,
      template.photoSlots,
      photos,
      template,
      canvasFilter,
      template.width,
      template.height,
      includeFrame,
      qrCodeUrl,
    );
    ctx.restore();
  } else {
    await renderTemplated(
      ctx,
      template.photoSlots,
      photos,
      template,
      canvasFilter,
      template.width,
      template.height,
      includeFrame,
      qrCodeUrl,
    );
  }

  return canvas;
}

type DrawOp = { zIndex: number; draw: () => Promise<void> };

async function renderTemplated(
  ctx: CanvasRenderingContext2D,
  slots: FramePhotoPlacement[],
  photos: Array<string | undefined>,
  template: {
    width: number;
    height: number;
    backgroundColor?: string;
    assetUrl?: string;
    frameLayerZIndex?: number;
    qrSlots?: FrameQRPlacement[];
  },
  canvasFilter: string,
  width: number,
  height: number,
  includeFrame: boolean,
  qrCodeUrl?: string,
) {
  ctx.fillStyle = template.backgroundColor ?? '#111111';
  ctx.fillRect(0, 0, width, height);

  // Paint every layer in ascending z-index so QR placeholders, photos, and the
  // frame art stack exactly like the on-screen FrameCanvas preview.
  const ops: DrawOp[] = [];

  for (const slot of slots) {
    const photoUrl = photos[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1];
    ops.push({
      zIndex: slot.zIndex ?? 10,
      draw: () => drawSlotImage(ctx, slot, photoUrl, canvasFilter),
    });
  }

  for (const qrSlot of template.qrSlots ?? []) {
    ops.push({
      zIndex: qrSlot.zIndex ?? 30,
      draw: () => drawQrSlotImage(ctx, qrSlot, qrCodeUrl),
    });
  }

  if (template.assetUrl && includeFrame) {
    ops.push({
      zIndex: template.frameLayerZIndex ?? 30,
      draw: async () => {
        try {
          const asset = await loadImage(template.assetUrl!);
          ctx.drawImage(asset, 0, 0, width, height);
        } catch {
          // Frame asset is optional; still export the photo composition.
        }
      },
    });
  }

  ops.sort((a, b) => a.zIndex - b.zIndex);
  for (const op of ops) {
    await op.draw();
  }
}

/**
 * Encodes a canvas as a compact high-quality JPEG. JPEG 0.92 is visually
 * indistinguishable from lossless PNG for photographic strips, but is a small
 * fraction of the size — uploads and downloads complete much faster.
 */
export const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob | null> =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * Renders a single captured photo with the selected filter applied at its
 * original resolution (no crop) and encodes it as a compact JPEG. Used when
 * uploading the raw photos to the gallery so every photo matches the look of
 * the framed result and the GIF.
 */
export const applyPhotoFilter = (
  dataUrl: string,
  filterId: string | null | undefined,
): Promise<Blob | null> =>
  loadImage(dataUrl).then((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.filter = getCanvasFilter(filterId);
    ctx.drawImage(image, 0, 0);
    ctx.filter = 'none';
    return canvasToJpegBlob(canvas);
  });

const downloadCanvasAsJpeg = async (canvas: HTMLCanvasElement, fileName: string) => {
  if (window.electronAPI?.saveFile) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await window.electronAPI.saveFile(fileName, dataUrl);
    return;
  }
  const blob = await canvasToJpegBlob(canvas);
  if (blob) {
    await downloadBlob(blob, fileName);
  }
};

/** Downloads the composed framed photo (with frame + filter applied) as a JPEG. */
export async function downloadFramedPhoto(
  frame: FrameConfig,
  photoSlots: PhotoSlotState[],
  filterId: string | null | undefined,
  qrCodeUrl?: string,
): Promise<void> {
  const canvas = await renderComposition(frame, photoSlots, filterId, { includeFrame: true, qrCodeUrl });
  await downloadCanvasAsJpeg(canvas, `photo-booth-${downloadStamp()}-result.jpg`);
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

/**
 * Creates the framed "live photo" result: a looping GIF of the full framed
 * sheet where each photo slot plays its own recorded live view clip (a few
 * seconds of live view captured right before the shot). The frame art stays
 * static and reads as one composed sheet — only the photos move, each inside
 * its own slot, exactly like the on-screen preview.
 *
 * Slots without a recorded clip fall back to their still photo (kept for the
 * whole loop), so this stays correct for older sessions without live frames.
 */
export async function createResultLiveFramed(
  frame: FrameConfig,
  photoSlots: PhotoSlotState[],
  filterId: string | null | undefined,
  opts: { width?: number; frameDelay?: number; frames?: number } = {},
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const { width = 400, frameDelay = 160, frames = 24 } = opts;
  if (photoSlots.length === 0) {
    throw new Error('No photos to encode.');
  }

  const photos = getSelectedPhotoUrls(photoSlots);
  const liveClips = getSelectedLiveFrames(photoSlots);
  const template = resolveFrameTemplate(frame, photoSlots.length);
  const canvasFilter = getCanvasFilter(filterId);
  const unitsToPixels = width / template.width;
  const height = Math.max(1, Math.round(template.height * unitsToPixels));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  // Load the frame art once so it can be overlaid on every GIF frame.
  let frameAsset: HTMLImageElement | null = null;
  if (template.assetUrl) {
    frameAsset = await loadImage(template.assetUrl).catch(() => null);
  }

  const longestClip = Math.max(1, ...liveClips.map((clip) => clip.length));
  const total = Math.min(Math.max(2, longestClip), Math.max(2, frames));
  const gif = GIFEncoder();

  for (let t = 0; t < total; t += 1) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = template.backgroundColor ?? '#111111';
    ctx.fillRect(0, 0, width, height);

    // Photos in template units → scaled into the GIF canvas.
    ctx.save();
    ctx.scale(unitsToPixels, unitsToPixels);
    for (let i = 0; i < template.photoSlots.length; i += 1) {
      const slot = template.photoSlots[i];
      const clip = liveClips[i] ?? [];
      const photoIndex = (slot.sourcePhotoSlot ?? slot.slotNumber) - 1;
      const url = clip.length
        ? clip[t % clip.length]
        : (photos[photoIndex] ?? photos[i]);
      if (url) {
        await drawSlotImage(ctx, slot, url, canvasFilter);
      }
    }
    ctx.restore();

    // Static frame art + QR placeholders stay locked above the moving photos.
    if (frameAsset) {
      ctx.drawImage(frameAsset, 0, 0, width, height);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const palette = quantize(imageData.data, 256);
    const index = applyPalette(imageData.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: frameDelay, repeat: 0 });
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
}
