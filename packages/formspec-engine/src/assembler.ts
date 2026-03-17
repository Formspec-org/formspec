/** @filedesc Resolves $ref inclusions to produce a self-contained, assembled definition. */
import type { FormspecDefinition, FormspecItem, FormspecBind, FormspecShape, FormspecVariable } from './index.js';
import { rewriteFELReferences } from './fel/analysis.js';

/** Provenance record for a single `$ref` inclusion resolved during definition assembly, tracking origin URL, version, prefix, and fragment. */
export interface AssemblyProvenance {
    url: string;
    version: string;
    keyPrefix?: string;
    fragment?: string;
}

/**
 * A function that resolves a `(url, version?)` pair to a {@link FormspecDefinition}.
 * Implementations may resolve from an in-memory registry, local filesystem, or network fetch.
 * May return synchronously or asynchronously.
 */
export type DefinitionResolver = (url: string, version?: string) => FormspecDefinition | Promise<FormspecDefinition>;

/** The output of definition assembly: a self-contained definition with all `$ref` inclusions inlined, plus provenance records. */
export interface AssemblyResult {
    definition: FormspecDefinition;
    assembledFrom: AssemblyProvenance[];
}

/**
 * Lookup structure for FEL path rewriting during assembly.
 * Built once per `$ref` resolution from the imported fragment.
 */
export interface RewriteMap {
    /** The top-level key of the selected fragment item (e.g. "budget"). Empty string when no fragment. */
    fragmentRootKey: string;
    /** The host group's key that replaces the fragment root in path references (e.g. "projectBudget"). */
    hostGroupKey: string;
    /** All item keys (recursively collected) in the imported fragment subtree, used for prefix matching. */
    importedKeys: Set<string>;
    /** The key prefix applied to imported item keys (e.g. "proj_"). */
    keyPrefix: string;
}

/**
 * Parses a $ref URI into its component parts.
 * Format: "url|version#fragment" where |version and #fragment are optional.
 */
function parseRef(ref: string): { url: string; version?: string; fragment?: string } {
    let url = ref;
    let version: string | undefined;
    let fragment: string | undefined;

    const hashIdx = url.indexOf('#');
    if (hashIdx !== -1) {
        fragment = url.substring(hashIdx + 1);
        url = url.substring(0, hashIdx);
    }

    const pipeIdx = url.indexOf('|');
    if (pipeIdx !== -1) {
        version = url.substring(pipeIdx + 1);
        url = url.substring(0, pipeIdx);
    }

    return { url, version, fragment };
}

// ---------------------------------------------------------------------------
// FEL path rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrites `$`-prefixed path references in a FEL expression according to a {@link RewriteMap}.
 *
 * Three kinds of references are handled:
 * 1. `$path` references — `$budget.lineItems[*].amount` → `$projectBudget.proj_lineItems[*].proj_amount`
 * 2. `@current.path` references — `@current.amount` → `@current.proj_amount`
 * 3. `prev('name')`, `next('name')`, `parent('name')` — string literal field names are prefixed
 *
 * Bare `$` (current-node), `@index`, `@count`, `@instance('...')`, `@varName`,
 * literal values, and paths outside the imported fragment are left untouched.
 */
export function rewriteFEL(expression: string, map: RewriteMap): string {
    return rewriteFELReferences(expression, {
        rewriteFieldPath(path) {
            return rewriteDollarPath(path, map);
        },
        rewriteCurrentPath(path) {
            return rewriteCurrentSegments(path, map);
        },
        rewriteNavigationTarget(fieldName) {
            if (!map.importedKeys.has(fieldName)) return fieldName;
            return `${map.keyPrefix}${fieldName}`;
        }
    });
}

/** Rewrites segments of a `$`-prefixed path. Fragment root → hostGroupKey; imported keys → prefixed. */
function rewriteDollarPath(pathStr: string, map: RewriteMap): string {
    const segments = pathStr.split('.');
    let changed = false;
    const result = segments.map((seg, index) => {
        const bracketIdx = seg.indexOf('[');
        const baseName = bracketIdx !== -1 ? seg.substring(0, bracketIdx) : seg;
        const suffix = bracketIdx !== -1 ? seg.substring(bracketIdx) : '';

        if (index === 0 && baseName === map.fragmentRootKey && map.fragmentRootKey !== '') {
            changed = true;
            return map.hostGroupKey + suffix;
        }
        if (map.importedKeys.has(baseName)) {
            changed = true;
            return map.keyPrefix + baseName + suffix;
        }
        return seg;
    });
    return changed ? result.join('.') : pathStr;
}

