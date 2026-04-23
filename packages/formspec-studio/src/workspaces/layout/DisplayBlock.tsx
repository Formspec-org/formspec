/** @filedesc Layout canvas block for display-only items — label, body editor for notes, read-only definition copy with link to Editor, toolbar. */
import { useEffect, useState, type MouseEvent, type KeyboardEvent } from 'react';
import { EditMark } from '../shared/item-row-shared';
import { LayoutLeafBlock } from './LayoutLeafBlock';
import type { LayoutContext } from './FieldBlock';

/** Matches editor ItemRow display glyph semantics (component names are often TitleCase). */
function layoutDisplayGlyph(widgetHint?: string): string {
  const w = widgetHint?.toLowerCase() ?? '';
  if (w.includes('heading')) return 'H';
  if (w.includes('divider')) return '\u2014';
  return '\u2139';
}

interface DisplayBlockProps {
  itemKey: string;
  selectionKey: string;
  label?: string;
  widgetHint?: string;
  selected?: boolean;
  layoutPrimaryKey?: string | null;
  onSelect?: (ev: MouseEvent | KeyboardEvent, selectionKey: string) => void;
  groupPathPrefix?: string | null;
  description?: string | null;
  hint?: string | null;
  onRenameDefinitionItem?: (nextKey: string, nextLabel: string | null) => void;
  /** Definition path for description/hint (Editor is canonical); omit for tree-only display nodes. */
  definitionCopyPath?: string | null;
  /** Layout context from the parent container (for grid column span). */
  layoutContext?: LayoutContext;
  /** Component node style map — gridColumn, etc. */
  nodeStyle?: Record<string, unknown>;
  /** Called when the user drag-resizes the column span. */
  onResizeColSpan?: (newSpan: number) => void;
  /** Called when the user drag-resizes the row span. */
  onResizeRowSpan?: (newSpan: number) => void;
  /**
   * Full raw node props for the display item's component node — used by InlineToolbar.
   * When provided with onSetProp, enables the inline toolbar.
   */
  nodeProps?: Record<string, unknown>;
  /** Called when toolbar writes a property to the component node. */
  onSetProp?: (key: string, value: unknown) => void;
  /** Called when toolbar writes a style property (via style map, not direct prop). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
  /**
   * Tier 1 definition display items: commit body text to `item.label` (Layout-added notes).
   * When set, a multi-line editor is shown while the block is selected.
   */
  onCommitDisplayLabel?: (text: string | null) => void;
  /** Layout canvas: parent reorder list id (with sortableIndex + treeDragNodeRef). */
  sortableGroup?: string;
  sortableIndex?: number;
  treeDragNodeRef?: { bind?: string; nodeId?: string };
}

export function DisplayBlock(props: DisplayBlockProps) {
  const {
    itemKey, label, widgetHint, selected, onRenameDefinitionItem, onCommitDisplayLabel,
  } = props;

  const [activeIdentityField, setActiveIdentityField] = useState<'label' | null>(null);
  const [draftLabel, setDraftLabel] = useState(() => (label?.trim() ? label.trim() : ''));

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
    const nextVal = draftLabel.trim() || null;
    onRenameDefinitionItem?.(itemKey, nextVal);
    onCommitDisplayLabel?.(nextVal);
    setActiveIdentityField(null);
  };

  const handleIdentityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) commitIdentityField();
    if (e.key === 'Escape') cancelIdentityField();
  };

  const glyph = layoutDisplayGlyph(widgetHint);
  const editable = Boolean(onRenameDefinitionItem || onCommitDisplayLabel);
  const hasDistinctHumanLabel = Boolean(label?.trim());

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
            onClick={openLabelEditor}
            className="opacity-0 group-hover/id:opacity-100 p-0.5 rounded hover:bg-accent/10 text-accent transition-all"
          >
            <EditMark size={10} />
          </button>
        )}
      </div>

      {activeIdentityField === 'label' ? (
        <textarea
          autoFocus
          data-layout-stop-select
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitIdentityField}
          onKeyDown={handleIdentityKeyDown}
          className="bg-transparent border-none outline-none p-0 text-[15px] font-bold text-ink w-full placeholder:text-muted/30 resize-none"
          rows={Math.max(1, draftLabel.split('\n').length)}
          placeholder="Enter content..."
        />
      ) : (
        <div 
          className={`text-[15px] font-bold whitespace-pre-wrap ${hasDistinctHumanLabel ? 'text-ink' : 'text-muted/40 italic font-medium'}`}
          onDoubleClick={openLabelEditor}
        >
          {label?.trim() ? label : 'No content'}
        </div>
      )}
    </div>
  );

  const icon = (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85">
      <span className="font-ui text-[18px] font-bold text-muted/40 tabular-nums">
        {glyph}
      </span>
    </div>
  );

  return (
    <LayoutLeafBlock
      {...props}
      itemType="display"
      icon={icon}
      identity={identity}
      bindPath={props.definitionCopyPath ?? undefined}
    />
  );
}
