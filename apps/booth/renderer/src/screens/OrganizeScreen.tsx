import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FrameConfig, FrameTemplateConfig } from '@photo-booth/types';
import { GALLERY_URL } from '../config';
import FrameCanvas from '../components/FrameCanvas';
import { usePhotoGestures } from '../components/booth/usePhotoGestures';
import {
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  PRINT_RESULT_FILE,
  readJsonFile,
  sessionUrl,
  writeJsonFile,
  type OrganizeManifest,
  type OrganizePhotoAdjustment,
  type OrganizePhotoTransform,
  type PrintRequestFile,
  photoIndexFromName,
} from '../lib/organize';
import { resolveFrameTemplate, resolveObjectPosition } from '../utils/frameConfig';
import { listFrameTemplates } from '../lib/frames';
import { FILTERS, getCanvasFilter } from '../utils/filters';
import { applyPhotoTransform, isIdentityTransform } from '../utils/photoTransform';
import { listActiveGifFrames } from '../lib/gifFrames';
import { GifPreview, type EffectsGifFrame } from '../components/booth/EffectsView';
import { useBoothAppearance } from '../store/appearanceStore';
import { clampGifAdjust, DEFAULT_GIF_ADJUST, isDefaultGifAdjust, type GifAdjust } from '../utils/gifAdjust';

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const transformKey = (name: string, t: OrganizePhotoTransform) => `${name}|${t.rotate}|${t.flip ? 1 : 0}`;

/**
 * Timed flow: the guest picks the frame here (the booth no longer asks).
 * Every frame is previewed with the guest's own photos.
 */
