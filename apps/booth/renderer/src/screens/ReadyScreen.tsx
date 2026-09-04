import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const ReadyScreen: React.FC = () => {
  const { frame, photoSlots, startCaptureFlow } = useSessionStore((state) => ({
    frame: state.frame,
    photoSlots: state.photoSlots,
    startCaptureFlow: state.startCaptureFlow,
  }));

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-xl mx-auto px-6 py-10 text-center select-none">
      <div className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">Preview & Capture</h1>
        <p className="text-zinc-400">Get ready to take {photoSlots.length} beautiful photos!</p>
      </div>

      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center gap-6 my-6 shadow-xl">
        <div className="flex justify-around w-full border-b border-zinc-800 pb-6 text-left">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Frame Style</span>
            <span className="font-semibold text-zinc-200 text-lg block">{frame?.name}</span>
            <span className="text-xs text-zinc-400">{photoSlots.length} photos</span>
          </div>
        </div>

        <div className="text-zinc-400 text-sm leading-relaxed max-w-md">
          Stand directly in front of the camera, wait for the 5-second countdown, and smile! You will review each photo right after capturing.
        </div>
      </div>

      <button
        onClick={startCaptureFlow}
        className="w-full py-5 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl text-xl shadow-lg hover:shadow-white/5 active:scale-[0.98] transition-all tracking-wide"
      >
        Start Photo Session
      </button>
    </div>
  );
};
export default ReadyScreen;
