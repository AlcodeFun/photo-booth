/**
 * Builds the outputs of an arranged (flow 2) session: the framed print sheet,
 * the GIF and the framed live-photo GIF.
 *
 * Shared by the guest's organize page (which normally generates them itself
 * right after "Cetak", so nobody has to wait on the booth) and the booth's
 * print listener (the fallback when the phone could not). Both therefore
 * produce exactly the same files from the same saved arrangement.
 */
import { FrameTemplateConfig, PhotoSlotState } from '@photo-booth/types';
import { generateQrDataUrl } from '../utils/qr';
import { canvasToJpegBlob, createResultGif, createResultLiveFramed, renderComposition } from '../utils/resultExport';
import type { SessionUploadFile } from '../utils/sessionUpload';
import { applyPhotoTransform, isIdentityTransform } from '../utils/photoTransform';
import { photoSlotsFromUrls } from '../utils/photoSlots';
import {
  fileUrl,
  LIVE_CLIPS_FILE,
  photoIndexFromName,
  readJsonFile,
  sessionUrl,
  type OrganizeManifest,
  type OrganizePhotoAdjustment,
} from './organize';

export interface ArrangedOutputToggles {
  gif: boolean;
  framedLive: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Throws with a readable message when the arrangement cannot be rendered. */
export const buildArrangedOutputs = async (
  endpoint: string,
  token: string,
  manifest: OrganizeManifest,
  slots: (string | null)[] | undefined,
  adjustments: OrganizePhotoAdjustment[] | undefined,
  outputs: ArrangedOutputToggles,
): Promise<SessionUploadFile[]> => {
  const template = manifest.template ?? null;
  const frameId = manifest.frameId ?? null;
  if (!template || !frameId) throw new Error('No frame was picked for this session.');
  if (!slots || slots.length !== template.photoSlots.length || slots.some((slot) => !slot)) {
    throw new Error('Frame arrangement is incomplete.');
  }

  const arrangedTemplate: FrameTemplateConfig = {
    ...template,
    photoSlots: template.photoSlots.map((placement, index) => {
      const adjustment = adjustments?.[index];
      return adjustment
        ? {
            ...placement,
            objectPosition: `${clamp(adjustment.x, 0, 1) * 100}% ${clamp(adjustment.y, 0, 1) * 100}%`,
            photoScale: clamp(adjustment.scale, 1, 3),
            photoOffsetX: clamp(adjustment.offsetX ?? 0, 1 - clamp(adjustment.scale, 1, 3), 0),
            photoOffsetY: clamp(adjustment.offsetY ?? 0, 1 - clamp(adjustment.scale, 1, 3), 0),
          }
        : placement;
    }),
  };

  // Each arranged photo carries its pre-shutter live-view clip so the framed
  // live photo animates every slot; rotate / mirror from the organize page is
  // baked into the raw and its clip once per photo.
  const liveClips: string[][] | null = outputs.framedLive
    ? await readJsonFile<string[][]>(endpoint, token, LIVE_CLIPS_FILE)
    : null;
  const transformed = new Map<string, Promise<{ url: string; clip: string[] }>>();
  const photoFor = (name: string) => {
    let job = transformed.get(name);
    if (!job) {
      const t = manifest.transforms?.[name];
      const clip = liveClips ? (liveClips[photoIndexFromName(name)] ?? []) : [];
      const url = fileUrl(endpoint, token, name);
      job =
        t && !isIdentityTransform(t)
          ? Promise.all([applyPhotoTransform(url, t), Promise.all(clip.map((f) => applyPhotoTransform(f, t, 0.8)))]).then(
              ([u, c]) => ({ url: u, clip: c }),
            )
          : Promise.resolve({ url, clip });
      transformed.set(name, job);
    }
    return job;
  };

  const photoSlots: PhotoSlotState[] = await Promise.all(
    slots.map(async (name, index) => {
      const placement = arrangedTemplate.photoSlots[index];
      const photo = name ? await photoFor(name) : null;
      return {
        slotNumber: placement.slotNumber,
        maxAttempts: 1,
        attempts: photo
          ? [
              {
                attemptNumber: 1,
                status: 'CAPTURED' as const,
                localPath: photo.url,
                ...(photo.clip.length > 0 ? { liveFrames: photo.clip } : {}),
              },
            ]
          : [],
        selectedAttempt: photo ? 1 : undefined,
      };
    }),
  );

  const frame = { id: frameId, name: 'gallery arrangement', previewUrl: '', template: arrangedTemplate };
  const qrCodeUrl = arrangedTemplate.qrSlots?.length
    ? ((await generateQrDataUrl(sessionUrl(endpoint, token), 256).catch(() => null)) ?? undefined)
    : undefined;

  // framed.png is the sheet the admin prints, so it is always produced.
  const uploads: SessionUploadFile[] = [];
  const canvas = await renderComposition(frame, photoSlots, manifest.filterId, {
    includeFrame: true,
    qrCodeUrl,
    template: arrangedTemplate,
  });
  const framedBlob = await canvasToJpegBlob(canvas);
  if (!framedBlob) throw new Error('Composing the framed sheet produced no image.');
  uploads.push({ blob: framedBlob, name: 'framed.png' });

  if (outputs.gif) {
    // GIF = the original captures used on the frame, in capture order,
    // without rotate / mirror and without the filter.
    const originals = [...new Set(slots.filter((name): name is string => Boolean(name)))]
      .sort((a, b) => photoIndexFromName(a) - photoIndexFromName(b))
      .map((name) => fileUrl(endpoint, token, name));
    const gifBlob = await createResultGif(photoSlotsFromUrls(originals), null, {
      overlayUrl: manifest.gifFrameUrl ?? null,
      adjust: manifest.gifAdjust ?? null,
    });
    uploads.push({ blob: gifBlob, name: 'result.gif' });
  }
  if (outputs.framedLive) {
    uploads.push({ blob: await createResultLiveFramed(frame, photoSlots), name: 'result-live.gif' });
  }
  return uploads;
};
