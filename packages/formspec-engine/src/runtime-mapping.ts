/**
 * @filedesc Bidirectional data-transform engine for Formspec mapping documents: rules, valueMap, coerce, FEL expressions, array modes, flatten/nest/concat/split.
 */
import type { IFelRuntime, FelContext } from './fel/runtime.js';
import { wasmFelRuntime } from './fel/wasm-runtime.js';
import type { MappingDirection, MappingDiagnostic, RuntimeMappingResult, IRuntimeMappingEngine } from './interfaces.js';

// Re-export the types that were previously defined here for backwards compat
export type { MappingDirection, MappingDiagnostic };

/** The result of executing a mapping operation, including the transformed output, rule count, and any diagnostics. */
export type { RuntimeMappingResult };


/** Internal representation of a single mapping rule with source/target paths, transform type, and optional reverse override. */
type MappingRule = {
    sourcePath?: string | null;
    targetPath?: string | null;
    transform?: string;
    expression?: string;
    coerce?: any;
    valueMap?: any;
    condition?: string;
    reverse?: Partial<MappingRule>;
    priority?: number;
    reversePriority?: number;
    bidirectional?: boolean;
    default?: any;
    separator?: string;
    array?: ArrayDescriptor;
};

type ArrayDescriptor = {
    mode: 'each' | 'whole' | 'indexed';
    innerRules?: any[];
};

// ---------------------------------------------------------------------------
// Path utilities with bracket notation support
// ---------------------------------------------------------------------------

/** Splits a dot-or-bracket path into segments. `name[0].given[0]` → `['name', '0', 'given', '0']`. `[*]` → `'*'` wildcard. */
function splitPath(path: string): string[] {
    if (!path) return [];
    // Replace [N] and [*] with .N / .*, then split on dots
    return path.replace(/\[(\d+|\*)\]/g, '.$1').split('.').filter(Boolean);
}

/** Navigates into a nested object/array by a dot-or-bracket path. Returns `undefined` if any segment is missing. A `*` segment returns the full array at that position. */
function getByPath(obj: any, path?: string | null): any {
    if (!path) return undefined;
    const parts = splitPath(path);
    let current = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        if (part === '*') {
            // Wildcard: return the current value as-is (expected to be an array)
            return Array.isArray(current) ? current : undefined;
        }
        current = current[part];
    }
    return current;
}

/** Sets a value in a nested object/array at a dot-or-bracket path. Creates intermediate objects or arrays as needed. A `*` segment fans out the write to every element of an existing array. */
function setByPath(obj: any, path: string, value: any): void {
    const parts = splitPath(path);
    if (parts.length === 0) return;
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === '*') {
            // Fan-out: set the remaining path on every element of the current array
            if (!Array.isArray(current)) return;
            const remainingPath = parts.slice(i + 1).join('.');
            for (const element of current) {
                if (element != null && typeof element === 'object') {
                    setByPath(element, remainingPath, value);
                }
            }
            return;
        }
        const nextPart = parts[i + 1];
        // Don't auto-create intermediates when the next segment is a wildcard — fan-out requires a pre-existing array
        if (nextPart === '*') {
            if (current[part] == null) return;
            current = current[part];
            continue;
        }
        const nextIsIndex = /^\d+$/.test(nextPart);
        if (current[part] == null || typeof current[part] !== 'object') {
            current[part] = nextIsIndex ? [] : {};
        }
        current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart === '*') {
        // Fan-out at terminal: replace each array element with value
        if (Array.isArray(current)) {
            for (let i = 0; i < current.length; i++) current[i] = value;
        }
    } else {
        current[lastPart] = value;
    }
}

