import type { CSSProperties } from 'react';
import { FrameConfig, FrameTemplateConfig } from '@photo-booth/types';
import { resolveFrameTemplate } from '../utils/frameConfig';

interface FrameCanvasProps {
  frame?: FrameConfig | null;
  photos?: Array<string | undefined>;
  photoSlotCount?: number;
  template?: FrameTemplateConfig;
  filter?: string;
  className?: string;
  style?: CSSProperties;
  showGuides?: boolean;
  activeSlotNumber?: number;
  onSlotSelect?: (slotNumber: number) => void;
  /** Real QR code image to render inside each QR placeholder (replaces the placeholder graphic). */
  qrCodeUrl?: string;
}

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

/** Solid placeholder per source photo — a distinct color for each source slot. */
const SLOT_PLACEHOLDER_COLORS = [
  '#c24b9a',
  '#7d4fd1',
  '#9a7b1f',
  '#1e9fd8',
  '#c96a26',
  '#3fa463',
  '#d45454',
  '#5a6fb0',
  '#b7588f',
];

export const FrameCanvas = ({
  frame,
  photos = [],
  photoSlotCount,
  template,
  filter = 'none',
  className = '',
  style,
  showGuides = false,
  activeSlotNumber,
  onSlotSelect,
  qrCodeUrl,
}: FrameCanvasProps) => {
  const resolvedSlotCount = photoSlotCount ?? Math.max(photos.length, 1);
  const resolvedTemplate = template ?? resolveFrameTemplate(frame, resolvedSlotCount);
  const frameLayerZIndex = resolvedTemplate.frameLayerZIndex ?? 30;

  const canvasStyle: CSSProperties = {
    aspectRatio: `${resolvedTemplate.width} / ${resolvedTemplate.height}`,
    backgroundColor: resolvedTemplate.backgroundColor,
    containerType: 'inline-size' as CSSProperties['containerType'],
    ...style,
  };

  return (
    <div
      className={`relative overflow-hidden border shadow-2xl bg-blue-600 border-blue-400 text-white ${className}`}
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
          containerType: 'inline-size' as CSSProperties['containerType'],
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
                draggable={false}
                className={`h-full w-full ${slot.objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                style={{ objectPosition: slot.objectPosition ?? 'center', filter }}
              />
            ) : (
              <span
                className="grid h-full w-full place-items-center whitespace-nowrap font-bold tracking-tight text-white"
                style={{
                  fontSize: 'clamp(0.3125rem, 13cqw, 0.9375rem)',
                  backgroundColor: SLOT_PLACEHOLDER_COLORS[(sourcePhotoSlot - 1) % SLOT_PLACEHOLDER_COLORS.length],
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.45)',
                }}
              >
                Photo {sourcePhotoSlot}
              </span>
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

      {resolvedTemplate.qrSlots?.map((qrSlot) => {
        const qrStyle: CSSProperties = {
          left: toPercent(qrSlot.x, resolvedTemplate.width),
          top: toPercent(qrSlot.y, resolvedTemplate.height),
          width: toPercent(qrSlot.width, resolvedTemplate.width),
          height: toPercent(qrSlot.height, resolvedTemplate.height),
          borderRadius: qrSlot.borderRadius,
          transform: qrSlot.rotation ? `rotate(${qrSlot.rotation}deg)` : undefined,
          zIndex: qrSlot.zIndex ?? 30,
          containerType: 'inline-size' as CSSProperties['containerType'],
        };

        return (
          <div
            key={qrSlot.slotNumber}
            className="absolute pointer-events-none overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
            style={qrStyle}
            aria-label={`QR placeholder ${qrSlot.slotNumber}`}
          >
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="" className="absolute inset-0 h-full w-full object-fill" draggable={false} />
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="absolute inset-0 m-auto h-[68%] w-[68%] text-zinc-900"
                  aria-hidden="true"
                >
                  <path d="M3 3h7v7H3zM4 4v5h5V4h-5z" />
                  <path d="M14 3h7v7h-7zM15 4v5h5V4h-5z" />
                  <path d="M3 14h7v7H3zM4 15v5h5v-5h-5z" />
                  <path d="M14 14h1.8v1.8H14zM17 14h1.8v1.8H17zM14 17h1.8v1.8H14zM17.6 17h1.8v1.8h-1.8zM14 20h5v2h-5zM20 19.5h2v2.5h-2z" />
                  <path d="M7 7.5h2.5V10H7zM15 7.5h2.5V10H15zM8.5 15h2.5v2.5H8.5z" opacity=".85" />
                </svg>
                <span
                  className="absolute bottom-1 left-0 right-0 text-center font-bold uppercase tracking-widest text-zinc-700"
                  style={{ fontSize: 'clamp(0.25rem, 6cqw, 0.75rem)' }}
                >
                  QR
                </span>
              </>
            )}
          </div>
        );
      })}

      {resolvedTemplate.assetUrl ? (
        <img
          src={resolvedTemplate.assetUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-fill pointer-events-none"
          style={{ zIndex: frameLayerZIndex }}
        />
      ) : (
        <div className="absolute inset-0 border-0 pointer-events-none" style={{ zIndex: frameLayerZIndex }}>
          <div className="absolute inset-x-10 bottom-10 border-t border-current/30 pt-5 text-center text-[10px] font-semibold uppercase tracking-[0.4em] opacity-70">
            {frame?.name ?? 'Frame'}
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
