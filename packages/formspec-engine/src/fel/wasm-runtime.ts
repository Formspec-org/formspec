/** @filedesc WASM-backed FEL runtime — delegates to Rust via wasm-bindgen. */

import type {
    IFelRuntime,
    ICompiledExpression,
    FelCompilationResult,
    FelContext,
    FELBuiltinFunctionCatalogEntry,
} from './runtime.js';
import { FALLBACK_BUILTIN_FEL_FUNCTION_CATALOG } from './builtin-catalog.js';
import {
    isWasmReady,
    wasmEvalFELWithContext,
    wasmGetFELDependencies,
    wasmExtractDependencies,
    wasmListBuiltinFunctions,
    wasmParseFEL,
} from '../wasm-bridge.js';
import type { WasmFelContext } from '../wasm-bridge.js';

// ---------------------------------------------------------------------------
// Path resolution — mirrors FormEngine.compileFEL's dep-resolution heuristic
// ---------------------------------------------------------------------------

/** FEL uses 1-based indices; engine signals use 0-based. Convert [1] → [0]. */
function felIndexToSignalIndex(path: string): string {
    return path.replace(/\[(\d+)\]/g, (_match, rawIndex) => `[${Number(rawIndex) - 1}]`);
}

/** Parse an indexed item path into its enclosing repeat group scopes. */
function parseRepeatScopes(itemPath: string): Array<{ groupKey: string; prefix: string }> {
    const scopes: Array<{ groupKey: string; prefix: string }> = [];
    const re = /([^.[]+)\[(\d+)\]/g;
    let match;
    while ((match = re.exec(itemPath)) !== null) {
        scopes.push({ groupKey: match[1], prefix: itemPath.substring(0, match.index + match[0].length) });
    }
    return scopes;
}

/**
 * Resolve a raw FEL dependency path against the current evaluation context.
 *
 * Mirrors the Chevrotain runtime's resolution strategy:
 *  1. Bare names (no dots) get sibling resolution via parent prefix.
 *  2. Leading segment matching an enclosing repeat group gets rebased onto that scope.
 *  3. Fall back to root-relative.
 *
 * Returns the first candidate where getSignalValue is defined, or the
 * best-guess candidate if none resolves.
 */
function resolveFieldPath(rawPath: string, context: FelContext): string {
    const signalPath = felIndexToSignalIndex(rawPath);
    const currentItemPath = context.currentItemPath;
    const lastDot = currentItemPath.lastIndexOf('.');
    const parentPath = lastDot === -1 ? '' : currentItemPath.substring(0, lastDot);

    const candidates: string[] = [];

    // Strategy 1: Sibling resolution — prepend parent prefix.
    // The Chevrotain interpreter always tries this regardless of dots in the path.
    if (parentPath) {
        candidates.push(`${parentPath}.${signalPath}`);
    }

    // Strategy 2: Repeat scope rebase — if the reference's leading segment
    // matches an enclosing repeat group, rebase it onto that group's indexed prefix.
    const scopes = parseRepeatScopes(currentItemPath);
    const firstDot = signalPath.indexOf('.');
    const leadingSegment = firstDot === -1 ? signalPath : signalPath.substring(0, firstDot);
    const trailingPath = firstDot === -1 ? '' : signalPath.substring(firstDot + 1);

    for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i];
        if (scope.groupKey === leadingSegment) {
            const rebased = trailingPath ? `${scope.prefix}.${trailingPath}` : scope.prefix;
            candidates.push(rebased);
            break;
        }
    }

    // Strategy 3: Root-relative — use the path as-is.
    candidates.push(signalPath);

    // Return first candidate that resolves to a defined value.
    for (const candidate of candidates) {
        if (context.getSignalValue(candidate) !== undefined) return candidate;
    }
    return candidates[0] ?? rawPath;
}

// ---------------------------------------------------------------------------
// WasmCompiledExpression
// ---------------------------------------------------------------------------

/**
 * A compiled FEL expression backed by WASM. Stores the expression string
 * and pre-extracted dependencies. Evaluation re-invokes WASM evalFEL with
 * a snapshot of the current signal values.
 */
class WasmCompiledExpression implements ICompiledExpression {
    readonly dependencies: string[];
    readonly mipDependencies: string[];
    private readonly expression: string;
    /** Context refs like @variable names extracted at compile time. */
    private readonly contextRefs: string[];
    /** Instance names referenced via @instance('name'). */
    private readonly instanceRefs: string[];

