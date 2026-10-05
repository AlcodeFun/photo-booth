import React, { useEffect, useMemo, useState } from 'react';
import { formatBoothCopy } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { withAlpha } from '../lib/appearance';
import { getSelectedPhotoUrls, getAllPhotoUrls } from '../utils/photoSlots';
import { getCanvasFilter } from '../utils/filters';
import { createResultGif, createResultLiveFramed, renderComposition } from '../utils/resultExport';
import { generateQrDataUrl } from '../utils/qr';
import ResultsView from '../components/booth/ResultsView';

export const PrintQRScreen: React.FC = () => {
  const { frame, filterId, photoSlots, printStatus, uploadStatus, downloadUrl, completeSession } = useSessionStore(
    (state) => ({
      frame: state.frame,
      filterId: state.filterId,
      photoSlots: state.photoSlots,
      printStatus: state.printStatus,
      uploadStatus: state.uploadStatus,
      downloadUrl: state.downloadUrl,
      completeSession: state.completeSession,
    }),
  );
  const outputs = useBoothConfig((state) => state.outputs);
  const flowMode = useBoothConfig((state) => state.flowMode);
  const printMode = useBoothConfig((state) => state.printer.printMode);
  const printerEnabled = useBoothConfig((state) => state.printer.enabled);
  const active = useBoothAppearance((state) => state.active);
  const { copy, theme } = active;
  const isTimedFlow = flowMode === 'timed';
  // Manual mode queues the print for the operator; the customer never waits on
  // a physical print, so the screen finishes as soon as the upload/QR is ready.
  const manualPrint = printerEnabled && printMode === 'manual';

  const [liveBlob, setLiveBlob] = useState<Blob | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [modalQr, setModalQr] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; label: string; rounded: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Cloud failure must never block the local experience, so the session can be
  // finished as soon as the physical print is done. Once the QR is available
  // (downloadUrl is set), the customer can leave even while files still upload.
  // The upload itself runs in lib/uploadJob (store-level, never tied to this
  // screen's mount), so finishing early never interrupts it.
  //
  // Flow 2 (timed) prints LATER from the dashboard: the QR directs the customer
  // to the hosted app's /organize/:token arrange page, and the admin prints the
  // generated framed.png manually. The screen is finished as soon as the upload
  // + QR are ready — no booth-side print status involved.
  const uploadReady = uploadStatus === 'SUCCESS' || uploadStatus === 'ERROR' || Boolean(downloadUrl);
  const printReady =
    !printerEnabled ||
    manualPrint ||
    printStatus === 'SUCCESS' ||
    printStatus === 'ERROR' ||
    printStatus === 'READY_TO_PRINT';
  const isDone = uploadReady && (isTimedFlow || printReady);
  const canFinishSession = !isTimedFlow || isDone;
  const selectedPhotos = useMemo(() => getSelectedPhotoUrls(photoSlots), [photoSlots]);
  const allPhotos = useMemo(() => getAllPhotoUrls(photoSlots), [photoSlots]);
  const frameFilter = getCanvasFilter(filterId);

  // Framed "live photo" preview — each slot plays its recorded live view clip
  // (uploadJob uploads its own copy as result-live.gif; this is the local
  // screen preview).
  useEffect(() => {
    let cancelled = false;
    if (outputs.framedLive && frame && photoSlots.length > 0) {
      createResultLiveFramed(frame, photoSlots, filterId)
        .then((blob) => {
          if (!cancelled) {
            setLiveBlob(blob);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Live-framed GIF generation failed:', error);
            setLiveBlob(null);
          }
        });
    } else {
      setLiveBlob(null);
    }
    return () => {
      cancelled = true;
    };
  }, [outputs.framedLive, frame, photoSlots, filterId]);

  useEffect(() => {
    if (!liveBlob) {
      setLiveUrl(null);
      return;
    }
    const url = URL.createObjectURL(liveBlob);
    setLiveUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [liveBlob]);

  // Plain animated GIF preview (uploadJob uploads its own copy as result.gif).
  useEffect(() => {
    let cancelled = false;
    if (outputs.gif && photoSlots.length > 0) {
      createResultGif(photoSlots, filterId)
        .then((blob) => {
          if (!cancelled) {
            setGifBlob(blob);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Animated GIF generation failed:', error);
            setGifBlob(null);
          }
        });
    } else {
      setGifBlob(null);
    }
    return () => {
      cancelled = true;
    };
  }, [outputs.gif, photoSlots, filterId]);

  useEffect(() => {
    if (!gifBlob) {
      setGifUrl(null);
      return;
    }
    const url = URL.createObjectURL(gifBlob);
    setGifUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [gifBlob]);

  // Slideshow rotation lives in ResultsView, which owns it.

  // Step 1 + Step 2 (token generation, registration, file upload) are owned by
  // lib/uploadJob, a store-level job that keeps running even after the customer
  // leaves. The screen only renders what the store already knows.

  // Real QR once the gallery session is reserved (immediately — before the
  // background file upload finishes).
  useEffect(() => {
    let cancelled = false;
    if (downloadUrl) {
      generateQrDataUrl(downloadUrl, 256)
        .then((url) => {
          if (!cancelled) {
            setQrDataUrl(url);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setQrDataUrl(null);
          }
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [downloadUrl]);

  // Generate a larger QR for the enlarge modal when it is opened.
  useEffect(() => {
    if (!qrOpen || !downloadUrl) {
      setModalQr(null);
      return;
    }
    let cancelled = false;
    generateQrDataUrl(downloadUrl, 384)
      .then((url) => {
        if (!cancelled) {
          setModalQr(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModalQr(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrOpen, downloadUrl]);

  // Zoom modals — click any result (framed, live, or individual photo) to view
  // it enlarged, mirroring the QR enlarge modal. The framed sheet prints via
  // the hidden print-only FrameCanvas.

  const handleViewFramed = async () => {
    if (!frame || photoSlots.length === 0) return;
    try {
      const canvas = await renderComposition(frame, photoSlots, filterId, {
        includeFrame: true,
        qrCodeUrl: qrDataUrl ?? undefined,
      });
      setViewer({ url: canvas.toDataURL('image/jpeg', 0.92), label: copy.resultsFramedPhotoLabel, rounded: true });
    } catch {
      // ignore — leave the viewer closed
    }
  };

  const handleViewLive = () => {
    if (liveUrl) {
      setViewer({ url: liveUrl, label: copy.resultsFramedLiveBadge, rounded: true });
    }
  };

  const handleViewGif = () => {
    if (gifUrl) {
      setViewer({ url: gifUrl, label: copy.resultsAnimatedGifBadge, rounded: true });
    }
  };

  const handleViewPhoto = (dataUrl: string, index: number) => {
    setViewer({
      url: dataUrl,
      label: formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 }),
      rounded: false,
    });
  };

  // Escape closes whichever zoom modal is open.
  useEffect(() => {
    if (!viewer && !galleryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewer) {
          setViewer(null);
        } else if (galleryOpen) {
          setGalleryOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, galleryOpen]);

  // Burst of rising sparkles as soon as everything is ready.
  useEffect(() => {
    if (celebrate || !isDone) return;
    setCelebrate(true);
    const timer = setTimeout(() => setCelebrate(false), 4200);
    return () => clearTimeout(timer);
  }, [celebrate, isDone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${8 + ((i * 37) % 84)}%`,
        color: [theme.primary, theme.secondary, theme.deep, theme.accent, theme.tertiary][i % 5],
        size: 8 + ((i * 3) % 8),
        duration: 2.6 + ((i * 7) % 18) / 10,
        delay: (i % 6) * 0.35,
      })),
    [theme],
  );

  return (
    <div
      className="print-qrpage fixed inset-0 z-40 flex select-none flex-col overflow-hidden"
      style={{
        ...appearanceSurfaceStyle(active, theme.tertiary),
        color: theme.deep,
        animation: 'pb-modal-fade 0.25s ease-out both',
      }}
    >
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          .print-no-show { display: none !important; }
          .print-only { display: block !important; }
          .print-qrpage { position: static !important; height: auto !important; background: white !important; }
          .print-sheet-inner { width: 4in !important; height: 6in !important; margin: 0 auto !important; }
        }
      `}</style>

      {/* Celebratory rising sparkles */}
      {celebrate && (
        <div className="print-no-show pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {confetti.map((sparkle, index) => (
            <span
              key={index}
              className="pb-sparkle"
              style={
                {
                  left: sparkle.left,
                  bottom: '-18px',
                  width: `${sparkle.size}px`,
                  height: `${sparkle.size}px`,
                  '--sc': sparkle.color,
                  animationDuration: `${sparkle.duration}s`,
                  animationDelay: `${sparkle.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

    

      {/* Print-only framed sheet (physical print safety net) */}
      {!isTimedFlow && (
        <div className="print-sheet print-only" style={{ display: 'none' }}>
          <div className="print-sheet-inner">
            <FrameCanvas
              frame={frame}
              photos={selectedPhotos}
              photoSlotCount={photoSlots.length}
              filter={frameFilter}
              qrCodeUrl={qrDataUrl ?? undefined}
              className="h-full w-full bg-white"
              style={{ height: '100%' }}
            />
          </div>
        </div>
      )}

      <ResultsView
        copy={copy}
        theme={theme}
        isTimedFlow={isTimedFlow}
        frame={frame}
        photoUrls={selectedPhotos}
        photoSlotCount={photoSlots.length}
        filterStyle={frameFilter}
        liveUrl={liveUrl}
        gifUrl={gifUrl}
        qrDataUrl={qrDataUrl}
        showFramed={outputs.framed}
        showAllPhotos={outputs.allPhotos}
        showLive={outputs.framedLive}
        showGif={outputs.gif}
        isDone={isDone}
        canFinish={canFinishSession}
        surfaceStyle={appearanceSurfaceStyle(active, theme.tertiary)}
        onFinish={completeSession}
        onViewFramed={() => void handleViewFramed()}
        onOpenGallery={() => setGalleryOpen(true)}
        onViewLive={handleViewLive}
        onViewGif={handleViewGif}
        onOpenQr={() => setQrOpen(true)}
      />

      {/* Fullscreen gallery — all photos */}
      {galleryOpen && (
        <div
          className="print-no-show fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: theme.deep, animation: 'pb-modal-fade 0.25s ease-out both' }}
          onMouseDown={() => setGalleryOpen(false)}
        >
          <header
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 backdrop-blur"
            style={{ backgroundColor: withAlpha(theme.deep, 0.8) }}
          >
            <div>
              <h3 className="text-lg font-bold text-white">{copy.resultsGalleryTitle}</h3>
              <p className="text-xs text-white/40">
                {formatBoothCopy(copy.resultsViewAllPhotos, { count: allPhotos.length })}
              </p>
            </div>
            <button
              onClick={() => setGalleryOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-white transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: theme.primary, boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }}
              aria-label={copy.resultsClose}
            >
              &#10005;
            </button>
          </header>
          <div
            className="pb-scroll min-h-0 flex-1 overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto w-full max-w-6xl p-5 sm:p-8"
              style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            >
              {/* Framed live result sits first — it is the hero of this session. */}
              {liveUrl && outputs.framedLive && (
                <button
                  type="button"
                  onClick={handleViewLive}
                  title="View framed live photo"
                  aria-label="View framed live photo"
                  className="group relative mb-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 p-1.5 transition-transform hover:-translate-y-0.5 sm:p-2.5"
                  style={{
                    borderColor: theme.action,
                    backgroundColor: theme.deep,
                    boxShadow: `0 6px 0 ${withAlpha(theme.action, 0.25)}`,
                  }}
                >
                  <img
                    src={liveUrl}
                    alt={copy.resultsFramedLiveBadge}
                    className="max-h-[46vh] w-auto rounded-md object-contain"
                  />
                  <span
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white"
                    style={{ backgroundColor: withAlpha(theme.action, 0.9) }}
                  >
                    📹 {copy.resultsFramedLiveBadge}
                  </span>
                </button>
              )}

              {gifUrl && outputs.gif && (
                <button
                  type="button"
                  onClick={handleViewGif}
                  title="View animated GIF"
                  aria-label="View animated GIF"
                  className="group relative mb-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 p-1.5 transition-transform hover:-translate-y-0.5 sm:p-2.5"
                  style={{
                    borderColor: theme.secondary,
                    backgroundColor: theme.deep,
                    boxShadow: `0 6px 0 ${withAlpha(theme.secondary, 0.25)}`,
                  }}
                >
                  <img
                    src={gifUrl}
                    alt={copy.resultsAnimatedGifBadge}
                    className="max-h-[46vh] w-auto rounded-md object-contain"
                  />
                  <span
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white"
                    style={{ backgroundColor: withAlpha(theme.secondary, 0.9) }}
                  >
                    🎞️ {copy.resultsAnimatedGifBadge}
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {allPhotos.map((dataUrl, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => handleViewPhoto(dataUrl, index)}
                    title={formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                    aria-label={formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                    className="group relative block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10"
                    style={{ backgroundColor: theme.surface }}
                  >
                    <div className="aspect-square w-full overflow-hidden bg-black/30">
                      <img
                        src={dataUrl}
                        alt={formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                        className="h-full w-full object-cover transition transform group-hover:scale-105"
                      />
                    </div>
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/70 px-2 py-1.5 text-xs text-white/90">
                      {formatBoothCopy(copy.resultsPhotoLabel, { index: index + 1 })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR enlarge modal */}
      {qrOpen && (
        <div
          className="print-no-show fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: withAlpha(theme.deep, 0.9) }}
          onClick={() => setQrOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[18px] border-[4px] bg-white p-6"
            style={{ borderColor: theme.primary }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-center text-[0.9rem] font-black uppercase tracking-[0.14em]"
              style={{ color: theme.deep }}
            >
              {copy.resultsQrModalTitle}
            </h2>
            {modalQr ? (
              <img src={modalQr} alt={copy.resultsQrModalTitle} className="h-72 w-72 rounded-[12px]" />
            ) : (
              <div
                className="flex h-72 w-72 animate-pulse items-center justify-center rounded-[12px]"
                style={{ backgroundColor: withAlpha(theme.deep, 0.15) }}
              >
                <span className="animate-spin text-xl">⏳</span>
              </div>
            )}
            {downloadUrl && (
              <p className="max-w-full break-all text-center text-[0.6rem] font-bold" style={{ color: theme.deep }}>
                {downloadUrl}
              </p>
            )}
            <button
              onClick={() => setQrOpen(false)}
              className="rounded-full px-6 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white"
              style={{ backgroundColor: theme.primary, boxShadow: '0 3px 0 rgba(0,0,0,0.15)' }}
            >
              {copy.resultsClose}
            </button>
          </div>
        </div>
      )}

      {/* Result zoom modal — view any result enlarged, like the QR modal */}
      {viewer && (
        <div
          className="print-no-show fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: withAlpha(theme.deep, 0.95) }}
          onClick={() => setViewer(null)}
        >
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewer.url}
              alt={viewer.label}
              className="max-h-[80vh] w-auto max-w-full bg-white object-contain shadow-2xl"
              style={viewer.rounded ? { borderRadius: '14px', border: `4px solid ${theme.primary}` } : undefined}
            />
            <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-white">{viewer.label}</p>
            <button
              onClick={() => setViewer(null)}
              className="rounded-full px-6 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white"
              style={{ backgroundColor: theme.primary, boxShadow: '0 3px 0 rgba(0,0,0,0.15)' }}
            >
              {copy.resultsClose}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintQRScreen;
