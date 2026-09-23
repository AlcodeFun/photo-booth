import { renderGallery } from './gallery';

export interface Env {
  GALLERY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_JWKS_URL: string;
}

const TOKEN_BYTES = 16;
const SESSION_PREFIX = 'sessions/';

function secureToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_');
  return cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned;
}

function guessContentType(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'json':
      return 'application/json; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

const corsHeaders = (): Record<string, string> => ({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
});

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(), ...init.headers },
  });
}

type PutBody = string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream | null;

function putObject(env: Env, token: string, key: string, body: PutBody, contentType: string): Promise<R2Object | null> {
  if (!body) {
    return Promise.resolve(null);
  }
  // Control JSON (organize.json, print-request/result.json) is overwritten by
  // the booth and the gallery page, so it must never be cached immutably.
  const isControl = key.toLowerCase().endsWith('.json');
  const usesJson = isControl || /^application\/json/i.test(contentType);
  return env.GALLERY_BUCKET.put(`${SESSION_PREFIX}${token}/${key}`, body, {
    httpMetadata: {
      contentType: usesJson ? 'application/json; charset=utf-8' : contentType,
      cacheControl: isControl ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
}

async function putSessionMeta(env: Env, token: string): Promise<void> {
  await env.GALLERY_BUCKET.put(`${SESSION_PREFIX}${token}/meta.json`, JSON.stringify({ createdAt: Date.now() }), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Files are written concurrently so a slow/failed object never holds the rest
// of the session hostage; the metadata marker is created alongside, not before.
async function storeFiles(env: Env, token: string, files: File[]): Promise<void> {
  await Promise.all([
    putSessionMeta(env, token),
    ...files.map((file) => putObject(env, token, sanitizeName(file.name), file, file.type || guessContentType(file.name))),
  ]);
}

async function handleCreateSession(request: Request, env: Env, origin: string): Promise<Response> {
  // The booth normally renders its QR immediately using a client-generated
  // token and posts it as JSON so the session can be registered idempotently.
  // For backward compatibility, multipart uploads are still accepted here too.
  let files: File[] = [];
  let clientToken: string | null = null;
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { token?: unknown };
      if (typeof body.token === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(body.token)) {
        clientToken = body.token;
      }
    } catch {
      // fall through with no token — server will generate one
    }
  } else if (contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    } catch {
      files = [];
    }
  }

  const token = clientToken ?? secureToken();
  try {
    if (files.length > 0) {
      await storeFiles(env, token, files);
    } else {
      await putSessionMeta(env, token);
    }
  } catch (error) {
    return json({ error: `R2 write failed: ${String(error)}` }, { status: 500 });
  }

  return json({ token, sessionUrl: `${origin}/p/${token}` }, { status: 201 });
}

async function handleAppendFiles(request: Request, env: Env, token: string): Promise<Response> {
  let files: File[];
  try {
    const form = await request.formData();
    files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  } catch {
    return json({ error: 'Expected multipart/form-data upload' }, { status: 400 });
  }

  if (files.length === 0) {
    return json({ error: 'No files provided' }, { status: 400 });
  }

  try {
    await storeFiles(env, token, files);
  } catch (error) {
    return json({ error: `R2 write failed: ${String(error)}` }, { status: 500 });
  }

  return json({ ok: true }, { status: 201 });
}

/**
 * Single-file upload that streams the request body straight into R2. The booth
 * uses this to push each output (framed PNG, originals, GIF) as its own request
 * so uploads start immediately and failures stay isolated per file.
 */
async function handleStoreSingleFile(request: Request, env: Env, token: string, name: string): Promise<Response> {
  const safeName = sanitizeName(name.split('/').pop() ?? '');
  if (!safeName) {
    return json({ error: 'Missing file name' }, { status: 400 });
  }
  if (!request.body) {
    return json({ error: 'Empty upload body' }, { status: 400 });
  }

  try {
    await Promise.all([
      putSessionMeta(env, token),
      putObject(env, token, safeName, request.body, request.headers.get('content-type') ?? guessContentType(safeName)),
    ]);
  } catch (error) {
    return json({ error: `R2 write failed: ${String(error)}` }, { status: 500 });
  }

  return json({ ok: true }, { status: 201 });
}

async function handleList(env: Env, token: string, origin: string): Promise<Response> {
  const prefix = `${SESSION_PREFIX}${token}/`;
  let listed: R2Objects;
  try {
    listed = await env.GALLERY_BUCKET.list({ prefix });
  } catch (error) {
    return json({ error: `R2 list failed: ${String(error)}` }, { status: 500 });
  }

  const exists = (await env.GALLERY_BUCKET.get(`${prefix}meta.json`)) !== null;
  const fileObjects = listed.objects.filter((object) => !object.key.endsWith('/meta.json'));

  const files = [...fileObjects]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((object) => {
      const name = object.key.slice(prefix.length);
      return { name, size: object.size, url: `${origin}/d/${token}/${name}` };
    });

  return json({ token, exists, files });
}

/** Deletes every object (files + meta marker) belonging to a session. */
async function handleDeleteSession(env: Env, token: string): Promise<Response> {
  const prefix = `${SESSION_PREFIX}${token}/`;
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.GALLERY_BUCKET.list({ prefix, cursor });
      if (listed.objects.length > 0) {
        await env.GALLERY_BUCKET.delete(listed.objects.map((object) => object.key));
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch (error) {
    return json({ error: `R2 delete failed: ${String(error)}` }, { status: 500 });
  }
  return json({ ok: true, deleted: true });
}

async function handleDownload(env: Env, token: string, name: string): Promise<Response> {
  if (!name) {
    return json({ error: 'Missing file name' }, { status: 400 });
  }
  const object = await env.GALLERY_BUCKET.get(`${SESSION_PREFIX}${token}/${name}`);
  if (!object) {
    return json({ error: 'Not found' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-type', object.httpMetadata?.contentType ?? guessContentType(name));
  headers.set('content-disposition', `attachment; filename="${name.replace(/[^\w.-]/g, '_')}"`);
  if (headers.get('cache-control') === null) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }
  // Downloads are fetched cross-origin by the booth (canvas composition needs
  // CORS-clean images) and by the gallery page's JSON control reads.
  const cors = corsHeaders();
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(object.body, { headers, status: 200 });
}

/**
 * Flow-2 arrange hub: the /p/:token gallery page marks the session as
 * ready to print once every frame slot is filled. This patches the Supabase
 * row so the admin dashboard surfaces it as "ready to print" (the booth
 * listener then prints and flips it to 'success'/'error').
 *
 * Uses the publishable (anon) key over the REST API — the anon role is allowed
 * to update sessions by the dedicated RLS policy, and plain fetch keeps the
 * Worker free of the Supabase JS runtime dependency.
 */
async function handleMarkReady(env: Env, token: string): Promise<Response> {
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/sessions?token=eq.${encodeURIComponent(token)}`;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ print_status: 'ready_to_print' }),
    });
    if (response.status === 404) {
      return json({ ok: false, error: 'Session not found' }, { status: 404 });
    }
    if (!response.ok) {
      return json(
        { ok: false, error: `Supabase PATCH failed with HTTP ${response.status}` },
        { status: 502 },
      );
    }
    return json({ ok: true, print_status: 'ready_to_print' });
  } catch (error) {
    return json({ ok: false, error: `Supabase PATCH failed: ${String(error)}` }, { status: 502 });
  }
}

/**
 * Frame-template proxy: serves a single frame_templates row from Supabase by
 * id so the /organize/:token page can resolve the selected frame's template
 * without exposing any Supabase credentials to the browser. Reads go through
 * the anon (publishable) role, which is what the booth renderer already uses
 * for listing frame templates.
 */
async function handleGetFrame(env: Env, id: string): Promise<Response> {
  if (!id) {
    return json({ error: 'Missing frame id' }, { status: 400 });
  }
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/frame_templates?id=eq.${encodeURIComponent(id)}&select=id,name,preview_url,photo_slots,template,templates_by_photo_slots,enabled,sort_order`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (response.status === 404) {
      return json({ error: 'Frame not found' }, { status: 404 });
    }
    if (!response.ok) {
      return json(
        { error: `Supabase fetch failed with HTTP ${response.status}` },
        { status: 502 },
      );
    }
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (!rows || rows.length === 0) {
      return json({ error: 'Frame not found' }, { status: 404 });
    }
    return json(rows[0]);
  } catch (error) {
    return json({ error: `Supabase fetch failed: ${String(error)}` }, { status: 502 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = url.origin;
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Reserve a session (QR-ready) and, optionally, accept bundled outputs.
    if (request.method === 'POST' && pathname === '/api/sessions') {
      return handleCreateSession(request, env, origin);
    }

    // Append final outputs to an existing session (background upload).
    if (request.method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/files')) {
      const token = pathname.slice('/api/sessions/'.length, pathname.length - '/files'.length);
      if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
      }
      return handleAppendFiles(request, env, token);
    }

    // Stream a single file into an existing session: /api/sessions/:token/files/:name
    if (request.method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.includes('/files/')) {
      const rest = pathname.slice('/api/sessions/'.length).split('/');
      const token = rest[0];
      const name = decodeURIComponent(rest.slice(2).join('/'));
      if (!token || !name) {
        return json({ error: 'Bad request' }, { status: 400 });
      }
      return handleStoreSingleFile(request, env, token, name);
    }

    // Customer gallery page.
    if (request.method === 'GET' && pathname.startsWith('/p/')) {
      const token = pathname.slice(3).split('/')[0];
      if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
      }
      return new Response(renderGallery(token), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // Frame-template lookup for the arrange page (Supabase proxy). The arrange
    // UI itself lives on the hosted web app (/organize/:token) and calls this
    // endpoint cross-origin so no Supabase credentials reach the browser.
    if (request.method === 'GET' && pathname.startsWith('/api/frames/')) {
      const id = pathname.slice('/api/frames/'.length).split('/')[0];
      return handleGetFrame(env, id);
    }

    // Flow-2: mark a session as ready to print from the arrange UI. The /p/
    // gallery page calls this when the customer sends a complete frame to the
    // booth printer.
    if (request.method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/ready')) {
      const token = pathname.slice('/api/sessions/'.length, -'/ready'.length);
      if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
      }
      return handleMarkReady(env, token);
    }

    // Delete a session and all of its objects (files + meta marker).
    if (request.method === 'DELETE' && pathname.startsWith('/api/sessions/')) {
      const token = pathname.slice('/api/sessions/'.length).split('/')[0];
      if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
      }
      return handleDeleteSession(env, token);
    }

    // Gallery file list (consumed by the page's fetch).
    if (request.method === 'GET' && pathname.startsWith('/api/sessions/')) {
      const token = pathname.slice('/api/sessions/'.length).split('/')[0];
      if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
      }
      return handleList(env, token, origin);
    }

    // Serve uploaded files directly.
    if (request.method === 'GET' && pathname.startsWith('/d/')) {
      const parts = pathname.slice(3).split('/');
      const token = parts[0];
      const name = parts.slice(1).join('/');
      if (!token || !name) {
        return json({ error: 'Bad request' }, { status: 400 });
      }
      return handleDownload(env, token, name);
    }

    return json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;