/** Deep-clones a value using structuredClone (if available) or JSON round-trip as fallback. */
function clone<T>(value: T): T {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    const cloner = (globalThis as any).structuredClone;
    if (typeof cloner === 'function') {
        return cloner(value);
    }
    return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// FEL evaluation helper for mapping context
// ---------------------------------------------------------------------------

/**
 * Evaluate a FEL expression string in the context of a mapping operation.
 * Bindings: `$` = currentValue (the source field value), `@source` = full source document, `$index` = optional array index.
 */
function evalFEL(runtime: IFelRuntime, expression: string, currentValue: any, sourceDocument: any, arrayIndex?: number): any {
    const compiled = runtime.compile(expression);
    if (compiled.errors.length > 0) {
        throw new Error(`FEL compile error: ${compiled.errors[0].message}`);
    }

    const context: FelContext = {
        getSignalValue: (path: string) => {
            if (path === '') return currentValue;
            // $index resolves to the current array iteration index
            if (path === '$index' || path === 'index') return arrayIndex ?? null;
            // Allow $source.field style lookups (source → full doc)
            if (path.startsWith('source.')) return getByPath(sourceDocument, path.slice(7));
            // Attempt to resolve against source document
            const val = getByPath(sourceDocument, path);
            return val === undefined ? null : val;
        },
        getRepeatsValue: () => 0,
        getRelevantValue: () => true,
        getRequiredValue: () => false,
        getReadonlyValue: () => false,
        getValidationErrors: () => 0,
        currentItemPath: '',
        engine: {
            getVariableValue: (name: string) => {
                if (name === 'source') return sourceDocument;
                if (name === 'index') return arrayIndex ?? null;
                return undefined;
            },
            getInstanceData: () => undefined
        }
    };
    return compiled.expression!.evaluate(context);
}

// ---------------------------------------------------------------------------
// valueMap helpers
// ---------------------------------------------------------------------------

/** Determine if a forward map is bijective (all values unique). */
function isBijective(forward: Record<string, any>): boolean {
    const values = Object.values(forward);
    return values.length === new Set(values.map(String)).size;
}

/** Invert a bijective forward map. */
function invertMap(forward: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(forward)) {
        result[String(v)] = k;
    }
    return result;
}

/**
 * Apply a valueMap to `value` for the given direction.
 * Returns `{ value, skip, diagnostic }` where skip=true means the output should not be written.
 */
function applyValueMap(
    rawValueMap: any,
    value: any,
    direction: MappingDirection,
    ruleIndex: number,
    sourcePath: string | undefined,
    targetPath: string | undefined,
): { value: any; skip: boolean; diagnostic?: MappingDiagnostic } {
    // Detect new-shape { forward, reverse, unmapped, default } vs legacy flat map
    const isNewShape = rawValueMap && typeof rawValueMap === 'object'
        && ('forward' in rawValueMap || 'reverse' in rawValueMap || 'unmapped' in rawValueMap);

    let lookupMap: Record<string, any>;
    let unmapped: string = 'passthrough';
    let defaultValue: any = undefined;

    if (isNewShape) {
        const forward: Record<string, any> = rawValueMap.forward ?? {};
        unmapped = rawValueMap.unmapped ?? 'passthrough';
        defaultValue = rawValueMap.default;

        if (direction === 'forward') {
            lookupMap = forward;
        } else {
            // Reverse
            if (rawValueMap.reverse) {
                lookupMap = rawValueMap.reverse;
            } else if (isBijective(forward)) {
                lookupMap = invertMap(forward);
            } else {
                // Non-bijective, no explicit reverse — emit diagnostic
                return {
                    value: undefined,
                    skip: true,
                    diagnostic: {
                        ruleIndex,
                        sourcePath,
                        targetPath,
                        errorCode: 'UNMAPPED_VALUE',
                        message: `Cannot auto-invert non-bijective valueMap for reverse direction`
                    }
                };
            }
        }
    } else {
        // Legacy flat map — used as-is (forward only semantics in this path)
        lookupMap = rawValueMap ?? {};
        unmapped = 'passthrough';
    }

    const key = String(value);
    if (value !== undefined && value !== null && lookupMap[key] !== undefined) {
        return { value: lookupMap[key], skip: false };
    }

    // Value not in map
    if (unmapped === 'passthrough') {
        return { value, skip: false };
    }
    if (unmapped === 'drop') {
        return { value: undefined, skip: true };
    }
    if (unmapped === 'default') {
        return { value: defaultValue, skip: false };
    }
    if (unmapped === 'error') {
        return {
            value: undefined,
            skip: true,
            diagnostic: {
                ruleIndex,
                sourcePath,
                targetPath,
                errorCode: 'UNMAPPED_VALUE',
                message: `Value "${key}" has no mapping and unmapped strategy is "error"`
            }
        };
    }

    return { value, skip: false };
}

// ---------------------------------------------------------------------------
// coerce helpers
// ---------------------------------------------------------------------------

const LOSSY_COERCE_PAIRS: Set<string> = new Set([
    'number→integer',
    'money→number',
    'money→string',
    'datetime→date',
]);

