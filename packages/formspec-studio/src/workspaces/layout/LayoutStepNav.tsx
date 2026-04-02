/** @filedesc Layout workspace step selector for authored Page nodes in wizard or tabs mode. */
import { useEffect, useRef, useState } from 'react';

interface LayoutStepNavProps {
  pages: Array<{ id: string; title: string; groupPath?: string; pageId?: string }>;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onRenamePage?: (pageId: string, title: string, groupPath?: string, componentPageId?: string) => void;
}

export function LayoutStepNav({ pages, activePageId, onSelectPage, onRenamePage }: LayoutStepNavProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingPageId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingPageId]);

  if (pages.length === 0) return null;

  const commitRename = () => {
    if (!editingPageId) return;
      const page = pages.find((entry) => entry.id === editingPageId);
      const nextTitle = draftTitle.trim();
      if (page && nextTitle && nextTitle !== page.title) {
        onRenamePage?.(page.id, nextTitle, page.groupPath, page.pageId);
      }
    setEditingPageId(null);
  };

  return (
    <nav data-testid="page-nav" aria-label="Layout step navigation" className="flex items-center gap-1 overflow-x-auto">
      {pages.map((page, index) => {
        const isActive = page.id === activePageId;
        const isEditing = page.id === editingPageId;
        return (
          isEditing ? (
            <div key={page.id} className="shrink-0">
              <input
                ref={inputRef}
                data-testid="page-nav-rename-input"
                aria-label="Rename page"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitRename();
                  }
                  if (e.key === 'Escape') {
                    setEditingPageId(null);
                  }
                }}
                className="min-w-32 shrink-0 rounded-lg border border-accent bg-surface px-3 py-1.5 text-[12px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              />
            </div>
          ) : (
            <button
              key={page.id}
              type="button"
              data-testid={`page-nav-tab-${page.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectPage(page.id)}
              onDoubleClick={() => {
                if (!isActive || !onRenamePage) return;
                setDraftTitle(page.title);
                setEditingPageId(page.id);
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
                isActive
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <span className="mr-1.5 text-[10px] opacity-60">{index + 1}</span>
              {page.title}
            </button>
          )
        );
      })}
    </nav>
  );
}
