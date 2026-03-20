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
