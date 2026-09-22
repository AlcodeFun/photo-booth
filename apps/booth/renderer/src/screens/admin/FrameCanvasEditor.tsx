import { Fragment, CSSProperties, PointerEvent, ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FrameConfig, FramePhotoPlacement, FrameQRPlacement, FrameTemplateConfig } from '@photo-booth/types';
import FrameCanvas from '../../components/FrameCanvas';
import { DrawingRectangle, ResizeHandle } from './types';

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getAreaStyle = (area: FramePhotoPlacement, template: FrameTemplateConfig): CSSProperties => ({
  left: toPercent(area.x, template.width),
  top: toPercent(area.y, template.height),
  width: toPercent(area.width, template.width),
  height: toPercent(area.height, template.height),
  borderRadius: area.borderRadius,
  transform: area.rotation ? `rotate(${area.rotation}deg)` : undefined,
});

interface FrameCanvasEditorProps {
  template: FrameTemplateConfig;
  frame: FrameConfig | null | undefined;
  photos: Array<string | undefined>;
  photoSlotCount: number;
  activeAreaNumber: number;
  selectedAreaNumbers: number[];
  drawingRectangle: DrawingRectangle | null;
  selectionRectangle: DrawingRectangle | null;
  drawMode: boolean;
  onToggleDrawMode: () => void;
  canvasRef: RefObject<HTMLDivElement>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddArea: () => void;
  onDrawStart: (event: PointerEvent<HTMLDivElement>) => void;
  onDrawMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDrawEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onAreaPointerDown: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerMove: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerUp: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onAreaPointerLeave: (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => void;
  onResizePointerDown: (
    event: PointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
    area: FramePhotoPlacement,
  ) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onResizePointerLeave: (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => void;
  onChangeAreaSourcePhoto: (slotNumber: number, sourcePhotoSlot: number) => void;
  /** Adds one more source photo slot (enabled only when sources < areas). */
  onAddSourcePhoto: () => void;
  /** Whether the source dropdown should show the "add source" option. */
  canAddSourcePhoto: boolean;
  onDeleteArea: () => void;
  onDuplicateArea: () => void;
  /** Clears the active + multi-selected areas (e.g. when clicking empty canvas). */
  onDeselect: () => void;
  /** Active (single) QR placeholder slot number, 0 = none. */
  activeQrSlotNumber: number;
  onAddQrSlot: () => void;
  onDuplicateQrSlot: () => void;
  onDeleteQrSlot: () => void;
  onQrPointerDown: (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => void;
  onQrPointerMove: (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => void;
  onQrPointerUp: (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => void;
  onQrPointerLeave: (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => void;
  onQrResizePointerDown: (
    event: PointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
    qrSlot: FrameQRPlacement,
  ) => void;
  onQrResizePointerMove: (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => void;
  onQrResizePointerUp: (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => void;
  onQrResizePointerLeave: (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => void;
  /** Panel content (frame settings, photo areas, ...) rendered in the sidebar. */
  sidebar?: ReactNode;
}

const actionButtonClass = (extra: string) =>
  `h-9 rounded-[10px] border-[3px] px-3.5 text-xs font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 ${extra}`;

const floatingButtonClass =
  'grid h-10 w-10 place-items-center rounded-full bg-white/90 backdrop-blur border-2 border-[#c9b8ff] text-[#5b3aa8] shadow-md transition hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

const dockButtonClass = (active: boolean) =>
  `flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-black uppercase tracking-[0.08em] transition-colors ${
    active ? 'bg-[#e9d7ff] text-[#4d2d85]' : 'text-[#7a4de3] hover:bg-[#f3ecff]'
  }`;

const IconUndo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M9.5 14L4.5 9l5-5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.5 9h9.5a6 6 0 0 1 0 12h-6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconRedo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M14.5 14l5-5-5-5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.5 9H10a6 6 0 0 0 0 12h6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPhoto: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 7h16v10H4z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="10" r="1.4" fill="currentColor" />
    <path d="M4 17l5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconTrash: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 7h14M10 7V5h4v2m-7 0l1 12h8l1-12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPanel: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 6h16v12H4z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M9 4v16M15 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconChevron: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPencil: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 20l4-1 11-11-3-3L5 16l-1 4z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M14 6l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconPlus: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const IconCopy: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
    <path
      d="M5 15V6a2 2 0 0 1 2-2h9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconQr: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 3h7v7H3zM4 4v5h5V4H4z" />
    <path d="M14 3h7v7h-7zM15 4v5h5V4h-5z" />
    <path d="M3 14h7v7H3zM4 15v5h5v-5H4z" />
    <path d="M14 14h1.8v1.8H14zM17 14h1.8v1.8H17zM14 17h1.8v1.8H14zM17.6 17h1.8v1.8h-1.8zM14 20h5v2h-5zM20 19.5h2v2.5h-2z" />
  </svg>
);

const RESIZE_HANDLES: Array<{ handle: ResizeHandle; className: string; cursor: string }> = [
  { handle: 'nw', className: '-left-1.5 -top-1.5', cursor: 'cursor-nwse-resize' },
  { handle: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { handle: 'ne', className: '-right-1.5 -top-1.5', cursor: 'cursor-nesw-resize' },
  { handle: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { handle: 'se', className: '-right-1.5 -bottom-1.5', cursor: 'cursor-nwse-resize' },
  { handle: 's', className: 'left-1/2 -bottom-1.5 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { handle: 'sw', className: '-left-1.5 -bottom-1.5', cursor: 'cursor-nesw-resize' },
  { handle: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
];

export const FrameCanvasEditor = ({
  template,
  frame,
  photos,
  photoSlotCount,
  activeAreaNumber,
  selectedAreaNumbers,
  drawingRectangle,
  selectionRectangle,
  drawMode,
  onToggleDrawMode,
  canvasRef,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddArea,
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
  onChangeAreaSourcePhoto,
  onAddSourcePhoto,
  canAddSourcePhoto,
  onDeleteArea,
  onDuplicateArea,
  onDeselect,
  activeQrSlotNumber,
  onAddQrSlot,
  onDuplicateQrSlot,
  onDeleteQrSlot,
  onQrPointerDown,
  onQrPointerMove,
  onQrPointerUp,
  onQrPointerLeave,
  onQrResizePointerDown,
  onQrResizePointerMove,
  onQrResizePointerUp,
  onQrResizePointerLeave,
  sidebar,
}: FrameCanvasEditorProps) => {
  const [sourceMenuFor, setSourceMenuFor] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }

    const computeFit = () => {
      const rect = area.getBoundingClientRect();
      const style = window.getComputedStyle(area);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = Math.max(0, rect.width - padX);
      const availableHeight = Math.max(0, rect.height - padY);
      const widthScale = template.width > 0 ? availableWidth / template.width : 0;
      const heightScale = template.height > 0 ? availableHeight / template.height : 0;
      const scale = Math.max(0, Math.min(widthScale, heightScale));
      setCanvasSize({
        width: availableWidth > 0 && availableHeight > 0 ? Math.floor(template.width * scale) : 0,
        height: availableWidth > 0 && availableHeight > 0 ? Math.floor(template.height * scale) : 0,
      });
    };

    computeFit();
    const observer = new ResizeObserver(computeFit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [template.width, template.height]);

  const selectedSet = new Set(selectedAreaNumbers);
  const activeArea = template.photoSlots.find((area) => area.slotNumber === activeAreaNumber);
  const activeQrSlot = template.qrSlots?.find((slot) => slot.slotNumber === activeQrSlotNumber);

  const clearCanvasSelection = () => {
    setSourceMenuFor(null);
    onDeselect();
  };

  const canvasRect = canvasRef.current?.getBoundingClientRect();

  const renderAreaPill = (
    placement: { x: number; y: number; width: number; height: number },
    buttons: ReactNode,
    extraMenuH = 0,
  ) => {
    if (!canvasRect) {
      return null;
    }

    const toPxX = (value: number) => canvasRect.left + (value / template.width) * canvasRect.width;
    const toPxY = (value: number) => canvasRect.top + (value / template.height) * canvasRect.height;

    const topRightX = toPxX(clamp(placement.x + placement.width, 0, template.width));
    const topLeftX = toPxX(clamp(placement.x, 0, template.width));
    const topY = toPxY(clamp(placement.y, 0, template.height));
    const bottomY = toPxY(clamp(placement.y + placement.height, 0, template.height));

    const pillW = 112;
    const pillH = 40;

    let leftPx = topRightX + 8;
    const leftBound = Math.max(8, Math.min(canvasRect.right, window.innerWidth) - pillW - 8);
    if (leftPx > leftBound) {
      leftPx = Math.max(8, topLeftX - pillW - 8);
    }
    leftPx = clamp(leftPx, 8, leftBound);

    let topPx = topY - pillH - 8 - extraMenuH;
    let flipBelow = false;
    if (topPx < 8) {
      flipBelow = true;
      topPx = bottomY + 8;
    }
    const topBound = Math.max(8, Math.min(canvasRect.bottom, window.innerHeight) - pillH - 8);
    if (flipBelow) {
      topPx = Math.min(topPx, topBound);
    } else {
      topPx = Math.max(8, Math.min(topPx, topBound));
    }

    return createPortal(
      <div className="fixed z-[200]" style={{ left: leftPx, top: flipBelow ? topPx : topPx + extraMenuH }}>
        <div
          className={`flex gap-1 rounded-full border border-[#c9b8ff] bg-white/95 p-1 shadow-lg ${
            flipBelow ? 'translate-y-0' : 'translate-y-[-110%]'
          }`}
        >
          {buttons}
        </div>
      </div>,
      document.body,
    );
  };

  const floatingPill = activeArea
    ? renderAreaPill(activeArea, (() => {
        const area = activeArea;
        const sourcePhotoSlot = area.sourcePhotoSlot ?? area.slotNumber;
        const menuOpen = sourceMenuFor === area.slotNumber;

        return (
          <>
            <div className="relative">
              <button
                type="button"
                title="Change source photo"
                onClick={(event) => {
                  event.stopPropagation();
                  setSourceMenuFor((current) => (current === area.slotNumber ? null : area.slotNumber));
                }}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] transition hover:bg-[#e9ff9e]"
              >
                <IconPhoto className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute bottom-11 right-0 z-[210] w-36 overflow-hidden rounded-[10px] border-2 border-[#c9b8ff] bg-white shadow-lg">
                  <p className="border-b border-[#efe8ff] bg-[#fbf3ff] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#7a4de3]">
                    Source Photo
                  </p>
                  {Array.from({ length: photoSlotCount }, (_, index) => index + 1).map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onChangeAreaSourcePhoto(area.slotNumber, source);
                        setSourceMenuFor(null);
                      }}
                      className={`block w-full px-3 py-1.5 text-left text-xs font-bold ${
                        source === sourcePhotoSlot
                          ? 'bg-[#d9f85a] text-[#4d2d85]'
                          : 'text-[#4d2d85] hover:bg-[#efe8ff]'
                      }`}
                    >
                      Photo {source}
                    </button>
                  ))}
                  {canAddSourcePhoto ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddSourcePhoto();
                      }}
                      className="block w-full border-t border-[#efe8ff] bg-[#fbf3ff] px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.08em] text-[#7a4de3] hover:bg-[#efe8ff]"
                    >
                      + Add source
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <button
              type="button"
              title="Duplicate area"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicateArea();
              }}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#8f6fee] bg-[#efe8ff] text-[#4d2d85] transition hover:bg-white"
            >
              <IconCopy className="h-4 w-4" />
            </button>

            <button
              type="button"
              title="Delete area"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteArea();
              }}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#ff9ecb] bg-[#ffe0ef] text-[#b3206e] transition hover:bg-white"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </>
        );
      })(), (() => {
        const menuOpen = sourceMenuFor === activeArea.slotNumber;
        return menuOpen ? 36 + photoSlotCount * 26 : 0;
      })())
    : null;

  const qrFloatingPill = activeQrSlot
    ? renderAreaPill(
        activeQrSlot,
        <>
          <button
            type="button"
            title="Duplicate QR"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateQrSlot();
            }}
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#16a34a] bg-[#e7ffe7] text-[#15803d] transition hover:bg-white"
          >
            <IconCopy className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Delete QR"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteQrSlot();
            }}
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#ff9ecb] bg-[#ffe0ef] text-[#b3206e] transition hover:bg-white"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </>,
      )
    : null;

  const actionButtons = (
    <>
      <button
        type="button"
        onClick={onToggleDrawMode}
        title="Draw mode: drag the canvas to create a photo area"
        className={actionButtonClass(
          drawMode
            ? 'border-[#ff4bb5] bg-[#ff4bb5] text-white hover:bg-[#ff6cc0]'
            : 'border-[#c9b8ff] bg-white text-[#5b3aa8] hover:bg-[#efe8ff]',
        )}
      >
        {drawMode ? '✕ Exit Draw' : '✚ Draw'}
      </button>
      <button
        type="button"
        onClick={onAddArea}
        title="Add a new photo area"
        className={actionButtonClass('border-[#a35ef6] bg-[#d9f85a] text-[#4d2d85] hover:bg-[#e9ff9e]')}
      >
        + Add Area
      </button>
      <button
        type="button"
        onClick={onAddQrSlot}
        title="Add a QR placeholder area"
        className={actionButtonClass('border-[#16a34a] bg-white text-[#15803d] hover:bg-[#e7ffe7]')}
      >
        + QR
      </button>
    </>
  );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fbf3ff]">
      <div className={`flex min-h-0 flex-1 transition-opacity ${mobilePanelOpen ? 'opacity-60' : ''}`}>
        {/* Canvas area — fills the full width */}
        <div
          ref={areaRef}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              clearCanvasSelection();
            }
          }}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-visible p-4 pb-20 lg:p-6 lg:pb-6"
        >
          <div className="absolute left-4 top-4 z-[80] flex gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={floatingButtonClass}
            >
              <IconUndo className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className={floatingButtonClass}
            >
              <IconRedo className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={canvasRef}
            className="relative touch-none bg-white shadow-[0_20px_50px_rgba(77,45,133,0.35)]"
            style={{
              width: canvasSize ? `${canvasSize.width}px` : undefined,
              height: canvasSize ? `${canvasSize.height}px` : undefined,
              aspectRatio: canvasSize ? undefined : `${template.width} / ${template.height}`,
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <FrameCanvas
                frame={frame}
                photos={photos}
                photoSlotCount={photoSlotCount}
                template={template}
                className="absolute inset-0 h-full w-full !border-0 !text-[#4d2d85]"
              />
            </div>

            <div
              className={`absolute inset-0 z-50 ${drawMode ? 'cursor-crosshair' : ''}`}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  clearCanvasSelection();
                }
                onDrawStart(event);
              }}
              onPointerMove={onDrawMove}
              onPointerUp={onDrawEnd}
              onPointerCancel={onDrawEnd}
            >
              {template.photoSlots.map((area) => {
                const isActive = activeAreaNumber === area.slotNumber;
                const isSelected = selectedSet.has(area.slotNumber);
                const sourcePhotoSlot = area.sourcePhotoSlot ?? area.slotNumber;

                return (
                  <Fragment key={area.slotNumber}>
                    <button
                      type="button"
                      onPointerDown={(event) => onAreaPointerDown(event, area)}
                      onPointerMove={(event) => onAreaPointerMove(event, area)}
                      onPointerUp={(event) => onAreaPointerUp(event, area)}
                      onPointerLeave={(event) => onAreaPointerLeave(event, area)}
                      className={`absolute flex items-start justify-start border-2 p-1 text-[10px] font-black text-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-colors ${
                        isActive
                          ? 'border-[#ff4bb5] bg-[#ff4bb5]/20'
                          : isSelected
                            ? 'border-[#4acaf1] bg-[#4acaf1]/15 hover:border-[#4acaf1]'
                            : 'border-white/80 bg-black/10 hover:border-[#4acaf1]'
                      }`}
                      style={getAreaStyle(area, template)}
                    >
                      <span className="rounded-[4px] bg-black/70 px-1.5 py-0.5">
                        Area {area.slotNumber} / Photo {sourcePhotoSlot}
                      </span>

                      {isActive &&
                        RESIZE_HANDLES.map(({ handle, className, cursor }) => (
                          <div
                            key={handle}
                            role="presentation"
                            onPointerDown={(event) => onResizePointerDown(event, handle, area)}
                            onPointerMove={(event) => onResizePointerMove(event, area)}
                            onPointerUp={(event) => onResizePointerUp(event, area)}
                            onPointerLeave={(event) => onResizePointerLeave(event, area)}
                            className={`absolute h-3 w-3 rounded-sm border border-white bg-[#a35ef6] shadow-md ${className} ${cursor}`}
                          />
                        ))}
                    </button>
                  </Fragment>
                );
              })}

              {template.qrSlots?.map((qrSlot) => {
                const isActive = activeQrSlotNumber === qrSlot.slotNumber;

                return (
                  <button
                    key={`qr-${qrSlot.slotNumber}`}
                    type="button"
                    onPointerDown={(event) => onQrPointerDown(event, qrSlot)}
                    onPointerMove={(event) => onQrPointerMove(event, qrSlot)}
                    onPointerUp={(event) => onQrPointerUp(event, qrSlot)}
                    onPointerLeave={(event) => onQrPointerLeave(event, qrSlot)}
                    className={`absolute flex flex-col items-center justify-center gap-1 overflow-hidden bg-white text-zinc-900 transition-colors ${
                      isActive
                        ? 'border-[3px] border-[#22c55e] ring-2 ring-[#22c55e]/40'
                        : 'border-2 border-[#22c55e]/70 hover:border-[#22c55e]'
                    }`}
                    style={getAreaStyle(qrSlot, template)}
                  >
                    <IconQr className="h-[40%] w-[40%] text-zinc-900" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                      QR {qrSlot.slotNumber}
                    </span>

                    {isActive &&
                      RESIZE_HANDLES.map(({ handle, className, cursor }) => (
                        <div
                          key={handle}
                          role="presentation"
                          onPointerDown={(event) => onQrResizePointerDown(event, handle, qrSlot)}
                          onPointerMove={(event) => onQrResizePointerMove(event, qrSlot)}
                          onPointerUp={(event) => onQrResizePointerUp(event, qrSlot)}
                          onPointerLeave={(event) => onQrResizePointerLeave(event, qrSlot)}
                          className={`absolute h-3 w-3 rounded-sm border border-white bg-[#22c55e] shadow-md ${className} ${cursor}`}
                        />
                      ))}
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

              {selectionRectangle && (
                <div
                  className="absolute border-2 border-dashed border-[#ff4bb5] bg-[#ff4bb5]/10"
                  style={getAreaStyle(
                    {
                      slotNumber: 0,
                      x: selectionRectangle.x,
                      y: selectionRectangle.y,
                      width: selectionRectangle.width,
                      height: selectionRectangle.height,
                    },
                    template,
                  )}
                />
              )}
            </div>
          </div>

          {/* Re-open collapsed floating panel */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              title="Show panels"
              className="absolute right-3 top-1/2 z-[85] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border-2 border-[#8f6fee] bg-white/95 text-[#4d2d85] shadow-lg transition hover:bg-white lg:grid"
            >
              <IconPanel className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Desktop floating panel overlay */}
        <aside
          className={`pointer-events-auto absolute right-3 top-1/2 z-[90] hidden max-h-[calc(100%-24px)] w-[380px] max-w-[calc(100%-24px)] -translate-y-1/2 flex-col overflow-hidden rounded-[14px] border-[3px] border-[#a35ef6] bg-[#fbf3ff] shadow-[0_16px_48px_rgba(77,45,133,0.35)] transition-all duration-200 lg:flex ${
            sidebarOpen
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-[110%] opacity-0'
          }`}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#e5c9ff] px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Panels</h2>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Collapse panels"
              className="grid h-9 w-9 place-items-center rounded-[10px] border-[3px] border-[#c9b8ff] bg-white text-[#5b3aa8] transition hover:bg-[#efe8ff]"
            >
              <IconChevron className="h-4 w-4 rotate-180" />
            </button>
          </header>
          <div className="pb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-4 flex flex-wrap gap-2">{actionButtons}</div>
            <div className="grid gap-4">{sidebar}</div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom dock */}
      <div className="absolute inset-x-0 bottom-0 z-[120] border-t-2 border-[#c9b8ff] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-stretch gap-1 px-2 py-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            className={dockButtonClass(false)}
          >
            <IconUndo className="h-5 w-5" />
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            className={dockButtonClass(false)}
          >
            <IconRedo className="h-5 w-5" />
            Redo
          </button>
          <button
            type="button"
            onClick={onToggleDrawMode}
            title="Toggle draw mode"
            className={dockButtonClass(drawMode)}
          >
            <IconPencil className="h-5 w-5" />
            Draw
          </button>
          <button
            type="button"
            onClick={onAddArea}
            title="Add a new photo area"
            className={dockButtonClass(false)}
          >
            <IconPlus className="h-5 w-5" />
            Add Area
          </button>
          <button
            type="button"
            onClick={onAddQrSlot}
            title="Add a QR placeholder"
            className={dockButtonClass(false)}
          >
            <IconQr className="h-5 w-5" />
            QR
          </button>
          <button
            type="button"
            onClick={() => setMobilePanelOpen((current) => !current)}
            title="Panels"
            className={dockButtonClass(mobilePanelOpen)}
          >
            <IconPanel className="h-5 w-5" />
            Panels
          </button>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={`absolute inset-x-0 bottom-14 z-[110] flex max-h-[68vh] flex-col overflow-hidden rounded-t-[18px] border-t-[3px] border-[#a35ef6] bg-[#fbf3ff] shadow-[0_-12px_40px_rgba(77,45,133,0.25)] transition-transform duration-300 ease-out lg:hidden ${
          mobilePanelOpen ? 'translate-y-0' : 'pointer-events-none translate-y-[calc(100%+3.5rem)]'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#e5c9ff] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Panels</h2>
          </div>
          <button
            type="button"
            onClick={() => setMobilePanelOpen(false)}
            className="rounded-full border-2 border-[#c9b8ff] bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8]"
          >
            Close
          </button>
        </header>
        <div className="pb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mb-4 flex flex-wrap gap-2">{actionButtons}</div>
          <div className="grid gap-4">{sidebar}</div>
        </div>
      </div>

      {floatingPill}
      {qrFloatingPill}
    </section>
  );
};