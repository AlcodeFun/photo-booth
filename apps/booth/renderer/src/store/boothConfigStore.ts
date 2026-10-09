import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CameraSettingKey, CameraSettingsValues } from '@photo-booth/types';

/**
 * Booth setup configuration (camera, printer, capture flow, outputs).
 *
 * Persisted to localStorage via zustand's persist middleware so settings
 * survive reloads and are shared between the booth flow and the admin set-up
 * screen. The future booth device runs on Ubuntu; printer settings target the
 * Canon Selphy CP1000 dye-sub printer through CUPS queues.
 */

export type CaptureFlowMode = 'retake' | 'timed' | 'auto';

export const CAPTURE_FLOW_LABELS: Record<CaptureFlowMode, string> = {
  retake: 'Retake per slot',
  timed: 'Timed unlimited session',
  auto: 'Continuous auto sequence',
};

/**
 * Camera behaviour + shooting settings of the tethered Canon EOS 600D.
 *
 * The values are raw gphoto2 choice tokens (`av`, `4`, `1/125`, `400`, …). The set-up
 * screen resolves them against the option lists the connected camera actually
 * reports, so a camera that does not offer one of them is simply skipped instead of
 * failing the whole write. Defaults are tuned for an indoor booth under fixed
 * light: aperture priority at f/4, ISO 400 (fixed, so exposure does not drift into
 * blurry high-ISO frames), fine JPEG, full resolution, evaluative metering and
 * One Shot AF as required for tethered `capture-image` focusing.
 */
export interface BoothCameraSettings {
  /** Detect the camera automatically and start live view when it is plugged in. */
  autoConnect: boolean;
  /** How often the camera port is polled for a hot-plugged device. */
  pollIntervalSeconds: number;
  exposureMode: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  exposureCompensation: string;
  whiteBalance: string;
  meteringMode: string;
  imageQuality: string;
  imageSize: string;
  pictureStyle: string;
  focusMode: string;
  driveMode: string;
  flashMode: string;
  autoPowerOff: string;
}

export const DEFAULT_CAMERA_SETTINGS: BoothCameraSettings = {
  autoConnect: true,
  pollIntervalSeconds: 5,
  exposureMode: 'av',
  aperture: '4',
  shutterSpeed: '1/125',
  iso: '400',
  exposureCompensation: '0',
  whiteBalance: 'auto',
  meteringMode: 'evaluative',
  imageQuality: 'fine',
  imageSize: 'large',
  pictureStyle: 'standard',
  focusMode: 'one-shot',
  driveMode: 'single',
  flashMode: 'off',
  autoPowerOff: 'off',
};

/** Shooting settings in the order the set-up screen shows them. */
const CAMERA_SETTING_KEYS: CameraSettingKey[] = [
  'exposureMode',
  'aperture',
  'shutterSpeed',
  'iso',
  'exposureCompensation',
  'whiteBalance',
  'meteringMode',
  'imageQuality',
  'imageSize',
  'pictureStyle',
  'focusMode',
  'driveMode',
  'flashMode',
  'autoPowerOff',
];

/** Drops the booth-only keys (auto-connect, poll interval) for the camera service. */
export const toCameraSettingValues = (camera: BoothCameraSettings): CameraSettingsValues => {
  const values: CameraSettingsValues = {};
  for (const key of CAMERA_SETTING_KEYS) {
    const value = camera[key];
    if (typeof value === 'string' && value !== '') {
      values[key] = value;
    }
  }
  return values;
};

export interface BoothOutputSettings {
  /** Static framed photo (framed.png + the physical print sheet). */
  framed: boolean;
  /** Individual raw photos. */
  allPhotos: boolean;
  /**
   * The quick looping GIF of the selected photos in capture order (result.gif).
   */
  gif: boolean;
  /**
   * The frammed "live photo" (result-live.gif) — each slot plays its recorded
   * live view clip inside the framed sheet. Sits alongside the static framed
   * photo and the animated GIF; each result is independently toggleable.
   */
  framedLive: boolean;
}

export const DEFAULT_OUTPUTS: BoothOutputSettings = {
  framed: true,
  allPhotos: true,
  gif: true,
  framedLive: true,
};

export type PrintMode = 'manual' | 'auto';

export interface BoothPrinterSettings {
  enabled: boolean;
  /** CUPS queue / printer name (e.g. SELPHY_CP1000). */
  queueName: string;
  /**
   * `manual` (default) stages each session as a queued print job the operator
   * releases from Admin → Print Queue (minimises wasted ribbon/paper). `auto`
   * submits each session to the printer immediately.
   */
  printMode: PrintMode;
  copies: number;
  /** CUPS page size (e.g. `100x148mm` for 4x6). */
  paperSize: string;
  /** CUPS media type (e.g. photo, photo-silk). */
  mediaType: string;
  /** CUPS print-quality (3=draft, 4=normal, 5=high). */
  quality: number;
  colorMode: 'color' | 'grayscale';
}

