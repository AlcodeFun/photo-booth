import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const frameBackground = resolvedTemplate?.backgroundColor ?? '#fff';

  // Available space for the photo, measured from the actual container so the
  // image never overflows and covers the status/controls below.
  const photoAreaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = photoAreaRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      setArea({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fallbackWidth = Math.min(0.9 * window.innerWidth, 0.88 * window.innerHeight * slotAspectRatio);

  // Largest rectangle matching the slot ratio that fits inside the area.
  const photoFit = useMemo(() => {
    if (!area || area.width <= 0 || area.height <= 0) {
      return null;
    }
    const widthFromHeight = area.height * slotAspectRatio;
    const width = Math.min(area.width, widthFromHeight);
    return { width, height: width / slotAspectRatio };
  }, [area, slotAspectRatio]);

  return (
    <div className="flex h-[calc(100vh-3rem)] select-none flex-col overflow-hidden bg-[#ffd4e6]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
        <div>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-[#7a4de3]">Photo Review</p>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-[-0.06em] text-[#4d2d85] sm:text-3xl">
            Photo {currentPhotoSlot}
          </h1>
        </div>
        <div className="rounded-[14px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 py-2 text-right shadow-[0_3px_0_rgba(77,45,133,0.2)]">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#4d2d85]">Attempt</p>
          <p className="text-base font-black text-[#4d2d85]">
            {attemptCount}
            <span className="text-[#7a4de3]">/3</span>
          </p>
        </div>
      </header>

      {/* Centered ratio-locked photo */}
      <div ref={photoAreaRef} className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        {latestAttempt?.localPath ? (
          <img
            src={latestAttempt.localPath}
            alt={`Captured attempt ${attemptCount}`}
            className="max-h-full max-w-full rounded-[14px] border-[4px] border-[#a35ef6] shadow-[0_8px_0_rgba(77,45,133,0.25),0_18px_40px_rgba(163,94,246,0.35)]"
            style={{
              width: photoFit?.width ?? fallbackWidth,
              height: photoFit?.width ? photoFit.width / slotAspectRatio : fallbackWidth / slotAspectRatio,
              objectFit: 'cover',
              backgroundColor: frameBackground,
            }}
          />
        ) : (
          <div className="flex items-center justify-center text-sm font-black uppercase tracking-[0.2em] text-[#4d2d85]">
            No photo captured
          </div>
        )}
      </div>

      {/* Status */}
      <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 px-4 pb-3">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-[#4d2d85]">Apakah foto ini sudah pas?</p>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                n <= attemptCount ? 'bg-[#ff4bb5]' : 'bg-[#f9b6d6]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 flex shrink-0 flex-col items-center gap-3 px-4 pb-6 sm:px-6">
        {maxAttemptsReached && (
          <span className="rounded-full border border-red-400 bg-red-500/90 px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white">
            Kesempatan terakhir
          </span>
        )}

        <div className="mx-auto flex w-full max-w-lg gap-4">
          <button
            onClick={retakePhoto}
            disabled={maxAttemptsReached}
            className={`flex-1 rounded-[14px] px-6 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] transition-all ${
              maxAttemptsReached
                ? 'cursor-not-allowed bg-[#7d6ea6] text-white opacity-70'
                : 'border-[3px] border-[#a35ef6] bg-[#fffdf6] text-[#4d2d85] shadow-[0_4px_0_rgba(77,45,133,0.2)] hover:-translate-y-0.5 active:translate-y-0'
            }`}
          >
            Foto Ulang
          </button>

          <button
            onClick={usePhoto}
            className="flex-1 rounded-[14px] bg-[#ff4bb5] px-6 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(122,43,140,0.45)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Pakai Foto
          </button>
        </div>
      </div>
    </div>
  );
};
export default PhotoReviewScreen;
