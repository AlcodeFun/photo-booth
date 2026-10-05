import React from 'react';
import { formatBoothCopy } from '@photo-booth/types';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';

export const ReadyScreen: React.FC = () => {
  const { frame, photoSlots, startCaptureFlow } = useSessionStore((state) => ({
    frame: state.frame,
    photoSlots: state.photoSlots,
    startCaptureFlow: state.startCaptureFlow,
  }));
  const { copy, theme } = useBoothAppearance((state) => state.active);

  return (
    <div
      className="flex h-full max-w-xl mx-auto flex-col items-center justify-between px-6 py-10 text-center select-none"
      style={{ color: theme.foreground }}
    >
      <div className="mb-6">
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight">{copy.readyTitle}</h1>
        <p className="opacity-70">{formatBoothCopy(copy.readySubtitle, { count: photoSlots.length })}</p>
      </div>

      <div
        className="my-6 flex w-full flex-col items-center gap-6 rounded-3xl border p-8 shadow-xl"
        style={{ backgroundColor: theme.card, borderColor: theme.secondary, color: theme.cardForeground }}
      >
        <div
          className="flex w-full justify-around border-b pb-6 text-left"
          style={{ borderColor: theme.secondary }}
        >
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider opacity-60">{copy.readyFrameLabel}</span>
            <span className="block text-lg font-semibold">{frame?.name}</span>
            <span className="text-xs opacity-70">{photoSlots.length} photos</span>
          </div>
        </div>

        <div className="max-w-md text-sm leading-relaxed opacity-75">{copy.readyInstruction}</div>
      </div>

      <button
        onClick={startCaptureFlow}
        className="w-full rounded-2xl py-5 text-xl font-extrabold tracking-wide shadow-lg transition-all hover:shadow-white/5 active:scale-[0.98]"
        style={{ backgroundColor: theme.tertiary, color: theme.tertiaryForeground }}
      >
        {copy.readyStartButton}
      </button>
    </div>
  );
};
export default ReadyScreen;