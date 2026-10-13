import React, { useEffect, useId, useRef, useState } from 'react';
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
  /** Sample photos for the window when there is no live camera (admin preview). */
  photos: string[];
  /** Live camera shown in the arched window (the booth passes StartCameraFeed). */
  cameraFeed?: React.ReactNode;
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

const LEAF = '#8E9C7C';
const LEAF_DEEP = '#5F6E52';
const EUCALYPTUS = '#A3B5A6';

interface RoseTone {
  light: string;
  base: string;
  edge: string;
}

/** A cupped garden rose drawn in SVG units around (0,0), radius ~50. */
const Rose: React.FC<{ tone: RoseTone; x: number; y: number; r: number; rot: number }> = ({ tone, x, y, r, rot }) => {
  const id = useId().replace(/:/g, '');
  const rings: Array<[number, number, number]> = [
    // [petals, distance, petal radius]
    [8, 25, 24],
    [7, 16, 19],
    [6, 9, 14],
    [5, 4, 9],
  ];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${r / 50})`}>
      <defs>
        <radialGradient id={`p-${id}`} cx="35%" cy="40%" r="75%">
          <stop offset="0%" stopColor={tone.light} />
          <stop offset="60%" stopColor={tone.base} />
          <stop offset="100%" stopColor={tone.edge} />
        </radialGradient>
      </defs>
      <circle r="44" fill={tone.edge} opacity="0.35" />
      {rings.map(([count, dist, pr], ri) =>
        Array.from({ length: count }, (_, i) => {
          const a = (360 / count) * i + ri * 23;
          return (
            <ellipse
              key={`${ri}-${i}`}
              cx={dist}
              cy={0}
              rx={pr}
              ry={pr * 0.82}
              transform={`rotate(${a})`}
              fill={`url(#p-${id})`}
              stroke={tone.edge}
              strokeOpacity="0.35"
              strokeWidth="0.8"
            />
          );
        }),
      )}
      <path
        d="M-2 -6 C 6 -8, 9 2, 2 6 C -5 9, -9 0, -4 -3 C 0 -5, 4 -1, 1 2"
        fill="none"
        stroke={tone.edge}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
    </g>
  );
};

const Leaf: React.FC<{ x: number; y: number; len: number; rot: number; color: string }> = ({ x, y, len, rot, color }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <path
      d={`M0 0 C ${len * 0.3} ${-len * 0.34}, ${len * 0.75} ${-len * 0.28}, ${len} 0 C ${len * 0.75} ${len * 0.28}, ${len * 0.3} ${len * 0.34}, 0 0 Z`}
      fill={color}
    />
    <path d={`M${len * 0.06} 0 Q ${len * 0.5} ${-len * 0.04} ${len * 0.9} 0`} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.9" fill="none" />
  </g>
);

/** Rose cluster with greenery and baby's breath, in a 200 x 150 box. */
const FloralCluster: React.FC<{ tones: RoseTone[]; className?: string; style?: React.CSSProperties; flip?: boolean }> = ({
  tones,
  className,
  style,
  flip,
}) => {
  const [blush, cream, deep] = tones;
  return (
    <svg viewBox="0 0 200 150" className={className} style={style} aria-hidden="true">
      <g transform={flip ? 'translate(200 0) scale(-1 1)' : undefined}>
        <Leaf x={92} y={82} len={74} rot={-160} color={LEAF} />
        <Leaf x={100} y={78} len={66} rot={-115} color={EUCALYPTUS} />
        <Leaf x={110} y={84} len={78} rot={-20} color={LEAF_DEEP} />
        <Leaf x={104} y={90} len={70} rot={25} color={LEAF} />
        <Leaf x={96} y={92} len={62} rot={150} color={EUCALYPTUS} />
        <Leaf x={120} y={70} len={56} rot={-55} color={LEAF_DEEP} />
        {[
          [44, 40], [52, 30], [36, 52], [150, 112], [162, 104], [158, 122], [60, 118], [48, 110],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <line x1={i < 3 ? 70 : i < 6 ? 132 : 78} y1={i < 3 ? 62 : i < 6 ? 100 : 104} x2={cx} y2={cy} stroke={LEAF_DEEP} strokeWidth="0.8" opacity="0.6" />
            <circle cx={cx} cy={cy} r="3.2" fill="#FBF5EE" />
          </g>
        ))}
        <Rose tone={deep} x={140} y={66} r={22} rot={20} />
        <Rose tone={cream} x={66} y={86} r={27} rot={-30} />
        <Rose tone={blush} x={104} y={78} r={36} rot={10} />
        <Rose tone={blush} x={140} y={98} r={20} rot={70} />
        <Rose tone={deep} x={84} y={112} r={15} rot={-60} />
      </g>
    </svg>
  );
};

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
  cameraFeed,
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
    if (cameraFeed || photos.length < 2) return;
    const timer = window.setInterval(() => setSlide((i) => (i + 1) % photos.length), 4800);
    return () => window.clearInterval(timer);
  }, [photos.length, cameraFeed]);

  const gold = theme.primary;
  const goldLight = theme.accent;
  const cream = theme.card;
  const wine = theme.secondary;
  const tones: RoseTone[] = [
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
          borderRadius: '50% 50% 2.2cqmin 2.2cqmin / 34% 34% 2.2cqmin 2.2cqmin',
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
            borderRadius: '50% 50% 1.2cqmin 1.2cqmin / 32% 32% 1.2cqmin 1.2cqmin',
            boxShadow: `0 0 0 0.35cqmin ${gold}, inset 0 0 3cqmin ${withAlpha(theme.deep, 0.45)}`,
            backgroundColor: theme.deep,
          }}
        >
          {cameraFeed ?? photos.map((src, i) => (
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
      {/* rose clusters in the four corners only, clear of faces: the top pair
          sits in the empty space outside the arch curve */}
      <FloralCluster tones={tones} className="absolute -left-[9%] -top-[9%] w-[34%]" style={{ transform: 'rotate(-35deg)' }} />
      <FloralCluster tones={tones} flip className="absolute -right-[9%] -top-[9%] w-[34%]" style={{ transform: 'rotate(35deg)' }} />
      <FloralCluster tones={tones} className="absolute -bottom-[12%] -left-[10%] w-[32%]" style={{ transform: 'rotate(150deg)' }} />
      <FloralCluster tones={tones} flip className="absolute -bottom-[12%] -right-[10%] w-[32%]" style={{ transform: 'rotate(-150deg)' }} />
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
          fontSize: portrait ? '15cqmin' : '12.5cqmin',
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
          <div className="relative w-[min(82cqw,54cqh)] shrink-0" style={{ aspectRatio: '4 / 3' }}>{arch}</div>
          <div className="relative z-20">{text}</div>
          {vendorMark}
        </div>
      ) : (
        <>
          <div className="absolute left-[6cqw] top-1/2 w-[40cqw] -translate-y-1/2">{text}</div>
          <div
            className="absolute right-[6cqw] top-1/2 w-[min(48cqw,82cqh)] -translate-y-1/2"
            style={{ aspectRatio: '4 / 3' }}
          >
            {arch}
          </div>
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
