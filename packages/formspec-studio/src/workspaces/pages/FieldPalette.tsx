/** @filedesc Collapsible right panel listing definition items for page placement. */
import { useMemo } from 'react';
import { usePageStructure } from './usePageStructure';
import { useProjectState } from '../../state/useProjectState';
import { useProject } from '../../state/useProject';
import type { FormItem } from 'formspec-types';

interface FieldPaletteProps {
  pageId: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface PaletteItem {
  key: string;
  label: string;
  type: string;
  placed: boolean;
}

interface PaletteGroup {
  key: string | null; // null = root items
  label: string;
  items: PaletteItem[];
}

/** Build palette groups from definition items + page structure. */
function buildPaletteGroups(
  items: FormItem[],
  itemPageMap: Record<string, string>,
): PaletteGroup[] {
  const rootItems: PaletteItem[] = [];
  const groups: PaletteGroup[] = [];

  for (const item of items) {
    const paletteItem: PaletteItem = {
      key: item.key,
      label: item.label ?? item.key,
      type: (item as any).type ?? 'field',
      placed: item.key in itemPageMap,
    };

    // Top-level items go to root group
    rootItems.push(paletteItem);
  }

  // Build root group
  if (rootItems.length > 0) {
    groups.unshift({ key: null, label: 'Items', items: rootItems });
  }

  return groups;
}

export function FieldPalette({ pageId, isOpen, onToggle }: FieldPaletteProps) {
  const project = useProject();
  const state = useProjectState();
  const structure = usePageStructure();

  const groups = useMemo(
    () => buildPaletteGroups(
      (state.definition.items ?? []) as FormItem[],
      structure.itemPageMap,
    ),
    [state.definition.items, structure.itemPageMap],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border/40 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Fields
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-[10px] text-muted hover:text-ink transition-colors"
          aria-label="Close palette"
        >
          &times;
        </button>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {groups.map((group) => {
          const placedCount = group.items.filter((i) => i.placed).length;
          const totalCount = group.items.length;

          return (
            <div key={group.key ?? '__root'}>
              {/* Group header — only show for named groups */}
              {group.key !== null && (
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">
                    {group.label}
                  </span>
                  <span className="text-[9px] text-muted shrink-0">
                    {placedCount}/{totalCount}
                  </span>
                </div>
              )}

              {/* Item list */}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    data-testid={`palette-item-${item.key}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors ${
                      item.placed
                        ? 'opacity-50 cursor-default'
                        : 'hover:bg-subtle/50 cursor-grab'
                    }`}
                  >
                    {/* Type icon */}
                    <TypeIcon type={item.type} />

                    {/* Label */}
                    <span className="flex-1 truncate">{item.label}</span>

                    {/* Placed indicator or quick-add */}
                    {item.placed ? (
                      <span
                        data-placed="true"
                        className="text-[10px] text-accent shrink-0"
                        aria-label="placed"
                      >
                        &#10003;
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label="Add to page"
                        onClick={() => {
                          project.placeOnPage(item.key, pageId, { span: 12 });
                        }}
                        className="text-[11px] text-muted hover:text-accent transition-colors shrink-0 px-1"
                      >
                        +
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Simple type icon for palette items. */
function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    field: 'F',
    group: 'G',
    display: 'D',
  };
  return (
    <span className="w-4 h-4 flex items-center justify-center rounded bg-subtle text-[9px] font-bold text-muted shrink-0">
      {icons[type] ?? '?'}
    </span>
  );
}
