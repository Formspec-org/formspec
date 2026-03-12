import { useEffect, useRef, useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';

interface PageTabsProps {
  activePageKey: string | null;
  onPageChange: (key: string | null) => void;
}

export function PageTabs({ activePageKey, onPageChange }: PageTabsProps) {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const items = definition.items || [];
  const [editingPageKey, setEditingPageKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pages = items.filter((item: any) => item.type === 'group');
  if (pages.length === 0) return null;

  useEffect(() => {
    if (!editingPageKey) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingPageKey]);

  const startEditing = (page: any) => {
    setEditingPageKey(page.key);
    setDraftLabel(page.label || page.key);
  };

  const stopEditing = () => {
    setEditingPageKey(null);
    setDraftLabel('');
  };

  const commitLabel = (pageKey: string) => {
    dispatch({
      type: 'definition.setItemProperty',
      payload: {
        path: pageKey,
        property: 'label',
        value: draftLabel.trim() || null,
      },
    });
    stopEditing();
  };

  return (
    <div
      role="tablist"
      className="flex items-center gap-0 py-2 overflow-x-auto"
    >
      {pages.map((page: any, i: number) => {
        const isActive = page.key === activePageKey;
        const isEditing = page.key === editingPageKey;
        return (
          <div key={page.key} className="flex items-center shrink-0">
            <button
              role="tab"
              aria-selected={isActive}
              title={page.label || page.key}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-[4px] transition-all cursor-pointer border ${
                isActive
                  ? 'bg-accent/5 border-accent/20 text-accent font-semibold'
                  : 'bg-transparent border-transparent text-muted hover:text-ink hover:bg-subtle'
              }`}
              onClick={() => onPageChange(page.key)}
              onDoubleClick={() => startEditing(page)}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-colors shrink-0 ${
                  isActive ? 'bg-accent text-white' : 'bg-border/80 text-muted'
                }`}
              >
                {i + 1}
              </span>
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={draftLabel}
                  aria-label={`Rename ${page.label || page.key}`}
                  className="min-w-0 max-w-[140px] px-1 py-0.5 text-[12.5px] rounded-[3px] border border-accent/30 bg-surface outline-none"
                  onChange={(event) => setDraftLabel(event.currentTarget.value)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={() => commitLabel(page.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitLabel(page.key);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      stopEditing();
                    }
                  }}
                />
              ) : (
                <span className="text-[12.5px] whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">
                  {page.label || page.key}
                </span>
              )}
            </button>
            {i < pages.length - 1 && (
              <div className="w-3 h-px bg-border/60 mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
