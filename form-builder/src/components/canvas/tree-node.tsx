import type { ComponentNode } from '../../types';
import { definition } from '../../state/definition';
import { componentDoc, componentVersion, setComponentDoc } from '../../state/project';
import { selectedPath, addPickerState } from '../../state/selection';
import { classifyNode, nodeKindColor, getNodeLabel, acceptsChildren } from '../../logic/component-tree';
import { removeNode } from '../../logic/component-tree-ops';
import { draggedPath, dropTarget, executeDrop } from './drag-drop';

interface TreeNodeProps {
    node: ComponentNode;
    path: string;
    depth: number;
}

export function TreeNode({ node, path, depth }: TreeNodeProps) {
    componentVersion.value; // subscribe

    const isSelected = selectedPath.value === path;
    const kind = classifyNode(node);
    const color = nodeKindColor(kind);
    const label = getNodeLabel(node, definition.value.items);
    const hasChildren = node.children && node.children.length > 0;
    const canHaveChildren = acceptsChildren(node.component);

    const dt = dropTarget.value;
    const isDraggedOver = dt !== null;
    const isDropAbove = isDraggedOver && dt?.parentPath === parentPathOf(path) && dt?.mode === 'above' && dt?.insertIndex === indexFromPath(path);
    const isDropBelow = isDraggedOver && dt?.parentPath === parentPathOf(path) && dt?.mode === 'below' && dt?.insertIndex === indexFromPath(path) + 1;
    const isDropInside = isDraggedOver && dt?.parentPath === path && dt?.mode === 'inside';

    function handleDelete(event: Event) {
        event.stopPropagation();
        const doc = componentDoc.value;
        if (!doc) return;
        const newTree = removeNode(doc.tree, path);
        setComponentDoc({ ...doc, tree: newTree });
        if (selectedPath.value === path) selectedPath.value = null;
    }

    function handleDragStart(event: DragEvent) {
        event.stopPropagation();
        draggedPath.value = path;
        event.dataTransfer!.effectAllowed = 'move';
        event.dataTransfer!.setData('text/plain', path);
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (!draggedPath.value || draggedPath.value === path) return;

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const y = event.clientY - rect.top;
        const third = rect.height / 3;

        if (canHaveChildren && y > third && y < third * 2) {
            // Drop inside
            dropTarget.value = {
                parentPath: path,
                insertIndex: node.children?.length ?? 0,
                mode: 'inside',
            };
        } else if (y < rect.height / 2) {
            // Drop above
            dropTarget.value = {
                parentPath: parentPathOf(path),
                insertIndex: indexFromPath(path),
                mode: 'above',
            };
        } else {
            // Drop below
            dropTarget.value = {
                parentPath: parentPathOf(path),
                insertIndex: indexFromPath(path) + 1,
                mode: 'below',
            };
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        executeDrop();
    }

    function handleDragEnd() {
        draggedPath.value = null;
        dropTarget.value = null;
    }

    return (
        <div class={`tree-node-wrapper${isDropAbove ? ' drop-above' : ''}${isDropBelow ? ' drop-below' : ''}${isDropInside ? ' drop-inside' : ''}`}>
            <div
                class={`tree-node${isSelected ? ' selected' : ''}`}
                onClick={() => { selectedPath.value = path; }}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                role="treeitem"
                aria-level={depth + 2}
                aria-selected={isSelected}
                tabIndex={0}
            >
                <span class="tree-node-indent" style={{ width: `${depth * 16 + 8}px` }} />
                <span class="tree-node-grip">⠿</span>
                {hasChildren && (
                    <span class="tree-node-chevron expanded">▸</span>
                )}
                <span class="tree-node-dot" style={{ background: color, color: color }} />
                <span class="tree-node-label">{label}</span>
                {node.bind && <span class="tree-node-bind">{node.bind}</span>}
                <span class="tree-node-badge">{node.component}</span>
                <button
                    class="tree-node-delete"
                    onClick={handleDelete}
                    title="Delete"
                    aria-label={`Delete ${label}`}
                >
                    ✕
                </button>
            </div>

            {node.children?.map((child, index) => (
                <TreeNode
                    key={`${path}.${index}-${child.component}`}
                    node={child}
                    path={`${path}.${index}`}
                    depth={depth + 1}
                />
            ))}
        </div>
    );
}

function parentPathOf(path: string): string {
    const lastDot = path.lastIndexOf('.');
    return lastDot === -1 ? '' : path.substring(0, lastDot);
}

function indexFromPath(path: string): number {
    const lastDot = path.lastIndexOf('.');
    return Number(lastDot === -1 ? path : path.substring(lastDot + 1));
}
