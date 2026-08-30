import { FrameConfig, FrameTemplateConfig } from '@photo-booth/types';

export type FrameTemplateDrafts = Record<string, Record<string, FrameTemplateConfig>>;

export const FRAME_TEMPLATE_DRAFTS_EVENT = 'frame-template-drafts-updated';

const STORAGE_KEY = 'photo-booth.frame-template-drafts.v1';

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getFrameTemplateDrafts = (): FrameTemplateDrafts => {
  if (!canUseLocalStorage()) {
    return {};
  }

  try {
    const rawDrafts = window.localStorage.getItem(STORAGE_KEY);
    if (!rawDrafts) {
      return {};
    }

    return JSON.parse(rawDrafts) as FrameTemplateDrafts;
  } catch {
    return {};
  }
};

export const getFrameTemplateDraft = (
  frameId: string,
  photoSlotCount: number,
): FrameTemplateConfig | undefined => getFrameTemplateDrafts()[frameId]?.[String(photoSlotCount)];

export const saveFrameTemplateDraft = (
  frameId: string,
  photoSlotCount: number,
  template: FrameTemplateConfig,
) => {
  if (!canUseLocalStorage()) {
    return;
  }

  const drafts = getFrameTemplateDrafts();
  drafts[frameId] = {
    ...drafts[frameId],
    [String(photoSlotCount)]: template,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event(FRAME_TEMPLATE_DRAFTS_EVENT));
};

export const clearFrameTemplateDraft = (frameId: string, photoSlotCount: number) => {
  if (!canUseLocalStorage()) {
    return;
  }

  const drafts = getFrameTemplateDrafts();
  const frameDrafts = drafts[frameId];
  if (!frameDrafts) {
    return;
  }

  delete frameDrafts[String(photoSlotCount)];
  if (Object.keys(frameDrafts).length === 0) {
    delete drafts[frameId];
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event(FRAME_TEMPLATE_DRAFTS_EVENT));
};

export const mergeFrameTemplateDrafts = (
  frames: FrameConfig[],
  photoSlotCount?: number,
): FrameConfig[] => {
  const drafts = getFrameTemplateDrafts();

  return frames.map((frame) => {
    const frameDrafts = drafts[frame.id];
    if (!frameDrafts) {
      return frame;
    }

    const templatesByPhotoSlots: Partial<Record<number, FrameTemplateConfig>> = {
      ...frame.templatesByPhotoSlots,
    };

    Object.entries(frameDrafts).forEach(([slotCountKey, draft]) => {
      templatesByPhotoSlots[Number(slotCountKey)] = draft;
    });

    const selectedDraft = photoSlotCount ? frameDrafts[String(photoSlotCount)] : undefined;

    return {
      ...frame,
      template: selectedDraft ?? frame.template,
      templatesByPhotoSlots,
    };
  });
};