/** Rewrites segments after `@current.` — only applies keyPrefix to imported keys. */
function rewriteCurrentSegments(pathStr: string, map: RewriteMap): string {
    const segments = pathStr.split('.');
    let changed = false;
    const result = segments.map(seg => {
        const bracketIdx = seg.indexOf('[');
        const baseName = bracketIdx !== -1 ? seg.substring(0, bracketIdx) : seg;
        const suffix = bracketIdx !== -1 ? seg.substring(bracketIdx) : '';

        if (map.importedKeys.has(baseName)) {
            changed = true;
            return map.keyPrefix + baseName + suffix;
        }
        return seg;
    });
    return changed ? result.join('.') : pathStr;
}

/**
 * Rewrites FEL expressions inside `{{...}}` interpolation sequences in a message string.
 * Literal text outside `{{...}}` is preserved.
 */
export function rewriteMessageTemplate(message: string, map: RewriteMap): string {
    return message.replace(/\{\{(.*?)\}\}/g, (_full, expr: string) => {
        return '{{' + rewriteFEL(expr, map) + '}}';
    });
}

// ---------------------------------------------------------------------------
// Bind / Shape / Variable FEL rewriting helpers
// ---------------------------------------------------------------------------

const FEL_BIND_PROPERTIES = ['calculate', 'constraint', 'relevant', 'readonly', 'required'] as const;

/** Rewrites all FEL-bearing properties of an imported bind. */
function rewriteBindFEL(bind: FormspecBind, map: RewriteMap): FormspecBind {
    const newBind = { ...bind };
    for (const prop of FEL_BIND_PROPERTIES) {
        const val = newBind[prop];
        if (typeof val === 'string') {
            newBind[prop] = rewriteFEL(val, map);
        }
    }
    // default: when string starting with '=', the rest is a FEL expression
    const defaultVal = newBind.default;
    if (typeof defaultVal === 'string' && defaultVal.startsWith('=')) {
        newBind.default = '=' + rewriteFEL(defaultVal.substring(1), map);
    }
    return newBind;
}

/** Rewrites all FEL-bearing properties of an imported shape. */
function rewriteShapeFEL(
    shape: FormspecShape,
    map: RewriteMap,
    shapeIdRenameMap: Map<string, string>,
    importedShapeIds: Set<string>
): FormspecShape {
    const s = { ...shape };

    if (typeof s.constraint === 'string') {
        s.constraint = rewriteFEL(s.constraint, map);
    }
    if (typeof s.activeWhen === 'string') {
        s.activeWhen = rewriteFEL(s.activeWhen, map);
    }

    // context: each value is a FEL expression
    if (s.context) {
        const newCtx: Record<string, string> = {};
        for (const [key, value] of Object.entries(s.context)) {
            newCtx[key] = rewriteFEL(value, map);
        }
        s.context = newCtx;
    }

    // message: FEL inside {{...}} interpolation
    if (typeof s.message === 'string') {
        s.message = rewriteMessageTemplate(s.message, map);
    }

    // Composition operators: and[], or[], xone[]
    for (const op of ['and', 'or', 'xone'] as const) {
        const arr = s[op];
        if (Array.isArray(arr)) {
            s[op] = arr.map(entry =>
                rewriteCompositionEntry(entry, map, shapeIdRenameMap, importedShapeIds)
            );
        }
    }
    // not (single string)
    if (typeof s.not === 'string') {
        s.not = rewriteCompositionEntry(s.not, map, shapeIdRenameMap, importedShapeIds);
    }

    return s;
}

/**
 * Rewrites a single composition entry: if it's a known shape ID, apply rename map;
 * otherwise treat as FEL expression and rewrite paths.
 */
