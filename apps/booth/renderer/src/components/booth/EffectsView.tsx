import React, { useEffect, useRef, useState } from 'react';
import type { BoothCopywriting, BoothTheme, FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { withAlpha } from '../../lib/appearance';
import { FILTERS, getCanvasFilter } from '../../utils/filters';
import { resolveFrameTemplate } from '../../utils/frameConfig';

export interface EffectsGifFrame {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface EffectsViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  frame: FrameConfig | null;
  photoUrls: Array<string | undefined>;
  photoSlotCount: number;
  surfaceStyle?: React.CSSProperties;
  /** Framed live photo (animated, never filtered); null while it renders. */
  liveUrl?: string | null;
  showLive?: boolean;
  showGif?: boolean;
  gifFrames: EffectsGifFrame[];
  filterId: string;
  gifFrameId: string | null;
  onFilterChange?: (filterId: string) => void;
  onGifFrameChange?: (gifFrameId: string | null) => void;
  onNext?: () => void;
}

type Zoomed = 'live' | 'print' | 'gif' | null;

const NoneIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" />
    <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** Animated stand-in for the GIF: the photos take turns behind the overlay. */
const GifPreview: React.FC<{
  photos: string[];
  filter: string;
  overlay: EffectsGifFrame | null;
  className?: string;
}> = ({ photos, filter, overlay, className }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), 700);
    return () => window.clearInterval(timer);
  }, [photos.length]);
  const ratio = overlay && overlay.width && overlay.height ? overlay.width / overlay.height : 4 / 3;
  return (
    <div className={`relative overflow-hidden rounded-md bg-black ${className ?? ''}`} style={{ aspectRatio: `${ratio}` }}>
      {photos[index % Math.max(1, photos.length)] && (
        <img
          src={photos[index % photos.length]}
          alt=""
          className={`absolute inset-0 h-full w-full ${overlay ? 'object-cover' : 'object-contain'}`}
          style={{ filter }}
          draggable={false}
        />
      )}
      {overlay && <img src={overlay.url} alt="" className="absolute inset-0 h-full w-full object-fill" draggable={false} />}
    </div>
  );
};

/** Horizontal chip rail with a "more" arrow, like the reference layout. */
const ChipRail: React.FC<{ theme: BoothTheme; children: React.ReactNode }> = ({ theme, children }) => {
  const railRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex items-center gap-2 rounded-b-[22px] px-3 py-3" style={{ backgroundColor: withAlpha(theme.card, 0.9) }}>
      <div ref={railRef} className="pb-scroll flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth px-1 py-1">
        {children}
      </div>
      <button
        type="button"
        onClick={() => railRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
        aria-label="More"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-lg font-black"
        style={{ borderColor: withAlpha(theme.cardForeground, 0.3), color: theme.cardForeground, backgroundColor: theme.card }}
      >
        ›
      </button>
    </div>
  );
};

/**
 * Presentational core of the effects step (flows 1 and 3), modelled on the
 * reference layout: left panel = live photo + print file with the filter rail,
 * right panel = GIF preview with the GIF-frame rail. Raw photos are not shown;
 * every preview opens larger on tap.
 */
