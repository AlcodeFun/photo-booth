import React, { useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';

const FILTERS = [
  { id: 'original', name: 'Original', className: '' },
  { id: 'mono', name: 'Mono', className: 'grayscale' },
  { id: 'warm', name: 'Warm', className: 'sepia-[.45] saturate-[1.35]' },
  { id: 'cool', name: 'Cool', className: 'hue-rotate-[25deg] saturate-[.8]' },
];

export const FilterSelectionScreen: React.FC = () => {
  const { photoSlots, frame } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    frame: state.frame,
  }));
  const selectFilter = useSessionStore((state) => state.selectFilter);
  const [selectedFilter, setSelectedFilter] = useState('original');

  const selectedPhotos = getSelectedPhotoUrls(photoSlots);

  const filterClassName = FILTERS.find((filter) => filter.id === selectedFilter)?.className ?? '';

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center text-[#4d2d85]">
            <div className="text-[0.8rem] font-black uppercase tracking-[0.28em]">Filters</div>
            <h1 className="mt-2 text-[2rem] font-black uppercase tracking-[-0.08em] md:text-[3rem]">
              Select filter
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(260px,1.1fr)]">
            <section className="flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-3 w-full">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`rounded-[14px] border-[4px] p-2 transition-all ${
                      selectedFilter === filter.id
                        ? 'border-[#4acaf1] bg-[#f7f5ff]'
                        : 'border-[#a35ef6] bg-[#fdf3ff] hover:border-[#4acaf1]'
                    }`}
                  >
                    <div className={`mb-2 aspect-[4/3] overflow-hidden rounded-[10px] bg-[#22143e] ${filter.className}`}>
                      {selectedPhotos[0] ? <img src={selectedPhotos[0]} alt="" className="h-full w-full object-contain bg-black" /> : null}
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.12em] text-[#4d2d85]">{filter.name}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => selectFilter(selectedFilter)}
                className="mt-6 w-full rounded-[12px] bg-[#ff7d57] px-8 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Use Filter
              </button>
            </section>

            <section className="flex items-center justify-center">
              <FrameCanvas
                frame={frame}
                photos={selectedPhotos}
                photoSlotCount={photoSlots.length}
                filterClassName={filterClassName}
                className="w-full max-w-xs rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff]"
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterSelectionScreen;
