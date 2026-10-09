import React, { useEffect, useState } from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';
import type { SlotRect } from './usePhotoAdjustments';

/**
 * Photo move / zoom overlays for the filter screen.
 *
 *  - SlotSelectionLayer marks the selected photo slot (solid outline + badge)
 *    and the other adjustable slots (faint dashes). While the guide is on, ghost
 *    touch points perform the current gesture on the selected slot.
 *  - GestureGuideCard floats over the preview: a mini photo that pans / zooms
 *    in sync, with the instruction for the current gesture.
 * Everything is pointer-transparent except the card, which dismisses on tap.
 */

export type GuideMode = 'move' | 'zoom';

const CYCLE_MS = 2800;

/** Alternates move/zoom; each switch re-keys the demos so they restart in sync. */
export const useGuideMode = (active: boolean): GuideMode => {
  const [mode, setMode] = useState<GuideMode>('move');
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setMode((m) => (m === 'move' ? 'zoom' : 'move')), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [active]);
  return mode;
};

const TouchPoint: React.FC<{ theme: BoothTheme; style?: React.CSSProperties; className?: string }> = ({
  theme,
  style,
  className,
}) => (
  <span className={`absolute left-1/2 top-1/2 ${className ?? 'pb-touch-point'}`} style={style}>
    <span
      className="absolute inset-0 rounded-full"
      style={{ backgroundColor: withAlpha(theme.primary, 0.6), animation: 'pb-guide-ripple 1.1s ease-out infinite' }}
    />
    <span
      className="absolute inset-0 rounded-full border-[3px] bg-white"
      style={{ borderColor: theme.primary, boxShadow: `0 4px 14px ${withAlpha(theme.deep, 0.45)}` }}
    />
  </span>
);

const GestureDemo: React.FC<{ theme: BoothTheme; mode: GuideMode; className?: string; spread: string }> = ({
  theme,
  mode,
  className,
  spread,
}) => {
  const duration = `${CYCLE_MS}ms`;
  return (
    <span key={mode} className="absolute inset-0">
      {mode === 'move' ? (
        <TouchPoint theme={theme} className={className} style={{ animation: `pb-guide-swipe ${duration} ease-in-out both` }} />
      ) : (
        [`-${spread}`, spread].map((d, i) => (
          <TouchPoint
            key={i}
            theme={theme}
            className={className}
            style={
              {
                '--gx': d,
                '--gy': d,
                animation: `pb-guide-pinch ${duration} ease-in-out both`,
              } as React.CSSProperties
            }
          />
        ))
      )}
    </span>
  );
};

