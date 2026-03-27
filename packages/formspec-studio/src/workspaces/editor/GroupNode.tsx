/** @filedesc Collapsible group node for the definition tree editor. */
import { useState, type ReactNode } from 'react';
import { Pill } from '../../components/ui/Pill';

interface GroupNodeProps {
  itemKey: string;
  label?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  depth: number;
  children: ReactNode;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function GroupNode({
  itemKey,
  label,
  repeatable,
  minRepeat,
  maxRepeat,
  depth,
  children,
  selected,
  onClick,
  onContextMenu,
}: GroupNodeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      data-testid={`group-${itemKey}`}
      style={{ paddingLeft: depth * 20 }}
      className={selected ? 'border border-accent rounded bg-accent/5' : ''}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-subtle rounded transition-colors"
      >
        {/* Expand/collapse toggle */}
        <span
          data-testid={`toggle-${itemKey}`}
          className="text-[10px] text-muted w-3 shrink-0 select-none"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </span>

        {/* Accent bar */}
        <div className="w-[3px] h-[12px] rounded-[1px] bg-ink/60 shrink-0" />

        {/* Label */}
        <span className="font-mono text-[11px] font-bold tracking-[0.1em] uppercase text-ink">
          {label || itemKey}
        </span>

        {/* Repeat badge */}
        {repeatable && (
          <Pill
            text={`\u27F3 ${minRepeat ?? 0}\u2013${maxRepeat ?? '\u221E'}`}
            color="logic"
            size="sm"
          />
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div className="flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}
