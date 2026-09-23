import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrameTemplateConfig } from '@photo-booth/types';
import { GALLERY_URL } from '../config';
import FrameCanvas from '../components/FrameCanvas';
import {
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  readJsonFile,
  sessionUrl,
  writeJsonFile,
  OrganizeManifest,
} from '../lib/organize';

/**
 * Flow-2 arrange page, hosted by the Vercel app at /organize/:token.
 *
 * It is the customer's "organize your frame" screen: loads every raw photo
 * from R2 (through the gallery worker), pulls the session's selected frame
 * template from Supabase (via the worker's /api/frames/:id proxy), lets the
 * customer assign photos to frame slots, then — on finish — only marks the
 * session as ready to print and abandons itself.
 *
 * The frame is presented with the same FrameCanvas used by the admin
 * FrameCanvasEditor, so the customer sees the exact composed sheet.
 *
 * This page is disposable: after "Ready to print" succeeds it auto-redirects
 * to the gallery page on the worker (/p/:token) which shows all the outputs.
 * There is no LAN server: the page is served by the hosted web app, raws come
 * from R2 and the frame config comes from Supabase, so the phone only needs
 * internet (the same precondition as the QR already points to).
 *
 * Printing is done manually by the admin from the booth dashboard; this page
 * never talks to a printer.
 */
