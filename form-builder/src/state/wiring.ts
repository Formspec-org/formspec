/**
 * @module Studio definition wiring helpers.
 * Keeps definition paths, expressions, and component nodes aligned during edits.
 */
import type { FormspecBind, FormspecDefinition, FormspecItem, FormspecShape } from 'formspec-engine';

/** Minimal component node shape generated from definition items. */
export interface GeneratedComponentNode {
  component: string;
  bind?: string;
  text?: string;
  responsive?: Record<string, Record<string, unknown>>;
  columns?: Array<{
    header: string;
    bind: string;
    min?: number;
    max?: number;
    step?: number;
  }>;
  showRowNumbers?: boolean;
  allowAdd?: boolean;
  allowRemove?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  children?: GeneratedComponentNode[];
}

/** Path rewrite map where keys are old paths and values are rewritten paths. */
export type PathRewriteMap = Record<string, string>;

const ITEM_EXPRESSION_KEYS = ['relevant', 'required', 'calculate', 'readonly', 'constraint'] as const;
const BIND_EXPRESSION_KEYS = ['relevant', 'required', 'calculate', 'readonly', 'constraint'] as const;
const SHAPE_EXPRESSION_ARRAY_KEYS = ['and', 'or', 'xone'] as const;

const TEXT_INPUT_DATA_TYPES = new Set(['string', 'text', 'uri']);
const NUMBER_INPUT_DATA_TYPES = new Set(['integer', 'decimal', 'number']);

/** Splits a dotted bind path into segments. */
export function toPathSegments(path: string | null | undefined): string[] {
  if (!path) {
    return [];
  }
  return path.split('.').filter(Boolean);
}

/** Joins path parts with `.` while skipping empty values. */
export function joinPath(...parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join('.');
}

/** Returns the parent path for a bind path or `null` at the root. */
export function getParentPath(path: string): string | null {
  const segments = toPathSegments(path);
  if (segments.length <= 1) {
    return null;
  }
  return segments.slice(0, -1).join('.');
}

/** Returns the final key segment for a bind path. */
export function getLeafKey(path: string): string {
  const segments = toPathSegments(path);
  return segments[segments.length - 1] ?? path;
}

/**
 * Rewrites a path using an old->new map.
 * Matches exact path, dotted descendants, and repeat-index descendants.
 */
export function rewritePathByMap(path: string, rewriteMap: PathRewriteMap): string {
  const entries = Object.entries(rewriteMap).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (path === from) {
      return to;
    }
    if (path.startsWith(`${from}.`)) {
      return `${to}${path.slice(from.length)}`;
    }
    if (path.startsWith(`${from}[`)) {
      return `${to}${path.slice(from.length)}`;
    }
  }
  return path;
}

/** Rebuilds the full component tree directly from definition items. */
export function rebuildComponentTreeFromDefinition(definition: FormspecDefinition): GeneratedComponentNode {
  return {
    component: 'Stack',
    children: definition.items.map((item) => buildComponentNode(item, ''))
  };
}

/** Builds component nodes for a sibling item array under `parentPath`. */
export function buildComponentNodesForItems(items: FormspecItem[], parentPath = ''): GeneratedComponentNode[] {
  return items.map((item) => buildComponentNode(item, parentPath));
}

/** Collects every field path in depth-first order. */
export function collectFieldPaths(items: FormspecItem[], parentPath = ''): string[] {
  const paths: string[] = [];
  for (const item of items) {
    const path = joinPath(parentPath, item.key);
    if (item.type === 'field') {
      paths.push(path);
    }
    if (item.children?.length) {
      paths.push(...collectFieldPaths(item.children, path));
    }
  }
  return paths;
}

/**
 * Rewrites all known path references in a definition clone.
 * Includes binds, shapes, variables, item expressions, and message templates.
 */
export function rewriteDefinitionPathReferences(
  definition: FormspecDefinition,
  rewriteMap: PathRewriteMap
): FormspecDefinition {
  const next: FormspecDefinition = structuredClone(definition);

  if (next.binds?.length) {
    next.binds = next.binds.map((bind) => rewriteBind(bind, rewriteMap));
  }

  if (next.shapes?.length) {
    next.shapes = next.shapes.map((shape) => rewriteShape(shape, rewriteMap));
  }

  if (next.variables?.length) {
    next.variables = next.variables.map((variable) => {
      const rewrittenVariable = {
        ...variable,
        expression: rewriteFelPaths(variable.expression, rewriteMap)
      };

      if (typeof variable.scope === 'string') {
        rewrittenVariable.scope = variable.scope === '#'
          ? '#'
          : rewritePathByMap(variable.scope, rewriteMap);
      } else {
        delete rewrittenVariable.scope;
      }

      return rewrittenVariable;
    });
  }

  next.items = rewriteItemExpressions(next.items, rewriteMap);
  return next;
}

/**
 * Rewrites FEL field-path references in an expression string.
 * String literals are preserved and never rewritten.
 */
