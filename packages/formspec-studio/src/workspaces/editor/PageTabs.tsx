import { useDefinition } from '../../state/useDefinition';

interface PageTabsProps {
  activePage: number;
  onPageChange: (index: number) => void;
}

export function PageTabs({ activePage, onPageChange }: PageTabsProps) {
  const definition = useDefinition();
  const items = definition.items || [];

  // Pages are top-level group items, or treat entire form as single page
  const pages = items.filter((item: any) => item.type === 'group');
  const displayPages = pages.length > 0 ? pages : [{ key: 'all', label: 'All Fields' }];

  return (
    <div role="tablist" className="flex gap-1 border-b border-border px-2 bg-surface">
      {displayPages.map((page: any, i: number) => (
        <button
          key={page.key}
          role="tab"
          aria-selected={i === activePage}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-b-2 transition-colors ${
            i === activePage
              ? 'border-accent text-accent font-medium'
              : 'border-transparent text-muted hover:text-ink'
          }`}
          onClick={() => onPageChange(i)}
        >
          <span className="text-xs w-5 h-5 rounded-full bg-subtle flex items-center justify-center">
            {i + 1}
          </span>
          {page.label || page.key}
        </button>
      ))}
    </div>
  );
}
