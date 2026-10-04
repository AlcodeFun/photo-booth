import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { usePhotoBoothCamera } from '../hooks/usePhotoBoothCamera';
import { getSelectedPhotoUrls } from '../utils/photoSlots';

export const PhotoCaptureScreen: React.FC = () => {
  const { currentPhotoSlot, sessionId, photoSlots, addPhotoAttempt, usePhoto, setScreen } =
    useSessionStore((state) => ({
      currentPhotoSlot: state.currentPhotoSlot,
      sessionId: state.sessionId,
      photoSlots: state.photoSlots,
      addPhotoAttempt: state.addPhotoAttempt,
      usePhoto: state.usePhoto,
      setScreen: state.setScreen,
    }));
  const flowMode = useBoothConfig((state) => state.flowMode);
  const flowSettings = useBoothConfig((state) => state.flow);
  const isAutoFlow = flowMode === 'auto';
  const isTimedFlow = flowMode === 'timed';
  const currentSlot = photoSlots.find((slot) => slot.slotNumber === currentPhotoSlot);
  const attemptNumber = currentSlot ? currentSlot.attempts.length + 1 : 1;
  const maxAttempts = Math.max(1, flowSettings.maxAttempts);
  const selectedPhotoUrls = getSelectedPhotoUrls(photoSlots);

  // Canon DSLR bridge (Electron main process). Keep the last Canon frame on screen
  // even while the service is re-engaging Live View after a shutter; never let the
  // PC webcam appear over a connected Canon. WebRTC is only a fallback when no
  // Canon is available at all.
  const canon = usePhotoBoothCamera();
  const canonActive =
    canon.available &&
    Boolean(canon.liveFrame) &&
    canon.status !== 'ERROR' &&
    canon.status !== 'DISCONNECTED';
  const canonCaptureAvailable =
    canon.available &&
    (canon.status === 'READY' || canon.status === 'LIVE_VIEW' || canon.status === 'CAPTURING');

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
  const captureInFlightRef = useRef(false);
  const [timedPhase, setTimedPhase] = useState<'idle' | 'starting' | 'active' | 'ended'>('idle');
  const [timedStartCountLeft, setTimedStartCountLeft] = useState(0);
  const [timedRemaining, setTimedRemaining] = useState(0);
  const photoSlotCarouselRef = useRef<HTMLDivElement>(null);
  const activePhotoSlotRef = useRef<HTMLSpanElement>(null);
  const [photoAspectRatio, setPhotoAspectRatio] = useState<number | null>(null);
  const [showPhotoSlotArrows, setShowPhotoSlotArrows] = useState(false);
  const [canScrollPhotoSlotsLeft, setCanScrollPhotoSlotsLeft] = useState(false);
  const [canScrollPhotoSlotsRight, setCanScrollPhotoSlotsRight] = useState(false);

  const updatePhotoSlotCarousel = useCallback(() => {
    const carousel = photoSlotCarouselRef.current;
    if (!carousel) return;
    setShowPhotoSlotArrows(carousel.scrollWidth > carousel.clientWidth + 1);
    setCanScrollPhotoSlotsLeft(carousel.scrollLeft > 1);
    setCanScrollPhotoSlotsRight(carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const carousel = photoSlotCarouselRef.current;
    if (!carousel) return;
    const resizeObserver = new ResizeObserver(updatePhotoSlotCarousel);
    resizeObserver.observe(carousel);
    updatePhotoSlotCarousel();
    activePhotoSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    return () => resizeObserver.disconnect();
  }, [currentPhotoSlot, photoSlots.length, updatePhotoSlotCarousel]);

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
      setCameraReady(false);
      return;
    }
    setCameraReady(false);
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
  }, [cameraAttempt, canon.available]);

  useEffect(() => {
    setCountdown(flowSettings.shotCountdown);
    setIsStarted(false);
    setIsPreparing(false);
    setIsArmed(false);
    setTimedPhase('idle');
    setTimedStartCountLeft(0);
    setTimedRemaining(0);
    liveFramesRef.current = [];
  }, [currentPhotoSlot, flowSettings.shotCountdown, isAutoFlow]);

  const feedReady = canonCaptureAvailable || cameraReady;
  const shownError = canon.error ?? cameraError;

  useEffect(() => {
    if (!shownError) {
      return;
    }
    setCountdown(flowSettings.shotCountdown);
    setIsStarted(false);
    setIsPreparing(false);
    setIsArmed(false);
  }, [flowSettings.shotCountdown, shownError]);

  useEffect(() => {
    if (isAutoFlow && !isStarted && feedReady && !shownError) {
      setIsStarted(true);
    }
  }, [feedReady, isAutoFlow, isStarted, shownError]);

  // Flow-aware commit: retake mode shows the review, auto mode instantly
  // accepts and advances, timed mode stays on capture collecting more photos.
  // The rolling live-view buffer travels with the shot so the framed "live
  // photo" result can animate each slot with its own pre-capture clip.
  const commitCapture = useCallback(
    (dataUrl: string) => {
      const flow = useBoothConfig.getState().flowMode;
      const liveFrames = liveFramesRef.current.slice();
      if (flow === 'auto') {
        liveFramesRef.current = [];
        addPhotoAttempt(dataUrl, false, liveFrames);
        usePhoto();
        return;
      }
      if (flow !== 'timed') {
        liveFramesRef.current = [];
      } else {
        // Timed flow keeps capturing into the same slot; disarm the shot
        // countdown so the next tap re-arms a fresh one.
        setIsStarted(false);
      }
      addPhotoAttempt(dataUrl, flow === 'timed', liveFrames);
    },
    [addPhotoAttempt, setIsStarted, usePhoto],
  );
  const commitCaptureRef = useRef(commitCapture);
  commitCaptureRef.current = commitCapture;

  const capturePhoto = useCallback(async () => {
    if (captureInFlightRef.current) {
      return;
    }
    captureInFlightRef.current = true;
    try {
      if (canonCaptureAvailable) {
        setIsCapturing(true);
        const result = await canon.capture();
        const currentSession = useSessionStore.getState();
        if (
          currentSession.sessionId !== sessionId ||
          currentSession.currentPhotoSlot !== currentPhotoSlot ||
          currentSession.currentScreen !== 'PHOTO_CAPTURE' ||
          useBoothConfig.getState().flowMode !== flowMode
        ) {
          return;
        }
        const dataUrl = result?.dataUrl;
        if (dataUrl) {
          commitCapture(dataUrl);
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
      commitCapture(canvas.toDataURL('image/jpeg', 0.92));
    } finally {
      captureInFlightRef.current = false;
      setIsCapturing(false);
      setIsFlash(false);
    }
  }, [
    canon.capture,
    canonCaptureAvailable,
    commitCapture,
    currentPhotoSlot,
    flowMode,
    isMirrored,
    sessionId,
  ]);

  // Keep the latest capture implementation in a ref so the countdown effect
  // can depend only on [countdown, isStarted]. Otherwise the effect would be
  // torn down and re-created on every render (e.g. each Canon live-view frame),
  // resetting the interval before it ticks and cancelling the capture timeout.
  const capturePhotoRef = useRef(capturePhoto);
  capturePhotoRef.current = capturePhoto;

  const canonRef = useRef(canon);
  canonRef.current = canon;

  // Rolling buffer of downscaled live view frames recorded just before the
  // shot. Fed to the attempt so the framed "live photo" result can animate
  // this slot independently.
  const liveFramesRef = useRef<string[]>([]);
  const MAX_LIVE_FRAMES = 20;

  const captureLiveFrame = useCallback(async (): Promise<string | null> => {
    if (canonActive) {
      const src = canonRef.current.liveFrame;
      if (!src) return null;
      const image = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
      if (!image) return null;
      const canvas = document.createElement('canvas');
      const scale = 480 / image.width;
      canvas.width = 480;
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      return null;
    }
    const canvas = document.createElement('canvas');
    const scale = 480 / video.videoWidth;
    canvas.width = 480;
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [canonActive, isMirrored]);

  const pushLiveFrame = (frame: string | null) => {
    if (!frame) return;
    liveFramesRef.current = [...liveFramesRef.current, frame].slice(-MAX_LIVE_FRAMES);
  };

  // Countdown flows (retake + auto): sample the live view while the shot
  // countdown is running, stopping before the last second reaches the shutter.
  useEffect(() => {
    if (!isStarted || countdown < 2 || isPreparing || isCapturing) {
      return;
    }
    const interval = setInterval(() => {
      void captureLiveFrame().then(pushLiveFrame);
    }, 160);
    return () => clearInterval(interval);
  }, [isStarted, countdown, isPreparing, isCapturing, captureLiveFrame]);

  // Timed flow: keep a rolling few seconds of live view so a tap-to-capture
  // always has a pre-shutter clip to animate from.
  useEffect(() => {
    if (!isTimedFlow || timedPhase !== 'active' || isCapturing) {
      return;
    }
    const interval = setInterval(() => {
      void captureLiveFrame().then(pushLiveFrame);
    }, 160);
    return () => clearInterval(interval);
  }, [isTimedFlow, timedPhase, isCapturing, captureLiveFrame]);

  useEffect(() => {
    if (!isStarted || shownError) return;
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
          const payload = await canonRef.current.prepareCapture();
          armed = payload !== null && payload.status !== 'ERROR' && !payload.error;
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
  }, [countdown, isStarted, isArmed, shownError]);

  // Timed flow state machine: idle → starting (countdown) → active → ended.
  const startTimedSession = () => {
    if (
      isTimedFlow &&
      timedPhase === 'idle' &&
      feedReady &&
      !shownError &&
      !isStarted &&
      !isPreparing &&
      !isCapturing
    ) {
      if (flowSettings.timedStartCountdown === 0) {
        setTimedPhase('active');
        setTimedRemaining(Math.max(1, flowSettings.timeBudgetSeconds));
        setCountdown(0);
        setIsArmed(false);
        setIsPreparing(false);
        setIsStarted(true);
        return;
      }
      setTimedPhase('starting');
      setTimedStartCountLeft(flowSettings.timedStartCountdown);
    }
  };

  const captureNow = () => {
    if (!feedReady) {
      setCameraError('The camera is not ready yet. Please try again.');
      return;
    }
    // Timed captures use the Flow 2 setup countdown before each shutter.
    // Resetting isArmed/isPreparing lets a prior disarmed countdown re-arm.
    if (isTimedFlow && (isStarted || isPreparing || isCapturing)) {
      return;
    }
    setCountdown(Math.max(0, flowSettings.timedStartCountdown));
    setIsArmed(false);
    setIsPreparing(false);
    setIsStarted(true);
  };

  useEffect(() => {
    if (!isTimedFlow) {
      return;
    }
    if (timedPhase === 'starting') {
      const timer = setTimeout(() => {
        if (timedStartCountLeft <= 1) {
          setTimedPhase('active');
          setTimedRemaining(Math.max(1, flowSettings.timeBudgetSeconds));
          setCountdown(0);
          setIsArmed(false);
          setIsPreparing(false);
          setIsStarted(true);
        } else {
          setTimedStartCountLeft((value) => value - 1);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (timedPhase === 'active') {
      if (timedRemaining <= 0) {
        if (isStarted || isPreparing || isCapturing) {
          return;
        }
        setTimedPhase('ended');
        setScreen('FILTER');
        return;
      }
      const timer = setTimeout(() => setTimedRemaining((value) => value - 1), 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [
    isTimedFlow,
    timedPhase,
    timedStartCountLeft,
    timedRemaining,
    flowSettings.timeBudgetSeconds,
    isStarted,
    isPreparing,
    isCapturing,
    setScreen,
  ]);

  const handleLiveViewClick = () => {
    if (isTimedFlow) {
      if (timedPhase === 'idle') startTimedSession();
      else if (timedPhase === 'active') captureNow();
      return;
    }
    if (!isAutoFlow && !isStarted && feedReady && !shownError) setIsStarted(true);
  };
  const latestPhoto = currentSlot?.attempts[currentSlot.attempts.length - 1]?.localPath;
  const timedClock = timedPhase === 'active' ? timedRemaining : flowSettings.timeBudgetSeconds;

  return (
    <div
      onClick={handleLiveViewClick}
      className={`fixed inset-0 z-50 h-[100dvh] w-screen select-none overflow-hidden bg-black text-white ${!isStarted ? 'cursor-pointer' : ''}`}
      aria-label="Fullscreen camera live view"
    >
      {canonActive ? (
        <img
          src={canon.liveFrame ?? undefined}
          alt="Canon live view"
          className={`absolute inset-0 h-full w-full object-cover ${isMirrored ? '-scale-x-100' : ''}`}
        />
      ) : (
        <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-cover ${isMirrored ? '-scale-x-100' : ''}`} />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />
      {isFlash && <div className="pointer-events-none absolute inset-0 z-50 bg-white" />}

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
        <div className="rounded-sm bg-black/45 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
            {isTimedFlow ? 'Sesi' : `Slot ke ${currentPhotoSlot} dari ${photoSlots.length}`}
          </p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {isTimedFlow
              ? `${currentSlot?.attempts.length ?? 0} photo diambil`
              : `Kesempatan ke ${attemptNumber} dari ${maxAttempts}`}
          </p>
        </div>

        {isTimedFlow && (
          <div className="min-w-24 bg-black/45 px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
              {timedPhase === 'active' ? 'Time left' : 'Session'}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {String(Math.floor(timedClock / 60)).padStart(2, '0')}:{String(timedClock % 60).padStart(2, '0')}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsMirrored((mirrored) => !mirrored);
          }}
          className="shrink-0 bg-black/45 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] backdrop-blur-sm hover:bg-black/70"
          aria-pressed={isMirrored}
          title="Toggle mirrored preview"
        >
          Mirror {isMirrored ? 'on' : 'off'}
        </button>
      </header>

      {!feedReady && !shownError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 text-sm font-bold uppercase tracking-[0.18em]">
          Starting camera...
        </div>
      )}

      {shownError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/65 px-6 text-center">
          <span className="max-w-xl text-sm font-bold text-white sm:text-base">{shownError}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void canon.retry();
              setCountdown(useBoothConfig.getState().flow.shotCountdown);
              setCameraReady(false);
              setCameraError(null);
              setCameraAttempt((value) => value + 1);
              setIsPreparing(false);
              setIsArmed(false);
              setIsStarted(false);
            }}
            className="bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] text-black"
          >
            Retry camera
          </button>
        </div>
      )}

      {isStarted && countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
          <div className="text-[clamp(6rem,22vh,14rem)] font-bold leading-none tabular-nums drop-shadow-lg">{countdown}</div>
          <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/90">
            {isPreparing ? 'Tunggu Sebentar' : 'Tahan Posemu'}
          </div>
        </div>
      )}
      {isStarted && countdown === 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-3xl font-bold uppercase tracking-[0.12em] drop-shadow-lg sm:text-5xl">
          {isCapturing ? 'Photo captured' : 'Cheese!'}
        </div>
      )}

      {isTimedFlow && timedPhase === 'starting' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/20">
          <div className="text-[clamp(6rem,22vh,14rem)] font-bold leading-none tabular-nums drop-shadow-lg">{timedStartCountLeft}</div>
          <div className="mt-4 text-sm font-bold uppercase tracking-[0.18em]">Get ready</div>
        </div>
      )}

      {!isStarted && feedReady && !shownError && (isTimedFlow && timedPhase === 'idle' ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">Click dimana saja untuk memulai</p>
        </div>
      ) : isTimedFlow && timedPhase === 'active' ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">Click dimana saja untuk mengambil foto</p>
        </div>
      ) : !isAutoFlow ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90 sm:text-base">Click dimana saja untuk mengambil foto</p>
        </div>
      ) : null)}

      {isTimedFlow && latestPhoto && (
        <aside className="absolute bottom-24 right-5 z-20 w-48 bg-black/55 p-2 backdrop-blur-sm sm:bottom-28 sm:right-8 sm:w-64">
          <span className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-rose-400 text-sm font-bold text-black">
            {currentSlot?.attempts.length}
          </span>
          <img src={latestPhoto} alt="Foto Sebelumnya" className="h-44 w-full bg-black/35 object-contain shadow-lg sm:h-56" />
          <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.1em]">Foto Sebelumnya</p>
        </aside>
      )}

      <footer className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-5 pb-5 sm:px-8 sm:pb-7">
        {!isTimedFlow && (
          <nav
            className="mx-auto flex w-full max-w-[min(92vw,1200px)] items-center justify-center gap-2"
            aria-label="Photo slot progress"
            onClick={(event) => event.stopPropagation()}
          >
            {showPhotoSlotArrows && (
              <button
                type="button"
                aria-label="Previous photo slots"
                disabled={!canScrollPhotoSlotsLeft}
                onClick={() => photoSlotCarouselRef.current?.scrollBy({ left: -photoSlotCarouselRef.current.clientWidth * 0.75, behavior: 'smooth' })}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-3xl text-white enabled:hover:bg-white/15 disabled:opacity-30"
              >
                ‹
              </button>
            )}

            <div
              ref={photoSlotCarouselRef}
              onScroll={updatePhotoSlotCarousel}
              className="min-w-0 flex-1 overflow-x-auto scroll-smooth"
            >
              <div className="flex w-max min-w-full items-center justify-center gap-2 px-1">
                {photoSlots.map((slot, index) => {
                  const isCurrent = slot.slotNumber === currentPhotoSlot;
                  const isComplete = Boolean(slot.selectedAttempt);
                  const photoUrl = selectedPhotoUrls[index];
                  return (
                    <span
                      key={slot.slotNumber}
                      ref={isCurrent ? activePhotoSlotRef : null}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex shrink-0 flex-col items-center gap-1 border-b-4 px-2 py-2 text-xs font-bold sm:px-3 sm:py-3 ${
                        isCurrent ? 'border-white bg-white/20 text-white' : isComplete ? 'border-white/60 text-white/80' : 'border-white/25 text-white/60'
                      }`}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={`Photo slot ${slot.slotNumber}`}
                          className="h-24 w-auto max-w-40 object-contain sm:h-32 sm:max-w-56"
                          onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            if (naturalWidth > 0 && naturalHeight > 0) {
                              setPhotoAspectRatio(naturalWidth / naturalHeight);
                            }
                          }}
                        />
                      ) : (
                        <span
                          className="relative flex h-24 shrink-0 items-center justify-center border border-white/35 sm:h-32"
                          style={{ aspectRatio: photoAspectRatio ?? '3 / 4' }}
                        >
                          <span className="px-2 text-center text-white/60">Photo slot {slot.slotNumber}</span>
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {showPhotoSlotArrows && (
              <button
                type="button"
                aria-label="Next photo slots"
                disabled={!canScrollPhotoSlotsRight}
                onClick={() => photoSlotCarouselRef.current?.scrollBy({ left: photoSlotCarouselRef.current.clientWidth * 0.75, behavior: 'smooth' })}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-3xl text-white enabled:hover:bg-white/15 disabled:opacity-30"
              >
                ›
              </button>
            )}
          </nav>
        )}

        {isTimedFlow && <div className="w-16" aria-hidden="true" />}
      </footer>

      {isPreparing && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-white px-6 text-center text-4xl font-bold text-black sm:text-6xl"
          role="status"
          aria-live="polite"
        >
          Tahan posisimu ya!
        </div>
      )}
    </div>
  );
};

export default PhotoCaptureScreen;
