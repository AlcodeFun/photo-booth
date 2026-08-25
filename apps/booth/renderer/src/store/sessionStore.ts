import { create } from 'zustand';
import {
  PhotoSlotState,
  PhotoAttempt,
  LayoutConfig,
  FrameConfig,
} from '@photo-booth/types';

export type ScreenName =
  | 'MANUAL_PAYMENT'
  | 'TUTORIAL'
  | 'SELECT_LAYOUT'
  | 'SELECT_FRAME'
  | 'READY'
  | 'PHOTO_CAPTURE'
  | 'PHOTO_REVIEW'
  | 'FINAL_PREVIEW'
  | 'PRINT_QR'
  | 'COMPLETE';

export interface SessionStore {
  // Screen Router State
  currentScreen: ScreenName;
  setScreen: (screen: ScreenName) => void;

  // Session State Data
  sessionId: string | null;
  layout: LayoutConfig | null;
  frame: FrameConfig | null;
  currentPhotoSlot: number; // 1-indexed (e.g. slot 1, 2, 3)
  photoSlots: PhotoSlotState[];
  paymentConfirmed: boolean;

  // Print & Sync Simulation States
  printStatus: 'IDLE' | 'PRINTING' | 'SUCCESS' | 'ERROR';
  uploadStatus: 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

  // Actions
  startNewSession: () => void;
  confirmPayment: () => void;
  selectLayout: (layout: LayoutConfig) => void;
  selectFrame: (frame: FrameConfig) => void;
  startCaptureFlow: () => void;
  
  // Capture & Review Actions
  addPhotoAttempt: (localPath: string) => void;
  usePhoto: () => void;
  retakePhoto: () => void;
  
  // Final actions
  startPrinting: () => void;
  completeSession: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScreen: 'MANUAL_PAYMENT',
  setScreen: (screen) => set({ currentScreen: screen }),

  sessionId: null,
  layout: null,
  frame: null,
  currentPhotoSlot: 1,
  photoSlots: [],
  paymentConfirmed: false,

  printStatus: 'IDLE',
  uploadStatus: 'IDLE',

  startNewSession: () => {
    const randomId = 'session_' + Math.random().toString(36).substring(2, 11);
    set({
      sessionId: randomId,
      layout: null,
      frame: null,
      currentPhotoSlot: 1,
      photoSlots: [],
      paymentConfirmed: false,
      printStatus: 'IDLE',
      uploadStatus: 'IDLE',
      currentScreen: 'MANUAL_PAYMENT',
    });
  },

  confirmPayment: () => {
    set({
      paymentConfirmed: true,
      currentScreen: 'TUTORIAL',
    });
  },

  selectLayout: (layout) => {
    // Initialize photo slots based on layout requirements
    const slots: PhotoSlotState[] = Array.from({ length: layout.photoSlots }, (_, i) => ({
      slotNumber: i + 1,
      maxAttempts: 3,
      attempts: [],
    }));

    set({
      layout,
      photoSlots: slots,
      currentScreen: 'SELECT_FRAME',
    });
  },

  selectFrame: (frame) => {
    set({
      frame,
      currentScreen: 'READY',
    });
  },

  startCaptureFlow: () => {
    set({
      currentPhotoSlot: 1,
      currentScreen: 'PHOTO_CAPTURE',
    });
  },

  addPhotoAttempt: (localPath) => {
    const { currentPhotoSlot, photoSlots } = get();
    const updatedSlots = photoSlots.map((slot) => {
      if (slot.slotNumber === currentPhotoSlot) {
        const attemptNumber = slot.attempts.length + 1;
        const newAttempt: PhotoAttempt = {
          attemptNumber,
          localPath,
          status: 'CAPTURED',
        };
        return {
          ...slot,
          attempts: [...slot.attempts, newAttempt],
        };
      }
      return slot;
    });

    set({
      photoSlots: updatedSlots,
      currentScreen: 'PHOTO_REVIEW',
    });
  },

  usePhoto: () => {
    const { currentPhotoSlot, photoSlots, layout } = get();
    const updatedSlots = photoSlots.map((slot) => {
      if (slot.slotNumber === currentPhotoSlot) {
        const selectedAttempt = slot.attempts.length;
        const updatedAttempts = slot.attempts.map((att, idx) => ({
          ...att,
          status: (idx + 1 === selectedAttempt ? 'SELECTED' : att.status) as 'CAPTURED' | 'SELECTED' | 'RETAKEN',
        }));
        return {
          ...slot,
          attempts: updatedAttempts,
          selectedAttempt,
        };
      }
      return slot;
    });

    const isLastSlot = layout ? currentPhotoSlot >= layout.photoSlots : true;

    if (isLastSlot) {
      set({
        photoSlots: updatedSlots,
        currentScreen: 'FINAL_PREVIEW',
      });
    } else {
      set({
        photoSlots: updatedSlots,
        currentPhotoSlot: currentPhotoSlot + 1,
        currentScreen: 'PHOTO_CAPTURE',
      });
    }
  },

  retakePhoto: () => {
    const { currentPhotoSlot, photoSlots } = get();
    
    const currentSlot = photoSlots.find(s => s.slotNumber === currentPhotoSlot);
    if (!currentSlot) return;

    const attemptsCount = currentSlot.attempts.length;

    // Mark current attempt as retaken
    const updatedSlots = photoSlots.map((slot) => {
      if (slot.slotNumber === currentPhotoSlot) {
        const updatedAttempts = slot.attempts.map((att, idx) => ({
          ...att,
          status: (idx + 1 === attemptsCount ? 'RETAKEN' : att.status) as 'CAPTURED' | 'SELECTED' | 'RETAKEN',
        }));
        return {
          ...slot,
          attempts: updatedAttempts,
        };
      }
      return slot;
    });

    // If max attempts reached, we must force selection (should not happen if UI disables retake)
    if (attemptsCount >= 3) {
      // Force use the 3rd attempt
      set({
        photoSlots: updatedSlots,
      });
      get().usePhoto();
    } else {
      set({
        photoSlots: updatedSlots,
        currentScreen: 'PHOTO_CAPTURE',
      });
    }
  },

  startPrinting: () => {
    set({ printStatus: 'PRINTING', uploadStatus: 'UPLOADING' });

    // Simulate printing and uploading delay
    setTimeout(() => {
      set({ printStatus: 'SUCCESS' });
    }, 4000);

    setTimeout(() => {
      set({ uploadStatus: 'SUCCESS' });
    }, 3000);
  },

  completeSession: () => {
    set({ currentScreen: 'COMPLETE' });
  },

  resetSession: () => {
    get().startNewSession();
  },
}));
