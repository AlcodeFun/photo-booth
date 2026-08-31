import React, {
  ChangeEvent,
  CSSProperties,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FramePhotoFit, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { MOCK_FRAMES, MOCK_LAYOUTS } from '../data/mockData';
import { useFramesWithTemplateDrafts } from '../hooks/useFramesWithTemplateDrafts';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';
import {
  clearFrameTemplateDraft,
  getFrameTemplateDraft,
  saveFrameTemplateDraft,
} from '../utils/frameTemplateDrafts';
import { useSessionStore } from '../store/sessionStore';

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

interface CanvasPoint {
  x: number;
  y: number;
}

type DragState =
  | {
      type: 'draw';
      start: CanvasPoint;
      current: CanvasPoint;
    }
  | {
      type: 'move';
      areaSlotNumber: number;
      start: CanvasPoint;
      current: CanvasPoint;
      origin: {
        x: number;
        y: number;
      };
    }
  | {
      type: 'resize';
      areaSlotNumber: number;
      start: CanvasPoint;
      current: CanvasPoint;
      origin: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };

const MAX_SOURCE_PHOTOS = 9;
const MAX_PHOTO_AREAS = 16;
const MIN_DRAW_SIZE = 24;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const toNumericValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeSourcePhotoSlot = (value: number | undefined, sourcePhotoCount: number) =>
  clamp(Math.floor(value ?? 1), 1, sourcePhotoCount);

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const getAreaStyle = (area: FramePhotoPlacement, template: FrameTemplateConfig): CSSProperties => ({
  left: toPercent(area.x, template.width),
  top: toPercent(area.y, template.height),
  width: toPercent(area.width, template.width),
  height: toPercent(area.height, template.height),
  borderRadius: area.borderRadius,
  transform: area.rotation ? `rotate(${area.rotation}deg)` : undefined,
});

const normalizeAreas = (areas: FramePhotoPlacement[], sourcePhotoCount: number) =>
  areas.map((area, index) => ({
    ...area,
    slotNumber: index + 1,
    sourcePhotoSlot: normalizeSourcePhotoSlot(area.sourcePhotoSlot ?? area.slotNumber, sourcePhotoCount),
  }));

const cloneTemplate = (template: FrameTemplateConfig, sourcePhotoCount: number): FrameTemplateConfig => ({
  ...template,
  photoSlots: normalizeAreas(
    template.photoSlots.length > 0
      ? template.photoSlots.map((area) => ({ ...area }))
      : [createDefaultArea(1, sourcePhotoCount, template)],
    sourcePhotoCount,
  ),
});

function createDefaultArea(
  slotNumber: number,
  sourcePhotoCount: number,
  template: FrameTemplateConfig,
): FramePhotoPlacement {
  const width = Math.min(420, template.width - 160);
  const height = Math.min(300, template.height - 220);
  const offset = ((slotNumber - 1) % 4) * 34;

  return {
    slotNumber,
    sourcePhotoSlot: clamp(slotNumber, 1, sourcePhotoCount),
    x: clamp(120 + offset, 0, template.width - width),
    y: clamp(140 + offset, 0, template.height - height),
    width,
    height,
    borderRadius: 24,
    zIndex: 10,
    objectFit: 'cover',
    objectPosition: 'center',
  };
}

const NumberField = ({ label, value, min, max, step = 1, onChange }: NumberFieldProps) => (
  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
    {label}
    <input
      type="number"
      value={value ?? 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(toNumericValue(event.target.value))}
      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400"
    />
  </label>
);

export const FrameTemplateAdminScreen: React.FC = () => {
  const resetSession = useSessionStore((state) => state.resetSession);

  const handleAdminReset = () => {
    resetSession();
    window.location.hash = '#/';
  };

  const defaultSourcePhotoCount = useMemo(() => {
    const counts = MOCK_LAYOUTS.map((layout) => layout.photoSlots);
    return Math.max(...counts, 3);
  }, []);
  const [sourcePhotoCount, setSourcePhotoCount] = useState(defaultSourcePhotoCount);
  const frames = useFramesWithTemplateDrafts(MOCK_FRAMES, sourcePhotoCount);
  const [selectedFrameId, setSelectedFrameId] = useState(MOCK_FRAMES[0]?.id ?? '');
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null;
  const baseFrame = MOCK_FRAMES.find((frame) => frame.id === selectedFrameId) ?? MOCK_FRAMES[0] ?? null;
  const [draftTemplate, setDraftTemplate] = useState<FrameTemplateConfig>(() =>
    cloneTemplate(resolveFrameTemplate(MOCK_FRAMES[0], defaultSourcePhotoCount), defaultSourcePhotoCount),
  );
  const [activeAreaNumber, setActiveAreaNumber] = useState(1);
  const [samplePhotos, setSamplePhotos] = useState<Array<string | undefined>>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedFrame) {
      return;
    }

    const storedDraft = getFrameTemplateDraft(selectedFrame.id, sourcePhotoCount);
    const nextTemplate = cloneTemplate(
      storedDraft ?? resolveFrameTemplate(selectedFrame, sourcePhotoCount),
      sourcePhotoCount,
    );
    setDraftTemplate(nextTemplate);
    setActiveAreaNumber(nextTemplate.photoSlots[0]?.slotNumber ?? 1);
  }, [sourcePhotoCount, selectedFrame, selectedFrameId]);

  useEffect(() => {
    setSamplePhotos((currentPhotos) =>
      Array.from({ length: sourcePhotoCount }, (_, index) => currentPhotos[index]),
    );
  }, [sourcePhotoCount]);

  const activeArea = draftTemplate.photoSlots.find((area) => area.slotNumber === activeAreaNumber);
  const exportTemplate = (() => {
    const jsonText = JSON.stringify({ [sourcePhotoCount]: draftTemplate }, null, 2);
    const tsObjectText = jsonText
      .replace(/"(\d+)":/g, '$1:')
      .replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:');

    return `const customFrameTemplate: FrameConfig['templatesByPhotoSlots'] = ${tsObjectText};`;
  })();
  const drawingRectangle = dragState && dragState.type === 'draw'
    ? {
        x: Math.min(dragState.start.x, dragState.current.x),
        y: Math.min(dragState.start.y, dragState.current.y),
        width: Math.abs(dragState.current.x - dragState.start.x),
        height: Math.abs(dragState.current.y - dragState.start.y),
      }
    : null;

  const getCanvasPoint = (event: PointerEvent<HTMLDivElement>): CanvasPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * draftTemplate.width, 0, draftTemplate.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * draftTemplate.height, 0, draftTemplate.height),
    };
  };

  const updateTemplate = (updates: Partial<FrameTemplateConfig>) => {
    setDraftTemplate((template) => ({
      ...template,
      ...updates,
    }));
    setStatus('');
  };

  const updateActiveArea = (updates: Partial<FramePhotoPlacement>) => {
    setDraftTemplate((template) => ({
      ...template,
      photoSlots: template.photoSlots.map((area) =>
        area.slotNumber === activeAreaNumber ? { ...area, ...updates } : area,
      ),
    }));
    setStatus('');
  };

  const handleSourcePhotoCountChange = (value: number) => {
    setSourcePhotoCount(clamp(Math.floor(value), 1, MAX_SOURCE_PHOTOS));
    setStatus('');
  };

  const setPhotoAreaCount = (value: number) => {
    const nextCount = clamp(Math.floor(value), 1, MAX_PHOTO_AREAS);

    setDraftTemplate((template) => {
      const nextAreas = normalizeAreas(template.photoSlots, sourcePhotoCount).slice(0, nextCount);

      while (nextAreas.length < nextCount) {
        nextAreas.push(createDefaultArea(nextAreas.length + 1, sourcePhotoCount, template));
      }

      return {
        ...template,
        photoSlots: normalizeAreas(nextAreas, sourcePhotoCount),
      };
    });

    setActiveAreaNumber((currentAreaNumber) => clamp(currentAreaNumber, 1, nextCount));
    setStatus('');
  };

  const handleAddArea = () => {
    const nextAreaNumber = draftTemplate.photoSlots.length + 1;
    if (nextAreaNumber > MAX_PHOTO_AREAS) {
      return;
    }

    setDraftTemplate((template) => ({
      ...template,
      photoSlots: [
        ...template.photoSlots,
        createDefaultArea(template.photoSlots.length + 1, sourcePhotoCount, template),
      ],
    }));
    setActiveAreaNumber(nextAreaNumber);
    setStatus('');
  };

  const handleDuplicateArea = () => {
    if (!activeArea) {
      return;
    }

    const nextAreaNumber = draftTemplate.photoSlots.length + 1;
    if (nextAreaNumber > MAX_PHOTO_AREAS) {
      return;
    }

    const width = activeArea.width;
    const height = activeArea.height;
    const duplicatedArea: FramePhotoPlacement = {
      ...activeArea,
      slotNumber: nextAreaNumber,
      x: clamp(activeArea.x + 36, 0, draftTemplate.width - width),
      y: clamp(activeArea.y + 36, 0, draftTemplate.height - height),
    };

    setDraftTemplate((template) => ({
      ...template,
      photoSlots: [...template.photoSlots, duplicatedArea],
    }));
    setActiveAreaNumber(nextAreaNumber);
    setStatus('');
  };

  const handleDeleteArea = () => {
    if (draftTemplate.photoSlots.length <= 1) {
      return;
    }

    setDraftTemplate((template) => {
      const nextAreas = normalizeAreas(
        template.photoSlots.filter((area) => area.slotNumber !== activeAreaNumber),
        sourcePhotoCount,
      );

      return {
        ...template,
        photoSlots: nextAreas,
      };
    });
    setActiveAreaNumber((currentAreaNumber) => clamp(currentAreaNumber - 1, 1, draftTemplate.photoSlots.length - 1));
    setStatus('');
  };

  const handleDrawStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      type: 'draw',
      start: point,
      current: point,
    });
    setStatus('');
  };

  const handleDrawMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.type !== 'draw') {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    setDragState((currentDragState) =>
      currentDragState && currentDragState.type === 'draw'
        ? {
            ...currentDragState,
            current: point,
          }
        : currentDragState,
    );
  };

  const handleDrawEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.type !== 'draw') {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const point = getCanvasPoint(event) ?? dragState.current;
    const nextArea = {
      x: Math.min(dragState.start.x, point.x),
      y: Math.min(dragState.start.y, point.y),
      width: Math.abs(point.x - dragState.start.x),
      height: Math.abs(point.y - dragState.start.y),
    };
    setDragState(null);

    if (nextArea.width < MIN_DRAW_SIZE || nextArea.height < MIN_DRAW_SIZE) {
      return;
    }

    setDraftTemplate((template) => {
      const slotNumber = template.photoSlots.length + 1;
      if (slotNumber > MAX_PHOTO_AREAS) {
        return template;
      }

      const sourcePhotoSlot = activeArea?.sourcePhotoSlot ?? clamp(slotNumber, 1, sourcePhotoCount);

      return {
        ...template,
        photoSlots: [
          ...template.photoSlots,
          {
            slotNumber,
            sourcePhotoSlot,
            x: Math.round(nextArea.x),
            y: Math.round(nextArea.y),
            width: Math.round(nextArea.width),
            height: Math.round(nextArea.height),
            borderRadius: 18,
            zIndex: 10,
            objectFit: 'cover',
            objectPosition: 'center',
          },
        ],
      };
    });
    setActiveAreaNumber(draftTemplate.photoSlots.length + 1);
  };

  const handleAreaPointerDown = (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveAreaNumber(area.slotNumber);
    setDragState({
      type: 'move',
      areaSlotNumber: area.slotNumber,
      start: point,
      current: point,
      origin: {
        x: area.x,
        y: area.y,
      },
    });
    setStatus('');
  };

  const handleAreaPointerMove = (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => {
    if (!dragState || dragState.type !== 'move' || dragState.areaSlotNumber !== area.slotNumber) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;
    const nextX = clamp(dragState.origin.x + dx, 0, draftTemplate.width - area.width);
    const nextY = clamp(dragState.origin.y + dy, 0, draftTemplate.height - area.height);

    updateActiveArea({ x: nextX, y: nextY });
    setDragState((currentDragState) =>
      currentDragState && currentDragState.type === 'move' && currentDragState.areaSlotNumber === area.slotNumber
        ? {
            ...currentDragState,
            current: point,
          }
        : currentDragState,
    );
  };

  const handleAreaPointerUp = (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && (dragState.type === 'move' || dragState.type === 'resize') && dragState.areaSlotNumber === area.slotNumber) {
      setDragState(null);
    }
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveAreaNumber(area.slotNumber);
    setDragState({
      type: 'resize',
      areaSlotNumber: area.slotNumber,
      start: point,
      current: point,
      origin: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    });
    setStatus('');
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => {
    if (!dragState || dragState.type !== 'resize' || dragState.areaSlotNumber !== area.slotNumber) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    const deltaX = point.x - dragState.start.x;
    const deltaY = point.y - dragState.start.y;
    const nextWidth = clamp(dragState.origin.width + deltaX, 24, draftTemplate.width - dragState.origin.x);
    const nextHeight = clamp(dragState.origin.height + deltaY, 24, draftTemplate.height - dragState.origin.y);

    updateActiveArea({ width: nextWidth, height: nextHeight });
    setDragState((currentDragState) =>
      currentDragState && currentDragState.type === 'resize' && currentDragState.areaSlotNumber === area.slotNumber
        ? {
            ...currentDragState,
            current: point,
          }
        : currentDragState,
    );
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && dragState.type === 'resize' && dragState.areaSlotNumber === area.slotNumber) {
      setDragState(null);
    }
  };

  const handleSampleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
    setSamplePhotos((currentPhotos) => {
      const nextPhotos = Array.from({ length: sourcePhotoCount }, (_, index) => currentPhotos[index]);

      dataUrls.forEach((url, index) => {
        nextPhotos[index % sourcePhotoCount] = url;
      });

      return nextPhotos;
    });
    event.target.value = '';
  };

  const handleSaveDraft = () => {
    if (!selectedFrame) {
      return;
    }

    saveFrameTemplateDraft(selectedFrame.id, sourcePhotoCount, draftTemplate);
    setStatus('Draft saved');
  };

  const handleResetDraft = () => {
    if (!baseFrame) {
      return;
    }

    clearFrameTemplateDraft(baseFrame.id, sourcePhotoCount);
    const nextTemplate = cloneTemplate(resolveFrameTemplate(baseFrame, sourcePhotoCount), sourcePhotoCount);
    setDraftTemplate(nextTemplate);
    setActiveAreaNumber(nextTemplate.photoSlots[0]?.slotNumber ?? 1);
    setStatus('Draft reset');
  };

  const handleCopyTemplate = async () => {
    if (!navigator.clipboard) {
      setStatus('Clipboard unavailable');
      return;
    }

    await navigator.clipboard.writeText(exportTemplate);
    setStatus('Template copied');
  };

  if (!selectedFrame) {
    return <div className="p-8 text-zinc-400">No frames available.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">Hidden Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Frame Fitter</h1>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              Booth Flow
            </a>
            <button
              type="button"
              onClick={handleAdminReset}
              className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 hover:bg-rose-900/60"
            >
              Reset Session
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(440px,1.1fr)]">
        <section className="flex min-h-[70vh] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div
            ref={canvasRef}
            className="relative w-full max-w-[460px] touch-none overflow-hidden rounded-lg"
            style={{
              aspectRatio: `${draftTemplate.width} / ${draftTemplate.height}`,
            }}
          >
            <FrameCanvas
              frame={selectedFrame}
              photos={samplePhotos}
              photoSlotCount={sourcePhotoCount}
              template={draftTemplate}
              className="absolute inset-0 h-full w-full rounded-lg"
            />
            <div
              className="absolute inset-0 z-50"
              onPointerDown={handleDrawStart}
              onPointerMove={handleDrawMove}
              onPointerUp={handleDrawEnd}
              onPointerCancel={handleDrawEnd}
            >
              {draftTemplate.photoSlots.map((area) => {
                const isActive = activeAreaNumber === area.slotNumber;
                const sourcePhotoSlot = area.sourcePhotoSlot ?? area.slotNumber;

                return (
                  <button
                    key={area.slotNumber}
                    type="button"
                    onPointerDown={(event) => handleAreaPointerDown(event, area)}
                    onPointerMove={(event) => handleAreaPointerMove(event, area)}
                    onPointerUp={(event) => handleAreaPointerUp(event, area)}
                    onPointerLeave={(event) => {
                      if (
                        dragState &&
                        (dragState.type === 'move' || dragState.type === 'resize') &&
                        dragState.areaSlotNumber === area.slotNumber
                      ) {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        setDragState(null);
                      }
                    }}
                    className={`absolute flex items-start justify-start border-2 bg-sky-300/10 p-1 text-[10px] font-black text-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-colors ${
                      isActive ? 'border-sky-300' : 'border-white/70 hover:border-sky-200'
                    }`}
                    style={getAreaStyle(area, draftTemplate)}
                  >
                    <span className="rounded bg-black/70 px-1.5 py-0.5">
                      Area {area.slotNumber} / Photo {sourcePhotoSlot}
                    </span>
                    <div
                      role="presentation"
                      onPointerDown={(event) => handleResizePointerDown(event, area)}
                      onPointerMove={(event) => handleResizePointerMove(event, area)}
                      onPointerUp={(event) => handleResizePointerUp(event, area)}
                      onPointerLeave={(event) => {
                        if (
                          dragState &&
                          dragState.type === 'resize' &&
                          dragState.areaSlotNumber === area.slotNumber &&
                          event.currentTarget.hasPointerCapture(event.pointerId)
                        ) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                          setDragState(null);
                        }
                      }}
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
                    draftTemplate,
                  )}
                />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Frame
              <select
                value={selectedFrame.id}
                onChange={(event) => setSelectedFrameId(event.target.value)}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400"
              >
                {frames.map((frame) => (
                  <option key={frame.id} value={frame.id}>
                    {frame.name}
                  </option>
                ))}
              </select>
            </label>

            <NumberField
              label="Source Photos"
              value={sourcePhotoCount}
              min={1}
              max={MAX_SOURCE_PHOTOS}
              onChange={handleSourcePhotoCountChange}
            />

            <NumberField
              label="Photo Areas"
              value={draftTemplate.photoSlots.length}
              min={1}
              max={MAX_PHOTO_AREAS}
              onChange={setPhotoAreaCount}
            />

            <NumberField
              label="Frame Z"
              value={draftTemplate.frameLayerZIndex}
              min={0}
              onChange={(value) => updateTemplate({ frameLayerZIndex: value })}
            />

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:col-span-2">
              Template Asset
              <input
                type="text"
                value={draftTemplate.assetUrl}
                onChange={(event) => updateTemplate({ assetUrl: event.target.value })}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400"
              />
            </label>

            <NumberField
              label="Canvas Width"
              value={draftTemplate.width}
              min={1}
              onChange={(value) => updateTemplate({ width: value })}
            />
            <NumberField
              label="Canvas Height"
              value={draftTemplate.height}
              min={1}
              onChange={(value) => updateTemplate({ height: value })}
            />

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Background
              <input
                type="color"
                value={draftTemplate.backgroundColor ?? '#111111'}
                onChange={(event) => updateTemplate({ backgroundColor: event.target.value })}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sample Photos
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleSampleUpload}
                className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
              />
            </label>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {draftTemplate.photoSlots.map((area) => (
                <button
                  key={area.slotNumber}
                  type="button"
                  onClick={() => setActiveAreaNumber(area.slotNumber)}
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
                onClick={handleAddArea}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
              >
                Add Area
              </button>
              <button
                type="button"
                onClick={handleDuplicateArea}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500"
              >
                Duplicate Area
              </button>
              <button
                type="button"
                onClick={handleDeleteArea}
                disabled={draftTemplate.photoSlots.length <= 1}
                className="h-10 rounded-lg border border-rose-800 px-4 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Area
              </button>
            </div>

            {activeArea && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Source
                  <select
                    value={activeArea.sourcePhotoSlot ?? activeArea.slotNumber}
                    onChange={(event) =>
                      updateActiveArea({
                        sourcePhotoSlot: normalizeSourcePhotoSlot(toNumericValue(event.target.value), sourcePhotoCount),
                      })
                    }
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400"
                  >
                    {Array.from({ length: sourcePhotoCount }, (_, index) => index + 1).map((sourcePhotoSlot) => (
                      <option key={sourcePhotoSlot} value={sourcePhotoSlot}>
                        Photo {sourcePhotoSlot}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField label="X" value={activeArea.x} min={0} onChange={(value) => updateActiveArea({ x: value })} />
                <NumberField label="Y" value={activeArea.y} min={0} onChange={(value) => updateActiveArea({ y: value })} />
                <NumberField
                  label="Width"
                  value={activeArea.width}
                  min={1}
                  onChange={(value) => updateActiveArea({ width: value })}
                />
                <NumberField
                  label="Height"
                  value={activeArea.height}
                  min={1}
                  onChange={(value) => updateActiveArea({ height: value })}
                />
                <NumberField
                  label="Rotation"
                  value={activeArea.rotation ?? 0}
                  step={0.5}
                  onChange={(value) => updateActiveArea({ rotation: value })}
                />
                <NumberField
                  label="Radius"
                  value={activeArea.borderRadius ?? 0}
                  min={0}
                  onChange={(value) => updateActiveArea({ borderRadius: value })}
                />
                <NumberField
                  label="Photo Z"
                  value={activeArea.zIndex ?? 10}
                  min={0}
                  onChange={(value) => updateActiveArea({ zIndex: value })}
                />
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Fit
                  <select
                    value={activeArea.objectFit ?? 'cover'}
                    onChange={(event) => updateActiveArea({ objectFit: event.target.value as FramePhotoFit })}
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400"
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="h-11 rounded-lg bg-white px-5 text-sm font-black text-black transition-colors hover:bg-zinc-200"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleCopyTemplate}
                className="h-11 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-950"
              >
                Copy Ready Template
              </button>
              <button
                type="button"
                onClick={() => setSamplePhotos([])}
                className="h-11 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-950"
              >
                Clear Photos
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                className="h-11 rounded-lg border border-rose-800 px-5 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-500 hover:bg-rose-950/40"
              >
                Reset Draft
              </button>
              {status && <span className="self-center text-sm font-semibold text-sky-300">{status}</span>}
            </div>

            <textarea
              value={exportTemplate}
              readOnly
              className="min-h-48 resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default FrameTemplateAdminScreen;
