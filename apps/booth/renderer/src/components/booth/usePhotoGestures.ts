import { useRef, type PointerEvent, type WheelEvent } from 'react';
import type { FrameTemplateConfig } from '@photo-booth/types';

/**
 * Move / pinch / scroll gestures for photos inside frame slots, shared by the
 * filter screen and the organize page. The caller owns the adjustment state
 * and the selection; this only turns pointer input into adjustments.
 *
 * Model (same as FrameCanvas and the print renderer):
 *  - scale 1: x/y pan the cover crop (object-position, 0..1)
 *  - scale > 1: offsetX/offsetY translate the zoomed photo (1 - scale..0)
 *
 * Attach `surfaceHandlers` to the area that should take gestures, around a
 * FrameCanvas (its slots carry data-slot-number). Touching a photo selects
 * it; touching anywhere else drives the selected photo, so small slots stay
 * easy to drag and pinch on phones. A plain tap is left alone (no pointer
 * capture until the pointer really moves), so slot click handlers still fire.
 */

export interface GestureAdjustment {
  x: number;
  y: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
}

export const MAX_PHOTO_SCALE = 3;
const DRAG_THRESHOLD = 4;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Zoom anchor in slot-relative units: the pointer when it is over the slot,
 * otherwise the slot center (gestures may start anywhere on the surface).
 */
const anchorIn = (rect: DOMRect, clientX: number, clientY: number) => {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  return { midX: inside ? x : 0.5, midY: inside ? y : 0.5 };
};

interface Gesture {
  index: number;
  rect: DOMRect;
  overflowX: number;
  overflowY: number;
  start: GestureAdjustment;
  /** Single-pointer drag origin. */
  originX: number;
  originY: number;
  /** Pinch baseline (two pointers). */
  pinch?: { dist: number; midX: number; midY: number; clientX: number; clientY: number };
  /** Pointer capture taken (only once the gesture really moves). */
  captured: boolean;
}

export interface PhotoGestureOptions {
  template: FrameTemplateConfig | null;
  /** Current adjustment of a slot index. */
  getAdjustment: (index: number) => GestureAdjustment;
  setAdjustment: (index: number, next: Partial<GestureAdjustment>) => void;
  /** Whether a slot holds a photo that can be moved / zoomed. */
  isAdjustable: (index: number) => boolean;
  /** Currently selected slot index, or -1. */
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Fired whenever a move / zoom actually changes something. */
  onAdjust?: () => void;
}

