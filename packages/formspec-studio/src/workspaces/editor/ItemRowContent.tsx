/** @filedesc Identity editing and summary grid content for ItemRow. */
import type { KeyboardEvent } from 'react';
import { FieldIcon } from '../../components/ui/FieldIcon';
import {
  type SummaryEntry,
  summaryInputClassName,
  summaryInputLabel,
  summaryInputType,
  EditMark,
} from './item-row-shared';

/** Identifying data for the item row. */
export interface ItemRowIdentity {
  testId: string;
  itemKey: string;
  itemLabel: string;
  isField: boolean;
  selected: boolean | undefined;
  dataType: string | undefined;
  widgetHint: string | undefined;
  dt: { color: string } | null;
  labelForDescription: string | null;
  /** Dot-delimited group path prefix (e.g. "demographics.") shown greyed before the key. */
  groupPrefix: string | null;
}

/** Current inline-editing state for the item row. */
export interface ItemRowEditState {
  activeIdentityField: 'label' | 'key' | null;
  draftKey: string;
  draftLabel: string;
  activeInlineSummary: string | null;
  supportingText: SummaryEntry[];
  categorySummaries: Record<string, string>;
  preFillSourceInputValue: string;
  summaryInputValue: (label: string) => string;
}

/** Callbacks for inline editing and navigation in the item row. */
export interface ItemRowActions {
  onDraftKeyChange: (value: string) => void;
  onDraftLabelChange: (value: string) => void;
  onCommitIdentityField: (field: 'label' | 'key') => void;
  onCancelIdentityField: () => void;
  onOpenIdentityField: (field: 'label' | 'key') => void;
  onOpenEditorForSummary: (label: string) => void;
  onCloseInlineSummary: () => void;
  onPreFillSourceDraftChange: (value: string) => void;
  onUpdateSummaryValue: (label: string, rawValue: string) => void;
}

export interface ItemRowContentProps {
  identity: ItemRowIdentity;
  editState: ItemRowEditState;
  actions: ItemRowActions;
}

