import React, { useEffect, useMemo, useState } from 'react';
import { formatBoothCopy, type BoothCopywriting, type BoothTheme, type FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { withAlpha } from '../../lib/appearance';
import { resolveFrameTemplate } from '../../utils/frameConfig';

/** Guest-facing print progress. `off` hides the chip (no printer / timed flow). */
export type ResultsPrintState = 'off' | 'printing' | 'queued' | 'ready' | 'error';
/** Guest-facing cloud upload progress behind the QR. */
export type ResultsUploadState = 'uploading' | 'done' | 'error';

type HeroTab = 'framed' | 'live' | 'gif';

export interface ResultsViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** Timed flow arranges the frame later: no hero print, QR + photo strip only. */
  isTimedFlow: boolean;
  frame: FrameConfig | null;
  /** Selected photo per slot, in slot order (what the frame is built from). */
  photoUrls: Array<string | undefined>;
  /** Every captured photo for the film strip; defaults to `photoUrls`. */
  allPhotoUrls?: string[];
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
  printState: ResultsPrintState;
  uploadState: ResultsUploadState;
  isDone: boolean;
  canFinish: boolean;
  surfaceStyle?: React.CSSProperties;
  onFinish?: () => void;
  onViewFramed?: () => void;
  onViewLive?: () => void;
  onViewGif?: () => void;
  onViewPhoto?: (url: string, index: number) => void;
  /** Opens the enlarged QR modal. */
  onOpenQr?: () => void;
}

const CONFETTI_COUNT = 46;

/**
 * Presentational core of the results / QR screen.
 *
 *  - Hero: the result as an instant print that ejects and "develops"; tabs
 *    switch between the framed photo, the framed live photo and the GIF.
 *  - Info column: headline, print + upload status, the QR with a sticker, and
 *    the finish button.
 *  - Film strip: every captured photo, tap to enlarge.
 *
 * Sized in container units against `pb-screen`, so the booth and the scaled
 * admin preview render identically. Paper confetti falls once when the session
 * is done.
 */
