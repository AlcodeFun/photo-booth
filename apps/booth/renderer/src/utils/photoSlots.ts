import { PhotoSlotState } from '@photo-booth/types';

export const getSelectedPhotoUrls = (photoSlots: PhotoSlotState[]): Array<string | undefined> =>
  photoSlots.map((slot) => {
    const selectedAttemptIdx = slot.selectedAttempt;
    if (selectedAttemptIdx !== undefined && slot.attempts[selectedAttemptIdx - 1]) {
      return slot.attempts[selectedAttemptIdx - 1].localPath;
    }

    return slot.attempts[slot.attempts.length - 1]?.localPath;
  });

/** Flattens every captured attempt (selected + retaken) across all slots into data URLs. */
export const getAllPhotoUrls = (photoSlots: PhotoSlotState[]): string[] =>
  photoSlots.flatMap((slot) =>
    slot.attempts.flatMap((attempt) => (attempt.localPath ? [attempt.localPath] : [])),
  );
