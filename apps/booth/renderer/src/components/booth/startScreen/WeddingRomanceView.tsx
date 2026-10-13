import React, { useEffect, useRef, useState } from 'react';
import type { BoothBackground, BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../../lib/appearance';
import { KelanaLogo } from '../../brand/KelanaLogo';
import { SetupGearButton } from './StartScreenParts';

/**
 * "Wedding Romance" start screen: an invitation brought to life. A velvet
 * backdrop (the appearance's background image when set), drifting rose
 * petals and gold bokeh, an arched cream-and-gold window playing the photos,
 * crowned with rose clusters, and the couple's names in gold script.
 *
 * Every color comes from the theme (gold = primary / accent, roses = tertiary
 * blended toward the card cream and the secondary wine), so it follows any
 * palette; the greenery is the only fixed color. Copy mapping:
 *   bumperCaption1 → eyebrow ("The Wedding of")
 *   bumperBrand    → the names in script
 *   bumperCaption3 → the line in the divider (the date)
 *   bumperCaption2 → the italic line under it
 */

export interface WeddingRomanceViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  photos: string[];
  /** The appearance background; an image becomes the velvet backdrop. */
  background?: BoothBackground;
  onAdvance?: () => void;
  onOpenPin?: () => void;
}

const SCRIPT_FONT = "'Great Vibes', 'Pinyon Script', 'Brush Script MT', cursive";
const CAPS_FONT = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";
const SERIF_FONT = "'Cormorant Garamond', 'Garamond', 'Times New Roman', serif";
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@1,500&display=swap';

const useWeddingFonts = () => {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
};

/** Linear blend of two hex colors (`t` 0 → a, 1 → b). */
const mix = (a: string, b: string, t: number): string => {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const x = parse(a);
  const y = parse(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** Falling-petal colors. */
interface PetalTone {
  light: string;
  base: string;
  edge: string;
}

/**
 * Real-photo bouquet (public/florals, CC0 photos, see CREDITS.md there): cream
 * and dusty-pink roses, garden roses, a bud, a peony and leaves, cut out and
 * arranged. Kept within gentle rotations so the photographed light stays right.
 */
const PhotoBouquet: React.FC<{
  variant: 'a' | 'b' | 'c';
  className?: string;
  rotate?: number;
  flip?: boolean;
}> = ({ variant, className, rotate = 0, flip }) => (
  <img
    src={`${import.meta.env.BASE_URL}florals/bouquet-${variant}.webp`}
    alt=""
    draggable={false}
    aria-hidden="true"
    className={`pointer-events-none select-none ${className ?? ''}`}
    style={{ transform: `rotate(${rotate}deg)${flip ? ' scaleX(-1)' : ''}`, filter: 'drop-shadow(0 1cqmin 1.4cqmin rgba(20,2,6,0.45))' }}
  />
);

/** Deterministic pseudo-random sequence so petals keep their places. */
const seq = (n: number, seed: number) => {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  });
};
const PETAL_R = seq(80, 7);

