import { LayoutConfig, FrameConfig, FrameTemplateConfig } from '@photo-booth/types';

const publicAsset = (path: string) => `${import.meta.env.DEV ? '/' : import.meta.env.BASE_URL}${path}`;

const classicTemplate = (
  assetName: string,
  photoSlots: FrameTemplateConfig['photoSlots'],
): FrameTemplateConfig => ({
  assetUrl: publicAsset(`frame-templates/${assetName}`),
  width: 1200,
  height: 1600,
  backgroundColor: '#111111',
  frameLayerZIndex: 30,
  photoSlots,
});

const CLASSIC_BLACK_TEMPLATES: FrameConfig['templatesByPhotoSlots'] = {
  1: classicTemplate('classic-black-1-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 120,
      y: 160,
      width: 960,
      height: 1160,
      borderRadius: 34,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
  2: classicTemplate('classic-black-2-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 130,
      y: 150,
      width: 940,
      height: 520,
      borderRadius: 28,
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
      borderRadius: 28,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
  3: classicTemplate('classic-black-3-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 145,
      y: 140,
      width: 910,
      height: 340,
      borderRadius: 24,
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
      borderRadius: 24,
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
      borderRadius: 24,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
   4: classicTemplate('3-photo.png', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 120,
      y: 160,
      width: 960,
      height: 1160,
      borderRadius: 34,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
};

export const MOCK_LAYOUTS: LayoutConfig[] = [
  {
    id: 'layout-1',
    name: 'Single Portrait',
    photoSlots: 1,
    aspectRatio: '3:4',
    previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'layout-2',
    name: 'Double Strip',
    photoSlots: 2,
    aspectRatio: '1:2',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'layout-3',
    name: 'Classic 3-Photo',
    photoSlots: 3,
    aspectRatio: '3:4',
    previewUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  },
];

export const MOCK_FRAMES: FrameConfig[] = [
  {
    id: 'frame-classic-black',
    name: 'Classic Black',
    previewUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=200',
    theme: 'bg-zinc-950 border-zinc-900 text-white',
    templatesByPhotoSlots: CLASSIC_BLACK_TEMPLATES,
  },
  {
    id: 'frame-elegant-white',
    name: 'Elegant White',
    previewUrl: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?auto=format&fit=crop&q=80&w=200',
    theme: 'bg-zinc-50 border-zinc-200 text-zinc-900',
  },
  {
    id: 'frame-pastel-pink',
    name: 'Pastel Pink',
    previewUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=200',
    theme: 'bg-rose-50 border-rose-100 text-rose-950',
  },
  {
    id: 'frame-retro-film',
    name: 'Retro Film',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=200',
    theme: 'bg-amber-50 border-amber-100 text-amber-950 font-serif',
  },
];
