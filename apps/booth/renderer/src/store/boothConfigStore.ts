import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export interface BoothPrinterSettings {
  enabled: boolean;
  /** CUPS queue / printer name (e.g. SELPHY_CP1000). */
  queueName: string;
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

export interface BoothConfigState {
  flowMode: CaptureFlowMode;
  flow: CaptureFlowSettings;
  outputs: BoothOutputSettings;
  printer: BoothPrinterSettings;

  setFlowMode: (mode: CaptureFlowMode) => void;
  updateFlow: (patch: Partial<CaptureFlowSettings>) => void;
  updateOutputs: (patch: Partial<BoothOutputSettings>) => void;
  updatePrinter: (patch: Partial<BoothPrinterSettings>) => void;
  resetConfig: () => void;
}

/** Default snapshot used for reset. */
export const DEFAULT_BOOTH_CONFIG = {
  flowMode: 'retake' as CaptureFlowMode,
  flow: DEFAULT_FLOW_SETTINGS,
  outputs: DEFAULT_OUTPUTS,
  printer: DEFAULT_PRINTER,
};

export const useBoothConfig = create<BoothConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_BOOTH_CONFIG,

      setFlowMode: (flowMode) => set({ flowMode }),
      updateFlow: (flow) => set((state) => ({ flow: { ...state.flow, ...flow } })),
      updateOutputs: (outputs) => set((state) => ({ outputs: { ...state.outputs, ...outputs } })),
      updatePrinter: (printer) => set((state) => ({ printer: { ...state.printer, ...printer } })),
      resetConfig: () => set({ ...DEFAULT_BOOTH_CONFIG }),
    }),
    {
      name: 'photo-booth.setup',
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as { flow?: Record<string, unknown>; outputs?: Record<string, unknown> };
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
        return state as unknown as BoothConfigState;
      },
    },
  ),
);