import { useState, useEffect, useRef, useCallback } from 'react';

/** A user-visible field type option shown in the palette. */
export interface FieldTypeOption {
  /** Human-readable name, e.g. "Text" */
  label: string;
  /** Short description shown under the name */
  description: string;
  /** Monospace icon glyph */
  icon: string;
  /** CSS color class for the icon */
  color: string;
  /** Formspec item type */
  itemType: 'field' | 'group' | 'display' | 'layout';
  /** Component type for layout items (e.g. 'Card', 'Stack') */
  component?: string;
  /** Formspec data type (for field items) */
  dataType?: string;
  /** Extra payload merged into addItem (e.g. repeatable: true) */
  extra?: Record<string, unknown>;
  /** Category for grouping */
  category: string;
  /** Keywords used for search matching */
  keywords?: string[];
}

export const FIELD_TYPE_CATALOG: FieldTypeOption[] = [
  // ── Text ────────────────────────────────────────────────────────
  {
    label: 'Text',
    description: 'Short text — names, identifiers, free input',
    icon: 'Aa',
    color: 'text-accent',
    itemType: 'field',
    dataType: 'string',
    category: 'Text',
    keywords: ['string', 'text', 'name', 'label', 'input'],
  },
  // ── Numbers ─────────────────────────────────────────────────────
  {
    label: 'Integer',
    description: 'Whole numbers — counts, ages, quantities',
    icon: '#',
    color: 'text-green',
    itemType: 'field',
    dataType: 'integer',
    category: 'Number',
    keywords: ['int', 'number', 'whole', 'count', 'quantity'],
  },
  {
    label: 'Decimal',
    description: 'Numbers with decimal places — rates, percentages',
    icon: '#.#',
    color: 'text-green',
    itemType: 'field',
    dataType: 'decimal',
    category: 'Number',
    keywords: ['float', 'decimal', 'number', 'percent', 'rate'],
  },
  {
    label: 'Money',
    description: 'Currency amounts with formatting',
    icon: '$',
    color: 'text-amber',
    itemType: 'field',
    dataType: 'money',
    category: 'Number',
    keywords: ['currency', 'amount', 'price', 'cost', 'money'],
  },
  // ── Choice ──────────────────────────────────────────────────────
  {
    label: 'Single Choice',
    description: 'Pick exactly one option from a list',
    icon: '◉',
    color: 'text-logic',
    itemType: 'field',
    dataType: 'choice',
    category: 'Choice',
    keywords: ['radio', 'select', 'pick', 'option', 'choice', 'dropdown'],
  },
  {
    label: 'Multiple Choice',
    description: 'Pick one or more options from a list',
    icon: '☑',
    color: 'text-logic',
    itemType: 'field',
    dataType: 'multiChoice',
    category: 'Choice',
    keywords: ['checkbox', 'multi', 'select', 'option', 'choice'],
  },
  {
    label: 'Yes / No',
    description: 'Boolean toggle — true or false',
    icon: '⊘',
    color: 'text-logic',
    itemType: 'field',
    dataType: 'boolean',
    category: 'Choice',
    keywords: ['bool', 'boolean', 'toggle', 'flag', 'switch', 'true', 'false'],
  },
  // ── Date & Time ─────────────────────────────────────────────────
  {
    label: 'Date',
    description: 'Calendar date — year, month, day',
    icon: '📅',
    color: 'text-amber',
    itemType: 'field',
    dataType: 'date',
    category: 'Date & Time',
    keywords: ['date', 'calendar', 'day', 'month', 'year'],
  },
  {
    label: 'Time',
    description: 'Time of day — hours and minutes',
    icon: '🕐',
    color: 'text-amber',
    itemType: 'field',
    dataType: 'time',
    category: 'Date & Time',
    keywords: ['time', 'hour', 'minute', 'clock'],
  },
  {
    label: 'Date & Time',
    description: 'Combined timestamp — date plus time',
    icon: '📅🕐',
    color: 'text-amber',
    itemType: 'field',
    dataType: 'dateTime',
    category: 'Date & Time',
    keywords: ['datetime', 'timestamp', 'date', 'time'],
  },
  // ── Media & Capture ─────────────────────────────────────────────
  {
    label: 'File Upload',
    description: 'Attach a file, photo, or document',
    icon: '📎',
    color: 'text-muted',
    itemType: 'field',
    dataType: 'binary',
    category: 'Media',
    keywords: ['file', 'upload', 'photo', 'image', 'attachment', 'binary'],
  },
  {
    label: 'Barcode',
    description: 'Scan or enter a barcode / QR code',
    icon: '|||',
    color: 'text-muted',
    itemType: 'field',
    dataType: 'barcode',
    category: 'Media',
    keywords: ['barcode', 'qr', 'scan'],
  },
  {
    label: 'Location',
    description: 'GPS coordinates — latitude and longitude',
    icon: '📍',
    color: 'text-green',
    itemType: 'field',
    dataType: 'geopoint',
    category: 'Media',
    keywords: ['geopoint', 'gps', 'location', 'map', 'coordinates'],
  },
  // ── Structure ───────────────────────────────────────────────────
  {
    label: 'Group',
    description: 'Container for a set of related fields',
    icon: '▦',
    color: 'text-muted',
    itemType: 'group',
    category: 'Structure',
    keywords: ['group', 'section', 'container', 'nest'],
  },
  {
    label: 'Repeatable Group',
    description: 'A group the respondent fills in multiple times',
    icon: '⟳▦',
    color: 'text-accent',
    itemType: 'group',
    extra: { repeatable: true },
    category: 'Structure',
    keywords: ['repeat', 'repeatable', 'group', 'loop', 'multiple'],
  },
  // ── Content ─────────────────────────────────────────────────────
  {
    label: 'Text Block',
    description: 'Read-only text, instructions, or content',
    icon: 'ℹ',
    color: 'text-accent',
    itemType: 'display',
    category: 'Content',
    keywords: ['display', 'text', 'note', 'read-only', 'info', 'instruction'],
  },
  {
    label: 'Heading',
    description: 'Section heading or title',
    icon: 'H',
    color: 'text-accent',
    itemType: 'display',
    extra: { presentation: { widgetHint: 'Heading' } },
    category: 'Content',
    keywords: ['heading', 'title', 'header', 'h1', 'h2'],
  },
  {
    label: 'Divider',
    description: 'Horizontal line to separate content',
    icon: '—',
    color: 'text-muted',
    itemType: 'display',
    extra: { presentation: { widgetHint: 'Divider' } },
    category: 'Content',
    keywords: ['divider', 'separator', 'line', 'hr'],
  },
  {
    label: 'Spacer',
    description: 'Vertical space between items',
    icon: '↕',
    color: 'text-muted',
    itemType: 'display',
    extra: { presentation: { widgetHint: 'Spacer' } },
    category: 'Content',
    keywords: ['spacer', 'space', 'gap', 'padding'],
  },
  // ── Layout ────────────────────────────────────────────────────
  {
    label: 'Card',
    description: 'Bordered container with optional title',
    icon: '▢',
    color: 'text-accent',
    itemType: 'layout',
    component: 'Card',
    category: 'Layout',
    keywords: ['card', 'box', 'container', 'panel'],
  },
  {
    label: 'Columns',
    description: 'Side-by-side column layout',
    icon: '▥',
    color: 'text-accent',
    itemType: 'layout',
    component: 'Columns',
    category: 'Layout',
    keywords: ['columns', 'grid', 'side', 'two', 'multi'],
  },
  {
    label: 'Collapsible',
    description: 'Expandable/collapsible section',
    icon: '▽',
    color: 'text-accent',
    itemType: 'layout',
    component: 'Collapsible',
    category: 'Layout',
    keywords: ['collapsible', 'accordion', 'expand', 'collapse', 'toggle'],
  },
  {
    label: 'Stack',
    description: 'Vertical or horizontal stack container',
    icon: '▤',
    color: 'text-accent',
    itemType: 'layout',
    component: 'Stack',
    category: 'Layout',
    keywords: ['stack', 'vertical', 'horizontal', 'list', 'column'],
  },
];

