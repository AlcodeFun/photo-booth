import React from 'react';
import type { BoothCopywriting, BoothTheme } from '@photo-booth/types';
import { withAlpha } from '../../lib/appearance';
import { VOUCHER_ALPHABET, VOUCHER_LENGTH } from '../../lib/vouchers';

export type UnlockMode = 'scan' | 'type';
export type UnlockStatus = 'idle' | 'checking' | 'success' | 'error';

export interface UnlockViewProps {
  copy: BoothCopywriting;
  theme: BoothTheme;
  mode: UnlockMode;
  status: UnlockStatus;
  /** Error / hint line under the title (wrong code, no camera, offline …). */
  message?: string | null;
  /** Characters typed so far (type mode). */
  code: string;
  /** The live webcam, or a placeholder in the admin preview. */
  cameraFeed?: React.ReactNode;
  /** False when no scan camera could be opened: scan mode is not offered. */
  cameraAvailable?: boolean;
  onModeChange?: (mode: UnlockMode) => void;
  onKey?: (char: string) => void;
  onBackspace?: () => void;
  onSubmit?: () => void;
  onBack?: () => void;
}

const CHECK_LEN = 60;

/**
 * Presentational core of the voucher unlock screen: a viewfinder for the
 * webcam QR scan and, as a fallback, an on-screen keypad for typing the code.
 * Shared with the admin appearance preview; the screen owns the camera, the
 * decoder and the redemption. Sized in container units so the preview stage
 * scales it like the real booth.
 */
