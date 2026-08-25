import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const FinalPreviewScreen: React.FC = () => {
  const { layout, frame, photoSlots, startPrinting } = useSessionStore((state) => ({
    layout: state.layout,
    frame: state.frame,
    photoSlots: state.photoSlots,
    startPrinting: state.startPrinting,
  }));

  // Gather selected photos
  const selectedPhotos = photoSlots.map((slot) => {
    const selectedAttemptIdx = slot.selectedAttempt;
    if (selectedAttemptIdx !== undefined && slot.attempts[selectedAttemptIdx - 1]) {
      return slot.attempts[selectedAttemptIdx - 1].localPath;
    }
    // Fallback: latest attempt
    const latest = slot.attempts[slot.attempts.length - 1];
    return latest?.localPath;
  });

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-4xl mx-auto px-6 py-6 select-none">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Final Print Preview</h1>
        <p className="text-zinc-400 text-sm">Review your custom creation before printing</p>
      </div>

      {/* Frame Preview Container */}
      <div className="flex-grow flex items-center justify-center my-4 overflow-hidden w-full max-w-md">
        <div className={`p-4 border shadow-2xl rounded-2xl transition-all w-full max-w-[280px] aspect-[3/4] flex flex-col justify-between ${frame?.theme}`}>
          {/* Photo slots rendering */}
          <div className="flex flex-col gap-2 flex-grow justify-center py-2">
            {selectedPhotos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="flex-1 bg-zinc-950/20 border border-black/10 rounded-lg overflow-hidden relative aspect-[4/3] flex items-center justify-center"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={`Selected Slot ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-zinc-400/50 text-[10px]">Photo Slot {idx + 1}</span>
                )}
              </div>
            ))}
          </div>

          {/* Footer branding */}
          <div className="text-center pt-2 font-mono text-[9px] tracking-widest opacity-80 flex items-center justify-between border-t border-current/10">
            <span>★ PHOTO BOOTH</span>
            <span>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Continue Action */}
      <button
        onClick={startPrinting}
        className="w-full max-w-md py-4 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all tracking-wider"
      >
        Print & Download 🖨️
      </button>
    </div>
  );
};
export default FinalPreviewScreen;
