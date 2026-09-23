import { useEffect, useState } from 'react';
import { useSessionStore } from './store/sessionStore';
import { AdminApp } from './screens/admin/AdminApp';
import { OrganizeScreen } from './screens/OrganizeScreen';
import {
  ContextBumperScreen,
  TutorialScreen,
  FrameSelectionScreen,
  BoothSetUpScreen,
  PhotoCaptureScreen,
  PhotoReviewScreen,
  FilterSelectionScreen,
  PrintQRScreen,
  CompleteScreen,
} from './screens';

const isFrameFitterPath = (path: string, hash: string) => {
  const normalizedPath = path.replace(/\/+$/, '');
  return hash.startsWith('#/admin/frame-fit') || normalizedPath.endsWith('/admin/frame-fit');
};

const isBoothSetupPath = (path: string, hash: string) => {
  const normalizedPath = path.replace(/\/+$/, '');
  return (
    hash === '#/admin/camera' ||
    hash === '#/admin/setup' ||
    normalizedPath.endsWith('/admin/camera') ||
    normalizedPath.endsWith('/admin/setup')
  );
};

const isAdminPath = (path: string, hash: string) => {
  if (hash === '#/admin' || hash.startsWith('#/admin/')) {
    return true;
  }
  const normalizedPath = path.replace(/\/+$/, '');
  return normalizedPath === '/admin' || normalizedPath.startsWith('/admin/');
};

/** Flow-2 arrange page: /organize/:token (path-based; the hosted web app serves it). */
const getOrganizeToken = (path: string): string | null => {
  const segments = path.replace(/\/+$/, '').split('/').filter(Boolean);
  return segments.length >= 2 && segments[0] === 'organize' ? decodeURIComponent(segments[1]) : null;
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
  const isBoothSetupRoute = isBoothSetupPath(route.path, route.hash);
  const isAdminRoute = isAdminPath(route.path, route.hash);
  const organizeToken = getOrganizeToken(route.path);

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

  // Initialize new session on launch (only for the booth flow, never on the
  // hosted arrange/admin pages — those carry their own context).
  useEffect(() => {
    if (
      !isFrameFitterRoute &&
      !isBoothSetupRoute &&
      !isAdminRoute &&
      !organizeToken &&
      !sessionId
    ) {
      startNewSession();
    }
  }, [isFrameFitterRoute, isBoothSetupRoute, isAdminRoute, organizeToken, sessionId, startNewSession]);

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

  // The hosted arrange page renders standalone, before any booth session logic.
  if (organizeToken) {
    return <OrganizeScreen key={organizeToken} token={organizeToken} />;
  }

  if (isBoothSetupRoute) {
    return <BoothSetUpScreen />;
  }

  if (isAdminRoute) {
    return <AdminApp />;
  }

  return (
    <div className="min-h-screen w-screen bg-[#d9f85a] px-4 py-6 md:px-8">
      <main className="mx-auto w-full max-w-[1200px]">{renderScreen()}</main>
    </div>
  );
}

export default App;