function isLossyCoerce(from: string, to: string): boolean {
    return LOSSY_COERCE_PAIRS.has(`${from}→${to}`);
}

function applyCoerce(
    value: any,
    coerceDescriptor: any,
    ruleIndex: number,
    sourcePath: string | undefined,
    targetPath: string | undefined,
): { value: any; diagnostic?: MappingDiagnostic; lossy?: boolean } {
    // Normalize to { from, to, format }
    let from: string;
    let to: string;
    let format: string | undefined;

    if (typeof coerceDescriptor === 'string') {
        // Legacy: plain string like 'number', 'string', 'boolean'
        from = 'any';
        to = coerceDescriptor;
    } else if (coerceDescriptor == null) {
        // No descriptor: pass value through unchanged (legacy behavior)
        return { value };
    } else {
        from = coerceDescriptor.from ?? 'any';
        to = coerceDescriptor.to ?? 'string';
        format = coerceDescriptor.format;
    }

    const lossy = isLossyCoerce(from, to);

    if (to === 'number') {
        if (from === 'money') {
            if (value != null && typeof value === 'object' && 'amount' in value) {
                return { value: value.amount, lossy: true };
            }
            return { value: null, lossy: true };
        }
        return { value: value == null ? null : Number(value) };
    }

    if (to === 'integer') {
        if (from === 'boolean') {
            return { value: value ? 1 : 0 };
        }
        const n = value == null ? null : Number(value);
        if (n !== null && !Number.isFinite(n)) {
            return {
                value: null,
                diagnostic: {
                    ruleIndex, sourcePath, targetPath,
                    errorCode: 'COERCE_FAILURE',
                    message: `Cannot coerce "${value}" to integer`
                }
            };
        }
        if (n !== null && typeof n === 'number' && !Number.isInteger(n)) {
            // lossy truncation from number → integer
            return { value: Math.trunc(n), lossy: from === 'number' };
        }
        return { value: n === null ? null : Math.trunc(n as number) };
    }

    if (to === 'string') {
        if (from === 'money') {
            if (value != null && typeof value === 'object' && 'amount' in value) {
                return { value: String(value.amount), lossy: true };
            }
            return { value: null, lossy: true };
        }
        return { value: value == null ? null : String(value) };
    }

    if (to === 'boolean') {
        if (from === 'string' || typeof value === 'string') {
            const s = String(value).toLowerCase().trim();
            if (s === 'true' || s === 'yes' || s === '1') return { value: true };
            if (s === 'false' || s === 'no' || s === '0' || s === '') return { value: false };
            return { value: Boolean(value) };
        }
        return { value: Boolean(value) };
    }

    if (to === 'date') {
        // string ↔ date is lossless; just pass through the string representation
        return { value: value == null ? null : String(value) };
    }

    if (to === 'datetime') {
        if (from === 'date') {
            // lossy: date → datetime (not auto-reversible)
            return { value: value == null ? null : String(value), lossy: true };
        }
        return { value: value == null ? null : String(value) };
    }

    // Unknown coerce type
    return {
        value: null,
        diagnostic: {
            ruleIndex, sourcePath, targetPath,
            errorCode: 'COERCE_FAILURE',
            message: `Unsupported coerce type: ${to}`
        }
    };
}

/**
 * Compute reverse coerce descriptor.
 * Returns `null` if the coerce is lossy and should not be reversed (rule is skipped entirely).
 * Returns `'passthrough'` for legacy string descriptors without explicit direction — value copies unchanged.
 */
function reverseCoerce(coerceDescriptor: any): any | null | 'passthrough' {
    if (coerceDescriptor == null) {
        // No descriptor: pass value through unchanged (mirrors applyCoerce null guard)
        return 'passthrough';
    }
    if (typeof coerceDescriptor === 'string') {
        // Legacy descriptors without explicit from/to — pass value through unchanged on reverse
        return 'passthrough';
    }
    const from = coerceDescriptor.from ?? 'any';
    const to = coerceDescriptor.to ?? 'string';
    if (isLossyCoerce(from, to)) return null;
    return { from: to, to: from, format: coerceDescriptor.format };
}

// ---------------------------------------------------------------------------
// flatten / nest helpers
// ---------------------------------------------------------------------------

