/** @filedesc Public FEL rewrite helpers preserving exact source text semantics. */
import type { FELRewriteOptions } from './analysis.js';
import {
    isWasmReady,
    wasmCollectFELRewriteTargets,
    wasmRewriteFELReferences,
} from '../wasm-bridge.js';
import { rewriteFELReferences as rewriteFELReferencesFallback } from './analysis.js';

/**
 * Rewrites FEL references while preserving non-reference source text exactly.
 */
export function rewriteFELReferences(expression: string, options: FELRewriteOptions): string {
    if (isWasmReady()) {
        try {
            const targets = wasmCollectFELRewriteTargets(expression);
            return wasmRewriteFELReferences(expression, {
                fieldPaths: mapEntries(targets.fieldPaths, options.rewriteFieldPath),
                currentPaths: mapEntries(targets.currentPaths, options.rewriteCurrentPath),
                variables: mapEntries(targets.variables, options.rewriteVariable),
                instanceNames: mapEntries(targets.instanceNames, options.rewriteInstanceName),
                navigationTargets: mapNavigationTargets(
                    targets.navigationTargets,
                    options.rewriteNavigationTarget,
                ),
            });
        } catch {
            // Fall through to the parser-aware TS path when WASM is unavailable or rejects the expression.
        }
    }

    return rewriteFELReferencesFallback(expression, options);
}

function mapEntries(
    entries: string[],
    rewrite?: (value: string) => string,
): Record<string, string> | undefined {
    if (!rewrite || entries.length === 0) return undefined;
    const mapped: Record<string, string> = {};
    let changed = false;
    for (const entry of entries) {
        const next = rewrite(entry);
        if (next !== entry) {
            mapped[entry] = next;
            changed = true;
        }
    }
    return changed ? mapped : undefined;
}

function mapNavigationTargets(
    entries: Array<{ functionName: 'prev' | 'next' | 'parent'; name: string }>,
    rewrite?: (name: string, fn: 'prev' | 'next' | 'parent') => string,
): Record<string, string> | undefined {
    if (!rewrite || entries.length === 0) return undefined;
    const mapped: Record<string, string> = {};
    let changed = false;
    for (const entry of entries) {
        const next = rewrite(entry.name, entry.functionName);
        if (next !== entry.name) {
            mapped[`${entry.functionName}:${entry.name}`] = next;
            changed = true;
        }
    }
    return changed ? mapped : undefined;
}
