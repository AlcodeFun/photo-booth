import { FrameConfig, PhotoSlotState } from '@photo-booth/types';
import { useSessionStore } from '../store/sessionStore';
import { GALLERY_URL } from '../config';
import {
  generateSessionToken,
  registerGallerySession,
  uploadSessionFiles,
  withTimeout,
  dataUrlToBlob,
  SessionUploadFile,
  SessionUploadFileResult,
} from '../utils/sessionUpload';
import { renderComposition, canvasToJpegBlob, createResultGif } from '../utils/resultExport';
import { generateQrDataUrl } from '../utils/qr';
import { getAllPhotoUrls } from '../utils/photoSlots';
import {
  cacheUploadBlob,
  createSessionRecord,
  listUploadedBlobs,
  sessionFileUrl,
  updateSessionRecord,
  SessionFileState,
} from './sessions';

/**
 * Background upload owner.
 *
 * The booth's PRINT_QR screen is purely presentational: it renders the QR the
 * moment a token exists and is never responsible for (or blocking on) getting
 * the files to the gallery. This module owns that work as a store-level job so
 * it keeps running even after the user taps "Finish Session" and the round
 * advances to COMPLETE — the upload completes fully in the background.
 *
 * Guarantees
 * - Runs independently of any mounted screen/component (subscribes to the store).
 * - Caches every blob into IndexedDB BEFORE it is uploaded, so a later admin
 *   "reupload" (or interrupted transfer) never needs the booth to re-run.
 * - Records per-file state keyed by session TOKEN, and only touches the live
 *   store status when that token is still the current session — so a late
 *   finishing job can never clobber a newer session.
 */

const REGISTER_TIMEOUT = 8000;
const UPLOAD_TIMEOUT = 120000;
const MAX_ATTEMPTS = 3;
const ATTEMPT_DELAY = 2000;

interface UploadJob {
  sessionId: string;
  token: string | null;
  downloadUrl: string | null;
  frame: FrameConfig | null;
  photoSlots: PhotoSlotState[];
  filterId: string | null;
  /** Per-token statuses accumulated by this job (survives a store reset). */
  fileStates: SessionFileState[];
}

const runningJobs = new Map<string, UploadJob>();

const PENDING_UPLOADS_KEY = 'photo-booth.pending-uploads';

interface PendingUploadRecord {
  sessionId: string;
  token: string | null;
  downloadUrl: string | null;
  fileStates: SessionFileState[];
}

const readPendingUploads = (): PendingUploadRecord[] => {
  try {
    const raw = localStorage.getItem(PENDING_UPLOADS_KEY);
    return raw ? (JSON.parse(raw) as PendingUploadRecord[]) : [];
  } catch {
    return [];
  }
};

const writePendingUploads = (records: PendingUploadRecord[]): void => {
  try {
    localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(records));
  } catch {
    // Quota/storage errors are non-fatal — resuming is best-effort.
  }
};

const upsertPendingUpload = (job: UploadJob): void => {
  if (!job.token) return;
  const records = readPendingUploads().filter((record) => record.token !== job.token);
  records.push({
    sessionId: job.sessionId,
    token: job.token,
    downloadUrl: job.downloadUrl,
    fileStates: job.fileStates,
  });
  writePendingUploads(records);
};

const dropPendingUpload = (token: string): void => {
  writePendingUploads(readPendingUploads().filter((record) => record.token !== token));
};

/** Removes resume records for deleted sessions so they are never re-uploaded. */
export const dropPendingUploads = (tokens: string[]): void => {
  const drop = new Set(tokens);
  writePendingUploads(readPendingUploads().filter((record) => !(record.token && drop.has(record.token))));
};

const resumedTokens = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stillCurrentToken = (token: string) => useSessionStore.getState().sessionToken === token;
const stillCurrentSession = (sessionId: string) => useSessionStore.getState().sessionId === sessionId;

const finishWith = (job: UploadJob, status: 'success' | 'error') => {
  const { token, fileStates, downloadUrl } = job;
  if (!token) return;
  upsertPendingUpload(job);
  updateSessionRecord(token, {
    upload_status: status,
    download_url: downloadUrl ?? undefined,
    files: fileStates,
  });
  if (status === 'success') {
    dropPendingUpload(token);
  }
  if (stillCurrentToken(token)) {
    useSessionStore.getState().setSessionFilesForToken(token, fileStates);
    useSessionStore.getState().setUploadStatus(status === 'success' ? 'SUCCESS' : 'ERROR');
  }
};