function applyFlatten(value: any, targetPath: string, separator: string | undefined, output: any): void {
    if (Array.isArray(value)) {
        if (separator !== undefined) {
            setByPath(output, targetPath, value.join(separator));
        } else {
            // Positional: write to targetPath_0, targetPath_1, ...
            for (let i = 0; i < value.length; i++) {
                setByPath(output, `${targetPath}_${i}`, clone(value[i]));
            }
        }
    } else if (value !== null && typeof value === 'object') {
        // Dot-prefix object keys: write to parent container with literal dotted keys
        // e.g. targetPath='out.addr', key='street' → output.out['addr.street'] = v
        const parts = splitPath(targetPath);
        const lastSeg = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('.');
        // Ensure parent container exists
        if (parentPath) {
            const parentContainer = getByPath(output, parentPath);
            if (parentContainer == null || typeof parentContainer !== 'object') {
                setByPath(output, parentPath, {});
            }
        }
        const container = parentPath ? getByPath(output, parentPath) : output;
        for (const [k, v] of Object.entries(value)) {
            container[`${lastSeg}.${k}`] = clone(v);
        }
    }
}

function applyNest(source: any, sourcePath: string, targetPath: string, separator: string | undefined, output: any): void {
    const value = getByPath(source, sourcePath);
    if (typeof value === 'string' && separator !== undefined) {
        // Split string by separator
        setByPath(output, targetPath, value.split(separator));
        return;
    }

    // Positional: look for sourcePath_0, sourcePath_1, ...
    const positionalValues: any[] = [];
    let i = 0;
    while (true) {
        const candidate = getByPath(source, `${sourcePath}_${i}`);
        if (candidate === undefined) break;
        positionalValues.push(candidate);
        i++;
    }
    if (positionalValues.length > 0) {
        setByPath(output, targetPath, positionalValues);
        return;
    }

    // If value is already an array, preserve it
    if (value !== undefined) {
        setByPath(output, targetPath, clone(value));
    }
}

// ---------------------------------------------------------------------------
// array mode execution
// ---------------------------------------------------------------------------

function executeEach(
    sourceArray: any[],
    innerRules: any[],
    sourceDocument: any,
    direction: MappingDirection,
    diagnostics: MappingDiagnostic[],
    parentRuleIndex: number,
    runtime: IFelRuntime,
): any[] {
    return sourceArray.map((element: any, index: number) => {
        const itemOutput: any = {};
        for (const innerRule of innerRules) {
            const srcPath = innerRule.sourcePath;
            const tgtPath = innerRule.targetPath;
            if (!tgtPath && innerRule.transform !== 'drop') continue;

            let value = srcPath ? getByPath(element, srcPath) : undefined;

            const transform = innerRule.transform || 'preserve';
            if (transform === 'drop') continue;
            if (transform === 'expression') {
                try {
                    value = evalFEL(runtime, innerRule.expression, value, sourceDocument, index);
                } catch (e) {
                    diagnostics.push({
                        ruleIndex: parentRuleIndex,
                        sourcePath: srcPath ?? undefined,
                        targetPath: tgtPath ?? undefined,
                        errorCode: 'FEL_RUNTIME',
                        message: String(e)
                    });
                    continue;
                }
            } else if (transform === 'preserve') {
                // value already set
            }

            if (innerRule.default !== undefined && value === undefined) {
                value = innerRule.default;
            }
            if (value === undefined) continue;
            setByPath(itemOutput, tgtPath!, clone(value));
        }
        return itemOutput;
    });
}

function executeIndexed(
    sourceArray: any[],
    innerRules: any[],
    output: any,
    targetBasePath: string,
    diagnostics: MappingDiagnostic[],
    ruleIndex: number,
): void {
    for (const innerRule of innerRules) {
        const idx = innerRule.index;
        const tgtPath = innerRule.targetPath;
        if (idx === undefined || !tgtPath) continue;
        const value = sourceArray[idx];
        if (value === undefined) continue;
        // targetPath is relative to the parent targetPath
        const fullTarget = targetBasePath ? `${targetBasePath}.${tgtPath}` : tgtPath;
        setByPath(output, fullTarget, clone(value));
    }
}

// ---------------------------------------------------------------------------
// RuntimeMappingEngine
// ---------------------------------------------------------------------------

/**
 * Bidirectional data transform engine driven by a Formspec mapping document.
 *
 * Rules are priority-ordered and support conditions (FEL), transform types (drop, constant,
 * valueMap, coerce, preserve, expression, flatten, nest, concat, split), and per-rule reverse
 * overrides. Forward mapping transforms Formspec response data into an external format; reverse
 * mapping transforms external data back into Formspec shape.
 */