export function ItemRowContent({
  identity,
  editState,
  actions,
}: ItemRowContentProps) {
  const {
    testId, itemKey, itemLabel, isField, selected,
    dataType, widgetHint, dt, labelForDescription, groupPrefix,
  } = identity;
  const {
    activeIdentityField, draftKey, draftLabel,
    activeInlineSummary, supportingText,
    categorySummaries, summaryInputValue,
  } = editState;
  const {
    onDraftKeyChange, onDraftLabelChange, onCommitIdentityField,
    onCancelIdentityField, onOpenIdentityField, onOpenEditorForSummary,
    onCloseInlineSummary, onUpdateSummaryValue,
  } = actions;

  const handleIdentityKeyDown = (field: 'label' | 'key') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommitIdentityField(field);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelIdentityField();
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,21rem),minmax(0,1fr)] md:items-start">
      <div className="flex min-w-0 gap-3">
        {isField && dt && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
            <FieldIcon dataType={dataType!} className={`shrink-0 ${dt.color}`} />
          </div>
        )}
        {!isField && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
            <span className="text-accent font-mono shrink-0">
              {widgetHint === 'heading' ? 'H' : widgetHint === 'divider' ? '\u2014' : '\u2139'}
            </span>
          </div>
        )}

        <div className="min-w-0">
          {isField ? (
            <>
              {activeIdentityField === 'key' ? (
                <input
                  aria-label="Inline key"
                  type="text"
                  autoFocus
                  value={draftKey}
                  className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold font-mono leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]"
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onDraftKeyChange(event.currentTarget.value)}
                  onBlur={() => onCommitIdentityField('key')}
                  onKeyDown={handleIdentityKeyDown('key')}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 md:text-[18px]">
                  <div
                    role="heading"
                    aria-level={2}
                    className={`inline-flex max-w-full items-center font-mono text-ink ${selected ? 'group cursor-text' : ''}`}
                    onClick={(event) => {
                      if (!selected) return;
                      event.stopPropagation();
                      onOpenIdentityField('key');
                    }}
                  >
                    {groupPrefix && <span className="text-ink/35">{groupPrefix}</span>}
                    <span className="truncate">{itemKey}</span>
                    {selected ? <EditMark testId={`${testId}-key-edit`} /> : null}
                  </div>
                  {dataType && (
                    <span className={`font-mono text-[12px] font-normal tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}>
                      {dataType}
                    </span>
                  )}
                </div>
              )}
              {(labelForDescription || selected) && (
                <div className="mt-1 max-w-full">
                  {activeIdentityField === 'label' ? (
                    <input
                      aria-label="Inline label"
                      type="text"
                      autoFocus
                      value={draftLabel}
                      className="w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[14px] font-normal leading-snug tracking-normal text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[15px]"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onDraftLabelChange(event.currentTarget.value)}
                      onBlur={() => onCommitIdentityField('label')}
                      onKeyDown={handleIdentityKeyDown('label')}
                    />
                  ) : (
                    <div
                      className={`text-[14px] font-normal leading-snug tracking-normal text-ink/72 md:text-[15px] ${selected ? 'group inline-flex cursor-text flex-wrap items-center gap-x-1' : ''}`}
                      onClick={(event) => {
                        if (!selected) return;
                        event.stopPropagation();
                        onOpenIdentityField('label');
                      }}
                    >
                      <span className={labelForDescription ? '' : 'italic text-ink/50'}>
                        {labelForDescription ?? 'Add a display label\u2026'}
                      </span>
                      {selected ? <EditMark testId={`${testId}-label-edit`} /> : null}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {activeIdentityField === 'label' ? (
                <input
                  aria-label="Inline label"
                  type="text"
                  autoFocus
                  value={draftLabel}
                  className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]"
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onDraftLabelChange(event.currentTarget.value)}
                  onBlur={() => onCommitIdentityField('label')}
                  onKeyDown={handleIdentityKeyDown('label')}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 text-ink md:text-[18px]">
                    <span
                      className={selected ? 'group inline-flex max-w-full items-center cursor-text text-ink' : 'inline-flex max-w-full items-center text-ink'}
                      onClick={(event) => {
                        if (!selected) return;
                        event.stopPropagation();
                        onOpenIdentityField('label');
                      }}
                    >
                      <span className="truncate text-ink">{itemLabel}</span>
                      {selected ? <EditMark testId={`${testId}-label-edit`} /> : null}
                    </span>
                    {widgetHint && (
                      <span className="font-mono text-[12px] tracking-[0.08em] text-accent/80">
                        {widgetHint}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {activeIdentityField === 'key' ? (
                      <input
                        aria-label="Inline key"
                        type="text"
                        autoFocus
                        value={draftKey}
                        className="w-full max-w-[16rem] rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 font-mono text-[12px] tracking-[0.08em] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onDraftKeyChange(event.currentTarget.value)}
                        onBlur={() => onCommitIdentityField('key')}
                        onKeyDown={handleIdentityKeyDown('key')}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[11px] tracking-[0.12em] text-ink/60">
                          Key
                        </span>
                        <span
                          className={`group inline-flex items-center font-mono text-[12px] tracking-[0.08em] text-ink/68 ${selected ? 'cursor-text' : ''}`}
                          onClick={(event) => {
                            if (!selected) return;
                            event.stopPropagation();
                            onOpenIdentityField('key');
                          }}
                        >
                          {groupPrefix && <span className="text-ink/35">{groupPrefix}</span>}
                          {itemKey}
                          {selected ? <EditMark testId={`${testId}-key-edit`} /> : null}
                        </span>
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Category summary grid — fixed slots, read-only indicators */}
      <dl
        data-testid={`${testId}-summary`}
        className={`grid gap-x-5 gap-y-3 ${Object.keys(categorySummaries).length <= 2 ? 'grid-cols-2' : Object.keys(categorySummaries).length <= 4 ? 'grid-cols-4' : 'grid-cols-5'}`}
      >
        {Object.entries(categorySummaries).map(([category, value]) => (
          <div key={category} className="min-w-0 border-l border-border/65 pl-3">
            <dt className="font-mono text-[11px] tracking-[0.14em] text-ink/62">{category}</dt>
            <dd
              className={`group mt-1 inline-flex max-w-full items-center truncate text-[14px] font-medium leading-5 text-ink/94 md:text-[15px] ${selected ? 'cursor-pointer' : ''}`}
              onClick={(event) => {
                if (!selected) return;
                event.stopPropagation();
                onOpenEditorForSummary(category);
              }}
            >
              <span className="truncate">{value}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Content rows — Description / Hint remain inline-editable */}
      {supportingText.length > 0 && (
        <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {supportingText.map((entry) => (
            <div key={entry.label} className="min-w-0 border-l border-border/65 pl-3">
              <dt className="font-mono text-[11px] tracking-[0.14em] text-ink/62">{entry.label}</dt>
              {activeInlineSummary === entry.label ? (
                <input
                  aria-label={summaryInputLabel(entry.label)}
                  type={summaryInputType(entry.label)}
                  autoFocus
                  className={summaryInputClassName}
                  value={summaryInputValue(entry.label)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateSummaryValue(entry.label, event.currentTarget.value)}
                  onBlur={onCloseInlineSummary}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCloseInlineSummary();
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onCloseInlineSummary();
                    }
                  }}
                />
              ) : (
                <dd
                  className={`group mt-1 inline-flex max-w-full items-center truncate text-[14px] font-medium leading-5 text-ink/94 md:text-[15px] ${selected ? 'cursor-text' : ''}`}
                  onClick={(event) => {
                    if (!selected) return;
                    event.stopPropagation();
                    onOpenEditorForSummary(entry.label);
                  }}
                >
                  <span className={`truncate ${entry.value ? '' : 'text-ink/56 italic'}`}>
                    {entry.value || (selected ? `Click to add ${entry.label.toLowerCase()}` : '\u2014')}
                  </span>
                  {selected ? <EditMark testId={`${testId}-summary-edit-${entry.label}`} /> : null}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
