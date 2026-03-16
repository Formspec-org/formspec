/**
 * Pure query functions for FEL expression indexing, parsing, and reference resolution.
 */
import type { FormItem } from 'formspec-types';
import {
  analyzeFEL,
  getBuiltinFELFunctionCatalog,
  getFELDependencies,
  normalizeIndexedPath,
  type FELAnalysis,
} from 'formspec-engine';
import { getCurrentComponentDocument } from '../component-documents.js';
import { itemAt, fieldPaths as getFieldPaths } from './field-queries.js';
import type {
  ProjectState,
  Diagnostic,
  ExpressionLocation,
  FELParseContext,
  FELParseResult,
  FELReferenceSet,
  FELFunctionEntry,
} from '../types.js';

function analyzeExpression(expression: string): FELAnalysis {
  return analyzeFEL(expression);
}

function resolveParseContext(context?: string | FELParseContext): FELParseContext {
  if (!context) return {};
  if (typeof context === 'string') return { targetPath: context };
  return context;
}

/**
 * Parse and validate a FEL expression without saving it to project state.
 */
export function parseFEL(state: ProjectState, expression: string, context?: FELParseContext): FELParseResult {
  const analysis = analyzeExpression(expression);
  const parseErrors: Diagnostic[] = analysis.errors.map((error) => ({
    artifact: 'definition',
    path: 'expression',
    severity: 'error',
    code: 'FEL_PARSE_ERROR',
    message: error.message,
  }));

  const semanticErrors: Diagnostic[] = [];
  if (context !== undefined && analysis.valid) {
    const available = availableReferences(state, resolveParseContext(context));
    const knownFieldPaths = new Set(available.fields.map((field) => normalizeIndexedPath(field.path)));
    const knownVariables = new Set([
      ...available.variables.map((variable) => variable.name),
      ...available.contextRefs
        .filter((entry) => entry.startsWith('@'))
        .map((entry) => entry.slice(1)),
    ]);

    for (const reference of analysis.references) {
      if (!knownFieldPaths.has(normalizeIndexedPath(reference))) {
        semanticErrors.push({
          artifact: 'definition',
          path: 'expression',
          severity: 'error',
          code: 'FEL_UNKNOWN_REFERENCE',
          message: `Unknown field reference "$${reference}" in this editor context`,
        });
      }
    }

    for (const variable of analysis.variables) {
      if (!knownVariables.has(variable)) {
        semanticErrors.push({
          artifact: 'definition',
          path: 'expression',
          severity: 'error',
          code: 'FEL_UNKNOWN_VARIABLE',
          message: `Unknown variable reference "@${variable}" in this editor context`,
        });
      }
    }
  }

  return {
    valid: analysis.valid && semanticErrors.length === 0,
    errors: [...parseErrors, ...semanticErrors],
    references: analysis.references,
    functions: analysis.functions,
  };
}

/**
 * Enumerate the full FEL function catalog: built-in plus extension functions.
 */
export function felFunctionCatalog(state: ProjectState): FELFunctionEntry[] {
  const catalog: FELFunctionEntry[] = getBuiltinFELFunctionCatalog().map((entry) => ({
    name: entry.name,
    category: entry.category,
    source: 'builtin',
  }));
  const seen = new Set(catalog.map((entry) => entry.name));

  for (const reg of state.extensions.registries) {
    for (const entry of Object.values(reg.entries)) {
      const e = entry as any;
      if (e.category === 'function' && typeof e.name === 'string' && !seen.has(e.name)) {
        catalog.push({
          name: e.name,
          category: typeof e.functionCategory === 'string'
            ? e.functionCategory
            : (typeof e.group === 'string' ? e.group : 'function'),
          source: 'extension',
          registryUrl: reg.url,
        });
        seen.add(e.name);
      }
    }
  }

  return catalog;
}

/**
 * Scope-aware list of valid FEL references at a given path.
 */
export function availableReferences(state: ProjectState, context?: string | FELParseContext): FELReferenceSet {
  const resolved = resolveParseContext(context);
  const contextPath = resolved.targetPath;
  const fields: FELReferenceSet['fields'] = [];
  const walk = (items: FormItem[], prefix: string) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.type === 'field') {
        fields.push({ path, dataType: (item as any).dataType ?? 'string', label: item.label });
      }
      if (item.children) walk(item.children, path);
    }
  };
  walk(state.definition.items, '');

  const variables = (state.definition.variables ?? []).map((v: any) => ({
    name: v.name,
    expression: v.expression ?? '',
  }));

  const instances: FELReferenceSet['instances'] = [];
  const inst = state.definition.instances;
  if (inst) {
    for (const [name, entry] of Object.entries(inst)) {
      instances.push({ name, source: (entry as any).source });
    }
  }

  const contextRefs: string[] = [];
  if (contextPath) {
    const normalized = normalizeIndexedPath(contextPath);
    const parts = normalized.split('.').filter(Boolean);
    for (let i = parts.length; i > 0; i--) {
      const candidate = parts.slice(0, i).join('.');
      const item = itemAt(state, candidate);
      if (item?.type === 'group' && (item as any).repeatable) {
        contextRefs.push('@current', '@index', '@count');
        break;
      }
    }
  }

  if (resolved.mappingContext) {
    contextRefs.push('@source', '@target');
  }

  return { fields, variables, instances, contextRefs: [...new Set(contextRefs)] };
}

