import type { ReactNode } from 'react';

interface GroupBlockProps {
  itemKey: string;
  label?: string;
  depth: number;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

export function GroupBlock({ itemKey, label, depth, selected, onSelect, children }: GroupBlockProps) {
  const indent = depth * 24;
  return (
    <div data-testid={`group-${itemKey}`} style={{ marginLeft: indent }}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
          selected ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:bg-subtle'
        }`}
        onClick={onSelect}
      >
        <span className="text-xs text-muted font-mono">{ '{' }...{ '}' }</span>
        <span className="text-sm font-semibold text-foreground">{label || itemKey}</span>
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}
