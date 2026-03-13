import { blockIndent, blockRef, type BlockBaseProps } from './block-utils';

const DISPLAY_META: Record<string, { icon: string; label: string }> = {
  Heading:  { icon: 'H', label: 'Heading' },
  Divider:  { icon: '—', label: 'Divider' },
  Spacer:   { icon: '↕', label: 'Spacer' },
  Text:     { icon: 'ℹ', label: 'Display' },
};

const DEFAULT_META = { icon: '', label: 'Display' };

interface DisplayBlockProps extends BlockBaseProps {
  label?: string;
  widgetHint?: string;
}

export function DisplayBlock({
  itemKey,
  itemPath,
  registerTarget,
  label,
  depth,
  selected,
  isInSelection,
  onSelect,
  widgetHint,
}: DisplayBlockProps) {
  const meta = (widgetHint && DISPLAY_META[widgetHint]) || DEFAULT_META;

  return (
    <div
      ref={blockRef(itemPath, registerTarget)}
      data-testid={`display-${itemKey}`}
      data-item-path={itemPath}
      data-item-type="display"
      className={`group flex items-center gap-2 px-3 py-2 rounded border-l-2 cursor-pointer transition-colors ${
        selected ? 'border-accent bg-accent/5'
        : isInSelection ? 'border-accent bg-accent/5'
        : 'border-accent/40 bg-surface hover:bg-subtle'
      }`}
      style={{ marginLeft: blockIndent(depth) }}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div
        draggable="true"
        data-testid="drag-handle"
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="2" cy="2" r="1.25" fill="currentColor" className="text-muted/60" />
          <circle cx="6" cy="2" r="1.25" fill="currentColor" className="text-muted/60" />
          <circle cx="2" cy="7" r="1.25" fill="currentColor" className="text-muted/60" />
          <circle cx="6" cy="7" r="1.25" fill="currentColor" className="text-muted/60" />
          <circle cx="2" cy="12" r="1.25" fill="currentColor" className="text-muted/60" />
          <circle cx="6" cy="12" r="1.25" fill="currentColor" className="text-muted/60" />
        </svg>
      </div>

      {meta.icon && <span className="text-xs text-accent/70 font-mono">{meta.icon}</span>}
      <span className="text-xs text-accent font-medium">{meta.label}</span>
      <span className="text-sm text-foreground">{label || itemKey}</span>
    </div>
  );
}
