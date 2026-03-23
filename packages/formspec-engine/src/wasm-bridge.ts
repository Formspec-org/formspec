/** @filedesc WASM bridge — lazy initialization and typed wrappers for all Rust WASM exports. */

// wasm-pack --target web emits JS glue with init helpers instead of a top-level `.wasm` import.
// The engine owns initialization so downstream Vite/Vitest consumers only see normal JS modules.

let _wasmReady = false;
let _initPromise: Promise<void> | null = null;
let _wasmToolsReady = false;
let _initToolsPromise: Promise<void> | null = null;
const nodeFsModuleName = 'node:fs';
const nodeUrlModuleName = 'node:url';
const nodePathModuleName = 'node:path';
const nodeModuleModuleName = 'node:module';

/**
 * Resolve a sibling `.wasm` path for Node `readFileSync`.
 * Vitest/vite-node can rewrite `import.meta.url` to a non-`file:` URL; fall back to the `formspec-engine` package root.
 */
async function resolveWasmAssetPathForNode(relativeToThisModule: string): Promise<string> {
    const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrlModuleName);
    const { dirname, join } = await import(/* @vite-ignore */ nodePathModuleName);
    const { createRequire } = await import(/* @vite-ignore */ nodeModuleModuleName);

    const meta = import.meta.url;
    if (meta.startsWith('file:')) {
        return fileURLToPath(new URL(relativeToThisModule, meta));
    }

    try {
        const require = createRequire(join(process.cwd(), 'package.json'));
        const engineRoot = dirname(require.resolve('formspec-engine/package.json'));
        const tail = relativeToThisModule.replace(/^\.\.\//, '');
        return join(engineRoot, tail);
    } catch {
        const tail = relativeToThisModule.replace(/^\.\.\//, '');
        return join(process.cwd(), '..', 'formspec-engine', tail);
    }
}

/** Whether the WASM module has been initialized and is ready for use. */
export function isWasmReady(): boolean {
    return _wasmReady;
}

/** Whether the tools WASM module has been initialized and is ready for use. */
export function isWasmToolsReady(): boolean {
    return _wasmToolsReady;
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

/**
 * Initialize the tools WASM module (lazy-only paths: lint/registry/mapping/changelog/assembly).
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export async function initWasmTools(): Promise<void> {
    if (_wasmToolsReady) return;
    if (_initToolsPromise) return _initToolsPromise;

    _initToolsPromise = (async () => {
        try {
            if (!_wasmReady || !_wasm) {
                throw new Error(
                    'Formspec tools WASM requires runtime WASM first. Call await initFormspecEngine() before initFormspecEngineTools().',
                );
            }
            const tools = await import('../wasm-pkg-tools/formspec_wasm_tools.js');
            const runningInNode = typeof globalThis.process !== 'undefined'
                && globalThis.process.versions?.node;
            let wasmBytes: Uint8Array | null = null;

            if (runningInNode && typeof tools.initSync === 'function') {
                const { readFileSync } = await import(/* @vite-ignore */ nodeFsModuleName);
                const wasmPath = await resolveWasmAssetPathForNode('../wasm-pkg-tools/formspec_wasm_tools_bg.wasm');
                wasmBytes = readFileSync(wasmPath);
            }

            if (typeof tools.initSync === 'function' && wasmBytes) {
                tools.initSync({ module: wasmBytes });
            } else if (typeof tools.default === 'function') {
                await tools.default({
                    module_or_path: new URL('../wasm-pkg-tools/formspec_wasm_tools_bg.wasm', import.meta.url),
                });
            }

            _wasmTools = tools;
            verifyRuntimeToolsCompatibility(tools);
            _wasmToolsReady = true;
        } catch (e) {
            _initToolsPromise = null;
            throw e;
        }
    })();

    return _initToolsPromise;
}

// ---------------------------------------------------------------------------
// Module accessor — cached by initWasm, synchronous after initialization
// ---------------------------------------------------------------------------

type WasmModule = typeof import('../wasm-pkg-runtime/formspec_wasm_runtime.js');
type WasmToolsModule = typeof import('../wasm-pkg-tools/formspec_wasm_tools.js');

let _wasm: WasmModule | null = null;
let _wasmTools: WasmToolsModule | null = null;

/** Synchronous accessor — throws if WASM is not initialized. */
function wasm(): WasmModule {
    if (!_wasm || !_wasmReady) {
        throw new Error('Formspec engine not initialized. Call await initFormspecEngine() first.');
    }
    return _wasm;
}

/** Synchronous accessor for tools module — throws if tools WASM is not initialized. */
function wasmTools(): WasmToolsModule {
    if (!_wasmTools || !_wasmToolsReady) {
        throw new Error(
            'Formspec tools WASM not initialized. Call await initFormspecEngineTools() before lint/mapping/assembly APIs, ' +
            'or await initWasmTools().',
        );
    }
    return _wasmTools;
}

