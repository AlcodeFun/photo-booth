import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';

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

  const resolvedTemplate = frame ? resolveFrameTemplate(frame, photoSlots.length) : null;
  const activeSlot = resolvedTemplate?.photoSlots.find((slot) => slot.slotNumber === currentPhotoSlot);
  const slotAspectRatio = activeSlot && activeSlot.height > 0 ? activeSlot.width / activeSlot.height : 4 / 3;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1000px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center text-[#4d2d85]">
            <div className="text-[0.8rem] font-black uppercase tracking-[0.28em]">Review Photo</div>
            <h1 className="mt-2 text-[2rem] font-black uppercase tracking-[-0.08em]">
              Photo {currentPhotoSlot}
            </h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em]">Attempt {attemptCount} of 3</p>
          </div>

          <div
            className={`relative my-4 w-full max-w-[420px] mx-auto overflow-hidden rounded-[18px] border-[5px] border-[#a35ef6] bg-[#22143e] shadow-[0_12px_0_rgba(77,45,133,0.25)]`}
            style={{ aspectRatio: slotAspectRatio }}
            data-aspect-ratio={slotAspectRatio}
          >
            {latestAttempt?.localPath ? (
              <img
                src={latestAttempt.localPath}
                alt={`Captured attempt ${attemptCount}`}
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-black uppercase tracking-[0.2em] text-white/65">
                No photo captured
              </div>
            )}

            {frame && (
              <div className="pointer-events-none absolute inset-3 rounded-[16px] border-[2px] border-white/30">
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  {frame.name}
                </span>
              </div>
            )}

            {maxAttemptsReached && (
              <div className="absolute right-4 top-4 rounded-full border border-red-400 bg-red-500/90 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white">
                Final Attempt
              </div>
            )}
          </div>

          <div className="mx-auto flex w-full max-w-lg gap-4">
            <button
              onClick={retakePhoto}
              disabled={maxAttemptsReached}
              className={`flex-1 rounded-[12px] px-6 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] transition-all ${
                maxAttemptsReached
                  ? 'cursor-not-allowed bg-[#7d6ea6] text-white opacity-70'
                  : 'border-[3px] border-[#a35ef6] bg-[#fdf3ff] text-[#4d2d85] hover:-translate-y-0.5'
              }`}
            >
              {maxAttemptsReached ? 'Limit Reached' : 'Retake'}
            </button>

            <button
              onClick={usePhoto}
              className="flex-1 rounded-[12px] bg-[#ff7d57] px-6 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Use Photo
            </button>
          </div>

          {maxAttemptsReached && (
            <p className="mt-4 text-center text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#fef2f2]">
              Maximum of 3 attempts reached. Please use this photo to proceed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
export default PhotoReviewScreen;
