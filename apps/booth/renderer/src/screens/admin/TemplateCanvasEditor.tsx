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

export const TemplateCanvasEditor = ({
  template,
  frame,
  photos,
  photoSlotCount,
  activeAreaNumber,
  drawingRectangle,
  canvasRef,
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
  <section className="flex min-h-[70vh] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
    <div
      ref={canvasRef}
      className="relative w-full max-w-[460px] touch-none overflow-hidden rounded-lg"
      style={{
        aspectRatio: `${template.width} / ${template.height}`,
      }}
    >
      <FrameCanvas
        frame={frame}
        photos={photos}
        photoSlotCount={photoSlotCount}
        template={template}
        className="absolute inset-0 h-full w-full rounded-lg"
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
              className={`absolute flex items-start justify-start border-2 bg-sky-300/10 p-1 text-[10px] font-black text-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-colors ${
                isActive ? 'border-sky-300' : 'border-white/70 hover:border-sky-200'
              }`}
              style={getAreaStyle(area, template)}
            >
              <span className="rounded bg-black/70 px-1.5 py-0.5">
                Area {area.slotNumber} / Photo {sourcePhotoSlot}
              </span>
              <div
                role="presentation"
                onPointerDown={(event) => onResizePointerDown(event, area)}
                onPointerMove={(event) => onResizePointerMove(event, area)}
                onPointerUp={(event) => onResizePointerUp(event, area)}
                onPointerLeave={(event) => onResizePointerLeave(event, area)}
                className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-sm border border-sky-100 bg-sky-400/90 shadow-md"
              />
            </button>
          );
        })}

        {drawingRectangle && (
          <div
            className="absolute border-2 border-emerald-300 bg-emerald-300/15"
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
  </section>
);