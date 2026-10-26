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
 * It never prints: the booth auto-queues the already-generated framed.png
 * (startAutoQueueSync in printQueueSync.ts) once it is ready, and the admin
 * prints from the queue — which is what flips print_status to success/error.
 * Until then the session stays 'ready_to_print'.
 *
 * The requests are carried by tiny JSON files on the gallery (see organize.ts)
 * so the whole channel reuses the existing Worker storage. Tokens are tracked
 * in localStorage so the listener keeps working across renderer reloads and
 * after the booth resets for the next paying customer.
 */
import { useBoothConfig } from '../store/boothConfigStore';
import { useSessionStore } from '../store/sessionStore';
import { GALLERY_URL } from '../config';
import { buildAnimatedOutput, buildArrangedOutputs, LIVE_OUTPUT, prepareArrangement } from './arrangedOutputs';
import { uploadSessionFiles } from '../utils/sessionUpload';
import {
  fileUrl,
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  PRINT_RESULT_FILE,
  readJsonFile,
  readPrintTokens,
  trackPrintToken,
  untrackPrintToken,
  writeJsonFile,
  OrganizeManifest,
  PrintRequestFile,
} from './organize';
import { cacheUploadBlob, sessionFileUrl, updateSessionRecord } from './sessions';

const HANDLED_KEY = 'photo-booth.generated-requests';
const READY_TOKENS_KEY = 'photo-booth.ready-tokens';
const POLL_INTERVAL = 4000;
/** One request may take a while (GIFs), but never block the listener for good. */
const REQUEST_TIMEOUT = 3 * 60 * 1000;
/**
 * GIFs left pending by the organize page (the print already went out) are the
 * phone's to finish while the guest waits; a booth steps in only after this.
 */
const PENDING_GRACE = 2 * 60 * 1000;

const readStringArray = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
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
 * Sessions whose approved arrangement has been generated (framed.png cached to
 * IndexedDB). Persisted in localStorage so it survives renderer reloads; the
 * auto-queue sweep (printQueueSync.ts) consumes it instead of an anon Supabase
 * read — the booth kiosk has no authenticated session, so listing ready sessions
 * through listSessions() returns nothing under RLS.
 */
const writeReadyTokens = (tokens: string[]): void => {
  try {
    localStorage.setItem(READY_TOKENS_KEY, JSON.stringify(tokens.slice(-40)));
  } catch {
    // Non-fatal — the sweep just misses this token.
  }
};

// Always read through localStorage (never an in-memory copy): the sweep runs in
// both the booth and admin windows, and a per-window cache would go stale and
// clobber the other window's registrations on write.
export const registerReadySession = (token: string): void => {
  const tokens = readStringArray(READY_TOKENS_KEY);
  if (!token || tokens.includes(token)) {
    return;
  }
  writeReadyTokens([...tokens, token]);
};

/** Removes a token once its job is in the queue, so it is never auto-enqueued twice. */
export const dropReadySession = (token: string): void => {
  const tokens = readStringArray(READY_TOKENS_KEY);
  if (tokens.includes(token)) {
    writeReadyTokens(tokens.filter((t) => t !== token));
  }
};

export const readySessionsSnapshot = (): string[] => readStringArray(READY_TOKENS_KEY);

/**
 * Rebuilds the arranged framed sheet and the optional GIF/live outputs from a
 * gallery-originated request, then uploads them back to the session so the
 * customer's page and the admin dashboard both show the finished outputs.
 *
 * Unlike the old auto-print listener this never talks to a printer and never
 * flips print_status: the arrange page already set it to 'ready_to_print' and
 * only the booth's auto-queue sweep then the queue moves it to queued/success/
 * error. Writes the print result back so the arrange page can confirm delivery;
 * marks the request handled either way (never re-generates a request).
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

  if (!manifest) {
    await fail('No frame was picked for this session.');
    return;
  }

  try {
    const { outputs } = useBoothConfig.getState();
    const uploads = await buildArrangedOutputs(
      endpoint,
      token,
      manifest,
      slots,
      request.adjustments ?? manifest.adjustments,
      outputs,
    );

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
    // the generated outputs (used by the auto-queue's framed.png gate).
    // print_status stays 'ready_to_print' — the booth auto-queues the job.
    if (ok) {
      const files = uploads.map((file) => ({
        name: file.name,
        uploaded: true,
        size: file.blob.size,
        url: sessionFileUrl(token, file.name) ?? undefined,
      }));
      updateSessionRecord(token, { files });
      // frames are cached + uploaded; hand the session to the auto-queue sweep.
      registerReadySession(token);
    }
    handledAdd(request.requestId);
  } catch (error) {
    await fail(error instanceof Error ? error.message : String(error));
  }
};

/**
 * A request finished by another device (the organize page renders and uploads
 * the outputs itself): cache framed.png locally and hand the session to the
 * auto-queue, exactly like a print generated here. True when done.
 */
const adoptGeneratedPrint = async (token: string, request: PrintRequestFile): Promise<boolean> => {
  if (!GALLERY_URL) return false;
  const result = await readJsonFile<{ requestId?: string; status?: string }>(GALLERY_URL, token, PRINT_RESULT_FILE);
  if (!result || result.requestId !== request.requestId || result.status !== 'ok') {
    // Failed or unrelated result: nothing to print.
    handledAdd(request.requestId);
    return true;
  }
  try {
    const response = await fetch(`${fileUrl(GALLERY_URL, token, 'framed.png')}?ts=${Date.now()}`);
    if (!response.ok) return false;
    await cacheUploadBlob(token, 'framed.png', await response.blob());
    registerReadySession(token);
    handledAdd(request.requestId);
    return true;
  } catch {
    return false;
  }
};

