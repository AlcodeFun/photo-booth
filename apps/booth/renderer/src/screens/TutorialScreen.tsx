import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const TutorialScreen: React.FC = () => {
  const setScreen = useSessionStore((state) => state.setScreen);

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-6 text-center select-none">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          How It Works
        </h1>
        <p className="text-zinc-400 text-lg">Your custom photo booth experience in 3 simple steps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10 text-left">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="text-2xl mb-4 font-bold text-primary">01</div>
          <h3 className="font-semibold text-zinc-200 mb-2">Select Style</h3>
          <p className="text-zinc-400 text-sm">Choose your photo layout and themed frame overlay.</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="text-2xl mb-4 font-bold text-primary">02</div>
          <h3 className="font-semibold text-zinc-200 mb-2">Strike a Pose</h3>
          <p className="text-zinc-400 text-sm">Take 3 photos. Retake each photo up to 3 times if needed.</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="text-2xl mb-4 font-bold text-primary">03</div>
          <h3 className="font-semibold text-zinc-200 mb-2">Print & Save</h3>
          <p className="text-zinc-400 text-sm">Get high-quality physical prints and download the GIF instantly via QR.</p>
        </div>
      </div>

      <button
        onClick={() => setScreen('SELECT_LAYOUT')}
        className="w-full max-w-md py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all"
      >
        Let's Go
      </button>
    </div>
  );
};
export default TutorialScreen;
