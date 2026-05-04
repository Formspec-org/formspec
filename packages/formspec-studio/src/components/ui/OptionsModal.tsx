/** @filedesc V2 modal for editing choice-field options — row-ledger layout with inline columns. */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconPlus, IconClose } from '../icons';
import {
  formatCommaSeparatedKeywords,
  parseCommaSeparatedKeywords,
} from '@formspec-org/studio-core';

type ChoiceOptionRow = { value: string; label: string; keywords?: string[] };
/** DI-4: Row with a stable identity for React keying. */
type RowWithId = ChoiceOptionRow & { _rowId: number };

interface OptionsModalProps {
  open: boolean;
  itemLabel: string;
  itemPath: string;
  options: ChoiceOptionRow[];
  onUpdateOptions: (options: ChoiceOptionRow[]) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** The index gutter — a plain ordinal that anchors the row without competing. */
function RowGutter({ index }: { index: number }) {
  return (
    <div
      className="w-7 shrink-0 flex items-start justify-end pt-[11px] pr-2"
      aria-hidden="true"
    >
      <span
        className="text-[11px] font-mono tabular-nums text-muted select-none"
        style={{ letterSpacing: '0.02em' }}
      >
        {String(index + 1).padStart(2, '\u2007')}
      </span>
    </div>
  );
}

/** Inline field column — label floats above, input fills width. */
function FieldCol({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-[3px] ${className}`}>
      <span
        className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted select-none pl-[1px]"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** The text input shared by value and label columns. */
function RowInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className={[
        'w-full px-2.5 py-[7px] text-sm rounded-md',
        'bg-transparent border border-transparent',
        'text-ink placeholder:text-ink/25',
        'transition-colors duration-100',
        'hover:border-border/60 hover:bg-subtle/60',
        'focus:border-accent/50 focus:bg-surface focus:outline-none',
        'focus-ring',
        mono ? 'font-mono' : 'font-ui',
      ].join(' ')}
    />
  );
}

/** Keywords row — a collapsible mini-row beneath the main fields. */
function KeywordsRow({
  index,
  option,
  onUpdate,
}: {
  index: number;
  option: ChoiceOptionRow;
  onUpdate: (patch: Partial<ChoiceOptionRow>) => void;
}) {
  const [open, setOpen] = useState(Boolean(option.keywords?.length));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = () => {
    if (!open) {
      setOpen(true);
      // Focus the input after the state update paints
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setOpen(false);
    }
  };

  const hasKeywords = Boolean(option.keywords?.length);

  return (
    <div className="pl-7">
      {/* Toggle trigger */}
      {!open && (
        <button
          type="button"
          onClick={handleToggle}
          className={[
            'group flex items-center gap-1.5 mt-1 mb-2',
            'text-[11px] rounded px-1 py-0.5 -ml-1',
            'transition-colors duration-100',
            hasKeywords
              ? 'text-muted hover:text-ink/70'
              : 'text-muted hover:text-muted',
          ].join(' ')}
          tabIndex={-1}
        >
          {hasKeywords ? (
            <>
              <IconPlus size={10} className="fill-current" />
              <span className="font-mono">{option.keywords!.join(', ')}</span>
            </>
          ) : (
            <>
              <IconPlus size={9} />
              <span>add keywords</span>
            </>
          )}
        </button>
      )}

      {/* Expanded keywords input */}
      {open && (
        <div className="mt-1 mb-2 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            aria-label={`Option ${index + 1} search keywords`}
            placeholder="Comma-separated keywords (for search)"
            className={[
              'flex-1 px-2.5 py-[6px] text-xs rounded-md font-mono',
              'bg-transparent border border-border/50',
              'text-ink/70 placeholder:text-ink/25',
              'focus:border-accent/50 focus:bg-surface focus:outline-none',
              'focus-ring',
              'transition-colors duration-100',
            ].join(' ')}
            value={formatCommaSeparatedKeywords(option.keywords)}
            onChange={(e) => {
              const kws = parseCommaSeparatedKeywords(e.currentTarget.value);
              const patch: Partial<ChoiceOptionRow> = {};
              if (kws) {
                patch.keywords = kws;
              } else {
                // preserve the key deletion — spread won't remove it
                const next: ChoiceOptionRow = {
                  value: option.value,
                  label: option.label,
                };
                onUpdate(next);
                return;
              }
              onUpdate(patch);
            }}
          />
          <button
            type="button"
            onClick={handleToggle}
            className="text-[11px] text-muted hover:text-muted transition-colors shrink-0 rounded px-1"
            tabIndex={-1}
          >
            done
          </button>
        </div>
      )}
    </div>
  );
}

/** A single option row in the ledger. */
function OptionRow({
  index,
  option,
  itemLabel,
  onUpdate,
  onRemove,
  isOnly,
}: {
  index: number;
  option: ChoiceOptionRow;
  itemLabel: string;
  onUpdate: (patch: Partial<ChoiceOptionRow>) => void;
  onRemove: () => void;
  isOnly: boolean;
}) {
  return (
    <div className="group">
      {/* Main row */}
      <div className="flex items-start gap-0">
        <RowGutter index={index} />

        {/* Value column */}
        <FieldCol label="value" className="flex-1 min-w-0">
          <RowInput
            value={option.value}
            onChange={(v) => onUpdate({ value: v })}
            placeholder="stored_value"
            ariaLabel={`Option ${index + 1} value`}
            mono
          />
        </FieldCol>

        {/* Column separator */}
        <div className="w-px self-stretch bg-border/30 mx-1 mt-[22px]" aria-hidden="true" />

        {/* Label column */}
        <FieldCol label="label" className="flex-1 min-w-0">
          <RowInput
            value={option.label}
            onChange={(v) => onUpdate({ label: v })}
            placeholder="Display label"
            ariaLabel={`Option ${index + 1} label`}
          />
        </FieldCol>

        {/* Remove button — always present but very quiet, only vivid on hover */}
        <div className="shrink-0 flex items-start pt-[22px] pl-1">
          <button
            type="button"
            aria-label={`Remove option ${index + 1} from ${itemLabel}`}
            disabled={isOnly}
            title={isOnly ? 'Cannot remove the only option' : undefined}
            onClick={onRemove}
            className={[
              'p-1 rounded transition-all duration-100',
              'text-muted group-hover:text-muted',
              'hover:!text-error hover:bg-error/8',
              'focus-ring',
              // DI-6: Show disabled state visually instead of hiding completely.
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:!text-muted disabled:hover:bg-transparent',
            ].join(' ')}
          >
            <IconClose size={13} />
          </button>
        </div>
      </div>

      {/* Keywords sub-row */}
      <KeywordsRow
        index={index}
        option={option}
        onUpdate={onUpdate}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function OptionsModal({
  open,
  itemLabel,
  itemPath,
  options,
  onUpdateOptions,
  onClose,
}: OptionsModalProps) {
  // DI-4: Stable row identities — counter persists across renders.
  const nextIdRef = useRef(0);
  const [rows, setRows] = useState<RowWithId[]>(() =>
    options.map(opt => ({ ...opt, _rowId: nextIdRef.current++ })),
  );

  // Sync external option changes into rows (e.g. undo/redo or parent update).
  useEffect(() => {
    const kwMatch = (a?: string[], b?: string[]) =>
      JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    setRows(prev => {
      if (prev.length === options.length && prev.every((r, i) => r.value === options[i].value && r.label === options[i].label && kwMatch(r.keywords, options[i].keywords))) {
        return prev;
      }
      return options.map((opt, i) => {
        const existing = prev[i];
        if (existing && existing.value === opt.value && existing.label === opt.label && kwMatch(existing.keywords, opt.keywords)) {
          return { ...opt, _rowId: existing._rowId };
        }
        return { ...opt, _rowId: nextIdRef.current++ };
      });
    });
  }, [options]);

  const emitUpdate = useCallback((nextRows: RowWithId[]) => {
    setRows(nextRows);
    onUpdateOptions(nextRows.map(({ _rowId: _, ...rest }) => rest));
  }, [onUpdateOptions]);

  // Trap focus and handle Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleUpdate = (index: number, patch: Partial<ChoiceOptionRow>) => {
    const target = rows[index];
    if (!target) return;
    // KeywordsRow may send a full ChoiceOptionRow to delete the key — detect
    if (patch && 'value' in patch && 'label' in patch && !('keywords' in patch)) {
      emitUpdate(rows.map((r, i) => (i === index ? { ...(patch as ChoiceOptionRow), _rowId: r._rowId } : r)));
    } else {
      emitUpdate(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    }
  };

  const handleRemove = (index: number) => {
    emitUpdate(rows.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    emitUpdate([...rows, { value: '', label: '', _rowId: nextIdRef.current++ }]);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 28%, transparent)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit options for ${itemLabel}`}
        className={[
          'w-full sm:max-w-xl',
          'flex flex-col',
          'rounded-t-2xl sm:rounded-xl',
          'bg-surface',
          'shadow-2xl',
          // Subtle top-edge highlight line — gives the sheet depth without a full border
          'ring-1 ring-inset ring-white/8',
          // Border only on non-mobile
          'sm:border sm:border-border/60',
        ].join(' ')}
        style={{ maxHeight: '86vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-baseline justify-between px-5 pt-5 pb-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-ink leading-tight">
              {itemLabel}
            </h2>
            <p className="mt-0.5 text-[11px] font-mono text-muted uppercase tracking-widest">
              {options.length} {options.length === 1 ? 'option' : 'options'}
            </p>
          </div>
          {/* Close × in header corner */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close options editor"
            className="p-1.5 -mr-1 rounded-lg text-muted hover:text-ink/70 hover:bg-subtle transition-colors focus-ring"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Column headers — align with the row gutter/columns below */}
        <div className="flex items-center gap-0 px-5 pb-2 shrink-0 border-b border-border/40">
          {/* gutter offset */}
          <div className="w-7 shrink-0" />
          <div className="flex-1 text-[10px] font-mono uppercase tracking-[0.08em] text-muted pl-2.5">
            Stored value
          </div>
          <div className="w-px mx-1" />
          <div className="flex-1 text-[10px] font-mono uppercase tracking-[0.08em] text-muted pl-2.5">
            Display label
          </div>
          {/* remove button placeholder */}
          <div className="w-[22px] shrink-0" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Option list                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="divide-y divide-border/30">
            {rows.map((row, index) => (
              <OptionRow
                key={row._rowId}
                index={index}
                option={row}
                itemLabel={itemLabel}
                isOnly={rows.length === 1}
                onUpdate={(patch) => handleUpdate(index, patch)}
                onRemove={() => handleRemove(index)}
              />
            ))}
          </div>

          {/* Add row — lives inside the scrollable area, below the list */}
          <button
            type="button"
            aria-label={`Add option to ${itemLabel}`}
            onClick={handleAdd}
            className={[
              'group flex items-center gap-2 w-full',
              'px-4 py-2.5 mt-1',
              'text-xs text-muted hover:text-muted',
              'transition-colors duration-100',
              'focus-ring rounded',
            ].join(' ')}
          >
            {/* Plus in gutter position */}
            <div className="w-7 shrink-0 flex justify-end pr-2" aria-hidden="true">
              <IconPlus size={11} className="transition-transform duration-100 group-hover:scale-110" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
              Add option
            </span>
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="shrink-0 flex justify-end border-t border-border/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className={[
              'px-5 py-2 rounded-lg',
              'text-xs font-semibold text-surface',
              'bg-ink/80 hover:bg-ink',
              'transition-colors duration-100',
              'focus-ring',
            ].join(' ')}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