/**
 * Enumerate all FEL expressions in the project with their artifact locations.
 */
export function allExpressions(state: ProjectState): ExpressionLocation[] {
  const results: ExpressionLocation[] = [];
  const def = state.definition;
  const pushExpression = (
    expression: string | undefined,
    artifact: ExpressionLocation['artifact'],
    location: string,
  ) => {
    if (!expression || typeof expression !== 'string') return;
    results.push({ expression, artifact, location });
  };

  // Bind expressions
  for (const bind of def.binds ?? []) {
    const b = bind as any;
    for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
      pushExpression(b[prop], 'definition', `binds[${b.path}].${prop}`);
    }
    if (typeof b.default === 'string' && b.default.startsWith('=')) {
      pushExpression(b.default.slice(1), 'definition', `binds[${b.path}].default`);
    }
  }

  // Shape expressions
  for (const shape of def.shapes ?? []) {
    const s = shape as any;
    pushExpression(s.constraint, 'definition', `shapes[${s.id}].constraint`);
    pushExpression(s.activeWhen, 'definition', `shapes[${s.id}].activeWhen`);
    if (s.context && typeof s.context === 'object') {
      for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
        if (typeof value === 'string') {
          pushExpression(value, 'definition', `shapes[${s.id}].context.${key}`);
        }
      }
    }
  }

  // Variable expressions
  for (const v of def.variables ?? []) {
    const va = v as any;
    pushExpression(va.expression, 'definition', `variables[${va.name}]`);
  }

  // Item-level FEL-bearing properties
  const itemVisited = new WeakSet<object>();
  const walkItems = (items: FormItem[], prefix: string) => {
    for (const item of items) {
      if (itemVisited.has(item as object)) continue;
      itemVisited.add(item as object);
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      const dynamic = item as any;
      for (const prop of ['relevant', 'required', 'readonly', 'calculate', 'constraint']) {
        if (typeof dynamic[prop] === 'string') {
          pushExpression(dynamic[prop], 'definition', `items[${path}].${prop}`);
        }
      }
      if (typeof dynamic.initialValue === 'string' && dynamic.initialValue.startsWith('=')) {
        pushExpression(dynamic.initialValue.slice(1), 'definition', `items[${path}].initialValue`);
      }
      if (item.children) walkItems(item.children, path);
    }
  };
  walkItems(def.items, '');

  // Mapping rule expressions
  const rules = (state.mapping as any).rules as any[] | undefined;
  if (rules) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      pushExpression(rule.expression, 'mapping', `rules[${i}].expression`);
      pushExpression(rule.condition, 'mapping', `rules[${i}].condition`);
      if (rule.reverse && typeof rule.reverse === 'object') {
        pushExpression(rule.reverse.expression, 'mapping', `rules[${i}].reverse.expression`);
        pushExpression(rule.reverse.condition, 'mapping', `rules[${i}].reverse.condition`);
      }
      if (Array.isArray(rule.innerRules)) {
        for (let j = 0; j < rule.innerRules.length; j++) {
          const inner = rule.innerRules[j];
          pushExpression(inner.expression, 'mapping', `rules[${i}].innerRules[${j}].expression`);
          pushExpression(inner.condition, 'mapping', `rules[${i}].innerRules[${j}].condition`);
        }
      }
    }
  }

  // Component document `when` guards
  const componentVisited = new WeakSet<object>();
  const walkComponentNode = (node: unknown, location: string) => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (componentVisited.has(n)) return;
    componentVisited.add(n);
    if (typeof n.when === 'string') {
      pushExpression(n.when, 'component', `${location}.when`);
    }
    if (Array.isArray(n.children)) {
      for (let i = 0; i < n.children.length; i++) {
        walkComponentNode(n.children[i], `${location}.children[${i}]`);
      }
    }
  };

  const componentDoc = getCurrentComponentDocument(state) as any;
  if (componentDoc.tree) {
    walkComponentNode(componentDoc.tree, 'tree');
  }

  const templateRegistry = componentDoc.components;
  if (templateRegistry && typeof templateRegistry === 'object') {
    for (const [name, template] of Object.entries(templateRegistry as Record<string, unknown>)) {
      const templateTree = (template as any)?.tree;
      if (templateTree) {
        walkComponentNode(templateTree, `components[${name}].tree`);
      }
    }
  }

  return results;
}

/**
 * List all field paths that a FEL expression references.
 */
export function expressionDependencies(_state: ProjectState, expression: string): string[] {
  return getFELDependencies(expression);
}
