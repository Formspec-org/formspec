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

  useEffect(() => {
    const wasShowing = prevShowLowerPanelRef.current;
    prevShowLowerPanelRef.current = showLowerPanel;
    if (showLowerPanel && !wasShowing && selected) {
      lowerPanelRef.current?.focus();
    }
  }, [showLowerPanel, selected]);

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
      }}
      editState={{
        activeIdentityField,
        draftKey,
        draftLabel,
        activeInlineSummary,
        editingOptions,
        supportingText,
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
            <Pill key={`${itemPath}-${pill.text}`} text={pill.text} color={pill.color} size="sm" />
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
          selected={selected}
          editingFieldConfig={editingFieldConfig}
          editingBehavior={editingBehavior}
          editingOptions={editingOptions}
          editingDisplayContent={editingDisplayContent}
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
          closeOtherEditors={closeOtherEditors}
          openEditorForSummary={openEditorForSummary}
          handleOrphanFieldDetailBlur={handleOrphanFieldDetailBlur}
          preFillSourceInputValue={preFillSourceInputValue}
          onPreFillSourceDraftChange={setPreFillSourceDraft}
          onUpdateItem={onUpdateItem}
        />
      )}
    </div>
  );
}