const FramePicker: React.FC<{
  frames: FrameConfig[] | null;
  photoUrls: string[];
  onPick: (frame: FrameConfig) => void;
  onClose?: () => void;
}> = ({ frames, photoUrls, onPick, onClose }) => (
  <section className="flex h-[100dvh] flex-col overflow-hidden bg-pbx-paper text-pbx-ink">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-pbx-line px-4 py-3">
      <div>
        <h1 className="text-sm font-black uppercase tracking-[0.18em]">Pilih Bingkai</h1>
        <p className="text-xs font-bold text-pbx-secondary-strong">Pilih bingkai, lalu isi setiap slot dengan fotomu</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-pbx-line bg-white text-lg font-black text-pbx-secondary-strong"
        >
          ×
        </button>
      )}
    </header>
    <div className="pb-scroll min-h-0 flex-1 overflow-y-auto p-4">
      {frames === null ? (
        <p className="py-16 text-center text-sm font-black uppercase tracking-widest opacity-60">Memuat bingkai…</p>
      ) : frames.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold opacity-70">Belum ada bingkai. Minta bantuan petugas ya.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {frames.map((frame) => {
            const template = resolveFrameTemplate(frame, Math.max(1, Math.floor(frame.photoSlots ?? 3)));
            const photos = template.photoSlots.map((slot) => photoUrls[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1]);
            return (
              <button
                key={frame.id}
                type="button"
                onClick={() => onPick(frame)}
                className="flex flex-col gap-2 rounded-[14px] border-[3px] border-pbx-line bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-pbx-brand hover:shadow-md"
              >
                <FrameCanvas template={template} photos={photos} photoSlotCount={template.photoSlots.length} className="w-full !border-0" />
                <span className="truncate px-1 text-center text-xs font-black uppercase">{frame.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  </section>
);

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
 * The page keeps the customer in place: every "Ready to print" persists the
 * arrangement (organize.json) and queues a new print request, and the customer
 * may change the frame and send again as many times as they like. A "View
 * photos" button opens the worker gallery (/p/:token) in a new tab so the
 * arrange page is never disposed.
 *
 * This page is disposable: after "Ready to print" succeeds it waits for the
 * booth to generate AND upload every output for the arrangement (the booth
 * writes print-result.json and marks the request 'handled' only after all the
 * framed/GIF files are on the gallery), then auto-redirects to the worker
 * gallery (/p/:token) so the album is already complete on arrival. Arranging
 * is one-shot: if the page is loaded again once a request exists (done or
 * still in flight) it hands off to the gallery instead of showing the arrange
 * UI again.
 *
 * There is no LAN server: the page is served by the hosted web app, raws come
 * from R2 and the frame config comes from Supabase, so the phone only needs
 * internet (the same precondition as the QR already points to).
 *
 * Printing is done manually by the admin from the booth dashboard; this page
 * never talks to a printer.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialAdjustment = (
  template: FrameTemplateConfig,
  index: number,
  saved?: OrganizePhotoAdjustment,
): OrganizePhotoAdjustment => {
  const position = resolveObjectPosition(template.photoSlots[index]?.objectPosition);
  return {
    x: Number.isFinite(saved?.x) ? clamp(saved!.x, 0, 1) : position.x,
    y: Number.isFinite(saved?.y) ? clamp(saved!.y, 0, 1) : position.y,
    scale: Number.isFinite(saved?.scale) ? clamp(saved!.scale, 1, 3) : 1,
    offsetX: Number.isFinite(saved?.offsetX) ? saved!.offsetX : 0,
    offsetY: Number.isFinite(saved?.offsetY) ? saved!.offsetY : 0,
  };
};

export const OrganizeScreen: React.FC<{ token: string }> = ({ token }) => {
  const endpoint = GALLERY_URL;
  // The theme saved in the dashboard; hold the UI until it is read so the
  // guest never sees the default colors flash first.
  const themeLoading = useBoothAppearance((state) => state.loading);

  const [phase, setPhase] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [organize, setOrganize] = useState<OrganizeManifest | null>(null);
  const [template, setTemplate] = useState<FrameTemplateConfig | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [adjustments, setAdjustments] = useState<OrganizePhotoAdjustment[]>([]);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [showPhotoGestureGuide, setShowPhotoGestureGuide] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'err' }>({ text: '' });
  const [panelOpen, setPanelOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  // Timed flow extras: frame + filter are chosen here; rotate / mirror per photo.
  const [filterId, setFilterId] = useState('original');
  const [transforms, setTransforms] = useState<Record<string, OrganizePhotoTransform>>({});
  const [baked, setBaked] = useState<Record<string, string>>({});
  const [frames, setFrames] = useState<FrameConfig[] | null>(null);
  const [framePicker, setFramePicker] = useState(false);
  // After the frame is arranged: pick the GIF frame, then send.
  const [step, setStep] = useState<'arrange' | 'gif'>('arrange');
  const [gifFrames, setGifFrames] = useState<EffectsGifFrame[] | null>(null);
  const [gifFrameId, setGifFrameId] = useState<string | null>(null);
  const [gifAdjust, setGifAdjust] = useState<GifAdjust>(DEFAULT_GIF_ADJUST);
  const arrangeRetries = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gestureGuideTimerRef = useRef<number | null>(null);
  const [waiting, setWaiting] = useState<'busy' | 'done' | 'error' | null>(null);
  // Generating usually takes ~15 s; past 30 s offer the gallery instead of a
  // spinner with no way out (the outputs land there when the booth is done).
  const [slowWait, setSlowWait] = useState(false);
  useEffect(() => {
    setSlowWait(false);
    if (waiting !== 'busy') return;
    const timer = window.setTimeout(() => setSlowWait(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  const waitStartedRef = useRef(false);

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

  const goToGallery = useCallback(() => {
    if (endpoint) window.location.assign(sessionUrl(endpoint, token));
  }, [endpoint, token]);

  // Completion signal: the booth generates and uploads every output for an
  // arrangement, then writes print-result.json and flips the request to
  // 'handled' (see printListener.handleRequest). With it, this page can hand
  // the customer to a gallery that is already complete instead of an empty
  // one. Falls back to handing off after ~3 min if the booth is offline.
  const waitForCompletion = useCallback(async () => {
    if (!endpoint || waitStartedRef.current) return;
    waitStartedRef.current = true;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await sleep(2000);
      try {
        const request = await readJsonFile<PrintRequestFile>(endpoint, token, PRINT_REQUEST_FILE);
        if (!request || request.status !== 'handled') continue;
        const result = await readJsonFile<{ status?: string }>(endpoint, token, PRINT_RESULT_FILE);
        if (result && result.status === 'error') {
          setWaiting('error');
          setStatus({
            text: 'Booth tidak dapat menyiapkan cetakan. Silakan kirim ulang.',
            kind: 'err',
          });
          return;
        }
        setWaiting('done');
        setStatus({ text: 'Foto Anda siap ✦', kind: 'ok' });
        window.setTimeout(goToGallery, 900);
        return;
      } catch {
        // transient fetch blip — keep polling
      }
    }
    setWaiting('done');
    setStatus({ text: 'Foto Anda siap ✦', kind: 'ok' });
    window.setTimeout(goToGallery, 600);
  }, [endpoint, token, goToGallery]);

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
      setError('Galeri belum dikonfigurasi. Silakan buka sesi ini nanti.');
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
      // Arranging is one-shot: once a print request exists — done ('handled')
      // or still in flight ('requested') — the arrange UI must not come back.
      // Hand off to the gallery; if the booth is still generating, wait for it.
      const request = await readJsonFile<PrintRequestFile>(endpoint, token, PRINT_REQUEST_FILE);
      if (request) {
        if (request.status === 'handled') {
          goToGallery();
          return;
        }
        if (request.status === 'requested') {
          setWaiting('busy');
          void waitForCompletion();
          return;
        }
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
        setFilterId(manifest.filterId ?? 'original');
        setTransforms(manifest.transforms ?? {});
        if (manifest.gifFrameUrl) setGifFrameId(manifest.gifFrameUrl);
        if (manifest.gifAdjust) setGifAdjust(clampGifAdjust(manifest.gifAdjust));
        if (!manifest.template && !manifest.frameId) {
          // The booth left the frame to the guest: show the picker.
          setOrganize(manifest);
          setFramePicker(true);
          arrangeRetries.current = 0;
          setPhase('ready');
          return;
        }
        const resolved = await loadFrame(manifest);
        if (resolved) {
          setOrganize(manifest);
          setTemplate(resolved);
          const n = Math.max(1, resolved.photoSlots.length);
          setSlots(() => {
            const next = (manifest.slots ?? []).slice();
            while (next.length < n) next.push(null);
            return next;
          });
          setAdjustments(
            Array.from({ length: n }, (_, i) =>
              initialAdjustment(resolved, i, manifest.adjustments?.[i]),
            ),
          );
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
        setError('Foto Anda sudah siap. Minta bantuan petugas untuk mengatur bingkai.');
        setPhase('missing');
      }
    } catch {
      setError('Sesi tidak ditemukan atau mungkin sudah kedaluwarsa.');
      setPhase('missing');
    }
  }, [endpoint, token, loadFrame, goToGallery, waitForCompletion]);

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
            photoSlots: template.photoSlots.map((slot, i) => {
              const adjustment = adjustments[i] ?? initialAdjustment(template, i);
              return {
                ...slot,
                sourcePhotoSlot: i + 1,
                objectPosition: `${adjustment.x * 100}% ${adjustment.y * 100}%`,
                photoScale: adjustment.scale,
                photoOffsetX: adjustment.offsetX ?? 0,
                photoOffsetY: adjustment.offsetY ?? 0,
              };
            }),
          }
        : null,
    [template, adjustments],
  );

  const photoUrlFor = useCallback(
    (name: string) => {
      const t = transforms[name];
      return t && !isIdentityTransform(t) ? (baked[transformKey(name, t)] ?? fileUrl(name)) : fileUrl(name);
    },
    [transforms, baked, fileUrl],
  );

  const previewPhotos = useMemo(
    () => (template ? template.photoSlots.map((_, i) => (slots[i] ? photoUrlFor(slots[i]!) : undefined)) : []),
    [template, slots, photoUrlFor],
  );

  // Bake rotate / mirror into preview images (the booth applies the same
  // transforms to the raws when it renders the outputs).
  useEffect(() => {
    let alive = true;
    for (const [name, t] of Object.entries(transforms)) {
      const key = transformKey(name, t);
      if (isIdentityTransform(t) || baked[key]) continue;
      applyPhotoTransform(fileUrl(name), t)
        .then((url) => alive && setBaked((b) => ({ ...b, [key]: url })))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [transforms, baked, fileUrl]);

  // Frames for the picker, loaded the first time it opens.
  useEffect(() => {
    if (!framePicker || frames !== null) return;
    listFrameTemplates()
      .then(setFrames)
      .catch(() => setFrames([]));
  }, [framePicker, frames]);

  // GIF frames the admin enabled, loaded once (none = the GIF step is skipped).
  useEffect(() => {
    let alive = true;
    listActiveGifFrames()
      .then((rows) => {
        if (alive) setGifFrames(rows.map((r) => ({ id: r.id, name: r.name, url: r.image_url, width: r.width, height: r.height })));
      })
      .catch(() => {
        if (alive) setGifFrames([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // The GIF is made from the original captures used on the frame, in capture
  // order, without rotate / mirror and without the filter.
  const gifPhotoUrls = useMemo(
    () =>
      [...new Set(slots.filter((name): name is string => Boolean(name)))]
        .sort((a, b) => photoIndexFromName(a) - photoIndexFromName(b))
        .map((name) => fileUrl(name)),
    [slots, fileUrl],
  );
  // gifFrameId holds the frame id (or a saved overlay URL from organize.json).
  const chosenGifFrame = gifFrames?.find((frame) => frame.id === gifFrameId || frame.url === gifFrameId) ?? null;

  const pickFrame = (frame: FrameConfig) => {
    const resolved = resolveFrameTemplate(frame, Math.max(1, Math.floor(frame.photoSlots ?? 3)));
    // Starts blank: the guest places each photo. Switching frames keeps the
    // photos already placed, slot by slot.
    const nextSlots = Array.from({ length: resolved.photoSlots.length }, (_, i) => (template ? (slots[i] ?? null) : null));
    setOrganize((current) =>
      current ? { ...current, frameId: frame.id, template: resolved, slotCount: resolved.photoSlots.length, slots: nextSlots } : current,
    );
    setTemplate(resolved);
    setSlots(nextSlots);
    setAdjustments(Array.from({ length: resolved.photoSlots.length }, (_, i) => initialAdjustment(resolved, i)));
    setPickSlot(null);
    setFramePicker(false);
  };

  /** Rotate 90° clockwise, or mirror the photo as it currently looks. */
  const transformSelected = (op: 'rotate' | 'flip') => {
    const name = pickSlot != null ? slots[pickSlot] : null;
    if (!name) return;
    setTransforms((all) => {
      const current = all[name] ?? { rotate: 0, flip: false };
      const next =
        op === 'rotate'
          ? { ...current, rotate: (current.rotate + 90) % 360 }
          : // Mirroring what is on screen = toggle mirror and reverse the turns.
            { rotate: (360 - current.rotate) % 360, flip: !current.flip };
      return { ...all, [name]: next };
    });
  };

  // Drag / pinch / scroll the selected photo from anywhere on the canvas
  // area (same engine as the booth's filter screen). Tapping a slot still
  // goes through onPickSlot below.
  const adjustmentsRef = useRef(adjustments);
  adjustmentsRef.current = adjustments;
  const { surfaceHandlers, wasDrag } = usePhotoGestures({
    template: displayTemplate,
    getAdjustment: (index) =>
      adjustmentsRef.current[index] ?? (template ? initialAdjustment(template, index) : { x: 0.5, y: 0.5, scale: 1 }),
    setAdjustment: (index, next) =>
      setAdjustments((all) => all.map((adjustment, i) => (i === index ? { ...adjustment, ...next } : adjustment))),
    isAdjustable: (index) => Boolean(slots[index]),
    selectedIndex: pickSlot ?? -1,
    onSelect: (index) => {
      setPickSlot(index);
      setPanelOpen(false);
    },
    onAdjust: () => hidePhotoGestureGuide(),
  });

  const onPickSlot = (index: number) => {
    if (wasDrag()) return;
    setPickSlot(index);
    setPanelOpen(slots[index] == null);
    if (slots[index] != null) revealPhotoGestureGuide();
    else hidePhotoGestureGuide();
  };

  const revealPhotoGestureGuide = () => {
    setShowPhotoGestureGuide(true);
    if (gestureGuideTimerRef.current != null) window.clearTimeout(gestureGuideTimerRef.current);
    gestureGuideTimerRef.current = window.setTimeout(() => {
      setShowPhotoGestureGuide(false);
      gestureGuideTimerRef.current = null;
    }, 3600);
  };

  const hidePhotoGestureGuide = () => {
    setShowPhotoGestureGuide(false);
    if (gestureGuideTimerRef.current != null) {
      window.clearTimeout(gestureGuideTimerRef.current);
      gestureGuideTimerRef.current = null;
    }
  };

  const clearCanvasSelection = () => {
    setPickSlot(null);
    setPanelOpen(false);
    hidePhotoGestureGuide();
  };

  const assignPhoto = (name: string) => {
    const target = pickSlot ?? slots.findIndex((slot) => slot == null);
    if (target < 0) return;
    const replacing = slots[target] !== name;
    const next = [...slots];
    next[target] = name;
    repaintSlots(next);
    if (replacing && template) {
      setAdjustments((current) =>
        current.map((adjustment, index) => index === target ? initialAdjustment(template, target) : adjustment),
      );
    }
    setPickSlot(target);
    setPanelOpen(false);
    revealPhotoGestureGuide();
  };

  const deleteSelectedPhoto = () => {
    if (pickSlot == null) return;
    const next = [...slots];
    next[pickSlot] = null;
    repaintSlots(next);
    if (template) {
      const reset = initialAdjustment(template, pickSlot);
      setAdjustments((current) => current.map((adjustment, index) => index === pickSlot ? reset : adjustment));
    }
    setPanelOpen(false);
    hidePhotoGestureGuide();
  };

  const unselectAllSlots = () => {
    repaintSlots(Array.from({ length: slotCount }, () => null));
    if (template) {
      setAdjustments(Array.from({ length: slotCount }, (_, index) => initialAdjustment(template, index)));
    }
    setPickSlot(null);
    hidePhotoGestureGuide();
  };

  const saveSlots = async (): Promise<boolean> => {
    if (!organize || !endpoint) return false;
    const manifest = {
      ...organize,
      slots: slots.slice(),
      adjustments: adjustments.slice(),
      filterId,
      transforms,
      gifFrameUrl: chosenGifFrame?.url ?? null,
      gifAdjust: isDefaultGifAdjust(gifAdjust) ? null : gifAdjust,
    };
    const ok = await writeJsonFile(endpoint, token, ORGANIZE_FILE, manifest);
    if (ok) setOrganize(manifest);
    return ok;
  };

  const sendToPrint = async () => {
    if (sent || !endpoint) return;
    setSent(true);
    setStatus({ text: 'Mengirim bingkai …' });
    try {
      if (!(await saveSlots())) throw new Error('gagal menyimpan susunan');
      const reqId =
        'req_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2));
      const payload = {
        requestId: reqId,
        requestedAt: Date.now(),
        slots: slots.slice(),
        adjustments: adjustments.slice(),
        by: 'organize',
        status: 'requested' as const,
      };
      if (!(await writeJsonFile(endpoint, token, PRINT_REQUEST_FILE, payload))) {
        throw new Error('permintaan cetak gagal');
      }
      // The ONLY status change this page makes: print_status -> ready_to_print.
      // The booth generates the framed outputs; the admin prints them manually.
      await fetch(`${endpoint}/api/sessions/${encodeURIComponent(token)}/ready`, {
        method: 'POST',
      }).catch(() => {});
      // From here the booth generates the framed outputs; keep the customer on
      // a "Preparing your prints…" screen until every output is generated AND
      // uploaded (request flips to 'handled'), then hand them to the gallery.
      setStatus({ text: 'Menyiapkan cetakan…', kind: 'ok' });
      waitStartedRef.current = false;
      setWaiting('busy');
      void waitForCompletion();
    } catch {
      setSent(false);
      setStatus({ text: 'Tidak dapat mengirim. Coba lagi.', kind: 'err' });
    }
  };

  if (waiting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pbx-ui-raised-2 p-6 text-center text-white">
        {waiting === 'error' ? (
          <div className="max-w-sm">
            <p className="text-lg font-black uppercase tracking-widest">
              Cetakan tidak dapat disiapkan.
            </p>
            <p className="mt-2 text-sm text-white/70">
              Booth mengalami kendala saat membuat foto bingkai. Silakan kirim ulang.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="rounded-full border-[3px] border-pbx-secondary bg-pbx-tertiary px-6 py-3 text-sm font-black uppercase tracking-wide text-pbx-tertiary-fg"
                onClick={() => {
                  waitStartedRef.current = false;
                  setWaiting(null);
                  setSent(false);
                }}
              >
                Coba Lagi
              </button>
              <button
                className="rounded-full border-[3px] border-white px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
                onClick={goToGallery}
              >
                Buka Galeri
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-pbx-ui-hi" />
            <p className="text-lg font-black uppercase tracking-widest">
              {waiting === 'done' ? 'Foto Anda siap!' : 'Menyiapkan cetakan…'}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {waiting === 'done'
                ? 'Membuka galeri…'
                : 'Booth sedang membuat foto bingkai — mohon tunggu.'}
            </p>
            {waiting === 'busy' && slowWait && (
              <div className="mx-auto mt-6 max-w-xs">
                <p className="text-xs text-white/60">
                  Masih diproses. Fotomu sudah tersimpan — kamu bisa membuka galeri sekarang, hasil bingkai akan muncul di sana.
                </p>
                <button
                  className="mt-3 rounded-full border-[3px] border-white px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
                  onClick={goToGallery}
                >
                  Buka Galeri
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'missing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pbx-ui-raised-2 p-6 text-center text-white">
        <p className="text-lg font-bold opacity-90">
          {error ?? 'Sesi tidak ditemukan atau mungkin sudah kedaluwarsa.'}
        </p>
      </div>
    );
  }

  if (phase === 'ready' && !themeLoading && (framePicker || !template)) {
    return (
      <FramePicker
        frames={frames}
        photoUrls={photos.map((photo) => photoUrlFor(photo.name))}
        onPick={pickFrame}
        onClose={template ? () => setFramePicker(false) : undefined}
      />
    );
  }

  if (phase === 'ready' && !themeLoading && template && step === 'gif') {
    return (
      <section className="flex h-[100dvh] flex-col overflow-hidden bg-pbx-paper text-pbx-ink">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-pbx-line px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black uppercase tracking-[0.18em]">Bingkai GIF</h1>
            <p className="truncate text-xs font-bold text-pbx-secondary-strong">Pilih bingkai untuk GIF animasimu</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setStep('arrange')}
              disabled={sent}
              className="rounded-full border-2 border-pbx-secondary bg-white px-3 py-2 text-xs font-black uppercase text-pbx-ink disabled:opacity-40"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={() => void sendToPrint()}
              disabled={sent}
              className="rounded-full border-[3px] border-pbx-secondary bg-pbx-tertiary px-6 py-3 text-sm font-black uppercase tracking-wide text-pbx-tertiary-fg shadow-[0_6px_18px_rgb(var(--pbx-ink-rgb)/0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {sent ? 'Mengirim…' : 'Cetak'}
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <GifPreview
            photos={gifPhotoUrls}
            filter="none"
            overlay={chosenGifFrame}
            adjust={gifAdjust}
            onAdjustChange={setGifAdjust}
            className="max-h-full w-full max-w-md shadow-[0_20px_50px_rgb(var(--pbx-ink-rgb)/0.35)]"
          />
        </div>
        {status.kind === 'err' && <p className="pb-2 text-center text-xs font-extrabold text-pbx-brand-strong">{status.text}</p>}
        <div className="shrink-0 border-t-2 border-pbx-line bg-pbx-paper/95">
          <div className="pb-scroll mx-auto flex max-w-5xl gap-3 overflow-x-auto px-3 py-3">
            {[null, ...(gifFrames ?? [])].map((option) => {
              const selected = (option?.id ?? null) === (chosenGifFrame?.id ?? null);
              return (
                <button
                  key={option?.id ?? 'none'}
                  type="button"
                  onClick={() => setGifFrameId(option?.id ?? null)}
                  aria-pressed={selected}
                  className="flex w-20 shrink-0 flex-col items-center gap-1"
                >
                  <span
                    className={`relative block aspect-square w-full overflow-hidden rounded-[12px] border-[3px] bg-pbx-ink ${selected ? 'border-pbx-brand' : 'border-transparent'}`}
                  >
                    {gifPhotoUrls[0] && <img src={gifPhotoUrls[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    {option ? (
                      <img src={option.url} alt="" className="absolute inset-0 h-full w-full object-fill" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center bg-black/40 text-2xl font-black text-white">⊘</span>
                    )}
                  </span>
                  <span className={`w-full truncate text-center text-[0.65rem] ${selected ? 'font-black text-pbx-brand-strong' : 'font-bold text-pbx-ink/70'}`}>
                    {option ? option.name : 'Tanpa Bingkai'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (themeLoading || phase === 'loading' || !template || !displayTemplate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pbx-ui-raised-2 text-white">
        <p className="animate-pulse text-lg font-black uppercase tracking-widest opacity-80">
          Memuat foto Anda…
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
      ? 'border-pbx-secondary bg-pbx-tertiary text-pbx-tertiary-fg shadow-[0_6px_18px_rgb(var(--pbx-ink-rgb)/0.4)] hover:scale-[1.02] active:scale-[0.98]'
      : 'cursor-not-allowed border-pbx-line bg-white opacity-50');

  const photosPanel = (
    <div className="grid gap-4">
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((item, i) => (
            <button
              key={item.name}
              type="button"
              onClick={() => assignPhoto(item.name)}
              className="group min-w-0 overflow-hidden rounded-[12px] border-2 border-pbx-line bg-white p-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-pbx-brand hover:shadow-md"
            >
              <span className="block aspect-[4/3] w-full overflow-hidden rounded-md bg-pbx-tint">
                <img src={item.url} alt={`Foto ${i + 1}`} loading="lazy" className="block h-full w-full object-contain" />
              </span>
              <span className="block truncate px-1 py-2 text-center text-xs font-black text-pbx-ink">
                Foto {i + 1}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-pbx-secondary-strong">Belum ada foto.</p>
      )}
    </div>
  );

  const selectedPlacement = pickSlot != null ? displayTemplate.photoSlots[pickSlot] : null;
  const selectionPill = (() => {
    if (panelOpen || pickSlot == null || !slots[pickSlot] || !selectedPlacement || !template || !frameRef.current) return null;
    const rect = frameRef.current.getBoundingClientRect();
    const centerX = rect.left + ((selectedPlacement.x + selectedPlacement.width / 2) / template.width) * rect.width;
    const slotTop = rect.top + (selectedPlacement.y / template.height) * rect.height;
    const slotBottom = rect.top + ((selectedPlacement.y + selectedPlacement.height) / template.height) * rect.height;
    const pillHeight = showPhotoGestureGuide ? 82 : 42;
    const pillWidth = 330;
    const left = clamp(centerX - pillWidth / 2, 8, Math.max(8, window.innerWidth - pillWidth - 8));
    const topAbove = slotTop - pillHeight - 8;
    const topBelow = slotBottom + 8;
    const bottomInset = window.innerWidth < 1024 ? 72 : 8;
    const maxTop = Math.max(8, window.innerHeight - bottomInset - pillHeight);
    const pillTop = topAbove >= 8
      ? topAbove
      : topBelow <= maxTop
        ? topBelow
        : clamp(topAbove, 8, maxTop);
    return createPortal(
      <div className="fixed z-[200] flex flex-col items-center gap-1" style={{ left, top: pillTop }}>
        <div className="flex items-center gap-1 rounded-full border border-pbx-line bg-white/95 p-1 shadow-lg">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="rounded-full bg-pbx-tertiary px-3 py-2 text-xs font-black text-pbx-tertiary-fg"
          >
            Ganti
          </button>
          <button
            type="button"
            onClick={() => transformSelected('rotate')}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-pbx-ink"
            title="Putar 90°"
          >
            ↻ Putar
          </button>
          <button
            type="button"
            onClick={() => transformSelected('flip')}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-pbx-ink"
            title="Cermin"
          >
            ⇋ Cermin
          </button>
          <button
            type="button"
            onClick={deleteSelectedPhoto}
            className="rounded-full bg-pbx-brand-tint px-3 py-2 text-xs font-black text-pbx-brand-strong"
          >
            Hapus
          </button>
        </div>
        {showPhotoGestureGuide && (
          <div className="flex items-center gap-3 rounded-full border border-white/80 bg-pbx-ui-raised-2/90 px-3 py-1.5 text-[0.65rem] font-black uppercase text-white shadow-lg">
            <span className="flex items-center gap-1">
              <span className="photo-guide-pan text-base leading-none" aria-hidden="true">↔</span>
              Geser
            </span>
            <span className="h-3 w-px bg-white/40" aria-hidden="true" />
            <span className="flex items-center gap-1">
              <span className="photo-guide-zoom text-base leading-none" aria-hidden="true">↕</span>
              Perbesar
            </span>
          </div>
        )}
      </div>,
      document.body,
    );
  })();

  return (
    <section className="relative flex h-[100dvh] flex-col overflow-hidden bg-pbx-paper text-pbx-ink">
      <header className="z-[60] flex shrink-0 items-center justify-between gap-2 border-b-2 border-pbx-line bg-pbx-paper px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">
            Atur Bingkai
          </h1>
          <p className="truncate text-xs font-bold text-pbx-secondary-strong">
            {pickSlot != null
              ? `Slot ${pickSlot + 1} dipilih`
              : 'Pilih slot bingkai untuk menambahkan foto'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border-2 px-3 py-1 text-xs font-black ${
              allAssigned
                ? 'border-[#16a34a] bg-[#e7ffe7] text-[#15803d]'
                : 'border-pbx-line bg-white text-pbx-secondary-strong'
            }`}
          >
            {filled}/{slotCount}
          </span>
          <button
            type="button"
            onClick={() => setFramePicker(true)}
            title="Ganti bingkai"
            className="rounded-full border-2 border-pbx-secondary bg-white px-3 py-2 text-xs font-black uppercase text-pbx-ink"
          >
            Bingkai
          </button>
          <button
            type="button"
            onClick={unselectAllSlots}
            disabled={filled === 0}
            title="Batalkan Pilihan"
            className="hidden rounded-full border-2 border-pbx-brand-soft bg-pbx-brand-tint px-3 py-2 text-xs font-black uppercase text-pbx-brand-strong disabled:opacity-40 lg:inline-flex"
          >
            Batalkan Pilihan
          </button>
          <button
            type="button"
            onClick={() => {
              // GIF frame step next; without any GIF frames, send straight away.
              if (gifFrames && gifFrames.length > 0) {
                clearCanvasSelection();
                setStep('gif');
              } else void sendToPrint();
            }}
            disabled={!allAssigned || sent || gifFrames === null}
            className={sendButtonClass}
          >
            {sent ? 'Mengirim…' : gifFrames && gifFrames.length > 0 ? 'Lanjut' : 'Cetak'}
          </button>
          {status.text && (
            <span
              className={`hidden text-xs font-extrabold sm:inline ${
                status.kind === 'ok'
                  ? 'text-[#15803d]'
                  : status.kind === 'err'
                    ? 'text-pbx-brand-strong'
                    : 'text-pbx-secondary-strong'
              }`}
            >
              {status.text}
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          ref={areaRef}
          className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden p-4 pb-44 lg:p-6 lg:pb-32"
          onClick={(event) => {
            if (event.target === event.currentTarget && !wasDrag()) clearCanvasSelection();
          }}
          {...surfaceHandlers}
        >
          <div
            ref={frameRef}
            className="relative touch-none bg-white shadow-[0_20px_50px_rgb(var(--pbx-ink-rgb)/0.35)]"
            style={{
              width: canvasSize ? `${canvasSize.width}px` : undefined,
              height: canvasSize ? `${canvasSize.height}px` : undefined,
              aspectRatio: canvasSize ? undefined : `${template.width} / ${template.height}`,
            }}
          >
            <FrameCanvas
              template={displayTemplate}
              photos={previewPhotos}
              filter={getCanvasFilter(filterId)}
              onSlotSelect={(slotNumber) => {
                const i = displayTemplate.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber);
                if (i >= 0) onPickSlot(i);
              }}
              onCanvasBackgroundClick={clearCanvasSelection}
              activeSlotNumber={pickSlot != null ? displayTemplate.photoSlots[pickSlot]?.slotNumber : undefined}
              activeGuideClassName="outline-pbx-brand"
              showGuides
              showGuideDimensions={false}
              className="h-full w-full !border-0 !text-pbx-ink"
            />
          </div>
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              title="Semua Foto"
              aria-label="Buka panel semua foto"
              className="absolute right-4 top-1/2 z-[85] hidden -translate-y-1/2 items-center gap-2 rounded-full border-2 border-pbx-secondary bg-white/95 px-4 py-3 text-sm font-black uppercase text-pbx-ink shadow-lg transition hover:bg-pbx-tint lg:flex"
            >
              <span aria-hidden="true">▦</span> Semua Foto
            </button>
          )}
        </div>
      </div>

      {selectionPill}

      {/* Filter rail (timed flow: the guest picks the look here) */}
      <div className="absolute inset-x-0 bottom-14 z-[90] border-t-2 border-pbx-line bg-pbx-paper/95 backdrop-blur lg:bottom-0">
        <div className="pb-scroll mx-auto flex max-w-5xl gap-3 overflow-x-auto px-3 py-2.5">
          {FILTERS.map((option) => {
            const selected = option.id === filterId;
            const sample = photos[0] ? photoUrlFor(photos[0].name) : undefined;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilterId(option.id)}
                aria-pressed={selected}
                className="flex shrink-0 flex-col items-center gap-1"
              >
                <span
                  className={`block h-12 w-12 overflow-hidden rounded-full border-[3px] bg-pbx-ink ${selected ? 'border-pbx-brand' : 'border-transparent'}`}
                >
                  {sample && <img src={sample} alt="" className="h-full w-full object-cover" style={{ filter: option.canvasFilter }} />}
                </span>
                <span className={`text-[0.65rem] ${selected ? 'font-black text-pbx-brand-strong' : 'font-bold text-pbx-ink/70'}`}>{option.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[120] border-t-2 border-pbx-line bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-stretch gap-2 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            title="Semua Foto"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-pbx-secondary bg-white text-sm font-black uppercase text-pbx-ink"
          >
            <span aria-hidden="true">▦</span> Semua Foto
          </button>
          <button
            type="button"
            onClick={unselectAllSlots}
            disabled={filled === 0}
            title="Batalkan Pilihan"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-pbx-brand-soft bg-pbx-brand-tint text-sm font-black uppercase text-pbx-brand-strong disabled:opacity-40"
          >
            <span aria-hidden="true">☐</span> Batalkan Pilihan
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Close photo picker"
        aria-hidden={!panelOpen}
        tabIndex={panelOpen ? 0 : -1}
        onClick={clearCanvasSelection}
        className={`fixed inset-0 z-[100] bg-black/25 transition-opacity duration-300 ease-in-out ${
          panelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <section
        aria-hidden={!panelOpen}
        className={`pointer-events-auto fixed right-3 top-1/2 z-[110] hidden max-h-[calc(100dvh-24px)] w-[420px] max-w-[calc(100%-24px)] -translate-y-1/2 flex-col overflow-hidden rounded-[14px] border-[3px] border-pbx-secondary bg-pbx-paper shadow-[0_16px_48px_rgb(var(--pbx-ink-rgb)/0.35)] transition-all duration-300 ease-in-out lg:flex ${
          panelOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-pbx-line px-4 py-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">Semua Foto</h2>
            <p className="text-xs font-bold text-pbx-secondary-strong">
              {pickSlot == null ? 'Pilih slot bingkai terlebih dahulu' : `Slot ${pickSlot + 1}`}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCanvasSelection}
            aria-label="Tutup pemilih foto"
            tabIndex={panelOpen ? 0 : -1}
            className="grid h-9 w-9 place-items-center rounded-[10px] border-[3px] border-pbx-line bg-white text-lg font-black text-pbx-secondary-strong transition hover:bg-pbx-tint"
          >
            ×
          </button>
        </header>
        <div className="pb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{photosPanel}</div>
      </section>

      <section
        aria-hidden={!panelOpen}
        className={`pointer-events-auto fixed inset-x-3 bottom-[4.5rem] z-[110] mx-auto flex max-h-[58vh] max-w-5xl flex-col overflow-hidden rounded-t-[18px] border-[3px] border-pbx-secondary bg-pbx-paper shadow-[0_-12px_40px_rgb(var(--pbx-ink-rgb)/0.25)] transition-transform duration-300 ease-in-out lg:hidden ${
          panelOpen ? 'translate-y-0' : 'pointer-events-none translate-y-[calc(100%+5rem)]'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-pbx-line px-4 py-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">Semua Foto</h2>
            <p className="text-xs font-bold text-pbx-secondary-strong">
              {pickSlot == null ? 'Pilih slot bingkai terlebih dahulu' : `Slot ${pickSlot + 1}`}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCanvasSelection}
            aria-label="Tutup pemilih foto"
            tabIndex={panelOpen ? 0 : -1}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-pbx-line bg-white text-lg font-black text-pbx-secondary-strong"
          >
            ×
          </button>
        </header>
        <div className="pb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">{photosPanel}</div>
      </section>
    </section>
  );
};

export default OrganizeScreen;