const CATEGORIES = [...new Set(FIELD_TYPE_CATALOG.map((f) => f.category))];

interface AddItemPaletteProps {
  open: boolean;
  onClose: () => void;
  onAdd: (option: FieldTypeOption) => void;
}

/**
 * Full-screen modal palette for adding form items.
 *
 * Shows field types grouped by category with icons, descriptions, and a live
 * search filter. Keyboard-navigable: arrows move focus, Enter confirms, Escape
 * closes. Clicking the backdrop also closes.
 */
export function AddItemPalette({ open, onClose, onAdd }: AddItemPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'field' | 'layout' | 'display'>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveTab('all');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = FIELD_TYPE_CATALOG.filter((opt) => {
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
  const grouped = showGrouped
    ? CATEGORIES.map((cat) => ({
        cat,
        items: filtered.filter((f) => f.category === cat),
      })).filter((g) => g.items.length > 0)
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
                Add Item
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
          <div className="relative group mb-3">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-muted/50 group-focus-within:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search types..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              className="w-full pl-9 pr-3 py-2 text-[14px] font-ui bg-surface border border-border rounded-xl outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 placeholder:text-muted/40 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-subtle border border-border/50 rounded-lg">
            {[
              { id: 'all', label: 'All' },
              { id: 'field', label: 'Inputs' },
              { id: 'layout', label: 'Layout' },
              { id: 'display', label: 'Display' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setActiveIdx(0); }}
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
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-3">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No field types match &ldquo;{query}&rdquo;</div>
          ) : (
            grouped.map(({ cat, items }) => (
              <div key={cat} className="mb-4 last:mb-0">
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
