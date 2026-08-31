import React, { useEffect, useRef, useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';

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

  const [countdown, setCountdown] = useState(5);
  const [isFlash, setIsFlash] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
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
  }, [cameraAttempt]);

  useEffect(() => {
    setCountdown(5);
    setIsStarted(false);
  }, [currentPhotoSlot]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      setCameraError('The camera is not ready yet. Please try again.');
      setIsStarted(false);
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
    addPhotoAttempt(canvas.toDataURL('image/jpeg', 0.92));
  };

  useEffect(() => {
    if (!isStarted) return;
    if (countdown === 0) {
      setIsFlash(true);
      const timer = setTimeout(() => {
        setIsFlash(false);
        capturePhoto();
      }, 300);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => setCountdown((value) => value - 1), 1000);
    return () => clearInterval(interval);
  }, [countdown, isMirrored, isStarted]);

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
            <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border-[5px] border-[#a35ef6] bg-[#261640] shadow-[0_14px_0_rgba(77,45,133,0.25)]">
              <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-cover ${isMirrored ? '-scale-x-100' : ''}`} />
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/10">
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className={index < 6 ? 'border-r border-b border-white/5' : ''} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.08)_0%,rgba(9,9,11,0.6)_100%)] z-10" />

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Starting camera...
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center">
                  <span className="text-sm font-bold uppercase tracking-[0.16em] text-rose-300">{cameraError}</span>
                  <button
                    type="button"
                    onClick={() => {
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

              {!isStarted ? (
                <button
                  type="button"
                  onClick={() => setIsStarted(true)}
                  disabled={!cameraReady}
                  className="absolute inset-x-0 bottom-8 z-20 mx-auto block w-fit rounded-[12px] bg-[#ff7d57] px-8 py-4 text-[0.5rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Photo Session
                </button>
              ) : countdown > 0 ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-pulse">
                  <div className="text-[110px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]">{countdown}</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.3em] text-white/90">Stay still</div>
                </div>
              ) : (
                <div className="absolute inset-0 z-20 flex items-center justify-center text-4xl font-black uppercase tracking-[0.24em] text-white">Cheese!</div>
              )}
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

          <div className="mt-4 text-center text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[#4d2d85]">
            {isStarted ? 'Live camera feed active.' : 'Position yourself in front of the camera, then start when ready.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureScreen;
