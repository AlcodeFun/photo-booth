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
import { useSessionStore } from '../store/sessionStore';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';
import {
  clearFrameTemplateDraft,
  getFrameTemplateDraft,
  saveFrameTemplateDraft,
} from '../utils/frameTemplateDrafts';
import { ExportPanel } from './admin/ExportPanel';
import { ColorField, FileField, NumberField, SelectField, TextField } from './admin/fields';
import { PhotoAreasPanel } from './admin/PhotoAreasPanel';
import { SupabasePanel } from './admin/SupabasePanel';
import { TemplateCanvasEditor } from './admin/TemplateCanvasEditor';
import { CanvasPoint, DragState, DrawingRectangle } from './admin/types';

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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
  const [catalogFrames, setCatalogFrames] = useState<FrameConfig[]>(MOCK_FRAMES);
  const [remoteActive, setRemoteActive] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string>('__new__');
  const isNewFrame = selectedFrameId === '__new__';
  const frames = useFramesWithTemplateDrafts(catalogFrames, sourcePhotoCount);
  const selectedFrame = isNewFrame ? null : frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null;
  const baseFrame = isNewFrame ? null : catalogFrames.find((frame) => frame.id === selectedFrameId) ?? catalogFrames[0] ?? null;
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<FrameTemplateConfig>(() =>
    cloneTemplate(resolveFrameTemplate(MOCK_FRAMES[0], defaultSourcePhotoCount), defaultSourcePhotoCount),
  );
  const [activeAreaNumber, setActiveAreaNumber] = useState(1);
  const [samplePhotos, setSamplePhotos] = useState<Array<string | undefined>>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  // Frame-level identity fields (editable directly in the form)
  const [frameId, setFrameId] = useState('custom-static-frame');
  const [frameName, setFrameName] = useState('Custom Static Frame');
  const [frameTheme, setFrameTheme] = useState('bg-zinc-950 border-zinc-900 text-white');

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
      // Blank start: fallback template (no asset, rectangular slots).
      const blankTemplate = cloneTemplate(resolveFrameTemplate(null, sourcePhotoCount), sourcePhotoCount);
      setDraftTemplate(blankTemplate);
      setActiveAreaNumber(blankTemplate.photoSlots[0]?.slotNumber ?? 1);
      setFrameId('custom-static-frame');
      setFrameName('Custom Static Frame');
      setFrameTheme('bg-zinc-950 border-zinc-900 text-white');
      return;
    }

    if (!selectedFrame) {
      return;
    }

    // Adopt the frame's designed photo count so its template loads instead of a blank fallback.
    const adoptedCount = selectedFrame.photoSlots ?? sourcePhotoCount;
    if (adoptedCount > 0 && adoptedCount !== sourcePhotoCount) {
      setSourcePhotoCount(adoptedCount);
    }

    const storedDraft = getFrameTemplateDraft(selectedFrame.id, adoptedCount);
    const nextTemplate = cloneTemplate(
      storedDraft ?? resolveFrameTemplate(selectedFrame, adoptedCount),
      adoptedCount,
    );
    setDraftTemplate(nextTemplate);
    setActiveAreaNumber(nextTemplate.photoSlots[0]?.slotNumber ?? 1);
    setFrameId(selectedFrame.id);
    setFrameName(selectedFrame.name);
    setFrameTheme(selectedFrame.theme || 'bg-zinc-950 border-zinc-900 text-white');
  }, [isNewFrame, selectedFrame, selectedFrameId]);

  useEffect(() => {
    setSamplePhotos((currentPhotos) =>
      Array.from({ length: sourcePhotoCount }, (_, index) => currentPhotos[index]),
    );
  }, [sourcePhotoCount]);

  const activeArea = draftTemplate.photoSlots.find((area) => area.slotNumber === activeAreaNumber);
  const exportFrame = useMemo(() => {
    const jsonText = JSON.stringify(draftTemplate, null, 2);
    const tsTemplateText = jsonText.replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:');

    const normalizedAssetUrl = !draftTemplate.assetUrl
      ? "''"
      : draftTemplate.assetUrl.startsWith('/')
        ? `'${draftTemplate.assetUrl}'`
        : `publicAsset('${draftTemplate.assetUrl}')`;

    return `{
  id: '${frameId.replace(/'/g, "\\'")}',
  name: '${frameName.replace(/'/g, "\\'")}',
  previewUrl: ${normalizedAssetUrl},
  theme: '${frameTheme.replace(/'/g, "\\'")}',
  photoSlots: ${sourcePhotoCount},
  templatesByPhotoSlots: {
    ${sourcePhotoCount}: ${tsTemplateText},
  },
},`;
  }, [draftTemplate, frameId, frameName, frameTheme, sourcePhotoCount]);

  const exportTemplate = exportFrame;
  const drawingRectangle: DrawingRectangle | null = dragState && dragState.type === 'draw'
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
    setDraftTemplate((template) => ({
      ...template,
      photoSlots: template.photoSlots.map((area) =>
        area.slotNumber === activeAreaNumber ? { ...area, ...updates } : area,
      ),
    }));
    setStatus('');
  };

  const handleSourcePhotoCountChange = (value: number) => {
    const nextCount = clamp(Math.floor(value), 1, MAX_SOURCE_PHOTOS);
    // Only update the source photo count. Existing slot areas are preserved
    // as-is (no reset / remap). Use the "Photo Areas" control to add/remove.
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

  const handleAreaPointerLeave = (event: PointerEvent<HTMLButtonElement>, area: FramePhotoPlacement) => {
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

  const handleResizePointerLeave = (event: PointerEvent<HTMLDivElement>, area: FramePhotoPlacement) => {
    if (
      dragState &&
      dragState.type === 'resize' &&
      dragState.areaSlotNumber === area.slotNumber &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
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

  const handleSaveDraft = () => {
    if (isNewFrame) {
      setStatus('New frames need no saving - copy the template directly');
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
      setDraftTemplate(blankTemplate);
      setActiveAreaNumber(blankTemplate.photoSlots[0]?.slotNumber ?? 1);
      setStatus('Reset to blank');
      return;
    }

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

  const handleRefreshFrames = async () => {
    await loadRemoteFrames(true);
  };

  const handleSaveToSupabase = async () => {
    if (!frameId.trim()) {
      setStatus('Frame ID is required');
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

  const handleUploadAsset = async (file: File) => {
    setStatus('Uploading asset...');
    try {
      const url = await uploadFrameAsset(frameId.trim() || 'custom-static-frame', file);
      updateTemplate({ assetUrl: url });
      setStatus('Asset uploaded');
    } catch (error) {
      setStatus(`Upload failed: ${String(error)}`);
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
        <TemplateCanvasEditor
          template={draftTemplate}
          frame={selectedFrame}
          photos={samplePhotos}
          photoSlotCount={sourcePhotoCount}
          activeAreaNumber={activeAreaNumber}
          drawingRectangle={drawingRectangle}
          canvasRef={canvasRef}
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

        <section className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-2">
            <SelectField label="Frame" value={selectedFrameId} onChange={setSelectedFrameId}>
              <option value="__new__">New Frame (blank)</option>
              {frames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name}
                </option>
              ))}
            </SelectField>

            <TextField label="Frame ID" value={frameId} onChange={setFrameId} placeholder="custom-static-frame" />

            <TextField label="Frame Name" value={frameName} onChange={setFrameName} className="sm:col-span-2" />

            <TextField label="Theme" value={frameTheme} onChange={setFrameTheme} className="sm:col-span-2" />

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

            <TextField
              label="Template Asset"
              value={draftTemplate.assetUrl}
              onChange={(value) => updateTemplate({ assetUrl: value })}
              className="sm:col-span-2"
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
            onUploadAsset={handleUploadAsset}
          />

          <ExportPanel
            exportTemplate={exportTemplate}
            status={status}
            onSaveDraft={handleSaveDraft}
            onCopyTemplate={handleCopyTemplate}
            onClearPhotos={() => setSamplePhotos([])}
            onResetDraft={handleResetDraft}
          />
        </section>
      </main>
    </div>
  );
};

export default FrameTemplateAdminScreen;