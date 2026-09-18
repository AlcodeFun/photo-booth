import { CSSProperties, PointerEvent, RefObject } from 'react';
import { FrameConfig, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';
import FrameCanvas from '../../components/FrameCanvas';
import { DrawingRectangle } from './types';

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const getAreaStyle = (area: FramePhotoPlacement, template: FrameTemplateConfig): CSSProperties => ({
  left: toPercent(area.x, template.width),
  top: toPercent(area.y, template.height),
  width: toPercent(area.width, template.width),
  height: toPercent(area.height, template.height),
  borderRadius: area.borderRadius,
  transform: area.rotation ? `rotate(${area.rotation}deg)` : undefined,
});

interface TemplateCanvasEditorProps {
  template: FrameTemplateConfig;
  frame: FrameConfig | null | undefined;
  photos: Array<string | undefined>;
  photoSlotCount: number;
  activeAreaNumber: number;
  drawingRectangle: DrawingRectangle | null;
  canvasRef: RefObject<HTMLDivElement>;
  status: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveDraft: () => void;
  onClearPhotos: () => void;
  onResetDraft: () => void;
  onDrawStart: (event: PointerEvent<HTMLDivElement>) => void;
  onDrawMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDrawEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onAreaPointerDown: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerMove: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerUp: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerLeave: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onResizePointerLeave: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
}

const actionButtonClass = (extra: string) =>
  `h-9 rounded-[10px] border-[3px] px-3.5 text-xs font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 ${extra}`;

export const TemplateCanvasEditor = ({
  template,
  frame,
  photos,
  photoSlotCount,
  activeAreaNumber,
  drawingRectangle,
  canvasRef,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveDraft,
  onClearPhotos,
  onResetDraft,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onAreaPointerDown,
  onAreaPointerMove,
  onAreaPointerUp,
  onAreaPointerLeave,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerLeave,
}: TemplateCanvasEditorProps) => (
  <section className="flex min-h-[70vh] flex-col rounded-[14px] border-[4px] border-[#e5c9ff] bg-[#fbf3ff] p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Editor</h2>
      {status && (
        <span className="ml-auto rounded-[8px] border-2 border-[#4acaf1] bg-[#e3f6ff] px-2 py-0.5 text-xs font-black uppercase tracking-wide text-[#1b7fa8]">
          {status}
        </span>
      )}
    </div>



    <div className="flex min-h-0 items-center justify-center flex-wrap ">
          <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className={actionButtonClass('border-[#c9b8ff] bg-[#efe8ff] text-[#5b3aa8] hover:bg-white')}
      >
        ↩ Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className={actionButtonClass('border-[#c9b8ff] bg-[#efe8ff] text-[#5b3aa8] hover:bg-white')}
      >
        ↪ Redo
      </button>
      <button
        type="button"
        onClick={onSaveDraft}
        className={actionButtonClass('border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] hover:bg-[#e9ff9e]')}
      >
        Save Draft
      </button>
      <button
        type="button"
        onClick={onClearPhotos}
        className={actionButtonClass('border-[#e5c9ff] bg-white text-[#7a4de3] hover:bg-[#fbf3ff]')}
      >
        Clear Photos
      </button>
      <button
        type="button"
        onClick={onResetDraft}
        className={actionButtonClass('border-[#ff9ecb] bg-[#ffe0ef] text-[#b3206e] hover:bg-white')}
      >
        Reset Draft
      </button>
    </div>
          
      <div
        ref={canvasRef}
        className="relative w-full max-w-[460px] touch-none overflow-hidden rounded-[10px] ring-4 ring-[#a35ef6]"
        style={{
          aspectRatio: `${template.width} / ${template.height}`,
        }}
      >
        
      <FrameCanvas
        frame={frame}
        photos={photos}
        photoSlotCount={photoSlotCount}
        template={template}
        className="absolute inset-0 h-full w-full rounded-[10px]"
      />
      <div
        className="absolute inset-0 z-50"
        onPointerDown={onDrawStart}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawEnd}
        onPointerCancel={onDrawEnd}
      >
        {template.photoSlots.map((area) => {
          const isActive = activeAreaNumber === area.slotNumber;
          const sourcePhotoSlot = area.sourcePhotoSlot ?? area.slotNumber;

          return (
            <button
              key={area.slotNumber}
              type="button"
              onPointerDown={(event) => onAreaPointerDown(event, area)}
              onPointerMove={(event) => onAreaPointerMove(event, area)}
              onPointerUp={(event) => onAreaPointerUp(event, area)}
              onPointerLeave={(event) => onAreaPointerLeave(event, area)}
              className={`absolute flex items-start justify-start border-2 p-1 text-[10px] font-black text-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-colors ${
                isActive ? 'border-[#ff4bb5] bg-[#ff4bb5]/20' : 'border-white/80 bg-black/10 hover:border-[#4acaf1]'
              }`}
              style={getAreaStyle(area, template)}
            >
              <span className="rounded-[4px] bg-black/70 px-1.5 py-0.5">
                Area {area.slotNumber} / Photo {sourcePhotoSlot}
              </span>
              <div
                role="presentation"
                onPointerDown={(event) => onResizePointerDown(event, area)}
                onPointerMove={(event) => onResizePointerMove(event, area)}
                onPointerUp={(event) => onResizePointerUp(event, area)}
                onPointerLeave={(event) => onResizePointerLeave(event, area)}
                className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-sm border border-white bg-[#ff4bb5] shadow-md"
              />
            </button>
          );
        })}

        {drawingRectangle && (
          <div
            className="absolute border-2 border-[#4acaf1] bg-[#4acaf1]/15"
            style={getAreaStyle(
              {
                slotNumber: 0,
                x: drawingRectangle.x,
                y: drawingRectangle.y,
                width: drawingRectangle.width,
                height: drawingRectangle.height,
              },
              template,
            )}
          />
        )}
      </div>
    </div>
    </div>
  </section>
);