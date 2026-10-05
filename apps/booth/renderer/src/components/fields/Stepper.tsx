import { ReactNode, useEffect, useId, useRef, useState } from 'react';

/**
 * Number + token inputs used across the booth set-up screens.
 *
 * Both are plain text inputs: `type="number"` spinners are unreliable across
 * platforms, cannot render values like `1/125` or `f/4`, and drag the native
 * number box into the text field. Instead the text is formatted while typing and
 * the increment / decrement controls are separate buttons next to the input (they
 * also work from the keyboard via ArrowUp / ArrowDown).
 */

export interface StepperOption {
  /** Raw value written to the hardware (e.g. `400`, `4`, `0.008`). */
  value: string;
  /** Human label the camera reports for the value (e.g. `ISO 400`). */
  label: string;
}

const STEP_BUTTON_CLASS =
  'flex h-10 w-8 shrink-0 items-center justify-center rounded-[8px] border-[3px] border-[#c9b8ff] bg-white text-lg font-black leading-none text-[#5b3aa8] transition hover:border-[#a35ef6] hover:bg-[#fbf3ff] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40';
const INPUT_CLASS =
  'h-10 min-w-0 flex-1 rounded-[8px] border-[3px] border-[#c9b8ff] bg-white px-3 text-sm font-black text-[#4d2d85] outline-none focus:border-[#a35ef6] disabled:bg-white/60 disabled:text-[#7d6ea6]';

/**
 * Formats a number while it is being typed: drops everything that is not a digit
 * (or a decimal point when decimals are allowed) and strips leading zeros so `007`
 * reads as `7`. Mid-typing values are never clamped — that happens on blur — so a
 * partially typed number cannot fight the operator.
 */
export const formatNumericText = (raw: string, decimals = 0): string => {
  const [head, ...rest] = raw.replace(/[^0-9.]/g, '').split('.');
  const whole = head.replace(/^0+(?=\d)/, '');
  if (rest.length === 0) {
    return whole;
  }
  const fraction = rest.join('');
  if (decimals <= 0) {
    return `${whole}${fraction}`;
  }
  return `${whole}.${fraction.slice(0, decimals)}`;
};

/**
 * Formats a hardware token while it is being typed: keeps digits plus the
 * `. / -` separators a camera uses (`1/125`, `f/4`, `1/60`, `-1/3`), collapses
 * repeated separators and strips leading zeros — so `ISO 400` becomes `400`.
 */
export const formatTokenText = (raw: string): string => {
  const cleaned = raw
    .replace(/[^0-9/.\-]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-');
  const negative = cleaned.startsWith('-');
  const body = (negative ? cleaned.slice(1) : cleaned).replace(/^[./]+/, '').replace(/^0+(?=\d)/, '');
  return negative ? `-${body}` : body;
};

interface StepperShellProps {
  label: string;
  text: string;
  hint?: ReactNode;
  adornment?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  inputMode: 'numeric' | 'decimal' | 'text';
  canDecrease: boolean;
  canIncrease: boolean;
  onChange: (text: string) => void;
  onCommit: () => void;
  onStep: (direction: 1 | -1) => void;
}

const StepperShell: React.FC<StepperShellProps> = ({
  label,
  text,
  hint,
  adornment,
  invalid = false,
  disabled = false,
  inputMode,
  canDecrease,
  canIncrease,
  onChange,
  onCommit,
  onStep,
}) => {
  const labelId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={labelId}
        className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#7a4de3]"
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onStep(-1)}
          disabled={disabled || !canDecrease}
          className={STEP_BUTTON_CLASS}
        >
          −
        </button>
        <input
          type="text"
          inputMode={inputMode}
          value={text}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onStep(1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              onStep(-1);
            } else if (event.key === 'Enter') {
              onCommit();
            }
          }}
          className={INPUT_CLASS}
        />
        {adornment}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onStep(1)}
          disabled={disabled || !canIncrease}
          className={STEP_BUTTON_CLASS}
        >
          +
        </button>
      </div>
      {hint ? (
        <span className="text-[0.6rem] font-semibold normal-case tracking-normal text-[#7d6ea6]">
          {hint}
        </span>
      ) : null}
    </div>
  );
};

