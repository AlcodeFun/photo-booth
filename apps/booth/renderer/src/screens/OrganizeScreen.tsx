import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { FrameTemplateConfig } from '@photo-booth/types';
import { GALLERY_URL } from '../config';
import FrameCanvas from '../components/FrameCanvas';
import {
  ORGANIZE_FILE,
  PRINT_REQUEST_FILE,
  PRINT_RESULT_FILE,
  readJsonFile,
  sessionUrl,
  writeJsonFile,
  type OrganizeManifest,
  type OrganizePhotoAdjustment,
  type PrintRequestFile,
} from '../lib/organize';
import { resolveObjectPosition } from '../utils/frameConfig';

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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
  const arrangeRetries = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gestureGuideTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    overflowX: number;
    overflowY: number;
    adjustment: OrganizePhotoAdjustment;
    moved: boolean;
  } | null>(null);
  const zoomCursorTimerRef = useRef<number | null>(null);
  const skipSlotClickRef = useRef(false);
  const [waiting, setWaiting] = useState<'busy' | 'done' | 'error' | null>(null);
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

  const previewPhotos = useMemo(
    () =>
      template ? template.photoSlots.map((_, i) => (slots[i] ? fileUrl(slots[i]) : undefined)) : [],
    [template, slots, fileUrl],
  );

  const onPickSlot = (index: number) => {
    if (skipSlotClickRef.current) {
      skipSlotClickRef.current = false;
      return;
    }
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

  const zoomPhotoAtPointer = (slotNumber: number, event: WheelEvent<HTMLButtonElement>) => {
    const index = displayTemplate?.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber) ?? -1;
    if (index < 0 || !slots[index]) return;
    event.preventDefault();
    event.stopPropagation();
    setPickSlot(index);
    setPanelOpen(false);
    if (event.deltaY !== 0) hidePhotoGestureGuide();
    const rect = event.currentTarget.getBoundingClientRect();
    const target = event.currentTarget;
    target.style.cursor = 'zoom-in';
    if (zoomCursorTimerRef.current != null) window.clearTimeout(zoomCursorTimerRef.current);
    zoomCursorTimerRef.current = window.setTimeout(() => {
      target.style.cursor = 'grab';
      zoomCursorTimerRef.current = null;
    }, 350);
    const pointerX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const pointerY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const current = adjustments[index] ?? (template ? initialAdjustment(template, index) : { x: 0.5, y: 0.5, scale: 1 });
    const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0015), 1, 3);
    const factor = scale / current.scale;
    setAdjustments((all) =>
      all.map((adjustment, currentIndex) =>
        currentIndex === index
          ? {
              ...adjustment,
              scale,
              offsetX: clamp(pointerX - factor * (pointerX - (current.offsetX ?? 0)), 1 - scale, 0),
              offsetY: clamp(pointerY - factor * (pointerY - (current.offsetY ?? 0)), 1 - scale, 0),
            }
          : adjustment,
      ),
    );
  };

  const startPhotoDrag = (slotNumber: number, event: PointerEvent<HTMLButtonElement>) => {
    const index = displayTemplate?.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber) ?? -1;
    const placement = displayTemplate?.photoSlots[index];
    if (index < 0 || !placement || !slots[index] || !template) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const image = event.currentTarget.querySelector('img');
    const coverScale = image?.naturalWidth && image.naturalHeight
      ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
      : 1;
    const overflowX = (placement.objectFit ?? 'cover') === 'cover' && image?.naturalWidth
      ? Math.max(0, image.naturalWidth * coverScale - rect.width)
      : 0;
    const overflowY = (placement.objectFit ?? 'cover') === 'cover' && image?.naturalHeight
      ? Math.max(0, image.naturalHeight * coverScale - rect.height)
      : 0;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPickSlot(index);
    setPanelOpen(false);
    dragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      overflowX,
      overflowY,
      adjustment: adjustments[index] ?? initialAdjustment(template, index),
      moved: false,
    };
  };

  const movePhotoDrag = (slotNumber: number, event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || displayTemplate?.photoSlots[drag.index]?.slotNumber !== slotNumber) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    skipSlotClickRef.current = true;
    hidePhotoGestureGuide();
    setAdjustments((current) =>
      current.map((adjustment, index) =>
        index === drag.index
          ? drag.adjustment.scale <= 1.001
            ? {
                ...adjustment,
                x: drag.overflowX > 0 ? clamp(drag.adjustment.x - deltaX / drag.overflowX, 0, 1) : drag.adjustment.x,
                y: drag.overflowY > 0 ? clamp(drag.adjustment.y - deltaY / drag.overflowY, 0, 1) : drag.adjustment.y,
              }
            : {
                ...adjustment,
                offsetX: clamp((drag.adjustment.offsetX ?? 0) + deltaX / drag.width, 1 - drag.adjustment.scale, 0),
                offsetY: clamp((drag.adjustment.offsetY ?? 0) + deltaY / drag.height, 1 - drag.adjustment.scale, 0),
              }
          : adjustment,
      ),
    );
  };

  const finishPhotoDrag = (slotNumber: number) => {
    const drag = dragRef.current;
    if (!drag || displayTemplate?.photoSlots[drag.index]?.slotNumber !== slotNumber) return;
    if (drag.moved) window.setTimeout(() => { skipSlotClickRef.current = false; }, 250);
    dragRef.current = null;
  };

  const saveSlots = async (): Promise<boolean> => {
    if (!organize || !endpoint) return false;
    const manifest = { ...organize, slots: slots.slice(), adjustments: adjustments.slice() };
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

  if (phase === 'loading' || !template || !displayTemplate) {
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
    const pillWidth = 208;
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
            onClick={unselectAllSlots}
            disabled={filled === 0}
            title="Batalkan Pilihan"
            className="hidden rounded-full border-2 border-pbx-brand-soft bg-pbx-brand-tint px-3 py-2 text-xs font-black uppercase text-pbx-brand-strong disabled:opacity-40 lg:inline-flex"
          >
            Batalkan Pilihan
          </button>
          <button
            type="button"
            onClick={() => void sendToPrint()}
            disabled={!allAssigned || sent}
            className={sendButtonClass}
          >
            {sent ? 'Mengirim…' : 'Cetak'}
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
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pb-20 lg:p-6 lg:pb-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) clearCanvasSelection();
          }}
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
              onSlotSelect={(slotNumber) => {
                const i = displayTemplate.photoSlots.findIndex((slot) => slot.slotNumber === slotNumber);
                if (i >= 0) onPickSlot(i);
              }}
              onCanvasBackgroundClick={clearCanvasSelection}
              onSlotPointerDown={startPhotoDrag}
              onSlotPointerMove={movePhotoDrag}
              onSlotPointerUp={finishPhotoDrag}
              onSlotWheel={zoomPhotoAtPointer}
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