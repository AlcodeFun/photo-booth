/**
 * Two-step gallery upload.
 *
 * 1. createGallerySession() — reserves a session token and returns the gallery
 *    URL immediately, so the booth can show a QR right away.
 * 2. uploadSessionFiles() — pushes the final outputs (framed PNG, originals,
 *    GIF) to that session in the background.
 */
export interface SessionUploadFile {
  blob: Blob;
  name: string;
}

export interface SessionUploadResult {
  token: string;
  sessionUrl: string;
}

/** Random, URL-safe session token generated locally so the QR can render immediately (no server round-trip first). */
export const generateSessionToken = (): string => {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(36)).join('');
};

/**
 * Registers a client-generated token on the gallery (idempotent). Call this to
 * validate a QR that has already been rendered locally, before or alongside the
 * background file upload.
 */
export async function registerGallerySession(endpoint: string, token: string): Promise<SessionUploadResult> {
  const response = await fetch(`${endpoint}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    let detail = `Session register failed with HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') {
        detail = body.error;
      }
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function uploadSessionFiles(
  files: SessionUploadFile[],
  endpoint: string,
  token: string,
): Promise<void> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file.blob, file.name);
  }

  const response = await fetch(`${endpoint}/api/sessions/${token}/files`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    let detail = `Upload failed with HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') {
        detail = body.error;
      }
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }
}

/** Resolves the promise, or rejects after `ms` to avoid indefinite hangs (e.g. an unreachable gallery endpoint). */
export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/** Converts a `data:<mime>;base64,...` URL into a Blob. */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64 = ''] = dataUrl.split(',');
  const mime = /^data:([^;,]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};