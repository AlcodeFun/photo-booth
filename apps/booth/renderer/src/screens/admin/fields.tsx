import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';

const toNumericValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeNumberInput = (raw: string, allowDecimal: boolean) => {
  const cleaned = raw.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!allowDecimal) {
    return cleaned;
  }
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
};

const FIELD_CLASS =
  'h-10 w-full rounded-[10px] border-[3px] border-[#c9b8ff] bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#4d2d85] outline-none focus:border-[#a35ef6]';

interface FieldLabelProps {
  label: string;
  className?: string;
  children: ReactNode;
}

const FieldLabel = ({ label, className = 'flex flex-col gap-1', children }: FieldLabelProps) => (
  <label
    className={`${className} min-w-0 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#7a4de3]`}
  >
    {label}
    {children}
  </label>
);

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  onChange: (value: number) => void;
}

export const NumberField = ({ label, value, min, max, allowDecimal = false, onChange }: NumberFieldProps) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setText(value == null ? '' : String(value));
    }
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    editingRef.current = true;
    const sanitized = sanitizeNumberInput(event.target.value, allowDecimal);
    setText(sanitized);
    onChange(toNumericValue(sanitized));
  };

  const handleBlur = () => {
    editingRef.current = false;
    let next = toNumericValue(text);
    if (min != null) next = Math.max(next, min);
    if (max != null) next = Math.min(next, max);
    setText(next === 0 ? '' : String(next));
    onChange(next);
  };

  return (
    <FieldLabel label={label}>
      <input
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0"
        aria-invalid={min != null && text !== '' && toNumericValue(text) < min}
        className={FIELD_CLASS}
      />
    </FieldLabel>
  );
};

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
}

export const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  className,
  required = false,
  error,
}: TextFieldProps) => {
  const showError = Boolean(error) && value.trim() === '';
  const fieldClass = showError ? `${FIELD_CLASS} border-[#ff4bb5]` : FIELD_CLASS;

  return (
    <FieldLabel label={label} className={`flex flex-col gap-1 ${className ?? ''}`}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={showError}
        className={fieldClass}
      />
      {showError ? <span className="text-[0.65rem] font-bold normal-case text-[#b3206e]">{error}</span> : null}
    </FieldLabel>
  );
};

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
      className="h-10 w-full cursor-pointer rounded-[10px] border-[3px] border-[#c9b8ff] bg-white p-1"
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
      className="cursor-pointer rounded-[10px] border-[3px] border-dashed border-[#a35ef6] bg-white px-3 py-2.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#5b3aa8] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#d9f85a] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:tracking-[0.12em] file:text-[#4d2d85] hover:bg-[#fbf3ff]"
    />
  </FieldLabel>
);