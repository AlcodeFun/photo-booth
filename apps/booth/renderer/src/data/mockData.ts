import { LayoutConfig, FrameConfig } from '@photo-booth/types';

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
