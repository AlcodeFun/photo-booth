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

/**
 * The raw photos a session keeps (uploads and shows). The timed flow keeps
 * every capture: the guest chooses later from all of them. Every other flow
 * keeps only the photo chosen for each slot; retaken shots are discarded.
 */
export const getKeptPhotoUrls = (photoSlots: PhotoSlotState[], flowMode: string): string[] =>
  flowMode === 'timed'
    ? getAllPhotoUrls(photoSlots)
    : getSelectedPhotoUrls(photoSlots).filter((url): url is string => Boolean(url));
