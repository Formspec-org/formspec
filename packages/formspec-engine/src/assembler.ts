import { FormspecDefinition, FormspecItem, FormspecBind, FormspecShape } from './index';

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
    const keyPrefix = (groupItem as any).keyPrefix as string | undefined;

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

    // Import and rewrite binds
    if (referencedDef.binds) {
        let importedBinds = filterBindsForFragment(referencedDef.binds, fragment, originalRootKeys);
        importedBinds = prefixBinds(importedBinds, keyPrefix || '', originalRootKeys, groupPath);
        if (!host.binds) host.binds = [];
        host.binds.push(...importedBinds);
    }

    // Import and rewrite shapes
    if (referencedDef.shapes) {
        let importedShapes = filterShapesForFragment(referencedDef.shapes, fragment, originalRootKeys);
        importedShapes = prefixShapes(importedShapes, keyPrefix || '', originalRootKeys, groupPath);
        // Ensure shape IDs don't collide
        const existingShapeIds = new Set((host.shapes || []).map(s => s.id));
        for (const shape of importedShapes) {
            if (existingShapeIds.has(shape.id)) {
                shape.id = `${groupItem.key}_${shape.id}`;
            }
        }
        if (!host.shapes) host.shapes = [];
        host.shapes.push(...importedShapes);
    }

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
