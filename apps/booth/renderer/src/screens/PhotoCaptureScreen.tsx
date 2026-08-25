import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

const MOCK_PHOTOS_BY_SLOT: Record<number, string[]> = {
  1: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop',
  ],
  2: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=600&auto=format&fit=crop',
  ],
  3: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=600&auto=format&fit=crop',
  ],
};

export const PhotoCaptureScreen: React.FC = () => {
  const { currentPhotoSlot, photoSlots, addPhotoAttempt } = useSessionStore((state) => ({
    currentPhotoSlot: state.currentPhotoSlot,
    photoSlots: state.photoSlots,
    addPhotoAttempt: state.addPhotoAttempt,
  }));

  const currentSlot = photoSlots.find((s) => s.slotNumber === currentPhotoSlot);
  const attemptNumber = currentSlot ? currentSlot.attempts.length + 1 : 1;

  const [countdown, setCountdown] = useState<number>(5);
  const [isFlash, setIsFlash] = useState<boolean>(false);

  useEffect(() => {
    if (countdown === 0) {
      // Trigger flash and capture
      setIsFlash(true);
      const timer = setTimeout(() => {
        setIsFlash(false);
        // Choose mock photo based on current slot and attempt index
        const photos = MOCK_PHOTOS_BY_SLOT[currentPhotoSlot] || MOCK_PHOTOS_BY_SLOT[1];
        const photoUrl = photos[(attemptNumber - 1) % photos.length];
        addPhotoAttempt(photoUrl);
      }, 300);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, currentPhotoSlot, attemptNumber, addPhotoAttempt]);

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-3xl mx-auto px-6 py-6 select-none relative">
      {/* Flash overlay */}
      {isFlash && (
        <div className="absolute inset-0 bg-white z-50 transition-opacity duration-100 ease-out opacity-100 pointer-events-none" />
      )}

      {/* Screen Header */}
      <div className="flex justify-between items-center w-full mb-4">
        <div className="text-left">
          <span className="text-zinc-500 text-xs uppercase tracking-wider block">Position Slot</span>
          <span className="font-bold text-xl text-zinc-100">Photo {currentPhotoSlot} of {photoSlots.length}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-right">
          <span className="text-xs text-zinc-500 uppercase tracking-wider block">Attempt</span>
          <span className="font-semibold text-zinc-300 text-sm">{attemptNumber} of 3</span>
        </div>
      </div>

      {/* Live Preview Container (Simulated Camera Feed) */}
      <div className="w-full flex-grow aspect-[4/3] rounded-3xl bg-zinc-950 border border-zinc-800 flex items-center justify-center relative overflow-hidden my-2 shadow-2xl">
        {/* Simulating lines and grid */}
        <div className="absolute inset-0 border border-zinc-900/30 grid grid-cols-3 grid-rows-3 pointer-events-none">
          <div className="border-r border-b border-white/5"></div>
          <div className="border-r border-b border-white/5"></div>
          <div className="border-b border-white/5"></div>
          <div className="border-r border-b border-white/5"></div>
          <div className="border-r border-b border-white/5"></div>
          <div className="border-b border-white/5"></div>
          <div className="border-r border-white/5"></div>
          <div className="border-r border-white/5"></div>
          <div></div>
        </div>

        {/* Camera silhouette placeholder feed */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.3)_0%,rgba(9,9,11,0.9)_100%)] z-10" />
        
        {/* Placeholder camera grid overlay */}
        <div className="z-0 opacity-10 text-[180px] font-thin text-white">📸</div>

        {/* Countdown overlay */}
        {countdown > 0 ? (
          <div className="z-20 flex flex-col items-center animate-pulse">
            <div className="text-[120px] font-black leading-none text-white tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              {countdown}
            </div>
            <div className="text-zinc-400 font-semibold uppercase tracking-widest text-sm mt-2">
              Stay still
            </div>
          </div>
        ) : (
          <div className="z-20 text-4xl font-extrabold text-white uppercase tracking-wider scale-110 duration-200">
            Cheese! 📸
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full text-center text-zinc-500 text-xs py-2">
        Simulated Canon EOS 600D wired camera feed.
      </div>
    </div>
  );
};
export default PhotoCaptureScreen;
