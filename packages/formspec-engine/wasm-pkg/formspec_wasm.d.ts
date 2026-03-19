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
 * Evaluate a Formspec definition against provided data (4-phase batch processor).
 * Returns JSON: { values, validations, nonRelevant, variables }
 */
export function evaluateDefinition(definition_json: string, data_json: string): string;

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
 * Print a FEL expression AST back to normalized source string.
 * Useful for round-tripping after AST transformations.
 */
export function printFEL(expression: string): string;

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
    readonly evalFEL: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly parseFEL: (a: number, b: number) => number;
    readonly printFEL: (a: number, b: number) => [number, number, number, number];
    readonly getFELDependencies: (a: number, b: number) => [number, number, number, number];
    readonly extractDependencies: (a: number, b: number) => [number, number, number, number];
    readonly analyzeFEL: (a: number, b: number) => [number, number, number, number];
    readonly normalizeIndexedPath: (a: number, b: number) => [number, number];
    readonly detectDocumentType: (a: number, b: number) => [number, number, number];
    readonly lintDocument: (a: number, b: number) => [number, number, number, number];
    readonly lintDocumentWithRegistries: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly evaluateDefinition: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly assembleDefinition: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly executeMapping: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly parseRegistry: (a: number, b: number) => [number, number, number, number];
    readonly findRegistryEntry: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly validateLifecycleTransition: (a: number, b: number, c: number, d: number) => number;
    readonly wellKnownRegistryUrl: (a: number, b: number) => [number, number];
    readonly generateChangelog: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly executeMappingDoc: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
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
