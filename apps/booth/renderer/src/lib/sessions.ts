import { requireSupabase } from './supabase';
import { GALLERY_URL } from '../config';

/**
 * Persisted session records (public.sessions) + a small IndexedDB blob cache.
 *
 * The booth inserts a row as soon as a gallery token exists, then patches
 * upload/print status and the per-file upload list as it goes. The admin
 * dashboard reads those rows. Uploaded blobs are mirrored to IndexedDB so the
 * operator can later "reupload" a file that failed without re-running the
 * session on the booth.
 */

export type SessionUploadStatus = 'uploading' | 'success' | 'error';
/** `queued` means the session has a print job waiting in the booth's print
 *  queue; `ready_to_print` is transient — set by the flow-2 organize page when
 *  the customer approves the arrangement, until the booth's auto-queue sweep
 *  enqueues the job (which flips it to `queued`). The queue owns
 *  `queued`/`printing`/`success`/`error` from then on. */
export type SessionPrintStatus = 'printing' | 'ready_to_print' | 'queued' | 'success' | 'error';

/** Which capture flow produced the session. */
export type SessionFlowMode = 'retake' | 'timed' | 'auto';

export interface SessionFileState {
  name: string;
  uploaded: boolean;
  size?: number;
  url?: string;
}

export interface SessionRecord {
  token: string;
  created_at: string;
  upload_status: SessionUploadStatus;
  print_status: SessionPrintStatus;
  download_url: string;
  files: SessionFileState[];
  meta: Record<string, unknown>;
  flow_mode: SessionFlowMode;
  /** Event the session belongs to (null = unassigned). */
  event_id: string | null;
}

const isSessionUploadStatus = (value: unknown): SessionUploadStatus =>
  value === 'success' || value === 'error' ? value : 'uploading';

const isSessionPrintStatus = (value: unknown): SessionPrintStatus =>
  value === 'success' || value === 'error' || value === 'ready_to_print' || value === 'queued'
    ? value
    : 'printing';

const isSessionFlowMode = (value: unknown): SessionFlowMode =>
  value === 'timed' || value === 'auto' ? value : 'retake';

const mapSessionRow = (row: Record<string, unknown>): SessionRecord => ({
  token: String(row.token ?? ''),
  created_at: String(row.created_at ?? new Date().toISOString()),
  upload_status: isSessionUploadStatus(row.upload_status),
  print_status: isSessionPrintStatus(row.print_status),
  download_url: String(row.download_url ?? ''),
  files: Array.isArray(row.files)
    ? (row.files as Array<Record<string, unknown>>).map(
        (file): SessionFileState => ({
          name: String(file.name ?? ''),
          uploaded: Boolean(file.uploaded),
          size: typeof file.size === 'number' ? file.size : undefined,
          url: typeof file.url === 'string' ? file.url : undefined,
        }),
      )
    : [],
  meta: (row.meta ?? {}) as Record<string, unknown>,
  flow_mode: isSessionFlowMode(row.flow_mode),
  event_id: typeof row.event_id === 'string' ? row.event_id : null,
});

/** Session print status values produced by the booth (store/PRINT_QR). */
export type BoothPrintStatus = 'IDLE' | 'PRINTING' | 'QUEUED' | 'READY_TO_PRINT' | 'SUCCESS' | 'ERROR';
/** Session upload status values produced by the booth (store/PRINT_QR). */
export type BoothUploadStatus = 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

/** Existing session → status values used by the booth (store/PRINT_QR). */
export const normalizeUploadStatus = (status: BoothUploadStatus): SessionUploadStatus =>
  status === 'SUCCESS' ? 'success' : status === 'ERROR' ? 'error' : 'uploading';

export const normalizePrintStatus = (status: BoothPrintStatus): SessionPrintStatus =>
  status === 'SUCCESS'
    ? 'success'
    : status === 'ERROR'
      ? 'error'
      : status === 'QUEUED'
        ? 'queued'
        : status === 'READY_TO_PRINT'
          ? 'ready_to_print'
        : 'printing';

const persistGuard = (promise: Promise<unknown>): void => {
  promise.catch((error) => console.warn('[sessions] persist skipped:', error));
};

/** Creates the initial row once a gallery token exists. */
export const createSessionRecord = (
  token: string,
  downloadUrl: string,
  flowMode: SessionFlowMode = 'retake',
  voucherId: string | null = null,
): void => {
  persistGuard(
    (async () => {
      const client = requireSupabase();
      const { error } = await client.from('sessions').insert({
        token,
        created_at: new Date().toISOString(),
        upload_status: 'uploading',
        print_status: 'printing',
        download_url: downloadUrl,
        files: [],
        flow_mode: flowMode,
        ...(voucherId ? { voucher_id: voucherId } : {}),
        meta: { build: 'persist-v3' },
      });
      // 23505 = token already exists (a retried request that already landed).
      // Harmless: the row is there and the later status patches still apply.
      if (error && error.code !== '23505') {
        throw new Error(error.message);
      }
    })(),
  );
};

/** Patches a subset of fields on the row (never clobbers the ones not given). */
export const updateSessionRecord = (
  token: string,
  patch: {
    upload_status?: SessionUploadStatus;
    print_status?: SessionPrintStatus;
    files?: SessionFileState[];
    download_url?: string;
    meta?: Record<string, unknown>;
    flow_mode?: SessionFlowMode;
  },
): void => {
  persistGuard(
    (async () => {
      const client = requireSupabase();
      const { error } = await client
        .from('sessions')
        .update(
          Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Record<string, unknown>,
        )
        .eq('token', token);
      if (error) {
        throw new Error(error.message);
      }
    })(),
  );
};