/** Merges a batch of results into the job's per-token file list (never drops earlier OKs). */
const mergeResults = (job: UploadJob, results: SessionUploadFileResult[], files: SessionUploadFile[]) => {
  for (const result of results) {
    const source = files.find((file) => file.name === result.name);
    const entry: SessionFileState = {
      name: result.name,
      uploaded: result.ok,
      size: source?.blob.size,
      url: result.ok ? sessionFileUrl(job.token ?? '', result.name) ?? undefined : undefined,
    };
    const index = job.fileStates.findIndex((file) => file.name === result.name);
    if (index >= 0) {
      job.fileStates[index] = entry;
    } else {
      job.fileStates.push(entry);
    }
  }
  upsertPendingUpload(job);
};

/**
 * Uploads one batch with bounded retries. Returns true when every file landed.
 * An in-flight attempt is allowed to finish and record its result even if the
 * round has already moved on — nothing here depends on a mounted screen.
 */
const uploadBatch = async (job: UploadJob, files: SessionUploadFile[]): Promise<boolean> => {
  let pending = files.filter(
    (file) => !job.fileStates.some((state) => state.name === file.name && state.uploaded),
  );
  let attempt = 0;

  while (pending.length > 0 && attempt < MAX_ATTEMPTS) {
    attempt += 1;
    let results: SessionUploadFileResult[];
    try {
      const activeToken = job.token ?? '';
      const endpoint = GALLERY_URL;
      if (!activeToken || !endpoint) throw new Error('Missing session token');
      await withTimeout(registerGallerySession(endpoint, activeToken), REGISTER_TIMEOUT, 'Reserving gallery session');
      results = await withTimeout(uploadSessionFiles(pending, endpoint, activeToken), UPLOAD_TIMEOUT, 'Uploading photos');
    } catch (error) {
      console.error('Upload failed:', error);
      await sleep(ATTEMPT_DELAY);
      continue;
    }

    mergeResults(job, results, pending);

    const failed = results.filter((result) => !result.ok);
    if (failed.length === 0) {
      break;
    }
    const failedNames = new Set(failed.map((result) => result.name));
    pending = pending.filter((file) => failedNames.has(file.name));
    await sleep(ATTEMPT_DELAY * attempt);
  }

  return files.every((file) =>
    job.fileStates.some((state) => state.name === file.name && state.uploaded),
  );
};

const run = async (job: UploadJob) => {
  // No gallery configured — keep the old simulated-success fallback so the
  // booth still flows offline (the screen renders the "grab photos below" path).
  if (!GALLERY_URL) {
    await sleep(3000);
    if (stillCurrentSession(job.sessionId)) {
      useSessionStore.getState().setUploadStatus('SUCCESS');
    }
    runningJobs.delete(job.sessionId);
    return;
  }
  const endpoint = GALLERY_URL;

  try {
    // Token (and therefore the QR URL) is generated client-side and published to
    // the store in this same tick, so the QR is never delayed by background work.
    if (!job.token) {
      const token = generateSessionToken();
      job.token = token;
      job.downloadUrl = `${endpoint}/p/${token}`;
      // Only publish to the store when this session is still the active one —
      // otherwise a stale job would hijack a newer session's link.
      if (stillCurrentSession(job.sessionId)) {
        const store = useSessionStore.getState();
        store.setSessionToken(token);
        store.setDownloadUrl(job.downloadUrl);
        store.setSessionFilesForToken(token, []);
      }
    }
    const token = job.token;

    // Surface the session to the admin dashboard immediately. The row is
    // created independently of register success — uploadBatch re-registers
    // idempotently before each attempt, so a transient network failure here
    // never hides the session from the dashboard.
    if (token) {
      createSessionRecord(token, `${endpoint}/p/${token}`);
    }
    try {
      if (token) {
        await withTimeout(registerGallerySession(endpoint, token), REGISTER_TIMEOUT, 'Reserving gallery session');
      }
    } catch (error) {
      // Not fatal — uploadBatch re-registers idempotently before each attempt.
      console.error('Session register failed:', error);
    }

    // Prepare + CACHE every file BEFORE the first byte leaves the device. The
    // IndexedDB mirror is committed (awaited) before any upload starts, so a
    // reload at any point after the first byte is fully recoverable by resume.
    const cacheWrites: Promise<void>[] = [];

    const framed = (async () => {
      if (!job.frame || job.photoSlots.length === 0) return null;
      try {
        // Compose the real QR (the session download link) into the framed photo.
        const qrCodeUrl = job.downloadUrl
          ? (await generateQrDataUrl(job.downloadUrl, 256).catch(() => null)) ?? undefined
          : undefined;
        const canvas = await renderComposition(job.frame, job.photoSlots, job.filterId, {
          includeFrame: true,
          qrCodeUrl,
        });
        const blob = await canvasToJpegBlob(canvas);
        if (!blob) return null;
        cacheWrites.push(cacheUploadBlob(token ?? '', 'framed.png', blob));
        return { blob, name: 'framed.png' as const };
      } catch (error) {
        console.error('Preparing framed photo failed:', error);
        return null;
      }
    })();

    const photos = (() => {
      const files: SessionUploadFile[] = [];
      getAllPhotoUrls(job.photoSlots).forEach((dataUrl, index) => {
        const name = `photo-${String(index + 1).padStart(2, '0')}.jpg`;
        const blob = dataUrlToBlob(dataUrl);
        cacheWrites.push(cacheUploadBlob(token ?? '', name, blob));
        files.push({ blob, name });
      });
      return Promise.resolve(files);
    })();

    const gif = (async () => {
      if (job.photoSlots.length <= 1) return null;
      try {
        const blob = await createResultGif(job.photoSlots, job.filterId);
        cacheWrites.push(cacheUploadBlob(token ?? '', 'result.gif', blob));
        return { blob, name: 'result.gif' as const };
      } catch (error) {
        console.error('Preparing GIF failed:', error);
        return null;
      }
    })();

    const [framedResult, photoFiles, gifResult] = await Promise.all([framed, photos, gif]);
    const baseFiles = [...(framedResult ? [framedResult] : []), ...photoFiles];

    // All blobs are now durable in IndexedDB — nothing above has been sent yet.
    await Promise.all(cacheWrites);

    // Record the resumable work only now that the blobs it depends on are
    // committed, so a reload can always rebuild every file.
    upsertPendingUpload(job);

    // Upload the base files first, then fold the slower GIF in when it is
    // ready — one job owns the whole flow, so no cross-effect coordination.
    let baseOk = false;
    if (baseFiles.length > 0) {
      baseOk = await uploadBatch(job, baseFiles);
    }
    let gifOk = true;
    if (gifResult) {
      gifOk = await uploadBatch(job, [gifResult]);
    }

    finishWith(job, baseOk && gifOk ? 'success' : 'error');
  } catch (error) {
    console.error('Background upload failed:', error);
    finishWith(job, 'error');
  } finally {
    runningJobs.delete(job.sessionId);
  }
};