export class RuntimeMappingEngine implements IRuntimeMappingEngine {
    private readonly doc: any;
    private readonly rules: MappingRule[];
    private readonly felRuntime: IFelRuntime;

    /**
     * Creates a RuntimeMappingEngine from a mapping document.
     * @param mappingDocument - The mapping document containing rules, defaults, and metadata.
     * @param felRuntime - The FEL runtime to use for expression evaluation. Defaults to the Chevrotain runtime.
     */
    constructor(mappingDocument: any, felRuntime: IFelRuntime = wasmFelRuntime) {
        this.doc = mappingDocument || {};
        this.rules = Array.isArray(this.doc.rules) ? this.doc.rules : [];
        this.felRuntime = felRuntime;
    }

    /**
     * Executes a forward mapping: transforms Formspec response data into an external format.
     * Applies document defaults before processing rules.
     * @param source - The Formspec response data to transform.
     */
    public forward(source: any): RuntimeMappingResult {
        return this.execute('forward', source ?? {});
    }

    /**
     * Executes a reverse mapping: transforms external-format data back into Formspec response shape.
     * Uses each rule's `reverse` override when available, otherwise swaps source/target paths.
     * @param source - The external-format data to transform.
     */
    public reverse(source: any): RuntimeMappingResult {
        return this.execute('reverse', source ?? {});
    }

