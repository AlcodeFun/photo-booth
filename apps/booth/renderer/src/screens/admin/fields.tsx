import { ChangeEvent, ReactNode } from 'react';

const toNumericValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const FIELD_CLASS =
  'h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-sky-400';

interface FieldLabelProps {
  label: string;
  className?: string;
  children: ReactNode;
}

const FieldLabel = ({ label, className = 'flex flex-col gap-1', children }: FieldLabelProps) => (
  <label className={`${className} text-xs font-semibold uppercase tracking-wider text-zinc-500`}>
    {label}
    {children}
  </label>
);

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export const NumberField = ({ label, value, min, max, step = 1, onChange }: NumberFieldProps) => (
  <FieldLabel label={label}>
    <input
      type="number"
      value={value ?? 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(toNumericValue(event.target.value))}
      className={FIELD_CLASS}
    />
  </FieldLabel>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const TextField = ({ label, value, onChange, placeholder, className }: TextFieldProps) => (
  <FieldLabel label={label} className={`flex flex-col gap-1 ${className ?? ''}`}>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={FIELD_CLASS}
    />
  </FieldLabel>
);

interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}

export const SelectField = ({ label, value, onChange, children }: SelectFieldProps) => (
  <FieldLabel label={label}>
    <select value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>
      {children}
    </select>
  </FieldLabel>
);

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const ColorField = ({ label, value, onChange }: ColorFieldProps) => (
  <FieldLabel label={label}>
    <input
      type="color"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-2"
    />
  </FieldLabel>
);

interface FileFieldProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const FileField = ({ label, accept, multiple, onChange }: FileFieldProps) => (
  <FieldLabel label={label} className="flex flex-col gap-2">
    <input
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={onChange}
      className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
    />
  </FieldLabel>
);