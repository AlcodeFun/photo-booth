import { create } from 'zustand';
import {
  PhotoSlotState,
  PhotoAttempt,
  FrameConfig,
} from '@photo-booth/types';
import { SessionFileState, normalizePrintStatus, normalizeUploadStatus, updateSessionRecord } from '../lib/sessions';
import { useBoothConfig } from './boothConfigStore';
import { GALLERY_URL } from '../config';

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
  printStatus: 'IDLE' | 'PRINTING' | 'QUEUED' | 'SUCCESS' | 'ERROR';
  uploadStatus: 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
  downloadUrl: string | null;

  // When true the booth's print queue owns this session's `print_status`; the
  // store stops writing it so queue transitions (queued → printing →
  // success/error) are never clobbered by upload-status patches.
  printManagedByQueue: boolean;
  printJobId: string | null;

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
  addPhotoAttempt: (localPath: string, stayOnCapture?: boolean, liveFrames?: string[]) => void;
  usePhoto: () => void;
  retakePhoto: () => void;
  
  // Final actions
  startPrinting: () => void;
  _enqueuePrint: (token: string) => Promise<void>;
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
  printManagedByQueue: false,
  printJobId: null,
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
      printManagedByQueue: false,
      printJobId: null,
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
    const config = useBoothConfig.getState();
    const flowMode = config.flowMode;
    const maxAttempts = Math.max(1, config.flow.maxAttempts);

    if (flowMode === 'timed') {
      // Timed flow: one virtual slot holding every capture taken during the
      // time budget. The frame layout is not locked to a fixed slot count —
      // the customer picks the photos later from the gallery.
      const slots: PhotoSlotState[] = [
        {
          slotNumber: 1,
          maxAttempts: 100000,
          attempts: [],
        },
      ];
      set({
        frame,
        photoSlots: slots,
        currentScreen: 'PHOTO_CAPTURE',
      });
      return;
    }

    const slotCount = Math.max(1, Math.floor(frame.photoSlots ?? 3));
    const slots: PhotoSlotState[] = Array.from({ length: slotCount }, (_, i) => ({
      slotNumber: i + 1,
      maxAttempts,
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

  addPhotoAttempt: (localPath, stayOnCapture = false, liveFrames) => {
    const { currentPhotoSlot, photoSlots } = get();
    const updatedSlots = photoSlots.map((slot) => {
      if (slot.slotNumber === currentPhotoSlot) {
        const attemptNumber = slot.attempts.length + 1;
        const newAttempt: PhotoAttempt = {
          attemptNumber,
          localPath,
          status: 'CAPTURED',
          ...(liveFrames && liveFrames.length > 0 ? { liveFrames } : {}),
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
      currentScreen: stayOnCapture ? 'PHOTO_CAPTURE' : 'PHOTO_REVIEW',
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
    const maxAttempts = Math.max(1, useBoothConfig.getState().flow.maxAttempts);

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
    if (attemptsCount >= maxAttempts) {
      // Force use the last attempt
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
      printManagedByQueue: false,
      printJobId: null,
    });

    // Flow 2 (timed) has no booth-side print: the customer arranges the frame
    // on the /organize/:token page and the booth LISTENER regenerates + uploads
    // the framed outputs; the admin queues framed.png from the Print Queue.
    if (useBoothConfig.getState().flowMode === 'timed') {
      return;
    }

    const { printer, outputs } = useBoothConfig.getState();
    const api = window.electronAPI?.printer;
    const queueReady =
      printer.enabled &&
      Boolean(printer.queueName) &&
      Boolean(GALLERY_URL) &&
      outputs.framed &&
      typeof api?.enqueue === 'function';

    if (queueReady) {
      // The session token is generated later (during upload), so the real
      // enqueue happens in setSessionToken once the token exists. Mark the
      // queue as owner now so the store never clobbers the queue's status.
      set({
        printManagedByQueue: true,
        printStatus: printer.printMode === 'manual' ? 'QUEUED' : 'PRINTING',
      });
      get()._syncSessionRow();
      return;
    }

    // No usable printer/queue: keep the flow unblocked with the simulated print.
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    void sleep(4000).then(() => {
      set({ printStatus: 'SUCCESS' });
      get()._syncSessionRow();
    });
  },

  _enqueuePrint: async (token) => {
    const { printer } = useBoothConfig.getState();
    const api = window.electronAPI?.printer;
    if (!api?.enqueue) {
      return;
    }
    try {
      const job = await api.enqueue({
        token,
        fileName: 'framed.png',
        queueName: printer.queueName,
        copies: printer.copies,
        paperSize: printer.paperSize,
        mediaType: printer.mediaType,
        quality: printer.quality,
        colorMode: printer.colorMode,
      });
      set({ printJobId: job.id });
      if (printer.printMode === 'auto') {
        await api.startBatch([job.id]);
      }
    } catch (error) {
      console.warn('[sessionStore] enqueue print failed:', error);
      set({ printManagedByQueue: false, printStatus: 'ERROR' });
      get()._syncSessionRow();
    }
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
    // The framed image is cached/uploaded after the token exists, so the print
    // job is enqueued here (the queue resolves the image just-in-time).
    if (token && get().printManagedByQueue && !get().printJobId) {
      void get()._enqueuePrint(token);
    }
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
      ...(state.printManagedByQueue ? {} : { print_status: normalizePrintStatus(state.printStatus) }),
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
