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
    <div className="flex flex-col items-center justify-between h-full max-w-xl mx-auto px-6 py-10 select-none">
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

      <div className="print-no-show text-center mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Delivering Your Memories</h1>
        <p className="text-zinc-400">Please wait while your physical and digital copies are prepared</p>
      </div>

      <div className="w-full flex flex-col items-center gap-6 my-6 flex-grow justify-center print-no-show">
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Physical Print:</span>
            <span
              className={`text-sm font-semibold ${
                printStatus === 'PRINTING'
                  ? 'text-amber-400 animate-pulse'
                  : printStatus === 'SUCCESS'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              {printStatus === 'PRINTING' && '🖨️ Printing...'}
              {printStatus === 'SUCCESS' && '✅ Completed'}
              {printStatus === 'IDLE' && 'Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Digital Upload:</span>
            <span
              className={`text-sm font-semibold ${
                uploadStatus === 'UPLOADING'
                  ? 'text-amber-400 animate-pulse'
                  : uploadStatus === 'SUCCESS'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              {uploadStatus === 'UPLOADING' && '☁️ Uploading...'}
              {uploadStatus === 'SUCCESS' && '✅ Uploaded'}
              {uploadStatus === 'IDLE' && 'Pending'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200">
          <span>Print size</span>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-black">4R / 4×6 in</span>
        </div>

        <div className="print-sheet flex items-center justify-center rounded-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
          <FrameCanvas
            frame={frame}
            photos={selectedPhotos}
            photoSlotCount={photoSlots.length}
            filterClassName={filterClassName}
            className="w-[4in] h-[6in] rounded-2xl"
          />
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-white border border-zinc-200 rounded-3xl w-48 h-48 shadow-xl relative mt-4">
          {uploadStatus === 'SUCCESS' ? (
            <>
              <div className="w-36 h-36 border-4 border-black p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                </div>
                <div className="w-full h-8 flex justify-center items-center font-mono text-[9px] font-black text-black">
                  [ SCAN ME ]
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-6 h-6 bg-black"></div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-zinc-500 text-xs">
              <span className="animate-spin text-xl">⏳</span>
              Generating QR...
            </div>
          )}
        </div>

        {uploadStatus === 'SUCCESS' && (
          <span className="text-zinc-400 text-sm mt-2">Scan the QR code to download your framed photo strip and GIF!</span>
        )}
      </div>

      <div className="print-no-show w-full flex flex-col gap-3">
        <button
          onClick={handleDownloadPhoto}
          className="w-full max-w-md py-4 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all tracking-wider"
        >
          Download Photo
        </button>

        <button
          onClick={handleDownloadPdf}
          className="w-full max-w-md py-4 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 text-zinc-100 font-semibold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all"
        >
          Save as PDF
        </button>

        <button
          onClick={completeSession}
          disabled={!isDone}
          className={`w-full max-w-md py-4 font-bold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all tracking-wider ${
            isDone
              ? 'bg-emerald-500 hover:bg-emerald-600 text-black cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          Finish Session
        </button>
      </div>
    </div>
  );
};

export default PrintQRScreen;
