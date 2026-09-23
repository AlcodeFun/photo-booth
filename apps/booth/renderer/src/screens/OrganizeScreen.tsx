import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrameTemplateConfig } from '@photo-booth/types';
import { GALLERY_URL } from '../config';
import {
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  readJsonFile,
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
 * session as ready to print.
 *
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
      if (manifest && manifest.frameId) {
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
      setStatus({ text: 'Ready to print ✦ An attendant will print your framed photo.', kind: 'ok' });
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

  const filled = slots.filter(Boolean).length;
  const allAssigned = filled === slotCount && slotCount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b1055] via-[#7a2b8c] to-[#ff4bb5] pb-20 text-white">
      <div className="mx-auto max-w-5xl px-4 py-7">
        <h1 className="text-center text-3xl font-black tracking-tight">Arrange Your Photos &amp; Print</h1>
        <p className="mx-auto mt-2 max-w-xl text-center opacity-80">
          Pick a frame slot, then tap a photo to place it. When the frame looks right, tap
          &ldquo;Ready to print&rdquo; — we&rsquo;ll handle the rest.
        </p>

        {/* Frame slots */}
        <section className="mt-5 rounded-2xl border-2 border-white/20 bg-white/10 p-4">
          <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] opacity-80">Your frame</h2>
          <p className="mb-3 text-sm opacity-80">Tap a slot, then tap a photo to place it.</p>
          <div className="flex flex-wrap gap-3">
            {template.photoSlots.map((placement, i) => {
              const name = slots[i] ?? null;
              const cls = [
                'relative flex-1 cursor-pointer overflow-hidden rounded-xl border-4 transition-all',
                name ? 'border-[#d9f85a] border-solid bg-white/5' : 'border-dashed border-white/40 bg-white/5',
                pickSlot === i ? 'scale-[1.03] border-[#ff4bb5] shadow-[0_0_0_4px_rgba(255,75,181,0.35)]' : '',
              ].join(' ');
              return (
                <button
                  key={i}
                  type="button"
                  role="button"
                  aria-label={`Frame slot ${i + 1}`}
                  onClick={() => onPickSlot(i)}
                  className={cls}
                  style={{ aspectRatio: `${placement.width} / ${placement.height}` }}
                >
                  <span className="absolute left-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs font-black text-white">
                    {i + 1}
                  </span>
                  {name ? (
                    <img src={fileUrl(name)} alt={`Slot ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center p-2 text-center text-[0.7rem] font-extrabold uppercase tracking-wider opacity-70">
                      Slot {i + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 min-h-[1.2rem] text-sm opacity-80">
            {pickSlot != null ? `Tap a photo for slot ${pickSlot + 1} …` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={autoPlace} className="rounded-full bg-[#ff4bb5] px-4 py-2 text-sm font-black">
              Auto-place
            </button>
            <button onClick={clearFrame} className="rounded-full bg-white/15 px-4 py-2 text-sm font-black">
              Clear frame
            </button>
            {status.text && (
              <span className={`ml-auto text-sm font-extrabold ${status.kind === 'ok' ? 'text-[#d9f85a]' : status.kind === 'err' ? 'text-[#ffd0e8]' : 'opacity-90'}`}>
                {status.text}
              </span>
            )}
          </div>
        </section>

        {/* Raw photos */}
        <section className="mt-5 rounded-2xl border-2 border-white/20 bg-white/10 p-4">
          <h2 className="mb-1 text-xs font-extrabold uppercase tracking-[0.22em] opacity-80">All photos</h2>
          <p className="mb-3 text-sm opacity-80">
            You can also select photos, then Auto-place will use them first.
          </p>
          <div className="columns-3 gap-3 [column-fill:balance] sm:columns-4">
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
                className={`relative mb-3 block w-full overflow-hidden border-4 transition-colors ${
                  selected.has(i) ? 'border-[#ff4bb5] opacity-90' : 'border-transparent'
                }`}
              >
                {selected.has(i) && (
                  <span className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#ff4bb5] text-xs font-black">
                    ✓
                  </span>
                )}
                <img src={item.url} alt={`Photo ${i + 1}`} loading="lazy" className="block w-full" />
              </button>
            ))}
          </div>
          <div className="mt-2">
            <button onClick={selectAllToggle} className="rounded-full bg-white/15 px-4 py-2 text-sm font-black">
              {selected.size > 0 ? 'Clear selection' : 'Select all'}
            </button>
          </div>
        </section>

        <div className="mt-4 flex justify-center">
          <button
            id="organize-send"
            disabled={!allAssigned || sent}
            onClick={() => void sendToPrint()}
            className={`rounded-full px-8 py-4 text-xl font-black uppercase tracking-wide transition-all ${
              allAssigned && !sent
                ? 'bg-[#ff4bb5] shadow-[0_6px_18px_rgba(0,0,0,0.35)] hover:scale-[1.02]'
                : 'cursor-not-allowed bg-white/20 opacity-50'
            }`}
          >
            {sent ? 'Sent ✓' : 'Ready to print'}
          </button>
        </div>
        {!allAssigned && !sent && (
          <p className="mt-3 text-center text-sm opacity-75">
            Fill every frame slot to enable sending ({filled}/{slotCount}).
          </p>
        )}
      </div>
    </div>
  );
};

export default OrganizeScreen;