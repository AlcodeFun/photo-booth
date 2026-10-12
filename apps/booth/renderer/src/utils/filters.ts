export interface FilterOption {
  id: string;
  name: string;
  className: string;
  // Canvas CSS filter string applied with ctx.filter during composition/export
  // (and as a CSS `filter` for on-screen previews, so both always match).
  canvasFilter: string;
}

/**
 * Photo looks offered on the effects screen. Only CSS filter functions are
 * used so the on-screen preview, the print and the GIF render identically.
 * Ids are stored on sessions, so existing ids must never change.
 */
export const FILTERS: FilterOption[] = [
  { id: 'original', name: 'Original', className: '', canvasFilter: 'none' },
  { id: 'kelana', name: 'Kelana', className: '', canvasFilter: 'sepia(0.22) saturate(1.25) contrast(1.06) hue-rotate(-6deg)' },
  { id: 'film', name: 'Film Fade', className: '', canvasFilter: 'contrast(0.9) brightness(1.08) saturate(0.82) sepia(0.18)' },
  { id: 'polaroid', name: 'Polaroid', className: '', canvasFilter: 'sepia(0.28) contrast(0.95) brightness(1.1) saturate(0.88)' },
  { id: 'warm', name: 'Warm', className: 'sepia-[.45] saturate-[1.35]', canvasFilter: 'sepia(0.45) saturate(1.35)' },
  { id: 'sunset', name: 'Sunset', className: '', canvasFilter: 'sepia(0.35) saturate(1.6) hue-rotate(-25deg) brightness(1.03)' },
  { id: 'retro', name: 'Retro 70s', className: '', canvasFilter: 'sepia(0.5) hue-rotate(-18deg) saturate(1.45) contrast(1.05)' },
  { id: 'dreamy', name: 'Dreamy', className: '', canvasFilter: 'brightness(1.12) saturate(1.3) contrast(0.88) hue-rotate(-8deg)' },
  { id: 'pop', name: 'Pop', className: '', canvasFilter: 'saturate(1.75) contrast(1.15)' },
  { id: 'cool', name: 'Cool', className: 'hue-rotate-[25deg] saturate-[.8]', canvasFilter: 'hue-rotate(25deg) saturate(0.8)' },
  { id: 'matcha', name: 'Matcha', className: '', canvasFilter: 'hue-rotate(35deg) saturate(0.9) brightness(1.05) sepia(0.15)' },
  { id: 'cyber', name: 'Cyber', className: '', canvasFilter: 'hue-rotate(200deg) saturate(1.5) contrast(1.1)' },
  { id: 'mono', name: 'Mono', className: 'grayscale', canvasFilter: 'grayscale(1)' },
  { id: 'noir', name: 'Noir', className: '', canvasFilter: 'grayscale(1) contrast(1.45) brightness(0.95)' },
];

export const getFilterById = (id: string | null | undefined): FilterOption =>
  FILTERS.find((filter) => filter.id === id) ?? FILTERS[0];

export const getFilterClassName = (id: string | null | undefined): string =>
  getFilterById(id).className;

export const getCanvasFilter = (id: string | null | undefined): string =>
  getFilterById(id).canvasFilter;