function rewriteCompositionEntry(
    entry: string,
    map: RewriteMap,
    shapeIdRenameMap: Map<string, string>,
    importedShapeIds: Set<string>
): string {
    if (importedShapeIds.has(entry)) {
        return shapeIdRenameMap.get(entry) || entry;
    }
    return rewriteFEL(entry, map);
}

/** Imports variables from a referenced definition into the host, rewriting expressions and scopes. */
function importVariables(
    referencedDef: FormspecDefinition,
    fragment: string | undefined,
    importedKeys: Set<string>,
    map: RewriteMap,
    host: FormspecDefinition
): void {
    if (!referencedDef.variables?.length) return;

    // Filter variables for fragment scope
    const varsToImport = fragment
        ? referencedDef.variables.filter(v => {
            if (!v.scope || v.scope === '#') return true;
            return importedKeys.has(v.scope);
        })
        : [...referencedDef.variables];

    if (!varsToImport.length) return;

    // Check for name collisions
    const existingNames = new Set((host.variables || []).map(v => v.name));
    for (const v of varsToImport) {
        if (existingNames.has(v.name)) {
            throw new Error(`Variable name collision during assembly: "${v.name}" already exists in host definition`);
        }
    }

    // Rewrite and import
    if (!host.variables) host.variables = [];
    for (const v of varsToImport) {
        const newVar: FormspecVariable = { ...v };
        // Rewrite expression (FEL)
        newVar.expression = rewriteFEL(v.expression, map);
        // Rewrite scope (item key, not FEL)
        if (newVar.scope && newVar.scope !== '#') {
            if (newVar.scope === map.fragmentRootKey) {
                newVar.scope = map.hostGroupKey;
            } else if (map.importedKeys.has(newVar.scope)) {
                newVar.scope = map.keyPrefix + newVar.scope;
            }
        }
        host.variables.push(newVar);
    }
}

/**
 * Recursively prefixes all item keys with the given prefix.
 */
function prefixItems(items: FormspecItem[], prefix: string): FormspecItem[] {
    return items.map(item => {
        const newItem = { ...item, key: prefix + item.key };
        if (newItem.children) {
            newItem.children = prefixItems(newItem.children, prefix);
        }
        return newItem;
    });
}

/**
 * Collects all keys from an item tree (recursively).
 */
function collectKeys(items: FormspecItem[], parentPath = ''): string[] {
    const keys: string[] = [];
    for (const item of items) {
        const fullPath = parentPath ? `${parentPath}.${item.key}` : item.key;
        keys.push(fullPath);
        if (item.children) {
            keys.push(...collectKeys(item.children, fullPath));
        }
    }
    return keys;
}

/**
 * Rewrites a dotted path by prefixing the first segment (or all segments that
 * match imported keys) with the keyPrefix.
 *
 * For bind paths like "fieldA" → "pfx_fieldA"
 * For bind paths like "groupA.fieldB" → "pfx_groupA.pfx_fieldB"
 *
 * The approach: prefix every segment that was an original key in the imported definition.
 */
function prefixPath(path: string, prefix: string, importedRootKeys: Set<string>): string {
    if (!prefix) return path;

    // Handle wildcard paths like "items[*].field"
    const segments = path.split('.');
    return segments.map(seg => {
        // Extract the base name (strip [*] or [0] suffixes)
        const bracketIdx = seg.indexOf('[');
        const baseName = bracketIdx !== -1 ? seg.substring(0, bracketIdx) : seg;
        const suffix = bracketIdx !== -1 ? seg.substring(bracketIdx) : '';

        if (importedRootKeys.has(baseName)) {
            return prefix + baseName + suffix;
        }
        return seg;
    }).join('.');
}

/**
 * Rewrites bind paths with the given prefix.
 */
function prefixBinds(binds: FormspecBind[], prefix: string, importedKeys: Set<string>, hostPath: string): FormspecBind[] {
    return binds.map(bind => {
        const newBind = { ...bind };
        newBind.path = hostPath ? `${hostPath}.${prefixPath(bind.path, prefix, importedKeys)}` : prefixPath(bind.path, prefix, importedKeys);
        return newBind;
    });
}

/**
 * Rewrites shape targets with the given prefix.
 */
