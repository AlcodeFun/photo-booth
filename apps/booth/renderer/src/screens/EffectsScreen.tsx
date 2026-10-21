import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import { createResultLiveFramed } from '../utils/resultExport';
import { listActiveGifFrames } from '../lib/gifFrames';
import EffectsView, { type EffectsGifFrame } from '../components/booth/EffectsView';
import { DEFAULT_GIF_ADJUST, isDefaultGifAdjust, type GifAdjust } from '../utils/gifAdjust';

/** Flows 1 and 3, step 2: pick the photo filter and the GIF frame, then the QR. */
export const EffectsScreen: React.FC = () => {
  const { photoSlots, originalPhotos, frame, selectFilter, setGifFrame, setGifAdjust } = useSessionStore((state) => ({
    photoSlots: state.photoSlots,
    originalPhotos: state.originalPhotos,
    frame: state.frame,
    selectFilter: state.selectFilter,
    setGifFrame: state.setGifFrame,
    setGifAdjust: state.setGifAdjust,
  }));
  const outputs = useBoothConfig((state) => state.outputs);
  const active = useBoothAppearance((state) => state.appearance);

  const [filterId, setFilterId] = useState('original');
  const [gifFrameId, setGifFrameId] = useState<string | null>(null);
  const [gifAdjust, setGifAdjustLocal] = useState<GifAdjust>(DEFAULT_GIF_ADJUST);
  const [gifFrames, setGifFrames] = useState<EffectsGifFrame[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  // GIF frames the admin enabled (offline: none, the plain GIF still works).
  useEffect(() => {
    let alive = true;
    listActiveGifFrames()
      .then((rows) => {
        if (alive) setGifFrames(rows.map((r) => ({ id: r.id, name: r.name, url: r.image_url, width: r.width, height: r.height, slot: r.photo_slot })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // The live photo is never filtered, so it is rendered once for this screen.
  useEffect(() => {
    if (!outputs.framedLive || !frame || photoSlots.length === 0) return;
    let url: string | null = null;
    let alive = true;
    createResultLiveFramed(frame, photoSlots)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setLiveUrl(url);
      })
      .catch((error) => console.error('Live photo preview failed:', error));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [frame, photoSlots, outputs.framedLive]);

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-full select-none">
      <EffectsView
        copy={active.copy}
        theme={active.theme}
        frame={frame}
        photoUrls={getSelectedPhotoUrls(photoSlots)}
        gifPhotoUrls={originalPhotos}
        photoSlotCount={photoSlots.length}
        surfaceStyle={appearanceSurfaceStyle(active, active.theme.background)}
        liveUrl={liveUrl}
        showLive={outputs.framedLive}
        showGif={outputs.gif}
        gifFrames={gifFrames}
        filterId={filterId}
        gifFrameId={gifFrameId}
        onFilterChange={setFilterId}
        onGifFrameChange={setGifFrameId}
        gifAdjust={gifAdjust}
        onGifAdjustChange={setGifAdjustLocal}
        onNext={() => {
          const chosen = gifFrames.find((f) => f.id === gifFrameId);
          setGifFrame(chosen ? { id: chosen.id, url: chosen.url } : null);
          setGifAdjust(isDefaultGifAdjust(gifAdjust) ? null : gifAdjust);
          // Starts printing + upload and moves on to the QR screen.
          selectFilter(filterId);
        }}
      />
    </div>
  );
};

export default EffectsScreen;
