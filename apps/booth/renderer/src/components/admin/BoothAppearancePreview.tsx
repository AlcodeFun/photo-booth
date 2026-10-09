import React, { useMemo, useState } from 'react';
import type { BoothAppearance } from '@photo-booth/types';
import { CAPTURE_FLOW_LABELS } from '../../store/boothConfigStore';
import { appearanceBackgroundStyle, appearanceSurfaceStyle } from '../../store/appearanceStore';
import { MOCK_FRAMES } from '../../data/mockData';
import { withAlpha } from '../../lib/appearance';
import { getCanvasFilter } from '../../utils/filters';
import BoothPreviewStage from './BoothPreviewStage';
import StartScreenPreview from './StartScreenPreview';
import TutorialView from '../booth/TutorialView';
import FrameSelectionView from '../booth/FrameSelectionView';
import CaptureView from '../booth/CaptureView';
import ReviewView from '../booth/ReviewView';
import FilterSelectionView from '../booth/FilterSelectionView';
import ResultsView from '../booth/ResultsView';
import CompleteView from '../booth/CompleteView';

export type PreviewFlow = 'retake' | 'auto' | 'timed';

const FLOW_ORDER: PreviewFlow[] = ['retake', 'auto', 'timed'];

export interface BoothAppearancePreviewProps {
  appearance: BoothAppearance;
  flowMode: PreviewFlow;
  onFlowChange: (flow: PreviewFlow) => void;
}

/**
 * One entry per real screen in the customer flow. Each entry renders the same
 * shared view component the booth screen itself renders, so the preview cannot
 * drift from the real flow.
 */
interface Slide {
  key: string;
  label: string;
  render: () => React.ReactNode;
}

