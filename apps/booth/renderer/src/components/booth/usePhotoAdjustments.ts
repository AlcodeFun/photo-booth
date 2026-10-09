import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { FrameConfig, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';
import { resolveFrameTemplate, resolveObjectPosition } from '../../utils/frameConfig';

/**
 * Per-slot photo framing for the booth's frame preview: drag to move, pinch
 * (two pointers) or scroll to zoom. Same model as the organize page:
 *  - scale 1: x/y pan the cover crop (object-position, 0..1)
 *  - scale > 1: offsetX/offsetY translate the zoomed photo (1 - scale..0)
 *
 * `adjustedFrame` carries the result in the frame's own template, so every
 * downstream renderer (screen, print, GIFs, upload) honors it unchanged.
 */

export interface PhotoAdjustment {
  x: number;
  y: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const MAX_SCALE = 3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialFor = (slot: FramePhotoPlacement): PhotoAdjustment => {
  const position = resolveObjectPosition(slot.objectPosition);
  const scale = clamp(slot.photoScale ?? 1, 1, MAX_SCALE);
  return {
    x: position.x,
    y: position.y,
    scale,
    offsetX: clamp(slot.photoOffsetX ?? 0, 1 - scale, 0),
    offsetY: clamp(slot.photoOffsetY ?? 0, 1 - scale, 0),
  };
};

interface Gesture {
  index: number;
  rect: DOMRect;
  overflowX: number;
  overflowY: number;
  start: PhotoAdjustment;
  /** Single-pointer drag origin. */
  originX: number;
  originY: number;
  /** Pinch baseline (two pointers). */
  pinch?: { dist: number; midX: number; midY: number };
}

export const usePhotoAdjustments = (
  frame: FrameConfig | null,
  photoSlotCount: number,
  photoUrls: Array<string | undefined>,
  onFirstInteraction?: () => void,
) => {
  const template = useMemo<FrameTemplateConfig>(
    () => resolveFrameTemplate(frame, photoSlotCount),
    [frame, photoSlotCount],
  );
  const initial = useMemo(() => template.photoSlots.map(initialFor), [template]);
  const [adjustments, setAdjustments] = useState<PhotoAdjustment[]>(initial);
  const adjustmentsRef = useRef(adjustments);
  adjustmentsRef.current = adjustments;

  useEffect(() => setAdjustments(initial), [initial]);

  const displayTemplate = useMemo<FrameTemplateConfig>(
    () => ({
      ...template,
      photoSlots: template.photoSlots.map((slot, i) => {
        const a = adjustments[i] ?? initial[i];
        return {
          ...slot,
          objectPosition: `${a.x * 100}% ${a.y * 100}%`,
          photoScale: a.scale,
          photoOffsetX: a.offsetX,
          photoOffsetY: a.offsetY,
        };
      }),
    }),
    [template, adjustments, initial],
  );

  const adjustedFrame = useMemo<FrameConfig | null>(
    () =>
      frame
        ? {
            ...frame,
            template: displayTemplate,
            templatesByPhotoSlots: {
              ...frame.templatesByPhotoSlots,
              [Math.max(1, Math.floor(photoSlotCount))]: displayTemplate,
            },
          }
        : null,
    [frame, displayTemplate, photoSlotCount],
  );

  const isDirty = useMemo(
    () => JSON.stringify(adjustments) !== JSON.stringify(initial),
    [adjustments, initial],
  );

  const reset = useCallback(() => setAdjustments(initial), [initial]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const interacted = useRef(false);

  const markInteraction = () => {
    if (interacted.current) return;
    interacted.current = true;
    onFirstInteraction?.();
  };

  const slotIndex = (slotNumber: number) => template.photoSlots.findIndex((s) => s.slotNumber === slotNumber);

  const hasPhoto = (index: number) => {
    const slot = template.photoSlots[index];
    return Boolean(slot && photoUrls[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1]);
  };

  const update = (index: number, next: Partial<PhotoAdjustment>) =>
    setAdjustments((all) => all.map((a, i) => (i === index ? { ...a, ...next } : a)));

  /** (Re)starts a gesture from the pointers currently down, at the latest state. */
  const begin = (index: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const image = el.querySelector('img');
    const placement = template.photoSlots[index];
    const cover = (placement.objectFit ?? 'cover') === 'cover';
    const coverScale =
      image?.naturalWidth && image.naturalHeight
        ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
        : 1;
    const points = [...pointers.current.values()];
    const g: Gesture = {
      index,
      rect,
      overflowX: cover && image?.naturalWidth ? Math.max(0, image.naturalWidth * coverScale - rect.width) : 0,
      overflowY: cover && image?.naturalHeight ? Math.max(0, image.naturalHeight * coverScale - rect.height) : 0,
      start: adjustmentsRef.current[index] ?? initial[index],
      originX: points[0]?.x ?? 0,
      originY: points[0]?.y ?? 0,
    };
    if (points.length >= 2) {
      const [p1, p2] = points;
      g.pinch = {
        dist: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        midX: ((p1.x + p2.x) / 2 - rect.left) / rect.width,
        midY: ((p1.y + p2.y) / 2 - rect.top) / rect.height,
      };
    }
    gesture.current = g;
  };

  const onSlotPointerDown = (slotNumber: number, event: PointerEvent<HTMLButtonElement>) => {
    const index = slotIndex(slotNumber);
    if (index < 0 || !hasPhoto(index)) return;
    if (gesture.current && gesture.current.index !== index) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    markInteraction();
    begin(index, event.currentTarget);
  };

  const onSlotPointerMove = (_slotNumber: number, event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];

    if (g.pinch && points.length >= 2) {
      const [p1, p2] = points;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = ((p1.x + p2.x) / 2 - g.rect.left) / g.rect.width;
      const midY = ((p1.y + p2.y) / 2 - g.rect.top) / g.rect.height;
      const scale = clamp(g.start.scale * (dist / g.pinch.dist), 1, MAX_SCALE);
      const factor = scale / g.start.scale;
      // Keep the content under the fingers' midpoint pinned while it moves.
      update(g.index, {
        scale,
        offsetX: clamp(midX - factor * (g.pinch.midX - g.start.offsetX), 1 - scale, 0),
        offsetY: clamp(midY - factor * (g.pinch.midY - g.start.offsetY), 1 - scale, 0),
      });
      return;
    }

    const dx = event.clientX - g.originX;
    const dy = event.clientY - g.originY;
    if (g.start.scale <= 1.001) {
      update(g.index, {
        x: g.overflowX > 0 ? clamp(g.start.x - dx / g.overflowX, 0, 1) : g.start.x,
        y: g.overflowY > 0 ? clamp(g.start.y - dy / g.overflowY, 0, 1) : g.start.y,
      });
    } else {
      update(g.index, {
        offsetX: clamp(g.start.offsetX + dx / g.rect.width, 1 - g.start.scale, 0),
        offsetY: clamp(g.start.offsetY + dy / g.rect.height, 1 - g.start.scale, 0),
      });
    }
  };

  const onSlotPointerUp = (_slotNumber: number, event: PointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (pointers.current.size === 0 || !g) {
      gesture.current = null;
      return;
    }
    // Pinch -> one finger left: continue as a drag from where things are now.
    begin(g.index, event.currentTarget);
  };

  const onSlotWheel = (slotNumber: number, event: WheelEvent<HTMLButtonElement>) => {
    const index = slotIndex(slotNumber);
    if (index < 0 || !hasPhoto(index) || event.deltaY === 0) return;
    markInteraction();
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const current = adjustmentsRef.current[index] ?? initial[index];
    const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0015), 1, MAX_SCALE);
    const factor = scale / current.scale;
    update(index, {
      scale,
      offsetX: clamp(px - factor * (px - current.offsetX), 1 - scale, 0),
      offsetY: clamp(py - factor * (py - current.offsetY), 1 - scale, 0),
    });
  };

  /** First slot that holds a photo, as a percent box for the guide overlay. */
  const guideRect = useMemo(() => {
    const index = template.photoSlots.findIndex((_, i) => hasPhoto(i));
    const slot = template.photoSlots[index >= 0 ? index : 0];
    if (!slot) return null;
    const pct = (v: number, total: number) => `${(v / total) * 100}%`;
    return {
      left: pct(slot.x, template.width),
      top: pct(slot.y, template.height),
      width: pct(slot.width, template.width),
      height: pct(slot.height, template.height),
    };
    // hasPhoto reads photoUrls/template only.
  }, [template, photoUrls]);

  return {
    template,
    displayTemplate,
    adjustedFrame,
    isDirty,
    reset,
    guideRect,
    handlers: { onSlotPointerDown, onSlotPointerMove, onSlotPointerUp, onSlotWheel },
  };
};
