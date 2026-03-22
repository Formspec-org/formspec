/** @filedesc WASM bridge — lazy initialization and typed wrappers for all Rust WASM exports. */

// wasm-pack --target web emits JS glue with init helpers instead of a top-level `.wasm` import.
// The engine owns initialization so downstream Vite/Vitest consumers only see normal JS modules.

let _wasmReady = false;
let _initPromise: Promise<void> | null = null;
const nodeFsModuleName = 'node:fs';
const nodeModuleModuleName = 'node:module';
const nodePathModuleName = 'node:path';

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
            const runtime = await import('../wasm-pkg/formspec_wasm.js');
            const runningInNode = typeof globalThis.process !== 'undefined'
                && globalThis.process.versions?.node;
            let wasmBytes: Uint8Array | null = null;

            if (runningInNode && typeof runtime.initSync === 'function') {
                const { readFileSync } = await import(/* @vite-ignore */ nodeFsModuleName);

                if (typeof import.meta.resolve === 'function') {
                    try {
                        const resolved = await import.meta.resolve('../wasm-pkg/formspec_wasm_bg.wasm');
                        if (resolved.startsWith('file:')) {
                            wasmBytes = readFileSync(new URL(resolved));
                        }
                    } catch {
                        wasmBytes = null;
                    }
                }

                if (!wasmBytes) {
                    try {
                        const { createRequire } = await import(/* @vite-ignore */ nodeModuleModuleName);
                        const { dirname, resolve } = await import(/* @vite-ignore */ nodePathModuleName);
                        const require = createRequire(resolve(process.cwd(), 'package.json'));
                        const enginePackagePath = require.resolve('formspec-engine/package.json');
                        wasmBytes = readFileSync(resolve(
                            dirname(enginePackagePath),
                            'wasm-pkg',
                            'formspec_wasm_bg.wasm',
                        ));
                    } catch {
                        wasmBytes = null;
                    }
                }

                if (!wasmBytes
                    && typeof import.meta.url === 'string'
                    && import.meta.url.startsWith('file:')) {
                    wasmBytes = readFileSync(new URL('../wasm-pkg/formspec_wasm_bg.wasm', import.meta.url));
                }
            }

            if (typeof runtime.initSync === 'function' && wasmBytes) {
                runtime.initSync({ module: wasmBytes });
            } else if (typeof runtime.default === 'function') {
                await runtime.default();
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


// ---------------------------------------------------------------------------
// Module accessor — cached by initWasm, synchronous after initialization
// ---------------------------------------------------------------------------

type WasmModule = typeof import('../wasm-pkg/formspec_wasm.js');

let _wasm: WasmModule | null = null;

/** Synchronous accessor — throws if WASM is not initialized. */
function wasm(): WasmModule {
    if (!_wasm || !_wasmReady) {
        throw new Error('Formspec engine not initialized. Call await initFormspecEngine() first.');
    }
    return _wasm;
}

// ---------------------------------------------------------------------------
// Typed wrappers — each delegates to the WASM export with JSON marshalling
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
}

