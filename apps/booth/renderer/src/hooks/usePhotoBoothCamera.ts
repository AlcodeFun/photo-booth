import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraLiveFrame,
  CameraStatePayload,
  CameraStatus,
} from '@photo-booth/types';
import { toCameraSettingValues, useBoothConfig } from '../store/boothConfigStore';

/**
 * Provides access to the Canon DSLR bridge exposed by the Electron main process.
 *
 * When running in a plain browser (no preload / no main-process camera bridge),
 * `available` is false and callers should fall back to the WebRTC capture path.
 *
 * The hook also pushes the booth's camera configuration (auto-connect, poll
 * interval and the shooting settings) to the main process, so the hot-plug
 * behaviour is identical in the booth flow and on the set-up screen.
 */
function cameraIsAvailable(payload: CameraStatePayload): boolean {
  return Boolean(payload.info?.model) && payload.status !== 'ERROR' && payload.status !== 'DISCONNECTED';
}

export function usePhotoBoothCamera() {
  const api = window.electronAPI?.camera;
  const camera = useBoothConfig((state) => state.camera);
  const settings = useMemo(() => toCameraSettingValues(camera), [camera]);

  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<CameraStatus>('DISCONNECTED');
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const liveFrameUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // `configure` only exists on a main process that knows about camera settings
    // (an Electron build from before the hot-plug feature still works without it).
    if (typeof api?.configure !== 'function') {
      return;
    }
    api
      .configure({
        autoConnect: camera.autoConnect,
        pollIntervalSeconds: camera.pollIntervalSeconds,
        settings,
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [api, camera.autoConnect, camera.pollIntervalSeconds, settings]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const unsubStatus = api.onStatus((payload: CameraStatePayload) => {
      setStatus(payload.status);
      setError(payload.error ?? null);
      setModel(payload.info?.model ?? null);
      setAvailable(cameraIsAvailable(payload));
      if (payload.status === 'DISCONNECTED' || payload.status === 'ERROR') {
        if (liveFrameUrlRef.current !== null) {
          URL.revokeObjectURL(liveFrameUrlRef.current);
          liveFrameUrlRef.current = null;
        }
        setLiveFrame(null);
      }
    });
    const unsubLive = api.onLiveView((frame: CameraLiveFrame) => {
      if (liveFrameUrlRef.current !== null) {
        URL.revokeObjectURL(liveFrameUrlRef.current);
      }
      const frameBytes = new Uint8Array(frame.frame.length);
      frameBytes.set(frame.frame);
      liveFrameUrlRef.current = URL.createObjectURL(new Blob([frameBytes], { type: 'image/jpeg' }));
      setLiveFrame(liveFrameUrlRef.current);
    });

    api
      .getStatus()
      .then((payload) => {
        const nextModel = payload.info?.model ?? null;
        setStatus(payload.status);
        setError(payload.error ?? null);
        setModel(nextModel);
        setAvailable(cameraIsAvailable(payload));
      })
      .catch((err) => setError(String(err)));

    return () => {
      unsubStatus();
      unsubLive();
      if (liveFrameUrlRef.current !== null) {
        URL.revokeObjectURL(liveFrameUrlRef.current);
        liveFrameUrlRef.current = null;
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
      setAvailable(cameraIsAvailable(payload));
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
      setModel(payload.info?.model ?? null);
      setAvailable(cameraIsAvailable(payload));
      if (liveFrameUrlRef.current !== null) {
        URL.revokeObjectURL(liveFrameUrlRef.current);
        liveFrameUrlRef.current = null;
        setLiveFrame(null);
      }
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
      setAvailable(cameraIsAvailable(payload));
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
