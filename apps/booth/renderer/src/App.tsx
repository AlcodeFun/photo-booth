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
  { id: 'layout', label: 'Select Layout', screens: ['SELECT_LAYOUT'] },
  { id: 'frame', label: 'Select Frame', screens: ['SELECT_FRAME'] },
  { id: 'capture', label: 'Preview & Capture', screens: ['PHOTO_CAPTURE', 'PHOTO_REVIEW'] },
  { id: 'filter', label: 'Select Filter', screens: ['FILTER'] },
  { id: 'result', label: 'Result', screens: ['FINAL_PREVIEW', 'PRINT_QR', 'COMPLETE'] },
];

const isFrameFitterPath = (path: string, hash: string) =>
  hash === '#/admin/frame-fit' || path.endsWith('/admin/frame-fit');

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

  if (isFrameFitterRoute) {
    return <FrameTemplateAdminScreen />;
  }

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

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Top Session Progress Bar (TASK-028) */}
      {currentScreen !== 'COMPLETE' && currentScreen !== 'MANUAL_PAYMENT' && currentScreen !== 'TUTORIAL' && (
        <header className="w-full bg-zinc-900/40 border-b border-zinc-900/60 py-4 px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-sm uppercase">★ Photo Booth</span>
          </div>

          <div className="flex items-center gap-6 md:gap-12">
            {STEPS.map((step, idx) => {
              const isActive = idx === activeStepIdx;
              const isCompleted = idx < activeStepIdx;

              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white text-black scale-110 shadow-lg'
                        : isCompleted
                          ? 'bg-emerald-500 text-black'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline transition-colors ${
                      isActive ? 'text-white' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div className="hidden sm:block w-8 h-[1px] bg-zinc-800 ml-4"></div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={resetSession}
            className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold px-3 py-1.5 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all"
          >
            Reset
          </button>
        </header>
      )}

      {/* Main Screen Content Viewport */}
      <main className="flex-grow overflow-auto py-6 px-4">
        {renderScreen()}
      </main>

      {/* Footer Branding */}
      <footer className="py-4 border-t border-zinc-900/50 bg-zinc-950 text-center text-[10px] text-zinc-600 tracking-wider">
        © {new Date().getFullYear()} PHOTO BOOTH SYSTEM • ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}

export default App;
