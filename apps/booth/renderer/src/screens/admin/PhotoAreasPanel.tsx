import { FramePhotoFit, FramePhotoPlacement } from '@photo-booth/types';
import { NumberField, SelectField } from './fields';

const toNumericValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeSourcePhotoSlot = (value: number | undefined, sourcePhotoCount: number) =>
  clamp(Math.floor(value ?? 1), 1, sourcePhotoCount);

interface PhotoAreasPanelProps {
  areas: FramePhotoPlacement[];
  activeArea: FramePhotoPlacement | undefined;
  activeAreaNumber: number;
  sourcePhotoCount: number;
  onSelectArea: (slotNumber: number) => void;
  onAddArea: () => void;
  onDuplicateArea: () => void;
  onDeleteArea: () => void;
  onUpdateActiveArea: (updates: Partial<FramePhotoPlacement>) => void;
}

export const PhotoAreasPanel = ({
  areas,
  activeArea,
  activeAreaNumber,
  sourcePhotoCount,
  onSelectArea,
  onAddArea,
  onDuplicateArea,
  onDeleteArea,
  onUpdateActiveArea,
}: PhotoAreasPanelProps) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
    <div className="mb-4 flex flex-wrap gap-2">
      {areas.map((area) => (
        <button
          key={area.slotNumber}
          type="button"
          onClick={() => onSelectArea(area.slotNumber)}
          className={`h-10 rounded-lg border px-4 text-sm font-semibold transition-colors ${
            activeAreaNumber === area.slotNumber
              ? 'border-sky-300 bg-sky-300 text-black'
              : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
          }`}
        >
          Area {area.slotNumber}
        </button>
      ))}
    </div>

    <div className="mb-4 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onAddArea}
        className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
      >
        Add Area
      </button>
      <button
        type="button"
        onClick={onDuplicateArea}
        className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
      >
        Duplicate Area
      </button>
      <button
        type="button"
        onClick={onDeleteArea}
        disabled={areas.length <= 1}
        className="h-10 rounded-lg border border-rose-800 px-4 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete Area
      </button>
    </div>

    {activeArea && (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SelectField
          label="Source"
          value={activeArea.sourcePhotoSlot ?? activeArea.slotNumber}
          onChange={(value) =>
            onUpdateActiveArea({
              sourcePhotoSlot: normalizeSourcePhotoSlot(toNumericValue(value), sourcePhotoCount),
            })
          }
        >
          {Array.from({ length: sourcePhotoCount }, (_, index) => index + 1).map((sourcePhotoSlot) => (
            <option key={sourcePhotoSlot} value={sourcePhotoSlot}>
              Photo {sourcePhotoSlot}
            </option>
          ))}
        </SelectField>
        <NumberField label="X" value={activeArea.x} min={0} onChange={(value) => onUpdateActiveArea({ x: value })} />
        <NumberField label="Y" value={activeArea.y} min={0} onChange={(value) => onUpdateActiveArea({ y: value })} />
        <NumberField
          label="Width"
          value={activeArea.width}
          min={1}
          onChange={(value) => onUpdateActiveArea({ width: value })}
        />
        <NumberField
          label="Height"
          value={activeArea.height}
          min={1}
          onChange={(value) => onUpdateActiveArea({ height: value })}
        />
        <NumberField
          label="Rotation"
          value={activeArea.rotation ?? 0}
          step={0.5}
          onChange={(value) => onUpdateActiveArea({ rotation: value })}
        />
        <NumberField
          label="Radius"
          value={activeArea.borderRadius ?? 0}
          min={0}
          onChange={(value) => onUpdateActiveArea({ borderRadius: value })}
        />
        <NumberField
          label="Photo Z"
          value={activeArea.zIndex ?? 10}
          min={0}
          onChange={(value) => onUpdateActiveArea({ zIndex: value })}
        />
        <SelectField
          label="Fit"
          value={activeArea.objectFit ?? 'cover'}
          onChange={(value) => onUpdateActiveArea({ objectFit: value as FramePhotoFit })}
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
        </SelectField>
      </div>
    )}
  </div>
);