/** Throws unless tools WASM is ready — use before sync tools calls. */
function assertWasmToolsReadySync(): void {
    if (!_wasmToolsReady || !_wasmTools) {
        throw new Error(
            'Formspec tools WASM not ready. Call await initFormspecEngineTools() after await initFormspecEngine(), ' +
            'or use await assembleDefinition() to load tools lazily.',
        );
    }
}

function verifyRuntimeToolsCompatibility(toolsMod: WasmToolsModule): void {
    const runtimeVersion = wasm().formspecWasmSplitAbiVersion();
    const toolsVersion = toolsMod.formspecWasmSplitAbiVersion();
    if (runtimeVersion !== toolsVersion) {
        throw new Error(
            `WASM runtime/tools compatibility mismatch: runtime ABI=${runtimeVersion}, tools ABI=${toolsVersion}. ` +
            'Rebuild wasm-pkg-runtime and wasm-pkg-tools from the same formspec-wasm commit.',
        );
    }
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
    assertWasmToolsReadySync();
    return wasmTools().parseFEL(expression);
}

/** Tokenize a FEL expression and return positioned token records. */
export function wasmTokenizeFEL(expression: string): Array<{
    tokenType: string;
    text: string;
    start: number;
    end: number;
}> {
    assertWasmToolsReadySync();
    const resultJson = wasmTools().tokenizeFEL(expression);
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().extractDependencies(expression);
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
    assertWasmToolsReadySync();
    return wasmTools().detectDocumentType(JSON.stringify(doc)) ?? null;
}

/** Convert a JSON Pointer into a JSONPath string. */
export function wasmJsonPointerToJsonPath(pointer: string): string {
    assertWasmToolsReadySync();
    return wasmTools().jsonPointerToJsonPath(pointer);
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().planSchemaValidation(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().assembleDefinition(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().executeMapping(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().executeMappingDoc(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().lintDocument(JSON.stringify(doc));
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().collectFELRewriteTargets(expression);
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
    assertWasmToolsReadySync();
    return wasmTools().rewriteFELReferences(expression, JSON.stringify(rewrites));
}

/** Rewrite FEL using definition-assembly `RewriteMap` JSON (fragment + host keys). */
export function wasmRewriteFelForAssembly(expression: string, mapJson: string): string {
    assertWasmToolsReadySync();
    return wasmTools().rewriteFelForAssembly(expression, mapJson);
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
    assertWasmToolsReadySync();
    return wasmTools().rewriteMessageTemplate(message, JSON.stringify(rewrites));
}

/** Print a FEL expression AST back to normalized source. */
export function wasmPrintFEL(expression: string): string {
    assertWasmToolsReadySync();
    return wasmTools().printFEL(expression);
}

/** Return the builtin FEL function catalog exported by the Rust runtime. */
export function wasmListBuiltinFunctions(): Array<{
    name: string;
    category: string;
    signature: string;
    description: string;
}> {
    assertWasmToolsReadySync();
    const resultJson = wasmTools().listBuiltinFunctions();
    return JSON.parse(resultJson);
}

/** Lint a Formspec document with explicit registry documents. */
export function wasmLintDocumentWithRegistries(
    doc: unknown,
    registries: unknown[],
): { documentType: string | null; valid: boolean; diagnostics: any[] } {
    assertWasmToolsReadySync();
    const resultJson = wasmTools().lintDocumentWithRegistries(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().parseRegistry(JSON.stringify(registry));
    return JSON.parse(resultJson);
}

/** Find the highest-version registry entry matching a name and version constraint. */
export function wasmFindRegistryEntry(
    registry: unknown,
    name: string,
    versionConstraint = '',
): any | null {
    assertWasmToolsReadySync();
    const resultJson = wasmTools().findRegistryEntry(
        JSON.stringify(registry),
        name,
        versionConstraint,
    );
    return JSON.parse(resultJson);
}

/** Validate a lifecycle transition between two registry statuses. */
export function wasmValidateLifecycleTransition(from: string, to: string): boolean {
    assertWasmToolsReadySync();
    return wasmTools().validateLifecycleTransition(from, to);
}

/** Construct a well-known registry URL from a base URL. */
export function wasmWellKnownRegistryUrl(baseUrl: string): string {
    assertWasmToolsReadySync();
    return wasmTools().wellKnownRegistryUrl(baseUrl);
}

/** Generate a structured changelog between two definitions. */
export function wasmGenerateChangelog(
    oldDefinition: unknown,
    newDefinition: unknown,
    definitionUrl: string,
): any {
    assertWasmToolsReadySync();
    const resultJson = wasmTools().generateChangelog(
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
    assertWasmToolsReadySync();
    const resultJson = wasmTools().validateExtensionUsage(
        JSON.stringify(items),
        JSON.stringify(registryEntries),
    );
    return JSON.parse(resultJson);
}
