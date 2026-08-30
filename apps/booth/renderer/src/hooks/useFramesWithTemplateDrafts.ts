import { useEffect, useMemo, useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import { FRAME_TEMPLATE_DRAFTS_EVENT, mergeFrameTemplateDrafts } from '../utils/frameTemplateDrafts';

export const useFramesWithTemplateDrafts = (
  frames: FrameConfig[],
  photoSlotCount?: number,
): FrameConfig[] => {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refreshDrafts = () => setRevision((value) => value + 1);

    window.addEventListener(FRAME_TEMPLATE_DRAFTS_EVENT, refreshDrafts);
    window.addEventListener('storage', refreshDrafts);

    return () => {
      window.removeEventListener(FRAME_TEMPLATE_DRAFTS_EVENT, refreshDrafts);
      window.removeEventListener('storage', refreshDrafts);
    };
  }, []);

  return useMemo(
    () => mergeFrameTemplateDrafts(frames, photoSlotCount),
    [frames, photoSlotCount, revision],
  );
};
