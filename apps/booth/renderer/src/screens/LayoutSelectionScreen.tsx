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
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center">
            <p className="text-[0.8rem] font-black uppercase tracking-[0.28em] text-[#4d2d85]">Tata Letak</p>
            <h1 className="mt-3 text-[2.2rem] font-black uppercase tracking-[-0.08em] text-[#4d2d85] md:text-[3rem]">
              Pilih layout favoritmu
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {MOCK_LAYOUTS.map((layout) => {
              const isSelected = selected?.id === layout.id;
              return (
                <div
                  key={layout.id}
                  onClick={() => handleSelect(layout)}
                  className={`cursor-pointer rounded-[16px] border-[4px] p-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-[#4acaf1] bg-[#f7f5ff] scale-[1.01]'
                      : 'border-[#a35ef6] bg-[#fdf3ff] hover:border-[#4acaf1]'
                  }`}
                >
                  <div className="mb-4 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[12px] border-[3px] border-[#7a4de3] bg-[#f3dcee]">
                    {layout.photoSlots === 1 && (
                      <div className="flex h-[78%] w-[78%] items-center justify-center rounded-[18px] border-[3px] border-dashed border-[#4acaf1] bg-[#d9f8ff] text-sm font-black uppercase text-[#2c4774]">
                        1 Foto
                      </div>
                    )}
                    {layout.photoSlots === 2 && (
                      <div className="flex h-[82%] w-[82%] flex-col gap-2">
                        <div className="flex-1 rounded-[14px] border-[3px] border-dashed border-[#ff7d57] bg-[#ffe6df] text-xs font-black uppercase text-[#4d2d85] flex items-center justify-center">Foto 1</div>
                        <div className="flex-1 rounded-[14px] border-[3px] border-dashed border-[#ff7d57] bg-[#ffe6df] text-xs font-black uppercase text-[#4d2d85] flex items-center justify-center">Foto 2</div>
                      </div>
                    )}
                    {layout.photoSlots === 3 && (
                      <div className="flex h-[82%] w-[82%] flex-col gap-2">
                        <div className="flex-1 rounded-[12px] border-[3px] border-dashed border-[#bf92ff] bg-[#f0e6ff] text-[10px] font-black uppercase text-[#4d2d85] flex items-center justify-center">Foto 1</div>
                        <div className="flex-1 rounded-[12px] border-[3px] border-dashed border-[#bf92ff] bg-[#f0e6ff] text-[10px] font-black uppercase text-[#4d2d85] flex items-center justify-center">Foto 2</div>
                        <div className="flex-1 rounded-[12px] border-[3px] border-dashed border-[#bf92ff] bg-[#f0e6ff] text-[10px] font-black uppercase text-[#4d2d85] flex items-center justify-center">Foto 3</div>
                      </div>
                    )}
                  </div>
                  <h3 className="text-center text-xl font-black uppercase tracking-[-0.05em] text-[#4d2d85]">{layout.name}</h3>
                  <p className="mt-2 text-center text-sm font-semibold text-[#5e4b7d]">{layout.photoSlots} slot foto</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleNext}
              disabled={!selected}
              className={`w-full max-w-md rounded-[12px] px-8 py-4 text-[0.9rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-all ${
                selected ? 'bg-[#ff7d57] hover:-translate-y-0.5 active:translate-y-0' : 'cursor-not-allowed bg-[#7d6ea6] opacity-70'
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
export default LayoutSelectionScreen;
