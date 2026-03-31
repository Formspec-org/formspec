/** @filedesc Identity editing and summary grid content for ItemRow. */
import type { KeyboardEvent, ReactNode } from 'react';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { Pill } from '../../components/ui/Pill';
import {
  type SummaryEntry,
  type StatusPill,
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
  /** Summary grid category with expanded editor beneath the row (Visibility, Validation, …). */
  expandedCategoryKey: string | null;
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
  onUpdateSummaryValue: (label: string, rawValue: string) => void;
}

/** `identity` | `summary` = fragments; `combined` = identity then summary stacked (used while editing identity). */
export type ItemRowContentLayout = 'combined' | 'identity' | 'summary';

export interface ItemRowContentProps {
  identity: ItemRowIdentity;
  editState: ItemRowEditState;
  actions: ItemRowActions;
  layout?: ItemRowContentLayout;
  /** Rendered under the category strip (bind editors). Used with `summary` (and `combined` stacks it below identity). */
  categoryEditor?: ReactNode;
  /** Behavior tags (same strip as categories — avoids duplicating e.g. Value text and a footer pill). */
  statusPills?: StatusPill[];
}

function IdentityColumn({ identity, editState, actions }: ItemRowContentProps) {
  const {
    testId,
    itemKey,
    itemLabel,
    isField,
    selected,
    dataType,
    widgetHint,
    dt,
    labelForDescription,
    groupPrefix,
  } = identity;
  const { activeIdentityField, draftKey, draftLabel } = editState;
  const {
    onDraftKeyChange,
    onDraftLabelChange,
    onCommitIdentityField,
    onCancelIdentityField,
    onOpenIdentityField,
  } = actions;

  const handleIdentityKeyDown =
    (field: 'label' | 'key') => (event: KeyboardEvent<HTMLInputElement>) => {
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
    <div className='flex min-w-0 gap-3'>
      {isField && dt && (
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85'>
          <FieldIcon dataType={dataType!} className={`shrink-0 ${dt.color}`} />
        </div>
      )}
      {!isField && (
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85'>
          <span className='text-accent font-mono shrink-0'>
            {widgetHint === 'heading'
              ? 'H'
              : widgetHint === 'divider'
                ? '\u2014'
                : '\u2139'}
          </span>
        </div>
      )}

      <div className='min-w-0'>
        {isField ? (
          <>
            {activeIdentityField === 'key' ? (
              <input
                aria-label='Inline key'
                type='text'
                autoFocus
                value={draftKey}
                className='w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold font-mono leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftKeyChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('key')}
                onKeyDown={handleIdentityKeyDown('key')}
              />
            ) : (
              <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 md:text-[18px]'>
                <div
                  role='heading'
                  aria-level={2}
                  className={`inline-flex max-w-full items-center font-mono text-ink ${selected ? 'group cursor-text' : ''}`}
                  onClick={(event) => {
                    if (!selected) return;
                    event.stopPropagation();
                    onOpenIdentityField('key');
                  }}
                >
                  {groupPrefix && (
                    <span className='text-ink/35'>{groupPrefix}</span>
                  )}
                  <span className='truncate'>{itemKey}</span>
                  {selected ? <EditMark testId={`${testId}-key-edit`} /> : null}
                </div>
                {dataType && (
                  <span
                    className={`font-mono text-[12px] font-normal tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}
                  >
                    {dataType}
                  </span>
                )}
              </div>
            )}
            {(labelForDescription || selected) && (
              <div className='mt-1 max-w-full'>
                {activeIdentityField === 'label' ? (
                  <input
                    aria-label='Inline label'
                    type='text'
                    autoFocus
                    value={draftLabel}
                    className='w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[14px] font-normal leading-snug tracking-normal text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[15px]'
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onDraftLabelChange(event.currentTarget.value)
                    }
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
                    <span
                      className={
                        labelForDescription ? '' : 'italic text-ink/50'
                      }
                    >
                      {labelForDescription ?? 'Add a display label\u2026'}
                    </span>
                    {selected ? (
                      <EditMark testId={`${testId}-label-edit`} />
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {activeIdentityField === 'label' ? (
              <input
                aria-label='Inline label'
                type='text'
                autoFocus
                value={draftLabel}
                className='w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftLabelChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('label')}
                onKeyDown={handleIdentityKeyDown('label')}
              />
            ) : (
              <>
                <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 text-ink md:text-[18px]'>
                  <span
                    className={
                      selected
                        ? 'group inline-flex max-w-full items-center cursor-text text-ink'
                        : 'inline-flex max-w-full items-center text-ink'
                    }
                    onClick={(event) => {
                      if (!selected) return;
                      event.stopPropagation();
                      onOpenIdentityField('label');
                    }}
                  >
                    <span className='truncate text-ink'>{itemLabel}</span>
                    {selected ? (
                      <EditMark testId={`${testId}-label-edit`} />
                    ) : null}
                  </span>
                  {widgetHint && (
                    <span className='font-mono text-[12px] tracking-[0.08em] text-accent/80'>
                      {widgetHint}
                    </span>
                  )}
                </div>
                <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1'>
                  {activeIdentityField === 'key' ? (
                    <input
                      aria-label='Inline key'
                      type='text'
                      autoFocus
                      value={draftKey}
                      className='w-full max-w-[16rem] rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 font-mono text-[12px] tracking-[0.08em] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onDraftKeyChange(event.currentTarget.value)
                      }
                      onBlur={() => onCommitIdentityField('key')}
                      onKeyDown={handleIdentityKeyDown('key')}
                    />
                  ) : (
                    <span className='inline-flex items-center gap-1.5'>
                      <span className='font-mono text-[11px] tracking-[0.12em] text-ink/60'>
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
                        {groupPrefix && (
                          <span className='text-ink/35'>{groupPrefix}</span>
                        )}
                        {itemKey}
                        {selected ? (
                          <EditMark testId={`${testId}-key-edit`} />
                        ) : null}
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
  );
}

function SummaryColumn({
  identity,
  editState,
  actions,
  categoryEditor,
  statusPills = [],
}: ItemRowContentProps) {
  const { testId, selected } = identity;
  const {
    activeInlineSummary,
    supportingText,
    categorySummaries,
    expandedCategoryKey,
    summaryInputValue,
  } = editState;
  const { onOpenEditorForSummary, onCloseInlineSummary, onUpdateSummaryValue } =
    actions;

  return (
    <div className='min-w-0 flex flex-col gap-3'>
      <dl
        data-testid={`${testId}-summary`}
        className={`grid gap-x-5 gap-y-3 ${Object.keys(categorySummaries).length <= 2 ? 'grid-cols-2' : Object.keys(categorySummaries).length <= 4 ? 'grid-cols-4' : 'grid-cols-5'}`}
      >
        {Object.entries(categorySummaries).map(([category, value]) => {
          const isExpanded = expandedCategoryKey === category;
          return (
            <div
              key={category}
              data-testid={`${testId}-category-${category}`}
              className={`min-w-0 border-l border-border/65 pl-3 ${selected ? 'cursor-pointer' : ''}`}
              onClick={(event) => {
                if (!selected) return;
                event.stopPropagation();
                onOpenEditorForSummary(category);
              }}
            >
              <dt className='font-mono text-[11px] tracking-[0.14em] text-ink/62'>
                {category}
              </dt>
              <dd
                className={`group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 text-ink/94 md:text-[15px] ${isExpanded ? 'bg-accent/12 ring-1 ring-accent/25' : ''}`}
              >
                <span className='truncate'>{value}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {statusPills.length > 0 && (
        <div
          data-testid={`${testId}-status`}
          className='flex flex-wrap items-center gap-2'
        >
          {statusPills.map((pill) => (
            <Pill
              key={`${testId}-pill-${pill.text}-${pill.specTerm}`}
              text={pill.text}
              color={pill.color}
              size='sm'
              title={pill.specTerm}
              warn={pill.warn}
            />
          ))}
        </div>
      )}

      {categoryEditor}

      {supportingText.length > 0 && (
        <dl className='grid gap-x-5 gap-y-3 sm:grid-cols-2'>
          {supportingText.map((entry) => (
            <div
              key={entry.label}
              className='min-w-0 border-l border-border/65 pl-3'
            >
              <dt className='font-mono text-[11px] tracking-[0.14em] text-ink/62'>
                {entry.label}
              </dt>
              {activeInlineSummary === entry.label ? (
                <input
                  aria-label={summaryInputLabel(entry.label)}
                  type={summaryInputType(entry.label)}
                  autoFocus
                  className={summaryInputClassName}
                  value={summaryInputValue(entry.label)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onUpdateSummaryValue(entry.label, event.currentTarget.value)
                  }
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
                  <span
                    className={`truncate ${entry.value ? '' : 'text-ink/56 italic'}`}
                  >
                    {entry.value ||
                      (selected
                        ? `Click to add ${entry.label.toLowerCase()}`
                        : '\u2014')}
                  </span>
                  {selected ? (
                    <EditMark
                      testId={`${testId}-summary-edit-${entry.label}`}
                    />
                  ) : null}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function ItemRowContent({
  identity,
  editState,
  actions,
  layout = 'combined',
  categoryEditor,
  statusPills,
}: ItemRowContentProps) {
  if (layout === 'identity') {
    return (
      <IdentityColumn
        identity={identity}
        editState={editState}
        actions={actions}
      />
    );
  }
  if (layout === 'summary') {
    return (
      <SummaryColumn
        identity={identity}
        editState={editState}
        actions={actions}
        categoryEditor={categoryEditor}
        statusPills={statusPills}
      />
    );
  }

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <IdentityColumn
        identity={identity}
        editState={editState}
        actions={actions}
      />
      <SummaryColumn
        identity={identity}
        editState={editState}
        actions={actions}
        categoryEditor={categoryEditor}
        statusPills={statusPills}
      />
    </div>
  );
}
