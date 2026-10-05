import React from 'react';
import { formatBoothCopy, type BoothCopywriting, type BoothTheme } from '@photo-booth/types';

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
 * Presentational core of the review screen: a full-bleed photo with the
 * gradient scrim, header chips and footer controls. Shared with the admin
 * appearance preview. The screen owns the fixed/viewport sizing.
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
  const attemptDots = Array.from({ length: Math.min(maxAttempts, 8) }, (_, index) => index + 1);

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden bg-black text-white"
      style={{ backgroundColor: theme.deep, color: theme.primaryForeground }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Captured attempt ${attemptCount}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold uppercase tracking-[0.16em]">
          {copy.reviewNoPhoto}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="rounded-[12px] bg-black/45 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">{copy.reviewHeader}</p>
          <h1 className="mt-1 text-xl font-black uppercase tracking-[-0.02em] sm:text-2xl">
            {formatBoothCopy(copy.reviewPhotoLabel, { current: currentSlot })}
          </h1>
        </div>
        <div className="rounded-[12px] bg-black/45 px-4 py-3 text-right backdrop-blur-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">{copy.reviewAttemptLabel}</p>
          <p className="mt-1 text-xl font-black tabular-nums">
            {attemptCount}
            <span className="text-white/65">/{maxAttempts}</span>
          </p>
        </div>
      </header>

      <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-5 pb-5 sm:px-8 sm:pb-7">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-black uppercase tracking-[0.12em] sm:text-base">{copy.reviewQuestion}</p>
          <div className="flex items-center gap-2" aria-label={`Attempt ${attemptCount} of ${maxAttempts}`}>
            {attemptDots.map((n) => (
              <span
                key={n}
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: n <= attemptCount ? theme.accent : 'rgba(255,255,255,0.35)' }}
              />
            ))}
          </div>
        </div>

        {maxAttemptsReached && (
          <span
            className="rounded-[10px] border-[3px] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_rgba(0,0,0,0.45)]"
            style={{ borderColor: theme.primaryForeground, backgroundColor: theme.primary }}
          >
            {copy.reviewLastChance}
          </span>
        )}

        <div className="flex w-full max-w-lg gap-3">
          <button
            type="button"
            onClick={onRetake}
            disabled={maxAttemptsReached || !onRetake}
            className="min-h-14 flex-1 rounded-[10px] border-[3px] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] transition-all"
            style={
              maxAttemptsReached
                ? {
                    borderColor: 'rgba(255,255,255,0.4)',
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'not-allowed',
                  }
                : {
                    borderColor: theme.secondary,
                    backgroundColor: theme.card,
                    color: theme.secondary,
                  }
            }
          >
            {copy.reviewRetakeButton}
          </button>

          <button
            type="button"
            onClick={onUse}
            disabled={!onUse}
            className="min-h-14 flex-1 rounded-[10px] border-[3px] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              borderColor: theme.secondary,
              backgroundColor: theme.tertiary,
              color: theme.tertiaryForeground,
            }}
          >
            {copy.reviewUseButton}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ReviewView;
