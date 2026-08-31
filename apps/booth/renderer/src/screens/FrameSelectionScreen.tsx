import React, { useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { MOCK_FRAMES } from '../data/mockData';
import { useFramesWithTemplateDrafts } from '../hooks/useFramesWithTemplateDrafts';
import { useSessionStore } from '../store/sessionStore';

export const FrameSelectionScreen: React.FC = () => {
  const { layout, selectFrame } = useSessionStore((state) => ({
    layout: state.layout,
    selectFrame: state.selectFrame,
  }));
  const frames = useFramesWithTemplateDrafts(MOCK_FRAMES, layout?.photoSlots);
  const [selected, setSelected] = useState<FrameConfig | null>(null);

  const handleSelect = (frame: FrameConfig) => {
    setSelected(frame);
  };

  const handleNext = () => {
    if (selected) {
      selectFrame(selected);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center">
            <p className="text-[0.8rem] font-black uppercase tracking-[0.28em] text-[#4d2d85]">Bingkai</p>
            <h1 className="mt-3 text-[2.2rem] font-black uppercase tracking-[-0.08em] text-[#4d2d85] md:text-[3rem]">
              Pilih gaya foto
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {frames.map((frame) => {
              const isSelected = selected?.id === frame.id;

              return (
                <div
                  key={frame.id}
                  onClick={() => handleSelect(frame)}
                  className={`cursor-pointer rounded-[16px] border-[4px] p-3 transition-all duration-200 ${
                    isSelected
                      ? 'border-[#4acaf1] bg-[#f7f5ff] scale-[1.02]'
                      : 'border-[#a35ef6] bg-[#fdf3ff] hover:border-[#4acaf1]'
                  }`}
                >
                  <FrameCanvas
                    frame={frame}
                    photoSlotCount={layout?.photoSlots ?? 3}
                    className="mb-4 w-full rounded-[12px] border-[3px] border-[#7a4de3] bg-[#f3dcee]"
                  />
                  <h3 className="text-center text-sm font-black uppercase tracking-[0.08em] text-[#4d2d85]">{frame.name}</h3>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleNext}
              disabled={!selected}
              className={`w-full max-w-md rounded-[12px] px-8 py-4 text-[0.9rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-all ${
                selected ? 'bg-[#4acaf1] hover:-translate-y-0.5 active:translate-y-0' : 'cursor-not-allowed bg-[#7d6ea6] opacity-70'
              }`}
            >
              Lanjutkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrameSelectionScreen;
