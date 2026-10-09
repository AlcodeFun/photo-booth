import React, { useEffect } from 'react';
import { KelanaMark } from '../../brand/KelanaLogo';
import type { BoothTheme } from '@photo-booth/types';

/**
 * Pieces shared by the flat and camera start screens: brand typography, the
 * logomark, the setup gear and the tap-to-start call to action. Sizes use
 * container units (`cqmin`) against the `pb-screen` box so the admin preview
 * scales them exactly like the full-screen booth.
 */

/** Expressive display face for the wordmark + a handwritten annotation face. */
export const DISPLAY_FONT = "'Shrikhand', 'Galada', cursive";
export const HAND_FONT = "'Caveat', 'Galada', cursive";

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Shrikhand&display=swap';

/** Loads the start-screen fonts once; offline booths fall back to Galada/cursive. */
export const useStartScreenFonts = (): void => {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
};

/**
 * Logomark: a snapshot lens (outer ring + aperture) crossed by a travel route
 * that leaves the frame, i.e. a photo taken on the move. Drawn from theme
 * colors so it follows whichever palette is active.
 */
/** Kelana K mark, inked from the active booth theme so it fits every preset. */
export const BrandMark: React.FC<{
  theme: BoothTheme;
  className?: string;
  /** Letter color; defaults to the theme foreground. */
  ink?: string;
}> = ({ theme, className, ink }) => (
  <KelanaMark className={className} ink={ink ?? theme.foreground} accent={theme.primary} light={theme.background} />
);

/** PIN-gated setup entry, kept out of the way in the top-right corner. */
export const SetupGearButton: React.FC<{ onOpenPin?: () => void; color: string; border: string }> = ({
  onOpenPin,
  color,
  border,
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onOpenPin?.();
    }}
    title="Booth Setup"
    aria-label="Booth Setup"
    className="absolute right-[3cqw] top-[3cqh] z-[130] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 text-xl backdrop-blur transition-transform hover:scale-110"
    style={{ color, borderColor: border }}
  >
    ⚙️
  </button>
);

/** Butter-yellow pill CTA with a hand-drawn underline flourish. */
export const StartCta: React.FC<{ theme: BoothTheme; label: string }> = ({ theme, label }) => (
  <span
    className="pb-cta-pulse relative inline-flex items-center gap-[1.4cqmin] rounded-full border-[0.5cqmin] px-[4cqmin] py-[1.8cqmin] text-[3.4cqmin] font-black uppercase tracking-[0.08em] shadow-[0_0.8cqmin_0_rgba(0,0,0,0.25)]"
    style={{
      backgroundColor: theme.action,
      color: theme.actionForeground,
      borderColor: theme.deep,
    }}
  >
    <span aria-hidden="true">👆</span>
    {label}
  </span>
);
