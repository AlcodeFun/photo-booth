/**
 * "Organize photo" bridge for the timed capture flow.
 *
 * Flow 2 captures an unlimited number of photos and uploads every raw shot to
 * the gallery. The customer then picks which photo lands on each frame slot and
 * asks the booth to print the composed framed sheet. The booth and the gallery
 * talk through three small JSON files stored on the gallery alongside the
 * photos (all served/streamed by the same worker, so no new endpoints):
 *
 *  - organize.json      — frame template + slot count + the raw photo catalog.
 *                         Written by the booth when uploads finish, re-written
 *                         by the gallery page whenever the customer rearranges.
 *  - print-request.json — { requestId, slots, status:'requested' }. Written by
 *                         the gallery when the customer taps "Send to printer".
 *  - print-result.json  — { requestId, status:'ok'|'error', message }. Written
 *                         by the booth once the CUPS print finishes (or fails).
 */
import { FrameConfig, FrameTemplateConfig, PhotoSlotState } from '@photo-booth/types';
import { resolveFrameTemplate } from '../utils/frameConfig';
import { getAllPhotoUrls } from '../utils/photoSlots';
import { uploadSessionFile } from '../utils/sessionUpload';
import type { GifAdjust } from '../utils/gifAdjust';

export const ORGANIZE_FILE = 'organize.json';
export const PRINT_REQUEST_FILE = 'print-request.json';
export const PRINT_RESULT_FILE = 'print-result.json';
export const LIVE_CLIPS_FILE = 'live-clips.json';

/** Per-photo rotate / mirror chosen on the organize page (baked when rendering). */
export interface OrganizePhotoTransform {
  /** Clockwise quarter turns in degrees: 0, 90, 180 or 270. */
  rotate: number;
  flip: boolean;
}

export interface OrganizeManifest {
  version: 1;
  /** Null until the guest picks a frame on the organize page (timed flow). */
  frameId: string | null;
  filterId: string | null;
  slotCount: number;
  /** Resolved frame template for the frame's full slot capacity (null = not picked yet). */
  template: FrameTemplateConfig | null;
  /** Raw photo file names (photo-01.jpg …) in capture order, matching the uploads. */
  photoFiles: string[];
  /** Per-slot assignment: index i ↔ slot i+1, value = photo file name or null. */
  slots: (string | null)[];
  /** Optional customer image adjustments, kept optional for older manifests. */
  adjustments?: OrganizePhotoAdjustment[];
  /** Rotate / mirror per raw photo file name. */
  transforms?: Record<string, OrganizePhotoTransform>;
  /** GIF frame overlay picked on the organize page (null = plain GIF). */
  gifFrameUrl?: string | null;
  /** Zoom / pan / mirror of the GIF photos (absent = as captured). */
  gifAdjust?: GifAdjust | null;
  /** The booth's output toggles, so whoever renders makes the same files. */
  outputs?: { gif: boolean; framedLive: boolean };
}

export interface OrganizePhotoAdjustment {
  x: number;
  y: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
}

export interface PrintRequestFile {
  requestId: string;
  requestedAt: number;
  slots: (string | null)[];
  adjustments?: OrganizePhotoAdjustment[];
  by: string;
  /** requested → (a booth picks it up) processing → handled. */
  status: 'requested' | 'processing' | 'handled';
  /** When a booth started generating (lets another booth retry a stalled one). */
  processingAt?: number;
}

export interface PrintResultFile {
  requestId: string;
  printedAt: number;
  status: 'ok' | 'error';
  message?: string;
}

export const photoFileName = (index: number): string =>
  `photo-${String(index + 1).padStart(2, '0')}.jpg`;

/**
 * Live-view clips for the timed flow, aligned to the flattened upload order
 * (photo-01.jpg, photo-02.jpg … = attempt 1, 2, … of the single timed slot).
 * The booth uploads this next to the raws so the print listener can rebuild
 * an animated framed "live photo" from the customer's final arrangement.
 */