export const ResultsView: React.FC<ResultsViewProps> = ({
  copy,
  theme,
  isTimedFlow,
  frame,
  photoUrls,
  allPhotoUrls,
  photoSlotCount,
  filterStyle,
  liveUrl,
  gifUrl,
  qrDataUrl,
  showFramed,
  showAllPhotos,
  showLive,
  showGif,
  printState,
  uploadState,
  isDone,
  canFinish,
  surfaceStyle,
  onFinish,
  onViewFramed,
  onViewLive,
  onViewGif,
  onViewPhoto,
  onOpenQr,
}) => {
  const hasFramed = Boolean(showFramed && frame && photoSlotCount > 0);
  const tabs = useMemo(() => {
    const list: Array<{ id: HeroTab; label: string }> = [];
    if (hasFramed) list.push({ id: 'framed', label: copy.resultsFramedPhotoLabel });
    if (showLive && liveUrl) list.push({ id: 'live', label: copy.resultsLiveBadge });
    if (showGif && gifUrl) list.push({ id: 'gif', label: copy.resultsGifBadge });
    return list;
  }, [hasFramed, showLive, liveUrl, showGif, gifUrl, copy]);

  const [tab, setTab] = useState<HeroTab>('framed');
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;
  // Re-key the media so each tab switch re-runs the develop animation.
  const [developKey, setDevelopKey] = useState(0);

  const stripPhotos = useMemo(
    () => (allPhotoUrls ?? photoUrls.filter((url): url is string => Boolean(url))),
    [allPhotoUrls, photoUrls],
  );

  // One confetti burst on the transition to done.
  const [confettiOn, setConfettiOn] = useState(false);
  useEffect(() => {
    if (!isDone) return;
    setConfettiOn(true);
    const timer = setTimeout(() => setConfettiOn(false), 5200);
    return () => clearTimeout(timer);
  }, [isDone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        left: `${(i * 61) % 100}%`,
        color: [theme.primary, theme.tertiary, theme.secondary, theme.accent, theme.action][i % 5],
        w: 0.9 + ((i * 7) % 6) * 0.2,
        h: 1.6 + ((i * 5) % 5) * 0.3,
        round: i % 4 === 0,
        duration: 2.8 + ((i * 13) % 20) / 10,
        delay: ((i * 3) % 14) / 10,
        drift: `${((i * 17) % 21) - 10}cqw`,
        spin: `${360 + ((i * 47) % 540)}deg`,
      })),
    [theme],
  );

  // Polaroid geometry. With W the card width: 5% side and top margins, a 14%
  // bottom lip, and a media box exactly the frame's ratio r. Card aspect
  // a = W/H = 1 / (0.9/r + 0.19); vertical offsets are fractions of H.
  const card = useMemo(() => {
    const template = frame ? resolveFrameTemplate(frame, photoSlotCount || 3) : null;
    const r = template && template.height > 0 ? template.width / template.height : 3 / 4;
    const a = 1 / (0.9 / r + 0.19);
    return {
      aspect: String(a),
      media: { left: '5%', width: '90%', top: `${5 * a}%`, height: `${(90 * a) / r}%` } as React.CSSProperties,
    };
  }, [frame, photoSlotCount]);

  const openHero = () => {
    if (activeTab === 'framed') onViewFramed?.();
    else if (activeTab === 'live') onViewLive?.();
    else if (activeTab === 'gif') onViewGif?.();
  };

  const printChip =
    printState === 'off'
      ? null
      : {
          printing: { icon: '🖨️', text: copy.resultsPrinting, busy: true, tone: theme.secondary },
          queued: { icon: '🧾', text: copy.resultsPrintQueued, busy: false, tone: theme.secondary },
          ready: { icon: '✅', text: copy.resultsPrintReady, busy: false, tone: theme.primary },
          error: { icon: '⚠️', text: copy.resultsPrintError, busy: false, tone: theme.destructive },
        }[printState];
  const uploadChip = {
    uploading: { icon: '☁️', text: copy.resultsUploading, busy: true, tone: theme.secondary },
    done: { icon: '☁️', text: copy.resultsUploaded, busy: false, tone: theme.primary },
    error: { icon: '⚠️', text: copy.resultsUploadError, busy: false, tone: theme.destructive },
  }[uploadState];

  return (
    <div
      className="pb-screen pb-results-anim print-qrpage relative h-full w-full select-none overflow-hidden"
      style={{ ...surfaceStyle, color: theme.deep }}
    >
      {/* Soft spotlight behind the hero so the print pops off the surface */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60cqmin 50cqmin at 28% 45%, ${withAlpha(theme.card, 0.55)}, transparent 70%)`,
        }}
      />

      {confettiOn && (
        <div className="print-no-show pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
          {confetti.map((piece, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={
                {
                  left: piece.left,
                  width: `${piece.w}cqmin`,
                  height: `${piece.round ? piece.w : piece.h}cqmin`,
                  borderRadius: piece.round ? '50%' : '0.2cqmin',
                  backgroundColor: piece.color,
                  '--cx': piece.drift,
                  '--cr': piece.spin,
                  animation: `pb-confetti-fall ${piece.duration}s cubic-bezier(0.3, 0.6, 0.5, 1) ${piece.delay}s both`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div
        className={`print-no-show pb-results-grid relative z-10 h-full w-full p-[3.2cqmin] ${isTimedFlow ? 'is-timed' : ''}`}
      >
        {/* ---------- Hero: the instant print ---------- */}
        {!isTimedFlow && (
          <section className="flex min-h-0 flex-col items-center justify-center gap-[2cqmin]" style={{ gridArea: 'hero' }}>
            {/* printer slot the print slides out of */}
            <div className="relative flex min-h-0 w-full flex-1 flex-col items-center">
              <div
                className="z-20 h-[1.6cqmin] w-[70%] max-w-[62cqmin] rounded-full"
                style={{ backgroundColor: theme.deep, boxShadow: `0 0.6cqmin 1.2cqmin ${withAlpha(theme.deep, 0.35)}` }}
                aria-hidden="true"
              />
              <div className="relative -mt-[0.8cqmin] flex min-h-0 w-full flex-1 justify-center overflow-hidden pt-[0.8cqmin]">
                <button
                  type="button"
                  onClick={openHero}
                  disabled={!activeTab}
                  aria-label="View result larger"
                  className="group relative h-full max-w-full transition-transform hover:scale-[1.015] disabled:cursor-default"
                  style={{
                    // Explicit shape derived from the frame, so the card never
                    // collapses and the frame inside is never stretched.
                    aspectRatio: card.aspect,
                    backgroundColor: '#fffdf8',
                    boxShadow: `0 2cqmin 4cqmin ${withAlpha(theme.deep, 0.3)}`,
                    animation: 'pb-eject 1.1s cubic-bezier(0.25, 0.9, 0.3, 1.05) 0.15s both',
                  }}
                >
                  <div
                    key={`${activeTab}-${developKey}`}
                    className="absolute flex items-center justify-center overflow-hidden bg-black/5"
                    style={{ ...card.media, animation: 'pb-develop 2.4s ease-out 0.9s both' }}
                  >
                    {activeTab === 'framed' && frame ? (
                      <FrameCanvas
                        frame={frame}
                        photos={photoUrls}
                        photoSlotCount={photoSlotCount}
                        filter={filterStyle}
                        qrCodeUrl={qrDataUrl ?? undefined}
                        className="h-full w-full border-0 bg-white shadow-none"
                      />
                    ) : activeTab === 'live' && liveUrl ? (
                      <img src={liveUrl} alt={copy.resultsFramedLiveBadge} className="h-full w-auto max-w-full object-contain" />
                    ) : activeTab === 'gif' && gifUrl ? (
                      <img src={gifUrl} alt={copy.resultsAnimatedGifBadge} className="h-full w-auto max-w-full object-contain" />
                    ) : (
                      <span className="px-[4cqmin] text-center text-[2.4cqmin] font-bold opacity-60">
                        {copy.resultsNoFramed}
                      </span>
                    )}
                  </div>
                  <span
                    className="absolute inset-x-0 bottom-[1.2cqmin] text-center text-[2.4cqmin] font-black uppercase tracking-[0.2em]"
                    style={{ color: withAlpha(theme.deep, 0.55) }}
                  >
                    🔍 {tabs.find((t) => t.id === activeTab)?.label ?? ''}
                  </span>
                </button>
              </div>
            </div>

            {tabs.length > 1 && (
              <div
                role="tablist"
                className="flex shrink-0 gap-[1cqmin] rounded-full p-[0.8cqmin]"
                style={{ backgroundColor: withAlpha(theme.deep, 0.12) }}
              >
                {tabs.map((t) => {
                  const selected = t.id === activeTab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setTab(t.id);
                        setDevelopKey((k) => k + 1);
                      }}
                      className="rounded-full px-[2.8cqmin] py-[1.1cqmin] text-[2.2cqmin] font-black uppercase tracking-[0.12em] transition-all"
                      style={
                        selected
                          ? { backgroundColor: theme.primary, color: theme.primaryForeground, transform: 'scale(1.05)' }
                          : { color: theme.deep }
                      }
                    >
                      {t.id === 'framed' ? '🖼️' : t.id === 'live' ? '📹' : '🎞️'} {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ---------- Info: headline, status, QR, finish ---------- */}
        <section
          className={`flex min-h-0 flex-col justify-center gap-[2.4cqmin] ${isTimedFlow ? 'items-center text-center' : ''}`}
          style={{ gridArea: 'info' }}
        >
          <header style={{ animation: 'pb-bounce-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.4s both' }}>
            <h1 className="text-[6.4cqmin] font-black leading-[1] tracking-[-0.03em]">{copy.resultsTitle}</h1>
            <p className="mt-[1cqmin] max-w-[78cqmin] text-[2.5cqmin] font-semibold opacity-75">
              {isTimedFlow ? copy.resultsQrArrange : copy.resultsSubtitle}
            </p>
          </header>

          <div
            className={`flex flex-wrap gap-[1cqmin] ${isTimedFlow ? 'justify-center' : ''}`}
            style={{ animation: 'pb-bounce-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.55s both' }}
          >
            {[printChip, uploadChip].filter(Boolean).map((chip, i) => (
              <span
                key={i}
                role="status"
                className="inline-flex items-center gap-[1cqmin] rounded-full border-[0.35cqmin] px-[2cqmin] py-[0.9cqmin] text-[2.1cqmin] font-bold"
                style={{ borderColor: chip!.tone, backgroundColor: withAlpha(theme.card, 0.85), color: theme.cardForeground }}
              >
                <span aria-hidden="true">{chip!.icon}</span>
                {chip!.text}
                {chip!.busy && (
                  <span className="inline-flex gap-[0.4cqmin]" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-[0.8cqmin] w-[0.8cqmin] rounded-full"
                        style={{ backgroundColor: chip!.tone, animation: `pb-dot-bounce 1.2s ease-in-out ${d * 0.15}s infinite` }}
                      />
                    ))}
                  </span>
                )}
              </span>
            ))}
          </div>

          <div
            className={`flex items-center gap-[3cqmin] ${isTimedFlow ? 'flex-col' : ''}`}
            style={{ animation: 'pb-bounce-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.7s both' }}
          >
            <button
              type="button"
              onClick={onOpenQr}
              disabled={!onOpenQr || !qrDataUrl}
              aria-label="Enlarge QR code"
              className="relative shrink-0 rounded-[2.4cqmin] border-[0.6cqmin] bg-white p-[1.8cqmin] transition-transform hover:-translate-y-[0.4cqmin] disabled:cursor-default"
              style={{ borderColor: theme.deep, boxShadow: `0 1cqmin 0 ${theme.deep}` }}
            >
              {qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt={copy.resultsQrDownload} className="h-[30cqmin] w-[30cqmin]" />
                  <span
                    className="pointer-events-none absolute inset-x-[2cqmin] top-[2cqmin] h-[0.5cqmin] rounded-full"
                    style={{
                      backgroundColor: withAlpha(theme.primary, 0.85),
                      boxShadow: `0 0 1.4cqmin ${withAlpha(theme.primary, 0.9)}`,
                      animation: 'pb-scan 2.8s ease-in-out infinite',
                    }}
                  />
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[2cqmin]"
                    style={{ animation: 'pb-pulse-ring 2.4s ease-out infinite' }}
                  />
                </>
              ) : (
                <span className="flex h-[30cqmin] w-[30cqmin] flex-col items-center justify-center gap-[1cqmin] text-center text-[1.9cqmin] font-black uppercase tracking-[0.16em]">
                  <span className="text-[4cqmin]" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>
                    ⏳
                  </span>
                  {copy.resultsGeneratingQr}
                </span>
              )}
              {/* "Scan me" sticker */}
              <span
                className="absolute -right-[3.5cqmin] -top-[3cqmin] grid h-[11cqmin] w-[11cqmin] place-items-center rounded-full px-[1cqmin] text-center text-[1.9cqmin] font-black uppercase leading-[1.05]"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.primaryForeground,
                  boxShadow: `0 0.6cqmin 0 ${withAlpha(theme.deep, 0.35)}`,
                  animation: 'pb-sticker-wobble 2.2s ease-in-out infinite',
                }}
              >
                {copy.resultsScanMe}
              </span>
            </button>

            <div className={`flex min-w-0 flex-col gap-[2.4cqmin] ${isTimedFlow ? 'items-center' : ''}`}>
              <button
                type="button"
                onClick={onFinish}
                disabled={!canFinish}
                className="relative overflow-hidden rounded-[1.8cqmin] px-[4cqmin] py-[2cqmin] text-[2.8cqmin] font-black uppercase tracking-[0.12em] transition-all enabled:hover:-translate-y-[0.3cqmin] enabled:active:translate-y-0"
                style={
                  canFinish
                    ? {
                        backgroundColor: theme.action,
                        color: theme.actionForeground,
                        boxShadow: `0 0.8cqmin 0 ${theme.deep}`,
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
                {canFinish && (
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                      animation: 'pb-btn-shine 2.8s ease-in-out 1.2s infinite',
                    }}
                  />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ---------- Film strip of every captured photo ---------- */}
        {showAllPhotos && stripPhotos.length > 0 && (
          <section style={{ gridArea: 'strip' }} className="min-w-0 justify-self-center">
            <p className="mb-[0.8cqmin] text-[1.9cqmin] font-black uppercase tracking-[0.2em] opacity-70">
              {formatBoothCopy(copy.resultsViewAllPhotos, { count: stripPhotos.length })}
            </p>
            <div
              className="pb-scroll relative overflow-x-auto rounded-[1cqmin] px-[1.2cqmin] py-[1.8cqmin]"
              style={{ backgroundColor: theme.deep }}
            >
              {/* sprocket holes */}
              {(['top', 'bottom'] as const).map((edge) => (
                <span
                  key={edge}
                  className="pointer-events-none absolute inset-x-0 h-[0.8cqmin]"
                  style={{
                    [edge]: '0.45cqmin',
                    backgroundImage: `repeating-linear-gradient(90deg, ${withAlpha(theme.card, 0.85)} 0 1.2cqmin, transparent 1.2cqmin 2.6cqmin)`,
                  }}
                  aria-hidden="true"
                />
              ))}
              <div className="flex w-max gap-[1.2cqmin]">
                {stripPhotos.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onViewPhoto?.(url, index)}
                    disabled={!onViewPhoto}
                    aria-label={formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                    className="block shrink-0 overflow-hidden transition-transform hover:-translate-y-[0.4cqmin] disabled:cursor-default"
                    style={
                      {
                        '--pr': `${index % 2 === 0 ? -1.5 : 1.5}deg`,
                        animation: `pb-pop-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) ${1 + index * 0.08}s both`,
                      } as React.CSSProperties
                    }
                  >
                    <img src={url} alt="" draggable={false} className="h-[12cqmin] w-[16cqmin] object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ResultsView;
