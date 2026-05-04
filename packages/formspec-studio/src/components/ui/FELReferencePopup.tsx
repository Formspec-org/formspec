/** @filedesc Floating popover triggered by a (?) button listing all FEL function categories and signatures. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getBuiltinFELFunctionCatalog } from '@formspec-org/engine';

// ── UI display constants for FEL function categories ────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  Aggregate: 'text-accent',
  String: 'text-green',
  Numeric: 'text-amber',
  Date: 'text-logic',
  Logical: 'text-accent',
  Type: 'text-muted',
  Money: 'text-green',
  Repeat: 'text-amber',
  MIP: 'text-logic',
  Instance: 'text-muted',
  Locale: 'text-muted',
  Function: 'text-muted',
};

export const CATEGORY_ORDER = [
  'Aggregate', 'String', 'Numeric', 'Date', 'Logical', 'Type',
  'Money', 'Repeat', 'MIP', 'Instance', 'Locale', 'Function',
];

export function formatCategoryName(category: string): string {
  if (category === 'mip') return 'MIP';
  return category
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Function';
}

interface CatalogEntry {
  name: string;
  signature: string;
  description: string;
  category: string;
}

interface FELCategory {
  name: string;
  functions: CatalogEntry[];
}

interface FELReferencePopupProps {
  /** Optional tooltip / aria-label for the trigger button */
  label?: string;
}

/**
 * Compact floating FEL function reference panel.
 * Renders a small trigger button (?) that opens a positioned popover listing
 * all FEL categories and their function signatures.
 *
 * Designed to be embedded wherever FEL expressions are authored:
 * bind editors, shape constraint inputs, variable expressions, etc.
 */
export function FELReferencePopup({ label = 'FEL Reference' }: FELReferencePopupProps) {
  const [open, setOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeFunction, setActiveFunction] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const catalog = useMemo<FELCategory[]>(() => {
    const grouped = new Map<string, CatalogEntry[]>();
    for (const raw of getBuiltinFELFunctionCatalog()) {
      const entry: CatalogEntry = {
        name: raw.name,
        signature: raw.signature ?? '',
        description: raw.description ?? '',
        category: formatCategoryName(raw.category),
      };
      const functions = grouped.get(entry.category) ?? [];
      functions.push(entry);
      grouped.set(entry.category, functions);
    }
    return Array.from(grouped.entries())
      .map(([name, functions]) => ({
        name,
        functions: functions.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const left = CATEGORY_ORDER.indexOf(a.name);
        const right = CATEGORY_ORDER.indexOf(b.name);
        return (left === -1 ? CATEGORY_ORDER.length : left) - (right === -1 ? CATEGORY_ORDER.length : right);
      });
  }, []);

  const handleFunctionClick = async (fn: CatalogEntry) => {
    const copyText = fn.signature.split('->')[0]?.trim() ?? fn.name;
    try {
      await navigator.clipboard?.writeText(copyText);
    } catch {
      // Clipboard access is best-effort in tests and browser sandboxes.
    }
    setActiveFunction(fn.name);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Filter catalog by search query
  const filtered = query.trim()
    ? catalog.map((cat) => ({
        ...cat,
      functions: cat.functions.filter(
          (fn) =>
            fn.name.toLowerCase().includes(query.toLowerCase())
            || fn.description.toLowerCase().includes(query.toLowerCase()),
        ),
      })).filter((cat) => cat.functions.length > 0)
    : catalog;

  return (
    <div ref={containerRef} className={`relative inline-flex ${open ? 'z-[600]' : ''}`}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-5 h-5 rounded-full border text-[10px] font-bold font-mono flex items-center justify-center transition-colors cursor-pointer
          ${open
            ? 'border-accent text-accent bg-accent/10'
            : 'border-border text-muted hover:border-muted hover:text-ink'
          }`}
      >
        ?
      </button>

      {open && (
        <div
          data-testid="fel-reference-popup"
          className="absolute bottom-full right-0 mb-2 z-[200] w-72 rounded-2xl border border-border/60 bg-surface/95 backdrop-blur-xl shadow-premium-lg overflow-hidden flex flex-col animate-fade-in"
          style={{ maxHeight: '380px' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-subtle/30 flex items-center justify-between shrink-0">
            <span className="font-mono text-[10px] font-extrabold tracking-[0.15em] uppercase text-muted">
              Reference
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface transition-all active:scale-90"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-border shrink-0">
            <input
              type="text"
              placeholder="Search functions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-[12px] font-mono bg-subtle border border-border rounded-[3px] outline-none focus:border-accent placeholder:text-muted transition-colors"
              autoFocus
            />
          </div>

          {/* Function catalog */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted text-center">No matches</div>
            ) : (
              filtered.map((cat) => {
                const isExpanded = expandedCat === cat.name || query.trim() !== '';
                const catColor = CATEGORY_COLORS[cat.name] ?? 'text-muted';
                return (
                  <div key={cat.name} className="border-b border-border/50 last:border-0">
                    {/* Category header */}
                    <button
                      type="button"
                      data-fel-category={cat.name}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-subtle/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedCat(isExpanded && !query ? null : cat.name)}
                    >
                      <span className={`font-mono text-[10px] font-bold tracking-wider uppercase ${catColor}`}>
                        {cat.name}
                      </span>
                      {!query && (
                        <span className={`text-[9px] text-muted transition-transform duration-100 ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                      )}
                    </button>

                    {/* Functions */}
                    {isExpanded && (
                      <div className="pb-1">
                        {cat.functions.map((fn) => (
                          <button
                            key={fn.name}
                            type="button"
                            data-fel-fn={fn.name}
                            aria-selected={activeFunction === fn.name}
                            data-active={activeFunction === fn.name ? 'true' : 'false'}
                            className={`w-full px-3 py-1 text-left hover:bg-subtle/30 transition-colors ${activeFunction === fn.name ? 'fel-fn-active bg-subtle/40' : ''}`}
                            onClick={() => void handleFunctionClick(fn)}
                          >
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`font-mono text-[11px] font-semibold ${catColor}`}>{fn.name}</span>
                              <span className="font-mono text-[10px] text-muted">{fn.signature}</span>
                            </div>
                            <div className="text-[10px] text-muted leading-tight mt-0.5">{fn.description}</div>
                          </button>
                        ))}
                        {activeFunction && (
                          <div data-testid="fel-function-detail" className="px-3 py-2 text-[10px] text-muted border-t border-border/50">
                            Selected: {activeFunction}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