    constructor(
        expression: string,
        dependencies: string[],
        mipDependencies: string[],
        contextRefs: string[],
        instanceRefs: string[],
    ) {
        this.expression = expression;
        this.dependencies = dependencies;
        this.mipDependencies = mipDependencies;
        this.contextRefs = contextRefs;
        this.instanceRefs = instanceRefs;
    }

    evaluate(context: FelContext): any {
        const fields: Record<string, any> = {};

        // Collect wildcard deps (group[*].field) separately — they need
        // expansion into per-instance arrays for the Rust evaluator.
        const wildcardGroups = new Map<string, string[]>(); // groupPath → fieldTails[]

        for (const dep of this.dependencies) {
            if (dep === '') {
                // Bare $ self-reference
                const selfValue = context.getSignalValue(context.currentItemPath);
                if (selfValue !== undefined) {
                    fields[''] = selfValue;
                }
                continue;
            }

            const wildcardIdx = dep.indexOf('[*]');
            if (wildcardIdx !== -1) {
                const groupName = dep.substring(0, wildcardIdx);
                // After [*] there may be ".field" or nothing (bare group[*]).
                // Skip the 3-char "[*]" and optional leading dot.
                const afterWildcard = dep.substring(wildcardIdx + 3);
                const fieldTail = afterWildcard.startsWith('.') ? afterWildcard.substring(1) : afterWildcard;
                if (!wildcardGroups.has(groupName)) wildcardGroups.set(groupName, []);
                if (fieldTail) wildcardGroups.get(groupName)!.push(fieldTail);
            } else {
                const resolved = resolveFieldPath(dep, context);
                const value = context.getSignalValue(resolved);
                if (value !== undefined) {
                    fields[dep] = value;
                    insertFieldAlias(fields, dep, value);
                }
            }
        }

        // Expand wildcard deps into per-instance arrays
        for (const [groupName, fieldTails] of wildcardGroups) {
            const resolvedGroup = resolveFieldPath(groupName, context);
            const instanceCount = context.getRepeatsValue(resolvedGroup);
            if (instanceCount === 0) continue;

            if (fieldTails.length === 0) {
                // Bare group[*] — collect raw instance values
                const values: any[] = [];
                for (let i = 0; i < instanceCount; i++) {
                    const value = context.getSignalValue(`${resolvedGroup}[${i}]`);
                    values.push(value ?? null);
                }
                fields[groupName] = values;
            } else {
                // group[*].field — build per-instance objects
                const instances: Record<string, any>[] = [];
                for (let i = 0; i < instanceCount; i++) {
                    const instance: Record<string, any> = {};
                    for (const field of fieldTails) {
                        const instancePath = `${resolvedGroup}[${i}].${field}`;
                        const value = context.getSignalValue(instancePath);
                        if (value !== undefined) {
                            instance[field] = value;
                        }
                    }
                    instances.push(instance);
                }
                fields[groupName] = instances;
            }
        }

        const wasmCtx: WasmFelContext = { fields };

        // Resolve @variable refs (skip built-in repeat context refs)
        if (this.contextRefs.length > 0 && context.engine) {
            const variables: Record<string, any> = {};
            for (const cref of this.contextRefs) {
                const withoutAt = cref.startsWith('@') ? cref.slice(1) : cref;
                const dotIdx = withoutAt.indexOf('.');
                const baseName = dotIdx === -1 ? withoutAt : withoutAt.substring(0, dotIdx);
                // Built-in repeat context refs are handled separately below
                if (baseName === 'index' || baseName === 'count' || baseName === 'current') continue;
                // Skip @instance — handled separately below
                if (baseName === 'instance') continue;
                if (variables[baseName] !== undefined) continue;
                const val = context.engine.getVariableValue(baseName, context.currentItemPath);
                if (val !== undefined) {
                    variables[baseName] = val;
                }
            }
            if (Object.keys(variables).length > 0) {
                wasmCtx.variables = variables;
            }
        }

        // Resolve @instance refs
        if (this.instanceRefs.length > 0 && context.engine) {
            const instances: Record<string, any> = {};
            for (const name of this.instanceRefs) {
                const data = context.engine.getInstanceData(name);
                if (data !== undefined) {
                    instances[name] = data;
                }
            }
            if (Object.keys(instances).length > 0) {
                wasmCtx.instances = instances;
            }
        }

        // Only provide repeat context when the expression actually uses repeat refs.
        // Setting repeatContext changes how the Rust evaluator resolves bare $ (it
        // returns repeatContext.current instead of checking the data map).
        const usesRepeatNavigation = this.expression.includes('prev(')
            || this.expression.includes('next(')
            || this.expression.includes('parent(');
        const needsCurrentRepeatObject = this.contextRefs.some(cr =>
            cr === '@current' || cr.startsWith('@current.'))
            || usesRepeatNavigation;
        const needsRepeatContext = needsCurrentRepeatObject || this.contextRefs.some(cr =>
            cr === '@index'
            || cr.startsWith('@index.')
            || cr === '@count'
            || cr.startsWith('@count.'));
        const repeatScopes = parseRepeatScopes(context.currentItemPath);
        if (needsRepeatContext && repeatScopes.length > 0) {
            let parentContext: WasmFelContext['repeatContext'] | undefined;
            for (let i = 0; i < repeatScopes.length; i++) {
                const scope = repeatScopes[i];
                const groupPath = scope.prefix.replace(/\[\d+\]$/, '');
                const instanceCount = context.getRepeatsValue(groupPath);
                const indexMatch = scope.prefix.match(/\[(\d+)\]$/);
                const zeroBasedIndex = indexMatch ? parseInt(indexMatch[1], 10) : 0;
                parentContext = {
                    current: needsCurrentRepeatObject ? buildObjectSnapshot(context, scope.prefix) : null,
                    index: zeroBasedIndex + 1,
                    count: instanceCount,
                    collection: needsCurrentRepeatObject ? buildRepeatCollection(context, groupPath, instanceCount) : [],
                    parent: parentContext ?? buildContainerParentContext(context, scope.prefix),
                };
            }
            wasmCtx.repeatContext = parentContext;
        }

        // Provide MIP states for non-wildcard field dependencies
        if (this.mipDependencies.length > 0) {
            const mipStates: Record<string, { valid?: boolean; relevant?: boolean; readonly?: boolean; required?: boolean }> = {};
            for (const dep of this.mipDependencies) {
                if (dep === '' || dep.includes('[*]')) continue;
                const resolved = resolveFieldPath(dep, context);
                const errorCount = context.getValidationErrors(resolved);
                const relevant = context.getRelevantValue(resolved);
                const required = context.getRequiredValue(resolved);
                const readonly = context.getReadonlyValue(resolved);
                // Only include if any MIP state differs from defaults
                if (errorCount > 0 || !relevant || required || readonly) {
                    mipStates[dep] = {
                        valid: errorCount === 0,
                        relevant,
                        readonly,
                        required,
                    };
                }
            }
            if (Object.keys(mipStates).length > 0) {
                wasmCtx.mipStates = mipStates;
            }
        }

        if (context.engine && 'nowISO' in context.engine && typeof (context.engine as any).nowISO === 'function') {
            wasmCtx.nowIso = (context.engine as any).nowISO();
        }

        try {
            return wasmEvalFELWithContext(this.expression, wasmCtx);
        } catch (e) {
            if (e instanceof Error && e.message.includes('Unsupported FEL function:')) {
                throw e;
            }
            console.warn(`WASM FEL eval error for "${this.expression}":`, e);
            return null;
        }
    }
}