    private execute(direction: MappingDirection, source: any): RuntimeMappingResult {
        const output: any = {};
        const diagnostics: MappingDiagnostic[] = [];
        let appliedRules = 0;

        // Phase 1.6 — document-level direction enforcement
        const docDirection = this.doc.direction;
        if (docDirection === 'forward' && direction === 'reverse') {
            diagnostics.push({
                ruleIndex: -1,
                errorCode: 'INVALID_DOCUMENT',
                message: 'This mapping document is forward-only; reverse execution is not permitted'
            });
            return { direction, output, appliedRules, diagnostics };
        }
        if (docDirection === 'reverse' && direction === 'forward') {
            diagnostics.push({
                ruleIndex: -1,
                errorCode: 'INVALID_DOCUMENT',
                message: 'This mapping document is reverse-only; forward execution is not permitted'
            });
            return { direction, output, appliedRules, diagnostics };
        }

        if (direction === 'forward' && this.doc.defaults && typeof this.doc.defaults === 'object') {
            for (const [path, value] of Object.entries(this.doc.defaults)) {
                setByPath(output, path, clone(value));
            }
        }

        const sortedRules = [...this.rules].sort((a, b) => {
            const ap = direction === 'forward' ? (a.priority ?? 0) : (a.reversePriority ?? a.priority ?? 0);
            const bp = direction === 'forward' ? (b.priority ?? 0) : (b.reversePriority ?? b.priority ?? 0);
            return bp - ap;
        });

        for (let ruleIndex = 0; ruleIndex < sortedRules.length; ruleIndex++) {
            const rule = sortedRules[ruleIndex];

            // Phase 1.5 — bidirectional: false skips reverse
            if (direction === 'reverse' && rule.bidirectional === false) {
                continue;
            }

            // Phase 2.2 — FEL condition evaluation
            if (rule.condition) {
                try {
                    const condResult = evalFEL(this.felRuntime, rule.condition, undefined, source);
                    if (!condResult) continue;
                } catch (_e) {
                    // condition evaluation error → skip rule
                    continue;
                }
            }

            const effective = direction === 'reverse' && rule.reverse
                ? { ...rule, ...rule.reverse }
                : rule;

            const sourcePath = direction === 'forward'
                ? effective.sourcePath
                : (effective.targetPath ?? rule.targetPath);
            const targetPath = direction === 'forward'
                ? effective.targetPath
                : (effective.sourcePath ?? rule.sourcePath);

            const transform = effective.transform || 'preserve';

            // Phase 1.5 — drop is inherently non-reversible
            if (transform === 'drop') continue;

            if (!targetPath && transform !== 'flatten' && transform !== 'split') {
                continue;
            }

            // Handle array modes
            if (effective.array) {
                const arr = effective.array as ArrayDescriptor;
                const sourceArray = getByPath(source, sourcePath ?? undefined);

                if (arr.mode === 'whole') {
                    // Pass array as-is to the rule transform
                    let value = sourceArray;
                    if (transform === 'expression') {
                        try {
                            value = evalFEL(this.felRuntime, effective.expression!, value, source);
                        } catch (e) {
                            diagnostics.push({ ruleIndex, sourcePath: sourcePath ?? undefined, targetPath: targetPath ?? undefined, errorCode: 'FEL_RUNTIME', message: String(e) });
                            continue;
                        }
                    }
                    if (value === undefined && effective.default !== undefined) value = effective.default;
                    if (value === undefined) continue;
                    setByPath(output, targetPath!, clone(value));
                    appliedRules++;
                } else if (arr.mode === 'each') {
                    if (!Array.isArray(sourceArray)) continue;
                    const innerRules = arr.innerRules ?? [];
                    const items = executeEach(sourceArray, innerRules, source, direction, diagnostics, ruleIndex, this.felRuntime);
                    setByPath(output, targetPath!, items);
                    appliedRules++;
                } else if (arr.mode === 'indexed') {
                    if (!Array.isArray(sourceArray)) continue;
                    const innerRules = arr.innerRules ?? [];
                    const baseTarget = targetPath ?? '';
                    executeIndexed(sourceArray, innerRules, output, baseTarget, diagnostics, ruleIndex);
                    appliedRules++;
                }
                continue;
            }

            let value = getByPath(source, sourcePath ?? undefined);

            // Phase 1.4 — per-rule default fallback
            if (value === undefined && 'default' in effective) {
                value = effective.default;
            }

            if (transform === 'constant') {
                value = parseSimpleLiteral(String(effective.expression ?? 'null'));
            } else if (transform === 'valueMap') {
                const rawMap = effective.valueMap;
                if (value !== undefined && value !== null) {
                    const result = applyValueMap(rawMap, value, direction, ruleIndex, sourcePath ?? undefined, targetPath ?? undefined);
                    if (result.diagnostic) diagnostics.push(result.diagnostic);
                    if (result.skip) continue;
                    value = result.value;
                }
            } else if (transform === 'coerce') {
                let coerceDescriptor = effective.coerce;
                // For reverse, swap the coerce direction
                if (direction === 'reverse') {
                    const reversed = reverseCoerce(coerceDescriptor);
                    if (reversed === null) continue; // lossy — skip reverse entirely
                    if (reversed === 'passthrough') {
                        // Legacy descriptor without direction — pass value through unchanged
                        // (fall through to setByPath below with value unchanged)
                    } else {
                        coerceDescriptor = reversed;
                        const result = applyCoerce(value, coerceDescriptor, ruleIndex, sourcePath ?? undefined, targetPath ?? undefined);
                        if (result.diagnostic) {
                            diagnostics.push(result.diagnostic);
                            continue;
                        }
                        value = result.value;
                    }
                } else {
                    const result = applyCoerce(value, coerceDescriptor, ruleIndex, sourcePath ?? undefined, targetPath ?? undefined);
                    if (result.diagnostic) {
                        diagnostics.push(result.diagnostic);
                        continue;
                    }
                    value = result.value;
                }
            } else if (transform === 'expression') {
                try {
                    value = evalFEL(this.felRuntime, effective.expression!, value, source);
                } catch (e) {
                    diagnostics.push({
                        ruleIndex,
                        sourcePath: sourcePath ?? undefined,
                        targetPath: targetPath ?? undefined,
                        errorCode: 'FEL_RUNTIME',
                        message: String(e)
                    });
                    continue;
                }
            } else if (transform === 'flatten') {
                if (value === undefined) continue;
                applyFlatten(value, targetPath!, effective.separator, output);
                appliedRules++;
                continue;
            } else if (transform === 'nest') {
                applyNest(source, sourcePath ?? '', targetPath!, effective.separator, output);
                appliedRules++;
                continue;
            } else if (transform === 'concat') {
                try {
                    value = evalFEL(this.felRuntime, effective.expression!, value, source);
                } catch (e) {
                    diagnostics.push({
                        ruleIndex,
                        sourcePath: sourcePath ?? undefined,
                        targetPath: targetPath ?? undefined,
                        errorCode: 'FEL_RUNTIME',
                        message: String(e)
                    });
                    continue;
                }
            } else if (transform === 'split') {
                try {
                    const splitResult = evalFEL(this.felRuntime, effective.expression!, value, source);
                    if (Array.isArray(splitResult)) {
                        for (let i = 0; i < splitResult.length; i++) {
                            setByPath(output, `${targetPath}[${i}]`, clone(splitResult[i]));
                        }
                    } else if (splitResult !== null && typeof splitResult === 'object') {
                        for (const [k, v] of Object.entries(splitResult)) {
                            setByPath(output, `${targetPath}.${k}`, clone(v));
                        }
                    }
                    appliedRules++;
                } catch (e) {
                    diagnostics.push({
                        ruleIndex,
                        sourcePath: sourcePath ?? undefined,
                        targetPath: targetPath ?? undefined,
                        errorCode: 'FEL_RUNTIME',
                        message: String(e)
                    });
                }
                continue;
            } else if (transform !== 'preserve') {
                diagnostics.push({
                    ruleIndex,
                    sourcePath: sourcePath ?? undefined,
                    targetPath: targetPath ?? undefined,
                    errorCode: 'COERCE_FAILURE',
                    message: `Unsupported transform: ${transform}`
                });
                continue;
            }

            if (value === undefined) continue;
            setByPath(output, targetPath!, clone(value));
            appliedRules += 1;
        }

        // --- JSON adapter post-processing ---
        const jsonAdapter = this.doc.adapters?.json;
        if (jsonAdapter) {
            if (jsonAdapter.nullHandling === 'omit') omitNulls(output);
            if (jsonAdapter.sortKeys) sortKeysDeep(output);
            // `pretty` is a no-op at engine level — handled by the consumer when serializing
        }

        // --- CSV adapter serialization (Phase 4.2) ---
        const csvAdapter = (this.doc.adapters as any)?.csv;
        const isCsvFormat = csvAdapter || (this.doc.targetSchema as any)?.format === 'csv';
        if (isCsvFormat) {
            for (const rule of sortedRules) {
                const tp = direction === 'forward' ? rule.targetPath : (rule.sourcePath ?? rule.targetPath);
                if (tp && /[.\[\]]/.test(tp)) {
                    diagnostics.push({
                        ruleIndex: sortedRules.indexOf(rule),
                        sourcePath: rule.sourcePath,
                        targetPath: rule.targetPath,
                        errorCode: 'ADAPTER_FAILURE',
                        message: `targetPath "${tp}" is not a simple identifier (CSV requires flat keys)`,
                    } as any);
                }
            }
            return { direction, output: serializeCSV(output, csvAdapter ?? {}) as any, appliedRules, diagnostics };
        }

        // --- XML adapter serialization (Phase 4.3) ---
        const xmlAdapter = (this.doc.adapters as any)?.xml;
        const isXmlFormat = xmlAdapter || (this.doc.targetSchema as any)?.format === 'xml';
        if (isXmlFormat) {
            return { direction, output: serializeXML(output, xmlAdapter ?? {}) as any, appliedRules, diagnostics };
        }

        return {
            direction,
            output,
            appliedRules,
            diagnostics,
        };
    }
}

