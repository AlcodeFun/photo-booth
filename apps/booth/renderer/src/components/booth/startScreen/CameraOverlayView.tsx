import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../../lib/appearance';
import {
  BrandMark,
  DISPLAY_FONT,
  HAND_FONT,
  SetupGearButton,
  StartCta,
  useStartScreenFonts,
} from './StartScreenParts';

export interface CameraOverlayViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /**
   * The full-bleed image under the overlay. The booth passes the live camera
   * (or a still fallback); the admin preview passes a sample photo.
   */
  cameraFeed: React.ReactNode;
  onAdvance?: () => void;
  onOpenPin?: () => void;
}

/** Film-date imprint, like the orange date stamp of a point-and-shoot. */
const filmDate = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `'${pad(now.getFullYear() % 100)} ${pad(now.getMonth() + 1)} ${pad(now.getDate())}`;
};

/** Edge strip of a 35mm negative: sprocket holes + edge print. */
const FilmEdge: React.FC<{ theme: BoothTheme; label: string; position: 'top' | 'bottom' }> = ({
  theme,
  label,
  position,
}) => (
  <div
    className={`absolute inset-x-0 z-20 flex h-[7cqmin] items-center ${position === 'top' ? 'top-0' : 'bottom-0'}`}
    style={{ backgroundColor: withAlpha(theme.deep, 0.92) }}
    aria-hidden="true"
  >
    <div
      className="absolute inset-x-0 h-[2.2cqmin]"
      style={{
        [position === 'top' ? 'top' : 'bottom']: '1cqmin',
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 1.6cqmin, ${withAlpha(theme.card, 0.9)} 1.6cqmin 3.4cqmin, transparent 3.4cqmin 5cqmin)`,
        borderRadius: '0.4cqmin',
      }}
    />
    <p
      className="absolute flex w-full justify-between px-[4cqw] font-mono text-[1.7cqmin] font-bold uppercase tracking-[0.3em]"
      style={{ color: theme.tertiary, [position === 'top' ? 'bottom' : 'top']: '0.6cqmin' }}
    >
      <span>{label} 400</span>
      <span>▸ 24A</span>
      <span>{label} 400</span>
      <span>▸ 25</span>
    </p>
  </div>
);

/**
 * "Fullscreen Camera" start screen: the guest sees themself live, framed like
 * a frame on a roll of film — sprocket edges, grain, warm vignette, viewfinder
 * corners and a date imprint — with the brand and the call to action layered
 * on top. The feed is supplied by the host so the preview needs no camera.
 */
export const CameraOverlayView: React.FC<CameraOverlayViewProps> = ({
  copy,
  theme,
  cameraFeed,
  onAdvance,
  onOpenPin,
}) => {
  useStartScreenFonts();
  const corner = 'absolute h-[7cqmin] w-[7cqmin] border-[0.6cqmin]';
  const cornerColor = withAlpha(theme.card, 0.9);

  return (
    <div
      onClick={onAdvance}
      className={`pb-screen relative h-full w-full select-none overflow-hidden ${onAdvance ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: theme.deep }}
    >
      <div className="absolute inset-0">{cameraFeed}</div>

      {/* Analog look: warm cast, vignette, grain */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{ backgroundColor: withAlpha(theme.primary, 0.28) }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(theme.deep, 0.75)} 100%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.22] mix-blend-overlay">
        <div className="pb-grain" />
      </div>

      <FilmEdge theme={theme} label={copy.bumperBrand} position="top" />
      <FilmEdge theme={theme} label={copy.bumperBrand} position="bottom" />

      <SetupGearButton
        onOpenPin={onOpenPin}
        color={theme.card}
        border={withAlpha(theme.card, 0.35)}
      />

      {/* Viewfinder corners */}
      <div className="pointer-events-none absolute inset-x-[16cqw] inset-y-[17cqh] z-10" aria-hidden="true">
        <span className={`${corner} left-0 top-0 rounded-tl-[1.4cqmin] border-b-0 border-r-0`} style={{ borderColor: cornerColor }} />
        <span className={`${corner} right-0 top-0 rounded-tr-[1.4cqmin] border-b-0 border-l-0`} style={{ borderColor: cornerColor }} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-[1.4cqmin] border-r-0 border-t-0`} style={{ borderColor: cornerColor }} />
        <span className={`${corner} bottom-0 right-0 rounded-br-[1.4cqmin] border-l-0 border-t-0`} style={{ borderColor: cornerColor }} />
        <span
          className="absolute left-1/2 top-1/2 h-[4cqmin] w-[4cqmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.4cqmin]"
          style={{ borderColor: cornerColor }}
        />
      </div>

      {/* Live tag + date imprint */}
      <div className="absolute left-[4cqw] top-[10cqh] z-20 flex items-center gap-[1.4cqmin]">
        <span className="pb-rec-blink h-[1.8cqmin] w-[1.8cqmin] rounded-full" style={{ backgroundColor: theme.primary }} />
        <span
          className="text-[2.2cqmin] font-black uppercase tracking-[0.25em]"
          style={{ color: theme.card }}
        >
          Live
        </span>
      </div>
      <p
        className="absolute bottom-[11cqh] right-[5cqw] z-20 font-mono text-[3.4cqmin] font-bold tracking-[0.12em]"
        style={{ color: theme.action, textShadow: `0 0 1.2cqmin ${withAlpha(theme.action, 0.7)}` }}
        aria-hidden="true"
      >
        {filmDate()}
      </p>

      {/* Handwritten annotation near the frame */}
      <p
        className="absolute right-[18cqw] top-[11cqh] z-20 rotate-[-6deg] text-[4.4cqmin] leading-none"
        style={{ fontFamily: HAND_FONT, color: theme.card }}
        aria-hidden="true"
      >
        {copy.bumperCaption1} ✦
      </p>

      {/* Brand + CTA, lower left: scrim keeps them legible over any feed */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 h-[45cqh]"
        style={{ background: `linear-gradient(to top, ${withAlpha(theme.deep, 0.8)}, transparent)` }}
      />
      <div className="absolute bottom-[11cqh] left-[5cqw] z-20 max-w-[60cqw]">
        <div className="flex items-end gap-[2cqmin]">
          <div
            className="rounded-full p-[1cqmin]"
            style={{ backgroundColor: withAlpha(theme.card, 0.95) }}
          >
            <BrandMark theme={theme} ink={theme.deep} className="h-[10cqmin] w-[10cqmin]" />
          </div>
          <h1
            className="text-[11cqmin] leading-[0.9]"
            style={{ fontFamily: DISPLAY_FONT, color: theme.card, textShadow: '0 0.6cqmin 2cqmin rgba(0,0,0,0.45)' }}
          >
            {copy.bumperBrand}
          </h1>
        </div>
        <p
          className="mt-[1.6cqmin] text-[3cqmin] font-bold uppercase tracking-[0.2em]"
          style={{ color: withAlpha(theme.card, 0.85) }}
        >
          {copy.bumperCaption2} · {copy.bumperCaption3}
        </p>
        <div className="mt-[3.5cqmin]">
          <StartCta theme={theme} label={copy.bumperTapToStart} />
        </div>
      </div>
    </div>
  );
};

export default CameraOverlayView;
