/** @filedesc Reusable category summary cell for the item row summary grid. */

interface CategoryCellProps {
  category: string;
  value: string;
  isExpanded: boolean;
  selected: boolean | undefined;
  testId: string;
  onOpen: (category: string) => void;
}

export function CategoryCell({
  category,
  value,
  isExpanded,
  selected,
  testId,
  onOpen,
}: CategoryCellProps) {
  const isEmpty = !value;

  return (
    <div
      data-testid={testId}
      className={[
        'min-w-0 border-l border-border/65 pl-3',
        selected ? 'cursor-pointer' : '',
      ].join(' ')}
      onClick={(event) => {
        if (!selected || isExpanded) return;
        event.stopPropagation();
        onOpen(category);
      }}
    >
      <dt className="font-mono text-[11px] tracking-[0.14em] text-ink/72">
        {category}
      </dt>
      <dd
        className={[
          'group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 text-ink/94 md:text-[15px]',
          isExpanded ? 'bg-accent/12 ring-1 ring-accent/25' : '',
          isEmpty && selected ? 'hover:ring-1 hover:ring-accent/15' : '',
        ].join(' ')}
      >
        {isEmpty && selected ? (
          <span className="truncate italic" style={{ color: 'color-mix(in srgb, var(--color-ink) 35%, transparent)' }}>
            Add {category.toLowerCase()}...
          </span>
        ) : (
          <span className="truncate">{value}</span>
        )}
      </dd>
    </div>
  );
}
