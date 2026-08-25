import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { MOCK_FRAMES } from '../data/mockData';
import { FrameConfig } from '@photo-booth/types';

export const FrameSelectionScreen: React.FC = () => {
  const selectFrame = useSessionStore((state) => state.selectFrame);
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
    <div className="flex flex-col items-center justify-between h-full max-w-4xl mx-auto px-6 py-8 select-none">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Select Your Frame</h1>
        <p className="text-zinc-400">Choose a thematic frame style for your composition</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full flex-grow items-center justify-center my-6">
        {MOCK_FRAMES.map((frame) => {
          const isSelected = selected?.id === frame.id;
          return (
            <div
              key={frame.id}
              onClick={() => handleSelect(frame)}
              className={`flex flex-col items-center p-4 bg-zinc-900 border rounded-2xl cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/40 transition-all ${
                isSelected ? 'border-white ring-2 ring-white/10 scale-105 bg-zinc-800' : 'border-zinc-800'
              }`}
            >
              <div className={`w-full aspect-[3/4] max-h-[160px] rounded-xl border flex items-end p-2 justify-center font-bold text-[10px] uppercase tracking-wider ${frame.theme} relative mb-4 shadow-inner`}>
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500/20 text-4xl">★</div>
                <div className="z-10 bg-black/5 px-2 py-0.5 rounded backdrop-blur-[1px]">
                  {frame.name}
                </div>
              </div>
              <h3 className="font-semibold text-sm text-zinc-200 text-center">{frame.name}</h3>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleNext}
        disabled={!selected}
        className={`w-full max-w-md py-4 font-semibold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all ${
          selected
            ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        Continue
      </button>
    </div>
  );
};
export default FrameSelectionScreen;
