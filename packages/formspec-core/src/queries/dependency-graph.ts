/**
 * Pure query functions for dependency analysis across FEL expressions.
 */
import {
  analyzeFEL,
  getFELDependencies,
  normalizeIndexedPath,
} from 'formspec-engine';
import { fieldPaths as getFieldPaths } from './field-queries.js';
import { allExpressions } from './expression-index.js';
import type {
  ProjectState,
  DependencyGraph,
  FieldDependents,
} from '../types.js';

/**
 * Reverse lookup: find all binds, shapes, variables, and mapping rules that
 * reference a given field.
 */
export function fieldDependents(state: ProjectState, fieldPath: string): FieldDependents {
  const result: FieldDependents = { binds: [], shapes: [], variables: [], mappingRules: [], screenerRoutes: [] };
  const def = state.definition;
  const target = normalizeIndexedPath(fieldPath);
  const expressionReferencesField = (expression: string): boolean => {
    const refs = getFELDependencies(expression).map(ref => normalizeIndexedPath(ref));
    return refs.includes(target);
  };

  // Check binds
  for (const bind of def.binds ?? []) {
    const b = bind as any;
    for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
      if (typeof b[prop] === 'string' && expressionReferencesField(b[prop])) {
        result.binds.push({ path: b.path, property: prop });
      }
    }
    if (typeof b.default === 'string' && b.default.startsWith('=') && expressionReferencesField(b.default.slice(1))) {
      result.binds.push({ path: b.path, property: 'default' });
    }
  }

  // Check shapes
  for (const shape of def.shapes ?? []) {
    const s = shape as any;
    if (typeof s.constraint === 'string' && expressionReferencesField(s.constraint)) {
      result.shapes.push({ id: s.id, property: 'constraint' });
    }
    if (typeof s.activeWhen === 'string' && expressionReferencesField(s.activeWhen)) {
      result.shapes.push({ id: s.id, property: 'activeWhen' });
    }
    if (s.context && typeof s.context === 'object') {
      for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
        if (typeof value === 'string' && expressionReferencesField(value)) {
          result.shapes.push({ id: s.id, property: `context.${key}` });
        }
      }
    }
  }

  // Check variables
  for (const v of def.variables ?? []) {
    const va = v as any;
    if (typeof va.expression === 'string' && expressionReferencesField(va.expression)) {
      result.variables.push(va.name);
    }
  }

  // Check mapping rules
  for (const [mid, m] of Object.entries(state.mappings)) {
    const rules = (m as any).rules as any[] | undefined;
    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const sourcePath = typeof rule.sourcePath === 'string' ? normalizeIndexedPath(rule.sourcePath) : undefined;
        const dependsOnField =
          sourcePath === target
          || (typeof rule.expression === 'string' && expressionReferencesField(rule.expression))
          || (typeof rule.condition === 'string' && expressionReferencesField(rule.condition));
        if (dependsOnField) {
          result.mappingRules.push(mid === 'default' ? `${i}` : `${mid}:${i}`);
        }
      }
    }
  }

  // Check screener routes
  const screenerRoutes = def.screener?.routes;
  if (screenerRoutes) {
    for (let i = 0; i < screenerRoutes.length; i++) {
      const route = screenerRoutes[i] as any;
      if (typeof route.condition === 'string' && expressionReferencesField(route.condition)) {
        result.screenerRoutes.push(i);
      }
    }
  }

  return result;
}

/**
 * Find all bind paths whose FEL expressions reference a given variable.
 */
export function variableDependents(state: ProjectState, variableName: string): string[] {
  const paths: string[] = [];
  const referencesVariable = (expression: string): boolean => {
    const analysis = analyzeFEL(expression);
    return analysis.valid && analysis.variables.includes(variableName);
  };

  for (const bind of state.definition.binds ?? []) {
    const b = bind as any;
    for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
      if (typeof b[prop] === 'string' && referencesVariable(b[prop])) {
        paths.push(b.path);
        break;
      }
    }
  }

  return [...new Set(paths)];
}

/**
 * Build a full dependency graph across all FEL expressions in the project.
 */
export function dependencyGraph(state: ProjectState): DependencyGraph {
  const nodes: DependencyGraph['nodes'] = [];
  const edges: DependencyGraph['edges'] = [];
  const def = state.definition;
  const nodeIds = new Set<string>();
  const addNode = (id: string, type: 'field' | 'variable' | 'shape') => {
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({ id, type });
  };
  const addEdge = (from: string, to: string, via: string) => {
    edges.push({ from, to, via });
  };
  const addExpressionEdges = (expression: string, to: string, via: string) => {
    const analysis = analyzeFEL(expression);
    if (!analysis.valid) return;
    for (const ref of analysis.references) {
      addEdge(normalizeIndexedPath(ref), normalizeIndexedPath(to), via);
    }
    for (const variable of analysis.variables) {
      addEdge(variable, normalizeIndexedPath(to), via);
    }
  };

  // Add field nodes
  for (const path of getFieldPaths(state)) {
    addNode(path, 'field');
  }

  // Add variable nodes
  for (const v of def.variables ?? []) {
    const va = v as any;
    addNode(va.name, 'variable');
  }

  // Add shape nodes
  for (const s of def.shapes ?? []) {
    addNode((s as any).id, 'shape');
  }

  // Build edges from binds
  for (const bind of def.binds ?? []) {
    const b = bind as any;
    for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint']) {
      if (typeof b[prop] === 'string') {
        addExpressionEdges(b[prop], b.path, prop);
      }
    }
    if (typeof b.default === 'string' && b.default.startsWith('=')) {
      addExpressionEdges(b.default.slice(1), b.path, 'default');
    }
  }

  // Build edges from variables
  for (const v of def.variables ?? []) {
    const va = v as any;
    if (typeof va.expression === 'string') {
      addExpressionEdges(va.expression, va.name, 'variable');
    }
  }

  // Build edges from shapes
  for (const shape of def.shapes ?? []) {
    const s = shape as any;
    if (typeof s.constraint === 'string') {
      addExpressionEdges(s.constraint, s.id, 'shape.constraint');
    }
    if (typeof s.activeWhen === 'string') {
      addExpressionEdges(s.activeWhen, s.id, 'shape.activeWhen');
    }
    if (s.context && typeof s.context === 'object') {
      for (const [key, value] of Object.entries(s.context as Record<string, unknown>)) {
        if (typeof value === 'string') {
          addExpressionEdges(value, s.id, `shape.context.${key}`);
        }
      }
    }
  }

  // Detect cycles using DFS
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const toSet = adjacency.get(edge.from) ?? new Set<string>();
    toSet.add(edge.to);
    adjacency.set(edge.from, toSet);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const cycleKeys = new Set<string>();

  const dfs = (node: string) => {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
        continue;
      }
      if (!inStack.has(next)) continue;
      const start = stack.indexOf(next);
      if (start < 0) continue;
      const cycle = stack.slice(start);
      const key = cycle.join('->');
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of nodeIds) {
    if (!visited.has(node)) dfs(node);
  }

  return { nodes, edges, cycles };
}
