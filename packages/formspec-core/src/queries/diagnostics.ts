/**
 * Pure query function for multi-pass project diagnostics.
 */
import type { FormItem } from 'formspec-types';
import {
  analyzeFEL,
  normalizeIndexedPath,
  validateExtensionUsage,
  type DocumentType,
  type SchemaValidator,
} from 'formspec-engine';
import { getCurrentComponentDocument } from '../component-documents.js';
import { allExpressions } from './expression-index.js';
import { flattenItems } from './versioning.js';
import type { ProjectState, Diagnostic, Diagnostics } from '../types.js';

/**
 * On-demand multi-pass validation of the current project state.
 */
export function diagnose(state: ProjectState, schemaValidator?: SchemaValidator): Diagnostics {
  const log = (msg: string) => {
    if (typeof process !== 'undefined' && process.env?.DIAGNOSE_DEBUG) process.stderr.write(`[diagnose] ${msg}\n`);
  };
  log('start');
  const structural: Diagnostic[] = [];
  const expressions: Diagnostic[] = [];
  const extensions: Diagnostic[] = [];
  const consistency: Diagnostic[] = [];

  // Structural: JSON Schema validation when a validator was provided
  if (schemaValidator) {
    log('structural...');
    const artifacts: Array<{ artifact: Diagnostic['artifact']; doc: unknown; type: DocumentType }> = [
      { artifact: 'definition', doc: state.definition, type: 'definition' },
      { artifact: 'component', doc: getCurrentComponentDocument(state), type: 'component' },
      { artifact: 'theme', doc: state.theme, type: 'theme' },
      { artifact: 'mapping', doc: state.mapping, type: 'mapping' },
    ];
    for (const { artifact, doc, type } of artifacts) {
      if (doc == null || (typeof doc === 'object' && Object.keys(doc).length === 0)) continue;
      const result = schemaValidator.validate(doc, type);
      if (result.documentType === null && result.errors.length > 0) {
        structural.push({
          artifact,
          path: '$',
          severity: 'error',
          code: 'E100',
          message: result.errors[0].message,
        });
      } else {
        for (const e of result.errors) {
          structural.push({
            artifact,
            path: e.path.startsWith('$.') ? e.path.slice(2) : e.path === '$' ? '$' : e.path,
            severity: 'error',
            code: 'E101',
            message: e.message,
          });
        }
      }
    }
    log('structural done');
  }

  // Expression diagnostics
  log('allExpressions...');
  const exprs = allExpressions(state);
  log(`allExpressions done (${exprs.length} exprs)`);
  for (const expr of exprs) {
    const analysis = analyzeFEL(expr.expression);
    if (analysis.valid) continue;
    for (const error of analysis.errors) {
      expressions.push({
        artifact: expr.artifact,
        path: expr.location,
        severity: 'error',
        code: 'FEL_PARSE_ERROR',
        message: error.message,
      });
    }
  }
  log('expressions pass done');

  // Extension diagnostics
  log('extensions...');
  const extensionLookup = new Map<string, Record<string, unknown>>();
  for (const registry of state.extensions.registries) {
    for (const [name, entry] of Object.entries(registry.entries)) {
      if (!extensionLookup.has(name)) {
        extensionLookup.set(name, entry as Record<string, unknown>);
      }
    }
  }
  for (const issue of validateExtensionUsage(state.definition.items, {
    resolveEntry: (name) => extensionLookup.get(name) as any,
  })) {
    extensions.push({
      artifact: 'definition',
      path: issue.path,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
    });
  }
  log('extensions done');

  log('flattenItems...');
  const itemRows = flattenItems(state.definition.items);
  log(`flattenItems done (${itemRows.length} rows)`);
  const itemKeySet = new Set(itemRows.map((row) => row.key));
  const itemPathSet = new Set(itemRows.map((row) => row.path));
  const fieldRows = itemRows.filter((row) => row.item.type === 'field');
  const fieldPathSet = new Set(fieldRows.map((row) => row.path));
  const normalizedItemPaths = new Set(itemRows.map((row) => normalizeIndexedPath(row.path)));

  // Consistency: orphan or mis-bound component nodes
  const itemTypeByKey = new Map(itemRows.map((row) => [row.key, row.item.type] as const));
  const itemTypeByPath = new Map(itemRows.map((row) => [row.path, row.item.type] as const));
  const GROUP_AWARE_COMPONENTS = new Set([
    'Stack', 'Grid', 'Columns', 'Panel', 'Collapsible',
    'DataTable', 'Accordion', 'Tabs',
  ]);
  log('component tree...');
  const tree = getCurrentComponentDocument(state).tree as any;
  if (tree) {
    const visited = new WeakSet<object>();
    const queue: unknown[] = [tree];
    let componentNodes = 0;
    while (queue.length > 0) {
      componentNodes++;
      if (componentNodes % 500 === 0) log(`component tree node ${componentNodes}`);
      const raw = queue.shift();
      if (!raw || typeof raw !== 'object') continue;
      if (visited.has(raw)) continue;
      visited.add(raw);
      const node = raw as { bind?: string; component?: string; children?: unknown[] };
      if (node.bind) {
        const bindExists = itemKeySet.has(node.bind) || itemPathSet.has(node.bind);
        if (!bindExists) {
          consistency.push({
            artifact: 'component',
            path: node.bind,
            severity: 'warning',
            code: 'ORPHAN_COMPONENT_BIND',
            message: `Component node bound to "${node.bind}" but no such item exists in the definition`,
          });
        } else {
          const itemType = itemTypeByKey.get(node.bind) ?? itemTypeByPath.get(node.bind);
          if (itemType === 'group' && !GROUP_AWARE_COMPONENTS.has(node.component ?? '')) {
            consistency.push({
              artifact: 'component',
              path: node.bind,
              severity: 'warning',
              code: 'DISPLAY_ITEM_BIND',
              message: `Component "${node.component}" is bound to "${node.bind}" which is a group item, not a field — no value to display`,
            });
          }
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child && typeof child === 'object' && !visited.has(child as object)) queue.push(child);
        }
      }
    }
    log(`component tree done (${componentNodes} nodes)`);
  }

  // Consistency: stale mapping rule source paths
  log('consistency mapping/theme...');
  const rules = (state.mapping as any).rules as any[] | undefined;
  if (rules) {
    for (let i = 0; i < rules.length; i++) {
      const sp = rules[i].sourcePath;
      const isKnownPath = (p: string): boolean => {
        const norm = normalizeIndexedPath(p);
        if (normalizedItemPaths.has(norm)) return true;
        const dot = norm.lastIndexOf('.');
        return dot > 0 && normalizedItemPaths.has(norm.slice(0, dot));
      };
      if (typeof sp === 'string' && !isKnownPath(sp)) {
        consistency.push({
          artifact: 'mapping',
          path: `rules[${i}].sourcePath`,
          severity: 'warning',
          code: 'STALE_MAPPING_SOURCE',
          message: `Mapping rule source path "${sp}" does not match any field in the definition`,
        });
      }
    }
  }

  // Consistency: theme selector matches and stale item/page references
  const selectors = (state.theme as any).selectors as any[] | undefined;
  if (Array.isArray(selectors)) {
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const match = selector?.match;
      if (!match || typeof match !== 'object') continue;
      const hasMatch = itemRows.some((row) => {
        const asAny = row.item as any;
        if (typeof match.type === 'string' && row.item.type !== match.type) return false;
        if (typeof match.dataType === 'string' && asAny.dataType !== match.dataType) return false;
        return true;
      });
      if (!hasMatch) {
        consistency.push({
          artifact: 'theme',
          path: `selectors[${i}]`,
          severity: 'warning',
          code: 'UNMATCHED_THEME_SELECTOR',
          message: 'Theme selector does not match any current definition item',
        });
      }
    }
  }

  const themeItems = (state.theme as any).items as Record<string, unknown> | undefined;
  if (themeItems) {
    for (const key of Object.keys(themeItems)) {
      if (!itemKeySet.has(key) && !fieldPathSet.has(key)) {
        consistency.push({
          artifact: 'theme',
          path: `items.${key}`,
          severity: 'warning',
          code: 'STALE_THEME_ITEM_OVERRIDE',
          message: `Theme item override "${key}" does not match any item key in the definition`,
        });
      }
    }
  }

  const pages = (state.theme as any).pages as any[] | undefined;
  if (Array.isArray(pages)) {
    for (let i = 0; i < pages.length; i++) {
      const regions = pages[i]?.regions;
      if (!Array.isArray(regions)) continue;
      for (let j = 0; j < regions.length; j++) {
        const key = regions[j]?.key;
        if (typeof key !== 'string') continue;
        if (itemKeySet.has(key) || fieldPathSet.has(key)) continue;
        consistency.push({
          artifact: 'theme',
          path: `pages[${i}].regions[${j}].key`,
          severity: 'warning',
          code: 'STALE_THEME_REGION_KEY',
          message: `Theme page region key "${key}" does not match any item key in the definition`,
        });
      }
    }
  }

  // Consistency: root-level non-group items in paged definitions
  const defPageMode = (state.definition as any).formPresentation?.pageMode;
  if (defPageMode === 'wizard' || defPageMode === 'tabs') {
    for (const item of state.definition.items) {
      if (item.type !== 'group') {
        consistency.push({
          artifact: 'definition',
          path: item.key,
          severity: 'warning',
          code: 'PAGED_ROOT_NON_GROUP',
          message: `Root-level ${item.type} "${item.key}" is not inside a page group — it will be hidden in ${defPageMode} mode`,
        });
      }
    }
  }

  log('consistency done');
  // Aggregate counts
  const all = [...structural, ...expressions, ...extensions, ...consistency];
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of all) {
    counts[d.severity]++;
  }

  log('done');
  return { structural, expressions, extensions, consistency, counts };
}
