import type { CSSProperties } from 'react';
import { FrameConfig, FrameTemplateConfig } from '@photo-booth/types';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';

interface FrameCanvasProps {
  frame?: FrameConfig | null;
  photos?: Array<string | undefined>;
  photoSlotCount?: number;
  template?: FrameTemplateConfig;
  filterClassName?: string;
  className?: string;
  showGuides?: boolean;
  activeSlotNumber?: number;
  onSlotSelect?: (slotNumber: number) => void;
}

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

export const FrameCanvas = ({
  frame,
  photos = [],
  photoSlotCount,
  template,
  filterClassName = '',
  className = '',
  showGuides = false,
  activeSlotNumber,
  onSlotSelect,
}: FrameCanvasProps) => {
  const resolvedSlotCount = photoSlotCount ?? Math.max(photos.length, 1);
  const resolvedTemplate = template ?? resolveFrameTemplate(frame, resolvedSlotCount);
  const frameLayerZIndex = resolvedTemplate.frameLayerZIndex ?? 30;

  const canvasStyle: CSSProperties = {
    aspectRatio: `${resolvedTemplate.width} / ${resolvedTemplate.height}`,
    backgroundColor: resolvedTemplate.backgroundColor,
  };

  return (
    <div
      className={`relative overflow-hidden border shadow-2xl ${frame?.theme ?? 'bg-zinc-950 border-zinc-800 text-white'} ${className}`}
      style={canvasStyle}
    >
      {resolvedTemplate.photoSlots.map((slot) => {
        const sourcePhotoSlot = slot.sourcePhotoSlot ?? slot.slotNumber;
        const photoUrl = photos[sourcePhotoSlot - 1];
        const isActive = activeSlotNumber === slot.slotNumber;
        const slotStyle: CSSProperties = {
          left: toPercent(slot.x, resolvedTemplate.width),
          top: toPercent(slot.y, resolvedTemplate.height),
          width: toPercent(slot.width, resolvedTemplate.width),
          height: toPercent(slot.height, resolvedTemplate.height),
          borderRadius: slot.borderRadius,
          transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
          zIndex: slot.zIndex ?? 10,
        };

        const slotClassName = `absolute flex items-center justify-center overflow-hidden bg-black text-[10px] font-semibold uppercase tracking-wider text-white/50 transition-all ${
          onSlotSelect ? 'cursor-pointer' : 'cursor-default'
        } ${
          showGuides
            ? isActive
              ? 'outline outline-4 outline-sky-400'
              : 'outline outline-2 outline-white/40'
            : ''
        }`;
        const content = (
          <>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Source photo ${sourcePhotoSlot}`}
                className={`h-full w-full ${slot.objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${filterClassName}`}
                style={{ objectPosition: slot.objectPosition ?? 'center' }}
              />
            ) : (
              <span>Photo {sourcePhotoSlot}</span>
            )}
          </>
        );

        if (onSlotSelect) {
          return (
            <button
              key={slot.slotNumber}
              type="button"
              onClick={() => onSlotSelect(slot.slotNumber)}
              className={slotClassName}
              style={slotStyle}
              aria-label={`Photo area ${slot.slotNumber}, source photo ${sourcePhotoSlot}`}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={slot.slotNumber}
            className={slotClassName}
            style={slotStyle}
            aria-label={`Photo area ${slot.slotNumber}, source photo ${sourcePhotoSlot}`}
          >
            {content}
          </div>
        );
      })}

      {resolvedTemplate.assetUrl ? (
        <img
          src={resolvedTemplate.assetUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-fill pointer-events-none"
          style={{ zIndex: frameLayerZIndex }}
        />
      ) : (
        <div
          className="absolute inset-0 border-[18px] border-current/60 pointer-events-none"
          style={{ zIndex: frameLayerZIndex }}
        >
          <div className="absolute inset-x-10 bottom-10 border-t border-current/30 pt-5 text-center text-[10px] font-semibold uppercase tracking-[0.4em] opacity-70">
            {frame?.name ?? 'Frame Template'}
          </div>
        </div>
      )}

      {showGuides && (
        <div
          className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white/80"
          style={{ zIndex: frameLayerZIndex + 1 }}
        >
          {resolvedTemplate.width} x {resolvedTemplate.height}
        </div>
      )}
    </div>
  );
};

export default FrameCanvas;
