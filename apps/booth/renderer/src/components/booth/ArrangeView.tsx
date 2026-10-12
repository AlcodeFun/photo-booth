import React, { useState } from 'react';
import type { BoothCopywriting, BoothTheme, FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { withAlpha } from '../../lib/appearance';
import { usePhotoAdjustments } from './usePhotoAdjustments';
import { GestureGuideCard, SlotSelectionLayer, useGuideMode } from './PhotoGestureGuide';
import type { PhotoTransform } from '../../utils/photoTransform';

export interface ArrangeViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  frame: FrameConfig | null;
  /** Selected photo per capture slot, in order. */
  photoUrls: Array<string | undefined>;
  photoSlotCount: number;
  surfaceStyle?: React.CSSProperties;
  /** Trade two photos (indexes into the capture order). */
  onSwap?: (a: number, b: number) => void;
  /** Rotate / mirror one photo (index into the capture order). */
  onTransform?: (photoIndex: number, op: PhotoTransform) => Promise<void>;
  /** Done: carries the frame with the guest's move/zoom when anything changed. */
  onNext?: (adjustedFrame?: FrameConfig) => void;
}

const ToolButton: React.FC<{
  theme: BoothTheme;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ theme, label, icon, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border-2 px-2 py-2 text-[0.7rem] font-black uppercase tracking-[0.08em] transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:opacity-40 sm:text-xs"
    style={{ borderColor: theme.deep, backgroundColor: theme.card, color: theme.cardForeground, boxShadow: `0 3px 0 ${theme.deep}` }}
  >
    <span className="h-6 w-6">{icon}</span>
    {label}
  </button>
);

const RotateIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const FlipIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
    <path d="M12 3v18" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
    <path d="M9 7L3 17h6z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M15 7l6 10h-6z" fill="currentColor" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);
const ResetIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2.2" />
    <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * Presentational core of the arrange step (flows 1 and 3): the guest moves /
 * zooms each photo in its slot, rotates or mirrors it, and changes the photo
 * order. Gestures work anywhere on the preview (shared engine with the
 * hosted organize page).
 */
