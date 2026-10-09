import React, { useMemo } from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';

export interface CompleteViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  onDone?: () => void;
  /**
   * Seconds until the screen returns to the start on its own. Drives the
   * countdown ring around the button; omitted in the preview (no ring timer).
   */
  autoResetSeconds?: number;
}

const CHECK_LEN = 60;
const RING_R = 22;
const RING_LEN = 2 * Math.PI * RING_R;

/**
 * Presentational core of the completion screen: confetti, a self-drawing check
 * and a ring that visibly drains until the automatic return to the start. The
 * screen owns the actual reset timer; this only mirrors its duration.
 */
export const CompleteView: React.FC<CompleteViewProps> = ({ copy, theme, onDone, autoResetSeconds }) => {
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 53) % 100}%`,
        color: [theme.primary, theme.tertiary, theme.secondary, theme.accent, theme.action][i % 5],
        size: 7 + ((i * 7) % 6),
        round: i % 3 === 0,
        duration: 2.6 + ((i * 11) % 18) / 10,
        delay: ((i * 3) % 12) / 10,
        drift: `${((i * 13) % 21) - 10}cqw`,
        spin: `${360 + ((i * 41) % 540)}deg`,
      })),
    [theme],
  );

  return (
    <div className="pb-screen pb-flow-anim relative flex h-full w-full items-center justify-center select-none">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confetti.map((piece, i) => (
          <span
            key={i}
            className="absolute top-0"
            style={
              {
                left: piece.left,
                width: piece.size,
                height: piece.round ? piece.size : piece.size * 1.8,
                borderRadius: piece.round ? '50%' : 2,
                backgroundColor: piece.color,
                '--cx': piece.drift,
                '--cr': piece.spin,
                animation: `pb-confetti-fall ${piece.duration}s cubic-bezier(0.3, 0.6, 0.5, 1) ${piece.delay}s both`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-[900px] rounded-[18px] border-[4px] p-4 md:p-6"
        style={{
          borderColor: theme.deep,
          backgroundColor: theme.surface,
          boxShadow: `0 10px 0 ${theme.deep}`,
          backgroundImage: `radial-gradient(${withAlpha(theme.surfaceForeground, 0.08)} 1.5px, transparent 1.8px)`,
          backgroundSize: '22px 22px',
          animation: 'pb-modal-zoom 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.25) both',
        }}
      >
        <div className="rounded-[14px] p-6 text-center" style={{ color: theme.surfaceForeground }}>
          {/* Self-drawing check inside a popping badge */}
          <div
            className="relative mx-auto mb-6 h-24 w-24 sm:h-28 sm:w-28"
            style={{ animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.2s both' }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: withAlpha(theme.primary, 0.35), animation: 'pb-guide-ripple 1.8s ease-out 0.8s infinite' }}
            />
            <svg viewBox="0 0 64 64" className="relative h-full w-full" aria-hidden="true">
              <circle cx="32" cy="32" r="29" fill={theme.primary} stroke={theme.deep} strokeWidth="3" />
              <path
                d="M19 33 l9 9 l17 -19"
                fill="none"
                stroke={theme.primaryForeground}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={
                  {
                    strokeDasharray: CHECK_LEN,
                    '--len': CHECK_LEN,
                    animation: 'pb-draw 0.5s ease-out 0.7s both',
                  } as React.CSSProperties
                }
              />
            </svg>
          </div>

          <h1
            className="text-[1.8rem] font-black uppercase leading-none tracking-[-0.05em] sm:text-[2.6rem] md:text-[3.6rem]"
            style={{ animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.45s both' }}
          >
            {copy.completeTitle}
          </h1>
          <p
            className="mx-auto mt-4 max-w-md text-base font-semibold leading-relaxed opacity-85"
            style={{ animation: 'pb-rise-pop 0.6s ease-out 0.6s both' }}
          >
            {copy.completeBody}
          </p>

          <div
            className="mt-8 flex flex-col items-center gap-4"
            style={{ animation: 'pb-rise-pop 0.6s ease-out 0.75s both' }}
          >
            <button
              type="button"
              onClick={onDone}
              disabled={!onDone}
              className="flex w-full max-w-md items-center justify-center gap-3 rounded-[14px] border-[3px] px-6 py-3 text-[0.85rem] font-black uppercase tracking-[0.16em] shadow-[0_5px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: theme.action, color: theme.actionForeground, borderColor: theme.deep }}
            >
              {/* Countdown ring: drains over the auto-reset delay */}
              <svg viewBox="0 0 50 50" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden="true">
                <circle cx="25" cy="25" r={RING_R} fill="none" stroke={withAlpha(theme.actionForeground, 0.2)} strokeWidth="5" />
                <circle
                  cx="25"
                  cy="25"
                  r={RING_R}
                  fill="none"
                  stroke={theme.actionForeground}
                  strokeWidth="5"
                  strokeLinecap="round"
                  style={
                    {
                      strokeDasharray: RING_LEN,
                      '--len': RING_LEN,
                      animation: autoResetSeconds ? `pb-ring-drain ${autoResetSeconds}s linear both` : undefined,
                    } as React.CSSProperties
                  }
                />
              </svg>
              {copy.completeButton}
            </button>
            <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] opacity-70">
              {copy.completeFootnote}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteView;
