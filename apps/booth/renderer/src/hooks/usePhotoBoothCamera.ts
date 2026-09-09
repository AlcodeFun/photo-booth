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
  const available = Boolean(api);

  const [status, setStatus] = useState<CameraStatus>('DISCONNECTED');
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    const unsubStatus = api.onStatus((payload: CameraStatePayload) => {
      setStatus(payload.status);
      setError(payload.error ?? null);
      setModel(payload.info?.model ?? null);
    });
    const unsubLive = api.onLiveView((frame: CameraLiveFrame) => {
      setLiveFrame(frame.dataUrl);
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
      const result = await api.takePicture();
      return result.dataUrl;
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
    retry,
  };
}
