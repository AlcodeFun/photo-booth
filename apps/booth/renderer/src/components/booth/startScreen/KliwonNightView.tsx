import React, { useEffect, useId, useRef, useState } from 'react';
import type { BoothBackground, BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../../lib/appearance';
import { KelanaLogo } from '../../brand/KelanaLogo';
import { SetupGearButton } from './StartScreenParts';

/**
 * "Malam Jumat Kliwon" start screen (Hantu Nusantara): Indonesian ghosts on a
 * village graveyard night. A kuntilanak hovers by the moon laughing
 * "hihihi…", a pocong hops along the graves, kunang-kunang wander, and
 * kamboja blossoms fall. The live camera plays in a carved teak window
 * crowned with a gunungan; a tuyul peeks out from behind its left edge, a
 * bamboo obor burns on the right and kemenyan smoke curls at its foot. All
 * of it stays outside the middle of the window, so faces stay clear.
 *
 * Every color comes from the theme (blood = primary, banyan green =
 * secondary, kamboja cream = tertiary, torch gold = accent, night = deep,
 * shroud white = card). Copy mapping:
 *   bumperCaption1 → eyebrow ("Malam Jumat Kliwon")
 *   bumperBrand    → the title in the dripping face
 *   bumperCaption3 → the small badge (e.g. "Hantu Nusantara")
 *   bumperCaption2 → the line under the title
 */

export interface KliwonNightViewProps {
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

const DRIP_FONT = "'Nosifer', 'Creepster', 'Impact', fantasy";
const ROUND_FONT = "'Fredoka', 'Nunito', 'Arial Rounded MT Bold', sans-serif";
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Nosifer&family=Fredoka:wght@500;600;700&display=swap';

const useKliwonFonts = () => {
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
const R = seq(160, 57);

type Art = { className?: string; style?: React.CSSProperties };

/** Pocong (60 x 140 box): a shroud tied at the head, neck and feet. */
const Pocong: React.FC<Art & { shroud: string; shade: string; face: string; night: string }> = ({
  shroud,
  shade,
  face,
  night,
  className,
  style,
}) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 60 140" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`pc-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={shade} />
          <stop offset="35%" stopColor={shroud} />
          <stop offset="70%" stopColor={shroud} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>
      </defs>
      {/* top knot */}
      <path d="M30 13 C25 9 21 2 25 1 C28 0 29 6 30 9 C31 6 32 0 35 1 C39 2 35 9 30 13 Z" fill={shroud} stroke={shade} strokeWidth="0.8" />
      <rect x="26" y="11" width="8" height="4" rx="1.5" fill={shade} />
      {/* body */}
      <path
        d="M30 14 C17 14 12 25 12 39 L12 112 C12 121 17 125 21 127 L39 127 C43 125 48 121 48 112 L48 39 C48 25 43 14 30 14 Z"
        fill={`url(#pc-${id})`}
      />
      {/* folds */}
      <g stroke={shade} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8">
        <path d="M20 66 C22 84 20 100 22 118" />
        <path d="M39 64 C37 80 40 98 38 120" />
        <path d="M30 70 C31 88 29 104 30 122" opacity="0.5" />
      </g>
      {/* neck tie */}
      <path d="M13 57 Q30 63 47 57 L47 61 Q30 67 13 61 Z" fill={shade} />
      <path d="M44 59 L52 54 L50 62 Z M44 60 L51 67 L46 66 Z" fill={shroud} stroke={shade} strokeWidth="0.6" />
      {/* foot knot */}
      <path d="M21 127 L15 138 L30 131 L45 138 L39 127 Z" fill={shroud} stroke={shade} strokeWidth="0.8" />
      {/* face */}
      <ellipse cx="30" cy="36" rx="11.5" ry="14" fill={face} />
      <ellipse cx="30" cy="36" rx="11.5" ry="14" fill="none" stroke={shade} strokeWidth="1.4" />
      <circle cx="25" cy="33" r="4.6" fill={night} />
      <circle cx="35" cy="33" r="4.6" fill={night} />
      <circle cx="26" cy="32" r="1.3" fill={shroud} />
      <circle cx="36" cy="32" r="1.3" fill={shroud} />
      <ellipse cx="30" cy="43" rx="2.4" ry="1.8" fill={night} opacity="0.8" />
    </svg>
  );
};

/** Kuntilanak (120 x 170 box): long black hair, white gown, floating hem. */
const Kuntilanak: React.FC<Art & { gown: string; shade: string; skin: string; hair: string; eye: string }> = ({
  gown,
  shade,
  skin,
  hair,
  eye,
  className,
  style,
}) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 120 170" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`kg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={gown} />
          <stop offset="70%" stopColor={gown} stopOpacity="0.95" />
          <stop offset="100%" stopColor={gown} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* hair, back */}
      <g className="pb-kl-hair">
        <path
          d="M60 8 C33 8 25 31 27 58 C29 88 21 112 10 134 C28 130 39 120 44 106 L76 106 C81 120 92 130 110 134 C99 112 91 88 93 58 C95 31 87 8 60 8 Z"
          fill={hair}
        />
      </g>
      {/* gown with a ragged, fading hem */}
      <path
        d="M43 54 C36 74 30 104 20 160 C28 154 33 166 41 156 C47 168 54 156 60 166 C66 156 73 168 79 156 C87 166 92 154 100 160 C90 104 84 74 77 54 C72 50 48 50 43 54 Z"
        fill={`url(#kg-${id})`}
      />
      <g stroke={shade} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M50 70 C46 96 42 120 38 150" />
        <path d="M70 70 C74 96 78 120 82 150" />
        <path d="M60 74 C60 100 60 124 60 156" opacity="0.6" />
      </g>
      {/* sleeves, arms hanging forward */}
      <path d="M44 56 C34 66 30 84 32 100 C36 102 40 100 42 96 C42 82 46 70 50 62 Z" fill={gown} stroke={shade} strokeWidth="0.8" />
      <path d="M76 56 C86 66 90 84 88 100 C84 102 80 100 78 96 C78 82 74 70 70 62 Z" fill={gown} stroke={shade} strokeWidth="0.8" />
      <path d="M32 100 L30 108 M35 101 L34 110 M38 100 L38 109" stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M88 100 L90 108 M85 101 L86 110 M82 100 L82 109" stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
      {/* face */}
      <ellipse cx="60" cy="40" rx="13.5" ry="17" fill={skin} />
      {/* eyes glow under the fringe, a thin red smile */}
      <ellipse cx="54" cy="41" rx="2.6" ry="1.7" fill={eye} />
      <ellipse cx="66" cy="41" rx="2.6" ry="1.7" fill={eye} />
      <path d="M53 50 Q60 55 67 50" stroke={eye} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* fringe and front strands falling over the shoulders */}
      <path d="M45 40 C44 18 76 18 75 40 C72 30 67 27 63 36 C60 27 55 27 52 36 C50 30 47 32 45 40 Z" fill={hair} />
      <path d="M46 34 C40 52 44 70 38 92 L44 92 C48 72 46 52 50 38 Z" fill={hair} />
      <path d="M74 34 C80 52 76 70 82 92 L76 92 C72 72 74 52 70 38 Z" fill={hair} />
    </svg>
  );
};

