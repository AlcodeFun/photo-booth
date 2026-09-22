import { create } from 'zustand';
import {
  PhotoSlotState,
  PhotoAttempt,
  FrameConfig,
} from '@photo-booth/types';
import { SessionFileState, normalizePrintStatus, normalizeUploadStatus, updateSessionRecord } from '../lib/sessions';

export type ScreenName =
  | 'CONTEXT_BUMPER'
  | 'TUTORIAL'
  | 'SELECT_FRAME'
  | 'READY'
  | 'PHOTO_CAPTURE'
  | 'PHOTO_REVIEW'
  | 'FILTER'
  | 'PRINT_QR'
  | 'COMPLETE';

export interface SessionStore {
  // Screen Router State
  currentScreen: ScreenName;
  setScreen: (screen: ScreenName) => void;

  // Session State Data
  sessionId: string | null;
  frame: FrameConfig | null;
  filterId: string | null;
  currentPhotoSlot: number; // 1-indexed (e.g. slot 1, 2, 3)
  photoSlots: PhotoSlotState[];
  paymentConfirmed: boolean;

  // Print & Sync Simulation States
  printStatus: 'IDLE' | 'PRINTING' | 'SUCCESS' | 'ERROR';
  uploadStatus: 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
  downloadUrl: string | null;

  // Persisted session mirror (kept in the store so status patches survive the
  // PRINT_QR component unmounting when the round advances to COMPLETE).
  sessionToken: string | null;
  // Per-token file state. Keyed by token so a late-finishing background upload
  // can keep patching its own session's files without ever touching a newer,
  // already-started session after a reset.
  sessionFilesByToken: Record<string, SessionFileState[]>;

  // Actions
  startNewSession: () => void;
  confirmPayment: () => void;
  selectFrame: (frame: FrameConfig) => void;
  selectFilter: (filterId: string) => void;
  startCaptureFlow: () => void;
  
  // Capture & Review Actions
  addPhotoAttempt: (localPath: string) => void;
  usePhoto: () => void;
  retakePhoto: () => void;
  
  // Final actions
  startPrinting: () => void;
  setUploadStatus: (status: 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR') => void;
  setDownloadUrl: (url: string) => void;
  setSessionToken: (token: string | null) => void;
  setSessionFilesForToken: (token: string, files: SessionFileState[]) => void;
  _syncSessionRow: () => void;
  completeSession: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScreen: 'CONTEXT_BUMPER',
  setScreen: (screen) => set({ currentScreen: screen }),

  sessionId: null,
  frame: null,
  filterId: null,
  currentPhotoSlot: 1,
  photoSlots: [],
  paymentConfirmed: false,

  printStatus: 'IDLE',
  uploadStatus: 'IDLE',
  downloadUrl: null,
  sessionToken: null,
  sessionFilesByToken: {},

  startNewSession: () => {
    const randomId = 'session_' + Math.random().toString(36).substring(2, 11);
    set({
      sessionId: randomId,
      frame: null,
      filterId: null,
      currentPhotoSlot: 1,
      photoSlots: [],
      paymentConfirmed: false,
      printStatus: 'IDLE',
      uploadStatus: 'IDLE',
      downloadUrl: null,
      sessionToken: null,
      sessionFilesByToken: {},
      currentScreen: 'CONTEXT_BUMPER',
    });
  },

  confirmPayment: () => {
    set({
      paymentConfirmed: true,
      currentScreen: 'TUTORIAL',
    });
  },

  selectFrame: (frame) => {
    const slotCount = Math.max(1, Math.floor(frame.photoSlots ?? 3));
    const slots: PhotoSlotState[] = Array.from({ length: slotCount }, (_, i) => ({
      slotNumber: i + 1,
      maxAttempts: 3,
      attempts: [],
    }));

    set({
      frame,
      photoSlots: slots,
      currentScreen: 'PHOTO_CAPTURE',
    });
  },

  selectFilter: (filterId) => {
    set({ filterId });
    get().startPrinting();
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
    const { currentPhotoSlot, photoSlots } = get();
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

    const isLastSlot = currentPhotoSlot >= photoSlots.length;

    if (isLastSlot) {
      set({
        photoSlots: updatedSlots,
        currentScreen: 'FILTER',
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
    set({
      currentScreen: 'PRINT_QR',
      printStatus: 'PRINTING',
      uploadStatus: 'UPLOADING',
    });

    // Simulate the print job only. Upload state is driven by the real upload
    // in PRINT_QR (or a simulated success fallback when no gallery is configured).
    setTimeout(() => {
      set({ printStatus: 'SUCCESS' });
      // Patches the row from inside the store action (not a React effect), so
      // the final status lands even after the PRINT_QR screen has unmounted.
      get()._syncSessionRow();
    }, 4000);
  },

  setUploadStatus: (status) => {
    set({ uploadStatus: status });
    get()._syncSessionRow();
  },

  setDownloadUrl: (url) => {
    set({ downloadUrl: url });
    get()._syncSessionRow();
  },

  setSessionToken: (token) => {
    set({ sessionToken: token });
    get()._syncSessionRow();
  },

  setSessionFilesForToken: (token, files) => {
    set((state) => ({ sessionFilesByToken: { ...state.sessionFilesByToken, [token]: files } }));
    get()._syncSessionRow();
  },

  // Mirrors current session state to public.sessions. Runs from store actions
  // only, so persistence does not depend on any mounted screen, effect, or
  // subscription.
  _syncSessionRow: () => {
    const state = get();
    if (!state.sessionToken) {
      return;
    }
    if (state.printStatus === 'IDLE' && state.uploadStatus === 'IDLE') {
      return;
    }
    updateSessionRecord(state.sessionToken, {
      print_status: normalizePrintStatus(state.printStatus),
      upload_status: normalizeUploadStatus(state.uploadStatus),
      download_url: state.downloadUrl ?? undefined,
      files: state.sessionFilesByToken[state.sessionToken] ?? [],
    });
  },

  completeSession: () => {
    set({ currentScreen: 'COMPLETE' });
  },

  resetSession: () => {
    get().startNewSession();
  },
}));
