import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { MOCK_LAYOUTS } from '../data/mockData';
import { LayoutConfig } from '@photo-booth/types';

export const LayoutSelectionScreen: React.FC = () => {
  const selectLayout = useSessionStore((state) => state.selectLayout);
  const [selected, setSelected] = useState<LayoutConfig | null>(null);

  const handleSelect = (layout: LayoutConfig) => {
    setSelected(layout);
  };

  const handleNext = () => {
    if (selected) {
      selectLayout(selected);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-4xl mx-auto px-6 py-8 select-none">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Choose Your Layout</h1>
        <p className="text-zinc-400">Select the template layout for your prints</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full flex-grow items-center justify-center my-6">
        {MOCK_LAYOUTS.map((layout) => {
          const isSelected = selected?.id === layout.id;
          return (
            <div
              key={layout.id}
              onClick={() => handleSelect(layout)}
              className={`flex flex-col items-center p-6 bg-zinc-900 border rounded-2xl cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/40 transition-all ${
                isSelected ? 'border-white ring-2 ring-white/10 scale-105 bg-zinc-800' : 'border-zinc-800'
              }`}
            >
              <div className="w-full aspect-[3/4] max-h-[220px] rounded-xl overflow-hidden mb-4 bg-zinc-950 flex items-center justify-center relative">
                {layout.photoSlots === 1 && (
                  <div className="w-[80%] h-[80%] border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500">
                    1 Photo
                  </div>
                )}
                {layout.photoSlots === 2 && (
                  <div className="flex flex-col gap-2 w-[85%] h-[85%]">
                    <div className="flex-1 border-2 border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-600 text-xs">Photo 1</div>
                    <div className="flex-1 border-2 border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-600 text-xs">Photo 2</div>
                  </div>
                )}
                {layout.photoSlots === 3 && (
                  <div className="flex flex-col gap-1.5 w-[85%] h-[85%]">
                    <div className="flex-1 border-2 border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-600 text-xs">Photo 1</div>
                    <div className="flex-1 border-2 border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-600 text-xs">Photo 2</div>
                    <div className="flex-1 border-2 border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-600 text-xs">Photo 3</div>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg text-zinc-200">{layout.name}</h3>
              <p className="text-zinc-500 text-sm mt-1">{layout.photoSlots} photo slots</p>
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
export default LayoutSelectionScreen;
