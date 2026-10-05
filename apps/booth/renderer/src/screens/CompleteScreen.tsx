import React, { useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import CompleteView from '../components/booth/CompleteView';

export const CompleteScreen: React.FC = () => {
  const resetSession = useSessionStore((state) => state.resetSession);
  const { copy, theme } = useBoothAppearance((state) => state.active);

  // Auto reset session after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      resetSession();
    }, 8000);

    return () => clearTimeout(timer);
  }, [resetSession]);

  return (
    // Definite height so `CompleteView`'s `h-full` + `items-center` can
    // actually center (see TutorialScreen for the same note).
    <div className="h-[calc(100vh-3rem)]">
      <CompleteView copy={copy} theme={theme} onDone={resetSession} />
    </div>
  );
};
export default CompleteScreen;
