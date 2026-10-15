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
import QrResultView from '../booth/QrResultView';
import ArrangeView from '../booth/ArrangeView';
import EffectsView from '../booth/EffectsView';
import CompleteView from '../booth/CompleteView';
import UnlockView from '../booth/UnlockView';

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

    // Only shown to guests when Booth Setup -> Access requires a voucher.
    const unlock: Slide = {
      key: 'unlock',
      label: 'Voucher unlock',
      render: () => (
        <UnlockView
          copy={copy}
          theme={theme}
          mode="scan"
          status="idle"
          code=""
          cameraFeed={
            <div
              className="h-full w-full"
              style={{ background: `linear-gradient(140deg, ${theme.deep}, ${withAlpha(theme.deep, 0.7)})` }}
            />
          }
        />
      ),
    };

    const tutorial: Slide = {
      key: 'tutorial',
      label: 'How it works',
      render: () => <TutorialView copy={copy} theme={theme} flowMode={flowMode} />,
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

    const samplePhotos = [1, 2, 3].map((n) => `${import.meta.env.BASE_URL}photos/${n}.jpg`);

    const arrange: Slide = {
      key: 'arrange',
      label: 'Arrange photos',
      render: () => (
        <ArrangeView
          copy={copy}
          theme={theme}
          frame={frame}
          photoUrls={samplePhotos}
          photoSlotCount={photoSlots.length}
          surfaceStyle={appearanceSurfaceStyle(appearance, theme.background)}
        />
      ),
    };

    const effects: Slide = {
      key: 'effects',
      label: 'Effects & GIF',
      render: () => (
        <EffectsView
          copy={copy}
          theme={theme}
          frame={frame}
          photoUrls={samplePhotos}
          photoSlotCount={photoSlots.length}
          surfaceStyle={appearanceSurfaceStyle(appearance, theme.background)}
          gifFrames={[]}
          filterId="kelana"
          gifFrameId={null}
        />
      ),
    };

    const results: Slide = {
      key: 'results',
      label: isTimed ? 'Scan & arrange' : 'Scan QR',
      render: () => (
        <QrResultView
          copy={copy}
          theme={theme}
          isTimedFlow={isTimed}
          frame={frame}
          photoUrls={samplePhotos}
          photoSlotCount={photoSlots.length}
          filterStyle={getCanvasFilter('kelana')}
          qrDataUrl={null}
          printState={isTimed ? 'off' : 'queued'}
          uploadState="done"
          isDone
          canFinish
          surfaceStyle={appearanceSurfaceStyle(appearance, theme.background)}
        />
      ),
    };

    const complete: Slide = {
      key: 'complete',
      label: 'Done',
      render: () => <CompleteView copy={copy} theme={theme} />,
    };

    // The timed session skips frame selection, the capture/review carousel
    // and the effects step at the booth: it shoots freely inside a time budget,
    // then shows the QR (frame + filter are picked on the organize page).
    if (isTimed) {
      return [bumper, unlock, tutorial, results, complete];
    }
    return [bumper, unlock, tutorial, frameSelect, ...captureReviewPair, arrange, effects, results, complete];
  }, [appearance, copy, theme, flowMode]);

  // Booth display (16:9) or a guest's phone. On a small admin screen the
  // phone view is the readable default.
  const [device, setDevice] = useState<'booth' | 'phone'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'phone' : 'booth',
  );
  const [enlarged, setEnlarged] = useState(false);
  const base = device === 'phone' ? { w: 390, h: 844 } : { w: 1280, h: 720 };

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
      <div className="pb-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FLOW_ORDER.map((flow) => (
          <button
            key={flow}
            type="button"
            onClick={() => {
              setIndex(0);
              onFlowChange?.(flow);
            }}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
              flow === flowMode
                ? 'bg-white text-slate-900'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {CAPTURE_FLOW_LABELS[flow]}
          </button>
        ))}
      </div>

      {/* Device + enlarge */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Preview device">
          {(['booth', 'phone'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              aria-pressed={device === d}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                device === d ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
              }`}
            >
              {d === 'booth' ? '🖥 Booth' : '📱 Phone'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20"
        >
          ⤢ Enlarge
        </button>
      </div>

      <BoothPreviewStage
        key={device}
        className="w-full"
        frameClassName={`rounded-lg border border-white/15 ${device === 'phone' ? 'rounded-[22px]' : ''}`}
        // The configured booth background (color or image) paints the stage, so
        // screens without their own background show it instead of bare black.
        frameStyle={appearanceBackgroundStyle(appearance)}
        baseWidth={base.w}
        baseHeight={base.h}
        maxHeightVh={device === 'phone' ? 70 : 72}
      >
        {current.render()}
      </BoothPreviewStage>

      {enlarged && (
        <div
          className="fixed inset-0 z-[300] flex flex-col gap-3 bg-pbx-ui-bg p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setEnlarged(false)}
        >
          <div className="flex items-center justify-between gap-2 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate font-semibold">
              {current.label} · {safeIndex + 1}/{slides.length}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => go(safeIndex - 1)} className="rounded-md bg-white/15 px-3 py-1.5" aria-label="Previous screen">‹</button>
              <button type="button" onClick={() => go(safeIndex + 1)} className="rounded-md bg-white/15 px-3 py-1.5" aria-label="Next screen">›</button>
              <button type="button" onClick={() => setEnlarged(false)} className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900">Close</button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center" onClick={(e) => e.stopPropagation()}>
            <BoothPreviewStage
              key={`big-${device}`}
              className="w-full"
              frameClassName="rounded-lg"
              frameStyle={appearanceBackgroundStyle(appearance)}
              baseWidth={base.w}
              baseHeight={base.h}
              maxHeightVh={84}
            >
              {current.render()}
            </BoothPreviewStage>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="hidden items-center gap-1.5 lg:flex">
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-xs text-white/60 lg:flex-none">
          <select
            value={safeIndex}
            onChange={(e) => setIndex(Number(e.target.value))}
            aria-label="Preview screen"
            className="min-w-0 flex-1 truncate rounded-md border border-white/15 bg-pbx-ui-panel px-2 py-1.5 text-xs font-semibold text-white focus:outline-none lg:flex-none"
          >
            {slides.map((slide, i) => (
              <option key={slide.key} value={i}>
                {i + 1}. {slide.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => go(safeIndex - 1)}
            className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/20"
            aria-label="Previous screen"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(safeIndex + 1)}
            className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/20"
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
