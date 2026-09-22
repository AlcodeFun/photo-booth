import { useCallback, useEffect, useState } from 'react';
import {
  CameraLiveFrame,
  CameraStatePayload,
  CameraStatus,
} from '@photo-booth/types';

/**
 * Provides access to the Canon DSLR bridge exposed by the Electron main process.
 *
 * When running in a plain browser (no preload / no main-process camera bridge),
 * `available` is false and callers should fall back to the WebRTC capture path.
 */
export function usePhotoBoothCamera() {
  const api = window.electronAPI?.camera;

  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<CameraStatus>('DISCONNECTED');
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    let cancelled = false;
    api
      .available()
      .then((ok) => {
        if (!cancelled) {
          setAvailable(ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const unsubStatus = api.onStatus((payload: CameraStatePayload) => {
      setStatus(payload.status);
      setError(payload.error ?? null);
      setModel(payload.info?.model ?? null);
    });
    let liveFrameUrl: string | null = null;
    const unsubLive = api.onLiveView((frame: CameraLiveFrame) => {
      if (liveFrameUrl !== null) {
        URL.revokeObjectURL(liveFrameUrl);
      }
      const frameBytes = new Uint8Array(frame.frame.length);
      frameBytes.set(frame.frame);
      liveFrameUrl = URL.createObjectURL(new Blob([frameBytes], { type: 'image/jpeg' }));
      setLiveFrame(liveFrameUrl);
    });

    api
      .getStatus()
      .then((payload) => {
        setStatus(payload.status);
        setError(payload.error ?? null);
        setModel(payload.info?.model ?? null);
      })
      .catch((err) => setError(String(err)));

    return () => {
      unsubStatus();
      unsubLive();
      if (liveFrameUrl !== null) {
        URL.revokeObjectURL(liveFrameUrl);
      }
    };
  }, [api]);

  const start = useCallback(async () => {
    if (!api) {
      return;
    }
    setError(null);
    try {
      const payload = await api.startLiveView();
      setStatus(payload.status);
      setError(payload.error ?? null);
      setModel(payload.info?.model ?? null);
    } catch (err) {
      setError(String(err));
    }
  }, [api]);

  const stop = useCallback(async () => {
    if (!api) {
      return;
    }
    try {
      const payload = await api.stopLiveView();
      setStatus(payload.status);
      setError(payload.error ?? null);
    } catch (err) {
      setError(String(err));
    }
  }, [api]);

  const capture = useCallback(async () => {
    if (!api) {
      return null;
    }
    try {
      return await api.takePicture();
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [api]);

  const prepareCapture = useCallback(async (): Promise<CameraStatePayload | null> => {
    if (!api) {
      return null;
    }
    try {
      const payload = await api.prepareCapture();
      setStatus(payload.status);
      setError(payload.error ?? null);
      setModel(payload.info?.model ?? null);
      return payload;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [api]);

  const retry = useCallback(async () => {
    setError(null);
    await start();
  }, [start]);

  return {
    available,
    status,
    liveFrame,
    error,
    model,
    isLiveViewing: status === 'LIVE_VIEW',
    start,
    stop,
    capture,
    prepareCapture,
    retry,
  };
}
