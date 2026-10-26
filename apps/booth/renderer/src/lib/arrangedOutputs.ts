/**
 * Builds the outputs of an arranged (flow 2) session: the framed print sheet,
 * the GIF and the framed live-photo GIF.
 *
 * Shared by the guest's organize page (which normally generates them itself
 * right after "Cetak", so nobody has to wait on the booth) and the booth's
 * print listener (the fallback when the phone could not, and the finisher for
 * GIFs the phone did not get to). Both therefore produce exactly the same
 * files from the same saved arrangement.
 *
 * The steps are separate so the print never waits for the GIFs: the organize
 * page builds + uploads framed.png first, hands it to the booth, and only then
 * makes the (much heavier) GIFs.
 */
import { FrameConfig, FrameTemplateConfig, PhotoSlotState } from '@photo-booth/types';
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

/** File names of the optional outputs, in the order they are made. */
export const GIF_OUTPUT = 'result.gif';
export const LIVE_OUTPUT = 'result-live.gif';
export const FRAMED_OUTPUT = 'framed.png';

/** The optional outputs the toggles ask for. */
export const animatedOutputNames = (outputs: ArrangedOutputToggles): string[] => [
  ...(outputs.gif ? [GIF_OUTPUT] : []),
  ...(outputs.framedLive ? [LIVE_OUTPUT] : []),
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Everything the three outputs are drawn from (resolved once). */
export interface PreparedArrangement {
  endpoint: string;
  token: string;
  manifest: OrganizeManifest;
  slots: string[];
  frame: FrameConfig;
  template: FrameTemplateConfig;
  photoSlots: PhotoSlotState[];
  qrCodeUrl?: string;
}

/**
 * Resolves the arrangement: the template with the guest's zoom / pan, each
 * slot's photo (rotate / mirror baked in) and, when the live photo is wanted,
 * each photo's pre-shutter clip. Throws with a readable message when the
 * arrangement cannot be rendered.
 */
export const prepareArrangement = async (
  endpoint: string,
  token: string,
  manifest: OrganizeManifest,
  slots: (string | null)[] | undefined,
  adjustments: OrganizePhotoAdjustment[] | undefined,
  withLiveClips: boolean,
): Promise<PreparedArrangement> => {
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
  const liveClips: string[][] | null = withLiveClips
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

  const qrCodeUrl = arrangedTemplate.qrSlots?.length
    ? ((await generateQrDataUrl(sessionUrl(endpoint, token), 256).catch(() => null)) ?? undefined)
    : undefined;

  return {
    endpoint,
    token,
    manifest,
    slots: slots as string[],
    frame: { id: frameId, name: 'gallery arrangement', previewUrl: '', template: arrangedTemplate },
    template: arrangedTemplate,
    photoSlots,
    qrCodeUrl,
  };
};

/** framed.png: the sheet the booth prints (always produced). */
export const buildFramedOutput = async (prepared: PreparedArrangement): Promise<SessionUploadFile> => {
  const canvas = await renderComposition(prepared.frame, prepared.photoSlots, prepared.manifest.filterId, {
    includeFrame: true,
    qrCodeUrl: prepared.qrCodeUrl,
    template: prepared.template,
  });
  const blob = await canvasToJpegBlob(canvas);
  if (!blob) throw new Error('Composing the framed sheet produced no image.');
  return { blob, name: FRAMED_OUTPUT };
};

/**
 * result.gif: the original captures used on the frame, in capture order,
 * without rotate / mirror and without the filter, in the chosen GIF frame.
 */
export const buildGifOutput = async (prepared: PreparedArrangement): Promise<SessionUploadFile> => {
  const { endpoint, token, manifest, slots } = prepared;
  const originals = [...new Set(slots)]
    .sort((a, b) => photoIndexFromName(a) - photoIndexFromName(b))
    .map((name) => fileUrl(endpoint, token, name));
  const blob = await createResultGif(photoSlotsFromUrls(originals), null, {
    overlayUrl: manifest.gifFrameUrl ?? null,
    adjust: manifest.gifAdjust ?? null,
  });
  return { blob, name: GIF_OUTPUT };
};

/** result-live.gif: the framed sheet with every slot playing its live clip. */
export const buildLiveOutput = async (prepared: PreparedArrangement): Promise<SessionUploadFile> => ({
  blob: await createResultLiveFramed(prepared.frame, prepared.photoSlots, { qrCodeUrl: prepared.qrCodeUrl }),
  name: LIVE_OUTPUT,
});

/** Builds one optional output by file name. */
export const buildAnimatedOutput = (prepared: PreparedArrangement, name: string): Promise<SessionUploadFile> =>
  name === LIVE_OUTPUT ? buildLiveOutput(prepared) : buildGifOutput(prepared);

/** All outputs in one go (the booth's fallback when the phone made none). */
export const buildArrangedOutputs = async (
  endpoint: string,
  token: string,
  manifest: OrganizeManifest,
  slots: (string | null)[] | undefined,
  adjustments: OrganizePhotoAdjustment[] | undefined,
  outputs: ArrangedOutputToggles,
): Promise<SessionUploadFile[]> => {
  const prepared = await prepareArrangement(endpoint, token, manifest, slots, adjustments, outputs.framedLive);
  const uploads: SessionUploadFile[] = [await buildFramedOutput(prepared)];
  for (const name of animatedOutputNames(outputs)) {
    uploads.push(await buildAnimatedOutput(prepared, name));
  }
  return uploads;
};
