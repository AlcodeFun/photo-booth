import React, { useEffect, useRef, useState } from 'react';
import { usePhotoBoothCamera } from '../../../hooks/usePhotoBoothCamera';

/**
 * Live feed for the "Fullscreen Camera" start screen, in the same priority as
 * the capture screen: Canon live view, else the webcam, else a slow Ken Burns
 * pan over a still so the screen never shows a black hole.
 *
 * Canon live view is only started here when it is idle and is stopped again on
 * unmount, so the DSLR is not left streaming once the guest moves on (the
 * capture screen re-engages it). The preview is mirrored like a selfie screen.
 */
export const StartCameraFeed: React.FC<{ fallbackSrc: string }> = ({ fallbackSrc }) => {
  const canon = usePhotoBoothCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamReady, setWebcamReady] = useState(false);
  const startedCanonRef = useRef(false);
  const canonRef = useRef(canon);
  canonRef.current = canon;

  useEffect(() => {
    if (canon.available && !startedCanonRef.current && (canon.status === 'READY' || canon.status === 'DISCONNECTED')) {
      startedCanonRef.current = true;
      void canon.start();
    }
  }, [canon.available, canon.status, canon.start]);

  useEffect(
    () => () => {
      if (startedCanonRef.current) void canonRef.current.stop();
    },
    [],
  );

  useEffect(() => {
    if (canon.available || !navigator.mediaDevices?.getUserMedia) {
      setWebcamReady(false);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play().catch(() => undefined);
        }
        setWebcamReady(true);
      })
      .catch(() => setWebcamReady(false));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [canon.available]);

  if (canon.available && canon.liveFrame) {
    return (
      <img src={canon.liveFrame} alt="" className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
    );
  }

  return (
    <>
      <img
        src={fallbackSrc}
        alt=""
        className={`pb-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${webcamReady ? 'opacity-0' : 'opacity-100'}`}
      />
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-700 ${webcamReady ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
};

export default StartCameraFeed;
