import React, { useEffect, useMemo, useState } from 'react';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { useBoothConfig } from '../store/boothConfigStore';
import { useBoothAppearance, appearanceSurfaceStyle } from '../store/appearanceStore';
import { withAlpha } from '../lib/appearance';
import { getSelectedPhotoUrls } from '../utils/photoSlots';
import { getCanvasFilter } from '../utils/filters';
import { generateQrDataUrl } from '../utils/qr';
import QrResultView, { type ResultsPrintState, type ResultsUploadState } from '../components/booth/QrResultView';

/**
 * Final booth screen: scan the QR to download. The outputs themselves were
 * previewed on the effects screen; lib/uploadJob renders and uploads every
 * file (framed print, live photo, GIF) in the background, independent of this
 * screen, so finishing early never interrupts it.
 */
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
  const flowMode = useBoothConfig((state) => state.flowMode);
  const printMode = useBoothConfig((state) => state.printer.printMode);
  const printerEnabled = useBoothConfig((state) => state.printer.enabled);
  const active = useBoothAppearance((state) => state.appearance);
  const { copy, theme } = active;
  const isTimedFlow = flowMode === 'timed';
  // Manual mode queues the print for the operator; the customer never waits on
  // a physical print, so the screen finishes as soon as the upload/QR is ready.
  const manualPrint = printerEnabled && printMode === 'manual';

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [modalQr, setModalQr] = useState<string | null>(null);

  // Cloud failure must never block the local experience: once the QR exists
  // (downloadUrl is set) the guest can leave while files still upload.
  // Flow 2 (timed) prints later from the dashboard, so it never waits on print.
  const uploadReady = uploadStatus === 'SUCCESS' || uploadStatus === 'ERROR' || Boolean(downloadUrl);
  const printReady =
    !printerEnabled ||
    manualPrint ||
    printStatus === 'SUCCESS' ||
    printStatus === 'ERROR' ||
    printStatus === 'READY_TO_PRINT';
  const isDone = uploadReady && (isTimedFlow || printReady);
  const canFinishSession = !isTimedFlow || isDone;

  const printState: ResultsPrintState =
    isTimedFlow || !printerEnabled
      ? 'off'
      : manualPrint || printStatus === 'QUEUED' || printStatus === 'READY_TO_PRINT'
        ? 'queued'
        : printStatus === 'SUCCESS'
          ? 'ready'
          : printStatus === 'ERROR'
            ? 'error'
            : 'printing';
  const uploadState: ResultsUploadState =
    uploadStatus === 'SUCCESS' ? 'done' : uploadStatus === 'ERROR' ? 'error' : 'uploading';
  const selectedPhotos = useMemo(() => getSelectedPhotoUrls(photoSlots), [photoSlots]);
  const frameFilter = getCanvasFilter(filterId);

  // QR as soon as the gallery session is reserved (before uploads finish).
  useEffect(() => {
    let cancelled = false;
    if (!downloadUrl) {
      setQrDataUrl(null);
      return;
    }
    generateQrDataUrl(downloadUrl, 320)
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [downloadUrl]);

  // Bigger QR for the enlarge modal.
  useEffect(() => {
    if (!qrOpen || !downloadUrl) {
      setModalQr(null);
      return;
    }
    let cancelled = false;
    generateQrDataUrl(downloadUrl, 480)
      .then((url) => !cancelled && setModalQr(url))
      .catch(() => !cancelled && setModalQr(null));
    return () => {
      cancelled = true;
    };
  }, [qrOpen, downloadUrl]);

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setQrOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrOpen]);

  return (
    <div className="print-qrpage fixed inset-0 z-40 flex select-none flex-col overflow-hidden" style={{ animation: 'pb-modal-fade 0.25s ease-out both' }}>
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          .print-no-show { display: none !important; }
          .print-only { display: block !important; }
          .print-qrpage { position: static !important; height: auto !important; background: white !important; }
          .print-sheet-inner { width: 4in !important; height: 6in !important; margin: 0 auto !important; }
        }
      `}</style>

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

      <div className="print-no-show h-full w-full">
        <QrResultView
          copy={copy}
          theme={theme}
          isTimedFlow={isTimedFlow}
          frame={frame}
          photoUrls={selectedPhotos}
          photoSlotCount={photoSlots.length}
          filterStyle={frameFilter}
          qrDataUrl={qrDataUrl}
          printState={printState}
          uploadState={uploadState}
          isDone={isDone}
          canFinish={canFinishSession}
          surfaceStyle={appearanceSurfaceStyle(active, theme.background)}
          onFinish={completeSession}
          onOpenQr={() => setQrOpen(true)}
        />
      </div>

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
            <h2 className="text-center text-[0.9rem] font-black uppercase tracking-[0.14em]" style={{ color: theme.deep }}>
              {copy.resultsQrModalTitle}
            </h2>
            {modalQr ? (
              <img src={modalQr} alt={copy.resultsQrModalTitle} className="h-72 w-72 rounded-[12px]" />
            ) : (
              <div className="h-72 w-72 animate-pulse rounded-[12px]" style={{ backgroundColor: withAlpha(theme.deep, 0.15) }} />
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
    </div>
  );
};

export default PrintQRScreen;