/** Recursively removes keys whose value is null or undefined from an object (mutates in place). */
function omitNulls(obj: any): void {
    if (obj == null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (const item of obj) omitNulls(item); return; }
    for (const key of Object.keys(obj)) {
        if (obj[key] === null || obj[key] === undefined) { delete obj[key]; }
        else if (typeof obj[key] === 'object') omitNulls(obj[key]);
    }
}

/** Recursively sorts object keys lexicographically (mutates in place). */
function sortKeysDeep(obj: any): void {
    if (obj == null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (const item of obj) sortKeysDeep(item); return; }
    const keys = Object.keys(obj).sort();
    const entries = keys.map(k => [k, obj[k]] as const);
    for (const key of Object.keys(obj)) delete obj[key];
    for (const [key, value] of entries) { obj[key] = value; if (typeof value === 'object') sortKeysDeep(value); }
}

/** Parses a simple literal value from a string: quoted strings, booleans, null, or numbers. Falls back to the raw string. */
function parseSimpleLiteral(expression: string): any {
    const trimmed = expression.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return asNum;
    return trimmed;
}

// ---------------------------------------------------------------------------
// CSV adapter (Phase 4.2)
// ---------------------------------------------------------------------------

interface CSVConfig {
    delimiter?: string;
    quote?: string;
    header?: boolean;
    lineEnding?: 'crlf' | 'lf';
}

