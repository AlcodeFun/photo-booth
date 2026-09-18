import React, {
  ChangeEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FrameConfig, FramePhotoPlacement, FrameTemplateConfig } from '@photo-booth/types';
import { MOCK_FRAMES, MOCK_LAYOUTS } from '../data/mockData';
import { useFramesWithTemplateDrafts } from '../hooks/useFramesWithTemplateDrafts';
import { useTemplateHistory } from '../hooks/useTemplateHistory';
import {
  deleteFrameTemplate,
  getAuthStatus,
  listFrameTemplates,
  onAuthStateChange,
  saveFrameTemplate,
  signInToSupabase,
  signOutOfSupabase,
  uploadFrameAsset,
} from '../lib/frameTemplates';
import { processFrameAsset } from '../utils/greenScreenDetection';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';
import {
  clearFrameTemplateDraft,
  getFrameTemplateDraft,
  saveFrameTemplateDraft,
} from '../utils/frameTemplateDrafts';
import { ColorField, FileField, NumberField, SelectField, TextField } from './admin/fields';
import { PhotoAreasPanel } from './admin/PhotoAreasPanel';
import { SupabasePanel } from './admin/SupabasePanel';
import { TemplateCanvasEditor } from './admin/TemplateCanvasEditor';
import { CanvasPoint, DragState, DrawingRectangle } from './admin/types';

const MAX_SOURCE_PHOTOS = 9;
const MAX_PHOTO_AREAS = 16;
const MIN_DRAW_SIZE = 24;
const DEFAULT_FRAME_THEME = 'bg-zinc-950 border-zinc-900 text-white';

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

