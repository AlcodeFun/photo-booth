import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';

export interface ConsentViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  onAnswer?: (consent: boolean) => void;
  /** Seconds before the booth moves on without an answer; drives the drain bar. */
  timeoutSeconds?: number;
}

/**
 * End-of-session question: may Kelana post this session's photos on its
 * social media? Two large answers; the screen owns the timeout and saving.
 */
export const ConsentView: React.FC<ConsentViewProps> = ({ copy, theme, onAnswer, timeoutSeconds }) => (
  <div className="pb-screen pb-flow-anim relative flex h-full w-full items-center justify-center select-none">
    <div
      className="relative w-full max-w-[900px] overflow-hidden rounded-[18px] border-[4px] p-4 md:p-6"
      style={{
        borderColor: theme.deep,
        backgroundColor: theme.surface,
        boxShadow: `0 10px 0 ${theme.deep}`,
        backgroundImage: `radial-gradient(${withAlpha(theme.surfaceForeground, 0.08)} 1.5px, transparent 1.8px)`,
        backgroundSize: '22px 22px',
        animation: 'pb-modal-zoom 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.25) both',
      }}
    >
      <div className="rounded-[14px] p-6 text-center" style={{ color: theme.surfaceForeground }}>
        {/* Camera-and-heart badge */}
        <div
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-[3px] sm:h-28 sm:w-28"
          style={{
            backgroundColor: theme.primary,
            borderColor: theme.deep,
            color: theme.primaryForeground,
            animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.2s both',
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h1
          className="text-[1.6rem] font-black uppercase leading-none tracking-[-0.04em] sm:text-[2.2rem] md:text-[3rem]"
          style={{ animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.35s both' }}
        >
          {copy.consentTitle}
        </h1>
        <p
          className="mx-auto mt-4 max-w-xl text-base font-semibold leading-relaxed opacity-90 sm:text-lg"
          style={{ animation: 'pb-rise-pop 0.6s ease-out 0.5s both' }}
        >
          {copy.consentBody}
        </p>

        <div
          className="mx-auto mt-8 grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2"
          style={{ animation: 'pb-rise-pop 0.6s ease-out 0.65s both' }}
        >
          <button
            type="button"
            onClick={() => onAnswer?.(true)}
            disabled={!onAnswer}
            className="min-h-[64px] rounded-[14px] border-[3px] px-6 py-4 text-lg font-black uppercase tracking-[0.08em] shadow-[0_5px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: theme.action, color: theme.actionForeground, borderColor: theme.deep }}
          >
            {copy.consentYes}
          </button>
          <button
            type="button"
            onClick={() => onAnswer?.(false)}
            disabled={!onAnswer}
            className="min-h-[64px] rounded-[14px] border-[3px] px-6 py-4 text-lg font-black uppercase tracking-[0.08em] shadow-[0_5px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: theme.card, color: theme.cardForeground, borderColor: theme.deep }}
          >
            {copy.consentNo}
          </button>
        </div>
      </div>

      {/* Time left to answer */}
      {timeoutSeconds ? (
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ backgroundColor: withAlpha(theme.surfaceForeground, 0.12) }} aria-hidden="true">
          <div
            className="h-full origin-left"
            style={{ backgroundColor: theme.action, animation: `pb-consent-drain ${timeoutSeconds}s linear both` }}
          />
        </div>
      ) : null}
    </div>
  </div>
);

export default ConsentView;