export const buildLiveClips = (
  photoSlots: PhotoSlotState[],
  opts: { maxFrames?: number } = {},
): string[][] | null => {
  const { maxFrames = 12 } = opts;
  const clips: string[][] = [];
  for (const slot of photoSlots) {
    for (const attempt of slot.attempts) {
      if (!attempt.localPath) continue;
      const frames = (attempt.liveFrames ?? []).slice(0, maxFrames);
      clips.push(frames);
    }
  }
  return clips.some((clip) => clip.length > 0) ? clips : null;
};

export const photoIndexFromName = (name: string): number => {
  const match = /^photo-(\d+)(?:[.]jpe?g|png)?$/i.exec(name);
  return match ? Number.parseInt(match[1], 10) - 1 : -1;
};

export const sessionUrl = (endpoint: string, token: string): string => `${endpoint}/p/${token}`;

/** Tokens whose organize page the booth's print listener watches. */
export const PRINT_TOKENS_KEY = 'photo-booth.print-tokens';
/** Upper bound only; tokens leave the list as soon as their request is generated. */
const MAX_PRINT_TOKENS = 60;

export const readPrintTokens = (): string[] => {
  try {
    const raw = localStorage.getItem(PRINT_TOKENS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const writePrintTokens = (tokens: string[]): void => {
  try {
    localStorage.setItem(PRINT_TOKENS_KEY, JSON.stringify(tokens.slice(0, MAX_PRINT_TOKENS)));
  } catch {
    // Non-fatal — the listener just loses this token if storage is unavailable.
  }
};

/** Watch this session's organize page for a print request (newest first). */
export const trackPrintToken = (token: string): void => {
  if (!token) return;
  writePrintTokens([token, ...readPrintTokens().filter((t) => t !== token)]);
};

/** Stop watching a session once its request has been generated. */
export const untrackPrintToken = (token: string): void => {
  const tokens = readPrintTokens();
  if (tokens.includes(token)) writePrintTokens(tokens.filter((t) => t !== token));
};

/**
 * Builds the organizer manifest for a session. For the timed flow the live
 * session only ever has one virtual slot, so the advertised slot count (and
 * template) come from the frame's actual capacity — that is what the gallery
 * customer arranges.
 */
export const buildOrganizeManifest = (
  frame: FrameConfig | null,
  photoSlots: PhotoSlotState[],
  filterId: string | null,
): OrganizeManifest => {
  const photoFiles = Array.from({ length: getAllPhotoUrls(photoSlots).length }, (_, i) =>
    photoFileName(i),
  );
  // Timed flow: no frame at the booth, the guest picks it on the organize page.
  if (!frame) {
    return { version: 1, frameId: null, filterId, slotCount: 0, template: null, photoFiles, slots: [] };
  }
  const slotCount = Math.max(1, Math.round(frame.photoSlots ?? photoSlots.length));
  const template = resolveFrameTemplate(frame, slotCount);
  return {
    version: 1,
    frameId: frame.id,
    filterId,
    slotCount,
    template,
    photoFiles,
    slots: Array.from({ length: template.photoSlots.length }, () => null),
  };
};

export const fileUrl = (endpoint: string, token: string, name: string): string =>
  `${endpoint}/d/${token}/${encodeURIComponent(name)}`;

export const uploadOrganizeManifest = async (
  endpoint: string,
  token: string,
  manifest: OrganizeManifest,
): Promise<boolean> =>
  (
    await uploadSessionFile(
      { blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }), name: ORGANIZE_FILE },
      endpoint,
      token,
    )
  ).ok;

export const writeJsonFile = async (
  endpoint: string,
  token: string,
  name: string,
  value: unknown,
): Promise<boolean> =>
  (
    await uploadSessionFile(
      { blob: new Blob([JSON.stringify(value)], { type: 'application/json' }), name },
      endpoint,
      token,
    )
  ).ok;

export const readJsonFile = async <T>(endpoint: string, token: string, name: string): Promise<T | null> => {
  try {
    const response = await fetch(`${fileUrl(endpoint, token, name)}?ts=${Date.now()}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
};