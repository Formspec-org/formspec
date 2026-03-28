/** @filedesc Runtime WASM — init, accessors, and wrappers that use only the runtime `formspec_wasm_runtime` module. */

import {
    nodeFsModuleName,
    resolveWasmAssetPathForNode,
} from './wasm-bridge-shared.js';

let _wasmReady = false;
let _initPromise: Promise<void> | null = null;

export type WasmModule = typeof import('../wasm-pkg-runtime/formspec_wasm_runtime.js');

let _wasm: WasmModule | null = null;

/** Whether the WASM module has been initialized and is ready for use. */
export function isWasmReady(): boolean {
    return _wasmReady;
}

/**
 * Initialize the WASM module. Safe to call multiple times — subsequent calls
 * return the same promise. Resolves when WASM is ready; rejects on failure.
 *
 * In Node.js, uses `initSync()` with bytes read from disk.
 * In browsers, the generated wasm-bindgen loader fetches the sibling `.wasm` asset via URL.
 */
export async function initWasm(): Promise<void> {
    if (_wasmReady) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const runtime = await import('../wasm-pkg-runtime/formspec_wasm_runtime.js');
            const runningInNode = typeof globalThis.process !== 'undefined'
                && globalThis.process.versions?.node;
            let wasmBytes: Uint8Array | null = null;

            if (runningInNode && typeof runtime.initSync === 'function') {
                const { readFileSync } = await import(/* @vite-ignore */ nodeFsModuleName);
                const wasmPath = await resolveWasmAssetPathForNode(
                    '../wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm',
                );
                wasmBytes = readFileSync(wasmPath);
            }

            if (typeof runtime.initSync === 'function' && wasmBytes) {
                runtime.initSync({ module: wasmBytes });
            } else if (typeof runtime.default === 'function') {
                await runtime.default({
                    module_or_path: new URL('../wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm', import.meta.url),
                });
            }

            _wasm = runtime;
            _wasmReady = true;
        } catch (e) {
            _initPromise = null;
            throw e;
        }
    })();

    return _initPromise;
}

function wasm(): WasmModule {
    if (!_wasm || !_wasmReady) {
        throw new Error(
            'Formspec runtime WASM is not initialized. Call await initFormspecEngine() (or await initWasm()) before using the engine.',
        );
    }
    return _wasm;
}

/**
 * Initialized runtime module — for `wasm-bridge-tools` only (ABI check).
 * Not re-exported from the public `wasm-bridge` barrel.
 */
export function getWasmModule(): WasmModule {
    return wasm();
}

// ---------------------------------------------------------------------------
// Typed wrappers — runtime `formspec_wasm_runtime` only
// ---------------------------------------------------------------------------

/** Evaluate a FEL expression with optional field values. Returns the evaluated result. */
export function wasmEvalFEL(expression: string, fields: Record<string, any> = {}): any {
    const resultJson = wasm().evalFEL(expression, JSON.stringify(fields));
    return JSON.parse(resultJson);
}

/** FEL evaluation context for the richer WASM evaluator. */
export interface WasmFelContext {
    fields: Record<string, any>;
    variables?: Record<string, any>;
    mipStates?: Record<string, { valid?: boolean; relevant?: boolean; readonly?: boolean; required?: boolean }>;
    repeatContext?: {
        current: any;
        index: number;
        count: number;
        collection?: any[];
        parent?: WasmFelContext['repeatContext'];
    };
    instances?: Record<string, any>;
    nowIso?: string;
    /** Active locale code (BCP 47) — backs `locale()` and default for `pluralCategory()`. */
    locale?: string;
    /** Runtime metadata bag — backs `runtimeMeta(key)`. */
    meta?: Record<string, string | number | boolean>;
}

/** Evaluate a FEL expression with full FormspecEnvironment context. */
export function wasmEvalFELWithContext(expression: string, context: WasmFelContext): any {
    const resultJson = wasm().evalFELWithContext(expression, JSON.stringify(context));
    return JSON.parse(resultJson);
}

/** Locale §3.3.1 — true if the expression AST is only literals and unary `not` / `!` / `-`. */
export function wasmFelExprIsInterpolationStaticLiteral(expression: string): boolean {
    return wasm().felExprIsInterpolationStaticLiteral(expression);
}

/**
 * Locale §3.3.1 rule 2 — read and reset the error-diagnostics flag.
 * Returns `true` if the most recent WASM FEL eval recorded error-severity
 * diagnostics. The flag is reset to `false` after reading.
 */
export function wasmConsumeLastEvalErrorDiagnostics(): boolean {
    return wasm().consumeLastEvalErrorDiagnostics();
}

