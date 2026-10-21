import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { GifPreview } from '../booth/EffectsView';
import { createGifFrame, replaceGifFrameImage, updateGifFrame, type GifFrame } from '../../lib/gifFrames';
import { detectGreenScreenRegions, removeGreenScreen } from '../../utils/greenScreenDetection';
import { detectOverlayWindow, type OverlayWindow } from '../../utils/overlayWindow';
import type { GifWindow } from '../../utils/gifAdjust';

const SAMPLE_PHOTOS = [1, 2, 3].map((n) => `${import.meta.env.BASE_URL}photos/${n}.jpg`);

interface Source {
  /** Picked file as a data URL (green kept). */
  original: string;
  /** Chroma-keyed version, when the picture has a green screen. */
  keyed: string | null;
  fileName: string;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

const imageSize = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('That file is not a readable image'));
    image.src = src;
  });

/** Re-encodes any image (incl. JPG) as a PNG file, keeping transparency. */
const toPngFile = async (src: string, name: string): Promise<File> => {
  const blob = await (await fetch(src)).blob();
  if (blob.type === 'image/png' || blob.type === 'image/webp') return new File([blob], name, { type: blob.type });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!png) throw new Error('Could not convert the image');
  return new File([png], name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
};

const MIN_SLOT = 0.05;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type SlotDrag = { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; start: GifWindow };

/**
 * The frame image with its photo slot drawn on top, like the print frame
 * editor's photo areas (but a single slot): drag it to move, drag a corner
 * to resize. Values are fractions of the image.
 */
