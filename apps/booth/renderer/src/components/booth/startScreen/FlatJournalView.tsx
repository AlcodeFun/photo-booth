import React from 'react';
import { KelanaLogo } from '../../brand/KelanaLogo';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../../lib/appearance';
import {
  HAND_FONT,
  SetupGearButton,
  StartCta,
  useStartScreenFonts,
} from './StartScreenParts';

export interface FlatJournalViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** Sample photos for the polaroids and the film strip. */
  photos: string[];
  onAdvance?: () => void;
  onOpenPin?: () => void;
}

/** Ragged paper edge, as an SVG path across a 100-unit wide strip. */
const TORN_EDGE =
  'M0 0 H100 V6 L97 8 L94 5.5 L90 8.5 L86 6 L82 9 L78 6.5 L74 8 L70 5 L66 8.5 L62 6 L58 9 L54 6.5 L50 8 L46 5.5 L42 9 L38 6 L34 8.5 L30 5.5 L26 8 L22 6 L18 9 L14 6.5 L10 8 L6 5.5 L3 8.5 L0 6 Z';

interface PolaroidProps {
  src?: string;
  caption: string;
  theme: BoothTheme;
  style: React.CSSProperties;
  tape: string;
}

const Polaroid: React.FC<PolaroidProps> = ({ src, caption, theme, style, tape }) => (
  <figure
    className="pb-sway absolute w-[22cqmin] p-[1.2cqmin] pb-[4.5cqmin] shadow-[0_1.4cqmin_2.6cqmin_rgba(0,0,0,0.22)]"
    style={{ backgroundColor: '#fffdf8', ...style }}
  >
    {/* washi tape */}
    <span
      className="absolute -top-[1.6cqmin] left-1/2 h-[3.2cqmin] w-[10cqmin] -translate-x-1/2 rotate-[-4deg]"
      style={{ backgroundColor: withAlpha(tape, 0.75) }}
      aria-hidden="true"
    />
    <img src={src} alt="" className="aspect-square w-full object-cover" draggable={false} />
    <figcaption
      className="absolute inset-x-0 bottom-[0.6cqmin] text-center text-[3cqmin] leading-none"
      style={{ fontFamily: HAND_FONT, color: theme.foreground }}
    >
      {caption}
    </figcaption>
  </figure>
);

/** Round passport-style stamp with the brand name set on a circle. */
const TravelStamp: React.FC<{ text: string; color: string; className?: string; style?: React.CSSProperties }> = ({
  text,
  color,
  className,
  style,
}) => {
  const id = React.useId().replace(/:/g, '');
  const label = `${text} · ${text} · ${text} · `.toUpperCase();
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <defs>
        <path id={`ring-${id}`} d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0" />
      </defs>
      <g opacity="0.85">
        <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="3" />
        <circle cx="50" cy="50" r="27" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
        <g className="pb-stamp-spin" style={{ transformOrigin: '50px 50px' }}>
          <text fontSize="9.5" fontWeight="800" letterSpacing="1.5" fill={color}>
            <textPath href={`#ring-${id}`}>{label}</textPath>
          </text>
        </g>
        <path d="M38 52 L50 38 L62 52 M44 52 V60 H56 V52" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

const PERFORATION =
  'linear-gradient(#000 0 0) content-box, radial-gradient(circle, transparent 0.5cqmin, #000 0.55cqmin) -0.8cqmin -0.8cqmin / 1.6cqmin 1.6cqmin';

/** Postage stamp: perforated edge (radial-gradient mask) around a photo. */
const PostageStamp: React.FC<{ src?: string; theme: BoothTheme; style: React.CSSProperties }> = ({
  src,
  theme,
  style,
}) => (
  <div
    className="absolute w-[13cqmin] p-[1cqmin]"
    style={{
      backgroundColor: '#fffdf8',
      // Solid content box + perforated (holed) padding ring.
      WebkitMask: PERFORATION,
      mask: PERFORATION,
      filter: 'drop-shadow(0 0.6cqmin 0.8cqmin rgba(0,0,0,0.2))',
      ...style,
    }}
  >
    <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ backgroundColor: theme.secondary }}>
      <img src={src} alt="" className="h-full w-full object-cover opacity-90 mix-blend-luminosity" draggable={false} />
      <span
        className="absolute bottom-[0.6cqmin] right-[0.8cqmin] text-[2.2cqmin] font-black"
        style={{ color: theme.tertiary }}
      >
        Rp
      </span>
    </div>
  </div>
);

/**
 * "Flat Journal" start screen: a travel journal page brought to life. Flat
 * color, paper grain, torn edges, taped polaroids, stamps, a dotted route and a
 * rolling film strip, with the wordmark and a butter-yellow call to action.
 * Pure presentation + CSS motion; the booth and the admin preview share it.
 */