export const BoothAppearancePreview: React.FC<BoothAppearancePreviewProps> = ({
  appearance,
  flowMode,
  onFlowChange,
}) => {
  const { copy, theme } = appearance;
  const [index, setIndex] = useState(0);

  const slides = useMemo<Slide[]>(() => {
    const isTimed = flowMode === 'timed';
    const isAuto = flowMode === 'auto';
    const frame = MOCK_FRAMES[0] ?? null;
    const photoSlots = [1, 2, 3];

    const bumper: Slide = {
      key: 'bumper',
      label: 'Start',
      render: () => <StartScreenPreview appearance={appearance} />,
    };

    const tutorial: Slide = {
      key: 'tutorial',
      label: 'How it works',
      render: () => <TutorialView copy={copy} theme={theme} />,
    };

    const frameSelect: Slide = {
      key: 'frame',
      label: 'Pick a frame',
      render: () => (
        <FrameSelectionView
          copy={copy}
          theme={theme}
          frames={MOCK_FRAMES}
          isLoading={false}
          selected={null}
          onSelect={() => {}}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      ),
    };

    // Non-timed flows run capture -> review once per photo slot.
    const captureReviewPair: Slide[] = photoSlots.flatMap((slot) => [
      {
        key: `capture-${slot}`,
        label: isAuto ? `Capture ${slot} (auto)` : `Capture ${slot}`,
        render: () => (
          <CaptureView
            copy={copy}
            theme={theme}
            isTimedFlow={isTimed}
            isAutoFlow={isAuto}
            currentPhotoSlot={slot}
            totalSlots={photoSlots.length}
            attemptNumber={1}
            maxAttempts={3}
            currentSlotAttemptCount={0}
            timedPhase="active"
            timedClock={92}
            timedStartCountLeft={3}
            isMirrored={false}
            countdown={3}
            isStarted
            isPreparing={false}
            isCapturing={false}
            feedReady
            cameraError={null}
            isFlash={false}
            photoAspectRatio={3 / 4}
            slots={photoSlots.map((n) => ({
              slotNumber: n,
              isCurrent: n === slot,
              isComplete: n < slot,
              photoUrl: undefined,
            }))}
            showPhotoSlotArrows={false}
            cameraFeed={
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: `linear-gradient(140deg, ${theme.deep}, ${withAlpha(theme.deep, 0.75)})`,
                }}
              >
                <span className="text-sm font-bold uppercase tracking-[0.18em] text-white/70">
                  {copy.captureStarting}
                </span>
              </div>
            }
          />
        ),
      },
      ...(isTimed
        ? []
        : [
            {
              key: `review-${slot}`,
              label: isAuto ? `Review ${slot} (auto)` : `Review ${slot}`,
              render: () => (
                <ReviewView
                  copy={copy}
                  theme={theme}
                  currentSlot={slot}
                  attemptCount={1}
                  maxAttempts={3}
                />
              ),
            },
          ]),
    ]);

    const filter: Slide = {
      key: 'filter',
      label: 'Filter',
      render: () => (
        <FilterSelectionView
          copy={copy}
          theme={theme}
          isTimedFlow={isTimed}
          frame={frame}
          photoUrls={photoSlots.map(() => undefined)}
          photoSlotCount={photoSlots.length}
          surfaceStyle={appearanceSurfaceStyle(appearance, theme.background)}
        />
      ),
    };

    const results: Slide = {
      key: 'results',
      label: isTimed ? 'Scan & print' : 'Results',
      render: () => (
        <ResultsView
          copy={copy}
          theme={theme}
          isTimedFlow={isTimed}
          frame={frame}
          photoUrls={photoSlots.map(() => undefined)}
          photoSlotCount={photoSlots.length}
          filterStyle={getCanvasFilter('original')}
          liveUrl={null}
          gifUrl={null}
          qrDataUrl={null}
          showFramed={!isTimed}
          showAllPhotos={!isTimed}
          showLive={!isTimed}
          showGif={!isTimed}
          printState={isTimed ? 'off' : 'printing'}
          uploadState="done"
          allPhotoUrls={[1, 2, 3].map((n) => `${import.meta.env.BASE_URL}photos/${n}.jpg`)}
          isDone
          canFinish
          surfaceStyle={appearanceSurfaceStyle(appearance, theme.tertiary)}
        />
      ),
    };

    const complete: Slide = {
      key: 'complete',
      label: 'Done',
      render: () => <CompleteView copy={copy} theme={theme} />,
    };

    // The timed session skips frame selection and the whole capture/review
    // carousel: it shoots freely inside a time budget, then goes straight to
    // the QR and the completion screen.
    if (isTimed) {
      return [bumper, tutorial, filter, results, complete];
    }
    return [bumper, tutorial, frameSelect, ...captureReviewPair, filter, results, complete];
  }, [appearance, copy, theme, flowMode]);

  const safeIndex = Math.min(index, slides.length - 1);
  const current = slides[safeIndex];

  const go = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  // Left/right arrows step through the customer's screens.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + slides.length) % slides.length);
      } else if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % slides.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slides.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* Flow tabs — the customer only ever sees one of these journeys. */}
      <div className="flex flex-wrap gap-1.5">
        {FLOW_ORDER.map((flow) => (
          <button
            key={flow}
            type="button"
            onClick={() => {
              setIndex(0);
              onFlowChange?.(flow);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
              flow === flowMode
                ? 'bg-white text-slate-900'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {CAPTURE_FLOW_LABELS[flow]}
          </button>
        ))}
      </div>

      <BoothPreviewStage
        className="w-full"
        frameClassName="rounded-lg border border-white/15"
        // The configured booth background (color or image) paints the stage, so
        // screens without their own background show it instead of bare black.
        frameStyle={appearanceBackgroundStyle(appearance)}
      >
        {current.render()}
      </BoothPreviewStage>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={slide.label}
              title={slide.label}
              className={`h-2 rounded-full transition-all ${
                i === safeIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="font-semibold">
            {current.label} · {safeIndex + 1}/{slides.length}
          </span>
          <button
            type="button"
            onClick={() => go(safeIndex - 1)}
            className="rounded-md bg-white/10 px-2 py-1 text-white/80 hover:bg-white/20"
            aria-label="Previous screen"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(safeIndex + 1)}
            className="rounded-md bg-white/10 px-2 py-1 text-white/80 hover:bg-white/20"
            aria-label="Next screen"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoothAppearancePreview;