// ---------------------------------------------------------------------------
// WasmFelRuntime
// ---------------------------------------------------------------------------

/**
 * FEL runtime backed by the Rust WASM module.
 *
 * Requires WASM to be initialized before use (call `initWasm()` first).
 * If WASM is not ready, `compile()` returns an error result rather than
 * throwing, allowing graceful degradation.
 */
export class WasmFelRuntime implements IFelRuntime {
    compile(expression: string): FelCompilationResult {
        if (!isWasmReady()) {
            return {
                expression: null,
                errors: [{ message: 'WASM not initialized' }],
            };
        }

        // Validate the expression parses
        try {
            const valid = wasmParseFEL(expression);
            if (!valid) {
                return {
                    expression: null,
                    errors: [{ message: `FEL parse error: invalid expression` }],
                };
            }
        } catch (e: any) {
            return {
                expression: null,
                errors: [{ message: e.message || String(e) }],
            };
        }

        // Extract dependencies (fields + context refs + instance refs + self-ref)
        let dependencies: string[];
        let mipDependencies: string[];
        let contextRefs: string[];
        let instanceRefs: string[];
        try {
            const fullDeps = wasmExtractDependencies(expression);
            dependencies = fullDeps.fields;
            mipDependencies = fullDeps.mipDeps;
            contextRefs = fullDeps.contextRefs;
            instanceRefs = fullDeps.instanceRefs;
            if (fullDeps.hasSelfRef) {
                dependencies.push(''); // bare $ self-reference
            }
        } catch {
            dependencies = [];
            mipDependencies = [];
            contextRefs = [];
            instanceRefs = [];
        }

        return {
            expression: new WasmCompiledExpression(
                expression,
                dependencies,
                mipDependencies,
                contextRefs,
                instanceRefs,
            ),
            errors: [],
        };
    }

