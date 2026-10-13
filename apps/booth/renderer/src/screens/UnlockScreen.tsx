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
import { createVideoQrScanner, decodeQrFromFile } from '../lib/qrDecode';

/** Back to the start screen after this long without any input. */
const IDLE_MS = 60_000;
/** A QR that just failed is ignored for this long (it is still in front of the lens). */
const SAME_CODE_COOLDOWN_MS = 4_000;
/** After this many failures in a row the booth pauses redemption for a while. */
const MAX_FAILS = 5;
const FAIL_PAUSE_MS = 30_000;
const SCAN_INTERVAL_MS = 160;
/** Camera names phones / tablets give their rear and front cameras (incl. Indonesian). */
const BACK_CAMERA_RE = /back|rear|environment|belakang|facing back/i;
const FRONT_CAMERA_RE = /front|user|depan|facing front|selfie/i;

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

  // ---- Camera + QR decode loop (scan mode only) ----
  // facing / deviceOverride change when the guest taps "switch camera".
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [deviceOverride, setDeviceOverride] = useState<string | null>(null);
  const [switched, setSwitched] = useState(false);
  const [hasBackCamera, setHasBackCamera] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (mode !== 'scan') return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const scan = createVideoQrScanner();
    const base: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const open = (video: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video, audio: false });

    const start = async () => {
      // Guest's pick first, then the camera chosen in Booth Setup, then the
      // requested side. A saved camera that is gone (unplugged, or the browser
      // renamed its id) falls back to any camera instead of giving up.
      const preferred: MediaTrackConstraints = deviceOverride
        ? { ...base, deviceId: { exact: deviceOverride } }
        : scannerDeviceId && !switched
          ? { ...base, deviceId: { exact: scannerDeviceId } }
          : { ...base, facingMode: { ideal: facing } };
      try {
        stream = await open(preferred).catch(() => open(base)).catch(() => open({}));
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
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const reported = track?.getSettings().facingMode;
      // Some browsers do not report facingMode: then trust the side we asked for.
      const onBack = reported ? reported === 'environment' : (switched || !scannerDeviceId) && facing === 'environment';
      // Mirror the selfie view only; a back camera shows the world as it is.
      setMirrored(!onBack);
      // The switch is only offered when there is a back camera to switch to
      // (phones / tablets); a PC's webcams never show it.
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (cancelled) return;
          const back = devices.some((d) => d.kind === 'videoinput' && BACK_CAMERA_RE.test(d.label));
          setHasBackCamera(back || onBack);
        })
        .catch(() => undefined);
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        void el.play().catch(() => undefined);
      }
      const tick = async () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (v && !busyRef.current) {
          const found = await scan(v).catch(() => null);
          if (found && !cancelled) void submit(found);
        }
        if (!cancelled) timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
      };
      void tick();
    };
    void start();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
    };
  }, [mode, scannerDeviceId, facing, deviceOverride, switched, submit, copy.unlockNoCamera, showMessage]);

  /** Front <-> back (only offered when the device has a back camera). */
  const switchCamera = useCallback(async () => {
    touch();
    setSwitched(true);
    const settings = trackRef.current?.getSettings();
    const current = settings?.facingMode ?? (mirrored ? 'user' : 'environment');
    const next = current === 'environment' ? 'user' : 'environment';
    setFacing(next);
    if (settings?.facingMode) {
      // The browser understands facingMode: asking for the side is enough.
      setDeviceOverride(null);
      return;
    }
    // Otherwise pick the camera by its name.
    const cameras = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
    const target = cameras.find((d) => (next === 'environment' ? BACK_CAMERA_RE : FRONT_CAMERA_RE).test(d.label));
    setDeviceOverride(target?.deviceId ?? null);
  }, [touch, mirrored]);

  // ---- Voucher picture picked from the device (gallery / files) ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const onImagePicked = async (file: File | undefined) => {
    if (!file) return;
    touch();
    // Big photos take a moment on older phones: show it, and pause the camera
    // scan so it cannot submit at the same time.
    setPicking(true);
    busyRef.current = true;
    let data: string | null = null;
    try {
      data = await decodeQrFromFile(file);
    } finally {
      busyRef.current = false;
      setPicking(false);
    }
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
            // Selfie camera mirrored like the capture preview; decoding reads the raw frame.
            style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
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
        onSwitchCamera={hasBackCamera ? () => void switchCamera() : undefined}
        picking={picking}
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
