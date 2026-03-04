import type { ComponentNode } from '../types';
import { resolveNode, parentPath, childIndex } from './component-tree';

function cloneTree(tree: ComponentNode): ComponentNode {
    return structuredClone(tree);
}

export function insertNode(
    tree: ComponentNode,
    parentPathStr: string,
    insertIndex: number,
    node: ComponentNode,
): ComponentNode {
    const result = cloneTree(tree);
    const parent = resolveNode(result, parentPathStr);
    if (!parent) return result;
    if (!parent.children) parent.children = [];
    parent.children.splice(insertIndex, 0, node);
    return result;
}

export function removeNode(tree: ComponentNode, nodePath: string): ComponentNode {
    if (nodePath === '') return tree;
    const result = cloneTree(tree);
    const pPath = parentPath(nodePath);
    const idx = childIndex(nodePath);
    const parent = resolveNode(result, pPath);
    if (!parent?.children || idx < 0 || idx >= parent.children.length) return result;
    parent.children.splice(idx, 1);
    return result;
}

export function moveNode(
    tree: ComponentNode,
    sourcePath: string,
    destParentPath: string,
    destIndex: number,
): ComponentNode {
    const result = cloneTree(tree);
    const srcParentPathStr = parentPath(sourcePath);
    const srcIdx = childIndex(sourcePath);

    const destParent = resolveNode(result, destParentPath);
    if (!destParent) return result;

    const srcParent = resolveNode(result, srcParentPathStr);
    if (!srcParent?.children || srcIdx < 0 || srcIdx >= srcParent.children.length) return result;

    const [moved] = srcParent.children.splice(srcIdx, 1);

    if (!destParent.children) destParent.children = [];

    let adjustedIndex = destIndex;
    if (srcParent === destParent && srcIdx < destIndex) {
        adjustedIndex -= 1;
    }

    destParent.children.splice(adjustedIndex, 0, moved);
    return result;
}

export function updateNodeProps(
    tree: ComponentNode,
    nodePath: string,
    props: Record<string, unknown>,
): ComponentNode {
    const result = cloneTree(tree);
    const node = resolveNode(result, nodePath);
    if (!node) return result;
    Object.assign(node, props);
    return result;
}