export function rewriteFelPaths(expression: string, rewriteMap: PathRewriteMap): string {
  if (!expression) {
    return expression;
  }

  const entries = Object.entries(rewriteMap).sort((a, b) => b[0].length - a[0].length);
  if (!entries.length) {
    return expression;
  }

  const parts = expression.split(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"])*")/g);
  for (let index = 0; index < parts.length; index += 2) {
    let updated = parts[index];
    for (const [from, to] of entries) {
      const escapedFrom = escapeRegex(from);
      const dollarPattern = new RegExp(`\\$${escapedFrom}(?![A-Za-z0-9_])`, 'g');
      updated = updated.replace(dollarPattern, `$${to}`);

      const barePattern = new RegExp(`(^|[^A-Za-z0-9_.$@])${escapedFrom}(?![A-Za-z0-9_])`, 'g');
      updated = updated.replace(barePattern, (_full, prefix: string) => `${prefix}${to}`);
    }
    parts[index] = updated;
  }

  return parts.join('');
}

function rewriteBind(bind: FormspecBind, rewriteMap: PathRewriteMap): FormspecBind {
  const nextBind: FormspecBind = {
    ...bind,
    path: rewritePathByMap(bind.path, rewriteMap)
  };

  for (const key of BIND_EXPRESSION_KEYS) {
    if (typeof nextBind[key] === 'string') {
      (nextBind as Record<string, unknown>)[key] = rewriteFelPaths(nextBind[key] as string, rewriteMap);
    }
  }

  if (typeof nextBind.constraintMessage === 'string') {
    nextBind.constraintMessage = rewriteMessageTemplatePaths(nextBind.constraintMessage, rewriteMap);
  }

  return nextBind;
}

function rewriteShape(shape: FormspecShape, rewriteMap: PathRewriteMap): FormspecShape {
  const nextShape: FormspecShape = {
    ...shape,
    target: shape.target === '#' ? shape.target : rewritePathByMap(shape.target, rewriteMap)
  };

  if (typeof nextShape.constraint === 'string') {
    nextShape.constraint = rewriteFelPaths(nextShape.constraint, rewriteMap);
  }
  if (typeof nextShape.activeWhen === 'string') {
    nextShape.activeWhen = rewriteFelPaths(nextShape.activeWhen, rewriteMap);
  }
  if (typeof nextShape.message === 'string') {
    nextShape.message = rewriteMessageTemplatePaths(nextShape.message, rewriteMap);
  }

  for (const key of SHAPE_EXPRESSION_ARRAY_KEYS) {
    const value = nextShape[key];
    if (Array.isArray(value)) {
      (nextShape as Record<string, unknown>)[key] = value.map((entry) => rewriteFelPaths(entry, rewriteMap));
    }
  }

  if (typeof nextShape.not === 'string') {
    nextShape.not = rewriteFelPaths(nextShape.not, rewriteMap);
  }

  if (nextShape.context) {
    const nextContext: Record<string, string> = {};
    for (const [key, value] of Object.entries(nextShape.context)) {
      nextContext[key] = rewriteFelPaths(value, rewriteMap);
    }
    nextShape.context = nextContext;
  }

  return nextShape;
}

function rewriteItemExpressions(items: FormspecItem[], rewriteMap: PathRewriteMap): FormspecItem[] {
  return items.map((item) => {
    const nextItem: FormspecItem = { ...item };

    for (const key of ITEM_EXPRESSION_KEYS) {
      const value = nextItem[key];
      if (typeof value === 'string') {
        (nextItem as Record<string, unknown>)[key] = rewriteFelPaths(value, rewriteMap);
      }
    }

    if (typeof nextItem.message === 'string') {
      nextItem.message = rewriteMessageTemplatePaths(nextItem.message, rewriteMap);
    }

    if (nextItem.children?.length) {
      nextItem.children = rewriteItemExpressions(nextItem.children, rewriteMap);
    }

    return nextItem;
  });
}

function rewriteMessageTemplatePaths(message: string, rewriteMap: PathRewriteMap): string {
  return message.replace(/\{\{(.*?)\}\}/g, (_full, expr: string) => `{{${rewriteFelPaths(expr, rewriteMap)}}}`);
}

function buildComponentNode(item: FormspecItem, parentPath: string): GeneratedComponentNode {
  const itemPath = joinPath(parentPath, item.key);

  if (item.type === 'group') {
    return {
      component: 'Stack',
      children: (item.children ?? []).map((child) => buildComponentNode(child, itemPath))
    };
  }

  if (item.type === 'display') {
    return {
      component: 'Text',
      text: item.label
    };
  }

  return {
    component: resolveFieldComponent(item),
    bind: itemPath
  };
}

function resolveFieldComponent(item: FormspecItem): string {
  const dataType = item.dataType ?? 'string';

  if (dataType === 'boolean') {
    return 'Toggle';
  }
  if (dataType === 'choice') {
    return 'Select';
  }
  if (dataType === 'multiChoice') {
    return 'CheckboxGroup';
  }
  if (dataType === 'attachment') {
    return 'FileUpload';
  }
  if (dataType === 'money') {
    return 'MoneyInput';
  }
  if (dataType === 'date' || dataType === 'dateTime' || dataType === 'time') {
    return 'DatePicker';
  }
  if (NUMBER_INPUT_DATA_TYPES.has(dataType)) {
    return 'NumberInput';
  }
  if (TEXT_INPUT_DATA_TYPES.has(dataType)) {
    return 'TextInput';
  }

  return 'TextInput';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
