import React, { useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import { FILTERS, getFilterById } from '../utils/filters';

export const FilterSelectionScreen: React.FC = () => {
  const { photoSlots, frame } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    frame: state.frame,
  }));
  const selectFilter = useSessionStore((state) => state.selectFilter);
  const isTimedFlow = useBoothConfig((state) => state.flowMode === 'timed');
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [samplePhotoAspectRatio, setSamplePhotoAspectRatio] = useState(3 / 4);

  const selectedPhotos = getSelectedPhotoUrls(photoSlots);

  const filterStyle = getFilterById(selectedFilter).canvasFilter;

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] w-screen select-none flex-col overflow-hidden bg-[#d9f85a] text-[#4d2d85]">
      <header className="flex shrink-0 items-center justify-center border-b-2 border-[#ff4bb5] px-4 py-3 sm:py-4">
        <h1 className="text-center text-xl font-black uppercase sm:text-2xl md:text-3xl">
          Pilih Filter yang Kamu Suka
        </h1>
      </header>

      {isTimedFlow ? (
        <>
          <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
            <div className="grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-5">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter.id)}
                  aria-pressed={selectedFilter === filter.id}
                  className={`flex flex-col items-center overflow-hidden rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
                    selectedFilter === filter.id
                      ? 'border-[#d62783] bg-[#ff4bb5] text-white shadow-[0_0_0_3px_rgba(255,75,181,0.35)]'
                      : 'border-[#ff4bb5]/60 bg-white/70 text-[#4d2d85] hover:border-[#ff4bb5] hover:bg-white'
                  }`}
                >
                  <span className="flex w-full items-center justify-center p-2 sm:p-3">
                    {selectedPhotos[0] && (
                      <span
                        className="mx-auto flex h-[clamp(100px,24vh,240px)] w-auto max-w-full shrink-0 items-center justify-center overflow-hidden rounded-lg p-2 sm:p-3"
                        style={{ aspectRatio: samplePhotoAspectRatio }}
                      >
                        <img
                          src={selectedPhotos[0]}
                          alt=""
                          className="h-full w-full rounded-md object-contain"
                          onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            if (naturalWidth > 0 && naturalHeight > 0) {
                              setSamplePhotoAspectRatio(naturalWidth / naturalHeight);
                            }
                          }}
                          style={{ filter: filter.canvasFilter }}
                        />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 flex shrink-0 items-center justify-center gap-2 text-center text-sm font-black uppercase sm:text-base">
                    {filter.name}
                    {selectedFilter === filter.id && <span aria-hidden="true">✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </main>
          <footer className="flex shrink-0 justify-center border-t-2 border-[#ff4bb5]/75 px-4 py-3 sm:py-4">
            <button
              type="button"
              onClick={() => selectFilter(selectedFilter)}
              className="min-h-12 w-full max-w-md rounded-xl border-2 border-[#ff4bb5] bg-[#ff7d57] px-6 py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Gunakan Filter
            </button>
          </footer>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5 lg:p-8">
            <FrameCanvas
              frame={frame}
              photos={selectedPhotos}
              photoSlotCount={photoSlots.length}
              filter={filterStyle}
              className="h-full w-auto max-w-full border-2 border-white/80 bg-white shadow-[0_18px_48px_rgba(77,45,133,0.22)]"
            />
          </section>

          <aside className="flex h-[34vh] shrink-0 flex-col border-t-2 border-[#ff4bb5]/75 bg-[#d9f85a] px-4 pb-3 pt-2 sm:h-[32vh] lg:h-auto lg:w-[340px] lg:border-l-2 lg:border-t-0 lg:px-5 lg:py-5 xl:w-[380px]">
            <h2 className="shrink-0 pb-2 text-sm font-black uppercase sm:text-base lg:pb-4">Efek foto</h2>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter.id)}
                  aria-pressed={selectedFilter === filter.id}
                  className={`flex w-full shrink-0 items-center gap-3 rounded-xl border-2 border-[#ff4bb5]/60 p-2 text-left text-[#4d2d85] transition-colors ${
                    selectedFilter === filter.id
                      ? 'border-[#ff4bb5] bg-white'
                      : 'bg-white/55 hover:border-[#ff4bb5] hover:bg-white/85'
                  }`}
                >
                  <span className="block aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md bg-transparent sm:w-24">
                    {selectedPhotos[0] && (
                      <img
                        src={selectedPhotos[0]}
                        alt=""
                        className="h-full w-full rounded-md object-contain"
                        style={{ filter: filter.canvasFilter }}
                      />
                    )}
                  </span>
                  <span className="text-sm font-black uppercase sm:text-base">{filter.name}</span>
                  {selectedFilter === filter.id && <span className="ml-auto h-3 w-3 shrink-0 bg-[#ff4bb5]" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => selectFilter(selectedFilter)}
              className="mt-3 min-h-12 shrink-0 rounded-xl border-2 border-[#ff4bb5] bg-[#ff7d57] px-6 py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:mt-4"
            >
              Gunakan Filter
            </button>
          </aside>
        </div>
      )}
    </div>
  );
};

export default FilterSelectionScreen;
