import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';

export const PhotoReviewScreen: React.FC = () => {
  const { currentPhotoSlot, photoSlots, usePhoto, retakePhoto } = useSessionStore((state) => ({
    currentPhotoSlot: state.currentPhotoSlot,
    photoSlots: state.photoSlots,
    usePhoto: state.usePhoto,
    retakePhoto: state.retakePhoto,
  }));
  const maxAttempts = Math.max(1, useBoothConfig((state) => state.flow.maxAttempts));

  const currentSlot = photoSlots.find((s) => s.slotNumber === currentPhotoSlot);

  // Get the latest attempt
  const attempts = currentSlot?.attempts || [];
  const latestAttempt = attempts[attempts.length - 1];
  const attemptCount = attempts.length;
  const maxAttemptsReached = attemptCount >= maxAttempts;
  const attemptDots = Array.from({ length: Math.min(maxAttempts, 8) }, (_, index) => index + 1);

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen select-none overflow-hidden bg-black text-white">
      {latestAttempt?.localPath ? (
        <img
          src={latestAttempt.localPath}
          alt={`Captured attempt ${attemptCount}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold uppercase tracking-[0.16em]">
          No photo captured
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="bg-black/45 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Photo review</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">Photo {currentPhotoSlot}</h1>
        </div>
        <div className="bg-black/45 px-4 py-3 text-right backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Attempt</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {attemptCount}
            <span className="text-white/65">/{maxAttempts}</span>
          </p>
        </div>
      </header>

      <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-5 pb-5 sm:px-8 sm:pb-7">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-bold text-white sm:text-base">Apakah foto ini sudah pas?</p>
          <div className="flex items-center gap-2" aria-label={`Attempt ${attemptCount} of ${maxAttempts}`}>
          {attemptDots.map((n) => (
            <span
              key={n}
                className={`h-2.5 w-2.5 rounded-full ${n <= attemptCount ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
          </div>
        </div>

        {maxAttemptsReached && (
          <span className="bg-red-500/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
            Kesempatan terakhir
          </span>
        )}

        <div className="flex w-full max-w-lg gap-3">
          <button
            onClick={retakePhoto}
            disabled={maxAttemptsReached}
            className={`min-h-14 flex-1 px-5 py-4 text-sm font-bold uppercase tracking-[0.1em] transition-colors ${
              maxAttemptsReached
                ? 'cursor-not-allowed bg-white/25 text-white/60'
                : 'bg-white/90 text-black hover:bg-white'
            }`}
          >
            Foto Ulang
          </button>

          <button
            onClick={usePhoto}
            className="min-h-14 flex-1 bg-rose-400 px-5 py-4 text-sm font-bold uppercase tracking-[0.1em] text-black transition-colors hover:bg-rose-300"
          >
            Pakai Foto
          </button>
        </div>
      </footer>
    </div>
  );
};
export default PhotoReviewScreen;
