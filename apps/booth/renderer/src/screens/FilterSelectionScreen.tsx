import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import FilterSelectionView from '../components/booth/FilterSelectionView';

export const FilterSelectionScreen: React.FC = () => {
  const { photoSlots, frame, selectFilter, updateFrameLayout } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    frame: state.frame,
    selectFilter: state.selectFilter,
    updateFrameLayout: state.updateFrameLayout,
  }));
  const isTimedFlow = useBoothConfig((state) => state.flowMode === 'timed');
  const active = useBoothAppearance((state) => state.appearance);

  const selectedPhotos = getSelectedPhotoUrls(photoSlots);

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-full select-none">
      <FilterSelectionView
        copy={active.copy}
        theme={active.theme}
        isTimedFlow={isTimedFlow}
        frame={frame}
        photoUrls={selectedPhotos}
        photoSlotCount={photoSlots.length}
        surfaceStyle={appearanceSurfaceStyle(active, active.theme.background)}
        onApply={(filterId, adjustedFrame) => {
          // Save the guest's move/zoom first: printing and the upload job read
          // the frame from the store as soon as the filter is applied.
          if (adjustedFrame) updateFrameLayout(adjustedFrame);
          selectFilter(filterId);
        }}
      />
    </div>
  );
};

export default FilterSelectionScreen;