export const FrameTemplateAdminScreen: React.FC = () => {
  const handleBackToBooth = () => {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const adminSuffix = /\/admin\/(?:frame-fit|camera)$/;

    // Path-based admin route (e.g. hosted at /admin/frame-fit): strip the
    // segment so the booth flow detects the route change.
    if (adminSuffix.test(pathname)) {
      const basePath = pathname.replace(adminSuffix, '') || '/';
      window.location.replace(`${basePath}${window.location.search}#/`);
      return;
    }

    // Hash-based admin route: safe to switch the hash in place.
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
  };

  const defaultSourcePhotoCount = useMemo(() => {
    const counts = MOCK_LAYOUTS.map((layout) => layout.photoSlots);
    return Math.max(...counts, 3);
  }, []);
  const [sourcePhotoCount, setSourcePhotoCount] = useState(defaultSourcePhotoCount);
  const [catalogFrames, setCatalogFrames] = useState<FrameConfig[]>(MOCK_FRAMES);
  const [remoteActive, setRemoteActive] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string>('__new__');
  const isNewFrame = selectedFrameId === '__new__';
  const frames = useFramesWithTemplateDrafts(catalogFrames, sourcePhotoCount);
  const selectedFrame = isNewFrame ? null : frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null;
  const baseFrame = isNewFrame ? null : catalogFrames.find((frame) => frame.id === selectedFrameId) ?? catalogFrames[0] ?? null;
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [frameName, setFrameName] = useState('Custom Static Frame');
  const [activeAreaNumber, setActiveAreaNumber] = useState(1);
  const [samplePhotos, setSamplePhotos] = useState<Array<string | undefined>>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

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
  } = useTemplateHistory(initialTemplate);

  const frameId = isNewFrame ? slugify(frameName) : selectedFrame?.id ?? slugify(frameName);
  const frameTheme = isNewFrame ? DEFAULT_FRAME_THEME : (selectedFrame?.theme ?? DEFAULT_FRAME_THEME);

  const loadRemoteFrames = useCallback(async (notify: boolean) => {
    try {
      const remote = await listFrameTemplates();
      if (remote.length > 0) {
        setCatalogFrames(remote);
        setRemoteActive(true);
        setSelectedFrameId((current) =>
          current === '__new__' || remote.some((frame) => frame.id === current) ? current : '__new__',
        );
        if (notify) {
          setStatus(`Loaded ${remote.length} templates from Supabase`);
        }
      } else if (notify) {
        setStatus('No templates in Supabase yet');
      } else {
        setRemoteActive(true);
      }
    } catch (error) {
      setRemoteActive(false);
      setStatus(notify ? `Sync failed: ${String(error)}` : `Using local templates: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    loadRemoteFrames(false);
  }, [loadRemoteFrames]);

  useEffect(() => {
    let active = true;
    getAuthStatus()
      .then(({ email }) => {
        if (active) {
          setSessionEmail(email);
        }
      })
      .catch(() => {
        if (active) {
          setSessionEmail(null);
        }
      });
    const unsubscribe = onAuthStateChange((email) => {
      if (active) {
        setSessionEmail(email);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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

  useEffect(() => {
    setSamplePhotos((currentPhotos) =>
      Array.from({ length: sourcePhotoCount }, (_, index) => currentPhotos[index]),
    );
  }, [sourcePhotoCount]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const activeArea = draftTemplate.photoSlots.find((area) => area.slotNumber === activeAreaNumber);
  const drawingRectangle: DrawingRectangle | null =
    dragState && dragState.type === 'draw'
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

  const handleSourcePhotoCountChange = (value: number) => {
    const nextCount = clamp(Math.floor(value), 1, MAX_SOURCE_PHOTOS);
    setActiveAreaNumber((currentAreaNumber) => clamp(currentAreaNumber, 1, nextCount));
    setSourcePhotoCount(nextCount);
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
            borderRadius: 0,
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
    pushHistorySnapshot();
    draggingRef.current = true;
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
    pushHistorySnapshot();
    draggingRef.current = true;
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

  const handleLoadFrameFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setStatus('Loading frame, detecting green screen...');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const processed = await processFrameAsset(dataUrl);

      let assetUrl = processed.assetUrl;
      let uploaded = false;

      if (sessionEmail) {
        try {
          const pngFile = new File([dataUrlToBlob(processed.assetUrl)], `${frameId}-processed.png`, {
            type: 'image/png',
          });
          assetUrl = await uploadFrameAsset(frameId, pngFile);
          uploaded = true;
        } catch {
          // Keep the local data URL when the upload fails.
        }
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
    }
  };

  const handleSaveDraft = () => {
    if (isNewFrame) {
      setStatus('New frames are saved directly to Supabase');
      return;
    }

    if (!selectedFrame) {
      return;
    }

    saveFrameTemplateDraft(selectedFrame.id, sourcePhotoCount, draftTemplate);
    setStatus('Draft saved');
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

  const handleRefreshFrames = async () => {
    await loadRemoteFrames(true);
  };

  const handleSaveToSupabase = async () => {
    if (!frameId.trim()) {
      setStatus('Frame name is required');
      return;
    }

    setStatus('Saving to Supabase...');
    try {
      const existingTemplates = selectedFrame?.templatesByPhotoSlots ?? {};
      const frameConfig: FrameConfig = {
        id: frameId.trim(),
        name: frameName.trim() || 'Untitled Frame',
        previewUrl: isNewFrame ? draftTemplate.assetUrl : selectedFrame?.previewUrl ?? draftTemplate.assetUrl,
        theme: frameTheme,
        photoSlots: selectedFrame?.photoSlots ?? sourcePhotoCount,
        templatesByPhotoSlots: {
          ...existingTemplates,
          [sourcePhotoCount]: draftTemplate,
        },
      };

      await saveFrameTemplate(frameConfig);
      await loadRemoteFrames(true);
      setStatus(`Saved "${frameConfig.name}" to Supabase`);
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  };

  const handleDeleteFromSupabase = async () => {
    if (!selectedFrame) {
      return;
    }

    if (!window.confirm(`Delete "${selectedFrame.name}" from Supabase? This cannot be undone.`)) {
      return;
    }

    setStatus('Deleting...');
    try {
      await deleteFrameTemplate(selectedFrame.id);
      setCatalogFrames((current) => current.filter((frame) => frame.id !== selectedFrame.id));
      setRemoteActive(true);
      setSelectedFrameId('__new__');
      setStatus(`Deleted "${selectedFrame.name}"`);
    } catch (error) {
      setStatus(`Delete failed: ${String(error)}`);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    setStatus('Signing in...');
    try {
      await signInToSupabase(email, password);
      setStatus('Signed in');
    } catch (error) {
      setStatus(`Sign in failed: ${String(error)}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutOfSupabase();
      setStatus('Signed out');
    } catch (error) {
      setStatus(`Sign out failed: ${String(error)}`);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[1200px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-2 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:p-4">
        <div className="rounded-[14px] bg-white p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-[#a35ef6]">Hidden Admin</p>
              <h1 className="text-2xl font-black uppercase tracking-[-0.04em] text-[#4d2d85]">Frame Fitter</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBackToBooth}
                className="rounded-[10px] border-[3px] border-[#a35ef6] bg-[#d9f85a] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#4d2d85] transition-all hover:-translate-y-0.5 hover:bg-[#e9ff9e] active:translate-y-0"
              >
                Back to Booth
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(360px,0.9fr)_minmax(440px,1.1fr)]">
            <div className="grid gap-4">
              <TemplateCanvasEditor
                template={draftTemplate}
                frame={selectedFrame}
                photos={samplePhotos}
                photoSlotCount={sourcePhotoCount}
                activeAreaNumber={activeAreaNumber}
                drawingRectangle={drawingRectangle}
                canvasRef={canvasRef}
                status={status}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onSaveDraft={handleSaveDraft}
                onClearPhotos={() => setSamplePhotos([])}
                onResetDraft={handleResetDraft}
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
              />
            </div>

            <section className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 rounded-[12px] border-[3px] border-[#e5c9ff] bg-[#fbf3ff] p-4 sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4d2d85]">Frame</h2>
                  <span className="rounded-[8px] border-2 border-[#4acaf1] bg-[#e3f6ff] px-2 py-0.5 font-mono text-xs font-black text-[#1b7fa8]">
                    {frameId}
                  </span>
                </div>

                <SelectField label="Frame" value={selectedFrameId} onChange={setSelectedFrameId}>
                  <option value="__new__">New Frame (blank)</option>
                  {frames.map((frame) => (
                    <option key={frame.id} value={frame.id}>
                      {frame.name}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  label="Frame Name"
                  value={frameName}
                  onChange={setFrameName}
                  placeholder="Custom Static Frame"
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

                <ColorField
                  label="Background"
                  value={draftTemplate.backgroundColor ?? '#111111'}
                  onChange={(value) => updateTemplate({ backgroundColor: value })}
                />

                <FileField label="Sample Photos" accept="image/*" multiple onChange={handleSampleUpload} />

                <div className="sm:col-span-2">
                  <FileField label="Load Frame File" accept="image/*" onChange={handleLoadFrameFile} />
                  <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[#7a4de3]">
                    Detects the green screen areas, keys the green to transparent, and auto-places a photo slot over
                    each detected area.
                  </p>
                </div>
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

              <SupabasePanel
                remoteActive={remoteActive}
                sessionEmail={sessionEmail}
                isNewFrame={isNewFrame}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onSave={handleSaveToSupabase}
                onDelete={handleDeleteFromSupabase}
                onRefresh={handleRefreshFrames}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrameTemplateAdminScreen;