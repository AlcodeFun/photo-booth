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
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1000px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center text-[#4d2d85]">
            <div className="text-[0.8rem] font-black uppercase tracking-[0.28em]">Your Result</div>
            <h1 className="mt-2 text-[2rem] font-black uppercase tracking-[-0.08em] md:text-[3rem]">
              Final preview
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(260px,0.8fr)]">
            <div className="flex items-center justify-center">
              <FrameCanvas
                frame={frame}
                photos={selectedPhotos}
                photoSlotCount={photoSlots.length}
                filterClassName={filterClassName}
                className="w-full max-w-[320px] rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff]"
              />
            </div>

            <div className="flex flex-col justify-center rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-5 text-[#4d2d85]">
              <div className="rounded-[12px] bg-[#4acaf1] px-4 py-3 text-[0.75rem] font-black uppercase tracking-[0.18em] text-[#2d2866]">
                Ready to print
              </div>
              <p className="mt-4 text-sm leading-relaxed font-medium text-[#4d2d85]">
                Review your filtered composition before saving or printing. The final result keeps your selected frame and photo layout intact.
              </p>
              <button
                onClick={startPrinting}
                className="mt-6 rounded-[12px] bg-[#ff7d57] px-6 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Print & Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalPreviewScreen;
