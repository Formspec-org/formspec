/** @filedesc Shared property input controls for layout/component property panels: text, select, number, checkbox. */
import { useState, useEffect } from 'react';
import { PropertyRow } from './PropertyRow';

const INPUT_CLASS = 'w-full rounded-[4px] border border-border bg-surface px-2 py-1 text-[12px] font-mono text-ink outline-none transition-colors placeholder:text-muted focus:border-accent';
const SELECT_CLASS = 'w-full rounded-[4px] border border-border bg-surface px-2 py-1 text-[12px] font-mono text-ink outline-none transition-colors focus:border-accent';

export function TextPropertyInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <PropertyRow label={label}>
      <input
        aria-label={label}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        className={INPUT_CLASS}
      />
    </PropertyRow>
  );
}

export function NumberPropertyInput({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number | '';
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value === '' ? '' : String(value));
  useEffect(() => { setDraft(value === '' ? '' : String(value)); }, [value]);

  return (
    <PropertyRow label={label}>
      <input
        aria-label={label}
        type="number"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (!Number.isNaN(n) && draft !== '') onCommit(n);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        className={INPUT_CLASS}
      />
    </PropertyRow>
  );
}

export function SelectPropertyInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <PropertyRow label={label}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </PropertyRow>
  );
}

export function CheckboxPropertyInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <PropertyRow label={label}>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border border-border accent-accent"
      />
    </PropertyRow>
  );
}
