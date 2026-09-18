import React, { useEffect, useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../components/FrameCanvas';
import { MOCK_FRAMES } from '../data/mockData';
import { useFramesWithTemplateDrafts } from '../hooks/useFramesWithTemplateDrafts';
import { listFrameTemplates } from '../lib/frameTemplates';
import { useSessionStore } from '../store/sessionStore';
import { resolveFrameTemplate } from '../utils/frameTemplateConfig';

export const FrameSelectionScreen: React.FC = () => {
  const selectFrame = useSessionStore((state) => state.selectFrame);
  const [frames, setFrames] = useState<FrameConfig[]>(MOCK_FRAMES);
  const [isLoading, setIsLoading] = useState(true);
  const framesWithDrafts = useFramesWithTemplateDrafts(frames, 3);
  const [selected, setSelected] = useState<FrameConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFrameTemplates()
      .then((remote) => {
        if (!cancelled && remote.length > 0) {
          setFrames(remote);
        }
      })
      .catch(() => {
        // Fall back to local MOCK_FRAMES when Supabase is unreachable/unconfigured.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (frame: FrameConfig) => {
    setSelected(frame);
  };

  const handleClose = () => {
    setSelected(null);
  };

  const handleConfirm = () => {
    if (selected) {
      selectFrame(selected);
    }
  };

  const selectedPreviewRatio = selected
    ? (() => {
        const template = resolveFrameTemplate(selected, selected.photoSlots ?? 3);
        return template.width / template.height;
      })()
    : 0.75;

  return (
    <div className="flex h-[calc(100vh-3rem)] items-center justify-center select-none overflow-hidden p-2 sm:p-4 md:p-6">
      <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-2 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:p-4 md:p-6">
        <div className="pb-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[14px] bg-[#ff4bb5] p-2 sm:p-3 md:p-5">
          <div className="mb-2 shrink-0 text-center md:mb-6">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-[#4d2d85] sm:text-[0.8rem]">Bingkai</p>
            <h1 className="mt-1 text-[1.4rem] font-black uppercase tracking-[-0.08em] text-[#4d2d85] sm:text-[2rem] md:text-[2.6rem]">
              Pilih gaya foto
            </h1>
          </div>

          <div className="grid grid-cols-2 place-items-center gap-2 sm:gap-4 md:grid-cols-4">
            {isLoading
              ? Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="flex w-full select-none flex-col rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-2 sm:p-3"
                  >
                    <div className="mb-2 aspect-[3/4] w-full animate-pulse rounded-[12px] border-[3px] border-[#7a4de3] bg-[#f3dcee] sm:mb-4" />
                    <div className="mx-auto mb-3 h-[1.05rem] w-3/4 animate-pulse rounded-full bg-[#7a4de3]/25" />
                  </div>
                ))
              : framesWithDrafts.map((frame) => (
              <div
                key={frame.id}
                onClick={() => handleSelect(frame)}
                className="flex w-full cursor-pointer flex-col rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-2 transition-all duration-200 hover:border-[#4acaf1] sm:p-3"
              >
                <FrameCanvas
                  frame={frame}
                  photoSlotCount={frame.photoSlots ?? 3}
                  className="mb-2 w-full rounded-[12px] border-[3px] border-[#7a4de3] bg-[#f3dcee] sm:mb-4"
                />
                <h3 className="shrink-0 text-center text-sm font-black uppercase tracking-[0.08em] text-[#4d2d85]">{frame.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{
            background: 'rgba(10,5,25,.96)',
            animation: 'pb-modal-fade 0.25s ease-out both',
          }}
          onClick={handleClose}
        >
          <div
            className="relative flex max-h-[82vh] max-w-[92vw] items-center justify-center"
            style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <FrameCanvas
              frame={selected}
              photoSlotCount={selected.photoSlots ?? 3}
              className="rounded-[14px] border-[3px] border-[#4acaf1] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
              style={{
                width: `min(80vh * ${selectedPreviewRatio}, 92vw)`,
                aspectRatio: `${selectedPreviewRatio}`,
              }}
            />
          </div>

          <button
            onClick={handleClose}
            className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff4bb5] text-[1.05rem] font-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110 active:scale-95 sm:h-9 sm:w-9"
            aria-label="Close"
          >
            &#10005;
          </button>

          <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-6 pb-8 pt-16">
            <span className="mr-auto max-w-[52%] truncate text-[0.82rem] font-black uppercase tracking-[0.08em] text-white sm:text-[0.9rem]">
              {selected.name}
            </span>
            <button
              onClick={handleConfirm}
              className="shrink-0 rounded-full bg-[#4acaf1] px-7 py-3 text-[0.78rem] font-black uppercase tracking-[0.14em] text-[#4d2d85] shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0 sm:text-[0.85rem]"
            >
              Pilih bingkai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameSelectionScreen;
