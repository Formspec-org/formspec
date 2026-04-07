/** @filedesc Searchable palette for adding new field, group, display, and layout items to the form. */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getFieldTypeCatalog, type FieldTypeCatalogEntry } from '@formspec-org/studio-core';

/** A user-visible field type option shown in the palette. */
export type FieldTypeOption = FieldTypeCatalogEntry;

export const FIELD_TYPE_CATALOG: FieldTypeOption[] = getFieldTypeCatalog();
const CATEGORIES = [...new Set(FIELD_TYPE_CATALOG.map((f) => f.category))];

interface AddItemPaletteProps {
  open: boolean;
  onClose: () => void;
  onAdd: (option: FieldTypeOption) => void;
  title?: string;
  /** `editor` = fields + groups (definition). `layout` = display + layout components only — no definition items. */
  scope?: 'all' | 'editor' | 'layout';
}

/**
 * Full-screen modal palette for adding form items.
 *
 * Shows field types grouped by category with icons, descriptions, and a live
 * search filter. Keyboard-navigable: arrows move focus, Enter confirms, Escape
 * closes. Clicking the backdrop also closes.
 */
export function AddItemPalette({ open, onClose, onAdd, title, scope = 'all' }: AddItemPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'field' | 'layout' | 'display'>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Editor: definition items (fields + groups). Layout: presentation tree only (no fields or groups).
  const availableTabs =
    scope === 'editor' || scope === 'layout'
      ? ([] as const)
      : ([
          { id: 'all', label: 'All' },
          { id: 'field', label: 'Inputs' },
          { id: 'layout', label: 'Layout' },
          { id: 'display', label: 'Display' },
        ] as const);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveTab('all');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if ((scope === 'editor' || scope === 'layout') && activeTab !== 'all') {
      setActiveTab('all');
    }
  }, [activeTab, scope]);

  const scopedCatalog = FIELD_TYPE_CATALOG.filter((opt) => {
    if (scope === 'editor') {
      // Editor scope: fields and groups only — no layout containers or display/content items.
      if (opt.itemType === 'layout' || opt.itemType === 'display') return false;
    }
    if (scope === 'layout') {
      // Layout workspace: Tier-3 layout nodes + display chrome — groups/fields live in the Editor definition.
      if (opt.itemType === 'field' || opt.itemType === 'group') return false;
    }
    return true;
  });

  const filtered = scopedCatalog.filter((opt) => {
    // 1. Tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'layout') {
        if (opt.itemType !== 'layout' && opt.itemType !== 'group') return false;
      } else if (opt.itemType !== activeTab) {
        return false;
      }
    }

    // 2. Query filter
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        opt.label.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q) ||
        opt.keywords?.some((kw) => kw.includes(q))
      );
    }
    return true;
  });

  // Keep activeIdx in bounds when filter changes
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const confirm = useCallback(
    (opt: FieldTypeOption) => {
      onAdd(opt);
      onClose();
    },
    [onAdd, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIdx]) {
      e.preventDefault();
      confirm(filtered[activeIdx]);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  // Group by category (only when not searching)
  const showGrouped = query.trim() === '';
  const searchPlaceholder =
    scope === 'editor'
      ? 'Search inputs and groups...'
      : scope === 'layout'
        ? 'Search layout and content...'
        : 'Search types...';
  const grouped = showGrouped
    ? CATEGORIES
        .slice()
        .sort((a, b) => (a === 'Structure' ? -1 : b === 'Structure' ? 1 : 0))
        .map((cat) => ({
          cat,
          items: filtered.filter((f) => f.category === cat),
        }))
        .filter((g) => g.items.length > 0)
    : [{ cat: 'Results', items: filtered }];

  return (
    <div
      data-testid="add-item-palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 pt-4 backdrop-blur-[2px] sm:px-0 sm:pt-20"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="mx-0 flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        style={{ maxHeight: '72vh' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-border shrink-0 bg-subtle/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
                {title ?? 'Add Item'}
              </span>
              <span className="text-border">·</span>
              <span className="text-[11px] text-muted">↑↓ navigate · Ent confirm</span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors p-1"
              aria-label="Close palette"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div
            data-testid="add-item-search"
            className="mb-3 flex items-center rounded-xl border border-border bg-surface"
          >
            <div className="flex h-10 shrink-0 items-center border-r border-border px-3 text-muted/50">
              <svg className="h-4 w-4 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              className="h-10 w-full bg-transparent px-3 text-[14px] font-ui outline-none placeholder:text-muted/40"
            />
          </div>

          {/* Tabs */}
          {availableTabs.length > 0 && (
            <div className="flex gap-1 p-1 bg-subtle border border-border/50 rounded-lg">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setActiveIdx(0); }}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                    activeTab === tab.id
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-muted hover:text-ink hover:bg-surface/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-3">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              {scope === 'layout'
                ? <>Nothing matches &ldquo;{query}&rdquo;</>
                : <>No field types match &ldquo;{query}&rdquo;</>}
            </div>
          ) : (
            grouped.map(({ cat, items }, groupIdx) => (
              <div key={cat} className="mb-4 last:mb-0">
                {/* Divider after Structure */}
                {groupIdx > 0 && grouped[groupIdx - 1]?.cat === 'Structure' && (
                  <hr className="mb-4 -mt-1 border-border/50" />
                )}
                {(showGrouped || grouped.length > 1) && (
                  <div className="px-2 mb-1.5 font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-muted/70">
                    {cat}
                  </div>
                )}
                <div data-testid="add-item-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {items.map((opt) => {
                    const flatIdx = filtered.indexOf(opt);
                    const isActive = flatIdx === activeIdx;
                    return (
                      <button
                        key={`${opt.itemType}-${opt.dataType ?? opt.label}`}
                        type="button"
                        data-active={isActive}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer transition-all border ${
                          isActive
                            ? 'bg-accent/8 border-accent/30 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-subtle hover:border-border'
                        }`}
                        onClick={() => confirm(opt)}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                      >
                        <span
                          className={`font-mono text-[14px] leading-none mt-0.5 w-7 shrink-0 ${opt.color}`}
                          aria-hidden="true"
                        >
                          {opt.icon}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-[13px] font-semibold leading-tight ${isActive ? 'text-ink' : 'text-ink'}`}>
                            {opt.label}
                          </div>
                          <div className="text-[11px] text-muted leading-snug mt-0.5 truncate">
                            {opt.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