export const WeddingRomanceView: React.FC<WeddingRomanceViewProps> = ({
  copy,
  theme,
  photos,
  background,
  onAdvance,
  onOpenPin,
}) => {
  useWeddingFonts();
  const rootRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setPortrait(el.clientHeight > el.clientWidth * 1.05);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => setSlide((i) => (i + 1) % photos.length), 4800);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  const gold = theme.primary;
  const goldLight = theme.accent;
  const cream = theme.card;
  const wine = theme.secondary;
  const tones: PetalTone[] = [
    { light: mix(theme.tertiary, '#ffffff', 0.55), base: theme.tertiary, edge: mix(theme.tertiary, wine, 0.45) },
    { light: '#ffffff', base: mix(cream, theme.tertiary, 0.25), edge: mix(theme.tertiary, wine, 0.2) },
    { light: mix(theme.tertiary, wine, 0.25), base: mix(theme.tertiary, wine, 0.6), edge: mix(wine, theme.deep, 0.45) },
  ];
  const goldText: React.CSSProperties = {
    backgroundImage: `linear-gradient(100deg, ${mix(gold, theme.deep, 0.25)} 0%, ${goldLight} 30%, ${gold} 50%, ${goldLight} 72%, ${mix(gold, theme.deep, 0.2)} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
  const hasImage = background?.type === 'image' && Boolean(background.imageUrl);

  // ---- arch window (photo slideshow) ----
  const arch = (
    <div
      className="pb-wed-float relative h-full w-full"
      style={{ filter: `drop-shadow(0 2.4cqmin 3cqmin ${withAlpha(theme.deep, 0.6)})` }}
    >
      {/* cream marble frame with a gold hairline */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '999px 999px 2.2cqmin 2.2cqmin',
          background: `radial-gradient(120% 80% at 30% 20%, #ffffff 0%, ${cream} 55%, ${mix(cream, gold, 0.18)} 100%)`,
          padding: '2.2cqmin',
        }}
      >
        {/* marble veins */}
        <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-5 30 C 20 26, 30 44, 55 38 S 90 52, 110 44" stroke={gold} strokeWidth="0.35" fill="none" opacity="0.7" />
          <path d="M-5 96 C 18 90, 40 110, 62 100 S 92 112, 110 104" stroke={gold} strokeWidth="0.3" fill="none" opacity="0.6" />
          <path d="M10 140 C 22 120, 18 100, 34 86" stroke={mix(cream, theme.deep, 0.25)} strokeWidth="0.25" fill="none" opacity="0.5" />
        </svg>
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            borderRadius: '999px 999px 1.2cqmin 1.2cqmin',
            boxShadow: `0 0 0 0.35cqmin ${gold}, inset 0 0 3cqmin ${withAlpha(theme.deep, 0.45)}`,
            backgroundColor: theme.deep,
          }}
        >
          {photos.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt=""
              draggable={false}
              className="pb-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out"
              style={{ opacity: i === slide ? 1 : 0 }}
            />
          ))}
          {/* warm candle-light grade */}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, ${withAlpha(theme.tertiary, 0.12)}, transparent 40%, ${withAlpha(theme.deep, 0.35)})` }}
          />
        </div>
      </div>
      {/* rose clusters on the shoulders and the base */}
      <PhotoBouquet variant="a" flip rotate={-22} className="absolute -left-[38%] -top-[7%] w-[70%]" />
      <PhotoBouquet variant="c" rotate={28} className="absolute -right-[26%] -top-[4%] w-[66%]" />
      <PhotoBouquet variant="b" rotate={-4} className="absolute -bottom-[8%] -left-[24%] w-[92%]" />
      <PhotoBouquet variant="c" flip rotate={-14} className="absolute -bottom-[4%] -right-[28%] w-[58%]" />
    </div>
  );

  // ---- invitation text ----
  const text = (
    <div className={`relative z-20 flex flex-col ${portrait ? 'items-center text-center' : 'items-start text-left'}`}>
      <svg viewBox="0 0 120 16" className="h-[3.2cqmin] w-auto" aria-hidden="true">
        <path d="M2 8 H44 M76 8 H118" stroke={goldLight} strokeWidth="1" strokeLinecap="round" />
        <path d="M60 2 C 54 2, 50 8, 60 14 C 70 8, 66 2, 60 2 Z" fill="none" stroke={goldLight} strokeWidth="1.1" />
        <circle cx="48" cy="8" r="1.6" fill={goldLight} />
        <circle cx="72" cy="8" r="1.6" fill={goldLight} />
      </svg>
      <p
        className="mt-[2.4cqmin] text-[3cqmin] font-semibold uppercase leading-none"
        style={{ fontFamily: CAPS_FONT, letterSpacing: '0.42em', color: withAlpha(cream, 0.92) }}
      >
        {copy.bumperCaption1}
      </p>
      <h1
        className="px-[1cqmin] pb-[1.2cqmin] pt-[0.6cqmin] font-normal"
        style={{
          ...goldText,
          fontFamily: SCRIPT_FONT,
          fontSize: portrait ? '15cqmin' : '14cqmin',
          lineHeight: 1.15,
          textShadow: 'none',
          filter: `drop-shadow(0 0.5cqmin 0.8cqmin ${withAlpha(theme.deep, 0.55)})`,
        }}
      >
        {copy.bumperBrand}
      </h1>
      {copy.bumperCaption3 && (
        <div className="flex items-center gap-[1.6cqmin]">
          <span className="h-px w-[7cqmin]" style={{ backgroundColor: withAlpha(goldLight, 0.8) }} />
          <span className="h-[1cqmin] w-[1cqmin] rotate-45" style={{ backgroundColor: goldLight }} />
          <span
            className="text-[2.6cqmin] font-semibold uppercase leading-none"
            style={{ fontFamily: CAPS_FONT, letterSpacing: '0.24em', color: cream }}
          >
            {copy.bumperCaption3}
          </span>
          <span className="h-[1cqmin] w-[1cqmin] rotate-45" style={{ backgroundColor: goldLight }} />
          <span className="h-px w-[7cqmin]" style={{ backgroundColor: withAlpha(goldLight, 0.8) }} />
        </div>
      )}
      {copy.bumperCaption2 && (
        <p className="mt-[2.2cqmin] text-[3.4cqmin] italic leading-snug" style={{ fontFamily: SERIF_FONT, color: withAlpha(cream, 0.85) }}>
          {copy.bumperCaption2}
        </p>
      )}
      <span
        className="pb-wed-cta relative mt-[5cqmin] inline-flex items-center gap-[1.6cqmin] overflow-hidden rounded-full px-[4.4cqmin] py-[2cqmin] text-[2.7cqmin] font-semibold uppercase"
        style={{
          fontFamily: CAPS_FONT,
          letterSpacing: '0.2em',
          color: theme.primaryForeground,
          background: `linear-gradient(100deg, ${mix(gold, theme.deep, 0.1)}, ${goldLight} 45%, ${gold})`,
          boxShadow: `0 0 0 0.3cqmin ${withAlpha(goldLight, 0.5)}, 0 0 0 0.9cqmin ${withAlpha(gold, 0.18)}, 0 1.4cqmin 3cqmin ${withAlpha(theme.deep, 0.55)}`,
        }}
      >
        <svg viewBox="0 0 24 24" className="h-[3cqmin] w-[3cqmin]" fill="none" aria-hidden="true">
          <circle cx="9" cy="14" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="14" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3l1.6 2.4L12 7.6 10.4 5.4z" fill="currentColor" />
        </svg>
        {copy.bumperTapToStart}
      </span>
    </div>
  );

  const vendorMark = (
    <div className="relative z-20 flex items-center gap-[1.2cqmin] opacity-60">
      <span className="text-[1.8cqmin] uppercase" style={{ fontFamily: CAPS_FONT, letterSpacing: '0.3em', color: cream }}>
        photobooth by
      </span>
      <KelanaLogo className="h-[3.2cqmin] w-auto" ink={cream} light={theme.deep} />
    </div>
  );

  return (
    <div
      ref={rootRef}
      onClick={onAdvance}
      className={`pb-screen relative h-full w-full select-none ${onAdvance ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: theme.deep, color: cream }}
    >
      {/* velvet backdrop */}
      {hasImage ? (
        <img
          src={background!.imageUrl}
          alt=""
          draggable={false}
          className="pb-wed-drift absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: background!.position || 'center' }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(90deg, ${withAlpha(theme.deep, 0.0)} 0 4cqw, ${withAlpha(theme.deep, 0.35)} 6cqw, ${withAlpha(theme.deep, 0.0)} 8cqw), linear-gradient(160deg, ${mix(wine, '#ffffff', 0.08)}, ${wine} 45%, ${theme.deep})`,
          }}
        />
      )}
      {/* readability: vignette + a deeper side for the text */}
      <div
        className="absolute inset-0"
        style={{
          background: portrait
            ? `radial-gradient(130% 90% at 50% 30%, transparent 30%, ${withAlpha(theme.deep, 0.75)} 100%), linear-gradient(180deg, transparent 45%, ${withAlpha(theme.deep, 0.7)} 75%)`
            : `radial-gradient(120% 120% at 70% 45%, transparent 35%, ${withAlpha(theme.deep, 0.8)} 100%), linear-gradient(90deg, ${withAlpha(theme.deep, 0.72)} 0%, ${withAlpha(theme.deep, 0.35)} 45%, transparent 65%)`,
        }}
      />

      {/* gold bokeh */}
      {PETAL_R.slice(0, 16).map((r, i) => (
        <span
          key={`b${i}`}
          className="pb-wed-twinkle pointer-events-none absolute rounded-full"
          style={
            {
              left: `${(r * 97 + i * 13) % 100}%`,
              top: `${(PETAL_R[i + 20] * 80 + 4) % 92}%`,
              width: `${2 + PETAL_R[i + 40] * 5}cqmin`,
              height: `${2 + PETAL_R[i + 40] * 5}cqmin`,
              background: `radial-gradient(circle, ${withAlpha(goldLight, 0.55)}, transparent 70%)`,
              '--tw-dur': `${3 + PETAL_R[i + 50] * 4}s`,
              '--tw-delay': `${-PETAL_R[i + 60] * 6}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* layout */}
      {portrait ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] px-[6cqw] py-[4cqh]">
          <div className="relative h-[40cqh] w-[min(58cqw,28cqh)] shrink-0">{arch}</div>
          <div className="relative z-20">{text}</div>
          {vendorMark}
        </div>
      ) : (
        <>
          <div className="absolute left-[7cqw] top-1/2 w-[50cqw] -translate-y-1/2">{text}</div>
          <div className="absolute right-[9cqw] top-[9cqh] h-[78cqh] w-[min(34cqw,56cqh)]">{arch}</div>
        </>
      )}

      {/* falling petals, in front of everything but the CTA tap target */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => {
          const r = PETAL_R[i];
          const size = 1.6 + PETAL_R[i + 18] * 2.2;
          const tone = tones[i % 3];
          return (
            <span
              key={`p${i}`}
              className="pb-wed-petal absolute top-0"
              style={
                {
                  left: `${r * 100}%`,
                  '--pf-dur': `${11 + PETAL_R[i + 30] * 10}s`,
                  '--pf-delay': `${-PETAL_R[i + 45] * 20}s`,
                  '--pf-drift': `${(PETAL_R[i + 60] - 0.5) * 24}cqw`,
                } as React.CSSProperties
              }
            >
              <span
                className="pb-wed-petal-spin block"
                style={
                  {
                    width: `${size}cqmin`,
                    height: `${size * 1.25}cqmin`,
                    borderRadius: '80% 10% 80% 10%',
                    background: `linear-gradient(135deg, ${tone.light}, ${tone.base} 60%, ${tone.edge})`,
                    opacity: 0.85,
                    '--ps-dur': `${3 + PETAL_R[i + 70] * 3}s`,
                  } as React.CSSProperties
                }
              />
            </span>
          );
        })}
      </div>

      {/* vendor mark, quiet (portrait: in the flow under the button) */}
      {!portrait && <div className="absolute bottom-[3.5cqh] left-[7cqw] z-20">{vendorMark}</div>}

      <SetupGearButton onOpenPin={onOpenPin} color={cream} border={withAlpha(cream, 0.35)} />
    </div>
  );
};

export default WeddingRomanceView;