export const usePhotoGestures = ({
  template,
  getAdjustment,
  setAdjustment,
  isAdjustable,
  selectedIndex,
  onSelect,
  onAdjust,
}: PhotoGestureOptions) => {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);
  // Handlers can run between renders; read the latest selection from a ref.
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;

  const slotElement = (surface: HTMLElement, index: number) => {
    const slot = template?.photoSlots[index];
    return slot ? surface.querySelector<HTMLElement>(`[data-slot-number="${slot.slotNumber}"]`) : null;
  };

  /** Slot index under the pointer (any slot, with or without a photo), or -1. */
  const slotIndexAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('[data-slot-number]');
    if (!el || !template) return -1;
    const slotNumber = Number(el.getAttribute('data-slot-number'));
    return template.photoSlots.findIndex((s) => s.slotNumber === slotNumber);
  };

  /** (Re)starts a gesture from the pointers currently down, at the latest state. */
  const begin = (index: number, surface: HTMLElement, captured: boolean) => {
    const el = slotElement(surface, index);
    const placement = template?.photoSlots[index];
    if (!el || !placement) {
      gesture.current = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const image = el.querySelector('img');
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
      start: getAdjustment(index),
      originX: points[0]?.x ?? 0,
      originY: points[0]?.y ?? 0,
      captured,
    };
    if (points.length >= 2) {
      const [p1, p2] = points;
      const clientX = (p1.x + p2.x) / 2;
      const clientY = (p1.y + p2.y) / 2;
      g.pinch = {
        dist: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        ...anchorIn(rect, clientX, clientY),
        clientX,
        clientY,
      };
    }
    gesture.current = g;
  };

  const capture = (surface: HTMLElement) => {
    const g = gesture.current;
    if (!g || g.captured) return;
    g.captured = true;
    dragged.current = true;
    for (const id of pointers.current.keys()) {
      try {
        surface.setPointerCapture(id);
      } catch {
        // pointer already gone
      }
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // Real buttons on the surface (reset, guide card, panels) keep their clicks.
    if ((event.target as Element).closest('button:not([data-slot-number])')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointers.current.size === 0) dragged.current = false;

    let index = gesture.current?.index ?? -1;
    if (index < 0) {
      // First finger: a photo under it gets selected and driven; on an empty
      // slot leave the tap to the slot; anywhere else drive the selection.
      const hit = slotIndexAt(event.target);
      if (hit >= 0 && !isAdjustable(hit)) return;
      index = hit >= 0 ? hit : selectedRef.current;
      if (index < 0 || !isAdjustable(index)) return;
      if (hit >= 0 && hit !== selectedRef.current) onSelect(hit);
    }

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinching = pointers.current.size >= 2;
    begin(index, event.currentTarget, gesture.current?.captured ?? false);
    if (pinching) capture(event.currentTarget);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];

    if (g.pinch && points.length >= 2) {
      const [p1, p2] = points;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      // The anchor follows the fingers from where the pinch started, so it
      // never jumps when they cross the slot edge.
      const midX = g.pinch.midX + ((p1.x + p2.x) / 2 - g.pinch.clientX) / g.rect.width;
      const midY = g.pinch.midY + ((p1.y + p2.y) / 2 - g.pinch.clientY) / g.rect.height;
      const scale = clamp(g.start.scale * (dist / g.pinch.dist), 1, MAX_PHOTO_SCALE);
      const factor = scale / g.start.scale;
      setAdjustment(g.index, {
        scale,
        offsetX: clamp(midX - factor * (g.pinch.midX - (g.start.offsetX ?? 0)), 1 - scale, 0),
        offsetY: clamp(midY - factor * (g.pinch.midY - (g.start.offsetY ?? 0)), 1 - scale, 0),
      });
      onAdjust?.();
      return;
    }

    const dx = event.clientX - g.originX;
    const dy = event.clientY - g.originY;
    if (!g.captured) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      capture(event.currentTarget);
    }
    if (g.start.scale <= 1.001) {
      setAdjustment(g.index, {
        x: g.overflowX > 0 ? clamp(g.start.x - dx / g.overflowX, 0, 1) : g.start.x,
        y: g.overflowY > 0 ? clamp(g.start.y - dy / g.overflowY, 0, 1) : g.start.y,
      });
    } else {
      setAdjustment(g.index, {
        offsetX: clamp((g.start.offsetX ?? 0) + dx / g.rect.width, 1 - g.start.scale, 0),
        offsetY: clamp((g.start.offsetY ?? 0) + dy / g.rect.height, 1 - g.start.scale, 0),
      });
    }
    onAdjust?.();
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (pointers.current.size === 0 || !g) {
      gesture.current = null;
      return;
    }
    // Pinch -> one finger left: continue as a drag from where things are now.
    begin(g.index, event.currentTarget, g.captured);
  };

  const onWheel = (event: WheelEvent<HTMLElement>) => {
    if (event.deltaY === 0) return;
    const hit = slotIndexAt(event.target);
    const index = hit >= 0 && isAdjustable(hit) ? hit : selectedRef.current;
    if (index < 0 || !isAdjustable(index)) return;
    const el = slotElement(event.currentTarget, index);
    if (!el) return;
    if (index !== selectedRef.current) onSelect(index);
    const rect = el.getBoundingClientRect();
    const { midX: px, midY: py } = anchorIn(rect, event.clientX, event.clientY);
    const current = getAdjustment(index);
    const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0015), 1, MAX_PHOTO_SCALE);
    const factor = scale / current.scale;
    setAdjustment(index, {
      scale,
      offsetX: clamp(px - factor * (px - (current.offsetX ?? 0)), 1 - scale, 0),
      offsetY: clamp(py - factor * (py - (current.offsetY ?? 0)), 1 - scale, 0),
    });
    onAdjust?.();
  };

  return {
    surfaceHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
    },
    /**
     * True when the last pointer sequence moved / pinched a photo. Click
     * handlers on the surface use it to ignore the click that ends a drag.
     */
    wasDrag: () => dragged.current,
  };
};