export const ArrangeView: React.FC<ArrangeViewProps> = ({
  copy,
  theme,
  frame,
  photoUrls,
  photoSlotCount,
  surfaceStyle,
  onSwap,
  onTransform,
  onNext,
}) => {
  const [showGuide, setShowGuide] = useState(true);
  const [busy, setBusy] = useState(false);
  const guideMode = useGuideMode(showGuide);
  const adjust = usePhotoAdjustments(frame, photoSlotCount, photoUrls, () => setShowGuide(false));

  const slotPhoto = (slotIndex: number) => {
    const slot = adjust.template.photoSlots[slotIndex];
    return slot ? (slot.sourcePhotoSlot ?? slot.slotNumber) - 1 : -1;
  };
  const selectedPhoto = slotPhoto(adjust.selectedIndex);
  const selectPhoto = (photoIndex: number) => {
    const slotIndex = adjust.template.photoSlots.findIndex((_, i) => slotPhoto(i) === photoIndex);
    if (slotIndex >= 0) adjust.selectSlot(slotIndex);
  };

  const move = (photoIndex: number, delta: number) => {
    const target = photoIndex + delta;
    if (target < 0 || target >= photoUrls.length) return;
    onSwap?.(photoIndex, target);
    // Keep the moved photo selected at its new place.
    selectPhoto(target);
  };

  const transform = async (op: PhotoTransform) => {
    if (selectedPhoto < 0 || !onTransform || busy) return;
    setBusy(true);
    try {
      await onTransform(selectedPhoto, op);
    } finally {
      setBusy(false);
    }
  };

  const hasSelection = selectedPhoto >= 0 && Boolean(photoUrls[selectedPhoto]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ ...surfaceStyle, color: theme.foreground }}>
      <header className="flex shrink-0 flex-col items-center gap-1 px-4 pb-2 pt-3 text-center sm:pt-4">
        <p
          className="inline-block -rotate-2 rounded-full px-3 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.22em] sm:text-xs"
          style={{ backgroundColor: theme.secondary, color: theme.secondaryForeground }}
        >
          {copy.organizeEyebrow}
        </p>
        <h1 className="text-xl font-black uppercase leading-none tracking-[-0.03em] sm:text-3xl">{copy.organizeTitle}</h1>
        <p className="text-xs font-semibold opacity-70 sm:text-sm">{copy.organizeHint}</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Frame preview: gestures anywhere here drive the selected photo */}
        <section
          className="relative flex min-h-0 min-w-0 flex-1 cursor-grab overflow-hidden p-3 active:cursor-grabbing sm:p-5"
          style={{ touchAction: 'none' }}
          {...adjust.surfaceHandlers}
        >
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
            <div
              className="relative"
              style={{
                aspectRatio: `${adjust.template.width} / ${adjust.template.height}`,
                height: `min(100cqh, 100cqw * ${adjust.template.height / adjust.template.width})`,
              }}
            >
              <FrameCanvas
                template={adjust.displayTemplate}
                photos={photoUrls}
                photoSlotCount={photoSlotCount}
                className="h-full w-full border-2 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                style={{ borderColor: theme.deep }}
              />
              <SlotSelectionLayer
                theme={theme}
                slotRects={adjust.slotRects}
                photoIndexes={adjust.photoIndexes}
                selectedIndex={adjust.selectedIndex}
                showDemo={showGuide}
                mode={guideMode}
              />
              {busy && (
                <div className="pointer-events-none absolute inset-0 z-[65] grid place-items-center bg-black/20">
                  <span
                    className="h-10 w-10 rounded-full border-4"
                    style={{ borderColor: withAlpha('#ffffff', 0.35), borderTopColor: theme.tertiary, animation: 'pb-spin 0.8s linear infinite' }}
                  />
                </div>
              )}
            </div>
          </div>
          {showGuide && (
            <GestureGuideCard theme={theme} copy={copy} mode={guideMode} samplePhoto={photoUrls[0]} onDismiss={() => setShowGuide(false)} />
          )}
        </section>

        {/* Tools + photo order */}
        <aside
          className="flex shrink-0 flex-col gap-3 border-t-2 px-4 pb-4 pt-3 lg:w-[340px] lg:border-l-2 lg:border-t-0 lg:px-5 lg:py-5 xl:w-[380px]"
          style={{ borderColor: withAlpha(theme.foreground, 0.15) }}
        >
          <div className="flex gap-2">
            <ToolButton theme={theme} label={copy.organizeRotate} icon={RotateIcon} disabled={!hasSelection || busy} onClick={() => void transform('rotate')} />
            <ToolButton theme={theme} label={copy.organizeFlip} icon={FlipIcon} disabled={!hasSelection || busy} onClick={() => void transform('flip')} />
            <ToolButton
              theme={theme}
              label={copy.organizeReset}
              icon={ResetIcon}
              disabled={!hasSelection || busy}
              onClick={() => adjust.resetSlot(adjust.selectedIndex)}
            />
          </div>

          <div className="min-h-0">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] opacity-70">{copy.organizeOrderLabel}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
              {photoUrls.map((url, index) => {
                const selected = index === selectedPhoto;
                return (
                  <div key={index} className="relative w-24 shrink-0 lg:w-auto">
                    <button
                      type="button"
                      onClick={() => selectPhoto(index)}
                      className="block aspect-[3/4] w-full overflow-hidden rounded-xl border-[3px] transition"
                      style={{
                        borderColor: selected ? theme.tertiary : theme.deep,
                        boxShadow: selected ? `0 0 0 3px ${withAlpha(theme.tertiary, 0.45)}` : `0 3px 0 ${theme.deep}`,
                        backgroundColor: theme.deep,
                      }}
                      aria-pressed={selected}
                    >
                      {url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}
                    </button>
                    <span
                      className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-xs font-black"
                      style={{ backgroundColor: theme.action, color: theme.actionForeground }}
                    >
                      {index + 1}
                    </span>
                    {selected && (
                      <div className="absolute inset-x-1 bottom-1 flex justify-between">
                        {[
                          { delta: -1, label: copy.organizeMoveEarlier, glyph: '◀' },
                          { delta: 1, label: copy.organizeMoveLater, glyph: '▶' },
                        ].map(({ delta, label, glyph }) => (
                          <button
                            key={delta}
                            type="button"
                            onClick={() => move(index, delta)}
                            disabled={busy || index + delta < 0 || index + delta >= photoUrls.length}
                            aria-label={label}
                            className="grid h-7 w-7 place-items-center rounded-full text-xs font-black shadow disabled:opacity-0"
                            style={{ backgroundColor: theme.card, color: theme.cardForeground }}
                          >
                            {glyph}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNext?.(adjust.isDirty && adjust.adjustedFrame ? adjust.adjustedFrame : undefined)}
            disabled={busy}
            className="mt-auto min-h-12 rounded-xl border-2 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            style={
              {
                borderColor: theme.deep,
                backgroundColor: theme.action,
                color: theme.actionForeground,
                '--glow': withAlpha(theme.action, 0.55),
                animation: 'pb-cta-breathe 2.4s ease-in-out 2s infinite',
              } as React.CSSProperties
            }
          >
            {copy.organizeNextButton} →
          </button>
        </aside>
      </div>
    </div>
  );
};

export default ArrangeView;
