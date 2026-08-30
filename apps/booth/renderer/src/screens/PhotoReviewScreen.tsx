import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const PhotoReviewScreen: React.FC = () => {
  const { currentPhotoSlot, photoSlots, frame, usePhoto, retakePhoto } = useSessionStore((state) => ({
    currentPhotoSlot: state.currentPhotoSlot,
    photoSlots: state.photoSlots,
    frame: state.frame,
    usePhoto: state.usePhoto,
    retakePhoto: state.retakePhoto,
  }));

  const currentSlot = photoSlots.find((s) => s.slotNumber === currentPhotoSlot);
  
  // Get the latest attempt
  const attempts = currentSlot?.attempts || [];
  const latestAttempt = attempts[attempts.length - 1];
  const attemptCount = attempts.length;
  const maxAttemptsReached = attemptCount >= 3;

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-3xl mx-auto px-6 py-6 select-none">
      {/* Screen Header */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold">Review Photo {currentPhotoSlot}</h1>
        <p className="text-zinc-400 text-sm">Attempt {attemptCount} of 3</p>
      </div>

      {/* Captured Image Display */}
      <div className={`w-full flex-grow aspect-[4/3] rounded-3xl border-8 flex items-center justify-center overflow-hidden my-4 shadow-2xl relative ${frame?.theme ?? 'bg-zinc-950 border-zinc-800'}`}>
        {latestAttempt?.localPath ? (
          <img
            src={latestAttempt.localPath}
            alt={`Captured attempt ${attemptCount}`}
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <div className="text-zinc-600 text-sm">No photo captured</div>
        )}

        {frame && (
          <div className="absolute inset-3 border-2 border-current/30 rounded-2xl pointer-events-none">
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded text-[10px] uppercase tracking-widest text-current">
              {frame.name}
            </span>
          </div>
        )}
        
        {maxAttemptsReached && (
          <div className="absolute top-4 right-4 bg-red-500/90 text-white font-semibold text-xs px-3 py-1.5 rounded-full border border-red-400 shadow-md">
            Final Attempt
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="w-full flex gap-4 max-w-lg mt-2">
        <button
          onClick={retakePhoto}
          disabled={maxAttemptsReached}
          className={`flex-1 py-4 font-semibold rounded-2xl text-base border active:scale-[0.98] transition-all ${
            maxAttemptsReached
              ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'border-zinc-700 bg-transparent hover:bg-zinc-800 hover:border-zinc-500 text-zinc-300'
          }`}
        >
          {maxAttemptsReached ? 'Limit Reached' : 'Retake'}
        </button>

        <button
          onClick={usePhoto}
          className="flex-1 py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all"
        >
          Use Photo
        </button>
      </div>
      
      {maxAttemptsReached && (
        <p className="text-xs text-rose-400 font-medium mt-3">
          * Maximum of 3 attempts reached. Please use this photo to proceed.
        </p>
      )}
    </div>
  );
};
export default PhotoReviewScreen;
