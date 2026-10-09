import React from 'react';
import { formatBoothCopy, type BoothCopywriting, type BoothTheme } from '@photo-booth/types';

export type TimedCapturePhase = 'idle' | 'starting' | 'active' | 'ended';

export interface CaptureSlot {
  slotNumber: number;
  isCurrent: boolean;
  isComplete: boolean;
  photoUrl?: string;
}

export interface CaptureViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  isTimedFlow: boolean;
  isAutoFlow: boolean;
  currentPhotoSlot: number;
  totalSlots: number;
  attemptNumber: number;
  maxAttempts: number;
  currentSlotAttemptCount: number;
  timedPhase: TimedCapturePhase;
  timedClock: number;
  timedStartCountLeft: number;
  isMirrored: boolean;
  countdown: number;
  isStarted: boolean;
  isPreparing: boolean;
  isCapturing: boolean;
  feedReady: boolean;
  cameraError?: string | null;
  isFlash: boolean;
  slots: CaptureSlot[];
  /** Aspect ratio of the camera feed, used for empty slot placeholders. */
  photoAspectRatio: number;
  latestPhoto?: string;
  showPhotoSlotArrows: boolean;
  /**
   * The live camera image. The booth passes the Canon frame or `<video>`; the
   * admin preview substitutes a placeholder because there is no device.
   */
  cameraFeed: React.ReactNode;
  onToggleMirror?: () => void;
  onRetry?: () => void;
  /** The slot strip is horizontally scrollable; the screen owns the scrolling. */
  slotStripRef?: React.RefObject<HTMLDivElement>;
  onSlotStripScroll?: () => void;
  canScrollSlotsLeft?: boolean;
  canScrollSlotsRight?: boolean;
  onScrollSlotsLeft?: () => void;
  onScrollSlotsRight?: () => void;
  /** Attached to the active slot so the screen can scroll it into view. */
  activeSlotRef?: React.RefObject<HTMLSpanElement>;
  /** Reports a loaded slot photo's true aspect ratio so empty slots match. */
  onSlotPhotoLoad?: (naturalWidth: number, naturalHeight: number) => void;
}

/**
 * Presentational core of the capture screen: the live feed, header chips,
 * countdown/callouts, timed previous-photo card and the photo-slot progress
 * bar. The screen owns all camera, countdown and session logic.
 */