/** Evaluate a FEL expression with full FormspecEnvironment context. */
export function wasmEvalFELWithContext(expression: string, context: WasmFelContext): any {
    const resultJson = wasm().evalFELWithContext(expression, JSON.stringify(context));
    return JSON.parse(resultJson);
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

/** Parse a FEL expression and return whether it's valid. */
export function wasmParseFEL(expression: string): boolean {
    return wasm().parseFEL(expression);
}

/** Tokenize a FEL expression and return positioned token records. */
export function wasmTokenizeFEL(expression: string): Array<{
    tokenType: string;
    text: string;
    start: number;
    end: number;
}> {
    const resultJson = wasm().tokenizeFEL(expression);
    return JSON.parse(resultJson);
}

/** Extract field path dependencies from a FEL expression. Returns an array of path strings. */
export function wasmGetFELDependencies(expression: string): string[] {
    const resultJson = wasm().getFELDependencies(expression);
    return JSON.parse(resultJson);
}

/** Extract full dependency info from a FEL expression. */
export function wasmExtractDependencies(expression: string): {
    fields: string[];
    contextRefs: string[];
    instanceRefs: string[];
    mipDeps: string[];
    hasSelfRef: boolean;
    hasWildcard: boolean;
    usesPrevNext: boolean;
} {
    const resultJson = wasm().extractDependencies(expression);
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

/** Detect the document type of a Formspec JSON document. */
export function wasmDetectDocumentType(doc: unknown): string | null {
    return wasm().detectDocumentType(JSON.stringify(doc)) ?? null;
}

/** Convert a JSON Pointer into a JSONPath string. */
export function wasmJsonPointerToJsonPath(pointer: string): string {
    return wasm().jsonPointerToJsonPath(pointer);
}

/** Plan schema validation dispatch and component-node target enumeration. */
export function wasmPlanSchemaValidation(
    doc: unknown,
    documentType?: string | null,
): {
    documentType: string | null;
    mode: 'unknown' | 'document' | 'component';
    componentTargets: Array<{
        pointer: string;
        component: string;
        node: any;
    }>;
    error?: string | null;
} {
    const resultJson = wasm().planSchemaValidation(
        JSON.stringify(doc),
        documentType ?? undefined,
    );
    return JSON.parse(resultJson);
}

/** Assemble a definition by resolving $ref inclusions. */
export function wasmAssembleDefinition(
    definition: unknown,
    fragments: Record<string, unknown>,
): {
    definition: any;
    warnings: string[];
    errors: string[];
    assembledFrom?: Array<{
        url: string;
        version: string;
        keyPrefix?: string;
        fragment?: string;
    }>;
} {
    const resultJson = wasm().assembleDefinition(
        JSON.stringify(definition),
        JSON.stringify(fragments),
    );
    return JSON.parse(resultJson);
}

/** Execute a mapping transform. */
export function wasmExecuteMapping(
    rules: unknown[],
    source: unknown,
    direction: 'forward' | 'reverse',
): { direction: string; output: any; rulesApplied: number; diagnostics: any[] } {
    const resultJson = wasm().executeMapping(
        JSON.stringify(rules),
        JSON.stringify(source),
        direction,
    );
    return JSON.parse(resultJson);
}

/** Execute a full mapping document (rules + defaults + autoMap). */
export function wasmExecuteMappingDoc(
    doc: unknown,
    source: unknown,
    direction: 'forward' | 'reverse',
): { direction: string; output: any; rulesApplied: number; diagnostics: any[] } {
    const resultJson = wasm().executeMappingDoc(
        JSON.stringify(doc),
        JSON.stringify(source),
        direction,
    );
    return JSON.parse(resultJson);
}

/** Lint a Formspec document. */
export function wasmLintDocument(doc: unknown): {
    documentType: string | null;
    valid: boolean;
    diagnostics: any[];
} {
    const resultJson = wasm().lintDocument(JSON.stringify(doc));
    return JSON.parse(resultJson);
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
    references: string[];
    variables: string[];
    functions: string[];
} {
    const resultJson = wasm().analyzeFEL(expression);
    return JSON.parse(resultJson);
}

/** Collect the rewriteable targets in a FEL expression. */
export function wasmCollectFELRewriteTargets(expression: string): {
    fieldPaths: string[];
    currentPaths: string[];
    variables: string[];
    instanceNames: string[];
    navigationTargets: Array<{ functionName: 'prev' | 'next' | 'parent'; name: string }>;
} {
    const resultJson = wasm().collectFELRewriteTargets(expression);
    return JSON.parse(resultJson);
}

/** Rewrite a FEL expression using explicit rewrite maps. */
export function wasmRewriteFELReferences(
    expression: string,
    rewrites: {
        fieldPaths?: Record<string, string>;
        currentPaths?: Record<string, string>;
        variables?: Record<string, string>;
        instanceNames?: Record<string, string>;
        navigationTargets?: Record<string, string>;
    },
): string {
    return wasm().rewriteFELReferences(expression, JSON.stringify(rewrites));
}

/** Rewrite FEL using definition-assembly `RewriteMap` JSON (fragment + host keys). */
export function wasmRewriteFelForAssembly(expression: string, mapJson: string): string {
    return wasm().rewriteFelForAssembly(expression, mapJson);
}

/** Rewrite FEL expressions embedded in {{...}} interpolation segments. */
export function wasmRewriteMessageTemplate(
    message: string,
    rewrites: {
        fieldPaths?: Record<string, string>;
        currentPaths?: Record<string, string>;
        variables?: Record<string, string>;
        instanceNames?: Record<string, string>;
        navigationTargets?: Record<string, string>;
    },
): string {
    return wasm().rewriteMessageTemplate(message, JSON.stringify(rewrites));
}

/** Print a FEL expression AST back to normalized source. */
export function wasmPrintFEL(expression: string): string {
    return wasm().printFEL(expression);
}

/** Return the builtin FEL function catalog exported by the Rust runtime. */
export function wasmListBuiltinFunctions(): Array<{
    name: string;
    category: string;
    signature: string;
    description: string;
}> {
    const resultJson = wasm().listBuiltinFunctions();
    return JSON.parse(resultJson);
}

/** Lint a Formspec document with explicit registry documents. */
export function wasmLintDocumentWithRegistries(
    doc: unknown,
    registries: unknown[],
): { documentType: string | null; valid: boolean; diagnostics: any[] } {
    const resultJson = wasm().lintDocumentWithRegistries(
        JSON.stringify(doc),
        JSON.stringify(registries),
    );
    return JSON.parse(resultJson);
}

/** Parse and validate a registry document, returning summary metadata. */
export function wasmParseRegistry(registry: unknown): {
    publisher: { name?: string; url?: string; contact?: string };
    published?: string;
    entryCount: number;
    validationIssues: any[];
} {
    const resultJson = wasm().parseRegistry(JSON.stringify(registry));
    return JSON.parse(resultJson);
}

/** Find the highest-version registry entry matching a name and version constraint. */
export function wasmFindRegistryEntry(
    registry: unknown,
    name: string,
    versionConstraint = '',
): any | null {
    const resultJson = wasm().findRegistryEntry(
        JSON.stringify(registry),
        name,
        versionConstraint,
    );
    return JSON.parse(resultJson);
}

/** Validate a lifecycle transition between two registry statuses. */
export function wasmValidateLifecycleTransition(from: string, to: string): boolean {
    return wasm().validateLifecycleTransition(from, to);
}

/** Construct a well-known registry URL from a base URL. */
export function wasmWellKnownRegistryUrl(baseUrl: string): string {
    return wasm().wellKnownRegistryUrl(baseUrl);
}

/** Generate a structured changelog between two definitions. */
export function wasmGenerateChangelog(
    oldDefinition: unknown,
    newDefinition: unknown,
    definitionUrl: string,
): any {
    const resultJson = wasm().generateChangelog(
        JSON.stringify(oldDefinition),
        JSON.stringify(newDefinition),
        definitionUrl,
    );
    return JSON.parse(resultJson);
}

/** Validate enabled x-extension usage in an item tree against registry entries. */
export function wasmValidateExtensionUsage(
    items: unknown[],
    registryEntries: Record<string, unknown>,
): Array<{
    path: string;
    extension: string;
    severity: 'error' | 'warning' | 'info';
    code: 'UNRESOLVED_EXTENSION' | 'EXTENSION_RETIRED' | 'EXTENSION_DEPRECATED';
    message: string;
}> {
    const resultJson = wasm().validateExtensionUsage(
        JSON.stringify(items),
        JSON.stringify(registryEntries),
    );
    return JSON.parse(resultJson);
}
