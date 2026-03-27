/** @filedesc DnD wrapper for the DefinitionTreeEditor — reorders definition.items, not component tree. */
import { useState, useCallback, type ReactNode } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useProject } from '../../state/useProject';
import { useSelection } from '../../state/useSelection';

import type { FormItem } from '@formspec-org/types';

const EDITOR_TAB = 'editor';

/** Flatten the definition item tree into path-ordered entries. */
function flattenItems(items: FormItem[], parentPath: string): { path: string; parentPath: string }[] {
  const result: { path: string; parentPath: string }[] = [];
  for (const item of items) {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    result.push({ path, parentPath });
    if (item.type === 'group' && item.children) {
      result.push(...flattenItems(item.children, path));
    }
  }
  return result;
}

/** Resolve a path to its sibling index within its parent's children. */
function indexInParent(items: FormItem[], path: string): { siblings: FormItem[]; index: number } | null {
  const segments = path.split('.');
  const key = segments[segments.length - 1];

  if (segments.length === 1) {
    const index = items.findIndex(i => i.key === key);
    return index >= 0 ? { siblings: items, index } : null;
  }

  // Walk to parent
  let current = items;
  for (let i = 0; i < segments.length - 1; i++) {
    const parent = current.find(item => item.key === segments[i]);
    if (!parent || parent.type !== 'group' || !parent.children) return null;
    current = parent.children;
  }
  const index = current.findIndex(i => i.key === key);
  return index >= 0 ? { siblings: current, index } : null;
}

interface EditorDndProviderProps {
  items: FormItem[];
  children: ReactNode;
}

export function EditorDndProvider({ items, children }: EditorDndProviderProps) {
  const project = useProject();
  const { select, selectedKeys } = useSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const flatEntries = flattenItems(items, '');

  const onDragStart = useCallback((event: any) => {
    const sourceId = String(event.operation?.source?.id ?? '');
    if (!sourceId) return;
    setActiveId(sourceId);

    // Auto-select dragged item if not already selected
    if (!selectedKeys.has(sourceId)) {
      select(sourceId, 'field', { tab: EDITOR_TAB });
    }
  }, [selectedKeys, select]);

  const onDragEnd = useCallback((event: any) => {
    setActiveId(null);

    if (event.canceled) return;

    const sourceId = String(event.operation?.source?.id ?? '');
    const targetId = String(event.operation?.target?.id ?? '');
    if (!sourceId || !targetId || sourceId === targetId) return;

    // Resolve the source and target in the flat list
    const sourceEntry = flatEntries.find(e => e.path === sourceId);
    const targetEntry = flatEntries.find(e => e.path === targetId);
    if (!sourceEntry || !targetEntry) return;

    // Only allow reorder within the same parent
    if (sourceEntry.parentPath !== targetEntry.parentPath) return;

    const targetInfo = indexInParent(items, targetId);
    if (!targetInfo) return;

    const parentPath = targetEntry.parentPath || undefined;
    project.moveItem(sourceId, parentPath, targetInfo.index);
  }, [flatEntries, items, project]);

  return (
    <DragDropProvider
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sensors={() => [
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 5 }),
          ],
        }),
      ]}
    >
      {children}
    </DragDropProvider>
  );
}
