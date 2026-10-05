import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';

export interface CompleteViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  onDone?: () => void;
}

/**
 * Presentational core of the completion screen. The screen owns the auto-reset
 * timer; the preview passes no handler so nothing resets there.
 */
export const CompleteView: React.FC<CompleteViewProps> = ({ copy, theme, onDone }) => (
  <div className="flex h-full w-full items-center justify-center select-none">
    <div
      className="w-full max-w-[900px] rounded-[18px] border-[4px] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6"
      style={{ borderColor: theme.primary, backgroundColor: theme.surface }}
    >
      <div className="rounded-[14px] p-6 text-center" style={{ backgroundColor: theme.surface, color: theme.surfaceForeground }}>
        <div
          className="mx-auto mb-6 flex h-24 w-24 animate-bounce items-center justify-center rounded-full border-[4px] text-5xl font-black"
          style={{ borderColor: theme.accent, backgroundColor: theme.card, color: theme.surfaceForeground }}
        >
          ✓
        </div>
        <h1 className="text-[2.2rem] font-black uppercase tracking-[-0.08em] md:text-[3rem]">{copy.completeTitle}</h1>
        <p className="mx-auto mt-4 max-w-md text-base font-semibold leading-relaxed">{copy.completeBody}</p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onDone}
            disabled={!onDone}
            className="w-full max-w-md rounded-[12px] px-8 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: theme.action, color: theme.actionForeground }}
          >
            {copy.completeButton}
          </button>
          <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] opacity-70">{copy.completeFootnote}</span>
        </div>
      </div>
    </div>
  </div>
);

export default CompleteView;
