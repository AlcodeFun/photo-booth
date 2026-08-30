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
    <div className="flex flex-col items-center justify-between h-full max-w-5xl mx-auto px-6 py-6 select-none relative">
      {isFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      <div className="flex justify-between items-center w-full mb-4">
        <div className="text-left">
          <span className="text-zinc-500 text-xs uppercase tracking-wider block">Position Slot</span>
          <span className="font-bold text-xl text-zinc-100">Photo {currentPhotoSlot} of {photoSlots.length}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-right">
          <span className="text-xs text-zinc-500 uppercase tracking-wider block">Attempt</span>
          <span className="font-semibold text-zinc-300 text-sm">{attemptNumber} of 3</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsMirrored((mirrored) => !mirrored)}
        className="self-end mb-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-200 hover:border-zinc-500 transition-colors"
        aria-pressed={isMirrored}
      >
        {isMirrored ? 'Mirror: On' : 'Mirror: Off'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.75fr)] gap-6 w-full flex-grow items-center my-2">
        <div className="w-full aspect-[4/3] rounded-3xl border-8 flex items-center justify-center relative overflow-hidden shadow-2xl bg-zinc-950 border-zinc-800">
          <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover ${isMirrored ? '-scale-x-100' : ''}`} />
          <div className="absolute inset-0 border border-zinc-900/30 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({ length: 9 }, (_, index) => <div key={index} className={index < 6 ? 'border-r border-b border-white/5' : ''} />)}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.05)_0%,rgba(9,9,11,0.55)_100%)] z-10 pointer-events-none" />

          {!cameraReady && !cameraError && <div className="z-20 text-zinc-300 text-sm bg-black/60 px-4 py-3 rounded-xl">Starting camera...</div>}
          {cameraError && (
            <div className="z-20 flex flex-col items-center gap-3 text-center px-6">
              <span className="text-rose-300 text-sm">{cameraError}</span>
              <button type="button" onClick={() => { setCameraReady(false); setCameraError(null); setCameraAttempt((value) => value + 1); }} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold">Retry Camera</button>
            </div>
          )}
          {!isStarted ? (
            <button type="button" onClick={() => setIsStarted(true)} disabled={!cameraReady} className="z-20 px-8 py-4 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Start Photo Session</button>
          ) : countdown > 0 ? (
            <div className="z-20 flex flex-col items-center animate-pulse">
              <div className="text-[120px] font-black leading-none text-white tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">{countdown}</div>
              <div className="text-zinc-400 font-semibold uppercase tracking-widest text-sm mt-2">Stay still</div>
            </div>
          ) : (
            <div className="z-20 text-4xl font-extrabold text-white uppercase tracking-wider">Cheese!</div>
          )}
        </div>

        <FrameCanvas
          frame={frame}
          photos={previewPhotos}
          photoSlotCount={photoSlots.length}
          className="w-full max-w-xs mx-auto rounded-2xl"
        />
      </div>

      <div className="w-full text-center text-zinc-500 text-xs py-2">
        {isStarted ? 'Live camera feed active.' : 'Position yourself in front of the camera, then start when ready.'}
      </div>
    </div>
  );
};

export default PhotoCaptureScreen;
