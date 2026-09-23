import { PhotoSlotState } from '@photo-booth/types';

export const getSelectedPhotoUrls = (photoSlots: PhotoSlotState[]): Array<string | undefined> =>
  photoSlots.map((slot) => {
    const selectedAttemptIdx = slot.selectedAttempt;
    if (selectedAttemptIdx !== undefined && slot.attempts[selectedAttemptIdx - 1]) {
      return slot.attempts[selectedAttemptIdx - 1].localPath;
    }

    return slot.attempts[slot.attempts.length - 1]?.localPath;
  });

/**
 * Per-slot live view clips for the framed "live photo" result. Each slot gets
 * the recorded frames of its selected attempt (falling back to the latest
 * attempt, then to an empty clip) so every slot animates independently.
 */
export const getSelectedLiveFrames = (photoSlots: PhotoSlotState[]): string[][] =>
  photoSlots.map((slot) => {
    const selectedAttemptIdx = slot.selectedAttempt;
    const selected =
      selectedAttemptIdx !== undefined
        ? slot.attempts.find((attempt) => attempt.attemptNumber === selectedAttemptIdx)
        : slot.attempts[slot.attempts.length - 1];
    return selected?.liveFrames ?? [];
  });

/** Flattens every captured attempt (selected + retaken) across all slots into data URLs. */
export const getAllPhotoUrls = (photoSlots: PhotoSlotState[]): string[] =>
  photoSlots.flatMap((slot) =>
    slot.attempts.flatMap((attempt) => (attempt.localPath ? [attempt.localPath] : [])),
  );