/** Admin: all session records, newest first. Requires an authenticated session. */
export const listSessions = async (): Promise<SessionRecord[]> => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapSessionRow);
};

export const deleteSessions = async (tokens: string[]): Promise<void> => {
  if (tokens.length === 0) {
    return;
  }
  const client = requireSupabase();
  const { error } = await client.from('sessions').delete().in('token', tokens);
  if (error) {
    throw new Error(error.message);
  }
};

/** Download URL for a stored file (R2 through the gallery worker). */
export const sessionFileUrl = (token: string, name: string): string | null =>
  GALLERY_URL ? `${GALLERY_URL}/d/${token}/${encodeURIComponent(name)}` : null;

export const sessionGalleryUrl = (token: string): string | null =>
  GALLERY_URL ? `${GALLERY_URL}/p/${token}` : null;

// --- IndexedDB blob cache (Source for admin "reupload") ----------------------

const IDB_NAME = 'photo-booth-uploads';
const IDB_STORE = 'blobs';
/** One row per session token: when its blobs were last cached (drives cleanup). */
const IDB_TOKENS = 'tokens';

const openUploadDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
      if (!request.result.objectStoreNames.contains(IDB_TOKENS)) {
        request.result.createObjectStore(IDB_TOKENS, { keyPath: 'token' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openUploadDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    const request = action(tx.objectStore(IDB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    tx.oncomplete = () => db.close();
  });
};

/** Mirrors an uploaded blob locally so a later "reupload" can push it again. */
export const cacheUploadBlob = async (token: string, name: string, blob: Blob): Promise<void> => {
  try {
    const db = await openUploadDb();
    const tx = db.transaction([IDB_STORE, IDB_TOKENS], 'readwrite');
    tx.objectStore(IDB_STORE).put({ key: `${token}/${name}`, name, blob });
    tx.objectStore(IDB_TOKENS).put({ token, cachedAt: Date.now() });
    await txDone(tx);
    db.close();
  } catch (error) {
    console.warn('[sessions] cache write skipped:', error);
  }
};

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

const tokenRange = (token: string) => IDBKeyRange.bound(`${token}/`, `${token}/￿`);

/** Removes every locally cached blob of these sessions (used when sessions are deleted). */
export const deleteUploadedBlobs = async (tokens: string[]): Promise<void> => {
  if (tokens.length === 0) return;
  try {
    const db = await openUploadDb();
    const tx = db.transaction([IDB_STORE, IDB_TOKENS], 'readwrite');
    for (const token of tokens) {
      tx.objectStore(IDB_STORE).delete(tokenRange(token));
      tx.objectStore(IDB_TOKENS).delete(token);
    }
    await txDone(tx);
    db.close();
  } catch (error) {
    console.warn('[sessions] cache delete skipped:', error);
  }
};

/**
 * Drops cached blobs of sessions last cached more than `maxAgeMs` ago, except
 * those `keep` still needs (uploads not finished). Sessions cached before
 * timestamps existed are stamped now, so they age out from today. Returns the
 * number of sessions removed.
 */
export const pruneUploadCache = async (maxAgeMs: number, keep: (token: string) => boolean): Promise<number> => {
  try {
    const db = await openUploadDb();
    const read = db.transaction([IDB_STORE, IDB_TOKENS], 'readonly');
    const keysRequest = read.objectStore(IDB_STORE).getAllKeys();
    const metaRequest = read.objectStore(IDB_TOKENS).getAll();
    await txDone(read);

    const cachedTokens = new Set<string>();
    for (const key of keysRequest.result) {
      const value = String(key);
      const slash = value.indexOf('/');
      if (slash > 0) cachedTokens.add(value.slice(0, slash));
    }
    const cachedAt = new Map<string, number>();
    for (const row of metaRequest.result as { token: string; cachedAt: number }[]) {
      cachedAt.set(row.token, row.cachedAt);
    }

    const now = Date.now();
    const unstamped = [...cachedTokens].filter((token) => !cachedAt.has(token));
    if (unstamped.length > 0) {
      const stamp = db.transaction(IDB_TOKENS, 'readwrite');
      for (const token of unstamped) stamp.objectStore(IDB_TOKENS).put({ token, cachedAt: now });
      await txDone(stamp);
    }
    db.close();

    const stale = [...cachedTokens].filter((token) => {
      const at = cachedAt.get(token);
      return at !== undefined && now - at > maxAgeMs && !keep(token);
    });
    // Metadata rows whose blobs are already gone.
    const orphans = [...cachedAt.keys()].filter((token) => !cachedTokens.has(token));
    await deleteUploadedBlobs([...stale, ...orphans]);
    return stale.length;
  } catch (error) {
    console.warn('[sessions] cache cleanup skipped:', error);
    return 0;
  }
};

export const getUploadedBlob = async (token: string, name: string): Promise<Blob | null> => {
  try {
    const record = await withStore<{ key: string; blob: Blob } | undefined>('readonly', (store) =>
      store.get(`${token}/${name}`),
    );
    return record?.blob ?? null;
  } catch {
    return null;
  }
};

export const hasUploadCache = async (token: string, name: string): Promise<boolean> =>
  (await getUploadedBlob(token, name)) !== null;

/** Lists every cached blob for a session token (used to resume interrupted uploads). */
export const listUploadedBlobs = async (token: string): Promise<{ name: string; blob: Blob }[]> => {
  try {
    const db = await openUploadDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const range = IDBKeyRange.bound(`${token}/`, `${token}/\uffff`);
      const request = store.openCursor(range);
      const out: { name: string; blob: Blob }[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const value = cursor.value as { key: string; name: string; blob: Blob } | undefined;
          if (value) {
            out.push({ name: value.name, blob: value.blob });
          }
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB cursor failed'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
};