export const FlatJournalView: React.FC<FlatJournalViewProps> = ({ copy, theme, photos, onAdvance, onOpenPin }) => {
  useStartScreenFonts();
  const film = [...photos, ...photos, ...photos, ...photos];

  return (
    <div
      onClick={onAdvance}
      className={`pb-screen relative h-full w-full select-none ${onAdvance ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: theme.background,
        color: theme.foreground,
        // Journal page dot grid.
        backgroundImage: `radial-gradient(${withAlpha(theme.secondary, 0.14)} 0.18cqmin, transparent 0.22cqmin)`,
        backgroundSize: '3.2cqmin 3.2cqmin',
      }}
    >
      {/* paper grain */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.18] mix-blend-multiply">
        <div className="pb-grain" />
      </div>

      {/* torn paper header band */}
      <svg
        viewBox="0 0 100 9"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-[11cqh] w-full"
        aria-hidden="true"
      >
        <path d={TORN_EDGE} fill={theme.surface} />
      </svg>

      <SetupGearButton onOpenPin={onOpenPin} color={theme.foreground} border={withAlpha(theme.foreground, 0.3)} />

      {/* Brand block */}
      <div className="absolute left-[7cqw] top-[16cqh] z-20 max-w-[50cqw]">
        <div className="flex items-center gap-[2cqmin]">
          <span
            className="-rotate-[4deg] text-[3.6cqmin] leading-none"
            style={{ fontFamily: HAND_FONT, color: theme.primary }}
          >
            {copy.bumperCaption1} ↓
          </span>
        </div>
        <h1 className="mt-[1.5cqmin]">
          <KelanaLogo
            title={copy.bumperBrand}
            className="h-[17cqmin] w-auto max-w-full"
            ink={theme.foreground}
            light={theme.background}
          />
        </h1>
        <p
          className="mt-[2cqmin] inline-block -rotate-1 px-[1.4cqmin] py-[0.6cqmin] text-[3.2cqmin] font-black uppercase tracking-[0.18em]"
          style={{ backgroundColor: theme.secondary, color: theme.secondaryForeground }}
        >
          {copy.bumperCaption2} · {copy.bumperCaption3}
        </p>

        <div className="mt-[6cqmin]">
          <StartCta theme={theme} label={copy.bumperTapToStart} />
        </div>
      </div>

      {/* dotted travel route behind the collage */}
      <svg
        viewBox="0 0 100 60"
        className="pointer-events-none absolute right-[2cqw] top-[12cqh] h-[62cqh] w-[52cqw]"
        aria-hidden="true"
      >
        <path
          className="pb-route"
          d="M4 52 C 20 30, 30 58, 46 38 S 70 8, 96 14"
          fill="none"
          stroke={theme.primary}
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <circle cx="4" cy="52" r="1.4" fill={theme.primary} />
        <path d="M93 10 L98 14 L92 17" fill="none" stroke={theme.primary} strokeWidth="0.8" strokeLinecap="round" />
      </svg>

      {/* Collage */}
      <Polaroid
        src={photos[0]}
        caption={copy.bumperCaption1}
        theme={theme}
        tape={theme.tertiary}
        style={{ right: '30cqw', top: '18cqh', '--rot-a': '-8deg', '--rot-b': '-4deg', '--sway-dur': '7s' } as React.CSSProperties}
      />
      <Polaroid
        src={photos[1]}
        caption={copy.bumperCaption2}
        theme={theme}
        tape={theme.accent}
        style={{ right: '9cqw', top: '14cqh', '--rot-a': '5deg', '--rot-b': '8deg', '--sway-dur': '8s', '--sway-delay': '-2s' } as React.CSSProperties}
      />
      <Polaroid
        src={photos[2]}
        caption={copy.bumperCaption3}
        theme={theme}
        tape={theme.primary}
        style={{ right: '18cqw', top: '44cqh', '--rot-a': '-2deg', '--rot-b': '3deg', '--sway-dur': '6.5s', '--sway-delay': '-4s' } as React.CSSProperties}
      />
      <PostageStamp src={photos[1]} theme={theme} style={{ right: '37cqw', top: '60cqh', transform: 'rotate(7deg)' }} />
      <TravelStamp
        text={copy.bumperBrand}
        color={theme.secondary}
        className="absolute right-[4cqw] top-[52cqh] h-[18cqmin] w-[18cqmin] -rotate-12"
      />
      <TravelStamp
        text={copy.bumperCaption3}
        color={theme.primary}
        className="absolute left-[44cqw] top-[13cqh] h-[12cqmin] w-[12cqmin] rotate-12"
      />

      {/* Rolling film strip */}
      <div
        className="absolute inset-x-0 bottom-[3cqh] z-10 -rotate-[1.5deg] overflow-hidden py-[1.4cqmin]"
        style={{ backgroundColor: theme.deep }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-x-0 top-[0.35cqmin] h-[0.9cqmin]"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${theme.background} 0 1.4cqmin, transparent 1.4cqmin 3cqmin)`,
          }}
        />
        <div
          className="absolute inset-x-0 bottom-[0.35cqmin] h-[0.9cqmin]"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${theme.background} 0 1.4cqmin, transparent 1.4cqmin 3cqmin)`,
          }}
        />
        <div className="pb-filmroll flex w-max gap-[1.2cqmin] px-[0.6cqmin]">
          {[...film, ...film].map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-[11cqmin] w-[15cqmin] object-cover opacity-90 sepia-[0.25]"
              draggable={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlatJournalView;
