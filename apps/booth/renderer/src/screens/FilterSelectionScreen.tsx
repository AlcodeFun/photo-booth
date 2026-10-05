import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import FilterSelectionView from '../components/booth/FilterSelectionView';

export const FilterSelectionScreen: React.FC = () => {
  const { photoSlots, frame, selectFilter } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    frame: state.frame,
    selectFilter: state.selectFilter,
  }));
  const isTimedFlow = useBoothConfig((state) => state.flowMode === 'timed');
  const active = useBoothAppearance((state) => state.active);

  const selectedPhotos = getSelectedPhotoUrls(photoSlots);

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-screen select-none">
      <FilterSelectionView
        copy={active.copy}
        theme={active.theme}
        isTimedFlow={isTimedFlow}
        frame={frame}
        photoUrls={selectedPhotos}
        photoSlotCount={photoSlots.length}
        surfaceStyle={appearanceSurfaceStyle(active, active.theme.background)}
        onApply={selectFilter}
      />
    </div>
  );
};

export default FilterSelectionScreen;
