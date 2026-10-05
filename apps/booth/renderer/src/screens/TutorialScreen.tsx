import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import TutorialView from '../components/booth/TutorialView';

/**
 * Viewport sizing lives here; all presentation lives in `TutorialView`, which
 * the admin appearance preview reuses.
 */
export const TutorialScreen: React.FC = () => {
  const setScreen = useSessionStore((state) => state.setScreen);
  // `active` is a stable reference that only changes when the appearance does,
  // so selecting it directly avoids re-render loops.
  const { copy, theme } = useBoothAppearance((state) => state.active);

  return (
    // Definite height, not min-height: `TutorialView` centers with `h-full`,
    // and `height: 100%` against an auto-height parent resolves to auto, which
    // leaves no free space for the centering to distribute.
    <div className="h-[calc(100vh-3rem)]">
      <TutorialView
        copy={copy}
        theme={theme}
        onStart={() => setScreen('SELECT_FRAME')}
      />
    </div>
  );
};
export default TutorialScreen;