const SlotEditor: React.FC<{
  imageUrl: string;
  aspect: number;
  slot: GifWindow;
  onChange: (slot: GifWindow) => void;
}> = ({ imageUrl, aspect, slot, onChange }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<SlotDrag | null>(null);

  const begin = (mode: SlotDrag['mode']) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    drag.current = { mode, startX: event.clientX, startY: event.clientY, start: slot };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (event.clientX - d.startX) / box.width;
    const dy = (event.clientY - d.startY) / box.height;
    const s0 = d.start;
    if (d.mode === 'move') {
      onChange({
        ...s0,
        x: Math.min(1 - s0.width, Math.max(0, s0.x + dx)),
        y: Math.min(1 - s0.height, Math.max(0, s0.y + dy)),
      });
      return;
    }
    let left = s0.x;
    let top = s0.y;
    let right = s0.x + s0.width;
    let bottom = s0.y + s0.height;
    if (d.mode.includes('w')) left = Math.min(right - MIN_SLOT, clamp01(left + dx));
    if (d.mode.includes('e')) right = Math.max(left + MIN_SLOT, clamp01(right + dx));
    if (d.mode.includes('n')) top = Math.min(bottom - MIN_SLOT, clamp01(top + dy));
    if (d.mode.includes('s')) bottom = Math.max(top + MIN_SLOT, clamp01(bottom + dy));
    onChange({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const end = () => {
    drag.current = null;
  };

  const handle = 'absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-pbx-ui-hi shadow';
  return (
    <div
      ref={boxRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-lg"
      style={{
        aspectRatio: `${aspect}`,
        backgroundColor: '#3a3a3a',
        backgroundImage:
          'linear-gradient(45deg,#4a4a4a 25%,transparent 25%,transparent 75%,#4a4a4a 75%),linear-gradient(45deg,#4a4a4a 25%,transparent 25%,transparent 75%,#4a4a4a 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-fill" draggable={false} />
      <div
        className="absolute cursor-move border-2 border-pbx-ui-hi bg-pbx-ui-hi/15"
        style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.width * 100}%`, height: `${slot.height * 100}%` }}
        onPointerDown={begin('move')}
      >
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Photo slot
        </span>
        <span className={`${handle} -left-2 -top-2 cursor-nwse-resize`} onPointerDown={begin('nw')} />
        <span className={`${handle} -right-2 -top-2 cursor-nesw-resize`} onPointerDown={begin('ne')} />
        <span className={`${handle} -bottom-2 -left-2 cursor-nesw-resize`} onPointerDown={begin('sw')} />
        <span className={`${handle} -bottom-2 -right-2 cursor-nwse-resize`} onPointerDown={begin('se')} />
      </div>
    </div>
  );
};

/**
 * Add / edit a GIF frame, like the frame editor but for a single photo slot:
 * pick a PNG / JPG, an optional green screen is keyed out automatically, the
 * photo slot is drawn automatically from the transparent / green area (and can
 * be moved or resized), and a live preview shows the guest's photo exactly
 * where the GIF will put it. The GIF keeps the frame's own shape.
 */
export const GifFrameEditor: React.FC<{
  /** Frame to edit, or null to add a new one. */
  frame: GifFrame | null;
  open: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ frame, open, nextSortOrder, onClose, onSaved }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [shown, setShown] = useState(true);
  const [source, setSource] = useState<Source | null>(null);
  const [keyGreen, setKeyGreen] = useState(true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [photoWindow, setPhotoWindow] = useState<OverlayWindow | null>(null);
  /** The photo slot being edited (auto-drawn from the detected window). */
  const [slot, setSlot] = useState<GifWindow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reset whenever the editor opens for another frame.
  useEffect(() => {
    if (!open) return;
    setName(frame?.name ?? '');
    setShown(frame?.is_active ?? true);
    setSource(null);
    setKeyGreen(true);
    setSlot(frame?.photo_slot ?? null);
    setError(null);
    setBusy(null);
  }, [open, frame]);

  const overlayUrl = source ? (keyGreen && source.keyed ? source.keyed : source.original) : (frame?.image_url ?? null);

  // Measure the overlay and its transparent window for the preview / warning.
  useEffect(() => {
    if (!overlayUrl) {
      setSize(null);
      setPhotoWindow(null);
      return;
    }
    let alive = true;
    void Promise.all([imageSize(overlayUrl), detectOverlayWindow(overlayUrl)])
      .then(([s, w]) => {
        if (!alive) return;
        setSize(s);
        setPhotoWindow(w);
        // A new image (or a frame saved before slots existed) gets its slot
        // drawn automatically from the transparent / green area.
        setSlot((current) => (source || !current ? w : current));
      })
      .catch(() => alive && setError('Could not read that image'));
    return () => {
      alive = false;
    };
    // `source` only matters together with the overlay URL it produced.
  }, [overlayUrl]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|webp|jpe?g)$/.test(file.type)) {
      setError('Use a PNG, WebP or JPG image');
      return;
    }
    setError(null);
    setBusy('Reading image…');
    try {
      const original = await readAsDataUrl(file);
      setBusy('Looking for a green screen…');
      const regions = await detectGreenScreenRegions(original).catch(() => []);
      const keyed = regions.length > 0 ? await removeGreenScreen(original) : null;
      setSource({ original, keyed, fileName: file.name });
      setKeyGreen(true);
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the image');
    } finally {
      setBusy(null);
    }
  };

  // A window that covers the whole image means nothing is transparent.
  const noWindow = Boolean(photoWindow && photoWindow.width > 0.995 && photoWindow.height > 0.995);
  const isJpgWithoutKey = Boolean(source && !(keyGreen && source.keyed) && /^data:image\/jpe?g/.test(source.original));

  const save = async () => {
    if (!overlayUrl) {
      setError('Choose an image first');
      return;
    }
    setError(null);
    setBusy('Saving…');
    try {
      if (frame) {
        if (source) await replaceGifFrameImage(frame, await toPngFile(overlayUrl, source.fileName));
        await updateGifFrame(frame.id, { name: name.trim() || frame.name, is_active: shown, photo_slot: slot });
        onSaved(`Saved "${name.trim() || frame.name}"`);
      } else {
        await createGifFrame(await toPngFile(overlayUrl, source?.fileName ?? 'gif-frame.png'), name, nextSortOrder, shown, slot);
        onSaved(`Added "${name.trim() || 'GIF frame'}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(null);
    }
  };

  const previewFrame =
    overlayUrl && size ? { id: 'preview', name, url: overlayUrl, width: size.width, height: size.height, slot: slot ?? photoWindow } : null;

  return (
    <Modal open={open} title={frame ? 'Edit GIF frame' : 'Add GIF frame'} onClose={busy ? () => undefined : onClose} width="880px">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Preview: how the GIF will look */}
        <div
          className={`relative grid min-h-[260px] place-items-center overflow-hidden rounded-xl border-2 border-dashed p-3 transition ${
            dragOver ? 'border-pbx-ui-hi bg-pbx-ui-hi/10' : 'border-white/15 bg-black/30'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void pick(e.dataTransfer.files?.[0]);
          }}
        >
          {previewFrame && size ? (
            <div className="flex w-full flex-col gap-3">
              {slot && (
                <div>
                  <SlotEditor imageUrl={previewFrame.url} aspect={size.width / size.height} slot={slot} onChange={setSlot} />
                  <p className="mt-1.5 text-center text-xs text-white/50">Drag the photo slot to move it, drag a corner to resize</p>
                </div>
              )}
              <div>
                <GifPreview photos={SAMPLE_PHOTOS} filter="none" overlay={previewFrame} className="w-full rounded-lg" />
                <p className="mt-1.5 text-center text-xs text-white/50">Preview with sample photos: the GIF keeps the frame's shape, the photo fills the slot</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 px-6 py-10 text-center text-white/70"
            >
              <span className="text-4xl">🖼️</span>
              <span className="text-sm font-semibold text-white">Drop an image here or click to choose</span>
              <span className="text-xs text-white/50">PNG with a transparent window, or any image with a green screen where the photo goes</span>
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold text-white">
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {busy}
              </span>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/55">Image</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(busy)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {source ? source.fileName : frame ? 'Replace image…' : 'Choose image…'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="hidden"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {source?.keyed && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-2.5 text-sm text-white">
              <input
                type="checkbox"
                checked={keyGreen}
                onChange={(e) => setKeyGreen(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#22c55e]"
              />
              <span>
                <b>Remove green screen</b>
                <span className="block text-xs text-white/60">Green area found and made transparent: that is where the photo goes.</span>
              </span>
            </label>
          )}

          {slot && size && (
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/65">
              <span className="flex-1">
                Photo slot: {Math.round(slot.width * size.width)} × {Math.round(slot.height * size.height)} px at{' '}
                {Math.round(slot.x * size.width)}, {Math.round(slot.y * size.height)} (image {size.width} × {size.height})
              </span>
              {photoWindow && (
                <button
                  type="button"
                  onClick={() => setSlot(photoWindow)}
                  className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Detect again
                </button>
              )}
            </div>
          )}
          {(noWindow || isJpgWithoutKey) && overlayUrl && (
            <p className="rounded-lg border border-[#f5b942]/40 bg-[#f5b942]/10 px-3 py-2 text-xs text-[#f7cd73]">
              No transparent window found, so the overlay would cover the whole photo. Use a PNG with a see-through area,
              or paint the photo area pure green.
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/55">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wedding Firna & Ogi"
              className="w-full rounded-lg border border-white/15 bg-pbx-ui-panel px-3 py-2 text-sm text-white focus:border-pbx-ui-brand/60 focus:outline-none"
            />
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} className="h-4 w-4 accent-pbx-ui-hi" />
            Shown to guests
          </label>

          {error && (
            <p className="rounded-lg border border-[#ff5e87]/40 bg-[#ff5e87]/10 px-3 py-2 text-xs text-[#ff8aa8]">{error}</p>
          )}

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <button onClick={onClose} disabled={Boolean(busy)} className="rounded-full px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={Boolean(busy) || !overlayUrl || noWindow || isJpgWithoutKey}
              className="rounded-full bg-pbx-ui-hi px-5 py-2 text-sm font-semibold text-pbx-ui-hi-fg transition hover:bg-pbx-ui-hi-strong disabled:opacity-40"
            >
              {frame ? 'Save changes' : 'Add GIF frame'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GifFrameEditor;
