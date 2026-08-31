import React, { useMemo } from 'react';
import { FramePhotoPlacement } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { useSessionStore } from '../store/sessionStore';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';
import { getSelectedPhotoUrls } from '../utils/photoSlots';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawSlotImage = async (
  ctx: CanvasRenderingContext2D,
  slot: FramePhotoPlacement,
  imageUrl: string | undefined,
  templateWidth: number,
  templateHeight: number,
) => {
  if (!imageUrl) {
    return;
  }

  const image = await loadImage(imageUrl);
  const x = slot.x;
  const y = slot.y;
  const width = slot.width;
  const height = slot.height;
  const radius = slot.borderRadius ?? 0;

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();

  const imgRatio = image.width / image.height;
  const boxRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (slot.objectFit === 'contain') {
    if (imgRatio > boxRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
      drawX = x + (width - drawWidth) / 2;
      drawY = y;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = x;
      drawY = y + (height - drawHeight) / 2;
    }
  } else {
    if (imgRatio > boxRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
      drawX = x - (drawWidth - width) / 2;
      drawY = y;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
      drawX = x;
      drawY = y - (drawHeight - height) / 2;
    }
  }

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  if (slot.objectPosition && slot.objectFit === 'cover') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }
};

export const PrintQRScreen: React.FC = () => {
  const { frame, filterId, photoSlots, printStatus, uploadStatus, completeSession } = useSessionStore((state) => ({
    frame: state.frame,
    filterId: state.filterId,
    photoSlots: state.photoSlots,
    printStatus: state.printStatus,
    uploadStatus: state.uploadStatus,
    completeSession: state.completeSession,
  }));

  const isDone = printStatus === 'SUCCESS' && uploadStatus === 'SUCCESS';
  const selectedPhotos = useMemo(() => getSelectedPhotoUrls(photoSlots), [photoSlots]);

  const handleDownloadPhoto = async () => {
    if (!frame || photoSlots.length === 0) {
      return;
    }

    const template = resolveFrameTemplate(frame, photoSlots.length);
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = template.backgroundColor ?? '#111111';
    ctx.fillRect(0, 0, template.width, template.height);

    const selectedPhotos = getSelectedPhotoUrls(photoSlots);

    for (const slot of template.photoSlots) {
      const photoUrl = selectedPhotos[(slot.sourcePhotoSlot ?? slot.slotNumber) - 1];
      await drawSlotImage(ctx, slot, photoUrl, template.width, template.height);
    }

    if (template.assetUrl) {
      try {
        const asset = await loadImage(template.assetUrl);
        ctx.drawImage(asset, 0, 0, template.width, template.height);
      } catch {
        // Ignore missing frame asset and still export the photo composition.
      }
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'photo-booth-result.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (typeof window.electronAPI?.printToPDF === 'function') {
      const savedPath = await window.electronAPI.printToPDF();
      if (savedPath) {
        window.alert(`PDF saved to: ${savedPath}`);
        return;
      }
    }

    window.print();
  };

  const filterClassName =
    filterId === 'mono'
      ? 'grayscale'
      : filterId === 'warm'
        ? 'sepia-[.45] saturate-[1.35]'
        : filterId === 'cool'
          ? 'hue-rotate-[25deg] saturate-[.8]'
          : '';

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1000px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <style>{`
            @media print {
              body {
                background: white !important;
                margin: 0;
              }

              .print-no-show {
                display: none !important;
              }

              .print-sheet {
                width: 4in !important;
                height: 6in !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
            }
          `}</style>

          <div className="print-no-show mb-6 text-center text-[#4d2d85]">
            <div className="text-[0.8rem] font-black uppercase tracking-[0.28em]">Delivering Your Memories</div>
            <h1 className="mt-2 text-[2rem] font-black uppercase tracking-[-0.08em] md:text-[3rem]">
              Preparing print
            </h1>
          </div>

          <div className="print-no-show grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,0.9fr)_minmax(260px,1.1fr)]">
            <div className="rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-5 text-[#4d2d85]">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-[12px] bg-[#ffefde] px-4 py-3">
                  <span className="text-sm font-black uppercase tracking-[0.12em]">Physical Print</span>
                  <span className={`text-xs font-black uppercase tracking-[0.12em] ${printStatus === 'SUCCESS' ? 'text-[#118f6d]' : printStatus === 'PRINTING' ? 'text-[#b25800]' : 'text-[#6d6a7f]'}`}>
                    {printStatus === 'PRINTING' && 'Printing...'}
                    {printStatus === 'SUCCESS' && 'Completed'}
                    {printStatus === 'IDLE' && 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-[12px] bg-[#dffbff] px-4 py-3">
                  <span className="text-sm font-black uppercase tracking-[0.12em]">Digital Upload</span>
                  <span className={`text-xs font-black uppercase tracking-[0.12em] ${uploadStatus === 'SUCCESS' ? 'text-[#118f6d]' : uploadStatus === 'UPLOADING' ? 'text-[#b25800]' : 'text-[#6d6a7f]'}`}>
                    {uploadStatus === 'UPLOADING' && 'Uploading...'}
                    {uploadStatus === 'SUCCESS' && 'Uploaded'}
                    {uploadStatus === 'IDLE' && 'Pending'}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-3 rounded-full border-[3px] border-[#a35ef6] bg-[#fff3ff] px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-[#4d2d85]">
                <span>Print size</span>
                <span className="rounded-full bg-[#ff7d57] px-2 py-1 text-[0.65rem] text-white">4R / 4×6 in</span>
              </div>
            </div>

            <div className="print-sheet flex items-center justify-center rounded-[18px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-4">
              <FrameCanvas
                frame={frame}
                photos={selectedPhotos}
                photoSlotCount={photoSlots.length}
                filterClassName={filterClassName}
                className="w-full max-w-[260px] rounded-[14px] border-[3px] border-[#7a4de3] bg-white"
              />
            </div>
          </div>

          <div className="print-no-show mt-6 flex flex-col gap-3">
            <button
              onClick={handleDownloadPhoto}
              className="w-full max-w-md self-center rounded-[12px] bg-[#ff7d57] px-8 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Download Photo
            </button>

          

            <button
              onClick={completeSession}
              disabled={!isDone}
              className={`w-full max-w-md self-center rounded-[12px] px-8 py-4 text-[0.8rem] font-black uppercase tracking-[0.18em] transition-all ${
                isDone
                  ? 'bg-[#4acaf1] text-[#2d2866] shadow-[0_5px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0'
                  : 'cursor-not-allowed bg-[#7d6ea6] text-white opacity-70'
              }`}
            >
              Finish Session
            </button>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-[18px] border-[4px] border-[#a35ef6] bg-white p-4 shadow-[0_12px_0_rgba(77,45,133,0.25)]">
              {uploadStatus === 'SUCCESS' ? (
                <div className="flex h-full w-full flex-col justify-between border-[4px] border-[#111827] bg-white p-2">
                  <div className="flex justify-between">
                    <div className="h-10 w-10 border-[4px] border-[#111827] bg-[#111827]"></div>
                    <div className="h-10 w-10 border-[4px] border-[#111827] bg-[#111827]"></div>
                  </div>
                  <div className="flex h-8 items-center justify-center text-[8px] font-black tracking-[0.2em] text-[#111827]">
                    [ SCAN ME ]
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="h-10 w-10 border-[4px] border-[#111827] bg-[#111827]"></div>
                    <div className="h-6 w-6 bg-[#111827]"></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#4d2d85]">
                  <span className="animate-spin text-xl">⏳</span>
                  Generating QR...
                </div>
              )}
            </div>
          </div>

          {uploadStatus === 'SUCCESS' && (
            <div className="mt-4 text-center text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[#4d2d85]">
              Scan the QR code to download your framed photo strip
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintQRScreen;