function prefixShapes(shapes: FormspecShape[], prefix: string, importedKeys: Set<string>, hostPath: string): FormspecShape[] {
    return shapes.map(shape => {
        const newShape = { ...shape };
        if (shape.target !== '#') {
            newShape.target = hostPath ? `${hostPath}.${prefixPath(shape.target, prefix, importedKeys)}` : prefixPath(shape.target, prefix, importedKeys);
        }
        return newShape;
    });
}

/**
 * Assembles a {@link FormspecDefinition} by recursively resolving all `$ref` inclusions.
 * Produces a self-contained definition with no external references, suitable for runtime use.
 * Assembly is intended to run at publish time (when a definition transitions from "draft" to "active").
 * Detects circular references and key collisions, and rewrites bind/shape paths with keyPrefix when specified.
 * @param definition - The root definition containing `$ref` group items to resolve.
 * @param resolver - A function that fetches referenced definitions by URL and optional version.
 * @returns The assembled definition and provenance records for all resolved references.
 */
export async function assembleDefinition(
    definition: FormspecDefinition,
    resolver: DefinitionResolver
): Promise<AssemblyResult> {
    const assembledFrom: AssemblyProvenance[] = [];
    const visitedRefs = new Set<string>();

    const assembled = { ...definition };
    assembled.items = await resolveItems(
        definition.items,
        '',
        resolver,
        assembledFrom,
        visitedRefs,
        assembled
    );

    return { definition: assembled, assembledFrom };
}

/**
 * Synchronous variant of {@link assembleDefinition} for use when all referenced definitions
 * are available in-memory (e.g. during testing or pre-cached scenarios).
 * @param definition - The root definition containing `$ref` group items to resolve.
 * @param resolver - A synchronous function that returns referenced definitions.
 * @returns The assembled definition and provenance records.
 */
export function assembleDefinitionSync(
    definition: FormspecDefinition,
    resolver: (url: string, version?: string) => FormspecDefinition
): AssemblyResult {
    const assembledFrom: AssemblyProvenance[] = [];
    const visitedRefs = new Set<string>();

    const assembled = { ...definition };
    assembled.items = resolveItemsSync(
        definition.items,
        '',
        resolver,
        assembledFrom,
        visitedRefs,
        assembled
    );

    return { definition: assembled, assembledFrom };
}

/** Recursively walks the item tree, resolving any group items with `$ref` via the async resolver. */
async function resolveItems(
    items: FormspecItem[],
    parentPath: string,
    resolver: DefinitionResolver,
    assembledFrom: AssemblyProvenance[],
    visitedRefs: Set<string>,
    host: FormspecDefinition
): Promise<FormspecItem[]> {
    const result: FormspecItem[] = [];

    for (const item of items) {
        if (item.type === 'group' && item['$ref']) {
            const resolved = await resolveRef(item, parentPath, resolver, assembledFrom, visitedRefs, host);
            result.push(resolved);
        } else {
            const newItem = { ...item };
            if (newItem.children) {
                const fullPath = parentPath ? `${parentPath}.${item.key}` : item.key;
                newItem.children = await resolveItems(newItem.children, fullPath, resolver, assembledFrom, visitedRefs, host);
            }
            result.push(newItem);
        }
    }

    return result;
}

/** Synchronous variant of resolveItems for in-memory resolvers. */
function resolveItemsSync(
    items: FormspecItem[],
    parentPath: string,
    resolver: (url: string, version?: string) => FormspecDefinition,
    assembledFrom: AssemblyProvenance[],
    visitedRefs: Set<string>,
    host: FormspecDefinition
): FormspecItem[] {
    const result: FormspecItem[] = [];

    for (const item of items) {
        if (item.type === 'group' && item['$ref']) {
            const resolved = resolveRefSync(item, parentPath, resolver, assembledFrom, visitedRefs, host);
            result.push(resolved);
        } else {
            const newItem = { ...item };
            if (newItem.children) {
                const fullPath = parentPath ? `${parentPath}.${item.key}` : item.key;
                newItem.children = resolveItemsSync(newItem.children, fullPath, resolver, assembledFrom, visitedRefs, host);
            }
            result.push(newItem);
        }
    }

    return result;
}

