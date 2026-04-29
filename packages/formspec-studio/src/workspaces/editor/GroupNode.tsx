/** @filedesc Collapsible group node for the definition tree editor. */
import { useEffect, useState, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Pill } from '../../components/ui/Pill';
import { DragHandle } from '../../components/ui/DragHandle';
import type { FormItem } from '@formspec-org/types';
import type { StatusPill, MissingAction } from '../shared/item-row-shared';
import { useSelection } from '../../state/useSelection';
import { useInlineIdentityEdit } from './useInlineIdentityEdit';

function EditMark({ testId }: { testId?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="ml-1 inline-flex shrink-0 items-center justify-center text-ink/30 transition-colors group-hover:text-accent/55"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </span>
  );
}

interface GroupNodeProps {
  itemKey: string;
  itemPath: string;
  label?: string;
  summaries?: Array<{ label: string; value: string }>;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  statusPills?: StatusPill[];
  missingActions?: MissingAction[];
  depth: number;
  children: ReactNode;
  selected?: boolean;
  isDragSource?: boolean;
  dragHandleRef?: (element: Element | null) => void;
  item?: FormItem;
  binds?: Record<string, string | undefined>;
  onUpdateItem?: (changes: Record<string, unknown>) => void;
  onRenameIdentity?: (nextKey: string, nextLabel: string) => void;
  onUpdateRepeatSettings?: (changes: { repeatable?: boolean; minRepeat?: number | null; maxRepeat?: number | null }) => void;
  onAddItem?: (e: React.MouseEvent, path: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function GroupNode({
  itemKey,
  itemPath,
  label,
  summaries = [],
  repeatable,
  minRepeat,
  maxRepeat,
  statusPills = [],
  missingActions = [],
  depth,
  children,
  selected,
  isDragSource,
  dragHandleRef,
  item,
  binds = {},
  onUpdateItem,
  onRenameIdentity,
  onUpdateRepeatSettings,
  onAddItem,
  onClick,
  onContextMenu,
}: GroupNodeProps) {
  // Collapse expanded content while being dragged to avoid layout disruption
  const effectiveSelected = selected && !isDragSource;
  const [expanded, setExpanded] = useState(false);
  const { primaryKey } = useSelection();
  // Auto-expand when a descendant becomes selected.
  const prevSelectedKeyRef = useRef(primaryKey);
  useEffect(() => {
    const prev = prevSelectedKeyRef.current;
    prevSelectedKeyRef.current = primaryKey;
    if (
      primaryKey &&
      primaryKey !== prev &&
      primaryKey !== itemPath &&
      primaryKey.startsWith(itemPath + '.')
    ) {
      setExpanded(true);
    }
  }, [primaryKey, itemPath]);
  const [editingContent, setEditingContent] = useState<'description' | 'hint' | 'both' | null>(null);
  const [editingBehavior, setEditingBehavior] = useState(false);
  const [editingRepeats, setEditingRepeats] = useState(false);
  const [activeInlineSummary, setActiveInlineSummary] = useState<string | null>(null);
  const contentSummaryMap = new Map(
    summaries
      .filter((entry) => entry.label === 'Description' || entry.label === 'Hint')
      .map((entry) => [entry.label, entry.value]),
  );
  const allContentEntries = [
    { label: 'Description', value: contentSummaryMap.get('Description') ?? '' },
    { label: 'Hint', value: contentSummaryMap.get('Hint') ?? '' },
  ];
  const contentEntries = effectiveSelected
    ? allContentEntries
    : allContentEntries.filter((entry) => entry.value.trim().length > 0);

  const allBehaviorEntries = [
    { label: 'Relevant', value: binds.relevant ?? '' },
    { label: 'Required', value: binds.required ?? '' },
  ];
  const behaviorEntries = effectiveSelected
    ? allBehaviorEntries
    : allBehaviorEntries.filter((entry) => entry.value.trim().length > 0);

  const repeatableDisplayValue = repeatable
    ? `Yes · ${minRepeat ?? 0}–${maxRepeat != null ? maxRepeat : '∞'}`
    : '';
  const repeatableEntry = { label: 'Repeatable', value: repeatableDisplayValue };
  const repeatableEntries = effectiveSelected || repeatableDisplayValue ? [repeatableEntry] : [];

  const hiddenSummaryLabels = new Set<string>([
    ...(editingContent === 'both' && !activeInlineSummary ? ['Description', 'Hint'] : []),
    ...(editingBehavior && !activeInlineSummary ? ['Relevant', 'Required'] : []),
    ...(editingRepeats ? ['Repeatable'] : []),
  ]);
  const supportingText = [
    ...contentEntries,
    ...behaviorEntries,
    ...repeatableEntries,
  ].filter((entry) => !hiddenSummaryLabels.has(entry.label));
  const visibleMissingActions = effectiveSelected ? missingActions : [];
  const showFooter = repeatable || statusPills.length > 0 || visibleMissingActions.length > 0 || effectiveSelected;
  const resolvedLabel = label || itemKey;
  const labelForDescription =
    label?.trim() && label.trim() !== itemKey ? label.trim() : null;

  const {
    activeIdentityField,
    draftKey,
    draftLabel,
    setActiveIdentityField,
    setDraftKey,
    setDraftLabel,
    openIdentityField,
    commitIdentityField,
    cancelIdentityField,
    handleIdentityKeyDown,
  } = useInlineIdentityEdit({
    itemKey,
    label,
    selected,
    onRenameIdentity,
    isField: false,
    resolvedLabel,
  });

  const closeOtherEditors = (kind: 'content' | 'behavior' | 'repeats') => {
    setActiveIdentityField(null);
    setEditingContent(kind === 'content' ? 'both' : null);
    setEditingBehavior(kind === 'behavior');
    setEditingRepeats(kind === 'repeats');
    if (kind !== 'content') setActiveInlineSummary(null);
  };

  useEffect(() => {
    if (!selected) {
      setEditingContent(null);
      setEditingBehavior(false);
      setEditingRepeats(false);
      setActiveInlineSummary(null);
    }
  }, [selected]);

  const openEditorForSummary = (label: string) => {
    setActiveIdentityField(null);
    if (label === 'Description' || label === 'Hint') {
      setActiveInlineSummary(label);
      setEditingContent(label === 'Description' ? 'description' : 'hint');
      setEditingBehavior(false);
      setEditingRepeats(false);
      return;
    }
    if (label === 'Relevant' || label === 'Required') {
      setActiveInlineSummary(label);
      setEditingContent(null);
      setEditingBehavior(false);
      setEditingRepeats(false);
      return;
    }
    if (label === 'Repeatable') {
      setActiveInlineSummary(null);
      closeOtherEditors('repeats');
      return;
    }
    closeOtherEditors('behavior');
  };

  const resetEditors = () => {
    setEditingContent(null);
    setEditingBehavior(false);
    setEditingRepeats(false);
    setActiveInlineSummary(null);
  };

  const editingGroupSummaryContent =
    activeInlineSummary === 'Description' || activeInlineSummary === 'Hint';

  const closeInlineSummary = () => {
    setActiveInlineSummary(null);
    setEditingContent(null);
  };

  return (
    <div
      data-testid={`group-${itemKey}`}
      data-editor-path={itemPath}
      style={{ paddingLeft: depth * 20 }}
      className={[
        'rounded-[20px] border transition-[border-color,background-color,box-shadow]',
        selected
          ? 'border-accent/55 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]'
          : 'border-transparent hover:border-border/65 hover:bg-bg-default/40',
      ].join(' ')}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="rounded-[20px] px-3 py-4 md:px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <DragHandle ref={dragHandleRef} label={`Reorder ${resolvedLabel}`} className="h-9 self-start" />
            <button
              type="button"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${resolvedLabel}`}
              aria-expanded={expanded}
              aria-controls={`group-panel-${itemKey}`}
              data-testid={`toggle-${itemKey}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface text-[12px] text-ink/80 shadow-sm transition-colors hover:border-accent/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? '\u25BE' : '\u25B8'}
            </button>
            <button
              type="button"
              aria-label={`Select group ${resolvedLabel}`}
              className="flex min-w-0 flex-1 items-start rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            >
              <div className="min-w-0 flex-1">
                {activeIdentityField === 'key' ? (
                  <input
                    aria-label="Inline key"
                    type="text"
                    autoFocus
                    value={draftKey}
                    className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[18px] font-semibold font-mono tracking-tight text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[20px]"
                    onChange={(event) => setDraftKey(event.currentTarget.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={() => commitIdentityField('key')}
                    onKeyDown={handleIdentityKeyDown('key')}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-semibold leading-none tracking-tight md:text-[20px]">
                    <div
                      role="heading"
                      aria-level={2}
                      className={`inline-flex max-w-full items-center font-mono text-ink ${effectiveSelected ? 'group cursor-text' : ''}`}
                      onClick={(event) => {
                        if (!effectiveSelected) return;
                        event.stopPropagation();
                        openIdentityField('key');
                      }}
                    >
                      <span className="truncate">{itemKey}</span>
                      {effectiveSelected ? <EditMark testId={`group-${itemKey}-key-edit`} /> : null}
                    </div>
                    <span className="font-mono text-[12px] font-normal tracking-[0.08em] text-accent">
                      group
                    </span>
                  </div>
                )}
                {(labelForDescription || effectiveSelected) && (
                  <div className="mt-1 max-w-full">
                    {activeIdentityField === 'label' ? (
                      <input
                        aria-label="Inline label"
                        type="text"
                        autoFocus
                        value={draftLabel}
                        className="w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[14px] font-normal leading-snug tracking-normal text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[15px]"
                        onChange={(event) => setDraftLabel(event.currentTarget.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => commitIdentityField('label')}
                        onKeyDown={handleIdentityKeyDown('label')}
                      />
                    ) : (
                      <div
                        className={`text-[14px] font-normal leading-snug tracking-normal text-ink/80 md:text-[15px] ${effectiveSelected ? 'group inline-flex cursor-text flex-wrap items-center gap-x-1' : ''}`}
                        onClick={(event) => {
                          if (!effectiveSelected) return;
                          event.stopPropagation();
                          openIdentityField('label');
                        }}
                      >
                        <span className={labelForDescription ? '' : 'italic text-ink/50'}>
                          {labelForDescription ?? 'Add a display label…'}
                        </span>
                        {effectiveSelected ? <EditMark testId={`group-${itemKey}-label-edit`} /> : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>

          <button
            type="button"
            data-testid={`add-to-${itemKey}`}
            aria-label={`Add item to ${resolvedLabel}`}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-bg-default text-[18px] leading-none text-ink/80 transition-colors hover:border-accent/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            onClick={(e) => {
              e.stopPropagation();
              onAddItem?.(e, itemPath);
            }}
          >
            +
          </button>
        </div>

        {(supportingText.length > 0 || showFooter) && (
          <div className="mt-4 border-t border-border/70 pt-4">
            {supportingText.length > 0 && (
              <dl data-testid={`group-${itemKey}-summary`} className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                {supportingText.map((entry) => (
                  <div key={`${itemPath}-${entry.label}`} className="min-w-0 border-l border-border/65 pl-3">
                    <dt className="font-mono text-[11px] tracking-[0.14em] text-ink/72">{entry.label}</dt>
                    {activeInlineSummary === entry.label && entry.label !== 'Repeatable' ? (
                      <input
                        aria-label={`Inline group ${entry.label.toLowerCase()}`}
                        type="text"
                        autoFocus
                        className="mt-1 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] leading-5 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                        value={
                          entry.label === 'Description' ? (typeof item?.description === 'string' ? item.description : '')
                          : entry.label === 'Hint' ? (typeof item?.hint === 'string' ? item.hint : '')
                          : entry.label === 'Relevant' ? (binds.relevant ?? '')
                          : entry.label === 'Required' ? (binds.required ?? '')
                          : ''
                        }
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const val = event.currentTarget.value || null;
                          if (entry.label === 'Description') onUpdateItem?.({ description: val });
                          else if (entry.label === 'Hint') onUpdateItem?.({ hint: val });
                          else if (entry.label === 'Relevant') onUpdateItem?.({ relevant: val });
                          else if (entry.label === 'Required') onUpdateItem?.({ required: val });
                        }}
                        onBlur={closeInlineSummary}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') closeInlineSummary();
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            closeInlineSummary();
                          }
                        }}
                      />
                    ) : (
                      <dd
                        className={`group mt-1 inline-flex max-w-full items-center truncate text-[14px] font-medium leading-5 text-ink md:text-[15px] ${effectiveSelected ? (entry.label === 'Repeatable' ? 'cursor-pointer' : 'cursor-text') : ''}`}
                        onClick={(event) => {
                          if (!effectiveSelected) return;
                          event.stopPropagation();
                          openEditorForSummary(entry.label);
                        }}
                      >
                        <span className={`truncate ${entry.value ? '' : 'text-ink/56 italic'}`}>
                          {entry.value || (effectiveSelected ? `Click to add ${entry.label.toLowerCase()}` : '\u2014')}
                        </span>
                        {effectiveSelected ? <EditMark testId={`group-${itemKey}-summary-edit-${entry.label}`} /> : null}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}

            <div data-testid={`group-${itemKey}-status`} className="mt-3 flex flex-wrap items-center gap-2">
              {repeatable && (
                <Pill
                  text={`\u27F3 ${minRepeat ?? 0}\u2013${maxRepeat ?? '\u221E'}`}
                  color="logic"
                  size="sm"
                />
              )}
              {statusPills.map((pill) => (
                <Pill key={`${itemPath}-${pill.text}`} text={pill.text} color={pill.color} size="sm" title={pill.specTerm} />
              ))}
              {effectiveSelected && (
                <button
                  type="button"
                  aria-label={`Edit repeats for ${resolvedLabel}`}
                  className="inline-flex items-center rounded-full border border-border/90 px-2.5 py-1 text-[12px] font-medium text-ink/75 transition-colors hover:border-accent/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeOtherEditors('repeats');
                  }}
                >
                  Edit repeats
                </button>
              )}
              {visibleMissingActions.map((action) => (
                <button
                  key={`${itemPath}-${action.key}`}
                  type="button"
                  aria-label={action.ariaLabel}
                  className="inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (action.key === 'behavior') closeOtherEditors('behavior');
                    else closeOtherEditors('content');
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
            {(((editingContent === 'both') && !activeInlineSummary) || editingBehavior || editingGroupSummaryContent) && (
              <div className="mt-4 space-y-4 border-t border-border/65 pt-4">
                {editingGroupSummaryContent && (
                  <section aria-label="Group content" className="space-y-3">
                    <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">Group details</h3>
                    <p className="mt-1 text-[11px] leading-snug text-ink/50">
                      Edit description and hint in the summary row above.
                    </p>
                  </section>
                )}
                {editingContent === 'both' && (
                  <section aria-label="Group details" className="space-y-3">
                    <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                      Group details
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <label className="text-[13px] font-semibold tracking-[0.01em] text-ink/95">
                      Description
                      <textarea
                        aria-label="Inline group description"
                        className="mt-1 min-h-20 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                        value={typeof item?.description === 'string' ? item.description : ''}
                        onChange={(event) => onUpdateItem?.({ description: event.currentTarget.value || null })}
                      />
                    </label>
                    <label className="text-[13px] font-semibold tracking-[0.01em] text-ink/95">
                      Hint
                      <textarea
                        aria-label="Inline group hint"
                        className="mt-1 min-h-20 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                        value={typeof item?.hint === 'string' ? item.hint : ''}
                        onChange={(event) => onUpdateItem?.({ hint: event.currentTarget.value || null })}
                      />
                    </label>
                    </div>
                  </section>
                )}
                {editingBehavior && (
                  <section aria-label="Behavior" className="space-y-3 border-t border-border/65 pt-4 first:border-t-0 first:pt-0">
                    <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                      Behavior
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <input
                        aria-label="Group required behavior"
                        type="checkbox"
                        checked={Boolean(binds.required)}
                        onChange={(event) => onUpdateItem?.({ required: event.currentTarget.checked ? 'true' : null })}
                      />
                      Required
                    </label>
                    <label className="text-[13px] font-semibold tracking-[0.01em] text-ink/95">
                      Relevant
                      <input
                        aria-label="Group relevant behavior"
                        type="text"
                        className="mt-1 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                        value={binds.relevant ?? ''}
                        onChange={(event) => onUpdateItem?.({ relevant: event.currentTarget.value || null })}
                      />
                    </label>
                    </div>
                  </section>
                )}
              </div>
            )}
            {editingRepeats && (
              <section aria-label="Repeat settings" className="mt-4 space-y-3 border-t border-border/65 pt-4">
                <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                  Repeat settings
                </h3>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[auto,110px,110px] sm:items-end">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <input
                      aria-label="Repeatable"
                      type="checkbox"
                      checked={Boolean(repeatable)}
                      onChange={(event) => onUpdateRepeatSettings?.({ repeatable: event.currentTarget.checked })}
                    />
                    Repeatable
                  </label>
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink/95">
                    Minimum repeats
                    <input
                      aria-label="Minimum repeats"
                      type="number"
                      min="0"
                      value={minRepeat ?? ''}
                      className="mt-1 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                      onChange={(event) => onUpdateRepeatSettings?.({ minRepeat: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) })}
                    />
                  </label>
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink/95">
                    Maximum repeats
                    <input
                      aria-label="Maximum repeats"
                      type="number"
                      min="0"
                      value={maxRepeat ?? ''}
                      className="mt-1 w-full rounded-[6px] border border-border/80 bg-surface px-2.5 py-2 text-[14px] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                      onChange={(event) => onUpdateRepeatSettings?.({ maxRepeat: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) })}
                    />
                  </label>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        data-expanded={expanded}
      >
        <div className="overflow-hidden" aria-hidden={!expanded}>
          <div
            id={`group-panel-${itemKey}`}
            data-testid={`group-${itemKey}-children`}
            className="mt-2 flex flex-col px-4 pb-1 md:px-6"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
