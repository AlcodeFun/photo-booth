import React, { useEffect, useMemo, useState } from 'react';
import { CameraCaptureResult, CameraStatus } from '@photo-booth/types';
import { usePhotoBoothCamera } from '../../hooks/usePhotoBoothCamera';
import { useCameraSettings } from '../../hooks/useCameraSettings';
import { OptionStepper, NumberStepper } from '../../components/fields/Stepper';
import { useBoothConfig } from '../../store/boothConfigStore';

const STATUS_STYLES: Record<CameraStatus, string> = {
  DISCONNECTED: 'border-rose-400 bg-rose-50 text-rose-700',
  CONNECTING: 'border-amber-400 bg-amber-50 text-amber-700',
  LIVE_VIEW: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  CAPTURING: 'border-sky-400 bg-sky-50 text-sky-700',
  READY: 'border-violet-400 bg-violet-50 text-violet-700',
  ERROR: 'border-rose-400 bg-rose-50 text-rose-700',
};

const STATUS_LABELS: Record<CameraStatus, string> = {
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting',
  LIVE_VIEW: 'Live View Active',
  CAPTURING: 'Capturing…',
  READY: 'Ready',
  ERROR: 'Error',
};

/** Settings shown first (the ones a booth operator tweaks most). */
const PRIMARY_SETTINGS: Array<{ key: 'iso' | 'aperture' | 'shutterSpeed' | 'whiteBalance' | 'exposureCompensation' }> = [
  { key: 'iso' },
  { key: 'aperture' },
  { key: 'shutterSpeed' },
  { key: 'whiteBalance' },
  { key: 'exposureCompensation' },
];

/** Everything else that the connected camera might expose. */
const SECONDARY_SETTINGS: Array<{ key: 'exposureMode' | 'meteringMode' | 'imageQuality' | 'imageSize' | 'pictureStyle' | 'focusMode' | 'driveMode' | 'flashMode' | 'autoPowerOff' }> = [
  { key: 'exposureMode' },
  { key: 'meteringMode' },
  { key: 'imageQuality' },
  { key: 'imageSize' },
  { key: 'pictureStyle' },
  { key: 'focusMode' },
  { key: 'driveMode' },
  { key: 'flashMode' },
  { key: 'autoPowerOff' },
];

const SETTING_LABELS: Record<string, string> = {
  exposureMode: 'Exposure mode',
  aperture: 'Aperture',
  shutterSpeed: 'Shutter speed',
  iso: 'ISO',
  exposureCompensation: 'Exposure comp.',
  whiteBalance: 'White balance',
  meteringMode: 'Metering mode',
  imageQuality: 'Image quality',
  imageSize: 'Image size',
  pictureStyle: 'Picture style',
  focusMode: 'Focus mode',
  driveMode: 'Drive mode',
  flashMode: 'Flash mode',
  autoPowerOff: 'Auto power off',
};

