import { renderGallery } from './gallery';

export interface Env {
  GALLERY_BUCKET: R2Bucket;
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
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
});

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(), ...init.headers },
  });
}

async function putSessionMeta(env: Env, token: string): Promise<void> {
  await env.GALLERY_BUCKET.put(`${SESSION_PREFIX}${token}/meta.json`, JSON.stringify({ createdAt: Date.now() }), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function storeFiles(env: Env, token: string, files: File[]): Promise<void> {
  const prefix = `${SESSION_PREFIX}${token}/`;
  for (const file of files) {
    const key = `${prefix}${sanitizeName(file.name)}`;
    await env.GALLERY_BUCKET.put(key, file, {
      httpMetadata: {
        contentType: file.type || guessContentType(key),
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }
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
    await putSessionMeta(env, token);
    if (files.length > 0) {
      await storeFiles(env, token, files);
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
    await putSessionMeta(env, token);
    await storeFiles(env, token, files);
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
  return new Response(object.body, { headers, status: 200 });
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