import React, { useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import CompleteView from '../components/booth/CompleteView';

/** Seconds before the booth returns to the start screen on its own. */
const AUTO_RESET_SECONDS = 8;

export const CompleteScreen: React.FC = () => {
  const resetSession = useSessionStore((state) => state.resetSession);
  const { copy, theme } = useBoothAppearance((state) => state.appearance);

  useEffect(() => {
    const timer = setTimeout(() => {
      resetSession();
    }, AUTO_RESET_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [resetSession]);

  return (
    // Definite height so `CompleteView`'s `h-full` + `items-center` can
    // actually center (see TutorialScreen for the same note).
    <div className="h-[calc(100dvh-3rem)]">
      <CompleteView copy={copy} theme={theme} onDone={resetSession} autoResetSeconds={AUTO_RESET_SECONDS} />
    </div>
  );
};
export default CompleteScreen;
