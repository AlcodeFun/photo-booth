import React from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';

export const FinalPreviewScreen: React.FC = () => {
  const { frame, filterId, photoSlots, startPrinting } = useSessionStore((state) => ({
    frame: state.frame,
    filterId: state.filterId,
    photoSlots: state.photoSlots,
    startPrinting: state.startPrinting,
  }));

  const filterClassName =
    filterId === 'mono'
      ? 'grayscale'
      : filterId === 'warm'
        ? 'sepia-[.45] saturate-[1.35]'
        : filterId === 'cool'
          ? 'hue-rotate-[25deg] saturate-[.8]'
          : '';
  const selectedPhotos = getSelectedPhotoUrls(photoSlots);

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-4xl mx-auto px-6 py-6 select-none">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Your Result</h1>
        <p className="text-zinc-400 text-sm">Review your filtered photo creation before printing</p>
      </div>

      <div className="flex-grow flex items-center justify-center my-4 overflow-hidden w-full max-w-md">
        <FrameCanvas
          frame={frame}
          photos={selectedPhotos}
          photoSlotCount={photoSlots.length}
          filterClassName={filterClassName}
          className="w-full max-w-[320px] rounded-2xl"
        />
      </div>

      <button
        onClick={startPrinting}
        className="w-full max-w-md py-4 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all tracking-wider"
      >
        Print & Download
      </button>
    </div>
  );
};

export default FinalPreviewScreen;
