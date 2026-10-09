import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FrameConfig, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';
import { resolveFrameTemplate, resolveObjectPosition } from '../../utils/frameConfig';
import { MAX_PHOTO_SCALE, usePhotoGestures } from './usePhotoGestures';

/**
 * Per-slot photo framing for the booth's frame preview: drag to move, pinch
 * (two pointers) or scroll to zoom. Same model as the organize page:
 *  - scale 1: x/y pan the cover crop (object-position, 0..1)
 *  - scale > 1: offsetX/offsetY translate the zoomed photo (1 - scale..0)
 *
 * One slot is selected at a time. Touching a photo selects it; after that the
 * gestures work anywhere on the surface (the element the `surface` handlers
 * are attached to), so small slots stay easy to drag and pinch on phones.
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

export interface SlotRect {
  left: string;
  top: string;
  width: string;
  height: string;
  transform?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialFor = (slot: FramePhotoPlacement): PhotoAdjustment => {
  const position = resolveObjectPosition(slot.objectPosition);
  const scale = clamp(slot.photoScale ?? 1, 1, MAX_PHOTO_SCALE);
  return {
    x: position.x,
    y: position.y,
    scale,
    offsetX: clamp(slot.photoOffsetX ?? 0, 1 - scale, 0),
    offsetY: clamp(slot.photoOffsetY ?? 0, 1 - scale, 0),
  };
};

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

  /** Slot indexes that actually hold a photo (only those can be adjusted). */
  const photoIndexes = useMemo(
    () =>
      template.photoSlots.flatMap((slot, i) =>
        photoUrls[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1] ? [i] : [],
      ),
    [template, photoUrls],
  );

  const [selectedIndex, setSelectedIndex] = useState(photoIndexes[0] ?? -1);
  useEffect(() => {
    setSelectedIndex((current) => (photoIndexes.includes(current) ? current : (photoIndexes[0] ?? -1)));
  }, [photoIndexes]);

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

  const interacted = useRef(false);
  const { surfaceHandlers } = usePhotoGestures({
    template,
    getAdjustment: (index) => adjustmentsRef.current[index] ?? initial[index],
    setAdjustment: (index, next) =>
      setAdjustments((all) => all.map((a, i) => (i === index ? { ...a, ...next } : a))),
    isAdjustable: (index) => photoIndexes.includes(index),
    selectedIndex,
    onSelect: setSelectedIndex,
    onAdjust: () => {
      if (interacted.current) return;
      interacted.current = true;
      onFirstInteraction?.();
    },
  });

  /** Percent box of a slot within the frame canvas, for overlays. */
  const slotRects = useMemo<SlotRect[]>(() => {
    const pct = (v: number, total: number) => `${(v / total) * 100}%`;
    return template.photoSlots.map((slot) => ({
      left: pct(slot.x, template.width),
      top: pct(slot.y, template.height),
      width: pct(slot.width, template.width),
      height: pct(slot.height, template.height),
      transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
    }));
  }, [template]);

  return {
    template,
    displayTemplate,
    adjustedFrame,
    isDirty,
    reset,
    photoIndexes,
    selectedIndex,
    selectedRect: selectedIndex >= 0 ? slotRects[selectedIndex] : null,
    slotRects,
    /** Attach to the element that should take gestures (the whole preview area). */
    surfaceHandlers,
  };
};
