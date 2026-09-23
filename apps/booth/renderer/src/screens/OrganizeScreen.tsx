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
 * The layout mirrors the admin FrameCanvasEditor: a full-height canvas area
 * with the FrameCanvas scaled to fit, a desktop floating photo panel, and a
 * mobile bottom dock + bottom sheet. The customer taps a slot on the canvas,
 * then a photo to place it.
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

const actionButtonClass = (extra: string) =>
  `h-9 rounded-[10px] border-[3px] px-3.5 text-xs font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 ${extra}`;

const dockButtonClass = (active: boolean) =>
  `flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-black uppercase tracking-[0.08em] transition-colors ${
    active ? 'bg-[#e9d7ff] text-[#4d2d85]' : 'text-[#7a4de3] hover:bg-[#f3ecff]'
  }`;

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const arrangeRetries = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

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

  // Scale the canvas to fit its container while keeping the frame's aspect
  // ratio — same fit logic as the admin FrameCanvasEditor.
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !template) {
      return;
    }
    const computeFit = () => {
      const rect = area.getBoundingClientRect();
      const style = window.getComputedStyle(area);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = Math.max(0, rect.width - padX);
      const availableHeight = Math.max(0, rect.height - padY);
      const widthScale = template.width > 0 ? availableWidth / template.width : 0;
      const heightScale = template.height > 0 ? availableHeight / template.height : 0;
      const scale = Math.max(0, Math.min(widthScale, heightScale));
      setCanvasSize({
        width: availableWidth > 0 && availableHeight > 0 ? Math.floor(template.width * scale) : 0,
        height: availableWidth > 0 && availableHeight > 0 ? Math.floor(template.height * scale) : 0,
      });
    };
    computeFit();
    const observer = new ResizeObserver(computeFit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [template]);

  const repaintSlots = useCallback((nextSlots: (string | null)[]) => {
    setSlots(nextSlots);
  }, []);

  // FrameCanvas maps each photo by sourcePhotoSlot, but the arrange manifest
  // assigns one photo per frame slot. Force every area to read its own slot
  // position so the canvas shows exactly what each slot holds.
  const displayTemplate = useMemo(
    () =>
      template
        ? {
            ...template,
            photoSlots: template.photoSlots.map((slot, i) => ({ ...slot, sourcePhotoSlot: i + 1 })),
          }
        : null,
    [template],
  );

  const previewPhotos = useMemo(
    () =>
      template ? template.photoSlots.map((_, i) => (slots[i] ? fileUrl(slots[i]) : undefined)) : [],
    [template, slots, fileUrl],
  );

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

  if (phase === 'loading' || !template || !displayTemplate) {
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
  const sendReady = allAssigned && !sent;

  const sendButtonClass =
    'rounded-full border-[3px] px-6 py-3 text-sm font-black uppercase tracking-wide transition-all ' +
    (sendReady
      ? 'border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] shadow-[0_6px_18px_rgba(77,45,133,0.4)] hover:scale-[1.02] active:scale-[0.98]'
      : 'cursor-not-allowed border-[#c9b8ff] bg-white opacity-50');

  const photosPanel = (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={autoPlace}
          className={actionButtonClass('border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] hover:bg-[#e9ff9e]')}
        >
          Auto-place
        </button>
        <button
          type="button"
          onClick={clearFrame}
          className={actionButtonClass('border-[#c9b8ff] bg-white text-[#5b3aa8] hover:bg-[#efe8ff]')}
        >
          Clear frame
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[#5b3aa8]">
          {selected.size} of {photos.length} selected
        </span>
        <button
          type="button"
          onClick={selectAllToggle}
          className={actionButtonClass('border-[#8f6fee] bg-white text-[#5b3aa8] hover:bg-[#efe8ff]')}
        >
          {selected.size > 0 ? 'Clear all' : 'Select all'}
        </button>
      </div>
      {photos.length > 0 ? (
        <div className="columns-2 gap-3 [column-fill:balance]">
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
      ) : (
        <p className="text-sm font-bold text-[#5b3aa8]">No photos yet.</p>
      )}
    </div>
  );

  return (
    <section className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#fbf3ff] text-[#4d2d85]">
      {/* Top bar */}
      <header className="z-[60] flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#e5c9ff] bg-[#fbf3ff] px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
            Arrange &amp; print
          </h1>
          <p className="truncate text-xs font-bold text-[#7a4de3]">
            {pickSlot != null
              ? `Slot ${pickSlot + 1} selected — tap a photo to place it.`
              : 'Tap a slot on the frame, then tap a photo.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border-2 px-3 py-1 text-xs font-black ${
              allAssigned
                ? 'border-[#16a34a] bg-[#e7ffe7] text-[#15803d]'
                : 'border-[#c9b8ff] bg-white text-[#5b3aa8]'
            }`}
          >
            {filled}/{slotCount}
          </span>
          {status.text && (
            <span
              className={`hidden text-xs font-extrabold sm:inline ${
                status.kind === 'ok'
                  ? 'text-[#15803d]'
                  : status.kind === 'err'
                    ? 'text-[#b3206e]'
                    : 'text-[#7a4de3]'
              }`}
            >
              {status.text}
            </span>
          )}
        </div>
      </header>

      {/* Canvas area — fills the full width, same as FrameCanvasEditor */}
      <div
        className={`flex min-h-0 flex-1 transition-opacity ${panelOpen ? 'opacity-60' : ''}`}
      >
        <div
          ref={areaRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-visible p-4 pb-20 lg:p-6 lg:pb-6"
        >
          <div className="absolute left-4 top-4 z-[80]">
            <span className="grid h-10 max-w-[72vw] place-items-center rounded-full border-2 border-[#c9b8ff] bg-white/95 px-4 text-xs font-black text-[#5b3aa8] shadow-md">
              {pickSlot != null ? `Slot ${pickSlot + 1} selected` : 'Tap a slot to select it'}
            </span>
          </div>

          <div
            className="relative touch-none bg-white shadow-[0_20px_50px_rgba(77,45,133,0.35)]"
            style={{
              width: canvasSize ? `${canvasSize.width}px` : undefined,
              height: canvasSize ? `${canvasSize.height}px` : undefined,
              aspectRatio: canvasSize ? undefined : `${template.width} / ${template.height}`,
            }}
          >
            <FrameCanvas
              template={displayTemplate}
              photos={previewPhotos}
              onSlotSelect={(slotNumber) => {
                const i = displayTemplate.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber);
                if (i >= 0) onPickSlot(i);
              }}
              activeSlotNumber={pickSlot != null ? displayTemplate.photoSlots[pickSlot]?.slotNumber : undefined}
              showGuides
              className="h-full w-full !border-0 !text-[#4d2d85]"
            />
          </div>

          {/* Re-open collapsed floating panel */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              title="Show photos"
              className="absolute right-3 top-1/2 z-[85] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border-2 border-[#8f6fee] bg-white/95 text-[#4d2d85] shadow-lg transition hover:bg-white lg:grid"
            >
              ✛
            </button>
          )}
        </div>

        {/* Desktop floating panel — photo picker + actions */}
        <aside
          className={`pointer-events-auto absolute right-3 top-1/2 z-[90] hidden max-h-[calc(100%-24px)] w-[380px] max-w-[calc(100%-24px)] -translate-y-1/2 flex-col overflow-hidden rounded-[14px] border-[3px] border-[#a35ef6] bg-[#fbf3ff] shadow-[0_16px_48px_rgba(77,45,133,0.35)] transition-all duration-200 lg:flex ${
            sidebarOpen
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-[110%] opacity-0'
          }`}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#e5c9ff] px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">All photos</h2>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Collapse photos"
              className="grid h-9 w-9 place-items-center rounded-[10px] border-[3px] border-[#c9b8ff] bg-white text-[#5b3aa8] transition hover:bg-[#efe8ff]"
            >
              ›
            </button>
          </header>
          <div className="pb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">{photosPanel}</div>
          <footer className="border-t-2 border-[#e5c9ff] bg-[#fbf3ff] px-4 py-3">
            <button
              type="button"
              onClick={() => void sendToPrint()}
              disabled={!allAssigned || sent}
              className={`w-full ${sendButtonClass}`}
            >
              {sent ? 'Sending…' : 'Ready to print'}
            </button>
            {status.text && (
              <p
                className={`mt-2 text-center text-xs font-extrabold ${
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
          </footer>
        </aside>
      </div>

      {/* Mobile bottom dock */}
      <div className="absolute inset-x-0 bottom-0 z-[120] border-t-2 border-[#c9b8ff] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-stretch gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => setPanelOpen((current) => !current)}
            title="Photos"
            className={dockButtonClass(panelOpen)}
          >
            <span className="text-[0.85rem] leading-none">▦</span>
            Photos
          </button>
          <button type="button" onClick={autoPlace} title="Auto-place photos into slots" className={dockButtonClass(false)}>
            <span className="text-[0.85rem] leading-none">⟳</span>
            Auto
          </button>
          <button type="button" onClick={clearFrame} title="Clear the frame" className={dockButtonClass(false)}>
            <span className="text-[0.85rem] leading-none">✕</span>
            Clear
          </button>
          <button
            type="button"
            id="organize-send"
            disabled={!allAssigned || sent}
            onClick={() => void sendToPrint()}
            className={`flex h-full min-w-0 flex-[1.8] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-black uppercase tracking-[0.08em] transition-colors ${
              sendReady
                ? 'border-[3px] border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] shadow-[0_0_0_3px_rgba(163,94,246,0.15)]'
                : 'cursor-not-allowed border-[3px] border-[#c9b8ff] bg-white text-[#a29ac0] opacity-70'
            }`}
          >
            <span className="text-[0.85rem] leading-none">»</span>
            {sent ? 'Sending…' : 'Ready to print'}
          </button>
        </div>
      </div>

      {/* Mobile bottom sheet — photo picker */}
      <div
        className={`absolute inset-x-0 bottom-14 z-[110] flex max-h-[60vh] flex-col overflow-hidden rounded-t-[18px] border-t-[3px] border-[#a35ef6] bg-[#fbf3ff] shadow-[0_-12px_40px_rgba(77,45,133,0.25)] transition-transform duration-300 ease-out lg:hidden ${
          panelOpen ? 'translate-y-0' : 'pointer-events-none translate-y-[calc(100%+3.5rem)]'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#e5c9ff] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">All photos</h2>
            {status.text && (
              <span
                className={`text-xs font-extrabold ${
                  status.kind === 'ok'
                    ? 'text-[#15803d]'
                    : status.kind === 'err'
                      ? 'text-[#b3206e]'
                      : 'text-[#7a4de3]'
                }`}
              >
                {status.text}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="rounded-full border-2 border-[#c9b8ff] bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8]"
          >
            Close
          </button>
        </header>
        <div className="pb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {photosPanel}
        </div>
      </div>
    </section>
  );
};

export default OrganizeScreen;