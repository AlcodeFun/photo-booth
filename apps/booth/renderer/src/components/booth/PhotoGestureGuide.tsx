import React, { useEffect, useState } from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';

/**
 * Animated "you can move / zoom your photo" guide.
 *
 * Two pieces share one cycle (move demo, then zoom demo, repeat):
 *  - GestureSlotHint sits on top of a real photo slot: a pulsing outline and
 *    ghost touch points performing the gesture right where the guest will.
 *  - GestureGuideCard floats over the preview: a mini photo that pans / zooms
 *    in sync, with the instruction for the current gesture.
 * Both are pointer-transparent except the card, which dismisses on tap.
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
  <span className={`absolute left-1/2 top-1/2 -ml-[14px] -mt-[14px] h-7 w-7 ${className ?? ''}`} style={style}>
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

export const GestureSlotHint: React.FC<{
  theme: BoothTheme;
  mode: GuideMode;
  /** Slot box in percent of the frame canvas. */
  rect: { left: string; top: string; width: string; height: string };
}> = ({ theme, mode, rect }) => {
  const duration = `${CYCLE_MS}ms`;
  return (
    <div className="pb-guide-anim pointer-events-none absolute z-[60]" style={rect} aria-hidden="true">
      <div
        className="absolute -inset-1 rounded-md border-[3px] border-dashed"
        style={{ borderColor: theme.primary, animation: 'pb-guide-outline 1.2s ease-in-out infinite' }}
      />
      <div key={mode} className="absolute inset-0">
        {mode === 'move' ? (
          <TouchPoint theme={theme} style={{ animation: `pb-guide-swipe ${duration} ease-in-out both` }} />
        ) : (
          <>
            {[
              { gx: '-110%', gy: '-110%' },
              { gx: '110%', gy: '110%' },
            ].map((dir, i) => (
              <TouchPoint
                key={i}
                theme={theme}
                style={
                  {
                    '--gx': dir.gx,
                    '--gy': dir.gy,
                    animation: `pb-guide-pinch ${duration} ease-in-out both`,
                  } as React.CSSProperties
                }
              />
            ))}
          </>
        )}
      </div>
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
      className="pb-guide-anim absolute bottom-[4%] left-1/2 z-[70]"
      style={{ animation: 'pb-guide-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.4s both' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="flex items-center gap-3 rounded-[20px] border-[3px] py-2.5 pl-2.5 pr-5 text-left"
        style={{
          borderColor: theme.deep,
          backgroundColor: theme.card,
          color: theme.cardForeground,
          boxShadow: `0 6px 0 ${theme.deep}, 0 18px 40px ${withAlpha(theme.deep, 0.35)}`,
          animation: 'pb-guide-float 3.2s ease-in-out 1s infinite',
        }}
      >
        {/* mini preview: the demo photo follows the gesture */}
        <span
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border-2"
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
          <span key={`dot-${mode}`} className="absolute inset-0">
            {mode === 'move' ? (
              <TouchPoint theme={theme} className="scale-[0.6]" style={{ animation: `pb-guide-swipe ${duration} ease-in-out both` }} />
            ) : (
              [
                { gx: '-90%', gy: '-90%' },
                { gx: '90%', gy: '90%' },
              ].map((dir, i) => (
                <TouchPoint
                  key={i}
                  theme={theme}
                  className="scale-[0.6]"
                  style={
                    {
                      '--gx': dir.gx,
                      '--gy': dir.gy,
                      animation: `pb-guide-pinch ${duration} ease-in-out both`,
                    } as React.CSSProperties
                  }
                />
              ))
            )}
          </span>
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black"
              style={{ backgroundColor: theme.primary, color: theme.primaryForeground }}
              aria-hidden="true"
            >
              {mode === 'move' ? '✥' : '⤢'}
            </span>
            <span
              key={mode}
              className="block whitespace-nowrap text-base font-black uppercase tracking-[0.04em] sm:text-lg"
              style={{ animation: 'pb-guide-swap 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3) both' }}
            >
              {mode === 'move' ? copy.filterGuideMove : copy.filterGuideZoom}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            {(['move', 'zoom'] as const).map((m) => (
              <span
                key={m}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: m === mode ? 22 : 8,
                  backgroundColor: m === mode ? theme.primary : withAlpha(theme.cardForeground, 0.25),
                }}
              />
            ))}
            <span className="ml-1 text-xs font-semibold opacity-60">{copy.filterGuideHint}</span>
          </span>
        </span>
      </button>
    </div>
  );
};