export const DEFAULT_PRINTER: BoothPrinterSettings = {
  enabled: false,
  queueName: '',
  printMode: 'manual',
  copies: 1,
  paperSize: '100x148mm',
  mediaType: 'photo',
  quality: 5,
  colorMode: 'color',
};

export interface CaptureFlowSettings {
  /** Flow 1: how many attempts per photo slot before "use photo" is forced. */
  maxAttempts: number;
  /** Flow 2: capture budget in seconds before the timed session ends. */
  timeBudgetSeconds: number;
  /** Flow 2: countdown (in seconds) before the timed session starts. */
  timedStartCountdown: number;
  /** All flows: countdown shown before each shot. In auto flow this IS the
   *  gap between captures — the next countdown begins the moment the
   *  previous photo lands, so the shot-to-shot gap equals the countdown. */
  shotCountdown: number;
}

export const DEFAULT_FLOW_SETTINGS: CaptureFlowSettings = {
  maxAttempts: 3,
  timeBudgetSeconds: 120,
  timedStartCountdown: 5,
  shotCountdown: 5,
};

/**
 * Who may start a session. 'open': anyone taps the start screen. 'voucher':
 * the start screen leads to the unlock screen and a single-use voucher
 * (scanned as a QR on the webcam, or typed) must be redeemed first.
 */
export type BoothAccessMode = 'open' | 'voucher';

export interface BoothAccessSettings {
  mode: BoothAccessMode;
  /** Webcam used to scan voucher QRs; null = the first camera found. */
  scannerDeviceId: string | null;
}

export const DEFAULT_ACCESS: BoothAccessSettings = {
  mode: 'open',
  scannerDeviceId: null,
};

export interface BoothConfigState {
  flowMode: CaptureFlowMode;
  flow: CaptureFlowSettings;
  outputs: BoothOutputSettings;
  printer: BoothPrinterSettings;
  camera: BoothCameraSettings;
  access: BoothAccessSettings;

  setFlowMode: (mode: CaptureFlowMode) => void;
  updateFlow: (patch: Partial<CaptureFlowSettings>) => void;
  updateOutputs: (patch: Partial<BoothOutputSettings>) => void;
  updatePrinter: (patch: Partial<BoothPrinterSettings>) => void;
  updateCamera: (patch: Partial<BoothCameraSettings>) => void;
  updateAccess: (patch: Partial<BoothAccessSettings>) => void;
  resetConfig: () => void;
}

/** Default snapshot used for reset. */
export const DEFAULT_BOOTH_CONFIG = {
  flowMode: 'retake' as CaptureFlowMode,
  flow: DEFAULT_FLOW_SETTINGS,
  outputs: DEFAULT_OUTPUTS,
  printer: DEFAULT_PRINTER,
  camera: DEFAULT_CAMERA_SETTINGS,
  access: DEFAULT_ACCESS,
};

export const useBoothConfig = create<BoothConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_BOOTH_CONFIG,

      setFlowMode: (flowMode) => set({ flowMode }),
      updateFlow: (flow) => set((state) => ({ flow: { ...state.flow, ...flow } })),
      updateOutputs: (outputs) => set((state) => ({ outputs: { ...state.outputs, ...outputs } })),
      updatePrinter: (printer) => set((state) => ({ printer: { ...state.printer, ...printer } })),
      updateCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
      updateAccess: (access) => set((state) => ({ access: { ...state.access, ...access } })),
      resetConfig: () => set({ ...DEFAULT_BOOTH_CONFIG }),
    }),
    {
      name: 'photo-booth.setup',
      version: 7,
      migrate: (persistedState, version) => {
        const state = persistedState as {
          flow?: Record<string, unknown>;
          outputs?: Record<string, unknown>;
          printer?: Record<string, unknown>;
          camera?: Record<string, unknown>;
          access?: Record<string, unknown>;
        };
        if (version < 2 && state.flow) {
          // Auto flow had a separate "gap between shots" — the countdown now
          // doubles as the gap, so drop the deprecated field.
          delete state.flow.sequenceGapSeconds;
        }
        if (version < 3 && state.outputs) {
          // v3 dropped the animated GIF in favor of the framed live photo.
          delete state.outputs.gif;
        }
        if (version < 4 && state.outputs && state.outputs.gif === undefined) {
          // v4 brings the animated GIF back as an independent output toggle.
          state.outputs.gif = true;
        }
        if (version < 5 && state.printer && state.printer.printMode === undefined) {
          // v5 adds the manual/auto print mode; default to manual (least waste).
          state.printer.printMode = 'manual';
        }
        if (version < 6) {
          // v6 adds the camera slice (auto-connect + 600D shooting settings).
          state.camera = { ...DEFAULT_CAMERA_SETTINGS, ...(state.camera ?? {}) };
        }
        if (version < 7) {
          // v7 adds the access slice (open vs voucher-locked booth).
          state.access = { ...DEFAULT_ACCESS, ...(state.access ?? {}) };
        }
        return state as unknown as BoothConfigState;
      },
    },
  ),
);