/** Tuyul (80 x 70 box): bald, big ears, big eyes, a cheeky grin, fingers on the edge. */
const Tuyul: React.FC<Art & { skin: string; shade: string; night: string; eye: string }> = ({ skin, shade, night, eye, className, style }) => (
  <svg viewBox="0 0 80 70" className={className} style={style} aria-hidden="true">
    {/* ears */}
    <ellipse cx="13" cy="34" rx="9" ry="12" fill={skin} stroke={shade} strokeWidth="1" />
    <ellipse cx="13" cy="34" rx="4.5" ry="7" fill={shade} opacity="0.6" />
    <ellipse cx="67" cy="34" rx="9" ry="12" fill={skin} stroke={shade} strokeWidth="1" />
    <ellipse cx="67" cy="34" rx="4.5" ry="7" fill={shade} opacity="0.6" />
    {/* head */}
    <path d="M40 6 C58 6 66 20 66 36 C66 54 54 64 40 64 C26 64 14 54 14 36 C14 20 22 6 40 6 Z" fill={skin} stroke={shade} strokeWidth="1.2" />
    <path d="M30 12 C34 9 40 9 44 11" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* eyes */}
    <ellipse cx="31" cy="33" rx="6.5" ry="7.5" fill="#ffffff" />
    <ellipse cx="49" cy="33" rx="6.5" ry="7.5" fill="#ffffff" />
    <circle cx="29" cy="34" r="3.6" fill={eye} />
    <circle cx="47" cy="34" r="3.6" fill={eye} />
    <circle cx="29" cy="34" r="1.6" fill={night} />
    <circle cx="47" cy="34" r="1.6" fill={night} />
    {/* grin with two teeth */}
    <path d="M30 48 Q40 57 50 48 Q40 52 30 48 Z" fill={night} />
    <rect x="36" y="49" width="3.4" height="3.4" fill="#ffffff" />
    <rect x="40.6" y="49" width="3.4" height="3.4" fill="#ffffff" />
    {/* fingers gripping the frame edge */}
    <g fill={skin} stroke={shade} strokeWidth="0.9">
      <rect x="60" y="54" width="6" height="12" rx="3" />
      <rect x="66" y="52" width="6" height="13" rx="3" />
      <rect x="72" y="54" width="6" height="11" rx="3" />
    </g>
  </svg>
);

