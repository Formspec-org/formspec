/** @filedesc WASM-backed path helpers with TS traversal fallback. */
import {
    itemAtPath as itemAtPathFallback,
    itemLocationAtPath as itemLocationAtPathFallback,
    normalizeIndexedPath as normalizeIndexedPathFallback,
    normalizePathSegment,
    splitNormalizedPath,
    type TreeItemLike,
    type ItemLocation,
} from './path-utils.js';
import {
    isWasmReady,
    wasmItemAtPath,
    wasmItemLocationAtPath,
    wasmNormalizeIndexedPath,
} from './wasm-bridge.js';

function resolveParentArray<T extends TreeItemLike<T>>(items: T[], parentPath: string): T[] | undefined {
    if (!parentPath) return items;
    const parent = itemAtPathFallback(items, parentPath);
    return parent?.children;
}

export { normalizePathSegment, splitNormalizedPath };
export type { TreeItemLike, ItemLocation };

/** Normalize a dotted path by stripping repeat indices/wildcards from each segment. */
export function normalizeIndexedPath(path: string): string {
    if (!isWasmReady()) return normalizeIndexedPathFallback(path);
    try {
        return wasmNormalizeIndexedPath(path);
    } catch {
        return normalizeIndexedPathFallback(path);
    }
}

/** Find an item at a dotted path in a nested item tree. */
export function itemAtPath<T extends TreeItemLike<T>>(items: T[], path: string): T | undefined {
    if (!isWasmReady()) return itemAtPathFallback(items, path);
    try {
        return wasmItemAtPath<T>(items, path);
    } catch {
        return itemAtPathFallback(items, path);
    }
}

/** Resolve the mutable parent/index/item triple for a dotted tree path. */
export function itemLocationAtPath<T extends TreeItemLike<T>>(items: T[], path: string): ItemLocation<T> | undefined {
    if (!isWasmReady()) return itemLocationAtPathFallback(items, path);
    try {
        const location = wasmItemLocationAtPath<T>(items, path);
        if (!location) return undefined;
        const parent = resolveParentArray(items, location.parentPath);
        if (!parent || location.index < 0 || location.index >= parent.length) return undefined;
        return {
            parent,
            index: location.index,
            item: parent[location.index],
        };
    } catch {
        return itemLocationAtPathFallback(items, path);
    }
}
