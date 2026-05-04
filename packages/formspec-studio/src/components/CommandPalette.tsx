/** @filedesc Keyboard-driven command palette for searching and navigating items, variables, binds, and shapes. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeBindEntries, flatItems } from '@formspec-org/studio-core';
import { useDefinition } from '../state/useDefinition';
import { useSelection } from '../state/useSelection';
import type { FormShape, FormVariable } from '@formspec-org/types';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** AI authoring surface uses tighter copy before users switch to manual controls. */
  surface?: 'studio' | 'assistant';
}

interface PaletteResult {
  id: string;
  section: 'Actions' | 'Items' | 'Variables' | 'Binds' | 'Shapes';
  title: string;
  subtitle?: string;
  meta?: string;
  keywords: string[];
  onSelect: () => void;
  actionable?: boolean;
}

export function CommandPalette({ open, onClose, surface = 'studio' }: CommandPaletteProps) {
  const assistantSurface = surface === 'assistant';
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
  const shapes = (definition.shapes ?? []) as FormShape[];

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

    const variableResults = variables.map((variable: FormVariable) => ({
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

    const shapeResults = shapes.map((shape, index) => {
      const id = typeof shape.id === 'string' && shape.id.trim() ? shape.id.trim() : `shape-${index}`;
      const title = typeof shape.id === 'string' && shape.id.trim() ? shape.id.trim() : `Shape ${index + 1}`;
      return {
        id: `shape:${id}`,
        section: 'Shapes' as const,
        title,
        subtitle: shape.constraint || undefined,
        keywords: ['rule', 'shape', id, shape.constraint ?? '', shape.severity ?? ''],
        onSelect: () => onClose(),
        actionable: true,
      };
    });

    const actionResults: PaletteResult[] = [
      {
        id: 'action:mode-edit',
        section: 'Actions',
        title: 'Edit Mode',
        subtitle: 'Switch to the structural editor',
        keywords: ['go', 'mode', 'edit', 'editor', 'structure'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.SET_MODE, { mode: 'edit' });
          onClose();
        },
        actionable: true,
      },
      {
        id: 'action:mode-design',
        section: 'Actions',
        title: 'Design Mode',
        subtitle: 'Switch to visual styling and brand colors',
        keywords: ['go', 'mode', 'design', 'theme', 'style', 'colors', 'layout'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.SET_MODE, { mode: 'design' });
          onClose();
        },
        actionable: true,
      },
      {
        id: 'action:mode-preview',
        section: 'Actions',
        title: 'Preview Mode',
        subtitle: 'Test the form interactively',
        keywords: ['go', 'mode', 'preview', 'test', 'run'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.SET_MODE, { mode: 'preview' });
          onClose();
        },
        actionable: true,
      },
      {
        id: 'action:workspace-mapping',
        section: 'Actions',
        title: 'Data Mappings',
        subtitle: 'Configure import/export mapping rules',
        keywords: ['go', 'workspace', 'mapping', 'import', 'export', 'rules'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.SET_MODE, { mode: 'edit' });
          dispatchStudioEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, { tab: 'Mapping' });
          onClose();
        },
        actionable: true,
      },
      {
        id: 'action:workspace-evidence',
        section: 'Actions',
        title: 'Evidence Config',
        subtitle: 'Configure attachments and evidence collection',
        keywords: ['go', 'workspace', 'evidence', 'attachments'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.SET_MODE, { mode: 'edit' });
          dispatchStudioEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, { tab: 'Evidence' });
          onClose();
        },
        actionable: true,
      },
      {
        id: 'action:settings',
        section: 'Actions',
        title: 'Form Settings',
        subtitle: 'Edit form metadata and behavior',
        keywords: ['go', 'settings', 'metadata', 'behavior', 'config'],
        onSelect: () => {
          dispatchStudioEvent(STUDIO_EVENTS.OPEN_SETTINGS);
          onClose();
        },
        actionable: true,
      }
    ];

    return [...actionResults, ...itemResults, ...variableResults, ...bindResults, ...shapeResults];
  }, [binds, items, onClose, select, shapes, variables]);

  const query = search.trim().toLowerCase();
  const includeLogicResults = query === 'rule' || query === 'rules' || query === 'fel';
  const filteredResults = query
    ? results.filter((result) => {
        if (includeLogicResults && (result.section === 'Binds' || result.section === 'Shapes')) return true;
        return result.keywords.some((keyword) => keyword.toLowerCase().includes(query));
      })
    : results.filter((result) => result.section === 'Actions' || result.section === 'Items');

  const groupedResults = filteredResults.reduce<Record<string, PaletteResult[]>>((groups, result) => {
    groups[result.section] ??= [];
    groups[result.section].push(result);
    return groups;
  }, {});

  const orderedSections = ['Actions', 'Items', 'Variables', 'Binds', 'Shapes'].filter((section) => groupedResults[section]?.length);

  const handleSelect = (result: PaletteResult) => {
    result.onSelect();
    updateHighlightedIndex(0);
  };

  if (!open) return null;

  const searchPlaceholder = assistantSurface
    ? 'Search this draft (fields, variables, binds…)'
    : 'Search items, variables...';
  const searchAriaLabel = assistantSurface
    ? 'Search fields, variables, binds, and shapes in this draft'
    : 'Search items, variables, binds, and shapes';

  const listboxId = 'command-palette-listbox';
  const activeId = highlightedIndex >= 0 && filteredResults[highlightedIndex]
    ? `palette-result-${filteredResults[highlightedIndex].id}`
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden="true"
    >
      <div
        data-testid="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl"
      >
        <div className="p-3 border-b border-border">
          {assistantSurface ? (
            <p className="mb-2 text-[11px] leading-snug text-muted">
              Jump to a field or rule in the current draft. Full tabbed Studio opens after you enter workspace.
            </p>
          ) : null}
          <input
            type="text"
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            className="w-full px-3 py-2.5 text-[13.5px] bg-bg-default border border-border rounded-[4px] focus-visible:border-accent focus-ring transition-[border-color,box-shadow] font-ui"
            value={search}
            onInput={(e) => {
              setSearch((e.target as HTMLInputElement).value);
              updateHighlightedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
              }
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
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="max-h-80 overflow-y-auto p-2"
        >
          {orderedSections.map((section) => (
            <div key={section} role="group" aria-label={section}>
              <div className="px-2 py-1 text-xs text-muted font-medium uppercase" aria-hidden="true">{section}</div>
              {groupedResults[section].map((result) => {
                const resultIndex = filteredResults.findIndex((entry) => entry.id === result.id);
                const highlighted = resultIndex === highlightedIndex;
                const showSubtitleInline = result.section === 'Items' || result.section === 'Binds';

                return (
                  <div
                    key={result.id}
                    id={`palette-result-${result.id}`}
                    role="option"
                    aria-selected={highlighted}
                    data-testid="palette-result"
                    className={`px-3 py-1.5 flex items-center justify-between text-[13px] rounded-[4px] transition-colors ${
                      result.actionable === false ? 'text-muted' : 'cursor-pointer'
                    } ${
                      highlighted ? 'bg-accent/10 text-accent font-medium' : (result.actionable === false ? '' : 'hover:bg-subtle/80 hover:text-ink')
                    }`}
                    onClick={() => {
                      if (result.actionable === false) return;
                      handleSelect(result);
                    }}
                    title={result.subtitle}
                  >
                    <div className="flex-1 truncate">
                      <span className="font-medium mr-2">{result.title}</span>
                      {result.subtitle && showSubtitleInline ? (
                        <span className={`truncate ${highlighted ? 'text-accent/80' : 'text-muted'}`}>{result.subtitle}</span>
                      ) : null}
                    </div>
                    {result.meta ? (
                      <span className="ml-3 shrink-0 rounded border border-border/80 bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted font-mono">{result.meta}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
          {filteredResults.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted text-center" role="status">
              {assistantSurface
                ? 'No matches — describe fields in the assistant, pick a starter, or import JSON.'
                : 'No results found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
