/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Pill } from '../../components/ui/Pill';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { DragHandle } from '../../components/ui/DragHandle';
import { dataTypeInfo } from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';

interface SummaryEntry {
  label: string;
  value: string;
}

interface StatusPill {
  text: string;
  color: 'accent' | 'logic' | 'error' | 'green' | 'amber' | 'muted';
}

interface MissingAction {
  key: string;
  label: string;
  ariaLabel: string;
}

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

interface ItemRowProps {
  itemKey: string;
  itemPath: string;
  itemType: 'field' | 'display';
  label?: string;
  summaries?: SummaryEntry[];
  dataType?: string;
  widgetHint?: string;
  statusPills?: StatusPill[];
  missingActions?: MissingAction[];
  depth: number;
  selected?: boolean;
  dragHandleRef?: (element: Element | null) => void;
  item?: FormItem;
  binds?: Record<string, string>;
  onUpdateItem?: (changes: Record<string, unknown>) => void;
  onRenameIdentity?: (nextKey: string, nextLabel: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ItemRow({
  itemKey,
  itemPath,
  itemType,
  label,
  summaries = [],
  dataType,
  widgetHint,
  statusPills = [],
  missingActions = [],
  depth,
  selected,
  dragHandleRef,
  item,
  binds = {},
  onUpdateItem,
  onRenameIdentity,
  onClick,
  onContextMenu,
}: ItemRowProps) {
  const isField = itemType === 'field';
  const testId = isField ? `field-${itemKey}` : `display-${itemKey}`;

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const visibleMissingActions = selected ? missingActions : [];
  const showFooter = statusPills.length > 0;
  const [activeIdentityField, setActiveIdentityField] = useState<'label' | 'key' | null>(null);
  const [editingContent, setEditingContent] = useState<'description' | 'hint' | 'both' | null>(null);
  const [editingFieldConfig, setEditingFieldConfig] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState(false);
  const [editingOptions, setEditingOptions] = useState(false);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(label || itemKey);
  const [activeInlineSummary, setActiveInlineSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label || itemKey);
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setEditingContent(null);
      setEditingFieldConfig(false);
      setEditingBehavior(false);
      setEditingOptions(false);
      setActiveInlineSummary(null);
      return;
    }
    if (isField) {
      setEditingFieldConfig(true);
    }
  }, [selected]);

  const itemLabel = label || itemKey;
  const isChoiceField = item?.type === 'field' && ['choice', 'multiChoice', 'select', 'select1'].includes(String(item.dataType ?? ''));
  const isDecimalLike = item?.type === 'field' && ['decimal', 'money'].includes(String(item.dataType ?? ''));
  const choiceOptions = Array.isArray(item?.options ?? item?.choices)
    ? ((item?.options ?? item?.choices) as Array<{ value: string; label: string }>)
    : [];

  const moveCardFocus = (direction: 1 | -1, currentButton: HTMLButtonElement) => {
    const surface = currentButton.closest<HTMLElement>('[data-testid="definition-tree-surface"]');
    if (!surface) return;
    const selectors = Array.from(
      surface.querySelectorAll<HTMLButtonElement>('[data-testid$="-select"]'),
    );
    const currentIndex = selectors.indexOf(currentButton);
    if (currentIndex === -1) return;
    const nextButton = selectors[currentIndex + direction];
    nextButton?.focus();
  };
  const prePopulateValue = item?.type === 'field' && item.prePopulate && typeof item.prePopulate === 'object'
    ? item.prePopulate
    : null;
  const hiddenSummaryLabels = new Set<string>([
    ...(editingOptions ? ['Options'] : []),
  ]);
  const contentSummaryMap = new Map(
    summaries
      .filter((entry) => entry.label === 'Description' || entry.label === 'Hint')
      .map((entry) => [entry.label, entry.value]),
  );
  const allContentEntries: SummaryEntry[] = [
    { label: 'Description', value: contentSummaryMap.get('Description') ?? '' },
    { label: 'Hint', value: contentSummaryMap.get('Hint') ?? '' },
  ];
  // When unselected, hide empty Description/Hint rows to reduce visual noise
  const contentEntries = selected
    ? allContentEntries
    : allContentEntries.filter((entry) => entry.value.trim().length > 0);
  const supportingText = [
    ...contentEntries,
    ...summaries.filter((entry) => entry.label !== 'Description' && entry.label !== 'Hint' && !hiddenSummaryLabels.has(entry.label)),
  ];
  const resetEditors = () => {
    setActiveIdentityField(null);
    setEditingContent(null);
    setEditingFieldConfig(false);
    setEditingBehavior(false);
    setEditingOptions(false);
    setActiveInlineSummary(null);
  };

  const openIdentityField = (field: 'label' | 'key') => {
    resetEditors();
    setActiveIdentityField(field);
  };

  const openEditorForSummary = (label: string) => {
    setActiveIdentityField(null);
    if (label === 'Description' || label === 'Hint') {
      setActiveInlineSummary(label);
      setEditingContent(label === 'Description' ? 'description' : 'hint');
      setEditingFieldConfig(false);
      setEditingBehavior(false);
      setEditingOptions(false);
      return;
    }
    if (label === 'Options') {
      closeOtherEditors('options');
      return;
    }
    if (label === 'Calculate' || label === 'Relevant' || label === 'Readonly' || label === 'Required' || label === 'Constraint' || label === 'Message') {
      setActiveInlineSummary(label);
      setEditingContent(null);
      setEditingFieldConfig(false);
      setEditingBehavior(true);
      setEditingOptions(false);
      return;
    }
    setActiveInlineSummary(label);
    setEditingFieldConfig(true);
  };

  const closeOtherEditors = (kind: 'content' | 'config' | 'behavior' | 'options') => {
    setActiveIdentityField(null);
    setEditingContent(kind === 'content' ? 'both' : null);
    setEditingFieldConfig(kind === 'config');
    setEditingBehavior(kind === 'behavior');
    setEditingOptions(kind === 'options');
    if (kind !== 'content' && kind !== 'config') {
      setActiveInlineSummary(null);
    }
  };

  const commitIdentityField = (field: 'label' | 'key') => {
    if (!onRenameIdentity) {
      setActiveIdentityField(null);
      return;
    }
    const nextKey = field === 'key' ? draftKey.trim() || itemKey : itemKey;
    const nextLabel = field === 'label' ? draftLabel.trim() || itemKey : itemLabel;
    onRenameIdentity(nextKey, nextLabel);
    setActiveIdentityField(null);
  };

  const cancelIdentityField = () => {
    setDraftKey(itemKey);
    setDraftLabel(itemLabel);
    setActiveIdentityField(null);
  };

  const handleIdentityKeyDown = (field: 'label' | 'key') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitIdentityField(field);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelIdentityField();
    }
  };

  const closeInlineSummary = () => {
    setActiveInlineSummary(null);
    setEditingContent(null);
    setEditingFieldConfig(Boolean(selected && isField));
    setEditingBehavior(false);
  };

  const summaryInputClassName = 'mt-1 w-full rounded-[6px] border border-border/70 bg-bg-default/80 px-2.5 py-2 text-[14px] leading-5 text-ink outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25';
  const lowerEditorInputClassName = 'mt-1 w-full appearance-none border-0 border-b border-border/75 bg-transparent px-0 pb-2 pt-2 text-[14px] text-ink outline-none transition-colors placeholder:text-muted [color-scheme:light] focus:border-accent focus-visible:ring-0 dark:[color-scheme:dark]';
  const lowerEditorInputStyle =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? {
          colorScheme: 'dark' as const,
          backgroundColor: 'transparent',
          color: 'rgb(238, 241, 247)',
          WebkitTextFillColor: 'rgb(238, 241, 247)',
        }
      : {
          colorScheme: 'light' as const,
        };

  const summaryInputLabel = (label: string): string => {
    switch (label) {
      case 'Description': return 'Inline description';
      case 'Hint': return 'Inline hint';
      case 'Initial': return 'Inline initial value';
      case 'Currency': return 'Inline currency';
      case 'Precision': return 'Inline precision';
      case 'Prefix': return 'Inline prefix';
      case 'Suffix': return 'Inline suffix';
      case 'Semantic': return 'Inline semantic';
      case 'Pre-fill': return 'Inline pre-fill';
      case 'Calculate': return 'Inline calculate';
      case 'Relevant': return 'Inline relevant';
      case 'Readonly': return 'Inline readonly';
      case 'Required': return 'Inline required';
      case 'Constraint': return 'Inline constraint';
      case 'Message': return 'Inline message';
      default: return `Inline ${label.toLowerCase()}`;
    }
  };

  const summaryInputType = (label: string): 'text' | 'number' => (
    label === 'Precision' ? 'number' : 'text'
  );

  const summaryInputValue = (label: string): string => {
    switch (label) {
      case 'Description': return typeof item?.description === 'string' ? item.description : '';
      case 'Hint': return typeof item?.hint === 'string' ? item.hint : '';
      case 'Initial': return item?.initialValue != null ? String(item.initialValue) : '';
      case 'Currency': return typeof item?.currency === 'string' ? item.currency : '';
      case 'Precision': return typeof item?.precision === 'number' ? String(item.precision) : '';
      case 'Prefix': return typeof item?.prefix === 'string' ? item.prefix : '';
      case 'Suffix': return typeof item?.suffix === 'string' ? item.suffix : '';
      case 'Semantic': return typeof item?.semanticType === 'string' ? item.semanticType : '';
      case 'Pre-fill': {
        const instance = typeof prePopulateValue?.instance === 'string' ? prePopulateValue.instance.trim() : '';
        const path = typeof prePopulateValue?.path === 'string' ? prePopulateValue.path.trim() : '';
        return [instance, path].filter(Boolean).join('.');
      }
      case 'Calculate': return binds.calculate ?? '';
      case 'Relevant': return binds.relevant ?? '';
      case 'Readonly': return binds.readonly ?? '';
      case 'Required': return binds.required ?? '';
      case 'Constraint': return binds.constraint ?? '';
      case 'Message': return binds.constraintMessage ?? '';
      default: return '';
    }
  };

  const updateSummaryValue = (label: string, rawValue: string) => {
    switch (label) {
      case 'Description':
        onUpdateItem?.({ description: rawValue || null });
        return;
      case 'Hint':
        onUpdateItem?.({ hint: rawValue || null });
        return;
      case 'Initial':
        onUpdateItem?.({ initialValue: rawValue || null });
        return;
      case 'Currency':
        onUpdateItem?.({ currency: rawValue || null });
        return;
      case 'Precision':
        onUpdateItem?.({ precision: rawValue === '' ? null : Number(rawValue) });
        return;
      case 'Prefix':
        onUpdateItem?.({ prefix: rawValue || null });
        return;
      case 'Suffix':
        onUpdateItem?.({ suffix: rawValue || null });
        return;
      case 'Semantic':
        onUpdateItem?.({ semanticType: rawValue || null });
        return;
      case 'Pre-fill': {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          onUpdateItem?.({ prePopulate: null });
          return;
        }
        const [instance, ...pathParts] = trimmed.split('.');
        onUpdateItem?.({
          prePopulate: {
            ...(prePopulateValue ?? {}),
            instance: instance ?? '',
            path: pathParts.join('.'),
          },
        });
        return;
      }
      case 'Calculate':
        onUpdateItem?.({ calculate: rawValue || null });
        return;
      case 'Relevant':
        onUpdateItem?.({ relevant: rawValue || null });
        return;
      case 'Readonly':
        onUpdateItem?.({ readonly: rawValue || null });
        return;
      case 'Required':
        onUpdateItem?.({ required: rawValue || null });
        return;
      case 'Constraint':
        onUpdateItem?.({ constraint: rawValue || null });
        return;
      case 'Message':
        onUpdateItem?.({ constraintMessage: rawValue || null });
        return;
    }
  };

  const content = (
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
          {activeIdentityField === 'label' ? (
            <input
              aria-label="Inline label"
              type="text"
              autoFocus
              value={draftLabel}
              className="w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[17px] font-semibold leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-[18px]"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraftLabel(event.currentTarget.value)}
              onBlur={() => commitIdentityField('label')}
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
                    openIdentityField('label');
                  }}
                >
                  <span className="truncate text-ink">{itemLabel}</span>
                  {selected ? <EditMark testId={`${testId}-label-edit`} /> : null}
                </span>
                {isField && dataType && (
                  <span className={`font-mono text-[12px] tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}>
                    {dataType}
                  </span>
                )}
                {!isField && widgetHint && (
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
                    onChange={(event) => setDraftKey(event.currentTarget.value)}
                    onBlur={() => commitIdentityField('key')}
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
                        openIdentityField('key');
                      }}
                    >
                      {itemKey}
                      {selected ? <EditMark testId={`${testId}-key-edit`} /> : null}
                    </span>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <dl
        data-testid={`${testId}-summary`}
        className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {supportingText.map((entry) => (
          <div key={entry.label} className="min-w-0 border-l border-border/65 pl-3">
            <dt className="font-mono text-[11px] tracking-[0.14em] text-ink/62">{entry.label}</dt>
            {activeInlineSummary === entry.label && entry.label !== 'Options' ? (
              <input
                aria-label={summaryInputLabel(entry.label)}
                type={summaryInputType(entry.label)}
                autoFocus
                className={summaryInputClassName}
                value={summaryInputValue(entry.label)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateSummaryValue(entry.label, event.currentTarget.value)}
                onBlur={closeInlineSummary}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') closeInlineSummary();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeInlineSummary();
                  }
                }}
              />
            ) : editingOptions && entry.label === 'Options' ? (
              <button
                type="button"
                aria-label={`Edit options for ${itemLabel}`}
                className="mt-1 inline-flex rounded-full border border-border/90 px-2.5 py-1 text-[12px] font-medium text-ink/75 transition-colors hover:border-accent/40 hover:text-ink"
                onClick={(event) => event.stopPropagation()}
              >
                Editing options below
              </button>
            ) : (
              <dd
                className={`group mt-1 inline-flex max-w-full items-center truncate text-[14px] font-medium leading-5 text-ink/94 md:text-[15px] ${selected ? 'cursor-text' : ''}`}
                onClick={(event) => {
                  if (!selected) return;
                  event.stopPropagation();
                  openEditorForSummary(entry.label);
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
    </div>
  );

  return (
    <div
      data-testid={testId}
      data-editor-path={itemPath}
      className={[
        'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
        selected
          ? 'border-accent/30 bg-accent/[0.05] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
          : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
      ].join(' ')}
      style={{ paddingLeft: depth * 20 + 14 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start gap-3">
        <DragHandle ref={dragHandleRef} label={`Reorder ${itemLabel}`} className="h-11" />
        {activeIdentityField ? (
          <div className="w-full rounded-[10px]">
            {content}
          </div>
        ) : (
          <button
            type="button"
            data-testid={`${testId}-select`}
            aria-label={`Select ${itemLabel}`}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 rounded-[10px]"
            onClick={onClick}
            onContextMenu={onContextMenu}
            onKeyDown={(event) => {
              if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              moveCardFocus(event.shiftKey ? -1 : 1, event.currentTarget);
            }}
          >
            {content}
          </button>
        )}
      </div>

      {showFooter && (
        <div
          data-testid={`${testId}-status`}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          {statusPills.map((pill) => (
            <Pill key={`${itemPath}-${pill.text}`} text={pill.text} color={pill.color} size="sm" />
          ))}
        </div>
      )}

      {((editingFieldConfig && !activeInlineSummary) || editingBehavior || editingOptions) && (
        <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
          {editingFieldConfig && item?.type === 'field' && (
            <section data-testid={`${testId}-lower-editor`} aria-label="Field details" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                  Field details
                </h3>
                {statusPills.length > 0 && (
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink/60">
                    Inline configuration
                  </span>
                )}
              </div>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Initial value
                <input
                  aria-label="Inline initial value"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={item.initialValue != null ? String(item.initialValue) : ''}
                  placeholder="= for FEL"
                  onChange={(event) => onUpdateItem?.({ initialValue: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Prefix
                <input
                  aria-label="Inline prefix"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={typeof item.prefix === 'string' ? item.prefix : ''}
                  onChange={(event) => onUpdateItem?.({ prefix: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Suffix
                <input
                  aria-label="Inline suffix"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={typeof item.suffix === 'string' ? item.suffix : ''}
                  onChange={(event) => onUpdateItem?.({ suffix: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Semantic type
                <input
                  aria-label="Inline semantic type"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={typeof item.semanticType === 'string' ? item.semanticType : ''}
                  onChange={(event) => onUpdateItem?.({ semanticType: event.currentTarget.value || null })}
                />
              </label>
              {isDecimalLike && (
                <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                  Precision
                  <input
                    aria-label="Inline precision"
                    type="number"
                    className={lowerEditorInputClassName}
                    style={lowerEditorInputStyle}
                    value={typeof item.precision === 'number' ? item.precision : ''}
                    onChange={(event) => onUpdateItem?.({ precision: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) })}
                  />
                </label>
              )}
              {String(item.dataType ?? '') === 'money' && (
                <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                  Currency
                  <input
                    aria-label="Inline currency"
                    type="text"
                    className={lowerEditorInputClassName}
                    style={lowerEditorInputStyle}
                    value={typeof item.currency === 'string' ? item.currency : ''}
                    maxLength={3}
                    onChange={(event) => onUpdateItem?.({ currency: event.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '') || null })}
                  />
                </label>
              )}
              </div>

              {prePopulateValue ? (
                <div className="grid gap-x-6 gap-y-4 border-t border-border/65 pt-4 sm:grid-cols-2">
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                    Instance
                    <input
                      aria-label="Inline pre-populate instance"
                      type="text"
                      className={`${lowerEditorInputClassName} font-mono`}
                      style={lowerEditorInputStyle}
                      value={typeof prePopulateValue.instance === 'string' ? prePopulateValue.instance : ''}
                      onChange={(event) => onUpdateItem?.({
                        prePopulate: {
                          ...prePopulateValue,
                          instance: event.currentTarget.value,
                        },
                      })}
                    />
                  </label>
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                    Path
                    <input
                      aria-label="Inline pre-populate path"
                      type="text"
                      className={`${lowerEditorInputClassName} font-mono`}
                      style={lowerEditorInputStyle}
                      value={typeof prePopulateValue.path === 'string' ? prePopulateValue.path : ''}
                      onChange={(event) => onUpdateItem?.({
                        prePopulate: {
                          ...prePopulateValue,
                          path: event.currentTarget.value,
                        },
                      })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <input
                      aria-label="Inline pre-populate editable"
                      type="checkbox"
                      checked={prePopulateValue.editable !== false}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onUpdateItem?.({
                        prePopulate: {
                          ...prePopulateValue,
                          editable: event.currentTarget.checked,
                        },
                      })}
                    />
                    Editable by user
                  </label>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      aria-label={`Remove pre-populate from ${itemLabel}`}
                      className="inline-flex items-center rounded-full border border-border/90 px-2.5 py-1 text-[12px] font-medium text-ink/75 transition-colors hover:border-error/40 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateItem?.({ prePopulate: null });
                      }}
                    >
                      Remove pre-populate
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Add pre-populate to ${itemLabel}`}
                  className="inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpdateItem?.({
                      prePopulate: { instance: '', path: '', editable: true },
                    });
                  }}
                >
                  + Add pre-populate
                </button>
              )}

              {!editingBehavior && visibleMissingActions.some((action) => action.key === 'behavior') && (
                <button
                  type="button"
                  aria-label={`Add behavior to ${itemLabel}`}
                  className="inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeOtherEditors('behavior');
                  }}
                >
                  + Add behavior
                </button>
              )}
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
                  aria-label="Required behavior"
                  type="checkbox"
                  checked={Boolean(binds.required)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ required: event.currentTarget.checked ? 'true' : null })}
                />
                Required
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Relevant
                <input
                  aria-label="Relevant behavior"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={binds.relevant ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ relevant: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Readonly
                <input
                  aria-label="Readonly behavior"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={binds.readonly ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ readonly: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Calculate
                <input
                  aria-label="Calculate behavior"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={binds.calculate ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ calculate: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Constraint
                <input
                  aria-label="Constraint behavior"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={binds.constraint ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ constraint: event.currentTarget.value || null })}
                />
              </label>
              <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                Constraint message
                <input
                  aria-label="Constraint message behavior"
                  type="text"
                  className={lowerEditorInputClassName}
                  style={lowerEditorInputStyle}
                  value={binds.constraintMessage ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateItem?.({ constraintMessage: event.currentTarget.value || null })}
                />
              </label>
              </div>
            </section>
          )}

          {editingOptions && isChoiceField && (
            <section aria-label="Options" className="space-y-3 border-t border-border/65 pt-4 first:border-t-0 first:pt-0">
              <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                Options
              </h3>
              {choiceOptions.map((option, index) => (
                <div key={`${option.value}-${index}`} className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] sm:items-end">
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                    Option {index + 1} value
                    <input
                      aria-label={`Inline option ${index + 1} value`}
                      type="text"
                      className={lowerEditorInputClassName}
                      style={lowerEditorInputStyle}
                      value={option.value}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = choiceOptions.map((entry, optionIndex) => optionIndex === index ? { ...entry, value: event.currentTarget.value } : entry);
                        onUpdateItem?.({ options: next });
                      }}
                    />
                  </label>
                  <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                    Option {index + 1} label
                    <input
                      aria-label={`Inline option ${index + 1} label`}
                      type="text"
                      className={lowerEditorInputClassName}
                      style={lowerEditorInputStyle}
                      value={option.label}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = choiceOptions.map((entry, optionIndex) => optionIndex === index ? { ...entry, label: event.currentTarget.value } : entry);
                        onUpdateItem?.({ options: next });
                      }}
                    />
                  </label>
                  <div className="flex items-center justify-end sm:pb-1">
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1} from ${itemLabel}`}
                      className="inline-flex items-center rounded-full border border-border/90 px-2.5 py-1 text-[12px] font-medium text-ink/75 transition-colors hover:border-error/40 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateItem?.({
                          options: choiceOptions.filter((_, optionIndex) => optionIndex !== index),
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                aria-label={`Add option to ${itemLabel}`}
                className="inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateItem?.({ options: [...choiceOptions, { value: '', label: '' }] });
                }}
              >
                + Add option
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
