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

const chipClass = (active: boolean) =>
  `h-10 rounded-[10px] border-[3px] px-4 text-xs font-black uppercase tracking-[0.12em] transition-all ${
    active
      ? 'border-[#ff4bb5] bg-[#ff4bb5] text-white'
      : 'border-[#c9b8ff] bg-white text-[#5b3aa8] hover:bg-[#efe8ff]'
  }`;

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
  <div className="rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Photo Areas</h2>
      <span className="rounded-[8px] border-2 border-[#4acaf1] bg-[#e3f6ff] px-2 py-0.5 text-xs font-black text-[#1b7fa8]">
        {areas.length}
      </span>
    </div>

    <div className="mb-3 flex flex-wrap gap-2">
      {areas.map((area) => (
        <button
          key={area.slotNumber}
          type="button"
          onClick={() => onSelectArea(area.slotNumber)}
          className={chipClass(activeAreaNumber === area.slotNumber)}
        >
          Area {area.slotNumber}
        </button>
      ))}
    </div>

    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onAddArea}
        className="h-10 rounded-[10px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 text-xs font-black uppercase tracking-[0.12em] text-[#4d2d85] transition-all hover:-translate-y-0.5 hover:bg-[#e9ff9e] active:translate-y-0"
      >
        + Add Area
      </button>
      <button
        type="button"
        onClick={onDuplicateArea}
        className="h-10 rounded-[10px] border-[3px] border-[#c9b8ff] bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition-colors hover:bg-[#efe8ff]"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDeleteArea}
        className="h-10 rounded-[10px] border-[3px] border-[#ff9ecb] bg-[#ffe0ef] px-4 text-xs font-black uppercase tracking-[0.12em] text-[#b3206e] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </button>
    </div>

    {activeArea && (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
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
          allowDecimal
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