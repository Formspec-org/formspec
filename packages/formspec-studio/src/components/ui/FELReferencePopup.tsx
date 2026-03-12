import { useState, useRef, useEffect } from 'react';

interface FELFunction {
  name: string;
  signature: string;
  description: string;
}

interface FELCategory {
  name: string;
  functions: FELFunction[];
}

const FEL_CATALOG: FELCategory[] = [
  {
    name: 'Aggregate',
    functions: [
      { name: 'sum', signature: '(nodeset) → number', description: 'Sum of numeric values' },
      { name: 'count', signature: '(nodeset) → number', description: 'Count of nodes' },
      { name: 'min', signature: '(nodeset) → number', description: 'Minimum value' },
      { name: 'max', signature: '(nodeset) → number', description: 'Maximum value' },
      { name: 'avg', signature: '(nodeset) → number', description: 'Average of numeric values' },
    ],
  },
  {
    name: 'String',
    functions: [
      { name: 'concat', signature: '(a, b, ...) → text', description: 'Concatenate values' },
      { name: 'contains', signature: '(haystack, needle) → boolean', description: 'Check presence' },
      { name: 'startsWith', signature: '(val, prefix) → boolean', description: 'Check prefix' },
      { name: 'endsWith', signature: '(val, suffix) → boolean', description: 'Check suffix' },
      { name: 'substring', signature: '(val, start, length?) → text', description: 'Extract portion' },
      { name: 'string-length', signature: '(val) → number', description: 'Length of value' },
      { name: 'normalize-space', signature: '(val) → text', description: 'Normalize whitespace' },
      { name: 'translate', signature: '(val, from, to) → text', description: 'Character translation' },
    ],
  },
  {
    name: 'Numeric',
    functions: [
      { name: 'round', signature: '(num, digits?) → number', description: 'Round to nearest' },
      { name: 'floor', signature: '(num) → number', description: 'Round down' },
      { name: 'ceil', signature: '(num) → number', description: 'Round up' },
      { name: 'abs', signature: '(num) → number', description: 'Absolute value' },
      { name: 'pow', signature: '(base, exp) → number', description: 'Exponentiation' },
      { name: 'sqrt', signature: '(num) → number', description: 'Square root' },
      { name: 'mod', signature: '(a, b) → number', description: 'Modulo remainder' },
    ],
  },
  {
    name: 'Date',
    functions: [
      { name: 'today', signature: '() → date', description: 'Current date' },
      { name: 'now', signature: '() → dateTime', description: 'Current date and time' },
      { name: 'date', signature: '(val) → date', description: 'Parse date value' },
      { name: 'formatDate', signature: '(date, pattern) → text', description: 'Format date' },
      { name: 'dateDiff', signature: '(a, b, unit) → number', description: 'Difference between dates' },
    ],
  },
  {
    name: 'Logical',
    functions: [
      { name: 'if', signature: '(cond, then, else) → any', description: 'Conditional expression' },
      { name: 'coalesce', signature: '(a, b, ...) → any', description: 'First non-null value' },
      { name: 'boolean', signature: '(value) → boolean', description: 'Cast to boolean' },
      { name: 'not', signature: '(value) → boolean', description: 'Logical negation' },
    ],
  },
  {
    name: 'Type',
    functions: [
      { name: 'string', signature: '(value) → text', description: 'Cast to text' },
      { name: 'number', signature: '(value) → number', description: 'Cast to number' },
      { name: 'int', signature: '(value) → integer', description: 'Cast to integer' },
      { name: 'boolean-from-string', signature: '(text) → boolean', description: 'Parse boolean' },
    ],
  },
  {
    name: 'Money',
    functions: [
      { name: 'formatMoney', signature: '(amount, currency?) → text', description: 'Format monetary value' },
      { name: 'convertCurrency', signature: '(amount, from, to) → number', description: 'Convert currencies' },
    ],
  },
  {
    name: 'Repeat',
    functions: [
      { name: 'indexed-repeat', signature: '(path, group, index) → any', description: 'Access indexed repeat value' },
      { name: 'position', signature: '() → number', description: 'Current repeat position' },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Aggregate: 'text-accent',
  String: 'text-green',
  Numeric: 'text-amber',
  Date: 'text-logic',
  Logical: 'text-accent',
  Type: 'text-muted',
  Money: 'text-green',
  Repeat: 'text-amber',
};

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
  const containerRef = useRef<HTMLDivElement>(null);

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
    ? FEL_CATALOG.map((cat) => ({
        ...cat,
        functions: cat.functions.filter(
          (fn) =>
            fn.name.toLowerCase().includes(query.toLowerCase()) ||
            fn.description.toLowerCase().includes(query.toLowerCase()),
        ),
      })).filter((cat) => cat.functions.length > 0)
    : FEL_CATALOG;

  return (
    <div ref={containerRef} className="relative inline-flex">
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
          className="absolute bottom-full right-0 mb-2 z-50 w-72 rounded-[6px] border border-border bg-surface shadow-lg overflow-hidden flex flex-col"
          style={{ maxHeight: '380px' }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
            <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase text-muted">
              FEL Reference
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-ink text-[12px] cursor-pointer"
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
              className="w-full px-2 py-1 text-[12px] font-mono bg-subtle border border-border rounded-[3px] outline-none focus:border-accent placeholder:text-muted/50 transition-colors"
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
                          <div key={fn.name} className="px-3 py-1 hover:bg-subtle/30 transition-colors">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`font-mono text-[11px] font-semibold ${catColor}`}>{fn.name}</span>
                              <span className="font-mono text-[10px] text-muted">{fn.signature}</span>
                            </div>
                            <div className="text-[10px] text-muted/80 leading-tight mt-0.5">{fn.description}</div>
                          </div>
                        ))}
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
