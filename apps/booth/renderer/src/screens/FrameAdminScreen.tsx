import React, {
  ChangeEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FrameConfig, FramePhotoPlacement, FrameQRPlacement, FrameTemplateConfig } from '@photo-booth/types';
import { MOCK_FRAMES, MOCK_LAYOUTS } from '../data/mockData';
import { useFramesWithDrafts } from '../hooks/useFramesWithDrafts';
import { useFrameHistory } from '../hooks/useFrameHistory';
import {
  listFrameTemplates,
  saveFrameTemplate,
  uploadFrameAsset,
} from '../lib/frames';
import { navigateToAdmin, navigateToBooth } from '../lib/navigation';
import { pushSnackbar } from '../lib/snackbarBus';
import { processFrameAsset } from '../utils/greenScreenDetection';
import { resolveFrameTemplate } from '../utils/frameConfig';
import {
  clearFrameTemplateDraft,
  getFrameTemplateDraft,
} from '../utils/frameDrafts';
import { ColorField, FileField, NumberField, TextField } from './admin/fields';
import { PhotoAreasPanel } from './admin/PhotoAreasPanel';
import { QrSlotsPanel } from './admin/QrSlotsPanel';
import { FrameCanvasEditor } from './admin/FrameCanvasEditor';
import { CanvasPoint, DragState, DrawingRectangle, ResizeHandle } from './admin/types';

const MAX_SOURCE_PHOTOS = 9;
const MAX_PHOTO_AREAS = 16;
const MIN_DRAW_SIZE = 24;
const MIN_RESIZE_SIZE = 24;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame';

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const normalizeSourcePhotoSlot = (value: number | undefined, sourcePhotoCount: number) =>
  clamp(Math.floor(value ?? 1), 1, sourcePhotoCount);

const normalizeAreas = (areas: FramePhotoPlacement[], sourcePhotoCount: number): FramePhotoPlacement[] =>
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
  qrSlots: (template.qrSlots ?? []).map((qrSlot, index) => ({ ...qrSlot, slotNumber: index + 1 })),
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
    borderRadius: 0,
    zIndex: 10,
    objectFit: 'cover',
    objectPosition: 'center',
  };
}

function createDefaultQrSlot(slotNumber: number, template: FrameTemplateConfig): FrameQRPlacement {
  const size = 360;

  return {
    slotNumber,
    x: clamp(template.width - size - 60, 0, Math.max(0, template.width - size)),
    y: clamp(template.height - size - 60, 0, Math.max(0, template.height - size)),
    width: size,
    height: size,
    borderRadius: 0,
    zIndex: 50,
  };
}