export interface NumberStepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Allowed decimal places while typing (integer by default). */
  decimals?: number;
  /** Unit rendered between the input and the + button (e.g. `seconds`). */
  suffix?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** Bounded number input with separate −/+ buttons stepping by `step`. */
export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  decimals = 0,
  suffix,
  hint,
  disabled = false,
  onChange,
}) => {
  const [text, setText] = useState(() => formatNumericText(String(value), decimals));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setText(formatNumericText(String(value), decimals));
    }
  }, [value, decimals]);

  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const show = (next: number) => formatNumericText(String(next), decimals);

  const commit = () => {
    editingRef.current = false;
    const parsed = Number(formatNumericText(text, decimals));
    const next = Number.isFinite(parsed) && formatNumericText(text, decimals) !== '' ? clamp(parsed) : clamp(value);
    setText(show(next));
    if (next !== value) {
      onChange(next);
    }
  };

  const stepBy = (direction: 1 | -1) => {
    editingRef.current = false;
    const next = clamp(Number((value + direction * step).toFixed(decimals)));
    setText(show(next));
    if (next !== value) {
      onChange(next);
    }
  };

  const parsed = Number(text);
  const invalid = text !== '' && (parsed < min || parsed > max);

  return (
    <StepperShell
      label={label}
      text={text}
      hint={hint}
      adornment={suffix ? <span className="shrink-0 text-xs font-bold text-[#7a4de3]">{suffix}</span> : undefined}
      invalid={invalid}
      disabled={disabled}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      canDecrease={!disabled && value > min}
      canIncrease={!disabled && value < max}
      onChange={(next) => {
        editingRef.current = true;
        const formatted = formatNumericText(next, decimals);
        setText(formatted);
        if (formatted === '') {
          return;
        }
        const value_ = Number(formatted);
        if (Number.isFinite(value_)) {
          onChange(value_);
        }
      }}
      onCommit={commit}
      onStep={stepBy}
    />
  );
};

export interface OptionStepperProps {
  label: string;
  /** Raw token of the selected value. */
  value: string;
  /** Options reported by the device; stepping wraps around the list. */
  options: StepperOption[];
  hint?: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Discrete setting input (ISO, aperture, shutter speed, …): the text field accepts
 * a token or the label the camera prints for it, and the −/+ buttons walk the
 * camera's own option list — so only values the hardware supports are selectable.
 */
export const OptionStepper: React.FC<OptionStepperProps> = ({
  label,
  value,
  options,
  hint,
  disabled = false,
  onChange,
}) => {
  const [text, setText] = useState(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setText(value);
    }
  }, [value]);

  const index = options.findIndex((option) => option.value === value);

  const commit = () => {
    editingRef.current = false;
    const typed = text.trim().toLowerCase();
    const match = options.find(
      (option) => option.value.toLowerCase() === typed || option.label.toLowerCase() === typed,
    );
    const next = match ? match.value : value;
    setText(next);
    if (next !== value) {
      onChange(next);
    }
  };

  const stepBy = (direction: 1 | -1) => {
    if (options.length === 0) {
      return;
    }
    const fallback = direction === 1 ? 0 : options.length - 1;
    const next = options[index === -1 ? fallback : (index + direction + options.length) % options.length];
    editingRef.current = false;
    setText(next.value);
    if (next.value !== value) {
      onChange(next.value);
    }
  };

  const active = index === -1 ? undefined : options[index];

  return (
    <StepperShell
      label={label}
      text={text}
      hint={hint ?? (active ? `${active.label} · ${options.length} options` : undefined)}
      disabled={disabled || options.length === 0}
      inputMode="numeric"
      canDecrease={options.length > 0}
      canIncrease={options.length > 0}
      onChange={(next) => {
        editingRef.current = true;
        setText(formatTokenText(next));
      }}
      onCommit={commit}
      onStep={stepBy}
    />
  );
};