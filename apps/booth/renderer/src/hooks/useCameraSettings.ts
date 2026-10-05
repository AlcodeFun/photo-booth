import { useCallback, useEffect, useState } from 'react';
import {
  CameraSettingsApplyResult,
  CameraSettingsSnapshot,
  CameraSettingsValues,
  CameraStatus,
} from '@photo-booth/types';

/**
 * Reads the settings the tethered camera offers and pushes changes to it.
 *
 * Auto-connect/poll configuration is pushed by `usePhotoBoothCamera` (so it is
 * active in the booth flow too); this hook only owns the read/apply cycle of the
 * camera set-up screen. Every camera round-trip pauses live view for a moment, so
 * the calls are serialized here and `busy` is exposed for the button states.
 */
export function useCameraSettings(status: CameraStatus) {
  const api = window.electronAPI?.camera;
  const supported =
    typeof api?.getSettings === 'function' && typeof api?.applySettings === 'function';

  const [snapshot, setSnapshot] = useState<CameraSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CameraSettingsApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // CONNECTING/LIVE_VIEW/CAPTURING all mean "the camera is reachable"; only a
  // real disconnect (or error) should trigger a fresh read.
  const reachable = status !== 'DISCONNECTED' && status !== 'ERROR';

  const refresh = useCallback(async () => {
    if (!supported || !api) {
      return null;
    }
    setLoading(true);
    try {
      const next = await api.getSettings();
      setSnapshot(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, supported]);

  useEffect(() => {
    if (!supported || !api || !reachable) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getSettings()
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, reachable]);

  const apply = useCallback(
    async (settings: CameraSettingsValues) => {
      if (!supported || !api) {
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        const next = await api.applySettings(settings);
        setResult(next);
        if (next.snapshot) {
          setSnapshot(next.snapshot);
        }
        if (next.error) {
          setError(next.error);
        }
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, supported],
  );

  return {
    snapshot,
    optionsByKey: new Map((snapshot?.items ?? []).map((item) => [item.key, item])),
    loading,
    busy,
    result,
    error,
    supported,
    reachable,
    refresh,
    apply,
  };
}