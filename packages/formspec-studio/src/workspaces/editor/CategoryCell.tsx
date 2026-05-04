/** @filedesc Reusable category summary cell for the item row summary grid. */

interface CategoryCellProps {
  category: string;
  value: string;
  isExpanded: boolean;
  selected: boolean | undefined;
  testId: string;
  title?: string;
  onOpen: (category: string) => void;
}

export function CategoryCell({
  category,
  value,
  isExpanded,
  selected,
  testId,
  title,
  onOpen,
}: CategoryCellProps) {
  const isEmpty = !value || value === '\u2014';

  return (
    <div
      data-testid={testId}
      className={[
        'min-w-0 px-4 py-2.5 rounded-xl transition-all duration-300 relative group/cell',
        selected ? 'cursor-pointer hover:bg-accent/5' : '',
        isExpanded ? 'bg-accent/10 shadow-sm' : 'bg-subtle/30',
      ].join(' ')}
      onClick={(event) => {
        if (!selected) return;
        event.stopPropagation();
        onOpen(category);
      }}
    >
      <dt className="flex items-center gap-2 mb-1.5" title={title}>
        <span className="font-display text-[9px] font-black uppercase tracking-[0.2em] text-muted group-hover/cell:text-accent/60 transition-colors">
          {category}
        </span>
        {isExpanded && (
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
      </dt>
      <dd
        className={[
          'flex max-w-full items-center truncate text-[14px] font-bold leading-none transition-all',
          isExpanded ? 'text-accent' : 'text-ink/80',
          isEmpty ? 'text-muted italic font-medium' : '',
        ].join(' ')}
      >
        {isEmpty && selected ? (
          <span className="truncate">
            Add {category.toLowerCase()}\u2026
          </span>
        ) : isEmpty && !selected ? (
          <span className="truncate">{'\u2014'}</span>
        ) : (
          <span className="truncate">{value}</span>
        )}
      </dd>
      
      {selected && !isExpanded && (
        <div className="absolute right-2 top-2 opacity-0 group-hover/cell:opacity-100 transition-opacity">
          <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-[10px]">+</span>
          </div>
        </div>
      )}
    </div>
  );
}
