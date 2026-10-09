import { FrameQRPlacement } from '@photo-booth/types';
import { NumberField } from './fields';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface QrSlotsPanelProps {
  qrSlots: FrameQRPlacement[];
  activeQrSlot: FrameQRPlacement | undefined;
  activeQrSlotNumber: number;
  onSelectQrSlot: (slotNumber: number) => void;
  onAddQrSlot: () => void;
  onDuplicateQrSlot: () => void;
  onDeleteQrSlot: () => void;
  onUpdateActiveQrSlot: (updates: Partial<FrameQRPlacement>) => void;
}

const chipClass = (active: boolean) =>
  `h-10 rounded-[10px] border-[3px] px-4 text-xs font-black uppercase tracking-[0.12em] transition-all ${
    active
      ? 'border-[#22c55e] bg-[#22c55e] text-white'
      : 'border-pbx-line bg-white text-pbx-secondary-strong hover:bg-pbx-tint'
  }`;

export const QrSlotsPanel = ({
  qrSlots,
  activeQrSlot,
  activeQrSlotNumber,
  onSelectQrSlot,
  onAddQrSlot,
  onDuplicateQrSlot,
  onDeleteQrSlot,
  onUpdateActiveQrSlot,
}: QrSlotsPanelProps) => (
  <div className="rounded-[12px] border-[3px] border-pbx-line bg-pbx-paper p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-pbx-ink">QR Placeholders</h2>
      <span className="rounded-[8px] border-2 border-[#22c55e] bg-[#e7ffe7] px-2 py-0.5 text-xs font-black text-[#15803d]">
        {qrSlots.length}
      </span>
    </div>

    <div className="mb-3 flex flex-wrap gap-2">
      {qrSlots.map((qrSlot) => (
        <button
          key={qrSlot.slotNumber}
          type="button"
          onClick={() => onSelectQrSlot(qrSlot.slotNumber)}
          className={chipClass(activeQrSlotNumber === qrSlot.slotNumber)}
        >
          QR {qrSlot.slotNumber}
        </button>
      ))}
    </div>

    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onAddQrSlot}
        className="h-10 rounded-[10px] border-[3px] border-[#16a34a] bg-pbx-tertiary px-4 text-xs font-black uppercase tracking-[0.12em] text-pbx-tertiary-fg transition-all hover:-translate-y-0.5 hover:bg-pbx-tertiary-soft active:translate-y-0"
      >
        + Add QR
      </button>
      <button
        type="button"
        onClick={onDuplicateQrSlot}
        className="h-10 rounded-[10px] border-[3px] border-pbx-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-pbx-secondary-strong transition-colors hover:bg-pbx-tint"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDeleteQrSlot}
        className="h-10 rounded-[10px] border-[3px] border-pbx-brand-soft bg-pbx-brand-tint px-4 text-xs font-black uppercase tracking-[0.12em] text-pbx-brand-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </button>
    </div>

    {activeQrSlot && (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
        <NumberField
          label="X"
          value={clamp(activeQrSlot.x, 0, 99999)}
          min={0}
          onChange={(value) => onUpdateActiveQrSlot({ x: value })}
        />
        <NumberField
          label="Y"
          value={clamp(activeQrSlot.y, 0, 99999)}
          min={0}
          onChange={(value) => onUpdateActiveQrSlot({ y: value })}
        />
        <NumberField
          label="Size"
          value={activeQrSlot.width}
          min={1}
          onChange={(value) => onUpdateActiveQrSlot({ width: value, height: value })}
        />
        <NumberField
          label="Rotation"
          value={activeQrSlot.rotation ?? 0}
          allowDecimal
          onChange={(value) => onUpdateActiveQrSlot({ rotation: value })}
        />
        <NumberField
          label="Radius"
          value={clamp(activeQrSlot.borderRadius ?? 0, 0, 99999)}
          min={0}
          onChange={(value) => onUpdateActiveQrSlot({ borderRadius: value })}
        />
        <NumberField
          label="QR Z"
          value={clamp(activeQrSlot.zIndex ?? 50, 0, 99999)}
          min={0}
          onChange={(value) => onUpdateActiveQrSlot({ zIndex: value })}
        />
      </div>
    )}
  </div>
);