export const FrameAdminScreen: React.FC = () => {
  const handleBackToBooth = () => {
    navigateToBooth();
  };

  const urlParams = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const searchParams = new URLSearchParams(window.location.search);
    return new URLSearchParams({ ...Object.fromEntries(searchParams), ...Object.fromEntries(hashParams) });
  }, []);
  const editTargetId = urlParams.get('edit');
  const isFromTemplates = urlParams.get('from') === 'templates';

  const handleBack = useCallback(() => {
    if (isFromTemplates) {
      navigateToAdmin('templates');
      return;
    }
    handleBackToBooth();
  }, [isFromTemplates]);

  const defaultSourcePhotoCount = useMemo(() => {
    const counts = MOCK_LAYOUTS.map((layout) => layout.photoSlots);
    return Math.max(...counts, 3);
  }, []);
  const [sourcePhotoCount, setSourcePhotoCount] = useState(defaultSourcePhotoCount);
  const [catalogFrames, setCatalogFrames] = useState<FrameConfig[]>(MOCK_FRAMES);
  const [selectedFrameId, setSelectedFrameId] = useState<string>(editTargetId ?? '__new__');
  const isNewFrame = selectedFrameId === '__new__';
  const frames = useFramesWithDrafts(catalogFrames, sourcePhotoCount);
  const selectedFrame = isNewFrame ? null : frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null;
  const baseFrame = isNewFrame ? null : catalogFrames.find((frame) => frame.id === selectedFrameId) ?? catalogFrames[0] ?? null;
  const [frameName, setFrameName] = useState('Custom Static Frame');
  const [nameError, setNameError] = useState(false);
  const [activeAreaNumber, setActiveAreaNumber] = useState(1);
  const [selectedAreaNumbers, setSelectedAreaNumbers] = useState<number[]>([1]);
  const [activeQrSlotNumber, setActiveQrSlotNumber] = useState(0);
  const [selectedQrSlotNumbers, setSelectedQrSlotNumbers] = useState<number[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [snackbarLeaving, setSnackbarLeaving] = useState(false);

  useEffect(() => {
    if (!status) {
      return;
    }
    if (loading) {
      setSnackbarLeaving(false);
      return;
    }
    const leavingTimer = window.setTimeout(() => setSnackbarLeaving(true), 3200);
    const clearTimer = window.setTimeout(() => {
      setStatus('');
      setSnackbarLeaving(false);
    }, 3200 + 350);
    return () => {
      window.clearTimeout(leavingTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status, loading]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
const nudgeRef = useRef(false);

  const initialTemplate = useMemo(
    () => cloneTemplate(resolveFrameTemplate(MOCK_FRAMES[0], defaultSourcePhotoCount), defaultSourcePhotoCount),
    [defaultSourcePhotoCount],
  );
  const {
    template: draftTemplate,
    commit: setDraftTemplate,
    replace: replaceDraftTemplate,
    snapshot: pushHistorySnapshot,
    reset: resetDraftTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useFrameHistory(initialTemplate);

  const frameId = isNewFrame ? slugify(frameName) : selectedFrame?.id ?? slugify(frameName);

  const loadRemoteFrames = useCallback(async (notify: boolean) => {
    try {
      const remote = await listFrameTemplates();
      if (remote.length > 0) {
        setCatalogFrames(remote);
        setSelectedFrameId((current) =>
          current === '__new__' || remote.some((frame) => frame.id === current) ? current : '__new__',
        );
        if (notify) {
          setStatus(`Loaded ${remote.length} frames`);
        }
      } else if (notify) {
        setStatus('No frames yet');
      }
    } catch (error) {
      setStatus(notify ? `Sync failed: ${String(error)}` : `Using local frames: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    loadRemoteFrames(false);
  }, [loadRemoteFrames]);

  useEffect(() => {
    if (isNewFrame) {
      const blankTemplate = cloneTemplate(resolveFrameTemplate(null, sourcePhotoCount), sourcePhotoCount);
      resetDraftTemplate(blankTemplate);
      setActiveAreaNumber(blankTemplate.photoSlots[0]?.slotNumber ?? 1);
      setFrameName('Custom Static Frame');
      return;
    }

    if (!selectedFrame) {
      return;
    }

    const adoptedCount = selectedFrame.photoSlots ?? sourcePhotoCount;
    if (adoptedCount > 0 && adoptedCount !== sourcePhotoCount) {
      setSourcePhotoCount(adoptedCount);
    }

    const storedDraft = getFrameTemplateDraft(selectedFrame.id, adoptedCount);
    const nextTemplate = cloneTemplate(
      storedDraft ?? resolveFrameTemplate(selectedFrame, adoptedCount),
      adoptedCount,
    );
    resetDraftTemplate(nextTemplate);
    setActiveAreaNumber(nextTemplate.photoSlots[0]?.slotNumber ?? 1);
    setFrameName(selectedFrame.name);
  }, [isNewFrame, selectedFrame, selectedFrameId]);

  const activeArea = draftTemplate.photoSlots.find((area) => area.slotNumber === activeAreaNumber);
  const activeQrSlot = draftTemplate.qrSlots?.find((slot) => slot.slotNumber === activeQrSlotNumber);
  const drawingRectangle: DrawingRectangle | null =
    dragState && dragState.type === 'draw'
      ? {
          x: Math.min(dragState.start.x, dragState.current.x),
          y: Math.min(dragState.start.y, dragState.current.y),
          width: Math.abs(dragState.current.x - dragState.start.x),
          height: Math.abs(dragState.current.y - dragState.start.y),
        }
      : null;
  const selectionRectangle: DrawingRectangle | null =
    dragState && dragState.type === 'select'
      ? {
          x: Math.min(dragState.start.x, dragState.current.x),
          y: Math.min(dragState.start.y, dragState.current.y),
          width: Math.abs(dragState.current.x - dragState.start.x),
          height: Math.abs(dragState.current.y - dragState.start.y),
        }
      : null;

  const getCanvasPoint = (event: { clientX: number; clientY: number }): CanvasPoint | null => {
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

  const rotateTemplate = () => {
    const clockwise = draftTemplate.width < draftTemplate.height;
    setDraftTemplate((template) => {
      const { width: w, height: h } = template;
      const rotatePlacement = <
        T extends { x: number; y: number; width: number; height: number },
      >(
        item: T,
      ): T => {
        const next = clockwise
          ? {
              x: h - item.y - item.height,
              y: item.x,
              width: item.height,
              height: item.width,
            }
          : {
              x: item.y,
              y: w - item.x - item.width,
              width: item.height,
              height: item.width,
            };
        return {
          ...item,
          x: Math.round(next.x),
          y: Math.round(next.y),
          width: Math.round(next.width),
          height: Math.round(next.height),
        };
      };
      return {
        ...template,
        width: h,
        height: w,
        photoSlots: template.photoSlots.map(rotatePlacement),
        qrSlots: (template.qrSlots ?? []).map(rotatePlacement),
      };
    });
    setStatus('');
  };

  const updateActiveArea = (updates: Partial<FramePhotoPlacement>) => {
    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      photoSlots: template.photoSlots.map((area) =>
        area.slotNumber === activeAreaNumber ? { ...area, ...updates } : area,
      ),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
    setStatus('');
  };

  const changeAreaSourcePhoto = (slotNumber: number, sourcePhotoSlot: number) => {
    const targets =
      selectedAreaNumbers.length > 0 && selectedAreaNumbers.includes(slotNumber)
        ? selectedAreaNumbers
        : [slotNumber];
    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      photoSlots: template.photoSlots.map((area) =>
        targets.includes(area.slotNumber)
          ? { ...area, sourcePhotoSlot: normalizeSourcePhotoSlot(sourcePhotoSlot, sourcePhotoCount) }
          : area,
      ),
    });
    setDraftTemplate(updater);
    setStatus('');
  };

  const handleSourcePhotoCountChange = (value: number) => {
    const nextCount = clamp(Math.floor(value), 1, MAX_SOURCE_PHOTOS);
    setActiveAreaNumber((currentAreaNumber) => clamp(currentAreaNumber, 1, nextCount));
    setSelectedAreaNumbers((current) => current.map((n) => clamp(n, 1, nextCount)));
    setSourcePhotoCount(nextCount);
    setStatus('');
  };

  const handleAddSourcePhoto = () => {
    if (sourcePhotoCount >= draftTemplate.photoSlots.length || sourcePhotoCount >= MAX_SOURCE_PHOTOS) {
      return;
    }
    handleSourcePhotoCountChange(sourcePhotoCount + 1);
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
    setSelectedAreaNumbers((current) => current.map((n) => clamp(n, 1, nextCount)));
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
    setSelectedAreaNumbers([nextAreaNumber]);
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
    setStatus('');
  };

  const handleDuplicateArea = () => {
    const targets = selectedAreaNumbers.length > 0 ? selectedAreaNumbers : [activeAreaNumber];

    const nextAreaNumber = draftTemplate.photoSlots.length + 1;
    if (nextAreaNumber + targets.length - 1 > MAX_PHOTO_AREAS) {
      return;
    }

    const duplicatedAreas: FramePhotoPlacement[] = targets.map((slotNumber, index) => {
      const source = draftTemplate.photoSlots.find((area) => area.slotNumber === slotNumber);
      if (!source) {
        return createDefaultArea(nextAreaNumber + index, sourcePhotoCount, draftTemplate);
      }
      const width = source.width;
      const height = source.height;
      const offset = 36 * (index + 1);
      return {
        ...source,
        slotNumber: nextAreaNumber + index,
        x: clamp(source.x + offset, 0, draftTemplate.width - width),
        y: clamp(source.y + offset, 0, draftTemplate.height - height),
      };
    });

    setDraftTemplate((template) => ({
      ...template,
      photoSlots: [...template.photoSlots, ...duplicatedAreas],
    }));
    const first = duplicatedAreas[0]?.slotNumber ?? nextAreaNumber;
    setActiveAreaNumber(first);
    setSelectedAreaNumbers(duplicatedAreas.map((area) => area.slotNumber));
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
    setStatus('');
  };

  const handleDeleteArea = () => {
    const targets = selectedAreaNumbers.length > 0 ? selectedAreaNumbers : [activeAreaNumber];
    if (targets.length === 0 || activeAreaNumber === 0) {
      return false;
    }

    setDraftTemplate((template) => {
      const remaining = template.photoSlots.filter((area) => !targets.includes(area.slotNumber));

      if (remaining.length === 0) {
        return {
          ...template,
          photoSlots: [],
        };
      }

      const nextAreas = normalizeAreas(remaining, sourcePhotoCount);
      return {
        ...template,
        photoSlots: nextAreas,
      };
    });

    const remainingCount = Math.max(draftTemplate.photoSlots.length - targets.length, 0);
    if (remainingCount === 0) {
      setActiveAreaNumber(0);
      setSelectedAreaNumbers([]);
    } else {
      setActiveAreaNumber((currentAreaNumber) => clamp(currentAreaNumber - 1, 1, remainingCount));
      setSelectedAreaNumbers([1]);
    }
    setStatus('');
    return true;
  };

  const selectArea = (slotNumber: number) => {
    setActiveAreaNumber(slotNumber);
    setSelectedAreaNumbers([slotNumber]);
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
  };

  const handleDeselectAll = useCallback(() => {
    setActiveAreaNumber(0);
    setSelectedAreaNumbers([]);
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
    setStatus('');
  }, []);

  const toggleAreaSelection = (slotNumber: number) => {
    setActiveAreaNumber(slotNumber);
    setSelectedAreaNumbers((current) =>
      current.includes(slotNumber) ? current.filter((n) => n !== slotNumber) : [...current, slotNumber].sort((a, b) => a - b),
    );
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
  };

  const rangeSelectAreas = (slotNumber: number) => {
    const anchor = activeAreaNumber;
    const from = Math.min(anchor, slotNumber);
    const to = Math.max(anchor, slotNumber);
    const slots = draftTemplate.photoSlots
      .map((area) => area.slotNumber)
      .filter((n) => n >= from && n <= to);
    setActiveAreaNumber(slotNumber);
    setSelectedAreaNumbers(slots);
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
  };

  const applyToSelectedAreas = (
    updater: (area: FramePhotoPlacement, template: FrameTemplateConfig) => FramePhotoPlacement,
  ) => {
    const targets = selectedAreaNumbers.length > 0 ? selectedAreaNumbers : [activeAreaNumber];
    replaceDraftTemplate((template) => ({
      ...template,
      photoSlots: template.photoSlots.map((area) =>
        targets.includes(area.slotNumber) ? updater(area, template) : area,
      ),
    }));
  };

  const applyToSelectedQrSlots = (
    updater: (slot: FrameQRPlacement, template: FrameTemplateConfig) => FrameQRPlacement,
  ) => {
    const targets = selectedQrSlotNumbers.length > 0 ? selectedQrSlotNumbers : [activeQrSlotNumber];
    replaceDraftTemplate((template) => ({
      ...template,
      qrSlots: (template.qrSlots ?? []).map((slot) =>
        targets.includes(slot.slotNumber) ? updater(slot, template) : slot,
      ),
    }));
  };

  const handleDeleteQrSlot = () => {
    const targets = selectedQrSlotNumbers.length > 0 ? selectedQrSlotNumbers : [activeQrSlotNumber];
    if (targets.length === 0 || activeQrSlotNumber === 0) {
      return false;
    }

    setDraftTemplate((template) => {
      const remaining = (template.qrSlots ?? []).filter((slot) => !targets.includes(slot.slotNumber));
      return {
        ...template,
        qrSlots: remaining.map((slot, index) => ({ ...slot, slotNumber: index + 1 })),
      };
    });

    const remainingCount = Math.max((draftTemplate.qrSlots?.length ?? 0) - targets.length, 0);
    if (remainingCount === 0) {
      setActiveQrSlotNumber(0);
      setSelectedQrSlotNumbers([]);
    } else {
      setActiveQrSlotNumber(1);
      setSelectedQrSlotNumbers([1]);
    }
    setStatus('');
    return true;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'z' && event.shiftKey) {
          event.preventDefault();
          redo();
        } else if (key === 'z') {
          event.preventDefault();
          undo();
        } else if (key === 'y') {
          event.preventDefault();
          redo();
        } else if (key === 'a') {
          event.preventDefault();
          setSelectedAreaNumbers(draftTemplate.photoSlots.map((area) => area.slotNumber));
        }
        return;
      }

      if (isTyping) {
        return;
      }

      const nudgeStep = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowUp') {
        dy = -nudgeStep;
      } else if (event.key === 'ArrowDown') {
        dy = nudgeStep;
      } else if (event.key === 'ArrowLeft') {
        dx = -nudgeStep;
      } else if (event.key === 'ArrowRight') {
        dx = nudgeStep;
      }

      if (dx !== 0 || dy !== 0) {
        const targets = selectedAreaNumbers.length > 0 ? selectedAreaNumbers : [activeAreaNumber];
        if (targets.length > 0) {
          event.preventDefault();
          if (!nudgeRef.current) {
            pushHistorySnapshot();
            nudgeRef.current = true;
          }
          applyToSelectedAreas((area, template) => ({
            ...area,
            x: clamp(Math.round(area.x + dx), 0, Math.max(0, template.width - area.width)),
            y: clamp(Math.round(area.y + dy), 0, Math.max(0, template.height - area.height)),
          }));
          setStatus('');
        } else {
          const qrTargets = selectedQrSlotNumbers.length > 0 ? selectedQrSlotNumbers : [activeQrSlotNumber];
          if (qrTargets.length > 0 && activeQrSlotNumber > 0) {
            event.preventDefault();
            if (!nudgeRef.current) {
              pushHistorySnapshot();
              nudgeRef.current = true;
            }
            applyToSelectedQrSlots((slot, template) => ({
              ...slot,
              x: clamp(Math.round(slot.x + dx), 0, Math.max(0, template.width - slot.width)),
              y: clamp(Math.round(slot.y + dy), 0, Math.max(0, template.height - slot.height)),
            }));
            setStatus('');
          }
        }
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      if (handleDeleteArea()) {
        event.preventDefault();
      } else if (activeAreaNumber === 0 && handleDeleteQrSlot()) {
        event.preventDefault();
      }
    };
    const handleKeyUp = () => {
      nudgeRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, handleDeleteArea, handleDeleteQrSlot, activeArea, activeAreaNumber, activeQrSlotNumber, selectedAreaNumbers, selectedQrSlotNumbers, draftTemplate, pushHistorySnapshot, replaceDraftTemplate, applyToSelectedAreas, applyToSelectedQrSlots, setStatus]);

  const handleDrawStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState(
      drawMode
        ? {
            type: 'draw',
            start: point,
            current: point,
          }
        : {
            type: 'select',
            start: point,
            current: point,
          },
    );
    setStatus('');
  };

  const handleDrawMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || (dragState.type !== 'draw' && dragState.type !== 'select')) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    setDragState((currentDragState) =>
      currentDragState && (currentDragState.type === 'draw' || currentDragState.type === 'select')
        ? {
            ...currentDragState,
            current: point,
          }
        : currentDragState,
    );
  };

  const handleDrawEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || (dragState.type !== 'draw' && dragState.type !== 'select')) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const point = getCanvasPoint(event) ?? dragState.current;

    if (dragState.type === 'select') {
      const box = {
        x: Math.min(dragState.start.x, point.x),
        y: Math.min(dragState.start.y, point.y),
        width: Math.abs(point.x - dragState.start.x),
        height: Math.abs(point.y - dragState.start.y),
      };
      setDragState(null);
      if (box.width < MIN_DRAW_SIZE / 2 || box.height < MIN_DRAW_SIZE / 2) {
        return;
      }
      const selected = draftTemplate.photoSlots.filter((area) => {
        const inside = area.x + area.width >= box.x && area.x <= box.x + box.width && area.y + area.height >= box.y && area.y <= box.y + box.height;
        return inside;
      });
      const nextNumbers = selected.map((area) => area.slotNumber);
      if (nextNumbers.length > 0) {
        setActiveAreaNumber(nextNumbers[0]);
        setSelectedAreaNumbers(nextNumbers);
      } else {
        setActiveAreaNumber(draftTemplate.photoSlots[0]?.slotNumber ?? 1);
        setSelectedAreaNumbers([]);
      }
      setActiveQrSlotNumber(0);
      setSelectedQrSlotNumbers([]);
      return;
    }

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
            borderRadius: 0,
            zIndex: 10,
            objectFit: 'cover',
            objectPosition: 'center',
          },
        ],
      };
    });
    setActiveAreaNumber(draftTemplate.photoSlots.length + 1);
    setSelectedAreaNumbers([draftTemplate.photoSlots.length + 1]);
    setActiveQrSlotNumber(0);
    setSelectedQrSlotNumbers([]);
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

    if (event.shiftKey) {
      rangeSelectAreas(area.slotNumber);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      toggleAreaSelection(area.slotNumber);
      return;
    }

    const isPartOfGroup =
      selectedAreaNumbers.includes(area.slotNumber) && selectedAreaNumbers.length > 1;
    const targets = isPartOfGroup ? selectedAreaNumbers : [area.slotNumber];
    if (!isPartOfGroup) {
      selectArea(area.slotNumber);
    } else {
      setActiveAreaNumber(area.slotNumber);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistorySnapshot();
    draggingRef.current = true;
    setDragState({
      type: 'move',
      areaSlotNumber: area.slotNumber,
      start: point,
      current: point,
      origins: draftTemplate.photoSlots
        .filter((slot) => targets.includes(slot.slotNumber))
        .map((slot) => ({ slotNumber: slot.slotNumber, x: slot.x, y: slot.y })),
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

    const next = dragState.origins.map((origin) => {
      const slot = draftTemplate.photoSlots.find((item) => item.slotNumber === origin.slotNumber);
      const moveWidth = slot?.width ?? 1;
      const moveHeight = slot?.height ?? 1;
      return {
        slotNumber: origin.slotNumber,
        x: clamp(origin.x + dx, 0, Math.max(0, draftTemplate.width - moveWidth)),
        y: clamp(origin.y + dy, 0, Math.max(0, draftTemplate.height - moveHeight)),
      };
    });

    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      photoSlots: template.photoSlots.map((slot) => {
        const nudge = next.find((item) => item.slotNumber === slot.slotNumber);
        return nudge ? { ...slot, x: nudge.x, y: nudge.y } : slot;
      }),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
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
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && (dragState.type === 'move' || dragState.type === 'resize') && dragState.areaSlotNumber === area.slotNumber) {
      setDragState(null);
    }
  };

  const handleAreaPointerLeave = (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => {
    if (
      dragState &&
      (dragState.type === 'move' || dragState.type === 'resize') &&
      dragState.areaSlotNumber === area.slotNumber
    ) {
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragState(null);
    }
  };

  const handleResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
    area: FramePhotoPlacement,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistorySnapshot();
    draggingRef.current = true;
    const targets =
      selectedAreaNumbers.length > 0 && selectedAreaNumbers.includes(area.slotNumber)
        ? selectedAreaNumbers
        : [area.slotNumber];
    setDragState({
      type: 'resize',
      areaSlotNumber: area.slotNumber,
      handle,
      start: point,
      current: point,
      origins: draftTemplate.photoSlots
        .filter((slot) => targets.includes(slot.slotNumber))
        .map((slot) => ({
          slotNumber: slot.slotNumber,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
        })),
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

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;

    const next = dragState.origins.map((origin) => {
      let nextX = origin.x;
      let nextY = origin.y;
      let nextWidth = origin.width;
      let nextHeight = origin.height;

      const pushRight = dragState.handle.includes('e');
      const pushLeft = dragState.handle.includes('w');
      const pushDown = dragState.handle.includes('s');
      const pushUp = dragState.handle.includes('n');

      if (pushRight) {
        nextWidth = clamp(origin.width + dx, MIN_RESIZE_SIZE, draftTemplate.width - nextX);
      }
      if (pushLeft) {
        nextWidth = clamp(origin.width - dx, MIN_RESIZE_SIZE, Math.min(draftTemplate.width, origin.x + origin.width));
        nextX = clamp(origin.x + (origin.width - nextWidth), 0, Math.max(0, draftTemplate.width - nextWidth));
      }
      if (pushDown) {
        nextHeight = clamp(origin.height + dy, MIN_RESIZE_SIZE, draftTemplate.height - nextY);
      }
      if (pushUp) {
        nextHeight = clamp(origin.height - dy, MIN_RESIZE_SIZE, Math.min(draftTemplate.height, origin.y + origin.height));
        nextY = clamp(origin.y + (origin.height - nextHeight), 0, Math.max(0, draftTemplate.height - nextHeight));
      }

      return {
        slotNumber: origin.slotNumber,
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      };
    });

    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      photoSlots: template.photoSlots.map((slot) => {
        const change = next.find((item) => item.slotNumber === slot.slotNumber);
        return change ? { ...slot, ...change } : slot;
      }),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
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
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && dragState.type === 'resize' && dragState.areaSlotNumber === area.slotNumber) {
      setDragState(null);
    }
  };

  const handleResizePointerLeave = (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => {
    if (
      dragState &&
      dragState.type === 'resize' &&
      dragState.areaSlotNumber === area.slotNumber &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  };

  const updateActiveQrSlot = (updates: Partial<FrameQRPlacement>) => {
    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      qrSlots: (template.qrSlots ?? []).map((slot) =>
        slot.slotNumber === activeQrSlotNumber ? { ...slot, ...updates } : slot,
      ),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
    setStatus('');
  };

  const selectQrSlot = (slotNumber: number) => {
    setActiveAreaNumber(0);
    setSelectedAreaNumbers([]);
    setActiveQrSlotNumber(slotNumber);
    setSelectedQrSlotNumbers([slotNumber]);
  };

  const handleAddQrSlot = () => {
    const nextNumber = (draftTemplate.qrSlots?.length ?? 0) + 1;

    setDraftTemplate((template) => ({
      ...template,
      qrSlots: [...(template.qrSlots ?? []), createDefaultQrSlot(nextNumber, template)],
    }));
    selectQrSlot(nextNumber);
    setStatus('');
  };

  const handleDuplicateQrSlot = () => {
    const targets = selectedQrSlotNumbers.length > 0 ? selectedQrSlotNumbers : [activeQrSlotNumber];
    if (targets.length === 0 || activeQrSlotNumber === 0) {
      return false;
    }

    const nextNumber = (draftTemplate.qrSlots?.length ?? 0) + 1;
    const duplicated = targets.map((slotNumber, index) => {
      const source = draftTemplate.qrSlots?.find((slot) => slot.slotNumber === slotNumber);
      if (!source) {
        return createDefaultQrSlot(nextNumber + index, draftTemplate);
      }
      const offset = 36 * (index + 1);
      return {
        ...source,
        slotNumber: nextNumber + index,
        x: clamp(source.x + offset, 0, Math.max(0, draftTemplate.width - source.width)),
        y: clamp(source.y + offset, 0, Math.max(0, draftTemplate.height - source.height)),
      };
    });

    setDraftTemplate((template) => ({
      ...template,
      qrSlots: [...(template.qrSlots ?? []), ...duplicated],
    }));
    const first = duplicated[0]?.slotNumber ?? nextNumber;
    selectQrSlot(first);
    setSelectedQrSlotNumbers(duplicated.map((slot) => slot.slotNumber));
    setStatus('');
    return true;
  };

  const handleQrPointerDown = (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.stopPropagation();
    selectQrSlot(qrSlot.slotNumber);
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistorySnapshot();
    draggingRef.current = true;
    setDragState({
      type: 'move',
      areaSlotNumber: qrSlot.slotNumber,
      start: point,
      current: point,
      origins: [{ slotNumber: qrSlot.slotNumber, x: qrSlot.x, y: qrSlot.y }],
    });
    setStatus('');
  };

  const handleQrPointerMove = (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => {
    if (!dragState || dragState.type !== 'move' || dragState.areaSlotNumber !== qrSlot.slotNumber) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;

    const next = dragState.origins.map((origin) => {
      const slot = draftTemplate.qrSlots?.find((item) => item.slotNumber === origin.slotNumber);
      const moveWidth = slot?.width ?? 1;
      const moveHeight = slot?.height ?? 1;
      return {
        slotNumber: origin.slotNumber,
        x: clamp(origin.x + dx, 0, Math.max(0, draftTemplate.width - moveWidth)),
        y: clamp(origin.y + dy, 0, Math.max(0, draftTemplate.height - moveHeight)),
      };
    });

    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      qrSlots: (template.qrSlots ?? []).map((slot) => {
        const nudge = next.find((item) => item.slotNumber === slot.slotNumber);
        return nudge ? { ...slot, x: nudge.x, y: nudge.y } : slot;
      }),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
    setDragState((currentDragState) =>
      currentDragState && currentDragState.type === 'move' && currentDragState.areaSlotNumber === qrSlot.slotNumber
        ? { ...currentDragState, current: point }
        : currentDragState,
    );
  };

  const handleQrPointerUp = (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && (dragState.type === 'move' || dragState.type === 'resize') && dragState.areaSlotNumber === qrSlot.slotNumber) {
      setDragState(null);
    }
  };

  const handleQrPointerLeave = (event: PointerEvent<HTMLButtonElement>, qrSlot: FrameQRPlacement) => {
    if (
      dragState &&
      (dragState.type === 'move' || dragState.type === 'resize') &&
      dragState.areaSlotNumber === qrSlot.slotNumber
    ) {
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragState(null);
    }
  };

  const handleQrResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
    qrSlot: FrameQRPlacement,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    event.stopPropagation();
    selectQrSlot(qrSlot.slotNumber);
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistorySnapshot();
    draggingRef.current = true;
    setDragState({
      type: 'resize',
      areaSlotNumber: qrSlot.slotNumber,
      handle,
      start: point,
      current: point,
      origins: [{ slotNumber: qrSlot.slotNumber, x: qrSlot.x, y: qrSlot.y, width: qrSlot.width, height: qrSlot.height }],
    });
    setStatus('');
  };

  const handleQrResizePointerMove = (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => {
    if (!dragState || dragState.type !== 'resize' || dragState.areaSlotNumber !== qrSlot.slotNumber) {
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;

    const next = dragState.origins.map((origin) => {
      const minSize = MIN_RESIZE_SIZE;
      const maxSize = Math.min(draftTemplate.width, draftTemplate.height);

      const pushRight = dragState.handle.includes('e');
      const pushLeft = dragState.handle.includes('w');
      const pushDown = dragState.handle.includes('s');
      const pushUp = dragState.handle.includes('n');

      let nextSize = origin.width;
      if (pushRight || pushLeft) {
        nextSize = pushRight ? origin.width + dx : origin.width - dx;
      } else if (pushUp) {
        nextSize = origin.height - dy;
      } else if (pushDown) {
        nextSize = origin.height + dy;
      }

      let nextX = origin.x;
      let nextY = origin.y;
      if (pushLeft) {
        nextSize = clamp(nextSize, minSize, origin.x + origin.width);
        nextX = origin.x + origin.width - nextSize;
      } else if (pushRight) {
        nextSize = clamp(nextSize, minSize, Math.max(minSize, draftTemplate.width - origin.x));
      }
      if (pushUp) {
        nextSize = clamp(nextSize, minSize, origin.y + origin.height);
        nextY = origin.y + origin.height - nextSize;
      } else if (pushDown) {
        nextSize = clamp(nextSize, minSize, Math.max(minSize, draftTemplate.height - origin.y));
      }

      nextSize = Math.min(nextSize, maxSize);
      nextX = clamp(nextX, 0, Math.max(0, draftTemplate.width - nextSize));
      nextY = clamp(nextY, 0, Math.max(0, draftTemplate.height - nextSize));

      return {
        slotNumber: origin.slotNumber,
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextSize),
        height: Math.round(nextSize),
      };
    });

    const updater = (template: FrameTemplateConfig): FrameTemplateConfig => ({
      ...template,
      qrSlots: (template.qrSlots ?? []).map((slot) => {
        const change = next.find((item) => item.slotNumber === slot.slotNumber);
        return change ? { ...slot, ...change } : slot;
      }),
    });
    if (draggingRef.current) {
      replaceDraftTemplate(updater);
    } else {
      setDraftTemplate(updater);
    }
    setDragState((currentDragState) =>
      currentDragState && currentDragState.type === 'resize' && currentDragState.areaSlotNumber === qrSlot.slotNumber
        ? { ...currentDragState, current: point }
        : currentDragState,
    );
  };

  const handleQrResizePointerUp = (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && dragState.type === 'resize' && dragState.areaSlotNumber === qrSlot.slotNumber) {
      setDragState(null);
    }
  };

  const handleQrResizePointerLeave = (event: PointerEvent<HTMLDivElement>, qrSlot: FrameQRPlacement) => {
    if (
      dragState &&
      dragState.type === 'resize' &&
      dragState.areaSlotNumber === qrSlot.slotNumber &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  };

  const handleLoadFrameFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    loadFrameFile(file);
  };

  const handleDropFrameFile = (file: File) => {
    if (!file) {
      return;
    }
    loadFrameFile(file);
  };

  const loadFrameFile = async (file: File) => {
    setLoading(true);
    setStatus('Loading frame, detecting green screen...');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const processed = await processFrameAsset(dataUrl);

      let assetUrl = processed.assetUrl;
      let uploaded = false;

      try {
        const pngFile = new File([dataUrlToBlob(processed.assetUrl)], `${frameId}-processed.png`, {
          type: 'image/png',
        });
        assetUrl = await uploadFrameAsset(frameId, pngFile);
        uploaded = true;
      } catch {
        // Keep the local data URL when the upload fails.
      }

      const nextSlots: FramePhotoPlacement[] = processed.regions.map((region, index) => ({
        slotNumber: index + 1,
        sourcePhotoSlot: clamp(index + 1, 1, Math.max(sourcePhotoCount, processed.regions.length)),
        x: Math.round(region.x),
        y: Math.round(region.y),
        width: Math.round(region.width),
        height: Math.round(region.height),
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      }));

      setDraftTemplate((template) => ({
        ...template,
        assetUrl,
        width: processed.width,
        height: processed.height,
        photoSlots: nextSlots.length > 0 ? nextSlots : template.photoSlots,
      }));

      setActiveAreaNumber(1);

      if (processed.regions.length > 0) {
        setSourcePhotoCount((current) => clamp(Math.max(current, processed.regions.length), 1, MAX_SOURCE_PHOTOS));
        setStatus(
          `Detected ${processed.regions.length} green screen area(s), green keyed to transparent${uploaded ? '' : ' (local)'}`,
        );
      } else {
        setStatus('No green screen detected - draw areas manually');
      }
    } catch (error) {
      setStatus(`Load failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = () => {
    if (isNewFrame) {
      const blankTemplate = cloneTemplate(resolveFrameTemplate(null, sourcePhotoCount), sourcePhotoCount);
      resetDraftTemplate(blankTemplate);
      setActiveAreaNumber(blankTemplate.photoSlots[0]?.slotNumber ?? 1);
      setStatus('Reset to blank');
      return;
    }

    if (!baseFrame) {
      return;
    }

    clearFrameTemplateDraft(baseFrame.id, sourcePhotoCount);
    const nextTemplate = cloneTemplate(resolveFrameTemplate(baseFrame, sourcePhotoCount), sourcePhotoCount);
    resetDraftTemplate(nextTemplate);
    setActiveAreaNumber(nextTemplate.photoSlots[0]?.slotNumber ?? 1);
    setStatus('Draft reset');
  };

  const handleSave = async () => {
    if (draftTemplate.photoSlots.length === 0) {
      setStatus('Add at least one area before saving');
      return;
    }
    if (!frameName.trim()) {
      setNameError(true);
      setStatus('Frame name is required');
      return;
    }
    setNameError(false);

    setStatus('Saving...');
    try {
      const existingTemplates = selectedFrame?.templatesByPhotoSlots ?? {};
      const frameConfig: FrameConfig = {
        id: frameId.trim(),
        name: frameName.trim() || 'Untitled Frame',
        previewUrl: isNewFrame ? draftTemplate.assetUrl : selectedFrame?.previewUrl ?? draftTemplate.assetUrl,
        photoSlots: selectedFrame?.photoSlots ?? sourcePhotoCount,
        templatesByPhotoSlots: {
          ...existingTemplates,
          [sourcePhotoCount]: draftTemplate,
        },
      };

      await saveFrameTemplate(frameConfig);
      await loadRemoteFrames(true);
      pushSnackbar(`Saved "${frameConfig.name}"`, 'success');
      navigateToAdmin('templates');
    } catch (error) {
      pushSnackbar(`Save failed: ${String(error)}`, 'error');
      navigateToAdmin('templates');
    }
  };

  const onWindowDragOver = (event: React.DragEvent) => {
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault();
      setDragActive(true);
    }
  };

  return (
    <div
      className="flex h-screen w-screen flex-col gap-4 bg-[#d9f85a]"
      onDragOver={onWindowDragOver}
      onDragEnter={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) {
          event.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const file = event.dataTransfer.files?.[0];
        handleDropFrameFile(file);
      }}
    >
      {dragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-[#140b26]/70">
          <div className="flex items-center gap-3 rounded-[16px] border-[3px] border-dashed border-[#d9f85a] bg-[#4d2d85]/90 px-6 py-4 text-xl font-black uppercase tracking-[0.12em] text-[#d9f85a] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
              <path
                d="M5 12h14M12 5v14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            Drop frame file to replace
          </div>
        </div>
      ) : null}
      {status ? (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-[120] flex justify-center px-4">
          <div
            className={`flex items-center gap-2 rounded-full border-2 border-[#a35ef6] bg-[#140b26] px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#d9f85a] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
              snackbarLeaving ? 'pb-snackbar-out' : 'pb-snackbar-in'
            }`}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-[3px] border-t-transparent" />
            ) : null}
            {status}
          </div>
        </div>
      ) : null}
      <header className="flex shrink-0 flex-wrap justify-between items-center gap-2 border-b-2 border-[#4d2d85]/20 px-3 py-1.5">
      <div className="flex items-center gap-2">
           <button
          type="button"
          onClick={handleBack}
          title="Back"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[#4d2d85] bg-[#4d2d85] text-[#d9f85a] transition-all hover:bg-[#5b3aa8] active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

          <h1 className="text-base font-black uppercase tracking-[-0.04em] text-[#4d2d85]">
          {isNewFrame ? 'Add Frame' : 'Edit Frame'}
        </h1>
</div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetDraft}
            title="Reset draft"
            className="rounded-md border-2 border-[#ff9ecb] bg-[#ffe0ef] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#b3206e] transition-all hover:bg-white active:scale-95"
          >
            Reset Draft
          </button>
          <button
            type="button"
            onClick={handleSave}
            title="Save frame"
            className="rounded-md border-2 border-[#a35ef6] bg-[#d9f85a] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#4d2d85] transition-all hover:bg-[#e9ff9e] active:scale-95"
          >
            Save Frame
          </button>
        </div>
      </header>
      <FrameCanvasEditor
          template={draftTemplate}
          frame={selectedFrame}
          photos={[]}
          photoSlotCount={sourcePhotoCount}
          activeAreaNumber={activeAreaNumber}
          selectedAreaNumbers={selectedAreaNumbers}
          drawingRectangle={drawingRectangle}
          selectionRectangle={selectionRectangle}
          drawMode={drawMode}
          onToggleDrawMode={() => setDrawMode((current) => !current)}
          canvasRef={canvasRef}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAddArea={handleAddArea}
          onDrawStart={handleDrawStart}
          onDrawMove={handleDrawMove}
          onDrawEnd={handleDrawEnd}
          onAreaPointerDown={handleAreaPointerDown}
          onAreaPointerMove={handleAreaPointerMove}
          onAreaPointerUp={handleAreaPointerUp}
          onAreaPointerLeave={handleAreaPointerLeave}
          onResizePointerDown={handleResizePointerDown}
          onResizePointerMove={handleResizePointerMove}
          onResizePointerUp={handleResizePointerUp}
          onResizePointerLeave={handleResizePointerLeave}
          onChangeAreaSourcePhoto={changeAreaSourcePhoto}
          onAddSourcePhoto={handleAddSourcePhoto}
          canAddSourcePhoto={sourcePhotoCount < draftTemplate.photoSlots.length && sourcePhotoCount < MAX_SOURCE_PHOTOS}
          onDeleteArea={handleDeleteArea}
          onDuplicateArea={handleDuplicateArea}
          onDeselect={handleDeselectAll}
          activeQrSlotNumber={activeQrSlotNumber}
          onAddQrSlot={handleAddQrSlot}
          onDuplicateQrSlot={handleDuplicateQrSlot}
          onDeleteQrSlot={handleDeleteQrSlot}
          onQrPointerDown={handleQrPointerDown}
          onQrPointerMove={handleQrPointerMove}
          onQrPointerUp={handleQrPointerUp}
          onQrPointerLeave={handleQrPointerLeave}
          onQrResizePointerDown={handleQrResizePointerDown}
          onQrResizePointerMove={handleQrResizePointerMove}
          onQrResizePointerUp={handleQrResizePointerUp}
          onQrResizePointerLeave={handleQrResizePointerLeave}
          sidebar={
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4 sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Frame</h2>
                  <span className="rounded-[8px] border-2 border-[#4acaf1] bg-[#e3f6ff] px-2 py-0.5 font-mono text-xs font-black text-[#1b7fa8]">
                    {frameId}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <FileField label="Load Frame File" accept="image/*" onChange={handleLoadFrameFile} />
                  <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[#7a4de3]">
                    Detects the green screen areas, keys the green to transparent, and auto-places a photo slot over
                    each detected area.
                  </p>
                </div>

                <TextField
                  label="Frame Name"
                  value={frameName}
                  onChange={(value) => {
                    setFrameName(value);
                    if (nameError && value.trim()) {
                      setNameError(false);
                    }
                  }}
                  placeholder="Custom Static Frame"
                  required
                  error="Frame name is required"
                />

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

                <div className="flex items-center justify-between gap-2 sm:col-span-2">
                  <div className="flex flex-col">
                    <span className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-[#4d2d85]">
                      Canvas Size
                    </span>
                    <span className="font-mono text-xs font-bold text-[#7a4de3]">
                      {draftTemplate.width < draftTemplate.height
                        ? '100.0 × 148.0 mm (3.94 × 5.83 in.)'
                        : '148.0 × 100.0 mm (5.83 × 3.94 in.)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={rotateTemplate}
                    title="Rotate between landscape and portrait"
                    className="rounded-[10px] border-[3px] border-[#8f6fee] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5b3aa8] transition hover:bg-[#efe8ff]"
                  >
                    {draftTemplate.width < draftTemplate.height ? '↻ Landscape' : '↺ Portrait'}
                  </button>
                </div>

                <ColorField
                  label="Background"
                  value={draftTemplate.backgroundColor ?? '#ffffff'}
                  onChange={(value) => updateTemplate({ backgroundColor: value })}
                />
              </div>

              <PhotoAreasPanel
                areas={draftTemplate.photoSlots}
                activeArea={activeArea}
                activeAreaNumber={activeAreaNumber}
                sourcePhotoCount={sourcePhotoCount}
                onSelectArea={setActiveAreaNumber}
                onAddArea={handleAddArea}
                onDuplicateArea={handleDuplicateArea}
                onDeleteArea={handleDeleteArea}
                onUpdateActiveArea={updateActiveArea}
              />

              <QrSlotsPanel
                qrSlots={draftTemplate.qrSlots ?? []}
                activeQrSlot={activeQrSlot}
                activeQrSlotNumber={activeQrSlotNumber}
                onSelectQrSlot={selectQrSlot}
                onAddQrSlot={handleAddQrSlot}
                onDuplicateQrSlot={handleDuplicateQrSlot}
                onDeleteQrSlot={handleDeleteQrSlot}
                onUpdateActiveQrSlot={updateActiveQrSlot}
              />
            </div>
          }
        />
    </div>
  );
};

export default FrameAdminScreen;