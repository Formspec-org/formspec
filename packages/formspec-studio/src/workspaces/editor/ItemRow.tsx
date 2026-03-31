/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { useEffect, useRef, useState, type FocusEventHandler } from 'react';
import { flushSync } from 'react-dom';
import { Pill } from '../../components/ui/Pill';
import { DragHandle } from '../../components/ui/DragHandle';
import { dataTypeInfo } from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import {
  buildFieldDetailLaunchers,
  computeOrphanFieldDetailLabel,
} from './item-row-field-detail';
import { formatPrePopulateCombined, parsePrePopulateCombined } from './pre-populate-combined';
import {
  type SummaryEntry,
  type StatusPill,
  type MissingAction,
} from './item-row-shared';
import { ItemRowContent } from './ItemRowContent';
import { ItemRowLowerPanel } from './ItemRowLowerPanel';
import { OptionsModal } from '../../components/ui/OptionsModal';

/** Accordion section identifiers for the lower panel. */
export type OpenSection = 'visibility' | 'validation' | 'value' | 'format' | null;

interface ItemRowProps {
  itemKey: string;
  itemPath: string;
  itemType: 'field' | 'display';
  label?: string;
  categorySummaries?: Record<string, string>;
  dataType?: string;
  widgetHint?: string;
  statusPills?: StatusPill[];
  missingActions?: MissingAction[];
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
  missingActions = [],
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
  const rawPrefix = itemPath.endsWith(`.${itemKey}`) ? itemPath.slice(0, -itemKey.length) : null;
  // For repeatable groups, insert [] before the trailing dot: "group[]."
  const groupPrefix = rawPrefix && insideRepeatableGroup
    ? rawPrefix.replace(/\.$/, '[].')
    : rawPrefix;

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const visibleMissingActions = selected ? missingActions : [];
  const showFooter = statusPills.length > 0;
  const [activeIdentityField, setActiveIdentityField] = useState<'label' | 'key' | null>(null);
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));
  const [activeInlineSummary, setActiveInlineSummary] = useState<string | null>(null);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  /** Keeps literal `@` / `$` while editing; definition only stores instance + path. */
  const [preFillSourceDraft, setPreFillSourceDraft] = useState<string | null>(null);
  const wasEditingPreFillRef = useRef(false);
  /**
   * When true, Pre-fill is being added from the field-detail launcher only (lower panel).
   * We intentionally do not set activeInlineSummary to 'Pre-fill' so the summary strip does not
   * mount a second input with autoFocus (which steals focus on the first keystroke).
   */
  const [preFillLowerSession, setPreFillLowerSession] = useState(false);
  const lowerPanelRef = useRef<HTMLDivElement>(null);
  const prevShowLowerPanelRef = useRef(false);

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
      setOpenSection(null);
      setPreFillLowerSession(false);
      setActiveInlineSummary(null);
      setOptionsModalOpen(false);
      return;
    }
    // Default open section when selected
    setOpenSection('visibility');
  }, [selected]);

  const itemLabel = label || itemKey;
  const labelForDescription =
    isField && label?.trim() && label.trim() !== itemKey ? label.trim() : null;
  const isChoiceField = item?.type === 'field' && ['choice', 'multiChoice', 'select', 'select1'].includes(String(item.dataType ?? ''));
  const isDecimalLike = item?.type === 'field' && ['decimal', 'money'].includes(String(item.dataType ?? ''));

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

  const choiceOptions = Array.isArray(item?.options ?? (item as Record<string, unknown>)?.choices)
    ? ((item?.options ?? (item as Record<string, unknown>)?.choices) as Array<{ value: string; label: string; keywords?: string[] }>)
    : [];

  // Description and Hint are derived directly from the item — no summaries prop needed.
  const descriptionValue = typeof item?.description === 'string' ? item.description : '';
  const hintValue = typeof item?.hint === 'string' ? item.hint : '';

  const allContentEntries: SummaryEntry[] = [
    { label: 'Description', value: descriptionValue },
    { label: 'Hint', value: hintValue },
  ];
  // When unselected, hide empty Description/Hint rows to reduce visual noise
  const supportingText = selected
    ? allContentEntries
    : allContentEntries.filter((entry) => entry.value.trim().length > 0);

  const resetEditors = () => {
    setActiveIdentityField(null);
    setOpenSection(null);
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
      // Keep the current open section (or default to visibility for fields)
      if (isField && openSection === null) setOpenSection('visibility');
      return;
    }
    if (label === 'Options') {
      setOptionsModalOpen(true);
      return;
    }
    if (label === 'Calculate' || label === 'Relevant' || label === 'Readonly' || label === 'Required' || label === 'Constraint' || label === 'Message') {
      setPreFillLowerSession(false);
      setActiveInlineSummary(label);
      if (label === 'Relevant') {
        setOpenSection('visibility');
      } else if (label === 'Calculate' || label === 'Readonly') {
        setOpenSection('value');
      } else {
        setOpenSection('validation');
      }
      return;
    }
    if (label === 'Pre-fill' && opts?.preFillFromLauncher) {
      setPreFillLowerSession(true);
      setActiveInlineSummary(null);
      setOpenSection('value');
      return;
    }
    if (label === 'Pre-fill') {
      setPreFillLowerSession(false);
      setActiveInlineSummary('Pre-fill');
      setOpenSection('value');
      return;
    }
    // Default: field-detail items (Currency, Precision, etc.) go to format section
    setPreFillLowerSession(false);
    setActiveInlineSummary(label);
    setOpenSection('format');
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

  const closeInlineSummary = () => {
    setPreFillSourceDraft(null);
    setPreFillLowerSession(false);
    setActiveInlineSummary(null);
    // Keep the current accordion section open — only clear inline editing state
  };

  const editingDisplayContent =
    itemType === 'display' &&
    (activeInlineSummary === 'Description' || activeInlineSummary === 'Hint');

  const showLowerPanel =
    (openSection !== null && (isField ? item?.type === 'field' : true)) ||
    editingDisplayContent ||
    preFillLowerSession;

  useEffect(() => {
    const wasShowing = prevShowLowerPanelRef.current;
    prevShowLowerPanelRef.current = showLowerPanel;
    if (showLowerPanel && !wasShowing && selected) {
      lowerPanelRef.current?.focus();
    }
  }, [showLowerPanel, selected]);

  const summaryInputValue = (label: string): string => {
    switch (label) {
      case 'Description': return descriptionValue;
      case 'Hint': return hintValue;
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
          // Keep the current accordion section open — only clear inline state
        }
      };
      // Blur may report no relatedTarget; focus moves on the next task (e.g. checkbox in field details).
      setTimeout(tryDismiss, 0);
    });
  };

  const content = (
    <ItemRowContent
      identity={{
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
      }}
      editState={{
        activeIdentityField,
        draftKey,
        draftLabel,
        activeInlineSummary,
        supportingText,
        categorySummaries: categorySummaries ?? {},
        preFillSourceInputValue,
        summaryInputValue,
      }}
      actions={{
        onDraftKeyChange: setDraftKey,
        onDraftLabelChange: setDraftLabel,
        onCommitIdentityField: commitIdentityField,
        onCancelIdentityField: cancelIdentityField,
        onOpenIdentityField: openIdentityField,
        onOpenEditorForSummary: openEditorForSummary,
        onCloseInlineSummary: closeInlineSummary,
        onPreFillSourceDraftChange: setPreFillSourceDraft,
        onUpdateSummaryValue: updateSummaryValue,
      }}
    />
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
            <Pill key={`${itemPath}-${pill.text}`} text={pill.text} color={pill.color} size="sm" title={pill.specTerm} />
          ))}
        </div>
      )}

      {showLowerPanel && (
        <ItemRowLowerPanel
          ref={lowerPanelRef}
          testId={testId}
          itemLabel={itemLabel}
          itemPath={itemPath}
          item={item}
          binds={binds}
          isField={isField}
          isChoiceField={isChoiceField}
          isDisplayItem={isDisplayItem}
          selected={selected}
          openSection={openSection}
          onSectionChange={setOpenSection}
          preFillLowerSession={preFillLowerSession}
          orphanUiLabel={orphanUiLabel}
          orphanFieldDetailLabel={orphanFieldDetailLabel}
          prePopulateValue={prePopulateValue}
          statusPills={statusPills}
          visibleMissingActions={visibleMissingActions}
          fieldDetailLaunchers={fieldDetailLaunchers}
          summaryInputValue={summaryInputValue}
          updateSummaryValue={updateSummaryValue}
          closeInlineSummary={closeInlineSummary}
          openEditorForSummary={openEditorForSummary}
          handleOrphanFieldDetailBlur={handleOrphanFieldDetailBlur}
          preFillSourceInputValue={preFillSourceInputValue}
          onPreFillSourceDraftChange={setPreFillSourceDraft}
          onUpdateItem={onUpdateItem}
        />
      )}

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
