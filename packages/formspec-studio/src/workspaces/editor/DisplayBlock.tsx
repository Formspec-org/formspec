interface DisplayBlockProps {
  itemKey: string;
  itemPath: string;
  registerTarget: (path: string, element: HTMLElement | null) => void;
  label?: string;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}

export function DisplayBlock({
  itemKey,
  itemPath,
  registerTarget,
  label,
  depth,
  selected,
  onSelect,
}: DisplayBlockProps) {
  const indent = depth * 24;
  return (
    <div
      ref={(element) => registerTarget(itemPath, element)}
      data-testid={`display-${itemKey}`}
      data-item-path={itemPath}
      data-item-type="display"
      className={`flex items-center gap-2 px-3 py-2 rounded border-l-2 cursor-pointer transition-colors ${
        selected ? 'border-accent bg-accent/5' : 'border-accent/40 bg-surface hover:bg-subtle'
      }`}
      style={{ marginLeft: indent }}
      onClick={onSelect}
    >
      <span className="text-xs text-accent font-medium">Display</span>
      <span className="text-sm text-foreground">{label || itemKey}</span>
    </div>
  );
}
