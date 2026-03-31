/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { useEffect, useRef, useState, type FocusEventHandler } from 'react';
import { flushSync } from 'react-dom';
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
  dragHandleRef,
  item,
  binds = {},
  onUpdateItem,
  onRenameIdentity,
  onClick,
  onContextMenu,
}: ItemRowProps) {
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
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const categoryPanelRef = useRef<HTMLDivElement>(null);
  const prevShowCategoryPanelRef = useRef(false);

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setExpandedCategory(null);
      setActiveInlineSummary(null);
      setOptionsModalOpen(false);
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
  const supportingText = selected
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
    if (label === 'Description' || label === 'Hint') {
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
      setExpandedCategory((c) =>
        c === label ? null : (label as ExpandedSummaryCategory),
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
      if (!prePopulateValue) {
        onUpdateItem?.({ prePopulate: { instance: '', path: '' } });
      }
      return;
    }
    if (label === 'Initial') {
      setExpandedCategory('Value');
      setActiveInlineSummary(null);
      if (!(item?.initialValue != null && String(item.initialValue).trim())) {
        onUpdateItem?.({ initialValue: '' });
      }
      return;
    }
    setExpandedCategory('Format');
    setActiveInlineSummary(label);
  };

  const commitIdentityField = (field: 'label' | 'key') => {
    if (!onRenameIdentity) {
      setActiveIdentityField(null);
      return;
    }
    const nextKey = field === 'key' ? draftKey.trim() || itemKey : itemKey;
    const nextLabel =
      field === 'label' ? draftLabel.trim() || itemKey : itemLabel;
    onRenameIdentity(nextKey, nextLabel);
    setActiveIdentityField(null);
  };

  const cancelIdentityField = () => {
    setDraftKey(itemKey);
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
  };

  const closeInlineSummary = () => {
    setActiveInlineSummary(null);
  };

  const showCategoryPanel =
    selected &&
    expandedCategory !== null &&
    ((isField && item?.type === 'field') ||
      (isDisplayItem && expandedCategory === 'Visibility'));

  useEffect(() => {
    const wasShowing = prevShowCategoryPanelRef.current;
    prevShowCategoryPanelRef.current = Boolean(showCategoryPanel);
    if (showCategoryPanel && !wasShowing && selected) {
      categoryPanelRef.current?.focus();
    }
  }, [showCategoryPanel, selected]);

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
        onUpdateItem?.({
          precision: rawValue === '' ? null : Number(rawValue),
        });
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

  const orphanFieldDetailLabel = computeOrphanFieldDetailLabel(
    activeInlineSummary,
    supportingText,
  );

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

    queueMicrotask(() => {
      const tryDismiss = () => {
        const ae = document.activeElement;
        if (ae instanceof Node && shell?.contains(ae)) {
          return;
        }
        flushSync(() => {
          setActiveInlineSummary((current) => {
            if (blurredLabel && current === blurredLabel) {
              return null;
            }
            return current;
          });
        });
      };
      setTimeout(tryDismiss, 0);
    });
  };

  const expandCategory = (c: ExpandedSummaryCategory) => setExpandedCategory(c);

  const rowIdentity = {
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
    onUpdateSummaryValue: updateSummaryValue,
  } satisfies ItemRowActions;

  const categoryPanelEl =
    showCategoryPanel && expandedCategory ? (
      <ItemRowCategoryPanel
        ref={categoryPanelRef}
        testId={testId}
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
      />
    ) : null;

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
                type='button'
                data-testid={`${testId}-select`}
                aria-label={`Select ${itemLabel}`}
                className='block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 rounded-[10px]'
                onClick={onClick}
                onContextMenu={onContextMenu}
                onKeyDown={(event) => {
                  if (
                    event.key !== 'Tab' ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.metaKey
                  )
                    return;
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