export const EffectsView: React.FC<EffectsViewProps> = ({
  copy,
  theme,
  frame,
  photoUrls,
  photoSlotCount,
  surfaceStyle,
  liveUrl,
  showLive = true,
  showGif = true,
  gifFrames,
  filterId,
  gifFrameId,
  onFilterChange,
  onGifFrameChange,
  onNext,
}) => {
  const [zoomed, setZoomed] = useState<Zoomed>(null);
  const template = resolveFrameTemplate(frame, photoSlotCount);
  const ratio = template.width / template.height;
  const filter = getCanvasFilter(filterId);
  const photos = photoUrls.filter((url): url is string => Boolean(url));
  const sample = photos[0];
  const overlay = gifFrames.find((f) => f.id === gifFrameId) ?? null;

  const framed = (withFilter: boolean, className = '') => (
    <FrameCanvas
      template={template}
      photos={photoUrls}
      photoSlotCount={photoSlotCount}
      filter={withFilter ? filter : 'none'}
      className={`!border-0 bg-white shadow-[0_8px_22px_rgba(0,0,0,0.25)] ${className}`}
    />
  );

  const liveContent = (big: boolean) =>
    liveUrl ? (
      <img src={liveUrl} alt={copy.effectsLiveLabel} className="h-full w-full object-contain" />
    ) : (
      <div className="relative h-full w-full">
        {framed(false, 'h-full w-full')}
        <span
          className={`absolute right-2 top-2 rounded-full ${big ? 'h-8 w-8' : 'h-5 w-5'} border-[3px]`}
          style={{ borderColor: withAlpha('#ffffff', 0.4), borderTopColor: theme.tertiary, animation: 'pb-spin 0.8s linear infinite' }}
        />
      </div>
    );

  /**
   * A labelled output that opens larger on tap. `perRow` tiles share the
   * preview area: each is sized "contain" against it via container units.
   */
  const previewTile = (kind: Exclude<Zoomed, null>, label: string, content: React.ReactNode, aspect: number, perRow = 1) => (
    <button
      type="button"
      onClick={() => setZoomed(kind)}
      className="group flex min-w-0 shrink-0 flex-col items-center gap-1.5"
      title={copy.effectsTapToZoom}
    >
      <span className="text-xs font-black uppercase tracking-[0.12em] opacity-80 sm:text-sm">{label}</span>
      <span
        className="relative block overflow-hidden transition group-hover:-translate-y-0.5"
        style={{
          aspectRatio: `${aspect}`,
          height: `min(100cqh - 3.5rem, (100cqw - 1.5rem - ${perRow - 1} * 1rem) / ${perRow} / ${aspect})`,
        }}
      >
        {content}
        <span
          className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full text-sm opacity-90"
          style={{ backgroundColor: withAlpha(theme.deep, 0.75), color: '#fff' }}
          aria-hidden="true"
        >
          ⤢
        </span>
      </span>
    </button>
  );

  const panelClass = 'flex min-h-0 flex-col overflow-hidden rounded-[24px] border-[3px]';
  const panelStyle: React.CSSProperties = {
    borderColor: theme.deep,
    backgroundColor: withAlpha(theme.surface, 0.92),
    color: theme.surfaceForeground,
    boxShadow: `0 6px 0 ${theme.deep}`,
  };

  const chipLabel = 'max-w-[4.5rem] truncate text-center text-[0.65rem] font-bold sm:text-xs';

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ ...surfaceStyle, color: theme.foreground }}>
      <header className="flex shrink-0 flex-col items-center gap-1 px-4 pb-2 pt-3 text-center sm:pt-4">
        <p
          className="inline-block -rotate-2 rounded-full px-3 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.22em] sm:text-xs"
          style={{ backgroundColor: theme.secondary, color: theme.secondaryForeground }}
        >
          {copy.effectsEyebrow}
        </p>
      </header>

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-3 pb-3 sm:px-5 ${showGif ? 'lg:grid-cols-2' : ''}`}>
        {/* ---- Left: live photo + print file, filter rail ---- */}
        <section className={panelClass} style={{ ...panelStyle, animation: 'pb-rise-pop 0.5s ease-out both' }}>
          <h2 className="px-4 pt-3 text-center text-lg font-black sm:text-xl">{copy.effectsPhotoTitle}</h2>
          <div className="relative h-[46vh] min-h-0 lg:h-auto lg:flex-1" style={{ containerType: 'size' }}>
            <div className="absolute inset-0 flex items-center justify-center gap-4 p-3">
              {showLive && previewTile('live', copy.effectsLiveLabel, liveContent(false), ratio, 2)}
              {previewTile('print', copy.effectsPrintLabel, framed(true, 'h-full w-full'), ratio, showLive ? 2 : 1)}
            </div>
          </div>
          <ChipRail theme={theme}>
            {FILTERS.map((option) => {
              const selected = option.id === filterId;
              const isNone = option.id === 'original';
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onFilterChange?.(option.id)}
                  aria-pressed={selected}
                  className="flex shrink-0 flex-col items-center gap-1"
                  style={{ color: theme.cardForeground }}
                >
                  <span
                    className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border-[3px] transition sm:h-16 sm:w-16"
                    style={{
                      borderColor: selected ? theme.action : 'transparent',
                      boxShadow: selected ? `0 0 0 3px ${withAlpha(theme.action, 0.35)}` : undefined,
                      backgroundColor: isNone ? withAlpha(theme.cardForeground, 0.55) : theme.deep,
                      color: '#fff',
                    }}
                  >
                    {isNone ? (
                      NoneIcon
                    ) : sample ? (
                      <img src={sample} alt="" className="h-full w-full object-cover" style={{ filter: option.canvasFilter }} draggable={false} />
                    ) : null}
                  </span>
                  <span className={chipLabel} style={{ fontWeight: selected ? 900 : 600 }}>
                    {isNone ? copy.effectsNone : option.name}
                  </span>
                </button>
              );
            })}
          </ChipRail>
        </section>

        {/* ---- Right: GIF preview, GIF-frame rail ---- */}
        {showGif && (
          <section className={panelClass} style={{ ...panelStyle, animation: 'pb-rise-pop 0.5s ease-out 0.1s both' }}>
            <h2 className="px-4 pt-3 text-center text-lg font-black sm:text-xl">{copy.effectsGifTitle}</h2>
            <div className="relative h-[40vh] min-h-0 lg:h-auto lg:flex-1" style={{ containerType: 'size' }}>
              <div className="absolute inset-0 flex items-center justify-center p-3">
                {previewTile(
                  'gif',
                  copy.effectsGifLabel,
                  <GifPreview photos={photos} filter={filter} overlay={overlay} className="!aspect-auto h-full w-full" />,
                  overlay && overlay.width && overlay.height ? overlay.width / overlay.height : 4 / 3,
                  1,
                )}
              </div>
            </div>
            <ChipRail theme={theme}>
              {[null, ...gifFrames].map((option) => {
                const id = option?.id ?? null;
                const selected = id === gifFrameId;
                return (
                  <button
                    key={id ?? 'none'}
                    type="button"
                    onClick={() => onGifFrameChange?.(id)}
                    aria-pressed={selected}
                    className="flex shrink-0 flex-col items-center gap-1"
                    style={{ color: theme.cardForeground }}
                  >
                    <span
                      className="relative grid h-14 w-[4.7rem] place-items-center overflow-hidden rounded-xl border-[3px] transition sm:h-16 sm:w-[5.3rem]"
                      style={{
                        borderColor: selected ? theme.action : withAlpha(theme.cardForeground, 0.2),
                        boxShadow: selected ? `0 0 0 3px ${withAlpha(theme.action, 0.35)}` : undefined,
                        backgroundColor: option ? theme.deep : withAlpha(theme.cardForeground, 0.55),
                        color: '#fff',
                      }}
                    >
                      {option ? (
                        <>
                          {sample && <img src={sample} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
                          <img src={option.url} alt="" className="absolute inset-0 h-full w-full object-fill" draggable={false} />
                        </>
                      ) : (
                        NoneIcon
                      )}
                    </span>
                    <span className={chipLabel} style={{ fontWeight: selected ? 900 : 600 }}>
                      {option ? option.name : copy.effectsNone}
                    </span>
                  </button>
                );
              })}
            </ChipRail>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 justify-center px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={onNext}
          className="min-h-12 w-full max-w-md rounded-xl border-2 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          style={
            {
              borderColor: theme.deep,
              backgroundColor: theme.action,
              color: theme.actionForeground,
              '--glow': withAlpha(theme.action, 0.55),
              animation: 'pb-cta-breathe 2.4s ease-in-out 2s infinite',
            } as React.CSSProperties
          }
        >
          {copy.effectsNextButton} →
        </button>
      </footer>

      {/* Larger view of any output */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: withAlpha(theme.deep, 0.92), animation: 'pb-modal-fade 0.2s ease-out both' }}
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-full w-full max-w-3xl items-center justify-center"
            style={{ animation: 'pb-modal-zoom 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            {zoomed === 'gif' ? (
              <GifPreview photos={photos} filter={filter} overlay={overlay} className="max-h-[85dvh] w-full" />
            ) : (
              <div style={{ aspectRatio: `${ratio}`, height: `min(85dvh, 90vw / ${ratio})` }}>
                {zoomed === 'live' ? liveContent(true) : framed(true, 'h-full w-full')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setZoomed(null)}
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border-2 text-lg font-black"
            style={{ borderColor: '#fff', color: '#fff', backgroundColor: withAlpha(theme.deep, 0.6) }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default EffectsView;