export const CameraSetupPanel: React.FC = () => {
  const canon = usePhotoBoothCamera();
  const camera = useBoothConfig((state) => state.camera);
  const updateCamera = useBoothConfig((state) => state.updateCamera);
  const { optionsByKey, loading, busy: settingsBusy, result, error: settingsError, supported, apply } =
    useCameraSettings(canon.status);

  const [testPhoto, setTestPhoto] = useState<CameraCaptureResult | null>(null);
  const [busy, setBusy] = useState(false);

  const statusStyle = STATUS_STYLES[canon.status] ?? STATUS_STYLES.DISCONNECTED;
  const statusLabel = STATUS_LABELS[canon.status] ?? canon.status;

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (result?.applied.length) {
      // Refetch options after applying so labels show the camera's new state.
      void (async () => {
        try {
          await apply({});
        } catch (err) {
      // eslint-disable-next-line no-console
        console.warn('Failed to refresh camera settings after apply', err);
        }
      })();
    }
  }, [result, apply]);

  const missing = useMemo(
    () =>
      result
        ? result.skipped.map((item) => `${SETTING_LABELS[item.key] ?? item.key}: ${item.value}`)
        : [],
    [result],
  );

  return (
    <div>
      {!canon.available && canon.status !== 'LIVE_VIEW' && (
        <div className="mb-5 rounded-[10px] border-[3px] border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          No tethered camera is detected. Turn on the EOS 600D, connect it over USB and let the booth
          auto-connect. If it is already connected, press Test Connection / Start Live View.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-[12px] border-[3px] px-4 py-2 text-sm font-black uppercase tracking-[0.16em] ${statusStyle}`}>
          {statusLabel}
        </span>
        <div className="text-sm font-bold text-pbx-ink">
          Device: <span className="text-pbx-secondary">{canon.model ?? 'Not detected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <div className="space-y-4">
          <div
            className="relative overflow-hidden rounded-[16px] border-[4px] border-pbx-ui-secondary bg-pbx-ui-raised"
            style={{ aspectRatio: '4 / 3' }}
          >
            {canon.liveFrame ? (
              <img
                src={canon.liveFrame}
                alt="Live view"
                className="absolute inset-0 h-full w-full object-cover select-none"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] text-white/70">
                No live view
              </div>
            )}
            {canon.status === 'CAPTURING' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-black uppercase tracking-[0.2em] text-white">
                Capturing…
              </div>
            )}
          </div>

          {testPhoto && (
            <div className="flex items-center gap-4 rounded-[12px] border-[3px] border-pbx-tertiary bg-pbx-tertiary-soft p-3">
              <img
                src={testPhoto.dataUrl}
                alt="Test capture"
                className="h-24 w-32 rounded-[8px] border-2 border-pbx-secondary object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black uppercase tracking-[0.14em] text-pbx-ink">Last Test Capture</div>
                <div className="mt-0.5 truncate text-xs font-semibold text-pbx-ink" title={testPhoto.filePath}>
                  Saved to: {testPhoto.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => setTestPhoto(null)}
                  className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-pbx-secondary hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">
                Auto-connect &amp; poll interval
              </div>
              <span className="rounded-full bg-pbx-ui-accent px-3 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-white">
                {camera.autoConnect ? 'Auto' : 'Manual'}
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={camera.autoConnect}
                onChange={(e) => updateCamera({ autoConnect: e.target.checked })}
                className="h-5 w-5 accent-pbx-accent"
              />
              <span className="text-sm font-bold text-pbx-ink">
                Auto-connect camera when plugged in (start live view + re-apply settings)
              </span>
            </label>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberStepper
                label="Poll interval"
                value={camera.pollIntervalSeconds}
                min={2}
                max={30}
                step={1}
                suffix="s"
                disabled={!camera.autoConnect}
                onChange={(pollIntervalSeconds) => updateCamera({ pollIntervalSeconds })}
                hint="How often the booth checks for a hot-plugged camera."
              />
            </div>
          </div>

          <div className="rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">Camera settings</div>
              <div className="flex items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-pbx-secondary-strong">
                {loading ? 'Loading…' : supported ? 'Live from gphoto2' : 'No camera options'}
                {settingsBusy && <span className="ml-1 h-2.5 w-2.5 rounded-full bg-pbx-brand" />}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRIMARY_SETTINGS.map((item) => (
                <OptionStepper
                  key={item.key}
                  label={SETTING_LABELS[item.key]}
                  value={String(camera[item.key] ?? '')}
                  options={optionsByKey.get(item.key)?.options ?? []}
onChange={(next) => updateCamera({ [item.key]: next } as unknown as Partial<typeof camera>)}
                  disabled={optionsByKey.get(item.key)?.options.length === 0}
                />
              ))}
            </div>

            <div className="mt-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-pbx-ink">More settings</div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SECONDARY_SETTINGS.map((item) => (
                  <OptionStepper
                    key={item.key}
                    label={SETTING_LABELS[item.key]}
                    value={String(camera[item.key] ?? '')}
                    options={optionsByKey.get(item.key)?.options ?? []}
onChange={(next) => updateCamera({ [item.key]: next } as unknown as Partial<typeof camera>)}
                    disabled={optionsByKey.get(item.key)?.options.length === 0}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-pbx-ink/70">
              <span>Apply writes them to the camera and pauses/restarts live view briefly.</span>
              <button
                type="button"
                onClick={() => runAction(async () => apply({}))}
                disabled={busy || settingsBusy}
                className="rounded-[8px] border-[3px] border-pbx-secondary bg-pbx-tertiary px-4 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.12em] text-pbx-tertiary-fg disabled:opacity-50"
              >
                {settingsBusy ? 'Applying…' : 'Refresh options & re-apply'}
              </button>
            </div>

            {missing.length > 0 && (
              <div className="mt-3 rounded-[8px] border-2 border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                Not set (not offered by this camera): {missing.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">Actions</div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy || settingsBusy}
                onClick={() =>
                  runAction(async () => {
                    setTestPhoto(null);
                    await canon.start();
                  })
                }
                className="w-full rounded-[10px] border-[3px] border-pbx-secondary bg-pbx-tertiary px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-pbx-tertiary-fg disabled:opacity-50"
              >
                Test Connection / Start Live View
              </button>
              <button
                type="button"
                disabled={busy || settingsBusy || canon.status === 'DISCONNECTED'}
                onClick={() => runAction(canon.stop)}
                className="w-full rounded-[10px] border-[3px] border-pbx-brand-soft bg-pbx-brand-tint px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-pbx-brand-strong disabled:opacity-50"
              >
                Stop Live View
              </button>
              <button
                type="button"
                disabled={busy || settingsBusy || canon.status !== 'LIVE_VIEW'}
                onClick={() =>
                  runAction(async () => {
                    const result = await canon.capture();
                    if (result) {
                      setTestPhoto(result);
                    }
                  })
                }
                className="w-full rounded-[10px] bg-pbx-ui-brand px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-pbx-ui-brand-fg disabled:opacity-50"
              >
                Take Test Picture
              </button>
              <button
                type="button"
                disabled={busy || settingsBusy}
                onClick={() =>
                  runAction(async () => {
                    setTestPhoto(null);
                    await canon.retry();
                  })
                }
                className="w-full rounded-[10px] border-[3px] border-pbx-line bg-pbx-tint px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-pbx-secondary-strong disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          </div>

          <div className="rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4">
            <div className="mb-1 text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">How to test</div>
            <ol className="space-y-1.5 text-sm font-semibold text-pbx-ink">
              <li>1. Plug the Canon camera into USB and power it on.</li>
              <li>2. Leave Auto-connect on, or press <span className="font-black text-pbx-secondary">Test Connection</span>.</li>
              <li>3. Confirm the live view appears above.</li>
              <li>4. Pick ISO / aperture / shutter speed (values pulled live from gphoto2).</li>
              <li>5. Press <span className="font-black text-pbx-brand">Take Test Picture</span>.</li>
            </ol>
          </div>
        </div>
      </div>

      {(canon.error || settingsError) && (
        <div className="mt-6 rounded-[12px] border-[3px] border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {canon.error || settingsError}
        </div>
      )}
    </div>
  );
};

export default CameraSetupPanel;