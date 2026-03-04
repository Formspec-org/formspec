import { signal } from '@preact/signals';
import type { ComponentNode } from '../../types';
import { componentDoc, setComponentDoc } from '../../state/project';
import { moveNode } from '../../logic/component-tree-ops';
import { selectedPath } from '../../state/selection';

export const draggedPath = signal<string | null>(null);

export interface DropTarget {
    parentPath: string;
    insertIndex: number;
    mode: 'above' | 'below' | 'inside';
}

export const dropTarget = signal<DropTarget | null>(null);

export function executeDrop() {
    const doc = componentDoc.value;
    const source = draggedPath.value;
    const target = dropTarget.value;

    if (!doc || !source || !target) return;

    const newTree = moveNode(doc.tree, source, target.parentPath, target.insertIndex);
    setComponentDoc({ ...doc, tree: newTree });

    // Update selection to new path
    const newPath = target.parentPath
        ? `${target.parentPath}.${target.insertIndex}`
        : String(target.insertIndex);
    selectedPath.value = newPath;

    draggedPath.value = null;
    dropTarget.value = null;
}
