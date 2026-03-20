/** @filedesc Collapsible right panel listing definition items for page placement. */
import { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/react';
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
  const groups: PaletteGroup[] = [];

  for (const item of items) {
    if ((item as any).type === 'group' && (item as any).children?.length > 0) {
      // Group with children — show as a named section
      const children: PaletteItem[] = ((item as any).children ?? []).map((child: any) => ({
        key: child.key,
        label: child.label ?? child.key,
        type: child.type ?? 'field',
        placed: child.key in itemPageMap,
      }));
      groups.push({
        key: item.key,
        label: item.label ?? item.key,
        items: children,
      });
    } else {
      // Top-level non-group items go to a root section
      const existing = groups.find(g => g.key === null);
      const paletteItem: PaletteItem = {
        key: item.key,
        label: item.label ?? item.key,
        type: (item as any).type ?? 'field',
        placed: item.key in itemPageMap,
      };
      if (existing) {
        existing.items.push(paletteItem);
      } else {
        groups.unshift({ key: null, label: 'Items', items: [paletteItem] });
      }
    }
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
                {group.items.map((item) =>
                  item.placed ? (
                    <div
                      key={item.key}
                      data-testid={`palette-item-${item.key}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] opacity-50 cursor-default"
                    >
                      <TypeIcon type={item.type} />
                      <span className="flex-1 min-w-0 text-ellipsis overflow-hidden whitespace-nowrap">{item.label}</span>
                      <span data-placed="true" className="text-[10px] text-accent shrink-0" aria-label="placed">&#10003;</span>
                    </div>
                  ) : (
                    <DraggablePaletteItem
                      key={item.key}
                      item={item}
                      onQuickAdd={() => project.placeOnPage(item.key, pageId, { span: 12 })}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Draggable wrapper for unplaced palette items. */
function DraggablePaletteItem({
  item,
  onQuickAdd,
}: {
  item: PaletteItem;
  onQuickAdd: () => void;
}) {
  const { ref, isDragSource } = useDraggable({
    id: `palette-${item.key}`,
    data: { type: 'palette-item', key: item.key },
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-testid={`palette-item-${item.key}`}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors hover:bg-subtle/50 cursor-grab${isDragSource ? ' opacity-40' : ''}`}
    >
      <TypeIcon type={item.type} />
      <span className="flex-1 min-w-0 text-ellipsis overflow-hidden whitespace-nowrap">{item.label}</span>
      <button
        type="button"
        aria-label="Add to page"
        onClick={(e) => {
          e.stopPropagation();
          onQuickAdd();
        }}
        className="text-[11px] text-muted hover:text-accent transition-colors shrink-0 px-1"
      >
        +
      </button>
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
