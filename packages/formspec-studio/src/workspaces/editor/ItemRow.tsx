/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { useEffect, useMemo, useRef, useState, type FocusEventHandler } from 'react';
import { DragHandle } from '../../components/ui/DragHandle';
import { dataTypeInfo } from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import {
  buildFieldDetailLaunchers,
  computeOrphanFieldDetailLabel,
} from './item-row-field-detail';
import { type SummaryEntry, type StatusPill } from './item-row-shared';
import {
  ItemRowContent,
  type ItemRowIdentity,
  type ItemRowEditState,
  type ItemRowActions,
} from './ItemRowContent';
import {
  ItemRowCategoryPanel,
  type ExpandedSummaryCategory,
} from './ItemRowCategoryPanel';
import { OptionsModal } from '../../components/ui/OptionsModal';

interface ItemRowProps {
  itemKey: string;
  itemPath: string;
  itemType: 'field' | 'display';
  label?: string;
  categorySummaries?: Record<string, string>;
  dataType?: string;
  widgetHint?: string;
  statusPills?: StatusPill[];
  depth: number;
  insideRepeatableGroup?: boolean;
  selected?: boolean;
  isDragSource?: boolean;
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
  categorySummaries,
  dataType,
  widgetHint,
  statusPills = [],
  depth,
  insideRepeatableGroup,
  selected,
  isDragSource,
  dragHandleRef,
  item,
  binds = {},
  onUpdateItem,
  onRenameIdentity,
  onClick,
  onContextMenu,
}: ItemRowProps) {
  // Collapse expanded content while being dragged to avoid layout disruption
  const effectiveSelected = selected && !isDragSource;
  const isField = itemType === 'field';
  const isDisplayItem = itemType === 'display';
  const testId = isField ? `field-${itemKey}` : `display-${itemKey}`;
  const rawPrefix = itemPath.endsWith(`.${itemKey}`)
    ? itemPath.slice(0, -itemKey.length)
    : null;
  const groupPrefix =
    rawPrefix && insideRepeatableGroup
      ? rawPrefix.replace(/\.$/, '[].')
      : rawPrefix;

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const [activeIdentityField, setActiveIdentityField] = useState<
    'label' | 'key' | null
  >(null);
  const [expandedCategory, setExpandedCategory] =
    useState<ExpandedSummaryCategory | null>(null);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(() =>
    label?.trim() ? label.trim() : '',
  );
  const [activeInlineSummary, setActiveInlineSummary] = useState<string | null>(
    null,
  );
  // SI-4: Capture original value when opening inline summary; Escape restores it.
  const [inlineSummaryOriginal, setInlineSummaryOriginal] = useState('');
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  // Track bind type that was just auto-created so InlineExpression can start in edit mode.
  const [justCreatedBind, setJustCreatedBind] = useState<string | null>(null);
  const categoryPanelRef = useRef<HTMLDivElement>(null);
  const prevShowCategoryPanelRef = useRef(false);

  // IE-2: External prop changes (itemKey/label) sync drafts only when not actively editing.
  // Ordering assumption: parent must not change itemKey/label while activeIdentityField is set.
  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  // SM-5: OptionsModal is portaled to document.body — it manages its own close lifecycle.
  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setExpandedCategory(null);
      setActiveInlineSummary(null);
      setJustCreatedBind(null);
    }
  }, [selected]);

  const itemLabel = label || itemKey;
  const labelForDescription =
    isField && label?.trim() && label.trim() !== itemKey ? label.trim() : null;
  const isChoiceField =
    item?.type === 'field' &&
    ['choice', 'multiChoice', 'select', 'select1'].includes(
      String(item.dataType ?? ''),
    );
  const isDecimalLike =
    item?.type === 'field' &&
    ['decimal', 'money'].includes(String(item.dataType ?? ''));

  // SM-6: Suppress edit affordances when handlers are absent.
  const editable = Boolean(onUpdateItem && onRenameIdentity);

  // SM-4: Guard rAF callback against unmounted component.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const selectButtonRef = useRef<HTMLButtonElement>(null);

  // KN-3: Coupled to testId naming convention — select buttons must end with "-select"
  // and the tree surface must have data-testid="definition-tree-surface".
  const moveCardFocus = (
    direction: 1 | -1,
    currentButton: HTMLButtonElement,
  ) => {
    const surface = currentButton.closest<HTMLElement>(
      '[data-testid="definition-tree-surface"]',
    );
    if (!surface) return;
    const selectors = Array.from(
      surface.querySelectorAll<HTMLButtonElement>('[data-testid$="-select"]'),
    );
    const currentIndex = selectors.indexOf(currentButton);
    if (currentIndex === -1) return;
    const nextButton = selectors[currentIndex + direction];
    nextButton?.focus();
  };

  const prePopulateValue =
    item?.type === 'field' &&
    item.prePopulate &&
    typeof item.prePopulate === 'object'
      ? item.prePopulate
      : null;

  const choiceOptions = Array.isArray(
    item?.options ?? (item as Record<string, unknown>)?.choices,
  )
    ? ((item?.options ?? (item as Record<string, unknown>)?.choices) as Array<{
        value: string;
        label: string;
        keywords?: string[];
      }>)
    : [];

  const descriptionValue =
    typeof item?.description === 'string' ? item.description : '';
  const hintValue = typeof item?.hint === 'string' ? item.hint : '';

  const allContentEntries: SummaryEntry[] = [
    { label: 'Description', value: descriptionValue },
    { label: 'Hint', value: hintValue },
  ];
  const supportingText = effectiveSelected
    ? allContentEntries
    : allContentEntries.filter((entry) => entry.value.trim().length > 0);

  const resetEditors = () => {
    setActiveIdentityField(null);
    setExpandedCategory(null);
    setActiveInlineSummary(null);
  };

  const openIdentityField = (field: 'label' | 'key') => {
    resetEditors();
    if (field === 'key') setDraftKey(itemKey);
    if (field === 'label') setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(field);
  };

  const openEditorForSummary = (label: string) => {
    setActiveIdentityField(null);

    // CP-2: Display items only support Visibility/Relevant — early-return for others.
    if (isDisplayItem && label !== 'Visibility' && label !== 'Relevant' && label !== 'Description' && label !== 'Hint') {
      return;
    }

    if (label === 'Description' || label === 'Hint') {
      // SM-1: Close any open category panel before opening inline summary.
      setExpandedCategory(null);
      setInlineSummaryOriginal(summaryInputValue(label));
      setActiveInlineSummary(label);
      return;
    }
    if (label === 'Options') {
      setOptionsModalOpen(true);
      return;
    }
    if (
      label === 'Visibility' ||
      label === 'Validation' ||
      label === 'Value' ||
      label === 'Format'
    ) {
      const nextCategory = label as ExpandedSummaryCategory;
      // Direct cell action: clicking an empty category auto-adds the default behavior.
      // Direct cell action: only auto-add for single-option categories.
      if (isField && onUpdateItem) {
        if (label === 'Visibility' && !binds.relevant?.trim()) {
          onUpdateItem({ relevant: '' });
          setJustCreatedBind('relevant');
        }
      }
      setExpandedCategory((c) =>
        c === nextCategory ? null : nextCategory,
      );
      setActiveInlineSummary(null);
      return;
    }
    if (label === 'Relevant') {
      setExpandedCategory('Visibility');
      setActiveInlineSummary(null);
      return;
    }
    if (label === 'Required' || label === 'Constraint' || label === 'Message') {
      setExpandedCategory('Validation');
      setActiveInlineSummary(null);
      return;
    }
    if (label === 'Calculate' || label === 'Readonly') {
      setExpandedCategory('Value');
      setActiveInlineSummary(null);
      return;
    }
    if (label === 'Pre-fill') {
      setExpandedCategory('Value');
      setActiveInlineSummary(null);
      // SI-1: Pre-fill eagerly creates the prePopulate object (unlike Initial which just opens the panel).
      // This is intentional — the PrePopulateCard needs a non-null value to render its instance/path editors.
      if (!prePopulateValue) {
        onUpdateItem?.({ prePopulate: { instance: '', path: '' } });
      }
      return;
    }
    // SI-2: Don't eagerly write initialValue — just open the Value panel.
    if (label === 'Initial') {
      setExpandedCategory('Value');
      setActiveInlineSummary(null);
      return;
    }
    // SI-3: Warn on unrecognized summary labels in development.
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ItemRow] Unhandled summary label: "${label}"`);
    }
    setExpandedCategory('Format');
    setActiveInlineSummary(label);
  };

  const commitIdentityField = (field: 'label' | 'key') => {
    if (!onRenameIdentity) {
      setActiveIdentityField(null);
      // IE-5: Return focus to the select button after commit.
      queueMicrotask(() => selectButtonRef.current?.focus());
      return;
    }
    // IE-1: If trimmed value is empty, cancel instead of silently reverting.
    if (field === 'key' && !draftKey.trim()) {
      cancelIdentityField();
      return;
    }
    if (field === 'label' && !draftLabel.trim()) {
      // IE-4: Display items allow empty labels (they render as blank content).
      if (isField) {
        cancelIdentityField();
        return;
      }
    }
    const nextKey = field === 'key' ? draftKey.trim() || itemKey : itemKey;
    // IE-4: Display items keep empty labels as-is; fields fall back to itemKey.
    const nextLabel =
      field === 'label'
        ? (isField ? (draftLabel.trim() || itemKey) : draftLabel.trim())
        : itemLabel;
    onRenameIdentity(nextKey, nextLabel);
    setActiveIdentityField(null);
    // IE-5: Return focus to the select button after commit.
    queueMicrotask(() => selectButtonRef.current?.focus());
  };

  const cancelIdentityField = () => {
    setDraftKey(itemKey);
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
    // IE-5: Return focus to the select button after cancel.
    queueMicrotask(() => selectButtonRef.current?.focus());
  };

  const closeInlineSummary = () => {
    setActiveInlineSummary(null);
  };

  // SI-4: Escape in inline summary reverts to value captured on open.
  // Defined as a plain function (not useCallback) because it captures updateSummaryValue
  // which is redefined each render.
  const cancelInlineSummary = () => {
    if (activeInlineSummary) {
      updateSummaryValue(activeInlineSummary, inlineSummaryOriginal);
    }
    setActiveInlineSummary(null);
  };

  const showCategoryPanel =
    effectiveSelected &&
    expandedCategory !== null &&
    ((isField && item?.type === 'field') ||
      (isDisplayItem && expandedCategory === 'Visibility'));

  // CP-1: Focus panel when category changes (not just on first open).
  const prevExpandedCategoryRef = useRef<ExpandedSummaryCategory | null>(null);
  useEffect(() => {
    const prev = prevExpandedCategoryRef.current;
    prevExpandedCategoryRef.current = expandedCategory;
    prevShowCategoryPanelRef.current = Boolean(showCategoryPanel);
    // Skip panel focus when a bind was just created — the FELEditor should keep focus.
    if (showCategoryPanel && expandedCategory !== prev && effectiveSelected && !justCreatedBind) {
      categoryPanelRef.current?.focus();
    }
  }, [showCategoryPanel, expandedCategory, selected]);

  const summaryInputValue = (label: string): string => {
    switch (label) {
      case 'Description':
        return descriptionValue;
      case 'Hint':
        return hintValue;
      case 'Initial':
        return item?.initialValue != null ? String(item.initialValue) : '';
      case 'Currency':
        return typeof item?.currency === 'string' ? item.currency : '';
      case 'Precision':
        return typeof item?.precision === 'number'
          ? String(item.precision)
          : '';
      case 'Prefix':
        return typeof item?.prefix === 'string' ? item.prefix : '';
      case 'Suffix':
        return typeof item?.suffix === 'string' ? item.suffix : '';
      case 'Semantic':
        return typeof item?.semanticType === 'string' ? item.semanticType : '';
      case 'Calculate':
        return binds.calculate ?? '';
      case 'Relevant':
        return binds.relevant ?? '';
      case 'Readonly':
        return binds.readonly ?? '';
      case 'Required':
        return binds.required ?? '';
      case 'Constraint':
        return binds.constraint ?? '';
      case 'Message':
        return binds.constraintMessage ?? '';
      default:
        return '';
    }
  };

  // SI-5: Debounce Description/Hint writes to reduce intermediate undo states.
  const summaryWriteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(summaryWriteTimerRef.current), []);

  const updateSummaryValue = (label: string, rawValue: string) => {
    // DI-2 contract: onUpdateItem accepts flat bind property names
    // (calculate, relevant, readonly, required, constraint, constraintMessage) as top-level keys.
    const dispatch = (changes: Record<string, unknown>) => {
      clearTimeout(summaryWriteTimerRef.current);
      // SI-5: Debounce non-FEL inline text fields.
      if (label === 'Description' || label === 'Hint') {
        summaryWriteTimerRef.current = setTimeout(() => onUpdateItem?.(changes), 300);
      } else {
        onUpdateItem?.(changes);
      }
    };
    switch (label) {
      case 'Description':
        dispatch({ description: rawValue || null });
        return;
      case 'Hint':
        dispatch({ hint: rawValue || null });
        return;
      case 'Initial':
        dispatch({ initialValue: rawValue || null });
        return;
      case 'Currency':
        dispatch({ currency: rawValue || null });
        return;
      case 'Precision':
        dispatch({
          precision: rawValue === '' ? null : Number(rawValue),
        });
        return;
      case 'Prefix':
        dispatch({ prefix: rawValue || null });
        return;
      case 'Suffix':
        dispatch({ suffix: rawValue || null });
        return;
      case 'Semantic':
        dispatch({ semanticType: rawValue || null });
        return;
      case 'Calculate':
        dispatch({ calculate: rawValue || null });
        return;
      case 'Relevant':
        dispatch({ relevant: rawValue || null });
        return;
      case 'Readonly':
        dispatch({ readonly: rawValue || null });
        return;
      case 'Required':
        dispatch({ required: rawValue || null });
        return;
      case 'Constraint':
        dispatch({ constraint: rawValue || null });
        return;
      case 'Message':
        dispatch({ constraintMessage: rawValue || null });
        return;
    }
  };

  // DI-3: Memoize field detail launchers.
  const fieldDetailLaunchers = useMemo(
    () => buildFieldDetailLaunchers({
      item,
      testIdPrefix: testId,
      activeInlineSummary,
      isDecimalLike,
    }),
    [item, testId, activeInlineSummary, isDecimalLike],
  );

  const orphanFieldDetailLabel = computeOrphanFieldDetailLabel(
    activeInlineSummary,
    supportingText,
  );

  // SM-4: Single requestAnimationFrame replaces fragile triple-delay blur handler.
  const handleOrphanFieldDetailBlur: FocusEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const next = event.relatedTarget;
    const shell = event.currentTarget.closest(
      `[data-testid="${testId}-lower-editor"]`,
    );
    if (next instanceof Node && shell?.contains(next)) {
      return;
    }
    const blurredLabel = orphanFieldDetailLabel;
    if (!blurredLabel) return;

    requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      const ae = document.activeElement;
      if (ae instanceof Node && shell?.contains(ae)) return;
      setActiveInlineSummary((current) =>
        current === blurredLabel ? null : current,
      );
    });
  };

  const expandCategory = (c: ExpandedSummaryCategory) => setExpandedCategory(c);

  const rowIdentity = {
    testId,
    itemKey,
    itemLabel,
    isField,
    selected: effectiveSelected,
    editable,
    dataType,
    widgetHint,
    dt,
    labelForDescription,
    groupPrefix,
  } satisfies ItemRowIdentity;

  const rowEditState = {
    activeIdentityField,
    draftKey,
    draftLabel,
    activeInlineSummary,
    supportingText,
    categorySummaries: categorySummaries ?? {},
    expandedCategoryKey: expandedCategory,
    summaryInputValue,
  } satisfies ItemRowEditState;

  const rowActions = {
    onDraftKeyChange: setDraftKey,
    onDraftLabelChange: setDraftLabel,
    onCommitIdentityField: commitIdentityField,
    onCancelIdentityField: cancelIdentityField,
    onOpenIdentityField: openIdentityField,
    onOpenEditorForSummary: openEditorForSummary,
    onCloseInlineSummary: closeInlineSummary,
    onCancelInlineSummary: cancelInlineSummary,
    onUpdateSummaryValue: updateSummaryValue,
  } satisfies ItemRowActions;

  const categoryPanelEl = expandedCategory ? (
    <div
      className="grid transition-[grid-template-rows] duration-150 ease-out"
      style={{ gridTemplateRows: showCategoryPanel ? '1fr' : '0fr' }}
      data-expanded={showCategoryPanel}
    >
      <div className="overflow-hidden">
        <ItemRowCategoryPanel
          ref={categoryPanelRef}
          testId={testId}
          itemKey={itemKey}
          itemLabel={itemLabel}
          item={item}
          binds={binds}
          expandedCategory={expandedCategory}
          isField={isField}
          isDisplayItem={isDisplayItem}
          prePopulateValue={prePopulateValue}
          statusPills={statusPills}
          fieldDetailLaunchers={fieldDetailLaunchers}
          summaryInputValue={summaryInputValue}
          updateSummaryValue={updateSummaryValue}
          closeInlineSummary={closeInlineSummary}
          openEditorForSummary={openEditorForSummary}
          onExpandCategory={expandCategory}
          orphanFieldDetailLabel={orphanFieldDetailLabel}
          handleOrphanFieldDetailBlur={handleOrphanFieldDetailBlur}
          onUpdateItem={onUpdateItem}
          justCreatedBind={justCreatedBind}
          onClearJustCreatedBind={() => setJustCreatedBind(null)}
          onBindCreated={setJustCreatedBind}
        />
      </div>
    </div>
  ) : null;

  return (
    <div
      data-testid={testId}
      data-editor-path={itemPath}
      className={[
        'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
        selected
          ? 'border-accent/50 bg-accent/[0.09] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
          : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
      ].join(' ')}
      style={{ paddingLeft: depth * 20 + 14 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className='flex items-start gap-3'>
        <DragHandle
          ref={dragHandleRef}
          label={`Reorder ${itemLabel}`}
          className='h-11'
        />
        <div className='min-w-0 flex-1 flex flex-col gap-3'>
          {activeIdentityField ? (
            <ItemRowContent
              layout='combined'
              identity={rowIdentity}
              editState={rowEditState}
              actions={rowActions}
              categoryEditor={categoryPanelEl}
              statusPills={statusPills}
            />
          ) : (
            <div className='flex min-w-0 flex-col gap-4'>
              <button
                ref={selectButtonRef}
                type='button'
                data-testid={`${testId}-select`}
                aria-label={`Select ${itemLabel}`}
                className='block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 rounded-[10px]'
                onClick={onClick}
                onContextMenu={onContextMenu}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
                  // KN-1: When selected, let normal Tab flow into card internals.
                  if (selected) return;
                  event.preventDefault();
                  moveCardFocus(event.shiftKey ? -1 : 1, event.currentTarget);
                }}
              >
                <ItemRowContent
                  layout='identity'
                  identity={rowIdentity}
                  editState={rowEditState}
                  actions={rowActions}
                />
              </button>
              <div className='min-w-0 w-full'>
                <ItemRowContent
                  layout='summary'
                  identity={rowIdentity}
                  editState={rowEditState}
                  actions={rowActions}
                  categoryEditor={categoryPanelEl}
                  statusPills={statusPills}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {isChoiceField && (
        <OptionsModal
          open={optionsModalOpen}
          itemLabel={itemLabel}
          itemPath={itemPath}
          options={choiceOptions}
          onUpdateOptions={(opts) => onUpdateItem?.({ options: opts })}
          onClose={() => setOptionsModalOpen(false)}
        />
      )}
    </div>
  );
}