/** Resolves a single `$ref` group item: fetches the referenced definition, assembles it into the host, and recurses. */
async function resolveRef(
    groupItem: FormspecItem,
    parentPath: string,
    resolver: DefinitionResolver,
    assembledFrom: AssemblyProvenance[],
    visitedRefs: Set<string>,
    host: FormspecDefinition
): Promise<FormspecItem> {
    const refUri = groupItem['$ref'] as string;
    const { url, version, fragment } = parseRef(refUri);
    const refKey = version ? `${url}|${version}` : url;

    if (visitedRefs.has(refKey)) {
        throw new Error(`Circular $ref detected: ${refKey}`);
    }
    visitedRefs.add(refKey);

    const referencedDef = await resolver(url, version);
    const result = performAssembly(groupItem, parentPath, referencedDef, url, version, fragment, assembledFrom, host);

    // Recursively resolve any $refs in the imported items
    const fullPath = parentPath ? `${parentPath}.${result.key}` : result.key;
    if (result.children) {
        result.children = await resolveItems(result.children, fullPath, resolver, assembledFrom, visitedRefs, host);
    }

    visitedRefs.delete(refKey);
    return result;
}

/** Synchronous variant of resolveRef for in-memory resolvers. */
function resolveRefSync(
    groupItem: FormspecItem,
    parentPath: string,
    resolver: (url: string, version?: string) => FormspecDefinition,
    assembledFrom: AssemblyProvenance[],
    visitedRefs: Set<string>,
    host: FormspecDefinition
): FormspecItem {
    const refUri = groupItem['$ref'] as string;
    const { url, version, fragment } = parseRef(refUri);
    const refKey = version ? `${url}|${version}` : url;

    if (visitedRefs.has(refKey)) {
        throw new Error(`Circular $ref detected: ${refKey}`);
    }
    visitedRefs.add(refKey);

    const referencedDef = resolver(url, version);
    const result = performAssembly(groupItem, parentPath, referencedDef, url, version, fragment, assembledFrom, host);

    // Recursively resolve any $refs in the imported items
    const fullPath = parentPath ? `${parentPath}.${result.key}` : result.key;
    if (result.children) {
        result.children = resolveItemsSync(result.children, fullPath, resolver, assembledFrom, visitedRefs, host);
    }

    visitedRefs.delete(refKey);
    return result;
}

/**
 * Core assembly logic: imports items from a referenced definition into a host group,
 * applying keyPrefix, rewriting bind/shape paths, detecting key collisions, and recording provenance.
 */
