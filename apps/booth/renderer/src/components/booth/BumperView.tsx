import React from 'react';
import { KELANA_NAVY, KelanaLogo } from '../brand/KelanaLogo';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';

export type BumperFlavor = 'pink' | 'lime';

export interface BumperLayerRefs {
  rootRef: React.RefObject<HTMLDivElement>;
  farRef: React.RefObject<HTMLDivElement>;
  bgRef: React.RefObject<HTMLDivElement>;
  collageWrapRef: React.RefObject<HTMLDivElement>;
  collageRef: React.RefObject<HTMLDivElement>;
  sparkleRef: React.RefObject<HTMLDivElement>;
}

export interface BumperViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  flavor: BumperFlavor;
  /** Live gradients for the flavor currently showing. */
  palette: { inner: string; mid: string; outer: string };
  /** Sample photos shown as the polaroid collage. */
  photos: string[];
  /** Attached by the screen, which owns the parallax loop and sparkle spawner. */
  refs: BumperLayerRefs;
  onAdvance?: () => void;
  onOpenPin?: () => void;
}

/**
 * Presentational core of the start/bumper screen: brand wordmark, balloon
 * layers, the 3D photo collage, and the tap-to-start prompt.
 *
 * The screen owns all animation — the requestAnimationFrame parallax loop, the
 * gradient flavour morph, and the sparkle spawner — and reaches into the DOM
 * through `refs`. The admin appearance preview mounts the same markup with the
 * refs attached but no animation running.
 *
 * Sizing comes from the `pb-screen` container (see index.css), so the collage
 * scales with this box rather than the browser window.
 */
export const BumperView: React.FC<BumperViewProps> = ({
  copy,
  theme,
  flavor,
  palette,
  photos,
  refs,
  onAdvance,
  onOpenPin,
}) => (
  <div
    ref={refs.rootRef}
    onClick={onAdvance}
    className={`pb-screen relative h-full w-full select-none ${flavor === 'lime' ? 'pb-lime' : ''} ${onAdvance ? 'cursor-pointer' : ''}`}
    style={
      {
        '--pb-inner': palette.inner,
        '--pb-mid': palette.mid,
        '--pb-outer': palette.outer,
        background: 'radial-gradient(circle at center, var(--pb-inner) 0%, var(--pb-mid) 50%, var(--pb-outer) 100%)',
      } as React.CSSProperties
    }
  >
    {/* Header */}
    <header className="pb-bumper-header sticky top-0 z-[120] flex items-center justify-center px-[4%] py-4 backdrop-blur-md md:absolute md:inset-x-0 md:py-8 md:backdrop-blur-none">
      <div className="flex items-center gap-2 text-lg md:text-xl" style={{ fontFamily: "'Galada', cursive" }}>
        <h2
          className="text-5xl leading-[0.8] text-white sm:text-6xl lg:text-7xl"
          style={{ fontFamily: "'Galada', cursive", animation: 'pb-fade 0.7s ease-out 0.6s both' }}
        >
          <KelanaLogo
            title={copy.bumperBrand}
            className="h-14 w-auto sm:h-16 lg:h-20"
            ink="#ffffff"
            light={KELANA_NAVY}
            style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.25))' }}
          />
        </h2>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPin?.();
        }}
        title="Booth Setup"
        aria-label="Booth Setup"
        className="absolute right-[4%] top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-xl text-white backdrop-blur transition-transform hover:scale-110 hover:bg-white/25"
      >
        ⚙️
      </button>
    </header>

    {/* Far background balloons */}
    <div ref={refs.farRef} className="pb-layer" style={{ zIndex: -1 }}>
      <Balloon className="l1" color={theme.tertiary} />
      <Balloon className="l2" color={theme.secondary} />
      <Balloon className="l3" color={theme.accent} />
      <Balloon className="l4" color={theme.primary} />
    </div>

    {/* Background balloons (behind the collage) */}
    <div ref={refs.bgRef} className="pb-layer" style={{ zIndex: 0 }}>
      <Balloon className="b7" color={theme.action} />
      <Balloon className="b8" color={theme.secondary} />
      <Balloon className="b9" color={theme.primary} />
    </div>

    {/* Center product: 3D photo collage (horizontal on landscape, vertical on portrait) */}
    <div className="pb-hero-center">
      <div ref={refs.collageWrapRef} className="pb-main">
        <div ref={refs.collageRef} className="pb-collage">
          <Court src={photos[0]} caption={copy.bumperCaption1} className="court-1" />
          <Court src={photos[1]} caption={copy.bumperCaption2} className="court-2" />
          <Court src={photos[2]} caption={copy.bumperCaption3} className="court-3" />
        </div>
      </div>
    </div>

    {/* Rising sparkles */}
    <div ref={refs.sparkleRef} className="pointer-events-none absolute inset-0 z-[5]" />

    {/* Tap-to-start instruction */}
    <div className="absolute inset-x-0 bottom-0 z-[110] flex justify-center pb-10">
      <p
        className="flex items-center gap-3 text-2xl tracking-wide text-white md:text-3xl"
        style={{ fontFamily: "'Galada', cursive", animation: 'pb-bounce-in 1.4s ease 1s both, pb-glow 2.4s ease-in-out 2s infinite' }}
      >
        <span className="inline-block" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>
          👆
        </span>
        {copy.bumperTapToStart}
      </p>
    </div>
  </div>
);

interface BalloonProps {
  className: string;
  color: string;
}

const Balloon: React.FC<BalloonProps> = ({ className, color }) => {
  const dur = 5 + Math.random() * 5;
  const delay = Math.random() * -dur;
  const dx = (Math.random() - 0.5) * 30;
  const dy = 14 + Math.random() * 20;
  const rot = (Math.random() - 0.5) * 20;
  return (
    <div
      className={`pb-balloon ${className}`}
      style={
        {
          '--bcolor': color,
          '--pd': `${dur}s`,
          '--pd-delay': `${delay}s`,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          '--rot': `${rot}deg`,
        } as React.CSSProperties
      }
    >
      <div className="pb-body" />
      <div className="pb-knot" />
      <svg className="pb-string" width="14" height="56" viewBox="0 0 14 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 0 Q2 18 9 34 Q14 46 7 56" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
};

interface CourtProps {
  src?: string;
  caption: string;
  className?: string;
}

const Court: React.FC<CourtProps> = ({ src, caption, className }) => (
  <div className={`pb-court ${className ?? ''}`}>
    <img className="pb-photo" src={src} alt={caption} />
    <div className="pb-cap">{caption}</div>
  </div>
);

export default BumperView;
