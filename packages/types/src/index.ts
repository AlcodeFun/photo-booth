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

export interface FrameConfig {
  id: string;
  name: string;
  previewUrl: string;
  theme: string;
}