export const CaptureView: React.FC<CaptureViewProps> = ({
  copy,
  theme,
  isTimedFlow,
  isAutoFlow,
  currentPhotoSlot,
  totalSlots,
  attemptNumber,
  maxAttempts,
  currentSlotAttemptCount,
  timedPhase,
  timedClock,
  timedStartCountLeft,
  isMirrored,
  countdown,
  isStarted,
  isPreparing,
  isCapturing,
  feedReady,
  cameraError,
  isFlash,
  slots,
  photoAspectRatio,
  latestPhoto,
  showPhotoSlotArrows,
  cameraFeed,
  onToggleMirror,
  onRetry,
  slotStripRef,
  onSlotStripScroll,
  canScrollSlotsLeft,
  canScrollSlotsRight,
  onScrollSlotsLeft,
  onScrollSlotsRight,
  activeSlotRef,
  onSlotPhotoLoad,
}) => (
  <div
    className={`relative h-full w-full select-none overflow-hidden bg-black text-white ${!isStarted ? 'cursor-pointer' : ''}`}
    // Always over a camera/photo scrim: white reads on any theme.
    style={{ backgroundColor: theme.deep, color: '#ffffff' }}
    aria-label="Fullscreen camera live view"
  >
    {cameraFeed}

    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />
    {isFlash && <div className="pointer-events-none absolute inset-0 z-[70] bg-white" />}

    <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-8 sm:py-7">
      <div className="rounded-[12px] bg-black/45 px-4 py-3 backdrop-blur-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">
          {isTimedFlow
            ? copy.captureTimedSessionLabel
            : formatBoothCopy(copy.captureSlotLabel, {
                current: currentPhotoSlot,
                total: totalSlots,
              })}
        </p>
        <p className="mt-1 text-xl font-black uppercase tracking-[-0.02em] sm:text-2xl">
          {isTimedFlow
            ? formatBoothCopy(copy.captureTimedPhotoCount, { count: currentSlotAttemptCount })
            : formatBoothCopy(copy.captureAttemptLabel, {
                current: attemptNumber,
                total: maxAttempts,
              })}
        </p>
      </div>

      {isTimedFlow && (
        <div className="min-w-24 rounded-[12px] bg-black/45 px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">
            {timedPhase === 'active' ? copy.captureTimeLeftLabel : copy.captureSessionLabel}
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums">
            {String(Math.floor(timedClock / 60)).padStart(2, '0')}:
            {String(timedClock % 60).padStart(2, '0')}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onToggleMirror}
        disabled={!onToggleMirror}
        className="shrink-0 rounded-[10px] border-[3px] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] backdrop-blur-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
        style={{
          borderColor: theme.secondary,
          backgroundColor: theme.card,
          color: theme.secondary,
        }}
        aria-pressed={isMirrored}
        title="Toggle mirrored preview"
      >
        {isMirrored ? copy.captureMirrorOn : copy.captureMirrorOff}
      </button>
    </header>

    {!feedReady && !cameraError && (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 text-sm font-bold uppercase tracking-[0.18em]">
        {copy.captureStarting}
      </div>
    )}

    {cameraError && (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/65 px-6 text-center">
        <span className="max-w-xl text-sm font-bold text-white sm:text-base">{cameraError}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[8px] border-[3px] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            borderColor: theme.secondary,
            backgroundColor: theme.tertiary,
            color: theme.tertiaryForeground,
          }}
        >
          {copy.captureRetry}
        </button>
      </div>
    )}

    {isStarted && countdown > 0 && (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
        <div className="text-[clamp(6rem,22%,14rem)] font-bold leading-none tabular-nums drop-shadow-lg">
          {countdown}
        </div>
        <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/90">
          {isPreparing ? copy.capturePreparing : copy.captureHoldPose}
        </div>
      </div>
    )}
    {isStarted && countdown === 0 && !isCapturing && (
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-3xl font-bold uppercase tracking-[0.12em] drop-shadow-lg sm:text-5xl">
        {copy.captureCheese}
      </div>
    )}

    {isTimedFlow && timedPhase === 'starting' && (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/20">
        <div className="text-[clamp(6rem,22%,14rem)] font-bold leading-none tabular-nums drop-shadow-lg">
          {timedStartCountLeft}
        </div>
        <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em]">
          {copy.captureGetReady}
        </div>
      </div>
    )}

    {!isStarted &&
      feedReady &&
      !cameraError &&
      (isTimedFlow && timedPhase === 'idle' ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">
            {copy.captureTapToStart}
          </p>
        </div>
      ) : isTimedFlow && timedPhase === 'active' ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">
            {copy.captureTapToCapture}
          </p>
        </div>
      ) : !isAutoFlow ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">
            {copy.captureTapToCapture}
          </p>
        </div>
      ) : null)}

    {isTimedFlow && latestPhoto && (
      <aside
        className="absolute bottom-24 right-5 z-20 w-48 rounded-[12px] border-[3px] p-2 backdrop-blur-sm sm:bottom-28 sm:right-8 sm:w-64"
        style={{ borderColor: theme.secondary, backgroundColor: theme.card }}
      >
        <span
          className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white shadow-[0_2px_0_rgba(0,0,0,0.45)]"
          style={{ backgroundColor: theme.primary }}
        >
          {currentSlotAttemptCount}
        </span>
        <img
          src={latestPhoto}
          alt="Foto precedente"
          className="h-44 w-full rounded-[8px] bg-black/35 object-contain shadow-lg sm:h-56"
        />
        <p
          className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em]"
          style={{ color: theme.surfaceForeground }}
        >
          {copy.capturePreviousPhoto}
        </p>
      </aside>
    )}

    <footer className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-5 pb-5 sm:px-8 sm:pb-7">
      {!isTimedFlow && (
        <nav
          className="mx-auto flex w-full max-w-[min(92vw,1200px)] items-center justify-center gap-2"
          aria-label="Photo slot progress"
        >
          {showPhotoSlotArrows && (
            <button
              type="button"
              aria-label="Previous photo slots"
              disabled={!canScrollSlotsLeft}
              onClick={onScrollSlotsLeft}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-3xl text-white enabled:hover:bg-white/15 disabled:opacity-30"
            >
              ‹
            </button>
          )}

          <div
            ref={slotStripRef}
            onScroll={onSlotStripScroll}
            className="min-w-0 flex-1 overflow-x-auto scroll-smooth"
          >
            <div className="flex w-max min-w-full items-center justify-center gap-2 px-1">
              {slots.map((slot) => (
                <span
                  key={slot.slotNumber}
                  ref={slot.isCurrent ? activeSlotRef : null}
                  aria-current={slot.isCurrent ? 'step' : undefined}
                  className={`flex shrink-0 flex-col items-center gap-1 border-b-4 px-2 py-2 text-xs font-bold sm:px-3 sm:py-3 ${
                    slot.isCurrent
                      ? 'border-white bg-white/20 text-white'
                      : slot.isComplete
                        ? 'border-white/60 text-white/80'
                        : 'border-white/25 text-white/60'
                  }`}
                >
                  {slot.photoUrl ? (
                    <img
                      src={slot.photoUrl}
                      alt={`Photo slot ${slot.slotNumber}`}
                      className="h-24 w-auto max-w-40 object-contain sm:h-32 sm:max-w-56"
                      onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget;
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          onSlotPhotoLoad?.(naturalWidth, naturalHeight);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="relative flex h-24 shrink-0 items-center justify-center border border-white/35 sm:h-32"
                      style={{ aspectRatio: photoAspectRatio }}
                    >
                      <span className="px-2 text-center text-white/60">
                        Photo slot {slot.slotNumber}
                      </span>
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {showPhotoSlotArrows && (
            <button
              type="button"
              aria-label="Next photo slots"
              disabled={!canScrollSlotsRight}
              onClick={onScrollSlotsRight}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-3xl text-white enabled:hover:bg-white/15 disabled:opacity-30"
            >
              ›
            </button>
          )}
        </nav>
      )}

      {isTimedFlow && <div className="w-16" aria-hidden="true" />}
    </footer>

    {/* Held from Live View teardown until the shot lands, so guests keep still. */}
    {(isPreparing || isCapturing) && (
      <div
        className="absolute inset-0 z-[60] flex items-center justify-center px-6 text-center text-4xl font-bold sm:text-6xl"
        style={{ backgroundColor: theme.card, color: theme.cardForeground }}
        role="status"
        aria-live="polite"
      >
        {copy.captureHoldStill}
      </div>
    )}
  </div>
);

export default CaptureView;
