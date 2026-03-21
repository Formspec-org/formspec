/* tslint:disable */
/* eslint-disable */

/**
 * Analyze a FEL expression and return structural info.
 * Returns JSON: { valid, errors, references, variables, functions }
 */
export function analyzeFEL(expression: string): string;

/**
 * Assemble a definition by resolving $ref inclusions.
 * fragments_json is a JSON object mapping URI → fragment definition.
 * Returns JSON: { definition, warnings, errors }
 */
export function assembleDefinition(definition_json: string, fragments_json: string): string;

/**
 * Collect rewriteable targets from a FEL expression.
 */
export function collectFELRewriteTargets(expression: string): string;

/**
 * Detect the document type of a Formspec JSON document.
 * Returns the document type string or null.
 */
export function detectDocumentType(doc_json: string): any;

/**
 * Parse and evaluate a FEL expression with optional field values (JSON object).
 * Returns the result as a JSON string.
 */
export function evalFEL(expression: string, fields_json: string): string;

/**
 * Evaluate a FEL expression with full FormspecEnvironment context.
 * `context_json` is a JSON object: { fields, variables?, mipStates?, repeatContext? }
 */
export function evalFELWithContext(expression: string, context_json: string): string;

/**
 * Evaluate a Formspec definition against provided data (4-phase batch processor).
 * Returns JSON: { values, validations, nonRelevant, variables, required, readonly }
 */
export function evaluateDefinition(definition_json: string, data_json: string, context_json?: string | null): string;

/**
 * Execute a mapping transform (forward or reverse).
 * Returns JSON: { direction, output, rulesApplied, diagnostics }
 */
export function executeMapping(rules_json: string, source_json: string, direction: string): string;

/**
 * Execute a full mapping document (rules + defaults + autoMap).
 * Returns JSON: { direction, output, rulesApplied, diagnostics }
 */
export function executeMappingDoc(doc_json: string, source_json: string, direction: string): string;

/**
 * Extract full dependency info from a FEL expression.
 * Returns a JSON object with dependency details.
 */
export function extractDependencies(expression: string): string;

/**
 * Find the highest-version registry entry matching name + version constraint.
 * Returns entry JSON or "null" if not found.
 */
export function findRegistryEntry(registry_json: string, name: string, version_constraint: string): string;

/**
 * Diff two Formspec definition versions and produce a structured changelog.
 * Returns JSON with camelCase keys.
 */
export function generateChangelog(old_def_json: string, new_def_json: string, definition_url: string): string;

/**
 * Extract field dependencies from a FEL expression.
 * Returns a JSON array of field path strings.
 */
export function getFELDependencies(expression: string): string;

/**
 * Find an item in a JSON item tree by dotted path.
 */
export function itemAtPath(items_json: string, path: string): string;

/**
 * Resolve the index, item, and parent path for a dotted item-tree path.
 */
export function itemLocationAtPath(items_json: string, path: string): string;

/**
 * Convert a JSON Pointer string into a JSONPath string.
 */
export function jsonPointerToJsonPath(pointer: string): string;

/**
 * Lint a Formspec document (7-pass static analysis).
 * Returns JSON: { documentType, valid, diagnostics: [...] }
 */
export function lintDocument(doc_json: string): string;

/**
 * Lint with registry documents for extension resolution.
 * registries_json is a JSON array of registry documents.
 */
export function lintDocumentWithRegistries(doc_json: string, registries_json: string): string;

/**
 * Return builtin FEL function metadata for tooling/autocomplete surfaces.
 */
export function listBuiltinFunctions(): string;

/**
 * Normalize a dotted path by stripping repeat indices.
 */
export function normalizeIndexedPath(path: string): string;

/**
 * Parse a FEL expression and return whether it's valid.
 */
export function parseFEL(expression: string): boolean;

/**
 * Parse a registry JSON document, validate it, return summary JSON.
 * Returns: { publisher, published, entryCount, validationIssues }
 */
export function parseRegistry(registry_json: string): string;

/**
 * Plan schema validation execution for a document.
 *
 * Returns JSON:
 * - `{ documentType: null, mode: "unknown", error }` for unknown documents
 * - `{ documentType, mode: "document" }` for non-component docs
 * - `{ documentType: "component", mode: "component", componentTargets: [...] }`
 */
export function planSchemaValidation(doc_json: string, document_type_override?: string | null): string;

/**
 * Print a FEL expression AST back to normalized source string.
 * Useful for round-tripping after AST transformations.
 */
export function printFEL(expression: string): string;

/**
 * Rewrite a FEL expression using explicit rewrite maps.
 */
export function rewriteFELReferences(expression: string, rewrites_json: string): string;

/**
 * Rewrite FEL expressions embedded in {{...}} interpolation segments.
 */
export function rewriteMessageTemplate(message: string, rewrites_json: string): string;

export function tokenizeFEL(expression: string): string;

/**
 * Validate enabled x-extension usage in an item tree against a registry entry lookup map.
 */
export function validateExtensionUsage(items_json: string, registry_entries_json: string): string;

/**
 * Check whether a lifecycle transition is valid per the registry spec.
 */
export function validateLifecycleTransition(from: string, to: string): boolean;

/**
 * Construct the well-known registry URL for a base URL.
 */
export function wellKnownRegistryUrl(base_url: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly evalFEL: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly evalFELWithContext: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly parseFEL: (a: number, b: number) => number;
    readonly tokenizeFEL: (a: number, b: number, c: number) => void;
    readonly printFEL: (a: number, b: number, c: number) => void;
    readonly getFELDependencies: (a: number, b: number, c: number) => void;
    readonly extractDependencies: (a: number, b: number, c: number) => void;
    readonly analyzeFEL: (a: number, b: number, c: number) => void;
    readonly collectFELRewriteTargets: (a: number, b: number, c: number) => void;
    readonly rewriteFELReferences: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly rewriteMessageTemplate: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly listBuiltinFunctions: (a: number) => void;
    readonly normalizeIndexedPath: (a: number, b: number, c: number) => void;
    readonly itemAtPath: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly itemLocationAtPath: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly detectDocumentType: (a: number, b: number, c: number) => void;
    readonly jsonPointerToJsonPath: (a: number, b: number, c: number) => void;
    readonly planSchemaValidation: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly lintDocument: (a: number, b: number, c: number) => void;
    readonly lintDocumentWithRegistries: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly evaluateDefinition: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly assembleDefinition: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly executeMapping: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly parseRegistry: (a: number, b: number, c: number) => void;
    readonly findRegistryEntry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly validateLifecycleTransition: (a: number, b: number, c: number, d: number) => number;
    readonly wellKnownRegistryUrl: (a: number, b: number, c: number) => void;
    readonly validateExtensionUsage: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly generateChangelog: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly executeMappingDoc: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
