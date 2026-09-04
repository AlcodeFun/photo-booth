import { FrameConfig, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';

export const DEFAULT_FRAME_CANVAS = {
  width: 1200,
  height: 1600,
} as const;

const DEFAULT_SLOT_LAYOUTS: Record<number, FramePhotoPlacement[]> = {
  1: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 120,
      y: 160,
      width: 960,
      height: 1160,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ],
  2: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 130,
      y: 150,
      width: 940,
      height: 520,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 130,
      y: 740,
      width: 940,
      height: 520,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ],
  3: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 145,
      y: 140,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 145,
      y: 520,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 145,
      y: 900,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    
  ],
};

const createStackedSlots = (photoSlotCount: number): FramePhotoPlacement[] => {
  const gap = 42;
  const x = 120;
  const y = 140;
  const width = 960;
  const availableHeight = 1180;
  const slotHeight = (availableHeight - gap * (photoSlotCount - 1)) / photoSlotCount;

  return Array.from({ length: photoSlotCount }, (_, index) => ({
    slotNumber: index + 1,
    sourcePhotoSlot: index + 1,
    x,
    y: y + (slotHeight + gap) * index,
    width,
    height: slotHeight,
    borderRadius: 0,
    zIndex: 10,
    objectFit: 'cover',
    objectPosition: 'center',
  }));
};

export const createFallbackFrameTemplate = (photoSlotCount: number): FrameTemplateConfig => {
  const normalizedSlotCount = Math.max(1, Math.floor(photoSlotCount));

  return {
    assetUrl: '',
    width: DEFAULT_FRAME_CANVAS.width,
    height: DEFAULT_FRAME_CANVAS.height,
    backgroundColor: '#111111',
    frameLayerZIndex: 30,
    photoSlots: DEFAULT_SLOT_LAYOUTS[normalizedSlotCount] ?? createStackedSlots(normalizedSlotCount),
  };
};

export const resolveFrameTemplate = (
  frame: FrameConfig | null | undefined,
  photoSlotCount: number,
): FrameTemplateConfig => {
  const normalizedSlotCount = Math.max(1, Math.floor(photoSlotCount));

  return (
    frame?.templatesByPhotoSlots?.[normalizedSlotCount] ??
    frame?.template ??
    createFallbackFrameTemplate(normalizedSlotCount)
  );
};