export const OrganizeScreen: React.FC<{ token: string }> = ({ token }) => {
  const endpoint = GALLERY_URL;

  const [phase, setPhase] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [organize, setOrganize] = useState<OrganizeManifest | null>(null);
  const [template, setTemplate] = useState<FrameTemplateConfig | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'err' }>({ text: '' });
  const arrangeRetries = useRef(0);

  const slotCount = useMemo(() => {
    if (template) return template.photoSlots.length;
    return organize ? Math.max(1, Math.floor(organize.slotCount || 1)) : 0;
  }, [template, organize]);

  const fileUrl = useCallback(
    (name: string) => {
      const found = files.find((file) => file.name === name);
      return found
        ? found.url
        : endpoint
          ? `${endpoint}/d/${token}/${encodeURIComponent(name)}`
          : '';
    },
    [files, endpoint, token],
  );

  const loadFrame = useCallback(
    async (manifest: OrganizeManifest): Promise<FrameTemplateConfig | null> => {
      // The manifest normally embeds the resolved template; the proxy only adds
      // a fresher copy. If the Supabase lookup is unavailable (404/stale frame
      // id), fall back to the embedded template so the arrange UI still works.
      if (manifest.template) return manifest.template;
      if (!manifest.frameId || !endpoint) return null;
      try {
        const response = await fetch(`${endpoint}/api/frames/${encodeURIComponent(manifest.frameId)}`);
        if (!response.ok) return null;
        const frame = (await response.json()) as {
          id: string;
          photo_slots?: number | null;
          template?: FrameTemplateConfig | null;
          templates_by_photo_slots?: Record<string, FrameTemplateConfig> | null;
        };
        if (!frame || !frame.id) return null;
        const capacity = Math.max(1, Math.floor(manifest.slotCount || frame.photo_slots || 1));
        const byCount =
          frame.templates_by_photo_slots &&
          (frame.templates_by_photo_slots[String(capacity)] ??
            frame.templates_by_photo_slots[String(frame.photo_slots ?? capacity)] ??
            frame.templates_by_photo_slots[capacity]);
        return byCount || frame.template || manifest.template || null;
      } catch {
        return null;
      }
    },
    [endpoint],
  );

  const load = useCallback(async () => {
    if (!endpoint) {
      setError('Gallery is not configured. Please open this session later.');
      setPhase('missing');
      return;
    }
    try {
      const response = await fetch(`${endpoint}/api/sessions/${encodeURIComponent(token)}`);
      const data = (await response.json()) as {
        files?: Array<{ name: string; url: string }>;
        exists?: boolean;
      };
      if (!response.ok || !data.files) throw new Error('empty');
      if (data.exists === false) {
        setPhase('missing');
        return;
      }
      const photoFiles = (data.files ?? []).filter((file) => {
        const name = file.name;
        if (/(^|\/)(meta|organize|print-request|print-result)[.]json$/i.test(name)) return false;
        return /[.](jpe?g|png)$/i.test(name) && !/framed[.]png$/i.test(name);
      });
      if (photoFiles.length === 0) {
        // Raws may still be uploading — retry a short while.
        if (arrangeRetries.current < 90) {
          arrangeRetries.current += 1;
          setTimeout(() => void load(), 5000);
        }
        return;
      }
      setFiles(data.files ?? []);
      setPhotos(photoFiles);

      const manifest = await readJsonFile<OrganizeManifest>(endpoint, token, ORGANIZE_FILE);
      if (manifest) {
        const resolved = await loadFrame(manifest);
        if (resolved) {
          setOrganize(manifest);
          setTemplate(resolved);
          const n = Math.max(1, resolved.photoSlots.length);
          setSlots(() => {
            const next = (manifest.slots ?? []).slice();
            while (next.length < n) next.push(null);
            for (let i = 0; i < n; i += 1) {
              if (next[i] == null && photoFiles[i]) next[i] = photoFiles[i].name;
            }
            return next;
          });
          arrangeRetries.current = 0;
          setPhase('ready');
          return;
        }
      }

      // arrange data (organize.json + frame) may land a little after the raws —
      // keep retrying a while; once it is there, the arrange UI pops in.
      if (arrangeRetries.current < 90) {
        arrangeRetries.current += 1;
        setTimeout(() => void load(), 5000);
      } else {
        setError('Your photos are ready. Please ask an attendant for help arranging your frame.');
        setPhase('missing');
      }
    } catch {
      setError('We could not find this session. It may have expired.');
      setPhase('missing');
    }
  }, [endpoint, token, loadFrame]);

  useEffect(() => {
    void load();
  }, []);

  const repaintSlots = useCallback((nextSlots: (string | null)[]) => {
    setSlots(nextSlots);
  }, []);

  const onPickSlot = (i: number) => {
    if (slots[i] != null) {
      const next = [...slots];
      next[i] = null;
      repaintSlots(next);
      setPickSlot(null);
      return;
    }
    setPickSlot((prev) => (prev === i ? null : i));
  };

  const toggleSel = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const selectAllToggle = () => {
    if (selected.size > 0) setSelected(new Set());
    else setSelected(new Set(photos.map((_, i) => i)));
  };

  const autoPlace = () => {
    const used = new Set(slots.filter(Boolean));
    const pool: string[] = [];
    photos.forEach((item, i) => {
      if (selected.has(i) && !used.has(item.name)) {
        pool.push(item.name);
        used.add(item.name);
      }
    });
    if (pool.length === 0) {
      photos.forEach((item) => {
        if (!used.has(item.name)) {
          pool.push(item.name);
          used.add(item.name);
        }
      });
    }
    const next = [...slots];
    for (let i = 0; i < next.length && pool.length; i += 1) {
      if (next[i] == null) next[i] = pool.shift() ?? null;
    }
    setSelected(new Set());
    repaintSlots(next);
  };

  const clearFrame = () => {
    repaintSlots(Array.from({ length: slotCount }, () => null));
    setPickSlot(null);
  };

  const saveSlots = async (): Promise<boolean> => {
    if (!organize || !endpoint) return false;
    const manifest = { ...organize, slots: slots.slice() };
    const ok = await writeJsonFile(endpoint, token, ORGANIZE_FILE, manifest);
    if (ok) setOrganize(manifest);
    return ok;
  };

  const sendToPrint = async () => {
    if (sent || !endpoint) return;
    setSent(true);
    setStatus({ text: 'Sending your frame …' });
    try {
      if (!(await saveSlots())) throw new Error('organize save failed');
      const reqId =
        'req_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2));
      const payload = {
        requestId: reqId,
        requestedAt: Date.now(),
        slots: slots.slice(),
        by: 'organize',
        status: 'requested' as const,
      };
      if (!(await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, payload))) {
        throw new Error('print request failed');
      }
      // The ONLY status change this page makes: print_status -> ready_to_print.
      // The booth generates the framed outputs; the admin prints them manually.
      await fetch(`${endpoint}/api/sessions/${encodeURIComponent(token)}/ready`, {
        method: 'POST',
      }).catch(() => {});
      // This page is disposable: after the arrange is submitted, hand the
      // customer off to the worker gallery page which shows all the outputs.
      setStatus({ text: 'Ready to print ✦ Opening your photos…', kind: 'ok' });
      window.setTimeout(() => window.location.assign(sessionUrl(endpoint, token)), 1200);
    } catch {
      setSent(false);
      setStatus({ text: 'Could not send. Try again.', kind: 'err' });
    }
  };

  if (phase === 'missing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2b1055] p-6 text-center text-white">
        <p className="text-lg font-bold opacity-90">
          {error ?? 'We could not find this session. It may have expired.'}
        </p>
      </div>
    );
  }

  if (phase === 'loading' || !template) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2b1055] text-white">
        <p className="animate-pulse text-lg font-black uppercase tracking-widest opacity-80">
          Loading your photos…
        </p>
      </div>
    );
  }

  // FrameCanvas maps each photo by sourcePhotoSlot, but the arrange manifest
  // assigns one photo per frame slot. Force every area to read its own slot
  // position so the canvas shows exactly what each slot holds.
  const displayTemplate = useMemo(
    () => ({
      ...template,
      photoSlots: template.photoSlots.map((slot, i) => ({ ...slot, sourcePhotoSlot: i + 1 })),
    }),
    [template],
  );

  const previewPhotos = useMemo(
    () => template.photoSlots.map((_, i) => (slots[i] ? fileUrl(slots[i]) : undefined)),
    [template, slots, fileUrl],
  );

  const filled = slots.filter(Boolean).length;
  const allAssigned = filled === slotCount && slotCount > 0;

  return (
    <div className="min-h-screen bg-[#fbf3ff] pb-32 text-[#4d2d85]">
      <div className="mx-auto max-w-5xl px-4 py-7">
        <h1 className="text-center text-3xl font-black tracking-tight text-[#4d2d85]">
          Arrange Your Photos &amp; Print
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm font-bold text-[#7a4de3]">
          Tap a frame slot, then tap a photo to place it. When the frame looks good, tap
          &ldquo;Ready to print&rdquo; — we&rsquo;ll handle the rest.
        </p>

        {/* Frame canvas — same presentation as the admin FrameCanvasEditor */}
        <section className="mt-6 overflow-hidden rounded-[18px] border-[3px] border-[#e5c9ff] bg-white shadow-[0_16px_48px_rgba(77,45,133,0.18)]">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#e5c9ff] bg-[#fbf3ff] px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[#4d2d85]">Your frame</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={autoPlace}
                className="rounded-full border-[3px] border-[#a35ef6] bg-[#d9f85a] px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#4d2d85] transition hover:bg-[#e9ff9e]"
              >
                Auto-place
              </button>
              <button
                type="button"
                onClick={clearFrame}
                className="rounded-full border-[3px] border-[#c9b8ff] bg-white px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition hover:bg-[#efe8ff]"
              >
                Clear frame
              </button>
            </div>
          </header>

          <div
            className="flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'linear-gradient(180deg, #fbf3ff, #f3ecff)' }}
          >
            <div className="w-full max-w-[440px]">
              <FrameCanvas
                template={displayTemplate}
                photos={previewPhotos}
                onSlotSelect={(slotNumber) => {
                  const i = displayTemplate.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber);
                  if (i >= 0) onPickSlot(i);
                }}
                activeSlotNumber={pickSlot != null ? displayTemplate.photoSlots[pickSlot]?.slotNumber : undefined}
                showGuides
                className="w-full !border-0 rounded-[14px] shadow-[0_20px_50px_rgba(77,45,133,0.35)]"
              />
            </div>
          </div>

          <footer className="border-t-2 border-[#e5c9ff] bg-[#fbf3ff] px-4 py-3">
            <p className="text-sm font-bold text-[#7a4de3]">
              {pickSlot != null
                ? `Slot ${pickSlot + 1} selected — tap a photo below to place it.`
                : 'Tap a slot in the frame above, then tap a photo to place it.'}
            </p>
          </footer>
        </section>

        {/* Raw photos */}
        <section className="mt-6 rounded-[18px] border-[3px] border-[#e5c9ff] bg-white p-4 shadow-[0_16px_48px_rgba(77,45,133,0.18)]">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[#4d2d85]">All photos</h2>
            <button
              type="button"
              onClick={selectAllToggle}
              className="rounded-full border-[3px] border-[#c9b8ff] bg-white px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition hover:bg-[#efe8ff]"
            >
              {selected.size > 0 ? 'Clear selection' : 'Select all'}
            </button>
          </header>
          <p className="mt-2 mb-3 text-sm font-bold text-[#7a4de3]">
            Selected photos are used first by Auto-place.
          </p>
          <div className="columns-2 gap-3 [column-fill:balance] sm:columns-3">
            {photos.map((item, i) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  if (pickSlot != null) {
                    const next = [...slots];
                    next[pickSlot] = item.name;
                    repaintSlots(next);
                    setPickSlot(null);
                    return;
                  }
                  toggleSel(i);
                }}
                className={`relative mb-3 block w-full overflow-hidden rounded-[10px] border-4 transition-colors ${
                  selected.has(i) ? 'border-[#ff4bb5] opacity-90' : 'border-transparent'
                }`}
              >
                {selected.has(i) && (
                  <span className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#ff4bb5] text-xs font-black text-white">
                    ✓
                  </span>
                )}
                <img src={item.url} alt={`Photo ${i + 1}`} loading="lazy" className="block w-full" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky send bar */}
      <div className="fixed inset-x-0 bottom-0 z-[120] border-t-[3px] border-[#a35ef6] bg-[#fbf3ff]/95 shadow-[0_-12px_30px_rgba(77,45,133,0.2)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#4d2d85]">
              Fill every frame slot to enable sending ({filled}/{slotCount}).
            </p>
            {status.text && (
              <p
                className={`text-sm font-extrabold ${
                  status.kind === 'ok'
                    ? 'text-[#15803d]'
                    : status.kind === 'err'
                      ? 'text-[#b3206e]'
                      : 'text-[#7a4de3]'
                }`}
              >
                {status.text}
              </p>
            )}
          </div>
          <button
            type="button"
            id="organize-send"
            disabled={!allAssigned || sent}
            onClick={() => void sendToPrint()}
            className={`rounded-full border-[3px] px-8 py-4 text-xl font-black uppercase tracking-wide transition-all ${
              allAssigned && !sent
                ? 'border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] shadow-[0_6px_18px_rgba(77,45,133,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                : 'cursor-not-allowed border-[#c9b8ff] bg-white opacity-50'
            }`}
          >
            {sent ? 'Sending…' : 'Ready to print'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizeScreen;