import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';

/**
 * Presentational core of the tutorial screen.
 *
 * Shared by `screens/TutorialScreen.tsx` and the admin appearance preview so
 * the preview can never drift from the real screen. Deliberately free of
 * viewport units (`vh`/`dvh`/`vw`) and of `fixed` positioning: the view fills
 * whatever box its host gives it, and the host owns the viewport sizing. That
 * is what lets the preview render it inside a scaled 16:9 stage.
 */
export interface TutorialViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  onStart?: () => void;
}

type IconProps = { theme: BoothTheme };

/** Step 1: a frame with stacked photo slots and a sparkle. */
const FrameIcon: React.FC<IconProps> = ({ theme }) => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="14" y="6" width="36" height="52" rx="5" fill={theme.card} stroke={theme.deep} strokeWidth="3.5" />
    {[12, 27, 42].map((y) => (
      <rect key={y} x="19" y={y} width="26" height="12" rx="2.5" fill={theme.secondary} />
    ))}
    <path d="M52 8 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4z" fill={theme.tertiary} stroke={theme.deep} strokeWidth="1.5" />
  </svg>
);

/** Step 2: a camera with a countdown badge. */
const CameraIcon: React.FC<IconProps> = ({ theme }) => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path d="M10 22 h10 l4 -6 h16 l4 6 h10 v28 h-44z" fill={theme.card} stroke={theme.deep} strokeWidth="3.5" strokeLinejoin="round" />
    <circle cx="32" cy="35" r="10" fill={theme.secondary} stroke={theme.deep} strokeWidth="3" />
    <circle cx="29" cy="32" r="3" fill="#ffffff" opacity="0.8" />
    <circle cx="52" cy="14" r="9" fill={theme.primary} stroke={theme.deep} strokeWidth="2.5" />
    <text x="52" y="18.5" textAnchor="middle" fontSize="12" fontWeight="900" fill={theme.primaryForeground}>
      3
    </text>
  </svg>
);

/** Step 3: a print sliding out, with a QR corner. */
const PrintIcon: React.FC<IconProps> = ({ theme }) => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="8" y="16" width="48" height="22" rx="5" fill={theme.card} stroke={theme.deep} strokeWidth="3.5" />
    <rect x="18" y="30" width="28" height="28" rx="2" fill="#ffffff" stroke={theme.deep} strokeWidth="3" />
    <rect x="22" y="34" width="20" height="13" rx="1.5" fill={theme.secondary} />
    {[
      [24, 50],
      [30, 50],
      [36, 50],
      [24, 54],
      [36, 54],
    ].map(([x, y]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3" fill={theme.deep} />
    ))}
    <circle cx="48" cy="24" r="2.6" fill={theme.primary} />
  </svg>
);

export const TutorialView: React.FC<TutorialViewProps> = ({ copy, theme, onStart }) => {
  const steps = [
    { step: '01', title: copy.tutorialStep1Title, body: copy.tutorialStep1Body, Icon: FrameIcon, tilt: '-1.5deg' },
    { step: '02', title: copy.tutorialStep2Title, body: copy.tutorialStep2Body, Icon: CameraIcon, tilt: '1deg' },
    { step: '03', title: copy.tutorialStep3Title, body: copy.tutorialStep3Body, Icon: PrintIcon, tilt: '-1deg' },
  ];

  return (
    // Scrolls instead of clipping when the stacked mobile layout is taller
    // than the host; `min-h-full` keeps it centered when it fits.
    <div className="pb-flow-anim h-full w-full overflow-y-auto select-none">
      <div className="flex min-h-full items-center justify-center py-1">
        <div
          className="relative w-full max-w-[1180px] overflow-hidden rounded-[18px] border-[3px] p-3 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:border-[4px] md:p-6"
          style={{
            borderColor: theme.primary,
            backgroundColor: theme.surface,
            color: theme.surfaceForeground,
            // Journal dot grid keeps the panel from reading as a flat slab.
            backgroundImage: `radial-gradient(${withAlpha(theme.surfaceForeground, 0.08)} 1.5px, transparent 1.8px)`,
            backgroundSize: '22px 22px',
            animation: 'pb-modal-zoom 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
          }}
        >
          <div className="relative rounded-[14px] p-1 sm:p-3 md:p-5">
            <div className="mb-4 text-center md:mb-8">
              <p
                className="inline-block -rotate-2 rounded-full px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.24em] sm:text-[0.85rem]"
                style={{ backgroundColor: theme.secondary, color: theme.secondaryForeground }}
              >
                {copy.tutorialEyebrow}
              </p>
              <h1 className="mt-3 text-[1.6rem] font-black uppercase leading-[1.02] tracking-[-0.05em] sm:text-[2.4rem] md:text-[4rem]">
                {copy.tutorialTitle}
              </h1>
            </div>

            <div className="relative">
              {/* Dotted route linking the steps (desktop row only) */}
              <svg
                className="pointer-events-none absolute inset-x-[12%] top-[38px] hidden h-10 w-[76%] md:block"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 5 C 20 0, 30 10, 50 5 S 80 0, 100 5"
                  fill="none"
                  stroke={theme.primary}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 4, strokeDasharray: '0.1 12' }}
                />
              </svg>

              <div className="relative grid gap-3 sm:gap-5 md:grid-cols-3">
                {steps.map(({ step, title, body, Icon, tilt }, i) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-[16px] border-[3px] p-3 sm:border-[4px] sm:p-4 md:flex-col md:items-center md:p-5 md:text-center"
                    style={
                      {
                        '--pr': tilt,
                        borderColor: theme.deep,
                        backgroundColor: theme.card,
                        color: theme.cardForeground,
                        boxShadow: `0 6px 0 ${theme.deep}`,
                        animation: `pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) ${0.25 + i * 0.14}s both`,
                      } as React.CSSProperties
                    }
                  >
                    <div className="relative shrink-0">
                      <div
                        className="grid h-14 w-14 place-items-center rounded-[14px] p-1.5 sm:h-16 sm:w-16 md:h-24 md:w-24 md:p-2.5"
                        style={{
                          backgroundColor: withAlpha(theme.tertiary, 0.35),
                          animation: `pb-icon-wiggle 3.6s ease-in-out ${1.4 + i * 0.6}s infinite`,
                        }}
                      >
                        <Icon theme={theme} />
                      </div>
                      <span
                        className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 text-[0.7rem] font-black md:h-9 md:w-9 md:text-sm"
                        style={{ backgroundColor: theme.action, color: theme.actionForeground, borderColor: theme.deep }}
                      >
                        {step}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[1.05rem] font-black uppercase leading-tight tracking-[-0.03em] sm:text-[1.4rem]">
                        {title}
                      </h3>
                      <p className="mt-1 text-[0.82rem] leading-snug opacity-85 sm:mt-2 sm:text-sm sm:leading-relaxed">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-center md:mt-10">
              <button
                type="button"
                onClick={onStart}
                disabled={!onStart}
                className="w-full rounded-[14px] border-[3px] px-10 py-4 text-[0.95rem] font-black uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
                style={
                  {
                    backgroundColor: theme.action,
                    color: theme.actionForeground,
                    borderColor: theme.deep,
                    '--glow': withAlpha(theme.action, 0.6),
                    animation:
                      'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.75s both, pb-cta-breathe 2.2s ease-in-out 1.6s infinite',
                  } as React.CSSProperties
                }
              >
                {copy.tutorialStartButton} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialView;
