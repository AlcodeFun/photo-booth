import React, { useEffect, useState } from 'react';
import { formatBoothCopy, type BoothCopywriting, type BoothTheme, type FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { withAlpha } from '../../lib/appearance';

export interface ResultsViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** `true` shows the QR alone; `false` shows framed + slideshow + live/gif + QR. */
  isTimedFlow: boolean;
  frame: FrameConfig | null;
  photoUrls: Array<string | undefined>;
  photoSlotCount: number;
  filterStyle: string;
  /** Data URLs produced by the session's canvas/GIF work. Absent in the preview. */
  liveUrl?: string | null;
  gifUrl?: string | null;
  qrDataUrl?: string | null;
  showFramed: boolean;
  showAllPhotos: boolean;
  showLive: boolean;
  showGif: boolean;
  isDone: boolean;
  canFinish: boolean;
  surfaceStyle?: React.CSSProperties;
  onFinish?: () => void;
  onViewFramed?: () => void;
  /** Opens the fullscreen gallery of every captured photo. */
  onOpenGallery?: () => void;
  onViewLive?: () => void;
  onViewGif?: () => void;
  /** Opens the enlarged QR modal. */
  onOpenQr?: () => void;
}

/**
 * Presentational core of the results screen: framed photo (left), photo
 * slideshow plus live/GIF results (middle), and QR + Finish (right). The timed
 * flow hides everything but the QR column.
 *
 * Sizing uses percentages rather than the `vh` units this screen originally used,
 * so the same markup renders correctly both full-screen in the booth and scaled
 * down inside the admin preview stage.
 */
