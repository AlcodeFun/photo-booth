import React, { useEffect, useState } from 'react';
import { CameraCaptureResult, CameraStatus } from '@photo-booth/types';
import { usePhotoBoothCamera } from '../../hooks/usePhotoBoothCamera';

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

export const CameraSetupPanel: React.FC = () => {
  const canon = usePhotoBoothCamera();
  const [testPhoto, setTestPhoto] = useState<CameraCaptureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [mjpeg, setMjpeg] = useState<{ running: boolean; port: number }>({ running: false, port: 0 });
  const [mjpegBusy, setMjpegBusy] = useState(false);

  useEffect(() => {
    window.electronAPI?.camera?.mjpeg?.get?.().then(setMjpeg).catch(() => undefined);
  }, []);

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

  return (
    <div>
      {!canon.available && (
        <div className="mb-5 rounded-[10px] border-[3px] border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          No tethered camera is detected. Inside the booth this means no gphoto2-capable camera is
          connected over USB/PTP (ensure gphoto2 is installed / reachable and the camera is bound to
          the WinUSB driver). In a plain browser the hardware camera is unreachable — the simulated
          camera is used here instead.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-[12px] border-[3px] px-4 py-2 text-sm font-black uppercase tracking-[0.16em] ${statusStyle}`}>
          {statusLabel}
        </span>
        <div className="text-sm font-bold text-[#4d2d85]">
          Device: <span className="text-[#a35ef6]">{canon.model ?? 'Not detected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <div className="space-y-4">
          <div
            className="relative overflow-hidden rounded-[16px] border-[4px] border-[#a35ef6] bg-[#261640]"
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
            <div className="flex items-center gap-4 rounded-[12px] border-[3px] border-[#d9f85a] bg-[#f8ffd9] p-3">
              <img
                src={testPhoto.dataUrl}
                alt="Test capture"
                className="h-24 w-32 rounded-[8px] border-2 border-[#a35ef6] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black uppercase tracking-[0.14em] text-[#4d2d85]">Last Test Capture</div>
                <div className="mt-0.5 truncate text-xs font-semibold text-[#4d2d85]" title={testPhoto.filePath}>
                  Saved to: {testPhoto.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => setTestPhoto(null)}
                  className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#a35ef6] hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Actions</div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    setTestPhoto(null);
                    await canon.start();
                  })
                }
                className="w-full rounded-[10px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-[#4d2d85] disabled:opacity-50"
              >
                Test Connection / Start Live View
              </button>
              <button
                type="button"
                disabled={busy || canon.status === 'DISCONNECTED'}
                onClick={() => runAction(canon.stop)}
                className="w-full rounded-[10px] border-[3px] border-[#ff9ecb] bg-[#ffe0ef] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-[#b3206e] disabled:opacity-50"
              >
                Stop Live View
              </button>
              <button
                type="button"
                disabled={busy || canon.status !== 'LIVE_VIEW'}
                onClick={() =>
                  runAction(async () => {
                    const result = await canon.capture();
                    if (result) {
                      setTestPhoto(result);
                    }
                  })
                }
                className="w-full rounded-[10px] bg-[#ff4bb5] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                Take Test Picture
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    setTestPhoto(null);
                    await canon.retry();
                  })
                }
                className="w-full rounded-[10px] border-[3px] border-[#c9b8ff] bg-[#efe8ff] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-[#5b3aa8] disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          </div>

          <div className="rounded-[12px] border-[3px] border-[#c9b8ff] bg-[#faf7ff] p-4">
            <div className="mb-1 text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">How to test</div>
            <ol className="space-y-1.5 text-sm font-semibold text-[#4d2d85]">
              <li>1. Plug the Canon camera into USB and power it on.</li>
              <li>2. Press <span className="font-black text-[#a35ef6]">Test Connection</span>.</li>
              <li>3. Confirm the live view appears above.</li>
              <li>4. Press <span className="font-black text-[#ff4bb5]">Take Test Picture</span>.</li>
            </ol>
          </div>

          <div className="rounded-[12px] border-[3px] border-[#c9b8ff] bg-[#faf7ff] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">
                Virtual Camera Broadcast
              </div>
              <span
                className={`rounded-full border-2 px-2 py-0.5 text-[10px] font-black uppercase ${
                  mjpeg.running
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-slate-100 text-slate-500'
                }`}
              >
                {mjpeg.running ? 'On' : 'Off'}
              </span>
            </div>
            <p className="mb-3 text-xs font-semibold text-[#4d2d85]/85">
              Broadcasts the DSLR live view as an MJPEG stream — the Windows-native way to use the
              Canon as a webcam. Open the URL in any media player, or add it as an OBS{' '}
              <span className="font-black">Media Source</span> and press{' '}
              <span className="font-black">Start Virtual Camera</span> to expose it system-wide.
            </p>
            {mjpeg.running && mjpeg.port > 0 && (
              <div className="mb-3 rounded-[8px] border-2 border-dashed border-[#a35ef6] bg-[#f0e5ff] px-3 py-2 text-xs font-black tracking-wide text-[#5b3aa8]">
                http://127.0.0.1:{mjpeg.port}/feed.mjpeg
              </div>
            )}
            <button
              type="button"
              disabled={mjpegBusy}
              onClick={() =>
                void (async () => {
                  setMjpegBusy(true);
                  try {
                    const api = window.electronAPI?.camera?.mjpeg;
                    if (!api) {
                      return;
                    }
                    const next = mjpeg.running ? await api.stop() : await api.start();
                    setMjpeg(next);
                  } finally {
                    setMjpegBusy(false);
                  }
                })()
              }
              className={`w-full rounded-[10px] border-[3px] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] disabled:opacity-50 ${
                mjpeg.running
                  ? 'border-[#ff9ecb] bg-[#ffe0ef] text-[#b3206e]'
                  : 'border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85]'
              }`}
            >
              {mjpeg.running ? 'Stop Broadcast' : 'Start Broadcast'}
            </button>
          </div>
        </div>
      </div>

      {canon.error && (
        <div className="mt-6 rounded-[12px] border-[3px] border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {canon.error}
        </div>
      )}
    </div>
  );
};

export default CameraSetupPanel;