import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import { useBoothConfig } from '../store/boothConfigStore';
import TutorialView from '../components/booth/TutorialView';

/**
 * Viewport sizing lives here; all presentation lives in `TutorialView`, which
 * the admin appearance preview reuses.
 */
export const TutorialScreen: React.FC = () => {
  const continueAfterTutorial = useSessionStore((state) => state.continueAfterTutorial);
  // `appearance` is a stable reference that only changes when the saved look
  // does, so selecting it directly avoids re-render loops.
  const { copy, theme } = useBoothAppearance((state) => state.appearance);
  const flowMode = useBoothConfig((state) => state.flowMode);

  return (
    // Definite height, not min-height: `TutorialView` centers with `h-full`,
    // and `height: 100%` against an auto-height parent resolves to auto, which
    // leaves no free space for the centering to distribute.
    <div className="h-[calc(100dvh-3rem)]">
      <TutorialView copy={copy} theme={theme} flowMode={flowMode} onStart={continueAfterTutorial} />
    </div>
  );
};
export default TutorialScreen;
