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
} from '../shared/item-row-shared';
import { CategoryCell } from './CategoryCell';

/** Hover hints for category cells — surfaces what each category configures before expanding. */
const CATEGORY_HINTS: Record<string, string> = {
  Visibility: 'When does this field show?',
  Validation: 'Required rules and constraints.',
  Value: 'Calculations, initial data, pre-fill, read-only.',
  Format: 'Display format, currency, and field metadata.',
};

/** Identifying data for the item row. */
export interface ItemRowIdentity {
  testId: string;
  itemKey: string;
  itemLabel: string;
  isField: boolean;
  selected: boolean | undefined;
  /** SM-6: Whether edit handlers are available (suppresses edit affordances when false). */
  editable: boolean;
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
  /** SI-4: Revert inline summary to original value and close. */
  onCancelInlineSummary: () => void;
  onUpdateSummaryValue: (label: string, rawValue: string) => void;
  onHandleIdentityKeyDown: (field: 'label' | 'key') => (event: React.KeyboardEvent<HTMLInputElement>) => void;
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

function IdentityColumn({ identity, editState, actions, layout }: ItemRowContentProps) {
  const {
    testId,
    itemKey,
    itemLabel,
    isField,
    selected,
    editable,
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
    onHandleIdentityKeyDown,
  } = actions;

  // KN-5: When layout='identity', we're inside a <button> — role="heading" is invalid there.
  const insideButton = layout === 'identity';
  // SM-6: Only show edit affordances when handlers are available.
  const showEditMark = selected && editable;

  return (
    <div className='flex min-w-0 gap-5'>
      {isField && dt && (
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent/[0.04] border border-border shadow-sm'>
          <FieldIcon dataType={dataType!} className={`shrink-0 ${dt.color} opacity-90`} />
        </div>
      )}
      {!isField && (
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded bg-indigo-500/[0.04] border border-border shadow-sm'>
          <span className='text-accent font-display shrink-0 font-bold text-[16px]'>
            {widgetHint === 'heading'
              ? 'H'
              : widgetHint === 'divider'
                ? '\u2014'
                : '\u2139'}
          </span>
        </div>
      )}

      <div className='min-w-0 flex-1 flex flex-col justify-center gap-1'>
        {isField ? (
          <>
            {activeIdentityField === 'key' ? (
              <input
                aria-label='Inline key'
                type='text'
                autoFocus
                value={draftKey}
                className='w-full rounded border border-accent bg-surface px-3 py-1 text-[14px] font-bold font-mono text-ink outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftKeyChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('key')}
                onKeyDown={onHandleIdentityKeyDown('key')}
              />
            ) : (
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <div
                  {...(insideButton ? {} : { role: 'heading', 'aria-level': 2 })}
                  className={`inline-flex max-w-full items-center font-mono text-[14px] font-bold tracking-tight text-ink ${showEditMark ? 'group cursor-text' : ''}`}
                  onClick={(event) => {
                    if (!showEditMark) return;
                    event.stopPropagation();
                    onOpenIdentityField('key');
                  }}
                >
                  {groupPrefix && (
                    <span className='text-muted mr-0.5'>{groupPrefix}</span>
                  )}
                  <span className='truncate'>{itemKey}</span>
                  {showEditMark ? <EditMark testId={`${testId}-key-edit`} /> : null}
                </div>
                {dataType && (
                  <span
                    className={`font-display text-[9px] font-bold uppercase tracking-normal px-1.5 py-0.5 rounded bg-subtle ${dt?.color ?? 'text-muted'}`}
                  >
                    {dataType}
                  </span>
                )}
              </div>
            )}
            {(labelForDescription || selected) && (
              <div className='max-w-full'>
                {activeIdentityField === 'label' ? (
                  <input
                    aria-label='Inline label'
                    type='text'
                    autoFocus
                    value={draftLabel}
                    className='w-full rounded border border-accent bg-surface px-3 py-1 text-[12px] font-bold text-ink outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all'
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onDraftLabelChange(event.currentTarget.value)
                    }
                    onBlur={() => onCommitIdentityField('label')}
                    onKeyDown={onHandleIdentityKeyDown('label')}
                  />
                ) : (
                  <div
                    className={`text-[12px] font-bold tracking-tight text-muted ${showEditMark ? 'group inline-flex cursor-text flex-wrap items-center gap-x-1.5' : ''}`}
                    onClick={(event) => {
                      if (!showEditMark) return;
                      event.stopPropagation();
                      onOpenIdentityField('label');
                    }}
                  >
                    <span
                      className={
                        labelForDescription ? '' : 'italic text-muted font-medium'
                      }
                    >
                      {labelForDescription ?? 'Add display label\u2026'}
                    </span>
                    {showEditMark ? (
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
                className='w-full rounded border border-accent bg-surface px-3 py-1 text-[14px] font-bold text-ink outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftLabelChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('label')}
                onKeyDown={onHandleIdentityKeyDown('label')}
              />
            ) : (
              <>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                  <span
                    className={
                      showEditMark
                        ? 'group inline-flex max-w-full items-center cursor-text text-ink font-bold text-[14px]'
                        : 'inline-flex max-w-full items-center text-ink font-bold text-[14px]'
                    }
                    onClick={(event) => {
                      if (!showEditMark) return;
                      event.stopPropagation();
                      onOpenIdentityField('label');
                    }}
                  >
                    <span className='truncate text-ink'>{itemLabel}</span>
                    {showEditMark ? (
                      <EditMark testId={`${testId}-label-edit`} />
                    ) : null}
                  </span>
                  {widgetHint && (
                    <span className='font-display text-[9px] font-bold uppercase tracking-normal px-1.5 py-0.5 rounded bg-accent/[0.04] text-accent/60'>
                      {widgetHint}
                    </span>
                  )}
                </div>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                  {activeIdentityField === 'key' ? (
                    <input
                      aria-label='Inline key'
                      type='text'
                      autoFocus
                      value={draftKey}
                      className='w-full max-w-[16rem] rounded border border-accent bg-surface px-3 py-1 font-mono text-[11px] font-bold text-ink outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all'
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onDraftKeyChange(event.currentTarget.value)
                      }
                      onBlur={() => onCommitIdentityField('key')}
                      onKeyDown={onHandleIdentityKeyDown('key')}
                    />
                  ) : (
                    <span className='inline-flex items-center gap-2'>
                      <span className='font-display text-[9px] font-bold uppercase tracking-normal text-muted'>
                        ID
                      </span>
                      <span
                        className={`group inline-flex items-center font-mono text-[11px] font-bold tracking-tight text-muted ${showEditMark ? 'cursor-text' : ''}`}
                        onClick={(event) => {
                          if (!showEditMark) return;
                          event.stopPropagation();
                          onOpenIdentityField('key');
                        }}
                      >
                        {groupPrefix && (
                          <span className='text-muted mr-0.5 font-medium'>{groupPrefix}</span>
                        )}
                        {itemKey}
                        {showEditMark ? (
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

/** Fixed strip for field rows — matches definition-tree integration tests. */
const FIELD_SUMMARY_CATEGORY_ORDER = ['Visibility', 'Validation', 'Value', 'Format'];

function SummaryColumn({
  identity,
  editState,
  actions,
  categoryEditor,
  statusPills = [],
}: ItemRowContentProps) {
  const { testId, selected, editable, isField } = identity;
  const showEditMark = selected && editable;
  const {
    activeInlineSummary,
    supportingText,
    categorySummaries,
    expandedCategoryKey,
    summaryInputValue,
  } = editState;
  const { onOpenEditorForSummary, onCloseInlineSummary, onCancelInlineSummary, onUpdateSummaryValue } =
    actions;

  return (
    <div className='min-w-0 flex flex-col gap-4'>
      {(() => {
        let visibleCategories: [string, string][];
        if (isField) {
          const keys: string[] = [...FIELD_SUMMARY_CATEGORY_ORDER];
          if (Object.prototype.hasOwnProperty.call(categorySummaries, 'Options')) {
            keys.push('Options');
          }
          const allCategories: [string, string][] = keys.map((k) => [k, categorySummaries[k] ?? '']);
          // When selected, show all 4 category slots so the user sees what's editable.
          // When unselected, filter out empty/dash categories to reduce clutter.
          visibleCategories = selected
            ? allCategories
            : allCategories.filter(([, v]) => v && v !== '\u2014');
        } else {
          visibleCategories = selected
            ? Object.entries(categorySummaries)
            : Object.entries(categorySummaries).filter(([, v]) => v);
        }
        if (visibleCategories.length === 0) return null;
        return (
          <dl
            data-testid={`${testId}-summary`}
            className={`grid gap-2 ${visibleCategories.length <= 2 ? 'grid-cols-2' : visibleCategories.length <= 4 ? 'grid-cols-4' : 'grid-cols-5'}`}
          >
            {visibleCategories.map(([category, value]) => (
              <CategoryCell
                key={category}
                category={category}
                value={value}
                isExpanded={expandedCategoryKey === category}
                selected={selected}
                testId={`${testId}-category-${category}`}
                title={CATEGORY_HINTS[category]}
                onOpen={onOpenEditorForSummary}
              />
            ))}
          </dl>
        );
      })()}

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
              className="px-2 py-0.5 font-bold text-[9px] uppercase tracking-normal"
            />
          ))}
        </div>
      )}

      {categoryEditor}

      {supportingText.length > 0 && (
        <dl className='grid gap-4 sm:grid-cols-2'>
          {supportingText.map((entry) => (
            <div
              key={entry.label}
              className='min-w-0 bg-subtle rounded border border-border p-3 transition-all'
            >
              <dt className='font-display text-[9px] font-bold uppercase tracking-normal text-muted mb-1'>
                {entry.label}
              </dt>
              {activeInlineSummary === entry.label ? (
                <textarea
                  aria-label={summaryInputLabel(entry.label)}
                  autoFocus
                  rows={2}
                  className={`w-full rounded border border-accent bg-surface px-3 py-1.5 text-[12px] font-bold text-ink outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all resize-none`}
                  value={summaryInputValue(entry.label)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onUpdateSummaryValue(entry.label, event.currentTarget.value)
                  }
                  onBlur={onCloseInlineSummary}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onCloseInlineSummary();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      // SI-4: Revert to original value on Escape.
                      onCancelInlineSummary();
                    }
                  }}
                />
              ) : (
                <dd
                  className={`group inline-flex w-full items-center truncate text-[12px] font-bold leading-normal text-ink/70 ${showEditMark ? 'cursor-text' : ''}`}
                  onClick={(event) => {
                    if (!showEditMark) return;
                    event.stopPropagation();
                    onOpenEditorForSummary(entry.label);
                  }}
                >
                  <span
                    className={`truncate ${entry.value ? '' : 'text-muted italic font-medium'}`}
                  >
                    {entry.value ||
                      (selected
                        ? `Add ${entry.label.toLowerCase()}\u2026`
                        : '\u2014')}
                  </span>
                  {showEditMark ? (
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
        layout={layout}
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
