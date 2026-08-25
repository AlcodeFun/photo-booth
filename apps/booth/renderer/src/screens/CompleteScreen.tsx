import React, { useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

export const CompleteScreen: React.FC = () => {
  const resetSession = useSessionStore((state) => state.resetSession);

  // Auto reset session after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      resetSession();
    }, 8000);

    return () => clearTimeout(timer);
  }, [resetSession]);

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-xl mx-auto px-6 py-12 text-center select-none">
      <div className="flex-grow flex flex-col justify-center items-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-400 text-5xl mb-8 animate-bounce">
          ✓
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Thank You!</h1>
        <p className="text-zinc-400 text-lg leading-relaxed max-w-md">
          Your photo session is complete. Have a wonderful day and enjoy your prints!
        </p>
      </div>

      <div className="w-full flex flex-col items-center gap-4">
        <button
          onClick={resetSession}
          className="w-full max-w-md py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all"
        >
          Start New Session
        </button>
        <span className="text-zinc-600 text-xs mt-2">
          Automatically returning to start screen in a few seconds...
        </span>
      </div>
    </div>
  );
};
export default CompleteScreen;
