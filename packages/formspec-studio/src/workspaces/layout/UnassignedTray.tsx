/** @filedesc Tray showing definition items not bound in the component tree. */
import { useMemo } from 'react';
import type { FormItem } from '@formspec-org/types';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  children?: CompNode[];
  [key: string]: unknown;
}

export interface UnassignedItem {
  key: string;
  label: string;
  itemType: 'field' | 'group' | 'display';
}

/** Collect all bound keys (bind or nodeId) from the component tree. */
function collectBoundKeys(nodes: CompNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.bind) keys.add(node.bind);
    else if (node.nodeId && !node._layout) keys.add(node.nodeId);
    if (node.children) {
      for (const k of collectBoundKeys(node.children)) {
        keys.add(k);
      }
    }
  }
  return keys;
}

/** Collect top-level definition items not present in the component tree. */
export function computeUnassignedItems(
  items: FormItem[],
  treeChildren: CompNode[],
): UnassignedItem[] {
  const bound = collectBoundKeys(treeChildren);
  const unassigned: UnassignedItem[] = [];

  for (const item of items) {
    if (!bound.has(item.key)) {
      unassigned.push({
        key: item.key,
        label: item.label ?? item.key,
        itemType: item.type as 'field' | 'group' | 'display',
      });
    }
  }

  return unassigned;
}

interface UnassignedTrayProps {
  items: FormItem[];
  treeChildren: CompNode[];
}

export function UnassignedTray({ items, treeChildren }: UnassignedTrayProps) {
  const unassigned = useMemo(
    () => computeUnassignedItems(items, treeChildren),
    [items, treeChildren],
  );

  if (unassigned.length === 0) return null;

  return (
    <section
      aria-label="Unassigned items"
      className="space-y-3 rounded-2xl border border-border/70 bg-surface px-5 py-4"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Unassigned
        </p>
        <p className="text-[12px] text-muted">
          These items are defined but not placed in the component tree.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {unassigned.map((item) => (
          <div
            key={item.key}
            data-testid={`unassigned-${item.key}`}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted"
          >
            <span className="truncate">{item.label}</span>
            <span className="text-[10px] font-mono text-muted/60">{item.itemType}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
