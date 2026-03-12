import { useEffect, useMemo, useRef, useState } from 'react';
import { useDefinition } from '../state/useDefinition';
import { useSelection } from '../state/useSelection';
import { flatItems } from '../lib/field-helpers';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteResult {
  id: string;
  section: 'Items' | 'Variables' | 'Binds' | 'Shapes';
  title: string;
  subtitle?: string;
  keywords: string[];
  onSelect: () => void;
}

function normalizeBinds(binds: unknown): Array<{ path: string; entries: Record<string, string> }> {
  if (Array.isArray(binds)) {
    return binds.map((bind: any) => {
      const entries = Object.fromEntries(
        Object.entries(bind ?? {}).filter(([key, value]) => key !== 'path' && typeof value === 'string')
      );
      return { path: bind.path ?? '', entries };
    });
  }

  return Object.entries((binds as Record<string, Record<string, string>>) ?? {}).map(([path, value]) => ({
    path,
    entries: Object.fromEntries(
      Object.entries(value ?? {}).filter(([, entryValue]) => typeof entryValue === 'string')
    ),
  }));
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

  const items = definition.items ? flatItems(definition.items as any[]) : [];
  const variables = (definition as any).variables ?? [];
  const binds = normalizeBinds((definition as any).binds);
  const shapes = ((definition as any).shapes ?? []) as Array<Record<string, any>>;

  const results = useMemo<PaletteResult[]>(() => {
    const itemResults = items.map((fi) => ({
      id: `item:${fi.path}`,
      section: 'Items' as const,
      title: fi.path,
      subtitle: (fi.item as any).label || undefined,
      keywords: [fi.path, (fi.item as any).label ?? ''],
      onSelect: () => {
        select(fi.path, (fi.item as any).type);
        onClose();
      },
    }));

    const variableResults = variables.map((variable: any) => ({
      id: `variable:${variable.name}`,
      section: 'Variables' as const,
      title: variable.name,
      subtitle: variable.expression || undefined,
      keywords: [variable.name ?? '', variable.expression ?? ''],
      onSelect: () => {
        onClose();
      },
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
          select(bind.path, 'field');
          onClose();
        },
      };
    });

    const shapeResults = shapes.map((shape, index) => ({
      id: `shape:${shape.name ?? index}`,
      section: 'Shapes' as const,
      title: shape.name || `Shape ${index + 1}`,
      subtitle: shape.constraint || undefined,
      keywords: ['rule', 'shape', shape.name ?? '', shape.constraint ?? '', shape.severity ?? ''],
      onSelect: () => onClose(),
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
                    className={`px-3 py-2 text-sm rounded cursor-pointer ${highlighted ? 'bg-subtle text-ink' : 'hover:bg-surface-hover'}`}
                    onClick={() => handleSelect(result)}
                    title={result.subtitle}
                  >
                    <span className="font-medium">{result.title}</span>
                    {result.subtitle && showSubtitleInline ? (
                      <span className="ml-2 text-muted">{result.subtitle}</span>
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
