import React, { useEffect, useMemo, useRef, useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { getSelectedPhotoUrls, getAllPhotoUrls } from '../utils/photoSlots';
import { getCanvasFilter } from '../utils/filters';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import {
  downloadFramedPhoto,
  createResultGif,
  renderComposition,
} from '../utils/resultExport';
import {
  generateSessionToken,
  registerGallerySession,
  uploadSessionFiles,
  dataUrlToBlob,
  withTimeout,
  SessionUploadFile,
} from '../utils/sessionUpload';
import { generateQrDataUrl } from '../utils/qr';
import { GALLERY_URL } from '../config';

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className ?? 'h-5 w-5'}>
    <path
      d="M12 3v12m0 0l-4-4m4 4l4-4"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const GifIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className ?? 'h-5 w-5'}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 10h3M8.5 10v4M13 14v-4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className ?? 'h-5 w-5'}>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
    <path d="M5.5 19l4.5-4 3 2.5L16 14l3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface DownloadActionProps {
  label: string;
  icon: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const DownloadAction: React.FC<DownloadActionProps> = ({ label, icon, busy, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled || busy}
    title={label}
    aria-label={label}
    className="flex w-16 flex-col items-center gap-1 rounded-[12px] border-[3px] border-[#a35ef6] bg-white px-2 py-2 text-[#4d2d85] shadow-[0_3px_0_rgba(77,45,133,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
  >
    <span className={busy ? 'animate-pulse' : undefined}>{icon}</span>
    <span className="text-[0.55rem] font-black uppercase tracking-[0.08em] leading-none">{busy ? '...' : label}</span>
  </button>
);

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

  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<'framed' | 'gif' | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [modalQr, setModalQr] = useState<string | null>(null);
  const uploadInFlight = useRef(false);
  const createInFlight = useRef(false);
  const sessionToken = useRef<string | null>(null);

  // Cloud failure must never block the local experience, so the session can be
  // finished as soon as the physical print is done. Once the QR is available
  // (downloadUrl is set), the customer can leave even while files still upload.
  const isDone =
    printStatus === 'SUCCESS' &&
    (uploadStatus === 'SUCCESS' || uploadStatus === 'ERROR' || Boolean(downloadUrl));
  const multiPhoto = photoSlots.length > 1;
  const selectedPhotos = useMemo(() => getSelectedPhotoUrls(photoSlots), [photoSlots]);
  const allPhotos = useMemo(() => getAllPhotoUrls(photoSlots), [photoSlots]);
  const frameFilter = getCanvasFilter(filterId);

  // Generate the animated GIF once for multi-photo strips (shared by preview + upload).
  useEffect(() => {
    let cancelled = false;
    if (multiPhoto) {
      createResultGif(photoSlots, filterId)
        .then((blob) => {
          if (!cancelled) {
            setGifBlob(blob);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGifBlob(null);
          }
        });
    } else {
      setGifBlob(null);
    }
    return () => {
      cancelled = true;
    };
  }, [photoSlots, filterId, multiPhoto]);

  // Preview object URL derived from the shared GIF blob.
  useEffect(() => {
    if (!gifBlob) {
      setGifUrl(null);
      return;
    }
    const url = URL.createObjectURL(gifBlob);
    setGifUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [gifBlob]);

  // Step 1: generate the session token locally so the QR renders instantly
  // (no server round-trip), then register the session in the background.
  // Falls back to a simulated success when no gallery endpoint is configured.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const store = useSessionStore.getState();
      if (store.uploadStatus !== 'UPLOADING' || sessionToken.current || createInFlight.current) {
        return;
      }

      if (!GALLERY_URL) {
        setTimeout(() => {
          if (!cancelled) {
            store.setUploadStatus('SUCCESS');
          }
        }, 3000);
        return;
      }

      createInFlight.current = true;
      setUploading(true);
      // Token (and thus the URL) is generated client-side, so the QR is ready
      // to render in the same frame — the background work never delays it.
      const token = generateSessionToken();
      sessionToken.current = token;
      useSessionStore.getState().setDownloadUrl(`${GALLERY_URL}/p/${token}`);
      try {
        await withTimeout(registerGallerySession(GALLERY_URL, token), 8000, 'Reserving gallery session');
        if (cancelled) {
          return;
        }
      } catch (error) {
        console.error('Session register failed:', error);
        if (!cancelled) {
          useSessionStore.getState().setUploadStatus('ERROR');
        }
      } finally {
        createInFlight.current = false;
        if (!cancelled) {
          setUploading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [uploadStatus]);

  // Step 2: push the final outputs (framed PNG, originals, GIF) to the reserved
  // session in the background. Runs once the GIF stage is ready.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const store = useSessionStore.getState();
      if (!GALLERY_URL || !store.downloadUrl || store.uploadStatus !== 'UPLOADING' || uploadInFlight.current) {
        return;
      }
      if (multiPhoto && !gifBlob) {
        return; // wait for the GIF stage before uploading
      }

      uploadInFlight.current = true;
      setUploading(true);
      try {
        const files: SessionUploadFile[] = [];

        if (store.frame && store.photoSlots.length > 0) {
          const canvas = await renderComposition(store.frame, store.photoSlots, store.filterId, {
            includeFrame: true,
          });
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            files.push({ blob, name: 'framed.png' });
          }
        }

        getAllPhotoUrls(store.photoSlots).forEach((dataUrl, index) => {
          const mime = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? 'image/jpeg';
          const ext = mime.includes('png') ? 'png' : 'jpg';
          files.push({
            blob: dataUrlToBlob(dataUrl),
            name: `photo-${String(index + 1).padStart(2, '0')}.${ext}`,
          });
        });

        if (store.photoSlots.length > 1 && gifBlob) {
          files.push({ blob: gifBlob, name: 'result.gif' });
        }

        const match = /\/p\/([^/?#]+)/.exec(store.downloadUrl);
        const token = sessionToken.current ?? (match ? match[1] : '');
        if (!token) {
          throw new Error('Missing session token');
        }
        // Idempotent — guarantees the session exists server-side even if the
        // register step above was interrupted or failed.
        await withTimeout(registerGallerySession(GALLERY_URL, token), 8000, 'Reserving gallery session');
        await withTimeout(uploadSessionFiles(files, GALLERY_URL, token), 60000, 'Uploading photos');
        if (cancelled) {
          return;
        }
        useSessionStore.getState().setUploadStatus('SUCCESS');
      } catch (error) {
        console.error('Upload failed:', error);
        if (!cancelled) {
          useSessionStore.getState().setUploadStatus('ERROR');
        }
      } finally {
        uploadInFlight.current = false;
        if (!cancelled) {
          setUploading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [downloadUrl, uploadStatus, filterId, frame, gifBlob, multiPhoto, photoSlots]);

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

  const handleRetryUpload = () => {
    useSessionStore.getState().setUploadStatus('UPLOADING');
  };

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

  const handleDownloadFramed = async () => {
    if (!frame || photoSlots.length === 0) return;
    setDownloading('framed');
    try {
      await downloadFramedPhoto(frame, photoSlots, filterId);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadGif = async () => {
    if (photoSlots.length === 0 || !multiPhoto) return;
    setDownloading('gif');
    try {
      const blob = await createResultGif(photoSlots, filterId);
      await downloadBlob(blob, 'photo-booth-result.gif');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none p-2 sm:p-4">
      <div className="w-full max-w-[920px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-3 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-4">
        <style>{`
          @media print {
            body { background: white !important; margin: 0; }
            .print-no-show { display: none !important; }
            .print-sheet {
              width: 4in !important; height: 6in !important;
              margin: 0 auto !important;
              box-shadow: none !important; border-radius: 0 !important;
            }
          }
        `}</style>

        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-4">
          {/* Header */}
          <div className="print-no-show mb-3 text-center text-[#4d2d85]">
            <div className="text-[0.65rem] font-black uppercase tracking-[0.28em]">Delivering Your Memories</div>
            <h1 className="mt-1 text-[1.3rem] font-black uppercase tracking-[-0.08em] md:text-[1.8rem]">
              Preparing print
            </h1>
          </div>

          {/* Main row */}
          <div className="print-no-show grid grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]">
            {/* Status card */}
            <div className="rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-3 text-[#4d2d85]">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-[12px] bg-[#ffefde] px-3 py-2">
                  <span className="text-[0.7rem] font-black uppercase tracking-[0.12em]">Physical Print</span>
                  <span className={`text-[0.6rem] font-black uppercase tracking-[0.12em] ${printStatus === 'SUCCESS' ? 'text-[#118f6d]' : printStatus === 'PRINTING' ? 'text-[#b25800]' : 'text-[#6d6a7f]'}`}>
                    {printStatus === 'PRINTING' && 'Printing...'}
                    {printStatus === 'SUCCESS' && 'Completed'}
                    {printStatus === 'IDLE' && 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-[12px] bg-[#dffbff] px-3 py-2">
                  <span className="text-[0.7rem] font-black uppercase tracking-[0.12em]">Digital Upload</span>
                  <span className={`text-[0.6rem] font-black uppercase tracking-[0.12em] ${uploadStatus === 'SUCCESS' ? 'text-[#118f6d]' : uploadStatus === 'UPLOADING' ? 'text-[#b25800]' : 'text-[#6d6a7f]'}`}>
                    {uploadStatus === 'UPLOADING' && 'Uploading...'}
                    {uploadStatus === 'SUCCESS' && 'Uploaded'}
                    {uploadStatus === 'IDLE' && 'Pending'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-3 rounded-full border-[3px] border-[#a35ef6] bg-[#fff3ff] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#4d2d85]">
                <span>Print size</span>
                <span className="rounded-full bg-[#ff7d57] px-2 py-0.5 text-[0.55rem] text-white">4R / 4×6 in</span>
              </div>
            </div>

            {/* Framed preview */}
            <div className="print-sheet flex items-center justify-center rounded-[18px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-4">
              <FrameCanvas
                frame={frame}
                photos={selectedPhotos}
                photoSlotCount={photoSlots.length}
                filter={frameFilter}
                className="w-full max-w-[210px] rounded-[14px] border-[3px] border-[#7a4de3] bg-white"
              />
            </div>

            {/* QR + GIF preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative flex h-32 w-32 items-center justify-center rounded-[18px] border-[4px] border-[#a35ef6] bg-white p-3 shadow-[0_8px_0_rgba(77,45,133,0.25)]">
                  {downloadUrl && qrDataUrl ? (
                    <>
                      <button
                        onClick={() => setQrOpen(true)}
                        className="h-full w-full cursor-pointer"
                        aria-label="Enlarge QR code"
                      >
                        <img src={qrDataUrl} alt="Scan to download your photos" className="h-full w-full rounded-[6px]" />
                      </button>
                      <span className="pointer-events-none absolute -right-2.5 -top-2.5 z-10">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff4bb5] opacity-75" />
                        <span className="relative inline-flex h-7 w-7 animate-bounce items-center justify-center rounded-full border-[3px] border-white bg-[#ff4bb5] text-[0.7rem] shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                          🔍
                        </span>
                      </span>
                    </>
                  ) : uploadStatus === 'SUCCESS' && !downloadUrl ? (
                    <div className="flex h-full w-full items-center justify-center text-center">
                      <span className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-[#4d2d85]">
                        Offline — grab photos below
                      </span>
                    </div>
                  ) : uploadStatus === 'ERROR' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
                      <span className="text-base">⚠️</span>
                      <span className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-[#b0003a]">
                        Upload failed
                      </span>
                      <button
                        onClick={handleRetryUpload}
                        className="rounded-full bg-[#ff4bb5] px-3 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_2px_0_rgba(0,0,0,0.15)]"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center text-[0.6rem] font-black uppercase tracking-[0.18em] text-[#4d2d85]">
                      <span className="animate-spin text-base">⏳</span>
                      {uploading ? 'Uploading...' : 'Generating QR...'}
                    </div>
                  )}
                </div>
                {downloadUrl && qrDataUrl && (
                  <span className="animate-pulse text-[0.55rem] font-black uppercase tracking-[0.18em] text-[#4d2d85]">
                    Tap untuk memperbesar
                  </span>
                )}
                {downloadUrl && uploadStatus === 'ERROR' && (
                  <button
                    onClick={handleRetryUpload}
                    className="animate-pulse rounded-full border-[3px] border-[#b0003a] bg-[#fff3ff] px-3 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-[#b0003a]"
                  >
                    Upload interrupted — retry
                  </button>
                )}
              </div>

              {gifUrl && multiPhoto && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[0.55rem] font-black uppercase tracking-[0.24em] text-[#4d2d85]">GIF</span>
                  <img
                    src={gifUrl}
                    alt="Animated result preview"
                    className="h-20 w-auto rounded-[10px] border-[3px] border-[#7a4de3] bg-white shadow-[0_5px_0_rgba(77,45,133,0.2)]"
                  />
                </div>
              )}
            </div>
          </div>

          {downloadUrl ? (
            <p className="print-no-show mt-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#4d2d85]">
              Scan the QR code to download your photos
            </p>
          ) : uploadStatus === 'SUCCESS' && (
            <p className="print-no-show mt-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#4d2d85]">
              Photos are ready on the booth below
            </p>
          )}

          {/* Download icons + finish */}
          <div className="print-no-show mt-4 flex flex-wrap items-center justify-center gap-4">
            <DownloadAction
              label="With frame"
              icon={<DownloadIcon />}
              busy={downloading === 'framed'}
              disabled={!frame || photoSlots.length === 0}
              onClick={handleDownloadFramed}
            />
            <DownloadAction
              label="Photos"
              icon={<ImageIcon />}
              disabled={allPhotos.length === 0}
              onClick={() => setShowPhotos(true)}
            />
            {multiPhoto && (
              <DownloadAction
                label="GIF"
                icon={<GifIcon />}
                busy={downloading === 'gif'}
                disabled={photoSlots.length === 0}
                onClick={handleDownloadGif}
              />
            )}

            <button
              onClick={completeSession}
              disabled={!isDone}
              className={`rounded-[12px] px-6 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.16em] transition-all ${
                isDone
                  ? 'bg-[#d9f85a] text-[#2d2866] shadow-[0_4px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0'
                  : 'cursor-not-allowed bg-[#7d6ea6] text-white opacity-70'
              }`}
            >
              Finish Session
            </button>
          </div>
        </div>
      </div>

      {/* Photos overlay — displays the captured photos without zipping */}
      {showPhotos && (
        <div
          className="print-no-show fixed inset-0 z-50 flex items-center justify-center bg-[#1a0b2e]/90 p-4"
          onClick={() => setShowPhotos(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#fdf3ff] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[0.9rem] font-black uppercase tracking-[0.14em] text-[#4d2d85]">Your Photos</h2>
              <button
                onClick={() => setShowPhotos(false)}
                className="rounded-full border-[3px] border-[#a35ef6] bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#4d2d85]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto">
              {allPhotos.map((dataUrl, index) => (
                <div key={index} className="flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_4px_0_rgba(77,45,133,0.15)]">
                  <img src={dataUrl} alt={`Photo ${index + 1}`} className="block h-auto w-full" />
                  <button
                    type="button"
                    onClick={() => {
                      void downloadDataUrl(dataUrl, `photo-booth-${String(index + 1).padStart(2, '0')}.jpg`);
                    }}
                    className="block w-full py-1.5 text-center text-[0.6rem] font-black uppercase tracking-[0.1em] text-[#4d2d85]"
                  >
                    Save
                  </button>
                </div>
              ))}
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
    </div>
  );
};

export default PrintQRScreen;