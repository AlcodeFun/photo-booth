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

export const ORGANIZE_FILE = 'organize.json';
export const PRINT_REQUEST_FILE = 'print-request.json';
export const PRINT_RESULT_FILE = 'print-result.json';

export interface OrganizeManifest {
  version: 1;
  frameId: string;
  filterId: string | null;
  slotCount: number;
  /** Resolved frame template for the frame's full slot capacity. */
  template: FrameTemplateConfig;
  /** Raw photo file names (photo-01.jpg …) in capture order, matching the uploads. */
  photoFiles: string[];
  /** Per-slot assignment: index i ↔ slot i+1, value = photo file name or null. */
  slots: (string | null)[];
}

export interface PrintRequestFile {
  requestId: string;
  requestedAt: number;
  slots: (string | null)[];
  by: string;
  status: 'requested' | 'handled';
}

export interface PrintResultFile {
  requestId: string;
  printedAt: number;
  status: 'ok' | 'error';
  message?: string;
}

export const photoFileName = (index: number): string =>
  `photo-${String(index + 1).padStart(2, '0')}.jpg`;

export const sessionUrl = (endpoint: string, token: string): string => `${endpoint}/p/${token}`;

/**
 * Builds the organizer manifest for a session. For the timed flow the live
 * session only ever has one virtual slot, so the advertised slot count (and
 * template) come from the frame's actual capacity — that is what the gallery
 * customer arranges.
 */
export const buildOrganizeManifest = (
  frame: FrameConfig,
  photoSlots: PhotoSlotState[],
  filterId: string | null,
): OrganizeManifest => {
  const slotCount = Math.max(1, Math.round(frame.photoSlots ?? photoSlots.length));
  const template = resolveFrameTemplate(frame, slotCount);
  const photoFiles = Array.from({ length: getAllPhotoUrls(photoSlots).length }, (_, i) =>
    photoFileName(i),
  );
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