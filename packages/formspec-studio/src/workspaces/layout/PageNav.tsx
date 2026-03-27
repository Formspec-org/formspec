/** @filedesc Wizard step bar / tab strip for page navigation in the Layout canvas. */

interface PageNavProps {
  pages: Array<{ id: string; title: string }>;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
}

export function PageNav({ pages, activePageId, onSelectPage }: PageNavProps) {
  if (pages.length === 0) return null;

  return (
    <nav data-testid="page-nav" className="flex items-center gap-1 overflow-x-auto">
      {pages.map((page, index) => {
        const isActive = page.id === activePageId;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectPage(page.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isActive
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            <span className="mr-1.5 text-[10px] opacity-60">{index + 1}</span>
            {page.title}
          </button>
        );
      })}
    </nav>
  );
}
