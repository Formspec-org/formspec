/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { useEffect, useRef, useState, type FocusEventHandler, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { Pill } from '../../components/ui/Pill';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { DragHandle } from '../../components/ui/DragHandle';
import {
  dataTypeInfo,
  formatCommaSeparatedKeywords,
  parseCommaSeparatedKeywords,
} from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import {
  buildFieldDetailLaunchers,
  computeOrphanFieldDetailLabel,
  fieldDetailOrphanHeading,
} from './item-row-field-detail';
import { formatPrePopulateCombined, parsePrePopulateCombined } from './pre-populate-combined';

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

/** Dashed outline for “add” actions in the expanded editor (field-detail launchers, behavior, options). */
const EDITOR_DASH_BUTTON =
  'inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35';

function PreFillSourceHint() {
  return (
    <p className="mt-1 text-[11px] leading-snug text-ink/50">
      <span className="font-mono text-ink/65">$</span> = form fields; <span className="font-mono text-ink/65">@</span> = context (e.g.{' '}
      <span className="font-mono text-ink/65">@instance(&apos;name&apos;).field</span>). Shorthand:{' '}
      <span className="font-mono text-ink/65">@name.field</span> — leading <span className="font-mono text-ink/65">$</span> is fine too.
    </p>
  );
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
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));
  const [activeInlineSummary, setActiveInlineSummary] = useState<string | null>(null);
  /** Keeps literal `@` / `$` while editing; definition only stores instance + path. */
  const [preFillSourceDraft, setPreFillSourceDraft] = useState<string | null>(null);
  const wasEditingPreFillRef = useRef(false);
  /**
   * When true, Pre-fill is being added from the field-detail launcher only (lower panel).
   * We intentionally do not set activeInlineSummary to 'Pre-fill' so the summary strip does not
   * mount a second input with autoFocus (which steals focus on the first keystroke).
   */
  const [preFillLowerSession, setPreFillLowerSession] = useState(false);

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setEditingContent(null);
      setEditingFieldConfig(false);
      setEditingBehavior(false);
      setEditingOptions(false);
      setPreFillLowerSession(false);
      setActiveInlineSummary(null);
      return;
    }
    if (isField) {
      setEditingFieldConfig(true);
    } else {
      setEditingFieldConfig(false);
    }
  }, [selected, isField]);

  const itemLabel = label || itemKey;
  const labelForDescription =
    isField && label?.trim() && label.trim() !== itemKey ? label.trim() : null;
  const isChoiceField = item?.type === 'field' && ['choice', 'multiChoice', 'select', 'select1'].includes(String(item.dataType ?? ''));
  const isDecimalLike = item?.type === 'field' && ['decimal', 'money'].includes(String(item.dataType ?? ''));
  type ChoiceOptionRow = { value: string; label: string; keywords?: string[] };
  const choiceOptions = Array.isArray(item?.options ?? item?.choices)
    ? ((item?.options ?? item?.choices) as ChoiceOptionRow[])
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
    setPreFillSourceDraft(null);
    setPreFillLowerSession(false);
    setActiveInlineSummary(null);
  };

  const openIdentityField = (field: 'label' | 'key') => {
    resetEditors();
    if (field === 'key') setDraftKey(itemKey);
    if (field === 'label') setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(field);
  };

  const openEditorForSummary = (label: string, opts?: { preFillFromLauncher?: boolean }) => {
    setActiveIdentityField(null);
    if (label === 'Description' || label === 'Hint') {
      setPreFillLowerSession(false);
      setActiveInlineSummary(label);
      setEditingContent(label === 'Description' ? 'description' : 'hint');
      setEditingFieldConfig(isField);
      setEditingBehavior(false);
      setEditingOptions(false);
      return;
    }
    if (label === 'Options') {
      setPreFillLowerSession(false);
      closeOtherEditors('options');
      return;
    }
    if (label === 'Calculate' || label === 'Relevant' || label === 'Readonly' || label === 'Required' || label === 'Constraint' || label === 'Message') {
      setPreFillLowerSession(false);
      setActiveInlineSummary(label);
      setEditingContent(null);
      setEditingFieldConfig(false);
      setEditingBehavior(true);
      setEditingOptions(false);
      return;
    }
    if (label === 'Pre-fill' && opts?.preFillFromLauncher) {
      setPreFillLowerSession(true);
      setActiveInlineSummary(null);
      setEditingFieldConfig(true);
      return;
    }
    if (label === 'Pre-fill') {
      setPreFillLowerSession(false);
      setActiveInlineSummary('Pre-fill');
      setEditingFieldConfig(true);
      return;
    }
    setPreFillLowerSession(false);
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
      setPreFillLowerSession(false);
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
    setDraftLabel(label?.trim() ? label.trim() : '');
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
    setPreFillSourceDraft(null);
    setPreFillLowerSession(false);
    setActiveInlineSummary(null);
    setEditingContent(null);
    setEditingFieldConfig(Boolean(selected && isField));
    setEditingBehavior(false);
  };

  const editingDisplayContent =
    itemType === 'display' &&
    (activeInlineSummary === 'Description' || activeInlineSummary === 'Hint');

  const showLowerPanel =
    (editingFieldConfig && item?.type === 'field') ||
    editingBehavior ||
    editingOptions ||
    editingDisplayContent ||
    preFillLowerSession;

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
      case 'Pre-fill':
        return formatPrePopulateCombined(prePopulateValue?.instance, prePopulateValue?.path);
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
        const parsed = parsePrePopulateCombined(rawValue);
        if (!parsed.instance.trim() && !parsed.path.trim()) {
          onUpdateItem?.({ prePopulate: null });
          return;
        }
        onUpdateItem?.({
          prePopulate: {
            ...(prePopulateValue ?? {}),
            instance: parsed.instance,
            path: parsed.path,
            editable: prePopulateValue?.editable !== false,
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

  const fieldDetailLaunchers = buildFieldDetailLaunchers({
    item,
    testIdPrefix: testId,
    activeInlineSummary,
    isDecimalLike,
  });

  const orphanFieldDetailLabel = computeOrphanFieldDetailLabel(activeInlineSummary, supportingText);
  const orphanUiLabel = orphanFieldDetailLabel ?? (preFillLowerSession ? 'Pre-fill' : null);
  const editingPreFill =
    activeInlineSummary === 'Pre-fill' || orphanFieldDetailLabel === 'Pre-fill' || preFillLowerSession;

  useEffect(() => {
    const entered = editingPreFill && !wasEditingPreFillRef.current;
    if (entered) {
      setPreFillSourceDraft(formatPrePopulateCombined(prePopulateValue?.instance, prePopulateValue?.path));
    }
    if (!editingPreFill) {
      setPreFillSourceDraft(null);
    }
    wasEditingPreFillRef.current = editingPreFill;
  }, [editingPreFill, prePopulateValue]);

  const preFillSourceInputValue =
    preFillSourceDraft ?? formatPrePopulateCombined(prePopulateValue?.instance, prePopulateValue?.path);

  /**
   * Dismiss orphan field-detail input only when focus truly leaves the lower editor
   * (not when switching launchers). Deferred one tick so launcher clicks can update state first.
   */
  const handleOrphanFieldDetailBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    const next = event.relatedTarget;
    const shell = event.currentTarget.closest(`[data-testid="${testId}-lower-editor"]`);
    if (next instanceof Node && shell?.contains(next)) {
      return;
    }
    const blurredLabel = orphanFieldDetailLabel ?? (preFillLowerSession ? 'Pre-fill' : null);
    if (!blurredLabel) return;

    queueMicrotask(() => {
      const tryDismiss = () => {
        const ae = document.activeElement;
        if (ae instanceof Node && shell?.contains(ae)) {
          return;
        }
        const hadPreFillLower = Boolean(preFillLowerSession && blurredLabel === 'Pre-fill');
        let clearedMatchingSummary = false;
        flushSync(() => {
          setPreFillLowerSession((s) => (blurredLabel === 'Pre-fill' ? false : s));
          setActiveInlineSummary((current) => {
            if (blurredLabel && current === blurredLabel) {
              clearedMatchingSummary = true;
              return null;
            }
            return current;
          });
        });
        if (hadPreFillLower || clearedMatchingSummary) {
          if (blurredLabel === 'Pre-fill') {
            setPreFillSourceDraft(null);
          }
          setEditingContent(null);
          setEditingFieldConfig(Boolean(selected && isField));
          setEditingBehavior(false);
        }
      };
      // Blur may report no relatedTarget; focus moves on the next task (e.g. checkbox in field details).
      setTimeout(tryDismiss, 0);
    });
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
                  onChange={(event) => setDraftKey(event.currentTarget.value)}
                  onBlur={() => commitIdentityField('key')}
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
                      openIdentityField('key');
                    }}
                  >
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
                      onChange={(event) => setDraftLabel(event.currentTarget.value)}
                      onBlur={() => commitIdentityField('label')}
                      onKeyDown={handleIdentityKeyDown('label')}
                    />
                  ) : (
                    <div
                      className={`text-[14px] font-normal leading-snug tracking-normal text-ink/72 md:text-[15px] ${selected ? 'group inline-flex cursor-text flex-wrap items-center gap-x-1' : ''}`}
                      onClick={(event) => {
                        if (!selected) return;
                        event.stopPropagation();
                        openIdentityField('label');
                      }}
                    >
                      <span className={labelForDescription ? '' : 'italic text-ink/50'}>
                        {labelForDescription ?? 'Add a display label…'}
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
              entry.label === 'Pre-fill' ? (
                <>
                  <PreFillSourceHint />
                  <input
                    aria-label={summaryInputLabel(entry.label)}
                    type={summaryInputType(entry.label)}
                    autoFocus
                    className={`${summaryInputClassName} font-mono`}
                    value={preFillSourceInputValue}
                    placeholder="@priorYear.totalIncome"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const v = event.currentTarget.value;
                      setPreFillSourceDraft(v);
                      updateSummaryValue(entry.label, v);
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
                </>
              ) : (
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
              )
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

      {showLowerPanel && (
        <div
          className="mt-4 space-y-4 border-t border-border/70 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          {editingFieldConfig && item?.type === 'field' && (
            <section data-testid={`${testId}-lower-editor`} aria-label="Field details" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                    Field details
                  </h3>
                  <p className="mt-1 text-[11px] leading-snug text-ink/50">
                    Add a setting to open an editor here, or edit existing values in the summary row above.
                  </p>
                </div>
                {statusPills.length > 0 && (
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink/60">
                    Inline configuration
                  </span>
                )}
              </div>

              {orphanUiLabel ? (
                <div
                  data-testid={`${testId}-orphan-field-detail`}
                  className="rounded-[10px] border border-border/70 bg-bg-default/55 px-3 py-3"
                >
                  <div className="text-[12px] font-semibold tracking-[0.02em] text-ink/88">
                    {fieldDetailOrphanHeading(orphanUiLabel)}
                  </div>
                  {orphanUiLabel === 'Pre-fill' ? (
                    <>
                      <PreFillSourceHint />
                      <input
                        aria-label={summaryInputLabel('Pre-fill')}
                        type="text"
                        autoFocus
                        className={`${summaryInputClassName} font-mono`}
                        value={preFillSourceInputValue}
                        placeholder="@priorYear.totalIncome"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const v = event.currentTarget.value;
                          setPreFillSourceDraft(v);
                          updateSummaryValue('Pre-fill', v);
                        }}
                        onBlur={handleOrphanFieldDetailBlur}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') closeInlineSummary();
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            closeInlineSummary();
                          }
                        }}
                      />
                    </>
                  ) : (
                    <input
                      aria-label={summaryInputLabel(orphanUiLabel)}
                      type={summaryInputType(orphanUiLabel)}
                      autoFocus
                      className={summaryInputClassName}
                      value={summaryInputValue(orphanUiLabel)}
                      placeholder={orphanUiLabel === 'Initial' ? 'Literal value; prefix with = for FEL' : undefined}
                      maxLength={orphanUiLabel === 'Currency' ? 3 : undefined}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const v = event.currentTarget.value;
                        const raw = orphanUiLabel === 'Currency'
                          ? v.toUpperCase().replace(/[^A-Z]/g, '')
                          : v;
                        updateSummaryValue(orphanUiLabel, raw);
                      }}
                      onBlur={handleOrphanFieldDetailBlur}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') closeInlineSummary();
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          closeInlineSummary();
                        }
                      }}
                    />
                  )}
                </div>
              ) : null}

              {fieldDetailLaunchers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {fieldDetailLaunchers.map((launch) => (
                    <button
                      key={launch.label}
                      type="button"
                      data-testid={launch.testId}
                      aria-label={`Add ${launch.addLabel} to ${itemLabel}`}
                      className={EDITOR_DASH_BUTTON}
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        if (orphanFieldDetailLabel || preFillLowerSession) event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditorForSummary(
                          launch.label,
                          launch.label === 'Pre-fill' ? { preFillFromLauncher: true } : undefined,
                        );
                      }}
                    >
                      + {launch.addLabel}
                    </button>
                  ))}
                </div>
              ) : null}

              {prePopulateValue ? (
                <div
                  data-testid={`${testId}-pre-populate-extras`}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border/65 pt-4"
                >
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
              ) : null}

              {!editingBehavior && visibleMissingActions.some((action) => action.key === 'behavior') && (
                <button
                  type="button"
                  aria-label={`Add behavior to ${itemLabel}`}
                  className={EDITOR_DASH_BUTTON}
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

          {editingDisplayContent && (
            <section aria-label="Content" className="space-y-3">
              <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">Content</h3>
              <p className="mt-1 text-[11px] leading-snug text-ink/50">
                Edit description and hint in the summary row above.
              </p>
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
                <div key={`inline-opt-${itemPath}-${index}`} className="space-y-2">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] sm:items-end">
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
                          const next = choiceOptions.map((entry, optionIndex) =>
                            optionIndex === index ? { ...entry, value: event.currentTarget.value } : entry,
                          );
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
                          const next = choiceOptions.map((entry, optionIndex) =>
                            optionIndex === index ? { ...entry, label: event.currentTarget.value } : entry,
                          );
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
                  <label className="block text-[13px] font-semibold tracking-[0.01em] text-ink">
                    Option {index + 1} keywords (optional)
                    <input
                      aria-label={`Inline option ${index + 1} search keywords`}
                      type="text"
                      className={lowerEditorInputClassName}
                      style={lowerEditorInputStyle}
                      placeholder="Comma-separated type-ahead"
                      value={formatCommaSeparatedKeywords(option.keywords)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const keywords = parseCommaSeparatedKeywords(event.currentTarget.value);
                        const next = choiceOptions.map((entry, optionIndex) => {
                          if (optionIndex !== index) return entry;
                          const row: ChoiceOptionRow = { ...entry, value: entry.value, label: entry.label };
                          if (keywords) row.keywords = keywords;
                          else delete row.keywords;
                          return row;
                        });
                        onUpdateItem?.({ options: next });
                      }}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                aria-label={`Add option to ${itemLabel}`}
                className={EDITOR_DASH_BUTTON}
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
