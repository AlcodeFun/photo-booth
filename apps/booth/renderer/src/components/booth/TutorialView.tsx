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
    <div className="flex h-full w-full items-center justify-center select-none">
      <div
        className="w-full max-w-[1180px] rounded-[18px] border-[4px] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6"
        style={{
          borderColor: theme.primary,
          backgroundColor: theme.surface,
          color: theme.surfaceForeground,
        }}
      >
        <div className="rounded-[14px] p-3 md:p-5">
          <div className="mb-6 text-center">
            <p className="text-[0.9rem] font-black uppercase tracking-[0.28em]">
              {copy.tutorialEyebrow}
            </p>
            <h1 className="mt-3 text-[1.6rem] font-black uppercase tracking-[-0.08em] sm:text-[2.2rem] md:text-[4rem]">
              {copy.tutorialTitle}
            </h1>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((card) => (
              <div
                key={card.step}
                className="rounded-[16px] border-[4px] p-4 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]"
                style={{
                  borderColor: theme.secondary,
                  backgroundColor: theme.card,
                  color: theme.cardForeground,
                }}
              >
                <div
                  className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-black"
                  style={{ backgroundColor: theme.action, color: theme.actionForeground }}
                >
                  {card.step}
                </div>
                <h3 className="text-[1.15rem] font-black uppercase tracking-[-0.05em] sm:text-[1.5rem]">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed opacity-85">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onStart}
              disabled={!onStart}
              className="rounded-[12px] px-8 py-4 text-[0.9rem] font-black uppercase tracking-[0.18em] shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: theme.action, color: theme.actionForeground }}
            >
              {copy.tutorialStartButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialView;
