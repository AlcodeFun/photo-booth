export interface FilterOption {
  id: string;
  name: string;
  className: string;
  // Canvas CSS filter string applied with ctx.filter during composition/export.
  canvasFilter: string;
}

export const FILTERS: FilterOption[] = [
  { id: 'original', name: 'Original', className: '', canvasFilter: 'none' },
  { id: 'mono', name: 'Mono', className: 'grayscale', canvasFilter: 'grayscale(1)' },
  { id: 'warm', name: 'Warm', className: 'sepia-[.45] saturate-[1.35]', canvasFilter: 'sepia(0.45) saturate(1.35)' },
  { id: 'cool', name: 'Cool', className: 'hue-rotate-[25deg] saturate-[.8]', canvasFilter: 'hue-rotate(25deg) saturate(0.8)' },
];

export const getFilterById = (id: string | null | undefined): FilterOption =>
  FILTERS.find((filter) => filter.id === id) ?? FILTERS[0];

export const getFilterClassName = (id: string | null | undefined): string =>
  getFilterById(id).className;

export const getCanvasFilter = (id: string | null | undefined): string =>
  getFilterById(id).canvasFilter;
