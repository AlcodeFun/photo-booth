import React, { useEffect, useId, useRef, useState } from 'react';
import type { BoothBackground, BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../../lib/appearance';
import { KelanaLogo } from '../../brand/KelanaLogo';
import { SetupGearButton } from './StartScreenParts';

/**
 * "Haunted Night" start screen (Halloween): a moonlit sky with bats and
 * drifting ghosts over a graveyard skyline and rolling fog. The live camera
 * plays in a gothic arched window, guarded by glowing jack-o'-lanterns at the
 * bottom corners, a cobweb and a dangling spider at the top: all outside the
 * middle of the window, so faces stay clear.
 *
 * Every color comes from the theme (pumpkin = primary, witch purple =
 * secondary, slime = tertiary, candle glow = accent, night = deep, bone =
 * card). Copy mapping:
 *   bumperCaption1 → eyebrow ("Happy Halloween")
 *   bumperBrand    → the title in the spooky face
 *   bumperCaption3 → the small badge (e.g. "Spooky Season")
 *   bumperCaption2 → the line under the title
 */

export interface HauntedNightViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** Sample photos for the window when there is no live camera (admin preview). */
  photos: string[];
  /** Live camera shown in the window (the booth passes StartCameraFeed). */
  cameraFeed?: React.ReactNode;
  /** The appearance background; an image replaces the drawn night sky. */
  background?: BoothBackground;
  onAdvance?: () => void;
  onOpenPin?: () => void;
}

const SPOOKY_FONT = "'Creepster', 'Chiller', 'Impact', fantasy";
const ROUND_FONT = "'Fredoka', 'Nunito', 'Arial Rounded MT Bold', sans-serif";
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Creepster&family=Fredoka:wght@500;600;700&display=swap';

const useHalloweenFonts = () => {
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

/** Deterministic pseudo-random sequence so decorations keep their places. */
const seq = (n: number, seed: number) => {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  });
};
const R = seq(120, 31);

/**
 * Gothic (pointed) arch as a CSS polygon for a 4:3 box: straight sides, two
 * circular arcs meeting in a point at the top centre.
 */
