import { useEffect, useState } from 'react';
import { useSessionStore } from './store/sessionStore';
import {
  ContextBumperScreen,
  TutorialScreen,
  FrameSelectionScreen,
  FrameTemplateAdminScreen,
  CameraSettingsScreen,
  PhotoCaptureScreen,
  PhotoReviewScreen,
  FilterSelectionScreen,
  PrintQRScreen,
  CompleteScreen,
} from './screens';

const isFrameFitterPath = (path: string, hash: string) => {
  const normalizedPath = path.replace(/\/+$/, '');
  return hash === '#/admin/frame-fit' || normalizedPath.endsWith('/admin/frame-fit');
};

const isCameraSettingsPath = (path: string, hash: string) => {
  const normalizedPath = path.replace(/\/+$/, '');
  return hash === '#/admin/camera' || normalizedPath.endsWith('/admin/camera');
};

function App() {
  const [route, setRoute] = useState(() => ({
    path: window.location.pathname,
    hash: window.location.hash,
  }));
  const { currentScreen, sessionId, startNewSession } = useSessionStore((state) => ({
    currentScreen: state.currentScreen,
    sessionId: state.sessionId,
    startNewSession: state.startNewSession,
  }));
  const isFrameFitterRoute = isFrameFitterPath(route.path, route.hash);
  const isCameraSettingsRoute = isCameraSettingsPath(route.path, route.hash);

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
    if (!isFrameFitterRoute && !isCameraSettingsRoute && !sessionId) {
      startNewSession();
    }
  }, [isFrameFitterRoute, isCameraSettingsRoute, sessionId, startNewSession]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'CONTEXT_BUMPER':
        return <ContextBumperScreen />;
      case 'TUTORIAL':
        return <TutorialScreen />;
      case 'SELECT_FRAME':
        return <FrameSelectionScreen />;
      case 'PHOTO_CAPTURE':
        return <PhotoCaptureScreen />;
      case 'PHOTO_REVIEW':
        return <PhotoReviewScreen />;
      case 'FILTER':
        return <FilterSelectionScreen />;
      case 'PRINT_QR':
        return <PrintQRScreen />;
      case 'COMPLETE':
        return <CompleteScreen />;
      default:
        return <ContextBumperScreen />;
    }
  };

  if (isFrameFitterRoute) {
    return <FrameTemplateAdminScreen />;
  }

  if (isCameraSettingsRoute) {
    return <CameraSettingsScreen />;
  }

  return (
    <div className="min-h-screen w-screen bg-[#d9f85a] px-4 py-6 md:px-8">
      <main className="mx-auto w-full max-w-[1200px]">{renderScreen()}</main>
    </div>
  );
}

export default App;