/** Normalize FEL source before evaluation (bare `$`, repeat qualifiers, repeat aliases). */
export function wasmPrepareFelExpression(optionsJson: string): string {
    return wasm().prepareFelExpression(optionsJson);
}

/** Inline `optionSet` references from `optionSets` on a definition JSON document. */
export function wasmResolveOptionSetsOnDefinition(definitionJson: string): string {
    return wasm().resolveOptionSetsOnDefinition(definitionJson);
}

/** Apply `migrations` on a definition to flat response data (FEL transforms in Rust). */
export function wasmApplyMigrationsToResponseData(
    definitionJson: string,
    responseDataJson: string,
    fromVersion: string,
    nowIso: string,
): string {
    return wasm().applyMigrationsToResponseData(definitionJson, responseDataJson, fromVersion, nowIso);
}

/** Coerce an inbound field value (whitespace, numeric strings, money, precision). */
export function wasmCoerceFieldValue(
    itemJson: string,
    bindJson: string,
    definitionJson: string,
    valueJson: string,
): string {
    return wasm().coerceFieldValue(itemJson, bindJson, definitionJson, valueJson);
}

/** Extract field path dependencies from a FEL expression. Returns an array of path strings. */
export function wasmGetFELDependencies(expression: string): string[] {
    const resultJson = wasm().getFELDependencies(expression);
    return JSON.parse(resultJson);
}

/** Normalize a dotted path by stripping repeat indices. */
export function wasmNormalizeIndexedPath(path: string): string {
    return wasm().normalizeIndexedPath(path);
}

/** Resolve an item in a nested item tree by dotted path. */
export function wasmItemAtPath<T = any>(items: unknown[], path: string): T | undefined {
    const resultJson = wasm().itemAtPath(JSON.stringify(items), path);
    const result = JSON.parse(resultJson);
    return result === null ? undefined : result;
}

/** Resolve an item's parent path, index, and value in a nested item tree. */
export function wasmItemLocationAtPath<T = any>(
    items: unknown[],
    path: string,
): { parentPath: string; index: number; item: T } | undefined {
    const resultJson = wasm().itemLocationAtPath(JSON.stringify(items), path);
    const result = JSON.parse(resultJson);
    return result === null ? undefined : result;
}

/** Evaluate a Formspec definition against provided data. */
export function wasmEvaluateDefinition(
    definition: unknown,
    data: Record<string, unknown>,
    context?: {
        nowIso?: string;
        trigger?: 'continuous' | 'submit' | 'demand' | 'disabled';
        previousValidations?: Array<{
            path: string;
            severity: string;
            constraintKind: string;
            code: string;
            message: string;
            source: string;
            shapeId?: string;
            context?: Record<string, unknown>;
        }>;
        previousNonRelevant?: string[];
        instances?: Record<string, unknown>;
        registryDocuments?: unknown[];
        /** Repeat row counts by group base path (authoritative for min/max repeat cardinality). */
        repeatCounts?: Record<string, number>;
    },
): {
    values: any;
    validations: any[];
    nonRelevant: string[];
    variables: any;
    required: Record<string, boolean>;
    readonly: Record<string, boolean>;
} {
    const resultJson = wasm().evaluateDefinition(
        JSON.stringify(definition),
        JSON.stringify(data),
        context ? JSON.stringify(context) : undefined,
    );
    return JSON.parse(resultJson);
}

/** Evaluate screener routes against an isolated answer payload. */
export function wasmEvaluateScreener(
    definition: unknown,
    answers: Record<string, unknown>,
): { target: string; label?: string; message?: string; extensions?: Record<string, unknown> } | null {
    const resultJson = wasm().evaluateScreener(
        JSON.stringify(definition),
        JSON.stringify(answers),
    );
    return JSON.parse(resultJson);
}

/** Analyze a FEL expression and return structural info. */
export function wasmAnalyzeFEL(expression: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    references: string[];
    variables: string[];
    functions: string[];
} {
    const resultJson = wasm().analyzeFEL(expression);
    return JSON.parse(resultJson);
}

/** Check if a string is a valid FEL identifier. */
export function wasmIsValidFelIdentifier(s: string): boolean {
    return wasm().isValidFelIdentifier(s);
}

/** Sanitize a string into a valid FEL identifier. */
export function wasmSanitizeFelIdentifier(s: string): string {
    return wasm().sanitizeFelIdentifier(s);
}

/** Compute dependency groups from recorded changeset entries (JSON round-trip to Rust). */
export function wasmComputeDependencyGroups(entriesJson: string): Array<{ entries: number[]; reason: string }> {
    const resultJson = wasm().computeDependencyGroups(entriesJson);
    return JSON.parse(resultJson);
}
