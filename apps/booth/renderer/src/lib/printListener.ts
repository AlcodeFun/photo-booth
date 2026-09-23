/**
 * Gallery-initiated output generator.
 *
 * Gives the customer's "Ready to print" action a target: while a timed
 * session's raws are sitting on the gallery (R2), the customer arranges the
 * frame slots on the /organize/:token page. This module polls those requests,
 * rebuilds the framed sheet (and the GIF/live outputs, per the booth's Output
 * toggles) from the persisted arrangement (frame template + filter + SLOT→photo
 * mapping), and uploads them to the gallery so the customer's /p/:token page
 * and the admin dashboard both see the finished outputs.
 *
 * It never prints: the admin prints the already-generated framed.png manually
 * from the dashboard, which is what flips print_status to success/error. Until
 * then the session stays 'ready_to_print'.
 *
 * The requests are carried by tiny JSON files on the gallery (see organize.ts)
 * so the whole channel reuses the existing Worker storage. Tokens are tracked
 * in localStorage so the listener keeps working across renderer reloads and
 * after the booth resets for the next paying customer.
 */
import { PhotoSlotState } from '@photo-booth/types';
import { useBoothConfig } from '../store/boothConfigStore';
import { useSessionStore } from '../store/sessionStore';
import { GALLERY_URL } from '../config';
import { generateQrDataUrl } from '../utils/qr';
import { canvasToJpegBlob, createResultGif, createResultLiveFramed, renderComposition } from '../utils/resultExport';
import { SessionUploadFile, uploadSessionFiles } from '../utils/sessionUpload';
import {
  fileUrl,
  LIVE_CLIPS_FILE,
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  PRINT_RESULT_FILE,
  photoIndexFromName,
  readJsonFile,
  sessionUrl,
  writeJsonFile,
  OrganizeManifest,
  PrintRequestFile,
} from './organize';
import { cacheUploadBlob, sessionFileUrl, updateSessionRecord } from './sessions';

const TOKENS_KEY = 'photo-booth.print-tokens';
const HANDLED_KEY = 'photo-booth.generated-requests';
const POLL_INTERVAL = 4000;
const MAX_TRACKED_TOKENS = 12;

const readStringArray = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const trackToken = (token: string) => {
  if (!token) return;
  const tokens = readStringArray(TOKENS_KEY).filter((t) => t !== token);
  tokens.unshift(token);
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens.slice(0, MAX_TRACKED_TOKENS)));
  } catch {
    // Non-fatal — the listener just loses this token if storage is unavailable.
  }
};

