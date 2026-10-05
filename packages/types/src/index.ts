export interface PhotoAttempt {
  attemptNumber: number;
  localPath?: string;
  status: 'CAPTURED' | 'SELECTED' | 'RETAKEN';
  /**
   * A few seconds of live view frames captured just before this shot was taken
   * (downscaled JPEG data URLs). When present, the framed "live photo" result
   * animates each slot with its own recorded clip instead of a static image.
   */
  liveFrames?: string[];
}

export interface PhotoSlotState {
  slotNumber: number;
  maxAttempts: number;
  attempts: PhotoAttempt[];
  selectedAttempt?: number;
}

export interface BoothSessionState {
  sessionId: string;
  layoutId?: string;
  frameId?: string;
  filterId?: string;
  currentPhotoSlot: number;
  photoSlots: PhotoSlotState[];
  status: string;
}

export interface LayoutConfig {
  id: string;
  name: string;
  photoSlots: number;
  aspectRatio: string;
  previewUrl: string;
}

export type FramePhotoFit = 'cover' | 'contain';

export interface FramePhotoPlacement {
  slotNumber: number;
  sourcePhotoSlot?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
  zIndex?: number;
  objectFit?: FramePhotoFit;
  objectPosition?: string;
  photoScale?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
}

export interface FrameQRPlacement {
  slotNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
  zIndex?: number;
}

export interface FrameTemplateConfig {
  assetUrl: string;
  width: number;
  height: number;
  backgroundColor?: string;
  frameLayerZIndex?: number;
  photoSlots: FramePhotoPlacement[];
  qrSlots?: FrameQRPlacement[];
}

export interface FrameConfig {
  id: string;
  name: string;
  previewUrl: string;
  photoSlots?: number;
  template?: FrameTemplateConfig;
  templatesByPhotoSlots?: Partial<Record<number, FrameTemplateConfig>>;
}

export type CameraStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LIVE_VIEW'
  | 'CAPTURING'
  | 'READY'
  | 'ERROR';

export interface CameraInfo {
  model: string | null;
  connected: boolean;
}

export interface CameraLiveFrame {
  /** Raw JPEG bytes of the frame (transferred via structured clone over IPC). */
  frame: Uint8Array;
  timestamp: number;
}

export interface CameraCaptureResult {
  dataUrl: string;
  /** Absolute path where the full-res original was persisted on disk. */
  filePath: string;
}

export interface CameraStatePayload {
  status: CameraStatus;
  info?: CameraInfo;
  error?: string;
}

/**
 * Configurable shooting settings of the tethered camera, keyed by a stable
 * camelCase name. The gphoto2 config path behind each key lives in the Electron
 * camera service (the renderer only deals in keys + values).
 */
export type CameraSettingKey =
  | 'exposureMode'
  | 'aperture'
  | 'shutterSpeed'
  | 'iso'
  | 'exposureCompensation'
  | 'whiteBalance'
  | 'meteringMode'
  | 'imageQuality'
  | 'imageSize'
  | 'pictureStyle'
  | 'focusMode'
  | 'driveMode'
  | 'flashMode'
  | 'autoPowerOff';

/** One `Key: Label` choice reported by the camera for a setting. */
export interface CameraSettingOption {
  /** Value written back with `--set-config <path>=<value>`. */
  value: string;
  /** Human label as printed by the camera (falls back to the raw value). */
  label: string;
}

export interface CameraSettingState {
  key: CameraSettingKey;
  label: string;
  /** Every value this camera offers for the setting, in menu order. */
  options: CameraSettingOption[];
  /** Last value the camera service pushed to the hardware (null = never). */
  applied: string | null;
  /** Set when the camera could not be queried for this setting. */
  error?: string;
}

/** Values to push to the camera; empty/undefined keys are left untouched. */
export type CameraSettingsValues = Partial<Record<CameraSettingKey, string>>;

export interface CameraSettingsSnapshot {
  model: string | null;
  items: CameraSettingState[];
}

export interface CameraSettingChange {
  key: CameraSettingKey;
  value: string;
}

export interface CameraSettingFailure extends CameraSettingChange {
  error: string;
}

export interface CameraSettingsApplyResult {
  ok: boolean;
  applied: CameraSettingChange[];
  /** Values the connected camera does not offer (nothing was written). */
  skipped: CameraSettingChange[];
  failed: CameraSettingFailure[];
  /** Freshly read state after applying, so the UI can show what stuck. */
  snapshot?: CameraSettingsSnapshot;
  /** Set when the whole operation failed (no camera / gphoto2 missing). */
  error?: string;
}

/** Renderer → main configuration pushed whenever the booth setup changes. */
export interface CameraAutoConfig {
  /** Auto-detect + re-apply settings + start live view when a camera appears. */
  autoConnect: boolean;
  /** How often the camera port is polled for a hot-plugged device. */
  pollIntervalSeconds: number;
  /** Settings re-applied every time the camera is (re)connected. */
  settings: CameraSettingsValues;
}

export interface CameraAutoConfigResult {
  autoConnect: boolean;
  pollIntervalSeconds: number;
}
