import React from 'react';
import type { BoothCopywriting, BoothTheme, FrameConfig } from '@photo-booth/types';
import FrameCanvas from '../FrameCanvas';
import { withAlpha } from '../../lib/appearance';

export type ResultsPrintState = 'off' | 'printing' | 'queued' | 'ready' | 'error';
export type ResultsUploadState = 'uploading' | 'done' | 'error';

export interface QrResultViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  /** Timed flow: the QR leads to the arrange page, there is no print yet. */
  isTimedFlow: boolean;
  frame: FrameConfig | null;
  photoUrls: Array<string | undefined>;
  photoSlotCount: number;
  filterStyle: string;
  qrDataUrl: string | null;
  printState: ResultsPrintState;
  uploadState: ResultsUploadState;
  isDone: boolean;
  canFinish: boolean;
  surfaceStyle?: React.CSSProperties;
  onFinish?: () => void;
  onOpenQr?: () => void;
}

const STATUS_COLORS = {
  busy: { bg: '#fff4d6', fg: '#8a5a00', dot: '#f0a020' },
  ok: { bg: '#e3f6e9', fg: '#1f7a3b', dot: '#2e9e4f' },
  err: { bg: '#fde4e4', fg: '#a12a2a', dot: '#d64545' },
} as const;

const StatusChip: React.FC<{ tone: keyof typeof STATUS_COLORS; label: string; pulse?: boolean }> = ({ tone, label, pulse }) => {
  const c = STATUS_COLORS[tone];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black sm:text-sm"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: c.dot, animation: pulse ? 'pb-slot-glow 1s ease-in-out infinite' : undefined }}
      />
      {label}
    </span>
  );
};

/**
 * The last booth screen: scan to download. Outputs were already previewed on
 * the effects screen, so this stays focused on the QR, the print / cloud
 * status and a small copy of the final print.
 */
export const QrResultView: React.FC<QrResultViewProps> = ({
  copy,
  theme,
  isTimedFlow,
  frame,
  photoUrls,
  photoSlotCount,
  filterStyle,
  qrDataUrl,
  printState,
  uploadState,
  isDone,
  canFinish,
  surfaceStyle,
  onFinish,
  onOpenQr,
}) => {
  const print =
    printState === 'off'
      ? null
      : printState === 'ready'
        ? { tone: 'ok' as const, label: copy.resultsPrintReady }
        : printState === 'error'
          ? { tone: 'err' as const, label: copy.resultsPrintError }
          : printState === 'queued'
            ? { tone: 'ok' as const, label: copy.resultsPrintQueued }
            : { tone: 'busy' as const, label: copy.resultsPrinting, pulse: true };
  const upload =
    uploadState === 'done'
      ? { tone: 'ok' as const, label: copy.resultsUploaded }
      : uploadState === 'error'
        ? { tone: 'err' as const, label: copy.resultsUploadError }
        : { tone: 'busy' as const, label: copy.resultsUploading, pulse: true };

  return (
    <div
      className="pb-flow-anim relative flex h-full w-full items-center justify-center overflow-y-auto"
      style={{ ...surfaceStyle, color: theme.foreground }}
    >
      <div className="flex w-full max-w-5xl flex-col items-center gap-6 px-5 py-6 md:flex-row md:items-center md:justify-center md:gap-14">
        {/* Small copy of the final print */}
        {!isTimedFlow && frame && (
          <div
            className="w-[min(46vw,15rem)] shrink-0 bg-white p-2 md:w-[min(30vw,19rem)]"
            style={
              {
                '--pr': '-4deg',
                boxShadow: `0 14px 34px ${withAlpha(theme.deep, 0.35)}`,
                animation: 'pb-print-drop 0.8s cubic-bezier(0.2, 0.9, 0.3, 1.15) 0.1s both',
              } as React.CSSProperties
            }
          >
            <FrameCanvas frame={frame} photos={photoUrls} photoSlotCount={photoSlotCount} filter={filterStyle} className="!border-0 w-full !shadow-none" />
          </div>
        )}

        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <div style={{ animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.2s both' }}>
            <h1 className="text-2xl font-black uppercase leading-none tracking-[-0.03em] sm:text-4xl">{copy.resultsTitle}</h1>
            <p className="mt-2 text-sm font-semibold opacity-80 sm:text-base">
              {isTimedFlow ? copy.resultsQrArrange : copy.resultsSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenQr}
            disabled={!qrDataUrl}
            className="relative rounded-[22px] border-[4px] bg-white p-3 transition-transform enabled:hover:-translate-y-0.5"
            style={{
              borderColor: theme.deep,
              boxShadow: `0 8px 0 ${theme.deep}`,
              animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.35s both',
            }}
            aria-label={copy.resultsQrModalTitle}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR" className="h-52 w-52 sm:h-60 sm:w-60" />
            ) : (
              <span className="grid h-52 w-52 place-items-center text-sm font-bold opacity-60 sm:h-60 sm:w-60" style={{ color: theme.deep }}>
                {copy.resultsGeneratingQr}
              </span>
            )}
            <span
              className="absolute -right-5 -top-5 grid h-16 w-16 place-items-center rounded-full border-[3px] text-center text-[0.65rem] font-black uppercase leading-tight"
              style={{
                borderColor: theme.deep,
                backgroundColor: theme.tertiary,
                color: theme.tertiaryForeground,
                animation: 'pb-icon-wiggle 3s ease-in-out 1.2s infinite',
              }}
            >
              {copy.resultsScanMe}
            </span>
          </button>

          <div className="flex flex-wrap justify-center gap-2" style={{ animation: 'pb-rise-pop 0.5s ease-out 0.5s both' }}>
            {print && <StatusChip tone={print.tone} label={print.label} pulse={'pulse' in print} />}
            <StatusChip tone={upload.tone} label={upload.label} pulse={upload.tone === 'busy'} />
          </div>

          <button
            type="button"
            onClick={onFinish}
            disabled={!canFinish || !onFinish}
            className="mt-1 min-h-12 w-full rounded-xl border-2 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:opacity-50"
            style={
              {
                borderColor: theme.deep,
                backgroundColor: theme.action,
                color: theme.actionForeground,
                '--glow': withAlpha(theme.action, 0.55),
                animation: isDone ? 'pb-cta-breathe 2.4s ease-in-out infinite' : undefined,
              } as React.CSSProperties
            }
          >
            {isDone ? copy.resultsFinishDone : copy.resultsFinishButton}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrResultView;