const handledAdd = (requestId: string) => {
  const ids = readStringArray(HANDLED_KEY).filter((id) => id !== requestId);
  ids.push(requestId);
  try {
    localStorage.setItem(HANDLED_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // Non-fatal.
  }
};

const handledHas = (requestId: string): boolean => readStringArray(HANDLED_KEY).includes(requestId);

let processing = false;

/**
 * Rebuilds the arranged framed sheet and the optional GIF/live outputs from a
 * gallery-originated request, then uploads them back to the session so the
 * customer's page and the admin dashboard both show the finished outputs.
 *
 * Unlike the old auto-print listener this never talks to a printer and never
 * flips print_status: the arrange page already set it to 'ready_to_print' and
 * only the admin's manual Print action (dashboard) moves it to success/error.
 * Writes the print result back so the arrange page can confirm delivery; marks
 * the request handled either way (never re-generates a request).
 */
const handleRequest = async (token: string, request: PrintRequestFile): Promise<void> => {
  const endpoint = GALLERY_URL;
  if (!endpoint) {
    return;
  }

  const manifest = await readJsonFile<OrganizeManifest>(endpoint, token, ORGANIZE_FILE);
  const slots = request.slots?.length ? request.slots : manifest?.slots;

  const fail = async (message: string) => {
    await writeJsonFile(endpoint, token, PRINT_RESULT_FILE, {
      requestId: request.requestId,
      printedAt: Date.now(),
      status: 'error',
      message,
    });
    await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, { ...request, status: 'handled' });
    handledAdd(request.requestId);
  };

  if (!manifest || !slots || slots.length !== manifest.template.photoSlots.length || slots.some((slot) => !slot)) {
    await fail('Frame arrangement is incomplete.');
    return;
  }

  try {
    const { outputs } = useBoothConfig.getState();

    // Rebuild each arranged photo with its captured pre-shutter live-view clip
    // so the framed "live photo" GIF animates every slot (the booth persisted
    // these next to the raws in live-clips.json). Without them the output would
    // fall back to the still photo and look frozen.
    const liveClips: string[][] | null = outputs.framedLive
      ? await readJsonFile<string[][]>(endpoint, token, LIVE_CLIPS_FILE)
      : null;

    // Build one virtual photo slot per arranged photo, URL-addressable from the
    // gallery. template + filterId come from the persisted arrangement so the
    // composed sheet matches what the customer arranged and approved.
    const photoSlots: PhotoSlotState[] = slots.map((name, index) => {
      const placement = manifest.template.photoSlots[index];
      const clip = liveClips && name ? (liveClips[photoIndexFromName(name)] ?? []) : [];
      return {
        slotNumber: placement.slotNumber,
        maxAttempts: 1,
        attempts: name
          ? [
              {
                attemptNumber: 1,
                status: 'CAPTURED' as const,
                localPath: fileUrl(endpoint, token, name),
                ...(clip.length > 0 ? { liveFrames: clip } : {}),
              },
            ]
          : [],
        selectedAttempt: name ? 1 : undefined,
      };
    });

    const frame = {
      id: manifest.frameId,
      name: 'gallery arrangement',
      previewUrl: '',
      template: manifest.template,
    };

    const qrCodeUrl = manifest.template.qrSlots?.length
      ? (await generateQrDataUrl(sessionUrl(endpoint, token), 256).catch(() => null)) ?? undefined
      : undefined;

    // Collect the booth's output toggles into concrete files. framed.png is the
    // sheet the admin prints from, so it is always produced for a valid request
    // even if the booth's "Framed" toggle is off — the row says ready_to_print.
    const uploads: SessionUploadFile[] = [];
    const canvas = await renderComposition(frame, photoSlots, manifest.filterId, {
      includeFrame: true,
      qrCodeUrl,
      template: manifest.template,
    });
    const framedBlob = await canvasToJpegBlob(canvas);
    if (!framedBlob) {
      throw new Error('Composing the framed sheet produced no image.');
    }
    uploads.push({ blob: framedBlob, name: 'framed.png' });

    if (outputs.gif) {
      const gifBlob = await createResultGif(photoSlots, manifest.filterId);
      uploads.push({ blob: gifBlob, name: 'result.gif' });
    }
    if (outputs.framedLive) {
      const liveBlob = await createResultLiveFramed(frame, photoSlots, manifest.filterId);
      uploads.push({ blob: liveBlob, name: 'result-live.gif' });
    }

    // Mirror the outputs to IndexedDB first (admin reprint needs the blob even
    // if the current gallery state is stale or was reset), then push upstream.
    await Promise.all(uploads.map((file) => cacheUploadBlob(token, file.name, file.blob)));
    const results = await uploadSessionFiles(uploads, endpoint, token);
    const ok = results.every((result) => result.ok);

    await writeJsonFile(endpoint, token, PRINT_RESULT_FILE, {
      requestId: request.requestId,
      printedAt: Date.now(),
      status: ok ? 'ok' : 'error',
      message: ok ? 'Outputs generated.' : 'One or more outputs failed to upload.',
    });
    await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, { ...request, status: 'handled' });

    // Keep the session record's file list in sync so the admin dashboard shows
    // the generated outputs (used by the manual Print action). print_status
    // stays 'ready_to_print' — the admin flips it when they actually print.
    if (ok) {
      const files = uploads.map((file) => ({
        name: file.name,
        uploaded: true,
        size: file.blob.size,
        url: sessionFileUrl(token, file.name) ?? undefined,
      }));
      updateSessionRecord(token, { files });
    }
    handledAdd(request.requestId);
  } catch (error) {
    await fail(error instanceof Error ? error.message : String(error));
  }
};

const pollOnce = async () => {
  if (!GALLERY_URL || processing) {
    return;
  }
  const tokens = readStringArray(TOKENS_KEY);
  for (const token of tokens) {
    const request = await readJsonFile<PrintRequestFile>(GALLERY_URL, token, PRINT_REQUEST_FILE);
    if (!request || request.status !== 'requested' || handledHas(request.requestId)) {
      continue;
    }
    // The request stays queued until every slot is filled — the customer may
    // still be arranging. Skipping it here lets a later (complete) request win.
    if (request.slots && request.slots.some((slot) => !slot)) {
      continue;
    }

    processing = true;
    try {
      await handleRequest(token, request);
    } catch (error) {
      console.error('Gallery output generation failed:', error);
      await writeJsonFile(GALLERY_URL, token, PRINT_RESULT_FILE, {
        requestId: request.requestId,
        printedAt: Date.now(),
        status: 'error',
        message: 'Booth output generation failed.',
      });
      await writeJsonFile(GALLERY_URL, token, PRINT_REQUEST_FILE, { ...request, status: 'handled' });
      handledAdd(request.requestId);
    } finally {
      processing = false;
    }
    break;
  }
};

let started = false;

/** Boots the gallery output listener once. Call at app startup (store-level). */
export const startPrintListener = () => {
  if (started || !GALLERY_URL) {
    return;
  }
  started = true;

  // Track the current session's token as soon as it is published (the QR link
  // is what the customer's arrange page lives behind). Tokens persist in
  // localStorage, so requests arriving after a booth reset still get generated.
  useSessionStore.subscribe((state, prev) => {
    if (state.sessionToken && state.sessionToken !== prev.sessionToken) {
      trackToken(state.sessionToken);
    }
  });
  const current = useSessionStore.getState().sessionToken;
  if (current) {
    trackToken(current);
  }

  void pollOnce();
  setInterval(() => void pollOnce(), POLL_INTERVAL);
};