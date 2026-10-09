import React from 'react';
import type { BoothAppearance } from '@photo-booth/types';
import BumperView from '../booth/BumperView';
import FlatJournalView from '../booth/startScreen/FlatJournalView';
import CameraOverlayView from '../booth/startScreen/CameraOverlayView';

const SAMPLE_PHOTOS = [1, 2, 3].map((n) => `${import.meta.env.BASE_URL}photos/${n}.jpg`);

const NO_REFS = {
  rootRef: { current: null },
  farRef: { current: null },
  bgRef: { current: null },
  collageWrapRef: { current: null },
  collageRef: { current: null },
  sparkleRef: { current: null },
};

/**
 * The start screen for a given appearance, without device access: the camera
 * preset shows a sample photo where the booth shows the live feed.
 */
export const StartScreenPreview: React.FC<{
  appearance: BoothAppearance;
  /** Overrides the saved style (preset thumbnails render each style). */
  style?: BoothAppearance['startScreen']['style'];
}> = ({ appearance, style }) => {
  const { copy, theme } = appearance;
  const resolved = style ?? appearance.startScreen.style;

  if (resolved === 'flat') {
    return <FlatJournalView copy={copy} theme={theme} photos={SAMPLE_PHOTOS} />;
  }
  if (resolved === 'camera') {
    return (
      <CameraOverlayView
        copy={copy}
        theme={theme}
        cameraFeed={
          <img src={SAMPLE_PHOTOS[0]} alt="" className="pb-kenburns absolute inset-0 h-full w-full object-cover" />
        }
      />
    );
  }
  return (
    <BumperView
      copy={copy}
      theme={theme}
      flavor="pink"
      palette={{ inner: theme.bumperInner, mid: theme.bumperMid, outer: theme.bumperOuter }}
      photos={SAMPLE_PHOTOS}
      refs={NO_REFS}
    />
  );
};

export default StartScreenPreview;
