import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';

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

export const TutorialView: React.FC<TutorialViewProps> = ({ copy, theme, onStart }) => {
  const steps = [
    { step: '01', title: copy.tutorialStep1Title, body: copy.tutorialStep1Body },
    { step: '02', title: copy.tutorialStep2Title, body: copy.tutorialStep2Body },
    { step: '03', title: copy.tutorialStep3Title, body: copy.tutorialStep3Body },
  ];

  return (
    // Scrolls instead of clipping when the stacked mobile layout is taller
    // than the host; `min-h-full` keeps it centered when it fits.
    <div className="h-full w-full overflow-y-auto select-none">
      <div className="flex min-h-full items-center justify-center py-1">
        <div
          className="w-full max-w-[1180px] rounded-[18px] border-[3px] p-3 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:border-[4px] md:p-6"
          style={{
            borderColor: theme.primary,
            backgroundColor: theme.surface,
            color: theme.surfaceForeground,
          }}
        >
          <div className="rounded-[14px] p-1 sm:p-3 md:p-5">
            <div className="mb-4 text-center md:mb-6">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.24em] sm:text-[0.9rem] sm:tracking-[0.28em]">
                {copy.tutorialEyebrow}
              </p>
              <h1 className="mt-2 text-[1.5rem] font-black uppercase leading-[1.05] tracking-[-0.06em] sm:mt-3 sm:text-[2.2rem] md:text-[4rem] md:tracking-[-0.08em]">
                {copy.tutorialTitle}
              </h1>
            </div>

            <div className="grid gap-3 sm:gap-5 md:grid-cols-3">
              {steps.map((card) => (
                <div
                  key={card.step}
                  className="flex items-start gap-3 rounded-[14px] border-[3px] p-3 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)] sm:rounded-[16px] sm:border-[4px] sm:p-4 md:block"
                  style={{
                    borderColor: theme.secondary,
                    backgroundColor: theme.card,
                    color: theme.cardForeground,
                  }}
                >
                  <div
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black sm:h-12 sm:w-12 sm:text-xl md:mb-3"
                    style={{ backgroundColor: theme.action, color: theme.actionForeground }}
                  >
                    {card.step}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[1.05rem] font-black uppercase leading-tight tracking-[-0.04em] sm:text-[1.5rem] sm:tracking-[-0.05em]">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-[0.82rem] leading-snug opacity-85 sm:mt-2 sm:text-sm sm:leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-center md:mt-8">
              <button
                type="button"
                onClick={onStart}
                disabled={!onStart}
                className="w-full rounded-[12px] px-8 py-4 text-[0.9rem] font-black uppercase tracking-[0.18em] shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
                style={{ backgroundColor: theme.action, color: theme.actionForeground }}
              >
                {copy.tutorialStartButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialView;
