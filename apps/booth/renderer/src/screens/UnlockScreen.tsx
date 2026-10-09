import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import UnlockView, { type UnlockMode, type UnlockStatus } from '../components/booth/UnlockView';
import {
  VOUCHER_ALPHABET,
  VOUCHER_LENGTH,
  parseVoucherPayload,
  redeemVoucher,
  type RedeemFailure,
} from '../lib/vouchers';

/** Back to the start screen after this long without any input. */
const IDLE_MS = 60_000;
/** A QR that just failed is ignored for this long (it is still in front of the lens). */
const SAME_CODE_COOLDOWN_MS = 4_000;
/** After this many failures in a row the booth pauses redemption for a while. */
const MAX_FAILS = 5;
const FAIL_PAUSE_MS = 30_000;
const SCAN_INTERVAL_MS = 160;

/**
 * Reads a QR from a picture (e.g. the voucher card saved on the guest's
 * phone). Tries a few scales: big photos decode faster and more reliably
 * downscaled, small screenshots need their full resolution.
 */
const decodeQrFromImage = async (file: File): Promise<string | null> => {
  const { default: jsQR } = await import('jsqr');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    for (const target of [1000, 1600, 600, longest]) {
      const scale = Math.min(1, target / longest);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (found?.data) return found.data;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Voucher gate in front of the session (Booth Setup -> Access -> Voucher).
 *
 * The guest holds their voucher QR up to the webcam, or types the code on the
 * keypad. A USB QR scanner that types like a keyboard works too: keystrokes
 * are collected and Enter submits. A valid code is consumed by the database
 * (single use) and the session starts.
 */
export const UnlockScreen: React.FC = () => {
  const { setScreen, unlockWithVoucher } = useSessionStore((state) => ({
    setScreen: state.setScreen,
    unlockWithVoucher: state.unlockWithVoucher,
  }));
  const scannerDeviceId = useBoothConfig((state) => state.access.scannerDeviceId);
  const active = useBoothAppearance((state) => state.appearance);
  const { copy, theme } = active;

  const [mode, setMode] = useState<UnlockMode>('scan');
  const [status, setStatus] = useState<UnlockStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cameraAvailable, setCameraAvailable] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const failsRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const lastFailedRef = useRef<{ code: string; at: number } | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);

  const goBack = useCallback(() => setScreen('CONTEXT_BUMPER'), [setScreen]);

  const touch = useCallback(() => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(goBack, IDLE_MS);
  }, [goBack]);

  useEffect(() => {
    touch();
    return () => {
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      if (messageTimerRef.current != null) window.clearTimeout(messageTimerRef.current);
    };
  }, [touch]);

  const showMessage = useCallback((text: string | null, clearAfterMs = 3500) => {
    setMessage(text);
    if (messageTimerRef.current != null) window.clearTimeout(messageTimerRef.current);
    if (text) messageTimerRef.current = window.setTimeout(() => setMessage(null), clearAfterMs);
  }, []);

  const failureText = useCallback(
    (reason: RedeemFailure) =>
      ({
        invalid: copy.unlockErrorInvalid,
        used: copy.unlockErrorUsed,
        expired: copy.unlockErrorExpired,
        rate_limited: copy.unlockErrorBusy,
        offline: copy.unlockErrorOffline,
      })[reason],
    [copy],
  );

  const submit = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      touch();
      const now = Date.now();
      if (now < pausedUntilRef.current) {
        showMessage(copy.unlockErrorBusy);
        return;
      }
      const parsed = parseVoucherPayload(raw);
      const last = lastFailedRef.current;
      if (parsed && last && last.code === parsed && now - last.at < SAME_CODE_COOLDOWN_MS) return;

      busyRef.current = true;
      setStatus('checking');
      setMessage(null);
      const result = await redeemVoucher(raw);
      if (result.ok) {
        setStatus('success');
        window.setTimeout(() => unlockWithVoucher(result.voucherId), 1100);
        return;
      }
      busyRef.current = false;
      setStatus('error');
      lastFailedRef.current = { code: parsed ?? raw, at: Date.now() };
      // Network trouble is not the guest's fault: do not count it.
      if (result.reason !== 'offline') failsRef.current += 1;
      if (failsRef.current >= MAX_FAILS) {
        failsRef.current = 0;
        pausedUntilRef.current = Date.now() + FAIL_PAUSE_MS;
        showMessage(copy.unlockErrorBusy, FAIL_PAUSE_MS);
      } else {
        showMessage(failureText(result.reason));
      }
      setCode('');
      window.setTimeout(() => setStatus((s) => (s === 'error' ? 'idle' : s)), 500);
    },
    [copy, failureText, showMessage, touch, unlockWithVoucher],
  );

  // ---- Webcam + QR decode loop (scan mode only) ----
  useEffect(() => {
    if (mode !== 'scan') return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const start = async () => {
      try {
        const video: MediaTrackConstraints = scannerDeviceId
          ? { deviceId: { exact: scannerDeviceId }, width: { ideal: 1280 } }
          : { facingMode: 'user', width: { ideal: 1280 } };
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch {
        if (cancelled) return;
        setCameraAvailable(false);
        setMode('type');
        showMessage(copy.unlockNoCamera, 6000);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        void el.play().catch(() => undefined);
      }
      // Loaded on demand so the decoder never weighs on open-access booths.
      const { default: jsQR } = await import('jsqr');
      const tick = () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (v && ctx && v.readyState >= 2 && !busyRef.current && v.videoWidth > 0) {
          // Decode a centered square at ~480px: fast, and matches the viewfinder.
          const side = Math.min(v.videoWidth, v.videoHeight);
          const size = Math.min(480, side);
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, size, size);
          const image = ctx.getImageData(0, 0, size, size);
          const found = jsQR(image.data, size, size, { inversionAttempts: 'attemptBoth' });
          if (found?.data) void submit(found.data);
        }
        timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    };
    void start();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode, scannerDeviceId, submit, copy.unlockNoCamera, showMessage]);

  // ---- Voucher picture picked from the device (gallery / files) ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onImagePicked = async (file: File | undefined) => {
    if (!file) return;
    touch();
    const data = await decodeQrFromImage(file);
    if (data) void submit(data);
    else showMessage(copy.unlockPickError);
  };

  // ---- Physical keyboard / USB QR scanner (types the payload + Enter) ----
  const typedRef = useRef('');
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      touch();
      if (event.key === 'Enter') {
        const payload = typedRef.current;
        typedRef.current = '';
        if (mode === 'type' && code.length === VOUCHER_LENGTH) void submit(code);
        else if (payload) void submit(payload);
        return;
      }
      if (event.key === 'Backspace') {
        setCode((c) => c.slice(0, -1));
        return;
      }
      if (event.key.length === 1) {
        typedRef.current = (typedRef.current + event.key).slice(-64);
        const char = event.key.toUpperCase();
        if (mode === 'type' && VOUCHER_ALPHABET.includes(char)) {
          setCode((c) => (c.length < VOUCHER_LENGTH ? c + char : c));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, code, submit, touch]);

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full" style={appearanceSurfaceStyle(active, theme.background)} onPointerDown={touch}>
      <UnlockView
        copy={copy}
        theme={theme}
        mode={mode}
        status={status}
        message={message}
        code={code}
        cameraAvailable={cameraAvailable}
        cameraFeed={
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
            // Mirrored like the capture preview; decoding reads the raw frame.
            style={{ transform: 'scaleX(-1)' }}
          />
        }
        onModeChange={(next) => {
          touch();
          setCode('');
          setMessage(null);
          setMode(next);
        }}
        onKey={(char) => setCode((c) => (c.length < VOUCHER_LENGTH ? c + char : c))}
        onBackspace={() => setCode((c) => c.slice(0, -1))}
        onSubmit={() => void submit(code)}
        onBack={goBack}
        // Only when the booth runs in a browser on the guest's phone/tablet:
        // on the Electron kiosk a file dialog would expose the booth PC's files.
        onPickImage={window.electronAPI ? undefined : () => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void onImagePicked(event.target.files?.[0]);
          // Allow picking the same file again after an error.
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default UnlockScreen;
