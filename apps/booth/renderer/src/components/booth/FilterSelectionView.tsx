import React, { useState } from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import type { FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { FILTERS, getFilterById } from '../../utils/filters';

export interface FilterSelectionViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** `true` renders the timed-flow layout (photo grid), `false` the sidebar layout. */
  isTimedFlow: boolean;
  frame: FrameConfig | null;
  photoUrls: Array<string | undefined>;
  photoSlotCount: number;
  /** Painted behind the opaque surfaces so the configured background shows through. */
  surfaceStyle?: React.CSSProperties;
  onApply?: (filterId: string) => void;
}

/**
 * Presentational core of the filter screen, including both real layouts:
 *
 * - timed: two-column grid of sample photos with a full-width apply footer
 * - retake/auto: framed composition on the left, filter list sidebar on the right
 *
 * Shared with the admin appearance preview so both layouts stay in sync.
 */
export const FilterSelectionView: React.FC<FilterSelectionViewProps> = ({
  copy,
  theme,
  isTimedFlow,
  frame,
  photoUrls,
  photoSlotCount,
  surfaceStyle,
  onApply,
}) => {
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [samplePhotoAspectRatio, setSamplePhotoAspectRatio] = useState(3 / 4);

  const samplePhoto = photoUrls[0];
  const filterStyle = getFilterById(selectedFilter).canvasFilter;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ ...surfaceStyle, color: theme.foreground }}
    >
      <header
        className="flex shrink-0 items-center justify-center border-b-2 px-4 py-3 sm:py-4"
        style={{ borderColor: theme.primary }}
      >
        <h1 className="text-center text-xl font-black uppercase sm:text-2xl md:text-3xl">{copy.filterTitle}</h1>
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
                  className="flex flex-col items-center overflow-hidden rounded-xl border-2 p-3 text-left transition-colors sm:p-4"
                  style={
                    selectedFilter === filter.id
                      ? {
                          borderColor: theme.primary,
                          backgroundColor: theme.primary,
                          color: theme.primaryForeground,
                        }
                      : {
                          borderColor: theme.primary,
                          backgroundColor: theme.card,
                          color: theme.cardForeground,
                          opacity: 0.85,
                        }
                  }
                >
                  <span className="flex w-full items-center justify-center p-2 sm:p-3">
                    {samplePhoto && (
                      <span
                        className="mx-auto flex h-[clamp(100px,24vh,240px)] w-auto max-w-full shrink-0 items-center justify-center overflow-hidden rounded-lg p-2 sm:p-3"
                        style={{ aspectRatio: samplePhotoAspectRatio }}
                      >
                        <img
                          src={samplePhoto}
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
          <footer
            className="flex shrink-0 justify-center border-t-2 px-4 py-3 sm:py-4"
            style={{ borderColor: theme.primary }}
          >
            <button
              type="button"
              onClick={() => onApply?.(selectedFilter)}
              className="min-h-12 w-full max-w-md rounded-xl border-2 px-6 py-3 text-sm font-black uppercase shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              style={{ borderColor: theme.primary, backgroundColor: theme.action, color: theme.actionForeground }}
            >
              {copy.filterApplyButton}
            </button>
          </footer>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5 lg:p-8">
            <FrameCanvas
              frame={frame}
              photos={photoUrls}
              photoSlotCount={photoSlotCount}
              filter={filterStyle}
              className="h-full w-auto max-w-full border-2 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
              style={{ borderColor: theme.primary }}
            />
          </section>

          <aside
            className="flex h-[34vh] shrink-0 flex-col border-t-2 px-4 pb-3 pt-2 sm:h-[32vh] lg:h-auto lg:w-[340px] lg:border-l-2 lg:border-t-0 lg:px-5 lg:py-5 xl:w-[380px]"
            style={{ borderColor: theme.primary, backgroundColor: theme.background, color: theme.foreground }}
          >
            <h2 className="shrink-0 pb-2 text-sm font-black uppercase sm:text-base lg:pb-4">{copy.filterEffectsLabel}</h2>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter.id)}
                  aria-pressed={selectedFilter === filter.id}
                  className="flex w-full shrink-0 items-center gap-3 rounded-xl border-2 p-2 text-left transition-colors"
                  style={{
                    borderColor: theme.primary,
                    backgroundColor: selectedFilter === filter.id ? '#ffffff' : theme.card,
                    color: theme.cardForeground,
                    opacity: selectedFilter === filter.id ? 1 : 0.75,
                  }}
                >
                  <span className="block aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md bg-transparent sm:w-24">
                    {samplePhoto && (
                      <img
                        src={samplePhoto}
                        alt=""
                        className="h-full w-full rounded-md object-contain"
                        style={{ filter: filter.canvasFilter }}
                      />
                    )}
                  </span>
                  <span className="text-sm font-black uppercase sm:text-base">{filter.name}</span>
                  {selectedFilter === filter.id && (
                    <span className="ml-auto h-3 w-3 shrink-0" style={{ backgroundColor: theme.primary }} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onApply?.(selectedFilter)}
              className="mt-3 min-h-12 shrink-0 rounded-xl border-2 px-6 py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:mt-4"
              style={{ borderColor: theme.primary, backgroundColor: theme.action, color: theme.actionForeground }}
            >
              {copy.filterApplyButton}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
};

export default FilterSelectionView;
