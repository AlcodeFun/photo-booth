import React, { useCallback, useEffect, useRef, useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import { resolveFrameTemplate } from '../utils/frameConfig';
import { usePhotoBoothCamera } from '../hooks/usePhotoBoothCamera';

export const PhotoCaptureScreen: React.FC = () => {
  const { currentPhotoSlot, photoSlots, frame, addPhotoAttempt } = useSessionStore((state) => ({
    currentPhotoSlot: state.currentPhotoSlot,
    photoSlots: state.photoSlots,
    frame: state.frame,
    addPhotoAttempt: state.addPhotoAttempt,
  }));
  const currentSlot = photoSlots.find((slot) => slot.slotNumber === currentPhotoSlot);
  const attemptNumber = currentSlot ? currentSlot.attempts.length + 1 : 1;
  const previewPhotos = getSelectedPhotoUrls(photoSlots);

  const resolvedTemplate = frame ? resolveFrameTemplate(frame, photoSlots.length) : null;
  const activeSlot = resolvedTemplate?.photoSlots.find((slot) => slot.slotNumber === currentPhotoSlot);
  const slotAspectRatio = activeSlot && activeSlot.height > 0 ? activeSlot.width / activeSlot.height : 4 / 3;

  // Canon DSLR bridge (Electron main process). Keep the last Canon frame on screen
  // even while the service is re-engaging Live View after a shutter; never let the
  // PC webcam appear over a connected Canon. WebRTC is only a fallback when no
  // Canon is available at all.
  const canon = usePhotoBoothCamera();
  const canonActive = canon.available && Boolean(canon.liveFrame);

  const [countdown, setCountdown] = useState(5);
  const [isFlash, setIsFlash] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  /** Live View is being torn down for the shutter — countdown holds at 1. */
  const [isPreparing, setIsPreparing] = useState(false);
  /** prepareCapture finished; the countdown may tick to 0 (flash + shutter). */
  const [isArmed, setIsArmed] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraBoxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [boundarySize, setBoundarySize] = useState({ width: 0, height: 0 });

  // Auto-start Canon live view when available and it isn't already running.
  useEffect(() => {
    if (canon.available && !isStarted && (canon.status === 'DISCONNECTED' || canon.status === 'READY')) {
      void canon.start();
    }
    // `canon.start` is a stable callback; primitives + isStarted drive re-runs.
  }, [canon.available, canon.status, canon.start, isStarted]);

  // WebRTC fallback camera (used ONLY when the Canon bridge is unavailable/hold no frames).
  useEffect(() => {
    if (canon.available) {
      return;
    }
    let isCancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not available in this environment.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        setCameraError(null);
      } catch {
        setCameraError('Camera access was blocked or no camera device was found.');
      }
    };

    startCamera();
    return () => {
      isCancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraAttempt, canonActive]);

  useEffect(() => {
    setCountdown(5);
    setIsStarted(false);
    setIsPreparing(false);
    setIsArmed(false);
  }, [currentPhotoSlot]);

  const toggleFullscreen = async () => {
    const electronWindow = typeof window.electronAPI?.window?.toggleFullscreen === 'function';
    if (electronWindow) {
      const next = await window.electronAPI.window.toggleFullscreen();
      setIsFullscreen(next);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await cameraBoxRef.current?.requestFullscreen?.();
    }
  };

  const feedReady = canonActive || cameraReady;
  const shownError = canon.available ? (canon.error ?? cameraError) : cameraError;

  const measureBoundary = useCallback(() => {
    const box = cameraBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const fitWidth = Math.min(0.9 * rect.width, 0.88 * rect.height * slotAspectRatio);
    setBoundarySize({ width: fitWidth, height: fitWidth / slotAspectRatio });
  }, [slotAspectRatio]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      requestAnimationFrame(measureBoundary);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('resize', measureBoundary);
    measureBoundary();
    if (typeof window.electronAPI?.window?.isFullscreen === 'function') {
      window.electronAPI.window.isFullscreen().then((fs) => {
        setIsFullscreen(fs);
        requestAnimationFrame(measureBoundary);
      });
    }
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('resize', measureBoundary);
    };
  }, [measureBoundary]);

  const capturePhoto = useCallback(async () => {
    if (canonActive) {
      // Hold the capture screen until the shutter actually returned a photo;
      // only then navigate to the review. No early redirects.
      setIsCapturing(true);
      const result = await canon.capture();
      setIsCapturing(false);
      setIsFlash(false);
      const dataUrl = result?.dataUrl;
      if (dataUrl) {
        addPhotoAttempt(dataUrl);
      } else {
        setCameraError('Photo could not be captured. Please try again.');
        setIsStarted(false);
        setIsArmed(false);
      }
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      setCameraError('The camera is not ready yet. Please try again.');
      setIsStarted(false);
      setIsArmed(false);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      if (isMirrored) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    setIsFlash(false);
    addPhotoAttempt(canvas.toDataURL('image/jpeg', 0.92));
  }, [canonActive, canon, isMirrored, addPhotoAttempt]);

  // Keep the latest capture implementation in a ref so the countdown effect
  // can depend only on [countdown, isStarted]. Otherwise the effect would be
  // torn down and re-created on every render (e.g. each Canon live-view frame),
  // resetting the interval before it ticks and cancelling the capture timeout.
  const capturePhotoRef = useRef(capturePhoto);
  capturePhotoRef.current = capturePhoto;

  const canonRef = useRef(canon);
  canonRef.current = canon;

  useEffect(() => {
    if (!isStarted) return;
    if (countdown === 0) {
      setIsFlash(true);
      const flashOff = setTimeout(() => setIsFlash(false), 350);
      void capturePhotoRef.current();
      return () => clearTimeout(flashOff);
    }

    // Last second: tear Live View down and WAIT until the shutter is armed.
    // The countdown only ticks to 0 (flash + capture) once prepare resolves,
    // so the flash always coincides with the actual shutter — never with a
    // still-pending mode switch.
    if (countdown === 1 && canonRef.current.available && !isArmed) {
      let cancelled = false;
      setIsPreparing(true);
      void (async () => {
        let armed = false;
        try {
          const result = await Promise.race([
            canonRef.current.prepareCapture().then((payload) => ({
              ok: payload !== null && payload.status !== 'ERROR' && !payload.error,
            })),
            new Promise<{ ok: boolean }>((resolve) =>
              setTimeout(() => resolve({ ok: false }), 3000),
            ),
          ]);
          armed = result.ok;
        } catch {
          armed = false;
        }
        if (cancelled) return;
        setIsPreparing(false);
        if (!armed) {
          setCameraError('Camera could not prepare to shoot. Please try again.');
          setIsStarted(false);
          return;
        }
        setIsArmed(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(() => setCountdown((value) => value - 1), 1000);
    return () => clearInterval(interval);
  }, [countdown, isStarted, isArmed]);

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] select-none flex-col items-center justify-center">
      {isFlash && <div className="pointer-events-none absolute inset-0 z-50 bg-white" />}

      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-4 flex w-full items-center justify-between gap-4 text-[#4d2d85]">
            <div>
              <div className="text-[0.7rem] font-black uppercase tracking-[0.24em]">Position Slot</div>
              <div className="text-xl font-black uppercase tracking-[-0.06em] md:text-2xl bg-[#d9f85a]">
                Photo {currentPhotoSlot} of {photoSlots.length}
              </div>
            </div>
            <div className="rounded-[12px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 py-2 text-right">
              <div className="text-[0.7rem] font-black uppercase tracking-[0.24em]">Attempt</div>
              <div className="text-sm font-black">{attemptNumber} of 3</div>
            </div>
          </div>

          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsMirrored((mirrored) => !mirrored)}
              className="rounded-[10px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[#4d2d85]"
              aria-pressed={isMirrored}
            >
              {isMirrored ? 'Mirror: On' : 'Mirror: Off'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.75fr)]">
            <div
              ref={cameraBoxRef}
              onClick={() => {
                if (!isStarted && feedReady && !cameraError) setIsStarted(true);
              }}
              className={`pb-camera-box relative w-full max-w-[700px] mx-auto overflow-hidden rounded-[18px] border-[5px] border-[#a35ef6] bg-[#261640] shadow-[0_14px_0_rgba(77,45,133,0.25)] ${!isStarted ? 'cursor-pointer' : ''}`}
              style={{ aspectRatio: slotAspectRatio }}
              data-aspect-ratio={slotAspectRatio}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg text-white backdrop-blur transition-transform hover:scale-110 hover:bg-black/70"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? '🗗' : '⛶'}
              </button>
              {canonActive ? (
                <img
                  src={canon.liveFrame ?? undefined}
                  alt="Canon live view"
                  className={`absolute inset-0 h-full w-full object-cover select-none ${isMirrored ? '-scale-x-100' : ''}`}
                />
              ) : (
                <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-cover ${isMirrored ? '-scale-x-100' : ''}`} />
              )}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/10">
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className={index < 6 ? 'border-r border-b border-white/5' : ''} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.08)_0%,rgba(9,9,11,0.6)_100%)] z-10" />

              {isPreparing && (
                <div className="pointer-events-none absolute inset-0 z-10 bg-black/45" aria-hidden="true" />
              )}

              {isFullscreen && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div
                    className="relative rounded-[10px] border-[4px] border-[#ffec5a] shadow-[0_0_0_3px_rgba(0,0,0,0.4),0_0_30px_rgba(255,236,90,0.4)]"
                    style={{
                      width: boundarySize.width || undefined,
                      height: boundarySize.height || undefined,
                      aspectRatio: `${slotAspectRatio} / 1`,
                    }}
                  >
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ffec5a]">
                      Capture Area
                    </span>
                  </div>
                </div>
              )}

              {!feedReady && !shownError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Starting camera...
                </div>
              )}

              {shownError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center">
                  <span className="text-sm font-bold uppercase tracking-[0.16em] text-rose-300">{shownError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (canon.available) {
                        void canon.retry();
                      }
                      setCameraReady(false);
                      setCameraError(null);
                      setCameraAttempt((value) => value + 1);
                    }}
                    className="rounded-[10px] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[#4d2d85]"
                  >
                    Retry Camera
                  </button>
                </div>
              )}

{isStarted && countdown > 0 ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-pulse">
                  <div className="text-[110px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]">{countdown}</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.3em] text-white/90">
                    {isPreparing ? 'Hold still…' : 'Stay still'}
                  </div>
                </div>
              ) : isStarted ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center text-4xl font-black uppercase tracking-[0.24em] text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)]">
                  {isCapturing ? 'Foto diambil...' : 'Cheese!'}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-center">
              <FrameCanvas
                frame={frame}
                photos={previewPhotos}
                photoSlotCount={photoSlots.length}
                className="w-full max-w-xs rounded-[16px] border-[4px] border-[#a35ef6] bg-[#d9f85a]"
              />
            </div>
          </div>

          <div className="mt-4 text-center text-xs font-semibold tracking-wide text-[#4d2d85]/80">
            {isStarted
              ? 'Live camera feed active.'
              : 'Click the preview to shoot — the photo is taken when the countdown ends.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureScreen;