    listBuiltInFunctions(): FELBuiltinFunctionCatalogEntry[] {
        if (!isWasmReady()) return FALLBACK_BUILTIN_FEL_FUNCTION_CATALOG;
        try {
            const catalog = wasmListBuiltinFunctions();
            return catalog.length > 0 ? catalog : FALLBACK_BUILTIN_FEL_FUNCTION_CATALOG;
        } catch {
            return FALLBACK_BUILTIN_FEL_FUNCTION_CATALOG;
        }
    }

    extractDependencies(expression: string): string[] {
        if (!isWasmReady()) return [];
        try {
            return wasmGetFELDependencies(expression);
        } catch {
            return [];
        }
    }

    registerFunction(
        _name: string,
        _impl: (...args: any[]) => any,
        _meta?: { signature?: string; description?: string; category?: string },
    ): void {
        // WASM runtime doesn't support dynamic function registration from JS.
        // Extension functions registered here would need to be handled by
        // falling back to the Chevrotain runtime for those expressions.
        console.warn(
            'WasmFelRuntime.registerFunction() is a no-op. Extension functions are not yet supported in the WASM runtime.',
        );
    }
}

/** Shared singleton instance. */
export const wasmFelRuntime = new WasmFelRuntime();

function buildRepeatCollection(context: FelContext, groupPath: string, count: number): any[] {
    const rows: any[] = [];
    for (let i = 0; i < count; i++) {
        rows.push(buildObjectSnapshot(context, `${groupPath}[${i}]`));
    }
    return rows;
}

function buildContainerParentContext(context: FelContext, repeatRowPath: string): WasmFelContext['repeatContext'] | undefined {
    const lastDot = repeatRowPath.lastIndexOf('.');
    if (lastDot === -1) return undefined;
    const containerPath = repeatRowPath.substring(0, lastDot);
    if (!containerPath) return undefined;
    const current = buildObjectSnapshot(context, containerPath);
    return {
        current,
        index: 1,
        count: 1,
        collection: [current],
    };
}

function buildObjectSnapshot(context: FelContext, prefix: string): any {
    const root: any = {};
    const engine = context.engine;
    const signalKeys = Object.keys(engine?.signals ?? {});
    for (const key of signalKeys) {
        if (!key.startsWith(`${prefix}.`)) continue;
        const value = key === context.currentItemPath
            ? (context.engine?.signals?.[key]?.peek?.() ?? context.engine?.signals?.[key]?.value)
            : context.getSignalValue(key);
        if (value === undefined) continue;
        insertSnapshotValue(root, key.slice(prefix.length + 1), value);
    }
    return Object.keys(root).length > 0 ? root : (context.getSignalValue(prefix) ?? null);
}

function insertSnapshotValue(target: any, relativePath: string, value: any): void {
    const segments = relativePath.split('.');
    let current = target;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const match = /^([^\[\]]+)(?:\[(\d+)\])?$/.exec(segment);
        if (!match) return;
        const [, key, rawIndex] = match;
        const isLeaf = i === segments.length - 1;

        if (rawIndex === undefined) {
            if (isLeaf) {
                current[key] = value;
                return;
            }
            current[key] ??= {};
            current = current[key];
            continue;
        }

        const index = parseInt(rawIndex, 10);
        current[key] ??= [];
        current[key][index] ??= {};
        if (isLeaf) {
            current[key][index] = value;
            return;
        }
        current = current[key][index];
    }
}

function insertFieldAlias(fields: Record<string, any>, dep: string, value: any): void {
    if (!dep || dep.includes('[*]') || !dep.includes('.')) return;

    const segments = dep.split('.');
    const rootMatch = /^([^\[\]]+)(?:\[(\d+)\])?$/.exec(segments[0] ?? '');
    if (!rootMatch) return;

    const [, rootKey, rootIndexRaw] = rootMatch;
    if (rootIndexRaw === undefined) {
        fields[rootKey] ??= {};
        insertSnapshotValue(fields[rootKey], segments.slice(1).join('.'), value);
        return;
    }

    const rootIndex = parseInt(rootIndexRaw, 10) - 1;
    fields[rootKey] ??= [];
    fields[rootKey][rootIndex] ??= {};
    insertSnapshotValue(fields[rootKey][rootIndex], segments.slice(1).join('.'), value);
}
