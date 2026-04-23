/** @filedesc Layout canvas block for bound fields — label edit, read-only definition copy + Editor link, drag/resize, inline toolbar. */
import { useEffect, useState, type MouseEvent, type KeyboardEvent } from 'react';
import { dataTypeInfo } from '@formspec-org/studio-core';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { EditMark } from '../shared/item-row-shared';
import { LayoutLeafBlock } from './LayoutLeafBlock';
export interface LayoutContext {
  parentContainerType: string;
  parentGridColumns: number;
  currentColSpan: number;
  currentRowSpan?: number;
}

interface FieldBlockProps {
  itemKey: string;
  bindPath: string;
  selectionKey: string;
  label?: string;
  dataType?: string;
  /** Item type — 'field' | 'group' | 'display'. */
  itemType?: string;
  selected?: boolean;
  /** When set, toolbars / inline edits show only on the primary row during multi-select. */
  layoutPrimaryKey?: string | null;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  sortableGroup: string;
  sortableIndex: number;
  /** Dot-delimited parent path prefix (e.g. `demographics.`) shown before the key when inline editing. */
  groupPathPrefix?: string | null;
  /** Tier 1 definition copy — shown as inline summary rows when selected. */
  description?: string | null;
  hint?: string | null;
  /**
   * When set, selected fields allow inline **label** edits (keys stay read-only on the layout canvas).
   * Description and hint are edited in Editor only (`DefinitionCopyReadonlyPanel`).
   */
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
  /** Layout context from the parent container. */
  layoutContext?: LayoutContext;
  /** Component node style map — gridColumn, padding, etc. */
  nodeStyle?: Record<string, unknown>;
  /** Called when the user drag-resizes the column span. */
  onResizeColSpan?: (newSpan: number) => void;
  /** Called when the user drag-resizes the row span. */
  onResizeRowSpan?: (newSpan: number) => void;
  /**
   * Full raw node props for the field's component node — used by InlineToolbar.
   * When provided with onSetProp, enables the inline toolbar.
   */
  nodeProps?: Record<string, unknown>;
  /** Called when toolbar writes a property to the component node. */
  onSetProp?: (key: string, value: unknown) => void;
  /** Called when toolbar writes a style property (via style map, not direct prop). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when toolbar wants to set column span via setColumnSpan. */
  onSetColumnSpan?: (newSpan: number) => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
}

export function FieldBlock(props: FieldBlockProps) {
  const {
    itemKey, label, dataType, selected, onRenameDefinitionItem,
  } = props;

  const [activeIdentityField, setActiveIdentityField] = useState<'label' | null>(null);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const hasDistinctHumanLabel = Boolean(label?.trim() && label.trim() !== itemKey);
  const editable = Boolean(onRenameDefinitionItem);

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
    }
  }, [selected]);

  const openLabelEditor = () => {
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField('label');
  };

  const cancelIdentityField = () => {
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
  };

  const commitIdentityField = () => {
    onRenameDefinitionItem?.(itemKey, draftLabel.trim() || null);
    setActiveIdentityField(null);
  };

  const handleIdentityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitIdentityField();
    if (e.key === 'Escape') cancelIdentityField();
  };

  const identity = (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 group/id">
        <span className="text-[10px] font-mono text-muted/60 uppercase tracking-wider tabular-nums shrink-0">
          {props.groupPathPrefix}{itemKey}
        </span>
        {editable && !activeIdentityField && (
          <button
            type="button"
            data-layout-stop-select
            data-testid={`layout-field-${itemKey}-label-edit`}
            onClick={openLabelEditor}
            className="opacity-0 group-hover/id:opacity-100 p-0.5 rounded hover:bg-accent/10 text-accent transition-all"
          >
            <EditMark />
          </button>
        )}
      </div>

      {activeIdentityField === 'label' ? (
        <input
          autoFocus
          data-layout-stop-select
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitIdentityField}
          onKeyDown={handleIdentityKeyDown}
          className="bg-transparent border-none outline-none p-0 text-[15px] font-bold text-ink w-full placeholder:text-muted/30"
          placeholder="Enter label..."
        />
      ) : (
        <div 
          className={`text-[15px] font-bold truncate ${hasDistinctHumanLabel ? 'text-ink' : 'text-muted/40 italic font-medium'}`}
          onDoubleClick={openLabelEditor}
        >
          {label?.trim() ? label : 'No label'}
        </div>
      )}
    </div>
  );

  const icon = dataType && dt ? (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
      <FieldIcon dataType={dataType} className={`shrink-0 ${dt.color}`} />
    </div>
  ) : null;

  return (
    <LayoutLeafBlock
      {...props}
      itemType="field"
      icon={icon}
      identity={identity}
    />
  );
}