/** Kamboja (frangipani) blossom, 40 x 40 centred on 0,0: five twisting petals. */
const Kamboja: React.FC<Art & { petal: string; heart: string }> = ({ petal, heart, className, style }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="-20 -20 40 40" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`kb-${id}`} cx="0" cy="0" r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={heart} />
          <stop offset="38%" stopColor={heart} />
          <stop offset="62%" stopColor={petal} />
          <stop offset="100%" stopColor={petal} />
        </radialGradient>
      </defs>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path
          key={deg}
          d="M0 0 C-3 -5 -9 -12 -5 -17 C-1 -21 7 -18 6 -11 C5 -6 3 -3 0 0 Z"
          fill={`url(#kb-${id})`}
          stroke={heart}
          strokeOpacity="0.35"
          strokeWidth="0.5"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle r="2.2" fill={heart} />
    </svg>
  );
};

/** Bamboo obor (torch), 30 x 120: a burning wick on a jointed pole. */
const Obor: React.FC<Art & { pole: string; joint: string; flame: string; core: string }> = ({ pole, joint, flame, core, className, style }) => (
  <svg viewBox="0 0 30 120" className={className} style={style} aria-hidden="true">
    <ellipse className="pb-hw-flicker" cx="15" cy="20" rx="15" ry="18" fill={flame} opacity="0.22" />
    <rect x="11" y="34" width="8" height="86" rx="3" fill={pole} />
    {[52, 76, 100].map((y) => (
      <rect key={y} x="10" y={y} width="10" height="3" rx="1.5" fill={joint} />
    ))}
    <path d="M9 34 L21 34 L19 40 L11 40 Z" fill={joint} />
    <path className="pb-kl-flame" d="M15 4 C22 14 24 22 20 30 C18 34 12 34 10 30 C6 22 9 14 15 4 Z" fill={flame} />
    <path className="pb-kl-flame" d="M15 14 C19 20 19 26 17 30 C16 32 14 32 13 30 C11 26 11 20 15 14 Z" fill={core} style={{ animationDelay: '-0.3s' }} />
  </svg>
);

/** Gunungan (wayang kayon) crest, 100 x 140. */
const Gunungan: React.FC<Art & { gold: string; inner: string; line: string }> = ({ gold, inner, line, className, style }) => (
  <svg viewBox="0 0 100 140" className={className} style={style} aria-hidden="true">
    <path d="M50 2 C60 22 78 42 89 70 C95 86 95 104 87 116 L13 116 C5 104 5 86 11 70 C22 42 40 22 50 2 Z" fill={gold} />
    <path d="M50 12 C58 30 72 46 81 70 C86 84 86 99 80 108 L20 108 C14 99 14 84 19 70 C28 46 42 30 50 12 Z" fill={inner} />
    {/* tree of life */}
    <g stroke={line} strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M50 106 L50 30" />
      <path d="M50 92 C40 86 32 84 26 88 M50 92 C60 86 68 84 74 88" />
      <path d="M50 76 C42 70 36 66 30 68 M50 76 C58 70 64 66 70 68" />
      <path d="M50 60 C44 54 40 50 36 50 M50 60 C56 54 60 50 64 50" />
      <path d="M50 44 C46 40 44 36 42 34 M50 44 C54 40 56 36 58 34" />
    </g>
    {/* gate at the foot */}
    <path d="M36 116 L36 102 L42 96 L58 96 L64 102 L64 116 Z" fill={gold} />
    <rect x="46" y="102" width="8" height="14" fill={inner} />
    <path d="M40 116 L40 130 L60 130 L60 116 Z" fill={gold} />
    <rect x="30" y="130" width="40" height="8" rx="2" fill={gold} />
  </svg>
);

/**
 * Village graveyard skyline (1600 x 260): a joglo roof, a split gate (candi
 * bentar), bamboo, a banyan with hanging roots, and grave mounds with nisan.
 */
