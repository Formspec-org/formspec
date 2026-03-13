import { useEffect, useMemo, useRef, useState } from 'react';
import { getBuiltinFELFunctionCatalog, type FELBuiltinFunctionCatalogEntry } from 'formspec-engine';

interface FELFunction {
  name: string;
  signature: string;
  description: string;
}

interface FELCategory {
  name: string;
  functions: FELFunction[];
}

const CATEGORY_COLORS: Record<string, string> = {
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
  Function: 'text-muted',
};

const CATEGORY_ORDER = ['Aggregate', 'String', 'Numeric', 'Date', 'Logical', 'Type', 'Money', 'Repeat', 'MIP', 'Instance', 'Function'];

const FUNCTION_DETAILS: Record<string, { signature: string; description: string }> = {
  abs: { signature: '(num) → number', description: 'Absolute value' },
  avg: { signature: '(nodeset) → number', description: 'Average of numeric values' },
  boolean: { signature: '(value) → boolean', description: 'Cast a value to boolean' },
  coalesce: { signature: '(a, b, ...) → any', description: 'Return the first non-null value' },
  concat: { signature: '(a, b, ...) → text', description: 'Concatenate values into a string' },
  contains: { signature: '(haystack, needle) → boolean', description: 'Check whether text contains a value' },
  count: { signature: '(nodeset) → number', description: 'Count matching nodes' },
  countWhere: { signature: '(nodeset, predicate) → number', description: 'Count nodes matching a predicate' },
  ceil: { signature: '(num) → number', description: 'Round up' },
  date: { signature: '(value) → date', description: 'Parse a value as a date' },
  dateAdd: { signature: '(date, amount, unit) → date', description: 'Add time to a date' },
  dateDiff: { signature: '(a, b, unit) → number', description: 'Compute the difference between dates' },
  day: { signature: '(date) → number', description: 'Extract day of month' },
  endsWith: { signature: '(value, suffix) → boolean', description: 'Check whether text ends with a suffix' },
  empty: { signature: '(value) → boolean', description: 'Check whether a value is empty' },
  floor: { signature: '(num) → number', description: 'Round down' },
  format: { signature: '(template, ...) → text', description: 'Format text with positional arguments' },
  hours: { signature: '(time) → number', description: 'Extract hour value from a time' },
  if: { signature: '(condition, then, else) → any', description: 'Conditional expression' },
  instance: { signature: '(name, path?) → any', description: 'Read from an external instance' },
  isDate: { signature: '(value) → boolean', description: 'Check whether a value is a date-like value' },
  isNumber: { signature: '(value) → boolean', description: 'Check whether a value is numeric' },
  isString: { signature: '(value) → boolean', description: 'Check whether a value is text' },
  isNull: { signature: '(value) → boolean', description: 'Check whether a value is nullish' },
  length: { signature: '(value) → number', description: 'Length of a string value' },
  lower: { signature: '(value) → text', description: 'Lowercase a string' },
  max: { signature: '(nodeset) → number', description: 'Maximum numeric value' },
  matches: { signature: '(value, pattern) → boolean', description: 'Check whether text matches a pattern' },
  min: { signature: '(nodeset) → number', description: 'Minimum numeric value' },
  minutes: { signature: '(time) → number', description: 'Extract minute value from a time' },
  money: { signature: '(amount, currency) → money', description: 'Construct a money value' },
  moneyAdd: { signature: '(a, b) → money', description: 'Add two money values' },
  moneyAmount: { signature: '(money) → number', description: 'Extract the numeric amount from money' },
  moneyCurrency: { signature: '(money) → text', description: 'Extract the currency code from money' },
  moneySum: { signature: '(nodeset) → money', description: 'Sum money values' },
  month: { signature: '(date) → number', description: 'Extract month number' },
  next: { signature: '(path) → any', description: 'Read the next repeat sibling value' },
  now: { signature: '() → dateTime', description: 'Current date and time' },
  number: { signature: '(value) → number', description: 'Cast a value to number' },
  parent: { signature: '(path) → any', description: 'Read a parent value' },
  power: { signature: '(base, exponent) → number', description: 'Raise a number to a power' },
  present: { signature: '(value) → boolean', description: 'Check whether a value is present' },
  prev: { signature: '(path) → any', description: 'Read the previous repeat sibling value' },
  relevant: { signature: '(path) → boolean', description: 'Read current relevance state' },
  readonly: { signature: '(path) → boolean', description: 'Read current readonly state' },
  replace: { signature: '(value, pattern, replacement) → text', description: 'Replace text using a pattern' },
  required: { signature: '(path) → boolean', description: 'Read current required state' },
  round: { signature: '(num, digits?) → number', description: 'Round to the nearest value' },
  seconds: { signature: '(time) → number', description: 'Extract second value from a time' },
  selected: { signature: '(value, candidate) → boolean', description: 'Check whether a choice is selected' },
  startsWith: { signature: '(value, prefix) → boolean', description: 'Check whether text starts with a prefix' },
  string: { signature: '(value) → text', description: 'Cast a value to text' },
  substring: { signature: '(value, start, length?) → text', description: 'Extract part of a string' },
  sum: { signature: '(nodeset) → number', description: 'Sum numeric values' },
  time: { signature: '(value) → time', description: 'Parse a value as a time' },
  timeDiff: { signature: '(a, b, unit) → number', description: 'Compute the difference between times' },
  today: { signature: '() → date', description: 'Current date' },
  trim: { signature: '(value) → text', description: 'Trim surrounding whitespace' },
  typeOf: { signature: '(value) → text', description: 'Return the FEL type of a value' },
  upper: { signature: '(value) → text', description: 'Uppercase a string' },
  valid: { signature: '(path) → boolean', description: 'Read current validation state' },
  year: { signature: '(date) → number', description: 'Extract year number' },
};

function formatCategoryName(category: string): string {
  if (category === 'mip') return 'MIP';
  return category
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Function';
}

function toCatalogFunction(entry: FELBuiltinFunctionCatalogEntry): FELFunction {
  const details = FUNCTION_DETAILS[entry.name];
  return {
    name: entry.name,
    signature: details?.signature ?? '()',
    description: details?.description ?? 'Built-in FEL function',
  };
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
    const grouped = new Map<string, FELFunction[]>();
    for (const entry of getBuiltinFELFunctionCatalog()) {
      const category = formatCategoryName(entry.category);
      const functions = grouped.get(category) ?? [];
      functions.push(toCatalogFunction(entry));
      grouped.set(category, functions);
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

  const handleFunctionClick = async (fn: FELFunction) => {
    const copyText = `${fn.name}${fn.signature.split('→')[0].trim()}`;
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
                          <button
                            key={fn.name}
                            type="button"
                            aria-selected={activeFunction === fn.name}
                            data-active={activeFunction === fn.name ? 'true' : 'false'}
                            className={`w-full px-3 py-1 text-left hover:bg-subtle/30 transition-colors ${activeFunction === fn.name ? 'fel-fn-active bg-subtle/40' : ''}`}
                            onClick={() => void handleFunctionClick(fn)}
                          >
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`font-mono text-[11px] font-semibold ${catColor}`}>{fn.name}</span>
                              <span className="font-mono text-[10px] text-muted">{fn.signature}</span>
                            </div>
                            <div className="text-[10px] text-muted/80 leading-tight mt-0.5">{fn.description}</div>
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
