import React, { useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { MOCK_FRAMES } from '../data/mockData';
import { useFramesWithTemplateDrafts } from '../hooks/useFramesWithTemplateDrafts';
import { useSessionStore } from '../store/sessionStore';

export const FrameSelectionScreen: React.FC = () => {
  const selectFrame = useSessionStore((state) => state.selectFrame);
  const frames = useFramesWithTemplateDrafts(MOCK_FRAMES, 3);
  const [selected, setSelected] = useState<FrameConfig | null>(null);

  const handleSelect = (frame: FrameConfig) => {
    setSelected(frame);
  };

  const handleClose = () => {
    setSelected(null);
  };

  const handleConfirm = () => {
    if (selected) {
      selectFrame(selected);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] items-center justify-center select-none overflow-hidden p-2 sm:p-4 md:p-6">
      <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-2 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:p-4 md:p-6">
        <div className="pb-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[14px] bg-[#ff4bb5] p-2 sm:p-3 md:p-5">
          <div className="mb-2 shrink-0 text-center md:mb-6">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-[#4d2d85] sm:text-[0.8rem]">Bingkai</p>
            <h1 className="mt-1 text-[1.4rem] font-black uppercase tracking-[-0.08em] text-[#4d2d85] sm:text-[2rem] md:text-[2.6rem]">
              Pilih gaya foto
            </h1>
          </div>

          <div className="grid grid-cols-2 place-items-center gap-2 sm:gap-4 md:grid-cols-4">
            {frames.map((frame) => (
              <div
                key={frame.id}
                onClick={() => handleSelect(frame)}
                className="flex w-full cursor-pointer flex-col rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-2 transition-all duration-200 hover:border-[#4acaf1] sm:p-3"
              >
                <FrameCanvas
                  frame={frame}
                  photoSlotCount={frame.photoSlots ?? 3}
                  className="mb-2 w-full rounded-[12px] border-[3px] border-[#7a4de3] bg-[#f3dcee] sm:mb-4"
                />
                <h3 className="shrink-0 text-center text-sm font-black uppercase tracking-[0.08em] text-[#4d2d85]">{frame.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-6" style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}>
          <div
            className="flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-[20px] border-4 border-[#4acaf1] bg-[#fffdf6] p-3 shadow-[0_0_40px_rgba(74,202,241,0.4)] sm:max-w-md sm:p-4 md:p-6"
            style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
          >
            <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
              <h2 className="truncate text-lg font-black uppercase tracking-[-0.03em] text-[#4d2d85] sm:text-xl md:text-2xl">{selected.name}</h2>
              <button
                onClick={handleClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff4bb5] text-lg font-black text-white transition-transform hover:scale-110 active:scale-95 sm:h-11 sm:w-11 sm:text-xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <FrameCanvas
              frame={selected}
              photoSlotCount={selected.photoSlots ?? 3}
              className="mb-5 w-full rounded-[14px] border-[3px] border-[#7a4de3] bg-[#f3dcee]"
            />

            <button
              onClick={handleConfirm}
              className="w-full shrink-0 rounded-[12px] bg-[#4acaf1] px-8 py-3 text-[0.85rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 active:translate-y-0 sm:py-4 sm:text-[0.9rem]"
            >
              Pilih bingkai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameSelectionScreen;