/**
 * The organize page handed the print over but did not upload every GIF (the
 * guest left, or the phone gave up): make the missing ones here and clear
 * pendingOutputs. Never touches the print.
 */
const finishPendingOutputs = async (token: string, request: PrintRequestFile): Promise<void> => {
  const endpoint = GALLERY_URL;
  const pending = request.pendingOutputs ?? [];
  if (!endpoint || pending.length === 0) return;
  const manifest = await readJsonFile<OrganizeManifest>(endpoint, token, ORGANIZE_FILE);
  if (!manifest) {
    await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, { ...request, pendingOutputs: [] });
    return;
  }
  const prepared = await prepareArrangement(
    endpoint,
    token,
    manifest,
    request.slots?.length ? request.slots : manifest.slots,
    request.adjustments ?? manifest.adjustments,
    pending.includes(LIVE_OUTPUT),
  );
  const remaining: string[] = [];
  for (const name of pending) {
    try {
      const file = await buildAnimatedOutput(prepared, name);
      await cacheUploadBlob(token, file.name, file.blob);
      const [result] = await uploadSessionFiles([file], endpoint, token);
      if (!result?.ok) remaining.push(name);
    } catch (error) {
      console.error(`Finishing ${name} failed:`, error);
      remaining.push(name);
    }
  }
  // Whatever still failed is retried after another grace period.
  await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, {
    ...request,
    pendingOutputs: remaining,
    pendingSince: Date.now(),
  });
};

const pollOnce = async () => {
  if (!GALLERY_URL || processing) {
    return;
  }
  const tokens = readPrintTokens();
  for (const token of tokens) {
    const request = await readJsonFile<PrintRequestFile>(GALLERY_URL, token, PRINT_REQUEST_FILE);
    const hasPending = request?.status === 'handled' && (request.pendingOutputs?.length ?? 0) > 0;
    if (request?.status === 'handled' && !handledHas(request.requestId)) {
      // Generated elsewhere (normally the guest's phone): take the print into
      // this booth's queue. Keep tracking if the download failed, to retry,
      // and while GIFs are still pending.
      if ((await adoptGeneratedPrint(token, request)) && !hasPending) untrackPrintToken(token);
      continue;
    }
    if (request && hasPending) {
      // The print is out; the guest's phone is still making the GIFs (or left).
      if (Date.now() - (request.pendingSince ?? request.requestedAt) < PENDING_GRACE) continue;
      const lockKey = `photo-booth.pending-lock.${request.requestId}`;
      try {
        const held = Number(localStorage.getItem(lockKey) ?? 0);
        if (Date.now() - held < REQUEST_TIMEOUT) continue;
        localStorage.setItem(lockKey, String(Date.now()));
      } catch {
        // No storage: worst case both windows make the same GIF.
      }
      processing = true;
      try {
        await Promise.race([
          finishPendingOutputs(token, request),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('Finishing GIFs timed out.')), REQUEST_TIMEOUT),
          ),
        ]);
      } catch (error) {
        console.error('Finishing pending GIFs failed:', error);
      } finally {
        processing = false;
      }
      break;
    }
    if (request && (request.status === 'handled' || handledHas(request.requestId))) {
      // Done here: stop polling it so open sessions keep their place.
      untrackPrintToken(token);
      continue;
    }
    // 'processing' that has stalled (booth closed mid-way) is picked up again.
    const stalled =
      request?.status === 'processing' && Date.now() - (request.processingAt ?? 0) > REQUEST_TIMEOUT + 60_000;
    if (!request || (request.status !== 'requested' && !stalled)) {
      continue;
    }
    // The request stays queued until every slot is filled — the customer may
    // still be arranging. Skipping it here lets a later (complete) request win.
    if (request.slots && request.slots.some((slot) => !slot)) {
      continue;
    }

    // The booth and admin windows share localStorage: a fresh lock means the
    // other window is already rendering this request.
    const lockKey = `photo-booth.print-lock.${request.requestId}`;
    try {
      const held = Number(localStorage.getItem(lockKey) ?? 0);
      if (Date.now() - held < REQUEST_TIMEOUT) continue;
      localStorage.setItem(lockKey, String(Date.now()));
    } catch {
      // No storage: worst case both windows render the same request.
    }

    processing = true;
    // Tell the guest's page a booth has it (it shows "booth not reachable" otherwise).
    await writeJsonFile(GALLERY_URL, token, PRINT_REQUEST_FILE, { ...request, status: 'processing', processingAt: Date.now() });
    try {
      await Promise.race([
        handleRequest(token, request),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('Output generation timed out.')), REQUEST_TIMEOUT),
        ),
      ]);
      untrackPrintToken(token);
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
      untrackPrintToken(token);
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
      trackPrintToken(state.sessionToken);
    }
  });
  const current = useSessionStore.getState().sessionToken;
  if (current) {
    trackPrintToken(current);
  }

  void pollOnce();
  setInterval(() => void pollOnce(), POLL_INTERVAL);
};