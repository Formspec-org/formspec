/** @filedesc FEL tooling, registry helpers, path utilities, and schema validation facade (WASM-backed). */

import type {
    DocumentType,
    ExtensionUsageIssue,
    FELAnalysis,
    FELBuiltinFunctionCatalogEntry,
    FELRewriteOptions,
    RegistryEntry,
    RewriteMap,
    SchemaValidationError,
    SchemaValidationResult,
    SchemaValidator,
    SchemaValidatorSchemas,
} from '../interfaces.js';
import {
    wasmAnalyzeFEL,
    wasmCollectFELRewriteTargets,
    wasmEvaluateDefinition,
    wasmFindRegistryEntry,
    wasmGenerateChangelog,
    wasmGetFELDependencies,
    wasmItemAtPath,
    wasmLintDocument,
    wasmListBuiltinFunctions,
    wasmNormalizeIndexedPath,
    wasmParseRegistry,
    wasmPrintFEL,
    wasmRewriteFelForAssembly,
    wasmRewriteFELReferences,
    wasmRewriteMessageTemplate,
    wasmTokenizeFEL,
    wasmValidateExtensionUsage,
    wasmValidateLifecycleTransition,
    wasmWellKnownRegistryUrl,
} from '../wasm-bridge.js';

export const normalizeIndexedPath = wasmNormalizeIndexedPath;
export const itemAtPath = wasmItemAtPath;
export const tokenizeFEL = wasmTokenizeFEL;
export function analyzeFEL(expression: string): FELAnalysis {
    const raw = wasmAnalyzeFEL(expression);
    return {
        ...raw,
        errors: raw.errors.map((e: string | { message: string; line?: number; column?: number; offset?: number }) =>
            typeof e === 'string' ? { message: e, line: 1, column: 1, offset: 0 } : e,
        ),
    };
}

/** Basic tree item shape used by path traversal helpers. */
export interface TreeItemLike<T extends TreeItemLike<T> = any> {
    key: string;
    children?: T[];
}

/** Resolved mutable location of an item in a tree. */
export interface ItemLocation<T extends TreeItemLike<T>> {
    parent: T[];
    index: number;
    item: T;
}

/** Remove repeat indices/wildcards from a path segment. */
export function normalizePathSegment(segment: string): string {
    return segment.replace(/\[(?:\d+|\*)\]/g, '');
}

/** Split a dotted path into normalized (index-free) segments. */
export function splitNormalizedPath(path: string): string[] {
    if (!path) return [];
    return wasmNormalizeIndexedPath(path).split('.').filter(Boolean);
}

/** Find the mutable parent/index/item triple for a dotted tree path. */
export function itemLocationAtPath<T extends TreeItemLike<T>>(items: T[], path: string): ItemLocation<T> | undefined {
    const parts = splitNormalizedPath(path);
    if (parts.length === 0) return undefined;
    let currentItems = items;
    for (let i = 0; i < parts.length - 1; i++) {
        const found = currentItems.find(item => item.key === parts[i]);
        if (!found?.children) return undefined;
        currentItems = found.children;
    }
    const index = currentItems.findIndex(item => item.key === parts[parts.length - 1]);
    if (index < 0) return undefined;
    return { parent: currentItems, index, item: currentItems[index] };
}

function mapRewriteEntries(
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

function mapRewriteNavigationTargets(
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

/** Rewrite FEL references using callback options (bridges to WASM rewrite). */
export function rewriteFELReferences(expression: string, options: FELRewriteOptions): string {
    const targets = wasmCollectFELRewriteTargets(expression);
    return wasmRewriteFELReferences(expression, {
        fieldPaths: mapRewriteEntries(targets.fieldPaths, options.rewriteFieldPath),
        currentPaths: mapRewriteEntries(targets.currentPaths, options.rewriteCurrentPath),
        variables: mapRewriteEntries(targets.variables, options.rewriteVariable),
        instanceNames: mapRewriteEntries(targets.instanceNames, options.rewriteInstanceName),
        navigationTargets: mapRewriteNavigationTargets(targets.navigationTargets, options.rewriteNavigationTarget),
    });
}
export const rewriteMessageTemplate = wasmRewriteMessageTemplate;
export const lintDocument = wasmLintDocument;
export const parseRegistry = wasmParseRegistry;
export const findRegistryEntry = wasmFindRegistryEntry;
export const validateLifecycleTransition = wasmValidateLifecycleTransition;
export const wellKnownRegistryUrl = wasmWellKnownRegistryUrl;
export const generateChangelog = wasmGenerateChangelog;
export const printFEL = wasmPrintFEL;
export const evaluateDefinition = wasmEvaluateDefinition;

export function getBuiltinFELFunctionCatalog(): FELBuiltinFunctionCatalogEntry[] {
    return wasmListBuiltinFunctions();
}

export function getFELDependencies(expression: string): string[] {
    return wasmGetFELDependencies(expression);
}

export function validateExtensionUsage(
    items: unknown[],
    options: { resolveEntry: (name: string) => RegistryEntry | undefined },
): ExtensionUsageIssue[] {
    const names = new Set<string>();
    collectExtensionNames(items, names);
    const registryEntries: Record<string, RegistryEntry> = {};
    for (const name of names) {
        const entry = options.resolveEntry(name);
        if (entry) {
            registryEntries[name] = entry;
        }
    }
    return wasmValidateExtensionUsage(items, registryEntries) as ExtensionUsageIssue[];
}

export function createSchemaValidator(_schemas?: SchemaValidatorSchemas): SchemaValidator {
    return {
        validate(document: unknown, documentType?: DocumentType | null): SchemaValidationResult {
            const result = lintDocument(document);
            return {
                documentType: (documentType ?? result.documentType ?? null) as DocumentType | null,
                errors: (result.diagnostics ?? [])
                    .filter((diag: any) => diag?.severity === 'error')
                    .map(
                        (diag: any): SchemaValidationError => ({
                            path: typeof diag.path === 'string' ? diag.path : '$',
                            message: typeof diag.message === 'string' ? diag.message : 'Schema validation failed',
                            raw: diag,
                        }),
                    ),
            };
        },
    };
}

export function rewriteFEL(expression: string, map: RewriteMap): string {
    return wasmRewriteFelForAssembly(
        expression,
        JSON.stringify({
            fragmentRootKey: map.fragmentRootKey,
            hostGroupKey: map.hostGroupKey,
            importedKeys: [...map.importedKeys],
            keyPrefix: map.keyPrefix,
        }),
    );
}

function collectExtensionNames(items: unknown[], names: Set<string>): void {
    for (const item of items as Array<Record<string, any>>) {
        for (const [name, enabled] of Object.entries(item?.extensions ?? {})) {
            if (enabled !== false) {
                names.add(name);
            }
        }
        if (Array.isArray(item?.children)) {
            collectExtensionNames(item.children, names);
        }
    }
}