export const ResultsView: React.FC<ResultsViewProps> = ({
  copy,
  theme,
  isTimedFlow,
  frame,
  photoUrls,
  photoSlotCount,
  filterStyle,
  liveUrl,
  gifUrl,
  qrDataUrl,
  showFramed,
  showAllPhotos,
  showLive,
  showGif,
  isDone,
  canFinish,
  surfaceStyle,
  onFinish,
  onViewFramed,
  onOpenGallery,
  onViewLive,
  onViewGif,
  onOpenQr,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (photoUrls.length <= 1) {
      setSlideIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSlideIndex((current) => (current + 1) % photoUrls.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [photoUrls.length]);

  const visiblePhotos = photoUrls.filter((url): url is string => Boolean(url));

  return (
    <div
      className="print-qrpage relative flex h-full w-full flex-col overflow-hidden"
      style={{
        ...surfaceStyle,
        color: theme.deep,
        animation: 'pb-modal-fade 0.25s ease-out both',
      }}
    >
      {/* Floating background cuteness */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {[
          { left: '6%', top: '14%', size: 'text-xl', delay: '0s', rot: '12deg' },
          { right: '10%', top: '10%', size: 'text-2xl', delay: '0.6s', rot: '-6deg' },
          { left: '14%', bottom: '12%', size: 'text-2xl', delay: '1.1s', rot: '4deg' },
          { right: '12%', bottom: '16%', size: 'text-xl', delay: '1.6s', rot: '-10deg' },
        ].map((s, i) => (
          <span
            key={i}
            className={`absolute ${s.size} opacity-30 select-none`}
            style={{
              left: s.left,
              right: s.right,
              top: s.top,
              bottom: s.bottom,
              transform: `rotate(${s.rot})`,
              animation: 'pb-balloon-float 6s ease-in-out infinite',
              animationDelay: s.delay,
              ['--dx' as string]: '14px',
              ['--dy' as string]: '-16px',
              ['--rot' as string]: s.rot,
            }}
          >
            {['💖', '⭐', '🎀', '✨'][i]}
          </span>
        ))}
      </div>

      {/* Main result — framed (left), photo slideshow + live (middle), QR (right).
          The timed flow shows the QR alone (it points at /p/:token, whose
          arrange section lets the customer compose the frame for print). */}
      <div className="print-no-show pb-scroll relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:overflow-hidden">
        <div className="relative z-10 flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-center">
          {/* Left: framed photo — clickable to zoom */}
          {!isTimedFlow && (
            <button
              type="button"
              onClick={onViewFramed}
              disabled={!onViewFramed}
              title="View framed photo larger"
              aria-label="View framed photo larger"
              className="group relative mx-auto flex h-[34%] w-full max-w-[260px] min-h-0 shrink-0 cursor-pointer items-center justify-center self-center bg-transparent p-0 sm:max-w-[300px] lg:h-auto lg:max-w-none lg:flex-1 lg:self-auto"
              style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            >
              {frame && photoSlotCount > 0 && showFramed ? (
                <>
                  <div className="relative flex h-full w-full min-h-0 items-center justify-center">
                    <FrameCanvas
                      frame={frame}
                      photos={photoUrls}
                      photoSlotCount={photoSlotCount}
                      filter={filterStyle}
                      qrCodeUrl={qrDataUrl ?? undefined}
                      className="max-h-full w-auto max-w-full rounded-md bg-white shadow-[0_14px_30px_rgba(77,45,133,0.25)] transition-transform group-hover:scale-[1.02]"
                      style={{ height: '100%', aspectRatio: '3 / 4' }}
                    />
                    <span
                      className="pointer-events-none absolute -right-1.5 -top-1.5 text-2xl"
                      style={{ animation: 'pb-float 3.5s ease-in-out infinite' }}
                    >
                      💖
                    </span>
                  </div>
                </>
              ) : (
                <span
                  className="rounded-lg bg-white/60 px-4 py-6 text-center text-sm font-bold"
                  style={{ color: withAlpha(theme.deep, 0.6) }}
                >
                  {copy.resultsNoFramed}
                </span>
              )}
            </button>
          )}

          {/* Middle: photo slideshow + live/GIF results below, same size */}
          {!isTimedFlow && (
            <div
              className="flex min-h-0 flex-1 flex-col gap-3"
              style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.08s both' }}
            >
              <button
                type="button"
                onClick={onOpenGallery}
                disabled={!onOpenGallery || visiblePhotos.length === 0}
                title="View all photos"
                aria-label={formatBoothCopy(copy.resultsViewAllPhotos, { count: visiblePhotos.length })}
                className="group relative flex min-h-0 min-h-[26%] w-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 bg-white p-1.5 transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0 sm:p-2.5"
                style={{
                  borderColor: theme.secondary,
                  boxShadow: `0 6px 0 ${withAlpha(theme.secondary, 0.2)}`,
                }}
              >
                {showAllPhotos && visiblePhotos.length > 0 ? (
                  <>
                    <div className="relative m-auto h-full w-full overflow-hidden rounded-md bg-black/10">
                      <div
                        className="flex h-full w-full transition-transform duration-700 ease-out"
                        style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                      >
                        {visiblePhotos.map((dataUrl, index) => (
                          <img
                            key={index}
                            src={dataUrl}
                            alt={formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                            draggable={false}
                            className="h-full w-full shrink-0 object-cover"
                          />
                        ))}
                      </div>
                    </div>
                    {/* Slideshow dots */}
                    {visiblePhotos.length > 1 && (
                      <span className="pointer-events-none absolute inset-x-0 top-2 flex justify-center gap-1.5">
                        {visiblePhotos.map((_, index) => (
                          <span
                            key={index}
                            className="h-2.5 w-2.5 rounded-full transition-all duration-300"
                            style={
                              index === slideIndex % visiblePhotos.length
                                ? {
                                    width: '1.25rem',
                                    backgroundColor: theme.primary,
                                    boxShadow: `0 0 6px ${withAlpha(theme.primary, 0.8)}`,
                                  }
                                : { backgroundColor: withAlpha(theme.deep, 0.3) }
                            }
                          />
                        ))}
                      </span>
                    )}
                    <span
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white"
                      style={{ backgroundColor: withAlpha(theme.primary, 0.9) }}
                    >
                      💖 {formatBoothCopy(copy.resultsViewAllPhotos, { count: visiblePhotos.length })}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-center text-sm font-bold"
                    style={{ color: withAlpha(theme.deep, 0.6) }}
                  >
                    {showAllPhotos ? copy.resultsNoIndividualPhotos : copy.resultsCollectionOff}
                  </span>
                )}
              </button>

              {/* Framed live result */}
              {liveUrl && showLive && (
                <button
                  type="button"
                  onClick={onViewLive}
                  disabled={!onViewLive}
                  title="View framed live photo"
                  aria-label="View framed live photo"
                  className="group relative flex min-h-0 min-h-[24%] w-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 bg-white p-1.5 transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0 sm:p-2.5"
                  style={{
                    borderColor: theme.action,
                    boxShadow: `0 6px 0 ${withAlpha(theme.action, 0.25)}`,
                  }}
                >
                  <img
                    src={liveUrl}
                    alt={copy.resultsLiveBadge}
                    className="h-full w-full rounded-md object-cover"
                  />
                  <span
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white"
                    style={{ backgroundColor: withAlpha(theme.action, 0.9) }}
                  >
                    📹 {copy.resultsLiveBadge}
                  </span>
                </button>
              )}

              {/* Plain animated GIF result */}
              {gifUrl && showGif && (
                <button
                  type="button"
                  onClick={onViewGif}
                  disabled={!onViewGif}
                  title="View animated GIF"
                  aria-label="View animated GIF"
                  className="group relative flex min-h-0 min-h-[24%] w-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 bg-white p-1.5 transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0 sm:p-2.5"
                  style={{
                    borderColor: theme.secondary,
                    boxShadow: `0 6px 0 ${withAlpha(theme.secondary, 0.25)}`,
                  }}
                >
                  <img
                    src={gifUrl}
                    alt={copy.resultsGifBadge}
                    className="h-full w-full rounded-md object-cover"
                  />
                  <span
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white"
                    style={{ backgroundColor: withAlpha(theme.secondary, 0.9) }}
                  >
                    🎞️ {copy.resultsGifBadge}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Right: QR + Finish Session */}
          <div
            className={`flex min-h-0 flex-col items-center justify-center gap-5 ${isTimedFlow ? 'flex-1 lg:gap-10' : 'shrink-0 lg:w-64 lg:gap-[9rem] xl:w-72'}`}
            style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.16s both' }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className="text-center text-[0.6rem] font-black uppercase tracking-[0.2em]"
                style={{ color: theme.deep }}
              >
                {isTimedFlow ? copy.resultsQrArrange : copy.resultsQrDownload}
              </span>
              <button
                type="button"
                onClick={onOpenQr}
                disabled={!onOpenQr || !qrDataUrl}
                title="Enlarge QR code"
                aria-label="Enlarge QR code"
                className="relative block w-full cursor-pointer overflow-hidden rounded-[18px] border-4 bg-white p-3 transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0"
                style={{
                  borderColor: theme.secondary,
                  boxShadow: `0 8px 0 ${withAlpha(theme.secondary, 0.25)}`,
                }}
              >
                {qrDataUrl ? (
                  <>
                    <img
                      src={qrDataUrl}
                      alt={copy.resultsQrDownload}
                      className="h-40 w-40 sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-64 lg:w-64"
                    />
                    {/* Pulsing aura */}
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[14px]"
                      style={{ animation: 'pb-pulse-ring 2.4s ease-out infinite' }}
                    />
                    {/* Scanning line */}
                    <span
                      className="pointer-events-none absolute inset-x-4 top-4 z-10 h-[3px] rounded-full"
                      style={{
                        backgroundColor: withAlpha(theme.primary, 0.8),
                        boxShadow: `0 0 10px ${withAlpha(theme.primary, 0.9)}`,
                        animation: 'pb-scan 2.8s ease-in-out infinite',
                      }}
                    />
                  </>
                ) : (
                  <div
                    className="flex h-40 w-40 flex-col items-center justify-center gap-1 text-center text-[0.6rem] font-black uppercase tracking-[0.18em] sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-64 lg:w-64"
                    style={{ color: theme.deep }}
                  >
                    <span className="pb-tap text-base" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>
                      ⏳
                    </span>
                    {copy.resultsGeneratingQr}
                  </div>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onFinish}
              disabled={!canFinish}
              className="shrink-0 rounded-[12px] px-6 py-3 text-[1.2rem] font-black uppercase tracking-[0.16em] text-white transition-all md:px-8"
              style={
                canFinish
                  ? {
                      backgroundColor: theme.primary,
                      boxShadow: '0 4px 0 rgba(0,0,0,0.18)',
                      animation: 'pb-bounce-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
                    }
                  : {
                      backgroundColor: theme.muted,
                      color: theme.mutedForeground,
                      cursor: 'not-allowed',
                      opacity: 0.7,
                    }
              }
            >
              {isDone ? copy.resultsFinishDone : copy.resultsFinishButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
