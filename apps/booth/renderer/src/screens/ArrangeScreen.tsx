import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import ArrangeView from '../components/booth/ArrangeView';

/** Flows 1 and 3, step 1 after capture: arrange the photos on the frame. */
export const ArrangeScreen: React.FC = () => {
  const { photoSlots, frame, updateFrameLayout, swapPhotos, transformPhoto, setScreen } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    frame: state.frame,
    updateFrameLayout: state.updateFrameLayout,
    swapPhotos: state.swapPhotos,
    transformPhoto: state.transformPhoto,
    setScreen: state.setScreen,
  }));
  const active = useBoothAppearance((state) => state.appearance);

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-full select-none">
      <ArrangeView
        copy={active.copy}
        theme={active.theme}
        frame={frame}
        photoUrls={getSelectedPhotoUrls(photoSlots)}
        photoSlotCount={photoSlots.length}
        surfaceStyle={appearanceSurfaceStyle(active, active.theme.background)}
        onSwap={swapPhotos}
        onTransform={transformPhoto}
        onNext={(adjustedFrame) => {
          if (adjustedFrame) updateFrameLayout(adjustedFrame);
          setScreen('EFFECTS');
        }}
      />
    </div>
  );
};

export default ArrangeScreen;
