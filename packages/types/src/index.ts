export interface PhotoAttempt {
  attemptNumber: number;
  localPath?: string;
  status: 'CAPTURED' | 'SELECTED' | 'RETAKEN';
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
}

export interface FrameTemplateConfig {
  assetUrl: string;
  width: number;
  height: number;
  backgroundColor?: string;
  frameLayerZIndex?: number;
  photoSlots: FramePhotoPlacement[];
}

export interface FrameConfig {
  id: string;
  name: string;
  previewUrl: string;
  theme: string;
  photoSlots?: number;
  template?: FrameTemplateConfig;
  templatesByPhotoSlots?: Partial<Record<number, FrameTemplateConfig>>;
}
