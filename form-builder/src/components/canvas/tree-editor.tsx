import { definition, definitionVersion } from '../../state/definition';
import { componentDoc, componentVersion, setComponentDoc } from '../../state/project';
import { addPickerState, selectedPath } from '../../state/selection';
import { insertNode } from '../../logic/component-tree-ops';
import { draggedPath, dropTarget, executeDrop } from './drag-drop';
import { TreeNode } from './tree-node';
import { AddPicker } from './add-picker';
import type { ComponentNode } from '../../types';

export function TreeEditor() {
    definitionVersion.value;
    componentVersion.value;

    const doc = componentDoc.value;
    const def = definition.value;
    const rootSelected = selectedPath.value === '';
    const picker = addPickerState.value;

    if (!doc) {
        return (
            <div class="canvas-body" role="tree" aria-label="Component tree">
                <div class="inspector-empty">
                    <span class="inspector-empty-icon">🌿</span>
                    <span>No component tree</span>
                </div>
            </div>
        );
    }

    const rootNode = doc.tree;

    function handleAdd(node: ComponentNode) {
        if (!picker || !doc) return;
        const idx = Math.min(picker.insertIndex, rootNode.children?.length ?? 0);
        const newTree = insertNode(doc.tree, picker.parentPath, idx, node);
        setComponentDoc({ ...doc, tree: newTree });
        const newPath = picker.parentPath
            ? `${picker.parentPath}.${idx}`
            : String(idx);
        selectedPath.value = newPath;
        addPickerState.value = null;
    }

    return (
        <>
            <div class="canvas-body" role="tree" aria-label="Component tree">
                <div
                    class={`tree-header ${rootSelected ? 'selected' : ''}`}
                    onClick={() => { selectedPath.value = ''; }}
                    role="treeitem"
                    aria-level={1}
                    aria-selected={rootSelected}
                    tabIndex={0}
                >
                    <span class="tree-header-dot" />
                    <span class="tree-header-title">{def.title || 'Untitled Form'}</span>
                </div>

                {rootNode.children?.map((child, index) => (
                    <TreeNode
                        key={`${index}-${child.component}`}
                        node={child}
                        path={String(index)}
                        depth={0}
                    />
                ))}

                {draggedPath.value && (
                    <div
                        class={`tree-root-drop-zone ${dropTarget.value?.parentPath === '' &&
                                dropTarget.value?.mode === 'below' &&
                                dropTarget.value?.insertIndex === (rootNode.children?.length ?? 0)
                                ? 'drop-active'
                                : ''
                            }`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer!.dropEffect = 'move';
                            dropTarget.value = {
                                parentPath: '',
                                insertIndex: rootNode.children?.length ?? 0,
                                mode: 'below',
                            };
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            executeDrop();
                        }}
                    />
                )}

                <div class="tree-add-section">
                    <button
                        class="tree-add-btn"
                        aria-label="Add component"
                        onClick={() => {
                            addPickerState.value = {
                                parentPath: '',
                                insertIndex: rootNode.children?.length ?? 0,
                            };
                        }}
                    >
                        + Add Component
                    </button>
                </div>
            </div>

            {picker && (
                <AddPicker
                    parentPath={picker.parentPath}
                    insertIndex={picker.insertIndex}
                    onAdd={handleAdd}
                    onCancel={() => { addPickerState.value = null; }}
                />
            )}
        </>
    );
}