const GOTHIC_ARCH = (() => {
  const W = 4;
  const H = 3;
  const rise = 1.05; // arch height, in the same units as W / H
  const r = (W * W) / 4 / W + (rise * rise) / W; // circle through (0,rise) and (W/2,0), centre (r,rise)
  const end = Math.atan2(-rise, W / 2 - r);
  const pts: string[] = [`0% 100%`];
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const t = Math.PI + ((2 * Math.PI + end - Math.PI) * i) / steps;
    const x = r + r * Math.cos(t);
    const y = rise + r * Math.sin(t);
    pts.push(`${((x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = Math.PI + ((2 * Math.PI + end - Math.PI) * i) / steps;
    const x = W - (r + r * Math.cos(t));
    const y = rise + r * Math.sin(t);
    pts.push(`${((x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`);
  }
  pts.push(`100% 100%`);
  return `polygon(${pts.join(', ')})`;
})();

const BAT_PATH =
  'M50 34 C47 27 42 25 37 27 C34 20 26 15 14 17 C20 22 21 29 18 36 C25 33 31 35 35 41 C39 38 45 39 50 45 C55 39 61 38 65 41 C69 35 75 33 82 36 C79 29 80 22 86 17 C74 15 66 20 63 27 C58 25 53 27 50 34 Z M46 30 L44 23 L48 28 Z M54 30 L56 23 L52 28 Z';

const Bat: React.FC<{ color: string; className?: string; style?: React.CSSProperties }> = ({ color, className, style }) => (
  <svg viewBox="10 12 80 36" className={className} style={style} aria-hidden="true">
    <path d={BAT_PATH} fill={color} />
  </svg>
);

/** Jack-o'-lantern with a flickering candle glow, in a 120 x 110 box. */
const JackOLantern: React.FC<{ theme: BoothTheme; className?: string; style?: React.CSSProperties; grin?: 'wide' | 'toothy' }> = ({
  theme,
  className,
  style,
  grin = 'wide',
}) => {
  const id = useId().replace(/:/g, '');
  const body = theme.primary;
  const light = mix(theme.primary, theme.accent, 0.45);
  const shade = mix(theme.primary, theme.deep, 0.45);
  const glow = theme.accent;
  const ribs: Array<[number, number]> = [
    [24, 30],
    [96, 30],
    [40, 36],
    [80, 36],
    [60, 40],
  ];
  return (
    <svg viewBox="0 0 120 110" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`pk-${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={body} />
          <stop offset="100%" stopColor={shade} />
        </radialGradient>
        <radialGradient id={`gl-${id}`} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#FFF6C8" />
          <stop offset="45%" stopColor={glow} />
          <stop offset="100%" stopColor={theme.primary} />
        </radialGradient>
      </defs>
      {/* ground glow */}
      <ellipse className="pb-hw-flicker" cx="60" cy="104" rx="56" ry="7" fill={withAlpha(glow, 0.35)} />
      {/* stem */}
      <path d="M57 22 C56 14 58 8 64 4 L68 7 C63 11 63 16 64 22 Z" fill={mix(theme.tertiary, theme.deep, 0.55)} />
      {/* ribs, back to front */}
      {ribs.map(([cx, rx], i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={62}
          rx={rx}
          ry={40}
          fill={`url(#pk-${id})`}
          stroke={shade}
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
      ))}
      {/* carved face */}
      <g className="pb-hw-flicker" fill={`url(#gl-${id})`}>
        <path d="M34 50 L46 36 L52 54 Z" />
        <path d="M86 50 L74 36 L68 54 Z" />
        <path d="M56 58 L60 50 L64 58 Z" />
        {grin === 'wide' ? (
          <path d="M30 68 C42 86 78 86 90 68 L82 70 L78 78 L72 72 L66 80 L60 73 L54 80 L48 72 L42 78 L38 70 Z" />
        ) : (
          <path d="M34 70 C44 90 76 90 86 70 C78 74 70 75 66 74 L66 80 L58 80 L58 75 C48 75 40 73 34 70 Z" />
        )}
      </g>
    </svg>
  );
};

/** Little ghost (64 x 76 box) with a wavy hem. */
const Ghost: React.FC<{ fill: string; eye: string; className?: string; style?: React.CSSProperties }> = ({ fill, eye, className, style }) => (
  <svg viewBox="0 0 64 76" className={className} style={style} aria-hidden="true">
    <path
      d="M6 34 C6 14 18 4 32 4 C46 4 58 14 58 34 L58 70 C54 74 50 66 46 70 C42 74 38 66 34 70 C30 74 26 66 22 70 C18 74 14 66 10 70 C7 72 6 70 6 68 Z"
      fill={fill}
    />
    <ellipse cx="23" cy="32" rx="4.5" ry="6.5" fill={eye} />
    <ellipse cx="41" cy="32" rx="4.5" ry="6.5" fill={eye} />
    <ellipse cx="32" cy="46" rx="5" ry="4" fill={eye} opacity="0.85" />
  </svg>
);

/** Corner cobweb (100 x 100 box, anchored top-left). */
const Cobweb: React.FC<{ color: string; className?: string; style?: React.CSSProperties }> = ({ color, className, style }) => {
  const spokes = [0, 18, 36, 54, 72, 90];
  const ring = (d: number) =>
    spokes
      .map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
        // Each strand sags toward the corner between two spokes.
        const mid = ((deg + spokes[i - 1]) / 2) * (Math.PI / 180);
        const sag = d * 0.82;
        return `Q${(Math.cos(mid) * sag).toFixed(1)} ${(Math.sin(mid) * sag).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <g stroke={color} strokeWidth="0.9" fill="none" strokeLinecap="round">
        {spokes.map((deg) => {
          const a = (deg * Math.PI) / 180;
          return <line key={deg} x1="0" y1="0" x2={Math.cos(a) * 100} y2={Math.sin(a) * 100} />;
        })}
        {[22, 40, 58, 76, 94].map((d) => (
          <path key={d} d={ring(d)} />
        ))}
      </g>
    </svg>
  );
};

/** Graveyard skyline (1600 x 260): hills, a crooked house, tombstones, a dead tree, a fence. */
const Skyline: React.FC<{ far: string; near: string; window: string; className?: string }> = ({ far, near, window, className }) => (
  <svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
    {/* far hill with the haunted house */}
    <path d="M0 170 C180 120 360 110 520 140 C700 172 860 120 1040 128 C1240 136 1420 100 1600 130 L1600 260 L0 260 Z" fill={far} />
    <g fill={far}>
      <path d="M210 150 L210 70 L250 40 L290 70 L290 150 Z" />
      <path d="M262 70 L262 18 L276 8 L290 18 L290 70 Z" />
      <path d="M180 150 L180 98 L222 76 L262 98 L262 150 Z" />
      <path d="M276 8 L276 -4 L279 -4 L279 8 Z" />
    </g>
    <g fill={window}>
      <rect className="pb-hw-flicker" x="226" y="84" width="10" height="14" rx="2" />
      <rect x="266" y="32" width="8" height="12" rx="2" opacity="0.7" />
      <rect className="pb-hw-flicker" x="198" y="112" width="10" height="12" rx="2" style={{ animationDelay: '-1.3s' }} />
    </g>
    {/* near ground */}
    <path d="M0 214 C220 196 420 206 640 200 C880 194 1080 214 1300 204 C1440 198 1520 206 1600 202 L1600 260 L0 260 Z" fill={near} />
    {/* tombstones */}
    <g fill={near}>
      <path d="M120 214 L120 176 C120 160 152 160 152 176 L152 214 Z" />
      <path d="M380 208 L380 180 C380 168 404 168 404 180 L404 208 Z" />
      <path d="M1180 210 L1180 172 C1180 156 1214 156 1214 172 L1214 210 Z" />
      <path d="M1420 206 L1420 166 L1432 166 L1432 152 L1442 152 L1442 166 L1454 166 L1454 176 L1442 176 L1442 206 Z" />
      <path d="M560 204 L560 160 L572 160 L572 146 L582 146 L582 160 L594 160 L594 170 L582 170 L582 204 Z" />
    </g>
    {/* dead tree */}
    <path
      d="M1500 206 C1496 160 1504 120 1490 80 C1484 62 1470 50 1452 44 L1456 40 C1474 44 1488 54 1494 68 C1498 48 1494 30 1484 16 L1489 13 C1500 28 1504 48 1500 70 C1512 52 1530 44 1548 44 L1548 49 C1530 50 1514 60 1504 80 C1512 116 1508 160 1514 206 Z"
      fill={near}
    />
    {/* fence */}
    <g fill={near}>
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${760 + i * 26} 206 L${760 + i * 26} 168 L${765 + i * 26} 160 L${770 + i * 26} 168 L${770 + i * 26} 206 Z`} />
      ))}
      <rect x="756" y="176" width="222" height="5" />
      <rect x="756" y="194" width="222" height="5" />
    </g>
  </svg>
);

export const HauntedNightView: React.FC<HauntedNightViewProps> = ({
  copy,
  theme,
  photos,
  cameraFeed,
  background,
  onAdvance,
  onOpenPin,
}) => {
  useHalloweenFonts();
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

  const pumpkin = theme.primary;
  const purple = theme.secondary;
  const slime = theme.tertiary;
  const candle = theme.accent;
  const night = theme.deep;
  const bone = theme.card;
  const hasImage = background?.type === 'image' && Boolean(background.imageUrl);
  const silhouetteFar = mix(purple, night, 0.72);
  const silhouetteNear = mix(night, '#000000', 0.35);

  // ---- gothic window (camera / photos) ----
  const windowFrame = (
    <div
      className="relative h-full w-full"
      style={{ filter: `drop-shadow(0 0 2.6cqmin ${withAlpha(pumpkin, 0.45)}) drop-shadow(0 2cqmin 3cqmin ${withAlpha(night, 0.8)})` }}
    >
      {/* iron frame with a pumpkin-glow edge */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: GOTHIC_ARCH,
          background: `linear-gradient(160deg, ${mix(purple, night, 0.35)}, ${mix(night, '#000', 0.2)} 60%, ${mix(purple, night, 0.5)})`,
          padding: '1.8cqmin',
        }}
      >
        <div className="h-full w-full" style={{ clipPath: GOTHIC_ARCH, background: `linear-gradient(180deg, ${candle}, ${pumpkin})`, padding: '0.45cqmin' }}>
          <div className="relative h-full w-full overflow-hidden" style={{ clipPath: GOTHIC_ARCH, backgroundColor: night }}>
            {cameraFeed ??
              photos.map((src, i) => (
                <img
                  key={src + i}
                  src={src}
                  alt=""
                  draggable={false}
                  className="pb-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out"
                  style={{ opacity: i === slide ? 1 : 0 }}
                />
              ))}
            {/* moonlit grade: purple at the top, candle warmth at the bottom */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(purple, 0.28)}, transparent 35%, transparent 70%, ${withAlpha(pumpkin, 0.22)})`,
              }}
            />
          </div>
        </div>
      </div>
      {/* cobweb in the top-left corner, spider dangling at the top right */}
      <Cobweb color={withAlpha(bone, 0.55)} className="absolute -left-[2%] -top-[3%] w-[22%]" />
      <div className="pb-hw-spider absolute right-[16%] top-[6%] flex flex-col items-center" style={{ width: '7%' }}>
        <span className="block w-px" style={{ height: '11cqmin', backgroundColor: withAlpha(bone, 0.6) }} />
        <svg viewBox="0 0 40 34" className="w-full" aria-hidden="true">
          <g stroke={night} strokeWidth="2.2" fill="none" strokeLinecap="round">
            <path d="M14 14 L4 6 M14 17 L2 16 M14 20 L4 28 M26 14 L36 6 M26 17 L38 16 M26 20 L36 28" />
          </g>
          <ellipse cx="20" cy="18" rx="8" ry="9" fill={night} />
          <circle cx="20" cy="9" r="5" fill={night} />
          <circle cx="18" cy="8.5" r="1.2" fill={candle} />
          <circle cx="22" cy="8.5" r="1.2" fill={candle} />
        </svg>
      </div>
      {/* jack-o'-lanterns on the bottom corners */}
      <JackOLantern theme={theme} className="absolute -bottom-[9%] -left-[8%] w-[24%]" />
      <JackOLantern theme={theme} grin="toothy" className="absolute -bottom-[7%] -right-[6%] w-[19%]" style={{ transform: 'scaleX(-1)' }} />
    </div>
  );

  // ---- text ----
  const text = (
    <div className={`relative z-20 flex flex-col ${portrait ? 'items-center text-center' : 'items-start text-left'}`}>
      <p
        className="text-[3cqmin] font-semibold uppercase leading-none"
        style={{ fontFamily: ROUND_FONT, letterSpacing: '0.34em', color: slime, textShadow: `0 0 1.6cqmin ${withAlpha(slime, 0.6)}` }}
      >
        {copy.bumperCaption1}
      </p>
      <h1
        className="pb-hw-title px-[0.6cqmin] pb-[0.6cqmin] pt-[1cqmin] font-normal"
        style={{
          fontFamily: SPOOKY_FONT,
          fontSize: portrait ? '13cqmin' : '13cqmin',
          lineHeight: 1,
          letterSpacing: '0.02em',
          color: pumpkin,
          backgroundImage: `linear-gradient(180deg, ${mix(candle, '#ffffff', 0.2)} 0%, ${candle} 30%, ${pumpkin} 65%, ${mix(pumpkin, night, 0.25)} 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 0 1.4cqmin ${withAlpha(pumpkin, 0.55)}) drop-shadow(0 0.5cqmin 0 ${night})`,
        }}
      >
        {copy.bumperBrand}
      </h1>
      {copy.bumperCaption3 && (
        <span
          className="mt-[1.4cqmin] inline-flex items-center gap-[1.2cqmin] rounded-full px-[2.4cqmin] py-[0.9cqmin] text-[2.3cqmin] font-semibold uppercase leading-none"
          style={{
            fontFamily: ROUND_FONT,
            letterSpacing: '0.18em',
            color: bone,
            backgroundColor: withAlpha(purple, 0.75),
            boxShadow: `inset 0 0 0 0.25cqmin ${withAlpha(bone, 0.25)}`,
          }}
        >
          <Bat color={bone} className="h-[2.2cqmin] w-auto" />
          {copy.bumperCaption3}
        </span>
      )}
      {copy.bumperCaption2 && (
        <p
          className={`mt-[2.4cqmin] text-[3.3cqmin] font-medium leading-snug ${portrait ? 'max-w-[72cqw]' : 'max-w-[38cqw]'}`}
          style={{ fontFamily: ROUND_FONT, color: withAlpha(bone, 0.9) }}
        >
          {copy.bumperCaption2}
        </p>
      )}
      <span
        className="pb-hw-cta relative mt-[4.4cqmin] inline-flex items-center gap-[1.6cqmin] rounded-full px-[4.4cqmin] py-[2cqmin] text-[3cqmin] font-bold uppercase"
        style={
          {
            fontFamily: ROUND_FONT,
            letterSpacing: '0.12em',
            color: theme.actionForeground,
            background: `linear-gradient(180deg, ${mix(theme.action, candle, 0.35)}, ${theme.action} 60%, ${mix(theme.action, night, 0.15)})`,
            boxShadow: `0 0 0 0.35cqmin ${night}, 0 0.9cqmin 0 0.35cqmin ${mix(theme.action, night, 0.55)}`,
            '--hw-glow': withAlpha(candle, 0.6),
          } as React.CSSProperties
        }
      >
        <svg viewBox="0 0 24 24" className="h-[3.4cqmin] w-[3.4cqmin]" aria-hidden="true">
          <path d="M12 6 C 12 4 13 3 14.5 2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="12" cy="14" rx="9" ry="7.5" fill="currentColor" />
          <path d="M7.5 12.5 L9.5 10 L10.5 13 Z M16.5 12.5 L14.5 10 L13.5 13 Z M8 16 Q12 19.5 16 16 L14 16.6 L12 15.6 L10 16.6 Z" fill={theme.action} />
        </svg>
        {copy.bumperTapToStart}
      </span>
    </div>
  );

  const vendorMark = (
    <div className="relative z-20 flex items-center gap-[1.2cqmin] opacity-70">
      <span className="text-[1.8cqmin] font-semibold uppercase" style={{ fontFamily: ROUND_FONT, letterSpacing: '0.3em', color: bone }}>
        photobooth by
      </span>
      <KelanaLogo className="h-[3.2cqmin] w-auto" variant="light" />
    </div>
  );

  return (
    <div
      ref={rootRef}
      onClick={onAdvance}
      className={`pb-screen relative h-full w-full select-none overflow-hidden ${onAdvance ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: night, color: bone }}
    >
      {/* sky */}
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
            background: `radial-gradient(60% 55% at ${portrait ? '72% 14%' : '46% 18%'}, ${withAlpha(mix(purple, candle, 0.2), 0.55)}, transparent 70%), linear-gradient(180deg, ${mix(night, '#000', 0.25)} 0%, ${mix(purple, night, 0.55)} 55%, ${mix(purple, night, 0.35)} 78%, ${night} 100%)`,
          }}
        />
      )}

      {/* stars */}
      {R.slice(0, 34).map((r, i) => (
        <span
          key={`s${i}`}
          className="pb-wed-twinkle pointer-events-none absolute rounded-full"
          style={
            {
              left: `${(r * 100 + i * 7) % 100}%`,
              top: `${R[i + 34] * 55}%`,
              width: `${0.35 + R[i + 68] * 0.5}cqmin`,
              height: `${0.35 + R[i + 68] * 0.5}cqmin`,
              backgroundColor: bone,
              '--tw-dur': `${2.5 + R[i + 10] * 4}s`,
              '--tw-delay': `${-R[i + 20] * 6}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* full moon */}
      <div
        className="pb-hw-moon pointer-events-none absolute rounded-full"
        style={{
          left: portrait ? '64%' : '36%',
          top: portrait ? '3%' : '7%',
          width: portrait ? '20cqmin' : '20cqmin',
          height: portrait ? '20cqmin' : '20cqmin',
          background: `radial-gradient(circle at 38% 36%, #FFFDF2 0%, ${mix(bone, candle, 0.25)} 55%, ${mix(candle, pumpkin, 0.3)} 100%)`,
          boxShadow: `0 0 6cqmin 1.5cqmin ${withAlpha(candle, 0.45)}, 0 0 18cqmin 6cqmin ${withAlpha(candle, 0.18)}`,
        }}
      >
        <span className="absolute left-[22%] top-[48%] h-[16%] w-[16%] rounded-full" style={{ backgroundColor: withAlpha(mix(candle, pumpkin, 0.4), 0.35) }} />
        <span className="absolute left-[56%] top-[24%] h-[11%] w-[11%] rounded-full" style={{ backgroundColor: withAlpha(mix(candle, pumpkin, 0.4), 0.3) }} />
        <span className="absolute left-[60%] top-[62%] h-[8%] w-[8%] rounded-full" style={{ backgroundColor: withAlpha(mix(candle, pumpkin, 0.4), 0.3) }} />
      </div>

      {/* ghosts drifting near the moon */}
      <Ghost
        fill={withAlpha(bone, 0.85)}
        eye={night}
        className="pb-hw-ghost pointer-events-none absolute w-[6cqmin]"
        style={{ left: portrait ? '12%' : '28%', top: portrait ? '10%' : '12%', '--gh-dur': '7s' } as React.CSSProperties}
      />
      <Ghost
        fill={withAlpha(bone, 0.6)}
        eye={night}
        className="pb-hw-ghost pointer-events-none absolute w-[4cqmin]"
        style={{ left: portrait ? '86%' : '58%', top: portrait ? '30%' : '6%', '--gh-dur': '9s', '--gh-delay': '-3s' } as React.CSSProperties}
      />

      {/* skyline + fog */}
      <Skyline far={silhouetteFar} near={silhouetteNear} window={candle} className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] w-full" />
      <div
        className="pb-hw-fog pointer-events-none absolute -left-[10%] bottom-[2%] h-[22%] w-[120%]"
        style={{ background: `radial-gradient(50% 60% at 30% 60%, ${withAlpha(bone, 0.16)}, transparent 70%), radial-gradient(40% 50% at 75% 70%, ${withAlpha(slime, 0.1)}, transparent 70%)` }}
      />
      <div
        className="pb-hw-fog pointer-events-none absolute -left-[10%] -bottom-[4%] h-[20%] w-[120%]"
        style={
          {
            background: `radial-gradient(45% 60% at 60% 50%, ${withAlpha(bone, 0.14)}, transparent 70%), radial-gradient(35% 50% at 15% 60%, ${withAlpha(purple, 0.25)}, transparent 70%)`,
            '--fog-dur': '26s',
            animationDirection: 'alternate-reverse',
          } as React.CSSProperties
        }
      />

      {/* readability behind the text */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: portrait
            ? `linear-gradient(180deg, transparent 50%, ${withAlpha(night, 0.6)} 80%)`
            : `linear-gradient(90deg, ${withAlpha(night, 0.6)} 0%, ${withAlpha(night, 0.25)} 40%, transparent 60%)`,
        }}
      />

      {/* layout */}
      {portrait ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] px-[6cqw] py-[4cqh]">
          <div className="relative w-[min(80cqw,40cqh)] shrink-0" style={{ aspectRatio: '4 / 3' }}>
            {windowFrame}
          </div>
          <div className="relative z-20">{text}</div>
          {vendorMark}
        </div>
      ) : (
        <>
          <div className="absolute left-[6cqw] top-1/2 w-[40cqw] -translate-y-1/2">{text}</div>
          <div className="absolute right-[5cqw] top-1/2 w-[min(49cqw,80cqh)] -translate-y-1/2" style={{ aspectRatio: '4 / 3' }}>
            {windowFrame}
          </div>
        </>
      )}

      {/* bats, in front of everything but the tap target */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={`b${i}`}
            className="pb-hw-bat absolute left-0"
            style={
              {
                top: `${4 + R[i + 80] * 38}%`,
                '--bf-dur': `${9 + R[i + 90] * 9}s`,
                '--bf-delay': `${-R[i + 100] * 18}s`,
                '--bf-bob': `${3 + R[i + 110] * 5}cqh`,
              } as React.CSSProperties
            }
          >
            <Bat
              color={mix(night, '#000', 0.4)}
              className="pb-hw-flap block"
              style={{ width: `${6 + R[i + 70] * 5}cqmin`, filter: `drop-shadow(0 0 0.6cqmin ${withAlpha(purple, 0.6)})` } as React.CSSProperties}
            />
          </span>
        ))}
      </div>

      {!portrait && <div className="absolute bottom-[3.5cqh] left-[6cqw] z-20">{vendorMark}</div>}

      <SetupGearButton onOpenPin={onOpenPin} color={bone} border={withAlpha(bone, 0.35)} />
    </div>
  );
};

export default HauntedNightView;