export const UnlockView: React.FC<UnlockViewProps> = ({
  copy,
  theme,
  mode,
  status,
  message,
  code,
  cameraFeed,
  cameraAvailable = true,
  onModeChange,
  onKey,
  onBackspace,
  onSubmit,
  onBack,
}) => {
  const busy = status === 'checking' || status === 'success';
  const showScan = mode === 'scan' && cameraAvailable;
  const slots = Array.from({ length: VOUCHER_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <div
      className="pb-screen pb-flow-anim relative h-full w-full select-none overflow-hidden"
      style={{ color: theme.foreground }}
    >
      {/* Journal dot grid behind everything */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${withAlpha(theme.foreground, 0.08)} 1.5px, transparent 1.8px)`,
          backgroundSize: '22px 22px',
        }}
      />

      <div className="pb-unlock-grid relative h-full w-full gap-[4cqmin] overflow-y-auto px-[5cqw] py-[5cqh]">
        {/* ---- Left: viewfinder or code boxes ---- */}
        <div
          className="flex items-center justify-center"
          style={{ animation: 'pb-rise-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.1s both' }}
        >
          {showScan ? (
            <div
              className="relative aspect-square w-full max-w-[min(70cqh,100%)] overflow-hidden rounded-[3cqmin] border-[0.7cqmin]"
              style={{
                borderColor: theme.deep,
                backgroundColor: theme.deep,
                boxShadow: `0 1.4cqmin 0 ${theme.deep}, 0 4cqmin 8cqmin ${withAlpha(theme.deep, 0.35)}`,
              }}
            >
              <div className="absolute inset-0">{cameraFeed}</div>
              {/* Dim the edges so the target square reads as the place to aim */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ boxShadow: `inset 0 0 0 9cqmin ${withAlpha(theme.deep, 0.45)}` }}
              />
              {/* Corner brackets */}
              {(['left-[7%] top-[7%] border-l border-t', 'right-[7%] top-[7%] border-r border-t', 'left-[7%] bottom-[7%] border-l border-b', 'right-[7%] bottom-[7%] border-r border-b'] as const).map(
                (pos, i) => (
                  <span
                    key={i}
                    className={`pointer-events-none absolute h-[18%] w-[18%] rounded-[1.4cqmin] ${pos}`}
                    style={{
                      borderColor: status === 'error' ? '#e05252' : theme.tertiary,
                      borderWidth: '1cqmin',
                      borderRightWidth: pos.includes('border-r') ? '1cqmin' : 0,
                      borderLeftWidth: pos.includes('border-l') ? '1cqmin' : 0,
                      borderTopWidth: pos.includes('border-t') ? '1cqmin' : 0,
                      borderBottomWidth: pos.includes('border-b') ? '1cqmin' : 0,
                      animation: 'pb-slot-glow 1.6s ease-in-out infinite',
                    }}
                  />
                ),
              )}
              {/* Sweeping scan line while idle */}
              {status === 'idle' && (
                <span
                  className="pointer-events-none absolute inset-x-[10%] h-[0.7cqmin] rounded-full"
                  style={{
                    background: theme.tertiary,
                    boxShadow: `0 0 3cqmin 0.8cqmin ${withAlpha(theme.tertiary, 0.7)}`,
                    animation: 'pb-scan-sweep 2.2s ease-in-out infinite',
                  }}
                />
              )}
              <StatusOverlay theme={theme} status={status} label={status === 'checking' ? copy.unlockChecking : copy.unlockSuccess} />
            </div>
          ) : (
            <div
              className="relative w-full max-w-[90cqmin] rounded-[3cqmin] border-[0.6cqmin] p-[3cqmin]"
              style={{
                borderColor: theme.deep,
                backgroundColor: theme.card,
                color: theme.cardForeground,
                boxShadow: `0 1.2cqmin 0 ${theme.deep}`,
                animation: status === 'error' ? 'pb-shake 0.45s ease-in-out both' : undefined,
              }}
            >
              {/* Voucher stub perforation */}
              <span
                className="pointer-events-none absolute inset-y-[3cqmin] left-[-0.6cqmin] w-[1.6cqmin]"
                style={{
                  backgroundImage: `radial-gradient(circle at 0 50%, ${theme.background} 0.7cqmin, transparent 0.75cqmin)`,
                  backgroundSize: '1.6cqmin 2.6cqmin',
                }}
              />
              <div className="flex items-center justify-center gap-[1cqmin]">
                {slots.map((char, i) => (
                  <React.Fragment key={i}>
                    {i === VOUCHER_LENGTH / 2 && (
                      <span className="text-[4cqmin] font-black opacity-40" aria-hidden="true">
                        –
                      </span>
                    )}
                    <span
                      className="grid aspect-[3/4] w-[8.5cqmin] max-w-[11%] place-items-center rounded-[1.2cqmin] border-[0.5cqmin] text-[4.6cqmin] font-black"
                      style={{
                        borderColor: i === code.length && !busy ? theme.action : withAlpha(theme.cardForeground, 0.25),
                        backgroundColor: char ? withAlpha(theme.tertiary, 0.35) : 'transparent',
                        animation: char ? 'pb-bounce-in 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.4) both' : undefined,
                      }}
                    >
                      {char}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <StatusOverlay theme={theme} status={status} label={status === 'checking' ? copy.unlockChecking : copy.unlockSuccess} rounded />
            </div>
          )}
        </div>

        {/* ---- Right: copy, actions, keypad ---- */}
        <div className="flex min-w-0 flex-col items-center gap-[2.4cqmin] text-center">
          <p
            className="inline-block -rotate-2 rounded-full px-[2.4cqmin] py-[0.6cqmin] text-[1.9cqmin] font-black uppercase tracking-[0.24em]"
            style={{
              backgroundColor: theme.secondary,
              color: theme.secondaryForeground,
              animation: 'pb-rise-pop 0.5s ease-out 0.2s both',
            }}
          >
            <svg viewBox="0 0 24 24" className="mr-[0.8cqmin] inline-block h-[2.2cqmin] w-[2.2cqmin] -translate-y-[0.15cqmin]" fill="none" aria-hidden="true">
              <path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4V8z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M15 7v2M15 11v2M15 15v2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            {copy.unlockEyebrow}
          </p>
          <h1
            className="text-[6cqmin] font-black uppercase leading-[1.02] tracking-[-0.04em]"
            style={{ animation: 'pb-rise-pop 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.28s both' }}
          >
            {copy.unlockTitle}
          </h1>

          <p
            key={message ?? mode}
            className="min-h-[3.2cqmin] max-w-[60cqmin] text-[2.4cqmin] font-bold leading-snug"
            style={
              message
                ? { color: '#e05252', animation: 'pb-shake 0.45s ease-in-out both' }
                : { opacity: 0.8, animation: 'pb-rise-pop 0.5s ease-out 0.36s both' }
            }
            role={message ? 'alert' : undefined}
          >
            {message || (showScan ? copy.unlockBody : '')}
          </p>

          {!showScan && (
            <Keypad theme={theme} disabled={busy} onKey={onKey} onBackspace={onBackspace} />
          )}

          <div className="flex w-full max-w-[64cqmin] flex-wrap justify-center gap-[1.6cqmin]" style={{ animation: 'pb-rise-pop 0.5s ease-out 0.45s both' }}>
            <button
              type="button"
              onClick={onBack}
              disabled={busy || !onBack}
              className="rounded-[1.6cqmin] border-[0.4cqmin] px-[3cqmin] py-[1.6cqmin] text-[2cqmin] font-black uppercase tracking-[0.12em] transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
              style={{ borderColor: theme.deep, backgroundColor: theme.card, color: theme.cardForeground }}
            >
              ← {copy.unlockBackButton}
            </button>
            {cameraAvailable && (
              <button
                type="button"
                onClick={() => onModeChange?.(showScan ? 'type' : 'scan')}
                disabled={busy}
                className="rounded-[1.6cqmin] border-[0.4cqmin] px-[3cqmin] py-[1.6cqmin] text-[2cqmin] font-black uppercase tracking-[0.12em] transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
                style={{ borderColor: theme.deep, backgroundColor: theme.secondary, color: theme.secondaryForeground }}
              >
                {showScan ? `⌨ ${copy.unlockTypeButton}` : `▣ ${copy.unlockScanButton}`}
              </button>
            )}
            {!showScan && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || code.length < VOUCHER_LENGTH}
                className="grow rounded-[1.6cqmin] border-[0.4cqmin] px-[3cqmin] py-[1.6cqmin] text-[2.2cqmin] font-black uppercase tracking-[0.12em] transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
                style={
                  {
                    borderColor: theme.deep,
                    backgroundColor: theme.action,
                    color: theme.actionForeground,
                    '--glow': withAlpha(theme.action, 0.55),
                    animation: code.length === VOUCHER_LENGTH && !busy ? 'pb-cta-breathe 2.2s ease-in-out infinite' : undefined,
                  } as React.CSSProperties
                }
              >
                {copy.unlockSubmitButton} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusOverlay: React.FC<{ theme: BoothTheme; status: UnlockStatus; label: string; rounded?: boolean }> = ({
  theme,
  status,
  label,
  rounded,
}) => {
  if (status !== 'checking' && status !== 'success') return null;
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-[2cqmin] ${rounded ? 'rounded-[2.4cqmin]' : ''}`}
      style={{ backgroundColor: withAlpha(theme.deep, 0.78), color: '#ffffff', animation: 'pb-modal-fade 0.2s ease-out both' }}
    >
      {status === 'checking' ? (
        <span
          className="h-[9cqmin] w-[9cqmin] rounded-full border-[1cqmin]"
          style={{ borderColor: withAlpha('#ffffff', 0.25), borderTopColor: theme.tertiary, animation: 'pb-spin 0.8s linear infinite' }}
        />
      ) : (
        <svg viewBox="0 0 64 64" className="h-[13cqmin] w-[13cqmin]" style={{ animation: 'pb-bounce-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) both' }} aria-hidden="true">
          <circle cx="32" cy="32" r="29" fill={theme.action} stroke="#ffffff" strokeWidth="3" />
          <path
            d="M19 33 l9 9 l17 -19"
            fill="none"
            stroke={theme.actionForeground}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: CHECK_LEN, '--len': CHECK_LEN, animation: 'pb-draw 0.4s ease-out 0.15s both' } as React.CSSProperties}
          />
        </svg>
      )}
      <span className="px-[3cqmin] text-center text-[2.6cqmin] font-black uppercase tracking-[0.12em]">{label}</span>
    </div>
  );
};