const Skyline: React.FC<{ far: string; near: string; window: string; className?: string }> = ({ far, near, window, className }) => {
  const graves = [110, 430, 690, 1230, 1470];
  return (
    <svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      {/* far hills, joglo house and the split gate */}
      <path d="M0 176 C200 140 380 128 560 150 C740 170 900 132 1080 140 C1260 148 1430 118 1600 138 L1600 260 L0 260 Z" fill={far} />
      <g fill={far}>
        <path d="M150 158 L190 122 L224 122 L262 88 L318 88 L356 122 L390 122 L430 158 Z" />
        <rect x="196" y="156" width="190" height="18" />
        <path d="M940 160 L940 112 L952 112 L952 92 L962 92 L962 72 L970 72 L970 54 L978 54 L978 40 L986 40 L986 160 Z" />
        <path d="M1024 160 L1024 40 L1032 40 L1032 54 L1040 54 L1040 72 L1048 72 L1048 92 L1058 92 L1058 112 L1070 112 L1070 160 Z" />
      </g>
      <g fill={window}>
        <rect className="pb-hw-flicker" x="232" y="160" width="12" height="10" rx="2" />
        <rect className="pb-hw-flicker" x="336" y="160" width="12" height="10" rx="2" style={{ animationDelay: '-1.1s' }} />
      </g>
      {/* bamboo clump */}
      <g stroke={near} strokeLinecap="round" fill="none">
        {[
          'M600 220 C596 160 590 110 570 60',
          'M612 220 C612 150 616 96 630 40',
          'M624 220 C628 168 640 120 664 76',
          'M590 220 C580 176 560 140 536 112',
        ].map((d) => (
          <path key={d} d={d} strokeWidth="6" />
        ))}
      </g>
      <g fill={near}>
        {[
          [570, 60, -30],
          [630, 40, 20],
          [664, 76, 40],
          [536, 112, -50],
          [584, 96, -10],
          [646, 70, 30],
        ].map(([x, y, r]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y} c-6 -10 -2 -26 4 -34 c4 10 2 24 -4 34 Z`} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
      {/* banyan (beringin): canopy, trunk and hanging aerial roots */}
      <g fill={near}>
        <path d="M1290 96 C1270 70 1300 40 1340 46 C1360 14 1420 10 1446 36 C1480 18 1540 30 1550 66 C1590 72 1600 104 1580 124 C1560 140 1520 132 1500 124 C1470 138 1420 136 1400 122 C1370 136 1320 130 1300 118 C1284 112 1282 104 1290 96 Z" />
        <path d="M1418 230 C1424 190 1420 150 1404 118 L1446 118 C1438 150 1440 190 1452 230 Z" />
      </g>
      <g stroke={near} strokeWidth="2.2" strokeLinecap="round" fill="none">
        {Array.from({ length: 16 }, (_, i) => {
          const x = 1306 + i * 17 + (i % 3) * 3;
          const len = 40 + ((i * 37) % 60);
          return <path key={i} d={`M${x} 118 C${x - 3} ${118 + len / 2} ${x + 3} ${118 + len * 0.8} ${x} ${118 + len}`} />;
        })}
      </g>
      {/* near ground */}
      <path d="M0 216 C220 198 420 208 640 202 C880 196 1080 216 1300 206 C1440 200 1520 208 1600 204 L1600 260 L0 260 Z" fill={near} />
      {/* grave mounds with a pair of nisan each */}
      <g fill={near}>
        {graves.map((x) => (
          <g key={x}>
            <path d={`M${x - 46} 216 Q${x} 190 ${x + 46} 216 Z`} />
            <path d={`M${x - 40} 210 L${x - 40} 184 Q${x - 34} 174 ${x - 28} 184 L${x - 28} 210 Z`} />
            <path d={`M${x + 28} 210 L${x + 28} 190 Q${x + 34} 180 ${x + 40} 190 L${x + 40} 210 Z`} />
          </g>
        ))}
      </g>
    </svg>
  );
};

export const KliwonNightView: React.FC<KliwonNightViewProps> = ({
  copy,
  theme,
  photos,
  cameraFeed,
  background,
  onAdvance,
  onOpenPin,
}) => {
  useKliwonFonts();
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

  const blood = theme.primary;
  const banyan = theme.secondary;
  const kamboja = theme.tertiary;
  const torch = theme.accent;
  const night = theme.deep;
  const shroud = theme.card;
  const hasImage = background?.type === 'image' && Boolean(background.imageUrl);

  // Derived tones.
  const ghostSkin = mix(shroud, banyan, 0.22);
  const shroudShade = mix(shroud, banyan, 0.38);
  const hair = mix(night, '#000000', 0.4);
  const teak = mix(torch, night, 0.62);
  const teakDark = mix(torch, night, 0.8);
  const firefly = mix(kamboja, '#c8ff6a', 0.45);
  const silhouetteFar = mix(banyan, night, 0.66);
  const silhouetteNear = mix(night, '#000000', 0.4);

  // ---- carved teak window (camera / photos) ----
  const windowFrame = (
    <div className="relative h-full w-full">
      {/* tuyul hides behind the left edge and peeks out */}
      <div className="pb-kl-peek absolute -left-[11%] top-[66%] w-[14%]" aria-hidden="true">
        <Tuyul skin={mix(ghostSkin, banyan, 0.25)} shade={mix(banyan, night, 0.3)} night={night} eye={blood} className="w-full" />
      </div>

      <div
        className="absolute inset-0 rounded-[3.2cqmin]"
        style={{
          background: `linear-gradient(150deg, ${mix(teak, torch, 0.25)}, ${teak} 40%, ${teakDark} 100%)`,
          padding: '2cqmin',
          boxShadow: `0 0 0 0.35cqmin ${withAlpha(torch, 0.55)}, 0 0 4cqmin ${withAlpha(blood, 0.35)}, 0 2.4cqmin 4cqmin ${withAlpha(night, 0.85)}`,
        }}
      >
        {/* carved dotted inlay along the frame */}
        <div
          className="pointer-events-none absolute inset-[0.8cqmin] rounded-[2.6cqmin]"
          style={{ border: `0.32cqmin dotted ${withAlpha(torch, 0.55)}` }}
        />
        <div className="relative h-full w-full rounded-[1.6cqmin]" style={{ background: `linear-gradient(180deg, ${torch}, ${mix(torch, blood, 0.5)})`, padding: '0.4cqmin' }}>
          <div className="relative h-full w-full overflow-hidden rounded-[1.3cqmin]" style={{ backgroundColor: night }}>
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
            {/* graveyard grade: green mist at the top, torch warmth at the bottom */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(banyan, 0.32)}, transparent 38%, transparent 72%, ${withAlpha(blood, 0.2)})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* gunungan crest above the frame */}
      <Gunungan
        gold={torch}
        inner={mix(banyan, night, 0.35)}
        line={withAlpha(torch, 0.85)}
        className="absolute left-1/2 top-0 w-[13%] -translate-x-1/2 -translate-y-[86%]"
        style={{ filter: `drop-shadow(0 0 1.6cqmin ${withAlpha(torch, 0.45)})` }}
      />

      {/* kamboja sprig on the top-left corner */}
      <div className="pointer-events-none absolute -left-[5%] -top-[7%] w-[24%]" aria-hidden="true">
        <svg viewBox="0 0 120 80" className="absolute inset-0 w-full" aria-hidden="true">
          <path d="M8 70 C30 50 52 40 84 34" stroke={mix(banyan, night, 0.2)} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M40 52 C34 30 46 14 64 10 C66 28 56 44 40 52 Z" fill={banyan} />
          <path d="M60 42 C70 26 88 22 102 28 C94 42 78 48 60 42 Z" fill={mix(banyan, kamboja, 0.12)} />
        </svg>
        <Kamboja petal={kamboja} heart={torch} className="absolute left-[2%] top-[34%] w-[36%]" style={{ transform: 'rotate(-12deg)' }} />
        <Kamboja petal={kamboja} heart={torch} className="absolute left-[30%] top-[4%] w-[30%]" style={{ transform: 'rotate(24deg)' }} />
        <Kamboja petal={kamboja} heart={torch} className="absolute left-[58%] top-[30%] w-[26%]" style={{ transform: 'rotate(-40deg)' }} />
      </div>

      {/* bamboo obor on the bottom-right corner, kemenyan smoke at its foot */}
      <div className="pointer-events-none absolute -bottom-[12%] -right-[6%] w-[9%]" aria-hidden="true">
        <svg viewBox="0 0 40 120" className="absolute -left-[60%] bottom-[18%] w-[110%] overflow-visible" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              className="pb-kl-smoke"
              d="M20 118 C10 100 30 88 20 70 C12 56 28 44 20 26"
              stroke={withAlpha(shroud, 0.4)}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              style={{ '--sm-delay': `${-i * 1.7}s` } as React.CSSProperties}
            />
          ))}
        </svg>
        <Obor pole={mix(torch, night, 0.45)} joint={teakDark} flame={torch} core={mix(torch, '#ffffff', 0.6)} className="relative w-full" />
      </div>
    </div>
  );

  // ---- text ----
  const text = (
    <div className={`relative z-20 flex flex-col ${portrait ? 'items-center text-center' : 'items-start text-left'}`}>
      <p
        className="text-[3cqmin] font-semibold uppercase leading-none"
        style={{ fontFamily: ROUND_FONT, letterSpacing: '0.3em', color: kamboja, textShadow: `0 0 1.6cqmin ${withAlpha(torch, 0.55)}` }}
      >
        {copy.bumperCaption1}
      </p>
      <h1
        className="px-[0.6cqmin] pb-[2.4cqmin] pt-[1.6cqmin] font-normal"
        style={{
          fontFamily: DRIP_FONT,
          fontSize: portrait ? '8.4cqmin' : '7.6cqmin',
          lineHeight: 1.15,
          letterSpacing: '0.01em',
          color: blood,
          backgroundImage: `linear-gradient(180deg, ${mix(blood, '#ffffff', 0.35)} 0%, ${mix(blood, '#ff3b3b', 0.3)} 35%, ${blood} 70%, ${mix(blood, night, 0.35)} 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 0 1.2cqmin ${withAlpha(blood, 0.6)}) drop-shadow(0 0.5cqmin 0 ${night})`,
        }}
      >
        {copy.bumperBrand}
      </h1>
      {copy.bumperCaption3 && (
        <span
          className="inline-flex items-center gap-[1.2cqmin] rounded-full px-[2.4cqmin] py-[0.9cqmin] text-[2.3cqmin] font-semibold uppercase leading-none"
          style={{
            fontFamily: ROUND_FONT,
            letterSpacing: '0.18em',
            color: shroud,
            backgroundColor: withAlpha(banyan, 0.8),
            boxShadow: `inset 0 0 0 0.25cqmin ${withAlpha(kamboja, 0.3)}`,
          }}
        >
          <Kamboja petal={kamboja} heart={torch} className="h-[2.6cqmin] w-[2.6cqmin]" />
          {copy.bumperCaption3}
        </span>
      )}
      {copy.bumperCaption2 && (
        <p
          className={`mt-[2.4cqmin] text-[3.2cqmin] font-medium leading-snug ${portrait ? 'max-w-[72cqw]' : 'max-w-[38cqw]'}`}
          style={{ fontFamily: ROUND_FONT, color: withAlpha(shroud, 0.9) }}
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
            background: `linear-gradient(180deg, ${mix(theme.action, '#ffffff', 0.18)}, ${theme.action} 55%, ${mix(theme.action, night, 0.25)})`,
            boxShadow: `0 0 0 0.35cqmin ${night}, 0 0.9cqmin 0 0.35cqmin ${mix(theme.action, night, 0.6)}`,
            '--hw-glow': withAlpha(blood, 0.7),
          } as React.CSSProperties
        }
      >
        <svg viewBox="0 0 60 140" className="h-[4cqmin] w-auto" aria-hidden="true">
          <path d="M30 13 C25 9 21 2 25 1 C28 0 29 6 30 9 C31 6 32 0 35 1 C39 2 35 9 30 13 Z" fill="currentColor" />
          <path d="M30 14 C17 14 12 25 12 39 L12 112 C12 121 17 125 21 127 L39 127 C43 125 48 121 48 112 L48 39 C48 25 43 14 30 14 Z" fill="currentColor" />
          <path d="M21 127 L15 138 L30 131 L45 138 L39 127 Z" fill="currentColor" />
          <circle cx="25" cy="33" r="4.6" fill={theme.action} />
          <circle cx="35" cy="33" r="4.6" fill={theme.action} />
          <path d="M13 57 Q30 63 47 57 L47 61 Q30 67 13 61 Z" fill={theme.action} />
        </svg>
        {copy.bumperTapToStart}
      </span>
    </div>
  );

  const vendorMark = (
    <div className="relative z-20 flex items-center gap-[1.2cqmin] opacity-70">
      <span className="text-[1.8cqmin] font-semibold uppercase" style={{ fontFamily: ROUND_FONT, letterSpacing: '0.3em', color: shroud }}>
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
      style={{ backgroundColor: night, color: shroud }}
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
            background: `radial-gradient(55% 50% at ${portrait ? '74% 12%' : '44% 16%'}, ${withAlpha(mix(banyan, torch, 0.18), 0.6)}, transparent 72%), linear-gradient(180deg, ${mix(night, '#000', 0.2)} 0%, ${mix(banyan, night, 0.62)} 46%, ${mix(mix(banyan, shroud, 0.16), torch, 0.06)} 72%, ${mix(banyan, night, 0.35)} 100%)`,
          }}
        />
      )}

      {/* stars */}
      {R.slice(0, 30).map((r, i) => (
        <span
          key={`s${i}`}
          className="pb-wed-twinkle pointer-events-none absolute rounded-full"
          style={
            {
              left: `${(r * 100 + i * 7) % 100}%`,
              top: `${R[i + 30] * 50}%`,
              width: `${0.3 + R[i + 60] * 0.45}cqmin`,
              height: `${0.3 + R[i + 60] * 0.45}cqmin`,
              backgroundColor: shroud,
              '--tw-dur': `${2.5 + R[i + 10] * 4}s`,
              '--tw-delay': `${-R[i + 20] * 6}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* full moon with a reddish halo, a cloud drifting across */}
      <div
        className="pb-hw-moon pointer-events-none absolute rounded-full"
        style={{
          left: portrait ? '64%' : '41%',
          top: portrait ? '3%' : '3%',
          width: '19cqmin',
          height: '19cqmin',
          background: `radial-gradient(circle at 38% 36%, #FFFBEA 0%, ${mix(kamboja, torch, 0.25)} 55%, ${mix(torch, blood, 0.35)} 100%)`,
          boxShadow: `0 0 6cqmin 1.5cqmin ${withAlpha(mix(torch, blood, 0.3), 0.45)}, 0 0 18cqmin 6cqmin ${withAlpha(blood, 0.16)}`,
        }}
      >
        <span className="absolute left-[24%] top-[46%] h-[15%] w-[15%] rounded-full" style={{ backgroundColor: withAlpha(mix(torch, blood, 0.4), 0.3) }} />
        <span className="absolute left-[56%] top-[24%] h-[11%] w-[11%] rounded-full" style={{ backgroundColor: withAlpha(mix(torch, blood, 0.4), 0.26) }} />
      </div>
      <div
        className="pb-hw-fog pointer-events-none absolute h-[7cqmin] w-[34cqmin] rounded-full"
        style={
          {
            left: portrait ? '52%' : '33%',
            top: portrait ? '12%' : '14%',
            background: `radial-gradient(50% 50% at 50% 50%, ${withAlpha(mix(banyan, night, 0.3), 0.55)}, transparent 75%)`,
            '--fog-dur': '14s',
          } as React.CSSProperties
        }
      />

      {/* kuntilanak hovering near the moon, laughing */}
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: portrait ? '8%' : '19%', top: portrait ? '3%' : '4%', width: portrait ? '15cqmin' : '13cqmin' }}
        aria-hidden="true"
      >
        <div className="pb-kl-float">
          <Kuntilanak gown={shroud} shade={shroudShade} skin={ghostSkin} hair={hair} eye={blood} className="w-full" style={{ filter: `drop-shadow(0 0 2cqmin ${withAlpha(shroud, 0.35)})` }} />
        </div>
        {['hi', 'hihi', 'hihihi…'].map((word, i) => (
          <span
            key={word}
            className="pb-kl-laugh absolute whitespace-nowrap font-semibold italic"
            style={
              {
                left: `${92 + i * 10}%`,
                top: `${8 + i * 12}%`,
                fontFamily: ROUND_FONT,
                fontSize: `${1.8 + i * 0.4}cqmin`,
                color: withAlpha(shroud, 0.85),
                textShadow: `0 0 1cqmin ${withAlpha(blood, 0.6)}`,
                '--kl-delay': `${i * 0.6}s`,
              } as React.CSSProperties
            }
          >
            {word}
          </span>
        ))}
      </div>

      {/* skyline + mist */}
      <Skyline far={silhouetteFar} near={silhouetteNear} window={torch} className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] w-full" />

      {/* pocong hopping along the graves */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 h-[19cqmin] overflow-hidden ${portrait ? 'bottom-[0.5%]' : 'bottom-[4%]'}`}
        aria-hidden="true"
      >
        <span className="pb-kl-cross absolute bottom-0 left-0 block" style={{ '--kc-dur': '34s', '--kc-delay': '-9s' } as React.CSSProperties}>
          <span className="pb-kl-hop block">
            <Pocong shroud={shroud} shade={shroudShade} face={ghostSkin} night={night} className="block h-[15cqmin] w-auto" style={{ filter: `drop-shadow(0 0 1.4cqmin ${withAlpha(shroud, 0.3)})` }} />
          </span>
        </span>
      </div>

      <div
        className="pb-hw-fog pointer-events-none absolute -left-[10%] bottom-[2%] h-[22%] w-[120%]"
        style={{ background: `radial-gradient(50% 60% at 30% 60%, ${withAlpha(shroud, 0.15)}, transparent 70%), radial-gradient(40% 50% at 75% 70%, ${withAlpha(banyan, 0.3)}, transparent 70%)` }}
      />
      <div
        className="pb-hw-fog pointer-events-none absolute -left-[10%] -bottom-[4%] h-[20%] w-[120%]"
        style={
          {
            background: `radial-gradient(45% 60% at 60% 50%, ${withAlpha(shroud, 0.13)}, transparent 70%), radial-gradient(35% 50% at 15% 60%, ${withAlpha(banyan, 0.35)}, transparent 70%)`,
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
            : `linear-gradient(90deg, ${withAlpha(night, 0.62)} 0%, ${withAlpha(night, 0.25)} 40%, transparent 60%)`,
        }}
      />

      {/* layout */}
      {portrait ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] px-[6cqw] py-[4cqh]">
          <div className="relative mt-[6cqh] w-[min(78cqw,38cqh)] shrink-0" style={{ aspectRatio: '4 / 3' }}>
            {windowFrame}
          </div>
          <div className="relative z-20">{text}</div>
          {vendorMark}
        </div>
      ) : (
        <>
          <div className="absolute left-[6cqw] top-1/2 w-[40cqw] -translate-y-1/2">{text}</div>
          <div className="absolute right-[5cqw] top-[54%] w-[min(48cqw,74cqh)] -translate-y-1/2" style={{ aspectRatio: '4 / 3' }}>
            {windowFrame}
          </div>
        </>
      )}

      {/* falling kamboja + kunang-kunang, in front of everything but the tap target */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={`k${i}`}
            className="pb-wed-petal absolute top-0"
            style={
              {
                left: `${(R[i + 100] * 96 + i * 11) % 96}%`,
                '--pf-dur': `${13 + R[i + 110] * 10}s`,
                '--pf-delay': `${-R[i + 120] * 22}s`,
                '--pf-drift': `${(R[i + 130] - 0.5) * 16}cqw`,
              } as React.CSSProperties
            }
          >
            <span className="pb-wed-petal-spin block" style={{ '--ps-dur': `${3 + R[i + 140] * 3}s` } as React.CSSProperties}>
              <Kamboja petal={kamboja} heart={torch} className="block" style={{ width: `${2.6 + R[i + 150] * 2}cqmin`, opacity: 0.9 }} />
            </span>
          </span>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={`f${i}`}
            className="pb-kl-firefly absolute rounded-full"
            style={
              {
                left: `${(R[i + 40] * 100 + i * 13) % 100}%`,
                top: `${46 + R[i + 54] * 46}%`,
                width: '0.9cqmin',
                height: '0.9cqmin',
                backgroundColor: firefly,
                boxShadow: `0 0 1.2cqmin 0.4cqmin ${withAlpha(firefly, 0.7)}`,
                '--ff-dur': `${8 + R[i + 68] * 8}s`,
                '--ff-delay': `${-R[i + 82] * 10}s`,
                '--ff-glow': `${1.6 + R[i + 96] * 2}s`,
                '--ff-x1': `${(R[i + 1] - 0.5) * 10}cqmin`,
                '--ff-y1': `${(R[i + 2] - 0.7) * 8}cqmin`,
                '--ff-x2': `${(R[i + 3] - 0.5) * 12}cqmin`,
                '--ff-y2': `${(R[i + 4] - 0.7) * 10}cqmin`,
                '--ff-x3': `${(R[i + 5] - 0.5) * 10}cqmin`,
                '--ff-y3': `${(R[i + 6] - 0.5) * 6}cqmin`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {!portrait && <div className="absolute bottom-[3.5cqh] left-[6cqw] z-20">{vendorMark}</div>}

      <SetupGearButton onOpenPin={onOpenPin} color={shroud} border={withAlpha(shroud, 0.35)} />
    </div>
  );
};

export default KliwonNightView;