const maybeStart = () => {
  const store = useSessionStore.getState();
  const { sessionId } = store;
  if (!sessionId || store.uploadStatus !== 'UPLOADING') return;
  if (runningJobs.has(sessionId)) return;

  const job: UploadJob = {
    sessionId,
    token: store.sessionToken,
    downloadUrl: store.downloadUrl,
    frame: store.frame,
    photoSlots: store.photoSlots,
    filterId: store.filterId,
    fileStates: [...(store.sessionFilesByToken[store.sessionToken ?? ''] ?? [])],
  };
  runningJobs.set(sessionId, job);
  void run(job);
};

/**
 * Re-attaches any upload that was interrupted by a page/renderer reload.
 * The blobs were cached to IndexedDB before the first byte was sent, so the
 * remaining files can be pushed again without re-running the session. The
 * session row is patched through finishWith so the admin sees success even
 * though the process the customer was looking at is long gone.
 */
const resumePendingUploads = async () => {
  if (!GALLERY_URL) return;
  const records = readPendingUploads();
  for (const record of records) {
    const { sessionId, token, downloadUrl, fileStates } = record;
    if (!token || resumedTokens.has(token)) continue;
    if (stillCurrentToken(token)) continue;
    resumedTokens.add(token);

    const cached = await listUploadedBlobs(token);
    const files = cached
      .filter(({ name }) => !fileStates.some((state) => state.name === name && state.uploaded))
      .map(({ name, blob }) => ({ blob, name }));
    if (files.length === 0) {
      dropPendingUpload(token);
      continue;
    }

    const job: UploadJob = {
      sessionId,
      token,
      downloadUrl,
      frame: null,
      photoSlots: [],
      filterId: null,
      fileStates: [...fileStates],
    };
    runningJobs.set(sessionId, job);
    try {
      const ok = await uploadBatch(job, files);
      finishWith(job, ok ? 'success' : 'error');
    } catch (error) {
      console.error('Resumed upload failed:', error);
      finishWith(job, 'error');
    } finally {
      runningJobs.delete(sessionId);
    }
  }
};

let started = false;

/** Boots the upload watcher once. Call at app startup (store-level, not a component). */
export const startUploadWatcher = () => {
  if (started) return;
  started = true;
  useSessionStore.subscribe(maybeStart);
  maybeStart();
  void resumePendingUploads();
};