export const SlotSelectionLayer: React.FC<{
  theme: BoothTheme;
  /** Percent boxes of every slot within the frame canvas. */
  slotRects: SlotRect[];
  photoIndexes: number[];
  selectedIndex: number;
  /** Show the ghost-finger demo on the selected slot. */
  showDemo: boolean;
  mode: GuideMode;
}> = ({ theme, slotRects, photoIndexes, selectedIndex, showDemo, mode }) => {
  const several = photoIndexes.length > 1;
  return (
    <div className="pb-guide-anim pointer-events-none absolute inset-0 z-[60]" aria-hidden="true">
      {several &&
        photoIndexes
          .filter((i) => i !== selectedIndex)
          .map((i) => (
            <div
              key={i}
              className="absolute rounded-[4px] border-2 border-dashed"
              style={{ ...slotRects[i], borderColor: 'rgba(255,255,255,0.75)', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
            />
          ))}

      {selectedIndex >= 0 && slotRects[selectedIndex] && (
        <div key={selectedIndex} className="absolute" style={slotRects[selectedIndex]}>
          <div
            className="absolute -inset-[3px] rounded-[6px] border-[3px]"
            // White ring + dark halo reads on any frame artwork and any theme.
            style={{
              borderColor: '#ffffff',
              boxShadow: `0 0 0 2px ${theme.deep}, 0 0 0 5px ${withAlpha(theme.tertiary, 0.9)}, 0 0 22px ${withAlpha(theme.tertiary, 0.8)}`,
              animation: 'pb-bounce-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3) both, pb-slot-glow 1.6s ease-in-out 0.35s infinite',
            }}
          />
          {several && (
            <span
              className="absolute -left-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[0.7rem] font-black sm:h-7 sm:w-7 sm:text-xs"
              style={{
                backgroundColor: theme.primary,
                color: theme.primaryForeground,
                borderColor: '#ffffff',
                animation: 'pb-bounce-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.05s both',
              }}
            >
              ✥
            </span>
          )}
          {showDemo && <GestureDemo theme={theme} mode={mode} spread="110%" />}
        </div>
      )}
    </div>
  );
};

export const GestureGuideCard: React.FC<{
  theme: BoothTheme;
  copy: BoothCopywriting;
  mode: GuideMode;
  samplePhoto?: string;
  onDismiss?: () => void;
}> = ({ theme, copy, mode, samplePhoto, onDismiss }) => {
  const duration = `${CYCLE_MS}ms`;
  return (
    <div
      className="pb-guide-anim pointer-events-none absolute bottom-2 left-1/2 z-[70] w-max max-w-[calc(100%-1rem)] sm:bottom-[4%]"
      style={{ animation: 'pb-guide-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.4s both' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto flex items-center gap-2 rounded-[14px] border-2 py-1.5 pl-1.5 pr-3 text-left sm:gap-3 sm:rounded-[20px] sm:border-[3px] sm:py-2.5 sm:pl-2.5 sm:pr-5"
        style={{
          borderColor: theme.deep,
          backgroundColor: theme.card,
          color: theme.cardForeground,
          boxShadow: `0 4px 0 ${theme.deep}, 0 14px 30px ${withAlpha(theme.deep, 0.35)}`,
          animation: 'pb-guide-float 3.2s ease-in-out 1s infinite',
        }}
      >
        {/* mini preview: the demo photo follows the gesture */}
        <span
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border-2 sm:h-16 sm:w-16 sm:rounded-[12px]"
          style={{ borderColor: theme.deep, backgroundColor: theme.deep }}
        >
          <span
            key={mode}
            className="absolute inset-[-14%] bg-cover bg-center"
            style={{
              backgroundImage: samplePhoto ? `url("${samplePhoto}")` : undefined,
              backgroundColor: samplePhoto ? undefined : theme.secondary,
              animation: `${mode === 'move' ? 'pb-guide-photo-pan' : 'pb-guide-photo-zoom'} ${duration} ease-in-out both`,
            }}
          />
          <GestureDemo theme={theme} mode={mode} spread="90%" className="-ml-[7px] -mt-[7px] h-3.5 w-3.5 sm:-ml-[9px] sm:-mt-[9px] sm:h-[18px] sm:w-[18px]" />
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <span
              className="hidden h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black sm:grid"
              style={{ backgroundColor: theme.primary, color: theme.primaryForeground }}
              aria-hidden="true"
            >
              {mode === 'move' ? '✥' : '⤢'}
            </span>
            <span
              key={mode}
              className="block text-[0.8rem] font-black uppercase leading-tight tracking-[0.02em] sm:whitespace-nowrap sm:text-lg sm:tracking-[0.04em]"
              style={{ animation: 'pb-guide-swap 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3) both' }}
            >
              {mode === 'move' ? copy.filterGuideMove : copy.filterGuideZoom}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-1.5 sm:gap-2">
            {(['move', 'zoom'] as const).map((m) => (
              <span
                key={m}
                className="h-1 rounded-full transition-all duration-300 sm:h-1.5"
                style={{
                  width: m === mode ? 18 : 6,
                  backgroundColor: m === mode ? theme.primary : withAlpha(theme.cardForeground, 0.25),
                }}
              />
            ))}
            <span className="ml-1 hidden text-xs font-semibold opacity-60 sm:inline">{copy.filterGuideHint}</span>
          </span>
        </span>
      </button>
    </div>
  );
};
