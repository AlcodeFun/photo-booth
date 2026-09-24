import React, { useEffect, useMemo, useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { getSelectedPhotoUrls, getAllPhotoUrls } from '../utils/photoSlots';
import { getCanvasFilter } from '../utils/filters';
import { createResultGif, createResultLiveFramed, renderComposition } from '../utils/resultExport';
import { generateQrDataUrl } from '../utils/qr';

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
  const [slideIndex, setSlideIndex] = useState(0);
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
  const isDone = isTimedFlow || manualPrint
    ? uploadStatus === 'SUCCESS' || uploadStatus === 'ERROR' || Boolean(downloadUrl)
    : printStatus === 'SUCCESS' &&
      (uploadStatus === 'SUCCESS' || uploadStatus === 'ERROR' || Boolean(downloadUrl));
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

  // Slideshow: loop through all captured photos automatically.
  useEffect(() => {
    if (allPhotos.length <= 1) {
      setSlideIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSlideIndex((current) => (current + 1) % allPhotos.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [allPhotos.length]);

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
      setViewer({ url: canvas.toDataURL('image/jpeg', 0.92), label: 'Framed photo', rounded: true });
    } catch {
      // ignore — leave the viewer closed
    }
  };

  const handleViewLive = () => {
    if (liveUrl) {
      setViewer({ url: liveUrl, label: 'Framed live photo', rounded: true });
    }
  };

  const handleViewGif = () => {
    if (gifUrl) {
      setViewer({ url: gifUrl, label: 'Animated GIF', rounded: true });
    }
  };

  const handleViewPhoto = (dataUrl: string, index: number) => {
    setViewer({ url: dataUrl, label: `Photo ${index + 1}`, rounded: false });
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
        color: ['#ff4bb5', '#a35ef6', '#4d2d85', '#ffec5a', '#ffffff'][i % 5],
        size: 8 + ((i * 3) % 8),
        duration: 2.6 + ((i * 7) % 18) / 10,
        delay: (i % 6) * 0.35,
      })),
    [],
  );

  return (
    <div
      className="print-qrpage fixed inset-0 z-40 flex select-none flex-col overflow-hidden bg-[#d9f85a]"
      style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}
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

      {/* Header */}
      <header
        className="print-no-show relative flex shrink-0 items-center justify-center gap-3 border-b-[3px] border-[#ff4bb5] bg-[#ff4bb5] px-5 py-3 md:py-4"
        style={{ animation: 'pb-bounce-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
      >
        <span
          className="pointer-events-none absolute left-[7%] top-1/2 -translate-y-1/2 text-2xl md:text-3xl"
          style={{ animation: 'pb-float 3.2s ease-in-out infinite' }}
        >
          ✨
        </span>
        <span
          className="pointer-events-none absolute right-[7%] top-1/2 -translate-y-1/2 text-2xl md:text-3xl"
          style={{ animation: 'pb-float 3.8s ease-in-out 0.5s infinite' }}
        >
          💖
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <h1
            className="mt-0.5 text-[1.4rem] font-black uppercase tracking-[-0.08em] text-white md:text-[1.8rem]"
            style={{ animation: 'pb-glow 2.6s ease-in-out infinite' }}
          >
            Hasil
          </h1>
          <p
            className="pb-tap text-[0.55rem] font-black uppercase tracking-[0.3em] text-white/90 md:text-[0.7rem]"
            style={{ animation: 'pb-tap 2.4s ease-in-out infinite' }}
          >
            Your memories are ready 🎉
          </p>
        </div>
      </header>

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

      {/* Main result — framed (left), photo slideshow + live (middle), QR (right).
          Flow 2 hides every result and shows the QR alone (points to /p/:token,
          whose arrange section lets the customer compose the frame for print). */}
      <div className="print-no-show pb-scroll relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:overflow-hidden">
        {/* Floating background cuteness */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {[
            { left: '6%', top: '14%', size: 'text-xl', delay: '0s', rot: '12deg' },
            { right: '10%', top: '10%', size: 'text-2xl', delay: '0.6s', rot: '-6deg' },
            { left: '14%', bottom: '12%', size: 'text-2xl', delay: '1.1s', rot: '4deg' },
            { right: '12%', bottom: '16%', size: 'text-xl', delay: '1.6s', rot: '-10deg' },
          ].map((s, i) => (
            <span
              key={i}
              className={`absolute ${s.size} opacity-30 select-none`}
              style={{
                left: s.left,
                right: s.right,
                top: s.top,
                bottom: s.bottom,
                transform: `rotate(${s.rot})`,
                animation: 'pb-balloon-float 6s ease-in-out infinite',
                animationDelay: s.delay,
                ['--dx' as string]: '14px',
                ['--dy' as string]: '-16px',
                ['--rot' as string]: s.rot,
              }}
            >
              {['💖', '⭐', '🎀', '✨'][i]}
            </span>
          ))}
        </div>

        <div className="relative z-10 flex min-h-0 h-full flex-col gap-4 lg:h-full lg:flex-row lg:items-stretch lg:justify-center">
          {/* Left: framed photo — bare, clickable to zoom */}
          {!isTimedFlow && (<>
          <button
            type="button"
            onClick={() => void handleViewFramed()}
            title="View framed photo larger"
            aria-label="View framed photo larger"
            className="group relative mx-auto flex h-[34vh] w-full max-w-[260px] min-h-0 shrink-0 cursor-pointer items-center justify-center self-center bg-transparent p-0 sm:max-w-[300px] lg:h-auto lg:max-w-none lg:flex-1 lg:self-auto"
            style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
          >
            {frame && photoSlots.length > 0 && outputs.framed ? (
              <>
                <div className="relative flex h-full w-full min-h-0 items-center justify-center">
                  <FrameCanvas
                    frame={frame}
                    photos={selectedPhotos}
                    photoSlotCount={photoSlots.length}
                    filter={frameFilter}
                    qrCodeUrl={qrDataUrl ?? undefined}
                    className="max-h-full w-auto max-w-full rounded-md bg-white shadow-[0_14px_30px_rgba(77,45,133,0.25)] transition-transform group-hover:scale-[1.02]"
                    style={{ height: '100%', aspectRatio: '3 / 4' }}
                  />
                  <span
                    className="pointer-events-none absolute -right-1.5 -top-1.5 text-2xl"
                    style={{ animation: 'pb-float 3.5s ease-in-out infinite' }}
                  >
                    💖
                  </span>
                </div>
              </>
            ) : (
              <span className="rounded-lg bg-white/60 px-4 py-6 text-center text-sm font-bold text-[#4d2d85]/60">
                No framed photo
              </span>
            )}
          </button>

          {/* Middle: photo slideshow (opens gallery) + live result below, same size */}
          <div
            className="flex min-h-0 flex-1 flex-col gap-3"
            style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.08s both' }}
          >
            <button
              type="button"
              onClick={() => outputs.allPhotos && setGalleryOpen(true)}
              title="View all photos"
              aria-label="View all photos"
              className="group relative flex min-h-0 min-h-[26vh] flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 border-[#a35ef6] bg-white p-1.5 shadow-[0_6px_0_rgba(77,45,133,0.2)] transition-transform hover:-translate-y-0.5 sm:p-2.5"
            >
              {outputs.allPhotos && allPhotos.length > 0 ? (
                <>
                  <div className="relative m-auto h-full w-full overflow-hidden rounded-md bg-black/10">
                    <div
                      className="flex h-full w-full transition-transform duration-700 ease-out"
                      style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                    >
                      {allPhotos.map((dataUrl, index) => (
                        <img
                          key={index}
                          src={dataUrl}
                          alt={`Photo ${index + 1}`}
                          draggable={false}
                          className="h-full w-full shrink-0 object-cover"
                        />
                      ))}
                    </div>
                  </div>
                  {/* Slideshow dots */}
                  {allPhotos.length > 1 && (
                    <span className="pointer-events-none absolute inset-x-0 top-2 flex justify-center gap-1.5">
                      {allPhotos.map((_, index) => (
                        <span
                          key={index}
                          className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                            index === slideIndex % allPhotos.length
                              ? 'w-5 bg-[#ff4bb5] shadow-[0_0_6px_rgba(255,75,181,0.8)]'
                              : 'bg-[#4d2d85]/30'
                          }`}
                        />
                      ))}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#ff4bb5]/90 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">
                    💖 View all photos ({allPhotos.length})
                  </span>
                </>
              ) : (
                <span className="text-center text-sm font-bold text-[#4d2d85]/60">
                  {outputs.allPhotos ? 'No individual photos recorded.' : 'Photo collection is turned off.'}
                </span>
              )}
            </button>

            {/* Framed live result — each slot plays its own live view clip */}
            {liveUrl && outputs.framedLive && (
              <button
                type="button"
                onClick={handleViewLive}
                title="View framed live photo"
                aria-label="View framed live photo"
                className="group relative flex min-h-0 min-h-[24vh] flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 border-[#4acaf1] bg-white p-1.5 shadow-[0_6px_0_rgba(74,202,241,0.25)] transition-transform hover:-translate-y-0.5 sm:p-2.5"
              >
                <img
                  src={liveUrl}
                  alt="Framed live photo preview"
                  className="h-full w-full rounded-md object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#4acaf1]/90 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">
                  📹 Live
                </span>
              </button>
            )}

            {/* Plain animated GIF result */}
            {gifUrl && outputs.gif && (
              <button
                type="button"
                onClick={handleViewGif}
                title="View animated GIF"
                aria-label="View animated GIF"
                className="group relative flex min-h-0 min-h-[24vh] flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 border-[#a35ef6] bg-white p-1.5 shadow-[0_6px_0_rgba(163,94,246,0.25)] transition-transform hover:-translate-y-0.5 sm:p-2.5"
              >
                <img
                  src={gifUrl}
                  alt="Animated GIF preview"
                  className="h-full w-full rounded-md object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#a35ef6]/90 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">
                  🎞️ GIF
                </span>
              </button>
            )}
          </div>
          </>)}

          {/* Right: QR + Finish Session */}
          <div
            className={`flex min-h-0 flex-col items-center justify-center gap-5 ${isTimedFlow ? 'flex-1 lg:gap-10' : 'shrink-0 lg:w-64 lg:gap-[9rem] xl:w-72'}`}
            style={{ animation: 'pb-bounce-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.16s both' }}
          >
            <div className="flex flex-col items-center gap-2">
             <span className="text-center text-[0.6rem] font-black uppercase tracking-[0.2em] text-[#4d2d85]">
             {isTimedFlow ? 'Scan QR, arrange your frame & print' : 'Scan QR to download your photos'}
            </span>
            <button
              onClick={() => setQrOpen(true)}
              aria-label="Enlarge QR code"
              className="relative block cursor-pointer overflow-hidden rounded-[18px] border-4 border-[#a35ef6] bg-white p-3 shadow-[0_8px_0_rgba(77,45,133,0.25)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_0_rgba(77,45,133,0.3)] hover:border-[#ff4bb5]"
            >
              {downloadUrl && qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt="Scan to download your photos" className="h-40 w-40 sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-64 lg:w-64" />
                  {/* Pulsing aura */}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[14px]"
                    style={{ animation: 'pb-pulse-ring 2.4s ease-out infinite' }}
                  />
                  {/* Scanning line */}
                  <span
                    className="pointer-events-none absolute inset-x-4 top-4 z-10 h-[3px] rounded-full bg-[#ff4bb5]/80 shadow-[0_0_10px_rgba(255,75,181,0.9)]"
                    style={{ animation: 'pb-scan 2.8s ease-in-out infinite' }}
                  />
                 
                </>
              ) : (
                <div className="flex h-40 w-40 flex-col items-center justify-center gap-1 text-center text-[0.6rem] font-black uppercase tracking-[0.18em] text-[#4d2d85] sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-64 lg:w-64">
                  <span className="pb-tap text-base" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>⏳</span>
                  Generating QR...
                </div>
              )}
            </button>
            </div>
            
             <button
          onClick={completeSession}
          disabled={!isDone}
          title="Finish Session"
          className={`shrink-0 rounded-[12px] px-6 py-3 text-[1.2rem] font-black uppercase tracking-[0.16em] transition-all md:px-8 ${
            isDone
              ? 'bg-[#ff4bb5] text-[#ffffff] shadow-[0_4px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(0,0,0,0.18)] active:translate-y-0'
              : 'cursor-not-allowed bg-[#7d6ea6] text-white opacity-70'
          }`}
          style={isDone ? { animation: 'pb-bounce-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' } : undefined}
        >
          {isDone ? '✓ Selesai 🎉' : 'Finish Session'}
        </button>
          </div>
          
        </div>
        
      </div>

      {/* Fullscreen gallery — all photos */}
      {galleryOpen && (
        <div
          className="print-no-show fixed inset-0 z-50 flex flex-col bg-[#1a0b2e]"
          style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}
          onMouseDown={() => setGalleryOpen(false)}
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1a0b2e]/80 px-5 py-4 backdrop-blur">
            <div>
              <h3 className="text-lg font-bold text-white">Your photos</h3>
              <p className="text-xs text-white/40">
                {allPhotos.length} photo{allPhotos.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => setGalleryOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#ff4bb5] text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110 active:scale-95"
              aria-label="Close"
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
                  className="group relative mb-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 border-[#4acaf1] bg-[#2b1a4a] p-1.5 shadow-[0_6px_0_rgba(74,202,241,0.25)] transition-transform hover:-translate-y-0.5 sm:p-2.5"
                >
                  <img
                    src={liveUrl}
                    alt="Framed live photo"
                    className="max-h-[46vh] w-auto rounded-md object-contain"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#4acaf1]/90 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">
                    📹 Framed live photo
                  </span>
                </button>
              )}

              {gifUrl && outputs.gif && (
                <button
                  type="button"
                  onClick={handleViewGif}
                  title="View animated GIF"
                  aria-label="View animated GIF"
                  className="group relative mb-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-4 border-[#a35ef6] bg-[#2b1a4a] p-1.5 shadow-[0_6px_0_rgba(163,94,246,0.25)] transition-transform hover:-translate-y-0.5 sm:p-2.5"
                >
                  <img
                    src={gifUrl}
                    alt="Animated GIF"
                    className="max-h-[46vh] w-auto rounded-md object-contain"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#a35ef6]/90 px-2 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">
                    🎞️ Animated GIF
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {allPhotos.map((dataUrl, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => handleViewPhoto(dataUrl, index)}
                    title={`View photo ${index + 1}`}
                    aria-label={`View photo ${index + 1}`}
                    className="group relative block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#2b1a4a]"
                  >
                    <div className="aspect-square w-full overflow-hidden bg-black/30">
                      <img
                        src={dataUrl}
                        alt={`Photo ${index + 1}`}
                        className="h-full w-full object-cover transition transform group-hover:scale-105"
                      />
                    </div>
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/70 px-2 py-1.5 text-xs text-white/90">
                      Photo {index + 1}
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
          className="print-no-show fixed inset-0 z-50 flex items-center justify-center bg-[#1a0b2e]/90 p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[18px] border-[4px] border-[#ff4bb5] bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-[0.9rem] font-black uppercase tracking-[0.14em] text-[#4d2d85]">
              Scan untuk unduh
            </h2>
            {modalQr ? (
              <img src={modalQr} alt="Large QR code" className="h-72 w-72 rounded-[12px]" />
            ) : (
              <div className="flex h-72 w-72 items-center justify-center animate-pulse rounded-[12px] bg-gray-200">
                <span className="animate-spin text-xl">⏳</span>
              </div>
            )}
            {downloadUrl && (
              <p className="max-w-full break-all text-center text-[0.6rem] font-bold text-[#4d2d85]">{downloadUrl}</p>
            )}
            <button
              onClick={() => setQrOpen(false)}
              className="rounded-full bg-[#ff4bb5] px-6 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Result zoom modal — view any result enlarged, like the QR modal */}
      {viewer && (
        <div
          className="print-no-show fixed inset-0 z-50 flex items-center justify-center bg-[#1a0b2e]/95 p-4"
          onClick={() => setViewer(null)}
        >
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewer.url}
              alt={viewer.label}
              className={`max-h-[80vh] w-auto max-w-full bg-white object-contain shadow-2xl ${
                viewer.rounded ? 'rounded-[14px] border-[4px] border-[#ff4bb5]' : ''
              }`}
            />
            <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-white">{viewer.label}</p>
            <button
              onClick={() => setViewer(null)}
              className="rounded-full bg-[#ff4bb5] px-6 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintQRScreen;