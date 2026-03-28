/** @filedesc Keyboard-driven command palette for searching and navigating items, variables, binds, and shapes. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeBindEntries, flatItems } from '@formspec-org/studio-core';
import { useDefinition } from '../state/useDefinition';
import { useSelection } from '../state/useSelection';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteResult {
  id: string;
  section: 'Items' | 'Variables' | 'Binds' | 'Shapes';
  title: string;
  subtitle?: string;
  meta?: string;
  keywords: string[];
  onSelect: () => void;
  actionable?: boolean;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const definition = useDefinition();
  const { select } = useSelection();
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const highlightedIndexRef = useRef(0);

  const updateHighlightedIndex = (next: number) => {
    highlightedIndexRef.current = next;
    setHighlightedIndex(next);
  };

  useEffect(() => {
    if (!open) {
      setSearch('');
      updateHighlightedIndex(0);
    }
  }, [open]);

  const items = definition.items ? flatItems(definition.items) : [];
  const variables = definition.variables ?? [];
  const binds = normalizeBindEntries(definition.binds);
  const shapes = (definition.shapes ?? []) as Array<Record<string, any>>;

  const results = useMemo<PaletteResult[]>(() => {
    const itemResults = items.map((fi) => ({
      id: `item:${fi.path}`,
      section: 'Items' as const,
      title: fi.path,
      subtitle: fi.item.label || undefined,
      keywords: [fi.path, fi.item.label ?? ''],
      onSelect: () => {
        select(fi.path, fi.item.type, { tab: 'editor' });
        onClose();
      },
      actionable: true,
    }));

    const variableResults = variables.map((variable: any) => ({
      id: `variable:${variable.name}`,
      section: 'Variables' as const,
      title: variable.name,
      subtitle: variable.expression || undefined,
      meta: 'read-only',
      keywords: [variable.name ?? '', variable.expression ?? ''],
      onSelect: () => {
        return;
      },
      actionable: false,
    }));

    const bindResults = binds.map((bind) => {
      const detail = Object.entries(bind.entries)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' • ');
      return {
        id: `bind:${bind.path}`,
        section: 'Binds' as const,
        title: bind.path,
        subtitle: detail,
        keywords: ['rule', 'bind', bind.path, ...Object.keys(bind.entries), ...Object.values(bind.entries)],
        onSelect: () => {
          select(bind.path, 'field', { tab: 'editor' });
          onClose();
        },
        actionable: true,
      };
    });

    const shapeResults = shapes.map((shape, index) => ({
      id: `shape:${shape.name ?? index}`,
      section: 'Shapes' as const,
      title: shape.name || `Shape ${index + 1}`,
      subtitle: shape.constraint || undefined,
      keywords: ['rule', 'shape', shape.name ?? '', shape.constraint ?? '', shape.severity ?? ''],
      onSelect: () => onClose(),
      actionable: true,
    }));

    return [...itemResults, ...variableResults, ...bindResults, ...shapeResults];
  }, [binds, items, onClose, select, shapes, variables]);

  const query = search.trim().toLowerCase();
  const includeLogicResults = query === 'rule' || query === 'rules' || query === 'fel';
  const filteredResults = query
    ? results.filter((result) => {
        if (includeLogicResults && (result.section === 'Binds' || result.section === 'Shapes')) return true;
        return result.keywords.some((keyword) => keyword.toLowerCase().includes(query));
      })
    : results.filter((result) => result.section === 'Items');

  const groupedResults = filteredResults.reduce<Record<string, PaletteResult[]>>((groups, result) => {
    groups[result.section] ??= [];
    groups[result.section].push(result);
    return groups;
  }, {});

  const orderedSections = ['Items', 'Variables', 'Binds', 'Shapes'].filter((section) => groupedResults[section]?.length);

  const handleSelect = (result: PaletteResult) => {
    result.onSelect();
    updateHighlightedIndex(0);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div data-testid="command-palette" className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl">
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Search items, variables..."
            className="w-full px-3 py-2 text-sm bg-bg border border-border rounded outline-none focus:border-accent"
            value={search}
            onInput={(e) => {
              setSearch((e.target as HTMLInputElement).value);
              updateHighlightedIndex(0);
            }}
            onKeyDown={(event) => {
              if (filteredResults.length === 0) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                updateHighlightedIndex(Math.min(highlightedIndexRef.current + 1, filteredResults.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                updateHighlightedIndex(Math.max(highlightedIndexRef.current - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                handleSelect(filteredResults[highlightedIndexRef.current] ?? filteredResults[0]);
              }
            }}
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {orderedSections.map((section) => (
            <div key={section}>
              <div className="px-2 py-1 text-xs text-muted font-medium uppercase">{section}</div>
              {groupedResults[section].map((result) => {
                const resultIndex = filteredResults.findIndex((entry) => entry.id === result.id);
                const highlighted = resultIndex === highlightedIndex;
                const showSubtitleInline = result.section === 'Items' || result.section === 'Binds';

                return (
                  <div
                    key={result.id}
                    data-testid="palette-result"
                    className={`px-3 py-2 text-sm rounded ${
                      result.actionable === false ? 'text-muted' : 'cursor-pointer'
                    } ${
                      highlighted ? 'bg-subtle text-ink' : (result.actionable === false ? '' : 'hover:bg-surface-hover')
                    }`}
                    onClick={() => {
                      if (result.actionable === false) return;
                      handleSelect(result);
                    }}
                    title={result.subtitle}
                  >
                    <span className="font-medium">{result.title}</span>
                    {result.subtitle && showSubtitleInline ? (
                      <span className="ml-2 text-muted">{result.subtitle}</span>
                    ) : null}
                    {result.meta ? (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-muted">{result.meta}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
          {filteredResults.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted text-center">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
}
