import React from 'react';
import type { BoothCopywriting, BoothTheme, FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { resolveFrameTemplate } from '../../utils/frameConfig';

export interface FrameSelectionViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  frames: FrameConfig[];
  isLoading: boolean;
  /** Currently chosen frame, which opens the confirm modal. `null` closes it. */
  selected: FrameConfig | null;
  onSelect: (frame: FrameConfig) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Presentational core of the frame selection screen: a three-column grid of
 * frame previews plus the full-screen confirm modal. Shared with the admin
 * appearance preview; the screen owns the frame fetch.
 */
export const FrameSelectionView: React.FC<FrameSelectionViewProps> = ({
  copy,
  theme,
  frames,
  isLoading,
  selected,
  onSelect,
  onClose,
  onConfirm,
}) => {
  const selectedPreviewRatio = selected
    ? (() => {
        const template = resolveFrameTemplate(selected, selected.photoSlots ?? 3);
        return template.width / template.height;
      })()
    : 0.75;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center select-none overflow-hidden p-2 sm:p-4 md:p-6"
      // Container query context so the modal preview below can size itself
      // against this view (cqh/cqw) instead of the window. The admin preview
      // stage reuses this component, so viewport units would be wrong there.
      style={{ containerType: 'size' }}
    >
      <div
        className="flex h-full w-full max-w-[95vw] flex-col overflow-hidden rounded-[18px] border-[4px] p-1.5 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] sm:p-2 md:p-2.5"
        style={{ borderColor: theme.primary, backgroundColor: theme.surface }}
      >
        <div
          className="pb-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[14px] p-1.5 sm:p-2 md:p-2.5"
          style={{ backgroundColor: theme.surface }}
        >
          <div className="mb-1 shrink-0 text-center md:mb-3">
            <p
              className="text-[0.65rem] font-black uppercase tracking-[0.28em] sm:text-[0.75rem]"
              style={{ color: theme.surfaceForeground }}
            >
              {copy.frameEyebrow}
            </p>
            <h1
              className="mt-0.5 text-[1.25rem] font-black uppercase tracking-[-0.08em] sm:text-[1.75rem] md:text-[2.25rem]"
              style={{ color: theme.surfaceForeground }}
            >
              {copy.frameTitle}
            </h1>
          </div>

          <div className="grid grid-cols-3 place-items-center gap-2 sm:gap-3">
            {isLoading
              ? Array.from({ length: 9 }, (_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="flex h-full w-full select-none flex-col rounded-[16px] border-[4px] p-2 sm:p-2.5"
                    style={{ borderColor: theme.secondary, backgroundColor: theme.card }}
                  >
                    <div
                      className="mb-2 aspect-[3/4] w-full animate-pulse rounded-[12px] border-[3px] sm:mb-3"
                      style={{ borderColor: theme.secondary, backgroundColor: theme.card }}
                    />
                    <div
                      className="mx-auto mb-2 h-[1rem] w-3/4 animate-pulse rounded-full"
                      style={{ backgroundColor: theme.secondary, opacity: 0.25 }}
                    />
                  </div>
                ))
              : frames.map((frame) => (
                  <div
                    key={frame.id}
                    onClick={() => onSelect(frame)}
                    className="flex h-full w-full cursor-pointer flex-col rounded-[16px] border-[4px] p-2 transition-all duration-200 hover:border-[4px] sm:p-2.5"
                    style={{
                      borderColor: theme.secondary,
                      backgroundColor: theme.card,
                      color: theme.cardForeground,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.accent;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.secondary;
                    }}
                  >
                    <FrameCanvas
                      frame={frame}
                      photoSlotCount={frame.photoSlots ?? 3}
                      className="mb-2 w-full rounded-[12px] border-[3px] sm:mb-3"
                      style={{ borderColor: theme.secondary, backgroundColor: theme.card }}
                    />
                    <h3 className="shrink-0 px-1 text-center text-sm font-black uppercase tracking-[0.08em] sm:text-base">
                      {frame.name}
                    </h3>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{
            background: theme.deep,
            opacity: 0.96,
            animation: 'pb-modal-fade 0.25s ease-out both',
          }}
          onClick={onClose}
        >
          <div
            className="relative flex max-h-[82%] max-w-[92%] items-center justify-center"
            style={{ animation: 'pb-modal-zoom 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <FrameCanvas
              frame={selected}
              photoSlotCount={selected.photoSlots ?? 3}
              className="rounded-[14px] border-[3px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
              style={{
                borderColor: theme.accent,
                // Percentage width here would resolve against this flex
                // container's shrink-to-fit width, which is indefinite -> 0px.
                // cqh/cqw are definite and track the view, not the window.
                width: `min(80cqh * ${selectedPreviewRatio}, 92cqw)`,
                aspectRatio: `${selectedPreviewRatio}`,
              }}
            />
          </div>

          <button
            onClick={onClose}
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-[10px] border-[3px] text-[1.2rem] font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:h-10 sm:w-10"
            style={{ borderColor: theme.secondary, backgroundColor: theme.primary }}
            aria-label="Close"
          >
            &#10005;
          </button>

          <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-6 pb-8 pt-16">
            <span
              className="mr-auto max-w-[52%] truncate text-[0.82rem] font-black uppercase tracking-[0.08em] text-white sm:text-[0.9rem]"
              style={{ color: theme.primaryForeground }}
            >
              {selected.name}
            </span>
            <button
              onClick={onConfirm}
              className="rounded-[12px] border-[3px] px-7 py-3 text-[0.78rem] font-black uppercase tracking-[0.14em] shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0 sm:text-[0.85rem]"
              style={{ borderColor: theme.secondary, backgroundColor: theme.card, color: theme.secondary }}
            >
              {copy.frameConfirmButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameSelectionView;
