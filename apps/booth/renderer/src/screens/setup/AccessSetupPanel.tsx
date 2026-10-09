import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoothConfig, type BoothAccessMode, type BoothAccessSettings } from '../../store/boothConfigStore';
import { formatVoucherCode, parseVoucherPayload } from '../../lib/vouchers';

const MODE_OPTIONS: Array<{ mode: BoothAccessMode; icon: string; title: string; description: string }> = [
  {
    mode: 'open',
    icon: '🔓',
    title: 'Open access',
    description: 'Anyone can tap the start screen and begin a session. Use it for free events or when staff run the booth.',
  },
  {
    mode: 'voucher',
    icon: '🎟️',
    title: 'Voucher required',
    description:
      'The start screen leads to a scan screen. Guests show a voucher QR to the webcam (or type the code). Each voucher starts exactly one session.',
  },
];

/**
 * Booth Setup -> Access. Per-device setting: whether this booth needs a
 * voucher, and which webcam reads the voucher QR. Codes themselves are created
 * in the admin dashboard (Voucher) and validated by the database.
 */
export const AccessSetupPanel: React.FC = () => {
  const access = useBoothConfig((state) => state.access);
  const updateAccess = useBoothConfig((state) => state.updateAccess);

  const [draft, setDraft] = useState<BoothAccessSettings>(access);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [detected, setDetected] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setDraft(access), [access]);

  const dirty = useMemo(
    () => draft.mode !== access.mode || draft.scannerDeviceId !== access.scannerDeviceId,
    [draft, access],
  );

  // Live test of the scan webcam: shows the feed and any voucher QR it reads
  // (nothing is redeemed here).
  useEffect(() => {
    if (draft.mode !== 'voucher') return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    setCameraError(null);
    setDetected(null);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: draft.scannerDeviceId ? { deviceId: { exact: draft.scannerDeviceId } } : { facingMode: 'user' },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) setCameraError(error instanceof Error ? error.message : 'Camera unavailable');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // Labels are only filled in once camera permission was granted.
      setCameras((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      const { default: jsQR } = await import('jsqr');
      const tick = () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
          const side = Math.min(v.videoWidth, v.videoHeight);
          const size = Math.min(480, side);
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, size, size);
          const found = jsQR(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: 'attemptBoth' });
          if (found?.data) setDetected(found.data);
        }
        timer = window.setTimeout(tick, 250);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [draft.mode, draft.scannerDeviceId]);

  const detectedCode = detected ? parseVoucherPayload(detected) : null;

  const save = () => {
    updateAccess(draft);
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const selected = draft.mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, mode: option.mode }))}
              className={`rounded-[14px] border-[4px] p-4 text-left transition-all ${
                selected ? 'border-pbx-accent bg-pbx-paper' : 'border-pbx-secondary bg-pbx-paper hover:border-pbx-accent'
              }`}
            >
              <div className="mb-2 text-2xl">{option.icon}</div>
              <div className="text-sm font-black uppercase tracking-[0.12em] text-pbx-ink">{option.title}</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-pbx-ink/80">{option.description}</p>
              <div
                className={`mt-3 inline-block rounded-full px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.14em] ${
                  selected ? 'bg-pbx-accent text-pbx-accent-fg' : 'bg-pbx-tint text-pbx-secondary-strong'
                }`}
              >
                {selected ? 'Selected' : 'Select'}
              </div>
            </button>
          );
        })}
      </div>

      {draft.mode === 'voucher' && (
        <div className="grid grid-cols-1 gap-4 rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-3">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">Scan webcam</div>
            <select
              value={draft.scannerDeviceId ?? ''}
              onChange={(event) => setDraft((d) => ({ ...d, scannerDeviceId: event.target.value || null }))}
              className="w-full rounded-[10px] border-[3px] border-pbx-secondary bg-white px-3 py-2 text-sm font-bold text-pbx-ink"
            >
              <option value="">Automatic (first camera)</option>
              {cameras.map((camera, i) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
            <p className="text-xs font-semibold leading-relaxed text-pbx-ink/75">
              Hold a voucher QR up to the camera to test it. Nothing is used up here. A USB QR scanner that types
              like a keyboard also works on the booth&apos;s scan screen.
            </p>
            <div
              className={`rounded-[10px] border-[3px] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                detectedCode
                  ? 'border-[#2e9e4f] bg-[#e7f6ec] text-[#1f7a3b]'
                  : detected
                    ? 'border-pbx-brand bg-pbx-brand-tint text-pbx-brand-strong'
                    : 'border-pbx-line bg-white text-pbx-ink/60'
              }`}
            >
              {detectedCode
                ? `✓ Voucher QR read: ${formatVoucherCode(detectedCode)}`
                : detected
                  ? 'QR read, but it is not a voucher code'
                  : cameraError
                    ? `Camera error: ${cameraError}`
                    : 'Waiting for a QR…'}
            </div>
            <p className="text-xs font-semibold text-pbx-ink/75">
              Create and print vouchers in the admin dashboard → <b>Voucher</b>.
            </p>
          </div>
          <div className="aspect-square overflow-hidden rounded-[12px] border-[3px] border-pbx-ink bg-pbx-ink">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-[12px] border-[3px] border-pbx-brand bg-pbx-brand-tint px-4 py-3">
        <div className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-pbx-ink">
          {dirty ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-pbx-brand shadow-[0_0_6px_rgb(var(--pbx-brand-rgb)/0.8)]" />
              Unsaved changes
            </>
          ) : savedAt ? (
            <span className="text-[#2e9e4f]">✓ Saved at {savedAt}</span>
          ) : (
            <span className="text-pbx-ink/60">
              Currently: {access.mode === 'voucher' ? 'voucher required' : 'open access'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDraft(access)}
          disabled={!dirty}
          className={`rounded-[10px] border-[3px] px-5 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.16em] transition-all ${
            dirty
              ? 'border-pbx-secondary bg-white text-pbx-ink hover:-translate-y-0.5 active:translate-y-0'
              : 'cursor-not-allowed border-pbx-line bg-white/60 text-pbx-ink-muted'
          }`}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={`rounded-[10px] px-5 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.16em] text-white transition-all ${
            dirty
              ? 'bg-pbx-brand shadow-[0_4px_0_rgba(122,43,140,0.45)] hover:-translate-y-0.5 active:translate-y-0'
              : 'cursor-not-allowed bg-pbx-ink-muted opacity-70'
          }`}
        >
          Save access
        </button>
      </div>
    </div>
  );
};

export default AccessSetupPanel;
