/** @filedesc Path normalization and external-to-internal index conversion utilities. */
export function normalizeFieldPath(path: unknown): string {
    return typeof path === 'string' ? path.trim() : '';
}

export function externalPathToInternal(path: string): string {
    return path.replace(/\[(\d+)\]/g, (_match: string, rawIndex: string) => {
        const parsed = Number.parseInt(rawIndex, 10);
        if (!Number.isFinite(parsed)) return `[${rawIndex}]`;
        return `[${Math.max(0, parsed - 1)}]`;
    });
}
