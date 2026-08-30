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
    <div className="flex flex-col h-full max-w-5xl mx-auto px-6 py-4 select-none">
      <div className="text-center mb-3">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Select Filter</h1>
        <p className="text-zinc-400 text-sm">Choose the look for your final result</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.9fr)_minmax(260px,1.1fr)] gap-6 flex-1 min-h-0 items-center">
        <section className="flex flex-col justify-center">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Filters</h2>
          <div className="grid grid-cols-2 gap-3 w-full">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSelectedFilter(filter.id)}
                className={`p-2 rounded-xl border transition-all ${
                  selectedFilter === filter.id
                    ? 'border-white ring-2 ring-white/10 bg-zinc-800'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                <div className={`aspect-[4/3] rounded-lg bg-zinc-950 overflow-hidden mb-2 ${filter.className}`}>
                  {selectedPhotos[0] ? <img src={selectedPhotos[0]} alt="" className="w-full h-full object-contain bg-black" /> : null}
                </div>
                <span className="text-sm text-zinc-200">{filter.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => selectFilter(selectedFilter)}
            className="w-full py-3.5 mt-5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all"
          >
            Use Filter
          </button>
        </section>

        <section className="flex items-center justify-center min-h-0">
          <FrameCanvas
            frame={frame}
            photos={selectedPhotos}
            photoSlotCount={photoSlots.length}
            filterClassName={filterClassName}
            className="w-full max-w-xs max-h-full rounded-2xl"
          />
        </section>
      </div>
    </div>
  );
};

export default FilterSelectionScreen;
