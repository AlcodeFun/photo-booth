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
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[900px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-6 text-center text-[#4d2d85]">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-[#4acaf1] bg-[#fdf3ff] text-5xl font-black text-[#4d2d85] animate-bounce">
            ✓
          </div>
          <h1 className="text-[2.2rem] font-black uppercase tracking-[-0.08em] md:text-[3rem]">Thank You!</h1>
          <p className="mx-auto mt-4 max-w-md text-base font-semibold leading-relaxed text-[#4d2d85]">
            Your photo session is complete. Enjoy your prints and save this moment for later.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={resetSession}
              className="w-full max-w-md rounded-[12px] bg-[#ff7d57] px-8 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Start New Session
            </button>
            <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#4d2d85]">
              Automatically returning to start screen in a few seconds...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CompleteScreen;