/** Serializes a flat output object to a CSV string. */
function serializeCSV(output: Record<string, unknown>, config: CSVConfig): string {
    const delimiter = config.delimiter ?? ',';
    const quote = config.quote ?? '"';
    const includeHeader = config.header !== false;
    const lineEnding = config.lineEnding === 'lf' ? '\n' : '\r\n';

    // Only include top-level keys whose values are primitives
    const keys = Object.keys(output).filter(k => {
        const v = output[k];
        return v === null || v === undefined || typeof v !== 'object';
    });

    if (keys.length === 0) return '';

    const csvQuote = (val: unknown): string => {
        const str = val == null ? '' : String(val);
        if (str.includes(delimiter) || str.includes(quote) || str.includes('\n') || str.includes('\r')) {
            return quote + str.replace(new RegExp(escapeRegex(quote), 'g'), quote + quote) + quote;
        }
        return str;
    };

    const rows: string[] = [];
    if (includeHeader) {
        rows.push(keys.map(k => csvQuote(k)).join(delimiter));
    }
    rows.push(keys.map(k => csvQuote(output[k])).join(delimiter));

    return rows.join(lineEnding);
}

/** Escapes special regex characters in a string. */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// XML adapter (Phase 4.3)
// ---------------------------------------------------------------------------

interface XMLConfig {
    rootElement?: string;
    declaration?: boolean;
    indent?: number;
    cdata?: string[];
}

/** Serializes an output object to an XML string. Dot-paths in keys produce nested elements; keys starting with `@` become attributes. */
function serializeXML(output: Record<string, unknown>, config: XMLConfig): string {
    const rootElement = config.rootElement ?? 'root';
    const includeDeclaration = config.declaration !== false;
    const indentSize = config.indent ?? 2;
    const cdataPaths = new Set(config.cdata ?? []);

    const tree = buildXMLTree(output);
    const lines: string[] = [];
    if (includeDeclaration) {
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    }
    renderElement(rootElement, tree, 0, indentSize, cdataPaths, '', lines);
    return lines.join(indentSize > 0 ? '\n' : '');
}

type XMLTree = { attributes: Record<string, string>; children: Map<string, XMLTree>; text?: string };

function buildXMLTree(obj: Record<string, unknown>): XMLTree {
    const node: XMLTree = { attributes: {}, children: new Map() };
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('@')) {
            node.attributes[key.slice(1)] = value == null ? '' : String(value);
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            node.children.set(key, buildXMLTree(value as Record<string, unknown>));
        } else {
            const child: XMLTree = { attributes: {}, children: new Map() };
            child.text = value == null ? '' : String(value);
            node.children.set(key, child);
        }
    }
    return node;
}

function renderElement(
    name: string,
    node: XMLTree,
    depth: number,
    indentSize: number,
    cdataPaths: Set<string>,
    elementPath: string,
    lines: string[],
): void {
    const indent = indentSize > 0 ? ' '.repeat(depth * indentSize) : '';
    const childIndent = indentSize > 0 ? ' '.repeat((depth + 1) * indentSize) : '';

    let attrStr = '';
    for (const [attrName, attrValue] of Object.entries(node.attributes)) {
        attrStr += ` ${attrName}="${escapeXML(attrValue)}"`;
    }

    const hasChildren = node.children.size > 0;
    const hasText = node.text !== undefined;

    if (!hasChildren && !hasText) {
        lines.push(`${indent}<${name}${attrStr}/>`);
        return;
    }
    if (hasText && !hasChildren) {
        const textContent = cdataPaths.has(elementPath) ? `<![CDATA[${node.text}]]>` : escapeXML(node.text!);
        lines.push(`${indent}<${name}${attrStr}>${textContent}</${name}>`);
        return;
    }
    lines.push(`${indent}<${name}${attrStr}>`);
    if (hasText) {
        const textContent = cdataPaths.has(elementPath) ? `<![CDATA[${node.text}]]>` : escapeXML(node.text!);
        lines.push(`${childIndent}${textContent}`);
    }
    for (const [childName, childNode] of node.children) {
        const childPath = elementPath ? `${elementPath}.${childName}` : childName;
        renderElement(childName, childNode, depth + 1, indentSize, cdataPaths, childPath, lines);
    }
    lines.push(`${indent}</${name}>`);
}

/** Escapes special XML characters in text content and attribute values. */
function escapeXML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
