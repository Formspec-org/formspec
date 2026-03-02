import { signal } from '@preact/signals';
import { findItemByKey, updateDefinition } from '../../state/definition';

export const draggedKey = signal<string | null>(null);

export const dropTarget = signal<
  | {
      parentKey: string | null;
      insertIndex: number;
      mode?: 'above' | 'below' | 'inside';
    }
  | null
>(null);

export function executeDrop() {
  const key = draggedKey.value;
  const target = dropTarget.value;
  if (!key || !target) {
    return;
  }

  updateDefinition((def) => {
    const source = findItemByKey(key, def.items);
    if (!source) {
      return;
    }

    const [removed] = source.siblings.splice(source.index, 1);

    if (target.parentKey === null) {
      let index = target.insertIndex;
      if (source.siblings === def.items && source.index < index) {
        index -= 1;
      }
      def.items.splice(Math.max(0, index), 0, removed);
      return;
    }

    const parent = findItemByKey(target.parentKey, def.items);
    if (!parent || parent.item.type !== 'group') {
      source.siblings.splice(source.index, 0, removed);
      return;
    }

    if (!parent.item.children) {
      parent.item.children = [];
    }

    let index = target.insertIndex;
    if (source.siblings === parent.item.children && source.index < index) {
      index -= 1;
    }

    parent.item.children.splice(Math.max(0, index), 0, removed);
  });

  draggedKey.value = null;
  dropTarget.value = null;
}
