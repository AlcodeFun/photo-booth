import {
  BoothPrintStatus,
  SessionPrintStatus,
  getUploadedBlob,
  sessionFileUrl,
  updateSessionRecord,
} from './sessions';
import {
  dropReadySession,
  readySessionsSnapshot,
} from './printListener';
import { useBoothConfig } from '../store/boothConfigStore';
import { useSessionStore } from '../store/sessionStore';
import { IElectronAPIPrintJobState, IElectronAPIPrintQueueSnapshot } from '../global';

/**
 * Bridges the main-process print queue to the renderer.
 *
 * Runs for the whole app (started from main.tsx), independent of any mounted
 * screen, and does two jobs:
 *   1. Answers the queue's just-in-time image requests by resolving the framed
 *      photo from IndexedDB (or the gallery) — no images are staged on disk.
 *   2. Mirrors each job's state onto its session's `print_status` so the admin
 *      dashboard and the booth flow see queue progress.
 */

const JOB_TO_SESSION_STATUS: Record<IElectronAPIPrintJobState, SessionPrintStatus> = {
  pending: 'queued',
  submitted: 'printing',
  processing: 'printing',
  completed: 'success',
  failed: 'error',
  canceled: 'ready_to_print',
};

const SESSION_TO_BOOTH_STATUS: Record<SessionPrintStatus, BoothPrintStatus> = {
  printing: 'PRINTING',
  ready_to_print: 'READY_TO_PRINT',
  queued: 'QUEUED',
  success: 'SUCCESS',
  error: 'ERROR',
};

const IMAGE_WAIT_MS = 45000;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Reading the framed photo failed.'));
    reader.readAsDataURL(blob);
  });

/**
 * Resolves the framed image for a job. In manual mode the blob is already in
 * IndexedDB; in auto mode it may still be generating, so poll briefly.
 */
const resolveFramedDataUrl = async (token: string, name: string): Promise<string> => {
  const deadline = Date.now() + IMAGE_WAIT_MS;
  let lastError = 'No framed image is available for this session.';
  let attempt = 0;

  while (Date.now() < deadline) {
    const cached = await getUploadedBlob(token, name);
    if (cached) {
      return blobToDataUrl(cached);
    }

    // Only reach for the gallery on the first pass and then occasionally.
    if (attempt === 0 || attempt % 5 === 0) {
      const url = sessionFileUrl(token, name);
      if (url) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return blobToDataUrl(await response.blob());
          }
          lastError = `Gallery returned ${response.status}.`;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
    }

    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(lastError);
};

const handleResolveImage = async (request: { jobId: string; token?: string; fileName: string }) => {
  const api = window.electronAPI?.printer;
  if (!api?.provideImage) {
    return;
  }
  try {
    if (!request.token) {
      throw new Error('This print job has no session token to resolve an image from.');
    }
    const dataUrl = await resolveFramedDataUrl(request.token, request.fileName || 'framed.png');
    await api.provideImage({ jobId: request.jobId, dataUrl });
  } catch (error) {
    await api.provideImage({
      jobId: request.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const startPrintQueueSync = () => {
  const api = window.electronAPI?.printer;
  if (!api?.onJobUpdate || !api?.onResolveImage) {
    return;
  }

  api.onResolveImage((request) => {
    void handleResolveImage(request);
  });

  const lastState = new Map<string, IElectronAPIPrintJobState>();
  api.onJobUpdate((snapshot: IElectronAPIPrintQueueSnapshot) => {
    for (const job of snapshot.jobs) {
      if (!job.token) continue;
      if (lastState.get(job.id) === job.state) continue;
      lastState.set(job.id, job.state);
      const status = JOB_TO_SESSION_STATUS[job.state];
      if (status) {
        updateSessionRecord(job.token, { print_status: status });
        const store = useSessionStore.getState();
        if (store.sessionToken === job.token) {
          store.setPrintStatus(SESSION_TO_BOOTH_STATUS[status]);
        }
      }
    }
  });
};

// --- Automatic ready-to-print → queue bridge ---------------------------------

const AUTO_QUEUE_INTERVAL_MS = 8000;

let autoQueueInitialized = false;
let autoQueueRunning = false;

/** Framed sheet already exists locally (printListener caches it before upload). */
const hasFramedBlob = async (token: string): Promise<boolean> =>
  (await getUploadedBlob(token, 'framed.png')) !== null;

/**
 * Replaces the admin's manual "Add to queue" staging step for arranged
 * (ready_to_print) sessions. Once the customer approves their frame and the
 * print listener has generated framed.png, this sweep enqueues the session
 * automatically — the queue owns print_status from there on, so the admin only
 * has to select sessions and hit Print (manual mode) or nothing at all (auto
 * mode, where the batch starts immediately).
 *
 * Runs in both the booth and admin windows; PrintQueue.enqueue dedupes by token.
 */
export const startAutoQueueSync = () => {
  if (autoQueueInitialized) {
    return;
  }
  autoQueueInitialized = true;

  const sweep = async () => {
    if (autoQueueRunning) {
      return;
    }
    const api = window.electronAPI?.printer;
    const printer = useBoothConfig.getState().printer;
    if (!api?.enqueue || !printer.enabled || !printer.queueName) {
      return;
    }

    autoQueueRunning = true;
    try {
      const snapshot = await api.queue();
      const queuedTokens = new Set(
        snapshot.jobs
          .filter((job) => job.state !== 'canceled')
          .map((job) => job.token)
          .filter(Boolean),
      );

      const autoStart: string[] = [];
      // Ready sessions come from the local registry (printListener registers a
      // session as soon as its approved arrangement is generated + cached), not
      // from an anon Supabase read — RLS keeps SELECT on public.sessions behind
      // an authenticated user, which the kiosk never is.
      for (const token of readySessionsSnapshot()) {
        if (queuedTokens.has(token)) {
          continue;
        }
        if (!(await hasFramedBlob(token))) {
          // framed.png is not generated yet — the next sweep picks it up.
          continue;
        }
        try {
          const job = await api.enqueue({
            token,
            fileName: 'framed.png',
            queueName: printer.queueName,
            copies: printer.copies,
            paperSize: printer.paperSize,
            mediaType: printer.mediaType,
            quality: printer.quality,
            colorMode: printer.colorMode,
          });
          queuedTokens.add(token);
          dropReadySession(token);
          if (printer.printMode === 'auto') {
            autoStart.push(job.id);
          }
        } catch {
          // Transient (queue hiccup) — the next sweep retries.
        }
      }

      if (autoStart.length > 0 && api.startBatch) {
        await api.startBatch(autoStart);
      }
    } catch {
      // Queue unavailable — nothing to do this round.
    } finally {
      autoQueueRunning = false;
    }
  };

  void sweep();
  setInterval(() => void sweep(), AUTO_QUEUE_INTERVAL_MS);
};
