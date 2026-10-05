import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance } from '../store/appearanceStore';
import ReviewView from '../components/booth/ReviewView';

export const PhotoReviewScreen: React.FC = () => {
  const { currentPhotoSlot, photoSlots, usePhoto, retakePhoto } = useSessionStore((state) => ({
    currentPhotoSlot: state.currentPhotoSlot,
    photoSlots: state.photoSlots,
    usePhoto: state.usePhoto,
    retakePhoto: state.retakePhoto,
  }));
  const maxAttempts = Math.max(1, useBoothConfig((state) => state.flow.maxAttempts));
  const { copy, theme } = useBoothAppearance((state) => state.active);

  const currentSlot = photoSlots.find((s) => s.slotNumber === currentPhotoSlot);

  // Get the latest attempt
  const attempts = currentSlot?.attempts || [];
  const latestAttempt = attempts[attempts.length - 1];
  const attemptCount = attempts.length;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen select-none overflow-hidden">
      <ReviewView
        copy={copy}
        theme={theme}
        photoUrl={latestAttempt?.localPath}
        currentSlot={currentPhotoSlot}
        attemptCount={attemptCount}
        maxAttempts={maxAttempts}
        onRetake={retakePhoto}
        onUse={usePhoto}
      />
    </div>
  );
};
export default PhotoReviewScreen;
