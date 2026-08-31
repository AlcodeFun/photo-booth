import { useEffect, useState } from 'react';
import { useSessionStore } from './store/sessionStore';
import {
  ManualPaymentScreen,
  TutorialScreen,
  LayoutSelectionScreen,
  FrameSelectionScreen,
  FrameTemplateAdminScreen,
  PhotoCaptureScreen,
  PhotoReviewScreen,
  FilterSelectionScreen,
  FinalPreviewScreen,
  PrintQRScreen,
  CompleteScreen,
} from './screens';

const STEPS = [
  { id: 'layout', label: 'Pilih Tata Letak', screens: ['SELECT_LAYOUT'] },
  { id: 'frame', label: 'Pilih Bingkai', screens: ['SELECT_FRAME'] },
  { id: 'capture', label: 'Pratinjau & Foto', screens: ['PHOTO_CAPTURE', 'PHOTO_REVIEW'] },
  { id: 'filter', label: 'Pilih Filter', screens: ['FILTER'] },
  { id: 'result', label: 'Hasil', screens: ['FINAL_PREVIEW', 'PRINT_QR', 'COMPLETE'] },
];

const isFrameFitterPath = (path: string, hash: string) => {
  const normalizedPath = path.replace(/\/+$/, '');
  return hash === '#/admin/frame-fit' || normalizedPath.endsWith('/admin/frame-fit');
};

function App() {
  const [route, setRoute] = useState(() => ({
    path: window.location.pathname,
    hash: window.location.hash,
  }));
  const { currentScreen, sessionId, startNewSession, resetSession } = useSessionStore((state) => ({
    currentScreen: state.currentScreen,
    sessionId: state.sessionId,
    startNewSession: state.startNewSession,
    resetSession: state.resetSession,
  }));
  const isFrameFitterRoute = isFrameFitterPath(route.path, route.hash);

  useEffect(() => {
    const updateRoute = () => {
      setRoute({
        path: window.location.pathname,
        hash: window.location.hash,
      });
    };

    window.addEventListener('hashchange', updateRoute);
    window.addEventListener('popstate', updateRoute);

    return () => {
      window.removeEventListener('hashchange', updateRoute);
      window.removeEventListener('popstate', updateRoute);
    };
  }, []);

  // Initialize new session on launch
  useEffect(() => {
    if (!isFrameFitterRoute && !sessionId) {
      startNewSession();
    }
  }, [isFrameFitterRoute, sessionId, startNewSession]);

  // Determine current active step index
  const activeStepIdx = STEPS.findIndex((step) => step.screens.includes(currentScreen));

  const renderScreen = () => {
    switch (currentScreen) {
      case 'MANUAL_PAYMENT':
        return <ManualPaymentScreen />;
      case 'TUTORIAL':
        return <TutorialScreen />;
      case 'SELECT_LAYOUT':
        return <LayoutSelectionScreen />;
      case 'SELECT_FRAME':
        return <FrameSelectionScreen />;
      case 'PHOTO_CAPTURE':
        return <PhotoCaptureScreen />;
      case 'PHOTO_REVIEW':
        return <PhotoReviewScreen />;
      case 'FILTER':
        return <FilterSelectionScreen />;
      case 'FINAL_PREVIEW':
        return <FinalPreviewScreen />;
      case 'PRINT_QR':
        return <PrintQRScreen />;
      case 'COMPLETE':
        return <CompleteScreen />;
      default:
        return <ManualPaymentScreen />;
    }
  };

  if (isFrameFitterRoute) {
    return <FrameTemplateAdminScreen />;
  }

  return (
    <div className="min-h-screen w-screen bg-[#d9f85a] px-4 py-6 md:px-8">
      <main className="mx-auto w-full max-w-[1200px]">{renderScreen()}</main>
    </div>
  );
}

export default App;
