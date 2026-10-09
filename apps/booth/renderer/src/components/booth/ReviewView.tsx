import React from 'react';
import { formatBoothCopy, type BoothCopywriting, type BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';

export interface ReviewViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  photoUrl?: string;
  currentSlot: number;
  attemptCount: number;
  maxAttempts: number;
  onRetake?: () => void;
  onUse?: () => void;
}

/**
 * Presentational core of the review screen: the fresh shot drops in as a
 * tilted print over a blurred copy of itself, with header chips, a filmstrip
 * attempt counter and the retake / use buttons. Shared with the admin
 * appearance preview. The screen owns the fixed/viewport sizing.
 *
 * Overlay text is white on a black scrim on purpose: the theme's foreground
 * tokens are tuned for light surfaces and can be dark (e.g. charcoal).
 */
export const ReviewView: React.FC<ReviewViewProps> = ({
  copy,
  theme,
  photoUrl,
  currentSlot,
  attemptCount,
  maxAttempts,
  onRetake,
  onUse,
}) => {
  const maxAttemptsReached = attemptCount >= maxAttempts;
  const attemptFrames = Array.from({ length: Math.min(maxAttempts, 8) }, (_, index) => index + 1);

  return (
    <div
      className="pb-screen pb-flow-anim relative h-full w-full select-none overflow-hidden"
      style={{ backgroundColor: theme.deep, color: '#ffffff' }}
    >
      {/* Blurred, darkened copy of the photo fills the screen behind the print */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${withAlpha(theme.deep, 0.25)} 0%, ${withAlpha(theme.deep, 0.85)} 100%)`,
        }}
      />

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-[4cqw] py-[4cqh]">
        <div
          className="rounded-[1.6cqmin] px-[2.2cqmin] py-[1.4cqmin] backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', animation: 'pb-rise-pop 0.5s ease-out both' }}
        >
          <p className="text-[1.7cqmin] font-black uppercase tracking-[0.16em] text-white/70">{copy.reviewHeader}</p>
          <h1 className="mt-[0.4cqmin] text-[3.4cqmin] font-black uppercase leading-none tracking-[-0.02em]">
            {formatBoothCopy(copy.reviewPhotoLabel, { current: currentSlot })}
          </h1>
        </div>

        {/* Attempts as film frames: used ones show the shot, the current one is lit */}
        <div
          className="flex flex-col items-end gap-[0.8cqmin] rounded-[1.6cqmin] px-[2.2cqmin] py-[1.4cqmin] backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', animation: 'pb-rise-pop 0.5s ease-out 0.08s both' }}
          aria-label={`${copy.reviewAttemptLabel} ${attemptCount}/${maxAttempts}`}
        >
          <p className="text-[1.7cqmin] font-black uppercase tracking-[0.16em] text-white/70">
            {copy.reviewAttemptLabel}{' '}
            <span className="text-white">
              {attemptCount}/{maxAttempts}
            </span>
          </p>
          <div className="flex gap-[0.6cqmin] rounded-[0.6cqmin] bg-black/70 px-[0.8cqmin] py-[0.6cqmin]">
            {attemptFrames.map((n) => (
              <span
                key={n}
                className="h-[3cqmin] w-[4cqmin] rounded-[0.3cqmin] border-[0.25cqmin]"
                style={
                  n === attemptCount
                    ? { borderColor: theme.tertiary, backgroundColor: withAlpha(theme.tertiary, 0.85) }
                    : n < attemptCount
                      ? { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.3)' }
                      : { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent' }
                }
              />
            ))}
          </div>
        </div>
      </header>

      {/* The print */}
      <div className="absolute inset-x-0 bottom-[25cqh] top-[16cqh] flex items-center justify-center px-[4cqw]">
        {photoUrl ? (
          <figure
            key={photoUrl}
            className="flex h-full max-w-full flex-col bg-white p-[1.4cqmin] pb-[1.4cqmin]"
            style={
              {
                '--pr': '-1.5deg',
                boxShadow: `0 2.4cqmin 5cqmin rgba(0,0,0,0.55)`,
                animation: 'pb-print-drop 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.15) 0.1s both',
              } as React.CSSProperties
            }
          >
            <img
              src={photoUrl}
              alt={`Captured attempt ${attemptCount}`}
              className="h-full max-w-full object-contain"
              style={{ animation: 'pb-develop 1.8s ease-out 0.4s both' }}
            />
          </figure>
        ) : (
          <p className="text-[2.4cqmin] font-bold uppercase tracking-[0.16em] text-white/70">{copy.reviewNoPhoto}</p>
        )}
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-[1.8cqmin] px-[4cqw] pb-[4cqh]">
        <div className="flex items-center gap-[1.4cqmin]" style={{ animation: 'pb-rise-pop 0.5s ease-out 0.5s both' }}>
          <p className="text-[2.6cqmin] font-black uppercase tracking-[0.1em] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
            {copy.reviewQuestion}
          </p>
          {maxAttemptsReached && (
            <span
              className="rounded-full px-[1.8cqmin] py-[0.6cqmin] text-[1.8cqmin] font-black uppercase tracking-[0.12em]"
              style={{
                backgroundColor: theme.primary,
                color: theme.primaryForeground,
                animation: 'pb-icon-wiggle 2.4s ease-in-out infinite',
              }}
            >
              {copy.reviewLastChance}
            </span>
          )}
        </div>

        <div className="flex w-full max-w-[90cqmin] gap-[2cqmin]" style={{ animation: 'pb-rise-pop 0.5s ease-out 0.6s both' }}>
          <button
            type="button"
            onClick={onRetake}
            disabled={maxAttemptsReached || !onRetake}
            className="flex min-h-[8cqmin] flex-1 items-center justify-center gap-[1.2cqmin] rounded-[1.6cqmin] border-[0.4cqmin] px-[2cqmin] text-[2.4cqmin] font-black uppercase tracking-[0.1em] transition-all enabled:hover:-translate-y-0.5 enabled:active:translate-y-0"
            style={
              maxAttemptsReached
                ? {
                    borderColor: 'rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'not-allowed',
                  }
                : {
                    borderColor: theme.card,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    color: '#ffffff',
                    backdropFilter: 'blur(6px)',
                  }
            }
          >
            <span className="text-[3cqmin] leading-none" aria-hidden="true">
              ↺
            </span>
            {copy.reviewRetakeButton}
          </button>

          <button
            type="button"
            onClick={onUse}
            disabled={!onUse}
            className="flex min-h-[8cqmin] flex-1 items-center justify-center gap-[1.2cqmin] rounded-[1.6cqmin] border-[0.4cqmin] px-[2cqmin] text-[2.4cqmin] font-black uppercase tracking-[0.1em] transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={
              {
                borderColor: theme.deep,
                backgroundColor: theme.action,
                color: theme.actionForeground,
                '--glow': withAlpha(theme.action, 0.55),
                animation: 'pb-cta-breathe 2.2s ease-in-out 1.2s infinite',
              } as React.CSSProperties
            }
          >
            <span className="text-[3cqmin] leading-none" aria-hidden="true">
              ✓
            </span>
            {copy.reviewUseButton}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ReviewView;