function performAssembly(
    groupItem: FormspecItem,
    parentPath: string,
    referencedDef: FormspecDefinition,
    url: string,
    version: string | undefined,
    fragment: string | undefined,
    assembledFrom: AssemblyProvenance[],
    host: FormspecDefinition
): FormspecItem {
    const keyPrefix = groupItem.keyPrefix;

    // Select items from referenced definition
    let importedItems: FormspecItem[];
    if (fragment) {
        const found = referencedDef.items.find(i => i.key === fragment);
        if (!found) {
            throw new Error(`Fragment key "${fragment}" not found in referenced definition ${url}`);
        }
        importedItems = [found];
    } else {
        importedItems = [...referencedDef.items];
    }

    // Apply keyPrefix to imported items
    if (keyPrefix) {
        importedItems = prefixItems(importedItems, keyPrefix);
    }

    // Collect the original root-level keys for path rewriting
    const originalRootKeys = new Set<string>();
    const sourceItems = fragment
        ? referencedDef.items.filter(i => i.key === fragment)
        : referencedDef.items;
    for (const item of sourceItems) {
        collectAllKeys(item, originalRootKeys);
    }

    // Build the full host path for this group
    const groupPath = parentPath ? `${parentPath}.${groupItem.key}` : groupItem.key;

    // Build RewriteMap for FEL expression rewriting
    const rewriteMap: RewriteMap = {
        fragmentRootKey: fragment || '',
        hostGroupKey: groupItem.key,
        importedKeys: originalRootKeys,
        keyPrefix: keyPrefix || ''
    };

    // Import and rewrite binds (paths + FEL expressions)
    if (referencedDef.binds) {
        let importedBinds = filterBindsForFragment(referencedDef.binds, fragment, originalRootKeys);
        importedBinds = prefixBinds(importedBinds, keyPrefix || '', originalRootKeys, groupPath);
        importedBinds = importedBinds.map(b => rewriteBindFEL(b, rewriteMap));
        if (!host.binds) host.binds = [];
        host.binds.push(...importedBinds);
    }

    // Import and rewrite shapes (paths + FEL expressions)
    const shapeIdRenameMap = new Map<string, string>();
    const importedShapeIds = new Set<string>();
    if (referencedDef.shapes) {
        let importedShapes = filterShapesForFragment(referencedDef.shapes, fragment, originalRootKeys);
        importedShapes = prefixShapes(importedShapes, keyPrefix || '', originalRootKeys, groupPath);

        // Collect original imported shape IDs before collision handling
        for (const shape of importedShapes) {
            importedShapeIds.add(shape.id);
        }

        // Handle shape ID collisions, tracking renames
        const existingShapeIds = new Set((host.shapes || []).map(s => s.id));
        for (const shape of importedShapes) {
            const originalId = shape.id;
            if (existingShapeIds.has(originalId)) {
                const newId = `${groupItem.key}_${originalId}`;
                shapeIdRenameMap.set(originalId, newId);
                shape.id = newId;
            }
        }

        // Rewrite FEL expressions in shapes
        importedShapes = importedShapes.map(s =>
            rewriteShapeFEL(s, rewriteMap, shapeIdRenameMap, importedShapeIds)
        );

        if (!host.shapes) host.shapes = [];
        host.shapes.push(...importedShapes);
    }

    // Import and rewrite variables
    importVariables(referencedDef, fragment, originalRootKeys, rewriteMap, host);

    // Check for key collisions with existing host items
    const hostKeys = new Set(collectKeys(host.items, ''));
    const importedKeys = collectKeys(importedItems, groupPath);
    for (const ik of importedKeys) {
        if (hostKeys.has(ik)) {
            throw new Error(`Key collision after assembly: "${ik}" already exists in host definition`);
        }
    }

    // Record provenance
    assembledFrom.push({
        url,
        version: version || referencedDef.version,
        keyPrefix,
        fragment
    });

    // Build the assembled group item (strip $ref and keyPrefix, add children)
    const assembled: FormspecItem = {
        key: groupItem.key,
        type: 'group',
        label: groupItem.label,
        children: importedItems
    };

    // Carry over other group properties
    if (groupItem.repeatable) assembled.repeatable = groupItem.repeatable;
    if (groupItem.minRepeat !== undefined) assembled.minRepeat = groupItem.minRepeat;
    if (groupItem.maxRepeat !== undefined) assembled.maxRepeat = groupItem.maxRepeat;
    if (groupItem.description) assembled.description = groupItem.description;
    if (groupItem.hint) assembled.hint = groupItem.hint;
    if (groupItem.presentation) assembled.presentation = groupItem.presentation;

    return assembled;
}

/** Recursively collects all item keys (including nested children) into a Set for path rewriting. */
function collectAllKeys(item: FormspecItem, keys: Set<string>) {
    keys.add(item.key);
    if (item.children) {
        for (const child of item.children) {
            collectAllKeys(child, keys);
        }
    }
}

/**
 * Filters binds that are relevant to a fragment selection.
 * When no fragment, all binds are included.
 */
function filterBindsForFragment(binds: FormspecBind[], fragment: string | undefined, keys: Set<string>): FormspecBind[] {
    if (!fragment) return [...binds];
    return binds.filter(b => {
        const firstSeg = b.path.split('.')[0].replace(/\[.*\]/, '');
        return keys.has(firstSeg);
    });
}

/**
 * Filters shapes that target keys within the fragment scope.
 */
function filterShapesForFragment(shapes: FormspecShape[], fragment: string | undefined, keys: Set<string>): FormspecShape[] {
    if (!fragment) return [...shapes];
    return shapes.filter(s => {
        if (s.target === '#') return true;
        const firstSeg = s.target.split('.')[0].replace(/\[.*\]/, '');
        return keys.has(firstSeg);
    });
}