const KEY_ROWS = [VOUCHER_ALPHABET.slice(0, 8), VOUCHER_ALPHABET.slice(8, 16), VOUCHER_ALPHABET.slice(16, 23), VOUCHER_ALPHABET.slice(23)];

const Keypad: React.FC<{
  theme: BoothTheme;
  disabled: boolean;
  onKey?: (char: string) => void;
  onBackspace?: () => void;
}> = ({ theme, disabled, onKey, onBackspace }) => (
  <div className="flex w-full max-w-[68cqmin] flex-col gap-[0.9cqmin]" style={{ animation: 'pb-rise-pop 0.5s ease-out 0.4s both' }}>
    {KEY_ROWS.map((row, r) => (
      <div key={r} className="flex justify-center gap-[0.9cqmin]">
        {row.split('').map((char) => (
          <button
            key={char}
            type="button"
            disabled={disabled}
            onClick={() => onKey?.(char)}
            className="aspect-square w-[7cqmin] max-w-[12%] rounded-[1.2cqmin] border-[0.35cqmin] text-[2.8cqmin] font-black transition-transform active:translate-y-[0.3cqmin] disabled:opacity-50"
            style={{ borderColor: theme.deep, backgroundColor: theme.card, color: theme.cardForeground, boxShadow: `0 0.5cqmin 0 ${theme.deep}` }}
          >
            {char}
          </button>
        ))}
        {r === KEY_ROWS.length - 1 && (
          <button
            type="button"
            disabled={disabled}
            onClick={onBackspace}
            aria-label="Hapus"
            className="w-[15cqmin] max-w-[26%] rounded-[1.2cqmin] border-[0.35cqmin] text-[2.8cqmin] font-black transition-transform active:translate-y-[0.3cqmin] disabled:opacity-50"
            style={{ borderColor: theme.deep, backgroundColor: theme.secondary, color: theme.secondaryForeground, boxShadow: `0 0.5cqmin 0 ${theme.deep}` }}
          >
            ⌫
          </button>
        )}
      </div>
    ))}
  </div>
);

export default UnlockView;
