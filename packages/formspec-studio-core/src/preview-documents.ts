/** @filedesc Normalizes project documents into the shapes expected by preview/render hosts. */
import { buildPlatformTheme } from '@formspec-org/layout';
const defaultThemeJson = buildPlatformTheme();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTree(tree: unknown): unknown {
  if (!isRecord(tree)) return tree;
  return tree.component === 'Root' ? { ...tree, component: 'Stack' } : tree;
}

function synthesizePagedPreviewTree(tree: unknown, definition: unknown): unknown {
  if (!isRecord(tree) || tree.component !== 'Stack' || !Array.isArray(tree.children)) return tree;
  if (!isRecord(definition)) return tree;

  const formPresentation = isRecord(definition.formPresentation) ? definition.formPresentation : undefined;
  const pageMode = formPresentation?.pageMode;
  if (pageMode !== 'wizard' && pageMode !== 'tabs') return tree;

  const items = Array.isArray(definition.items) ? definition.items : [];
  const topLevelGroupLabels = new Map<string, string>();
  for (const item of items) {
    if (!isRecord(item) || item.type !== 'group' || typeof item.key !== 'string') continue;
    topLevelGroupLabels.set(item.key, typeof item.label === 'string' && item.label.trim() ? item.label : item.key);
  }

  if (topLevelGroupLabels.size === 0) return tree;
  if (tree.children.some((child) => isRecord(child) && child.component === 'Page')) return tree;

  let synthesizedAny = false;
  const children = tree.children.map((child) => {
    if (!isRecord(child) || typeof child.bind !== 'string') return child;
    const title = topLevelGroupLabels.get(child.bind);
    if (!title) return child;

    synthesizedAny = true;
    return {
      component: 'Page',
      nodeId: `preview-page-${child.bind}`,
      title,
      _layout: true,
      children: [child],
    };
  });

  return synthesizedAny ? { ...tree, children } : tree;
}

export function normalizeDefinitionDoc(definition: unknown): unknown {
  if (!definition || typeof definition !== 'object') return definition;
  const doc = { ...(definition as Record<string, unknown>) };

  if (doc.presentation && !doc.formPresentation) {
    doc.formPresentation = doc.presentation;
  }

  return doc;
}

export function normalizeComponentDoc(doc: unknown, definition?: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const record = doc as Record<string, unknown>;
  const definitionUrl =
    definition && typeof definition === 'object'
      ? (definition as Record<string, unknown>).url
      : undefined;

  const targetDefinition =
    record.targetDefinition && typeof record.targetDefinition === 'object'
      ? (record.targetDefinition as Record<string, unknown>)
      : {};

  return {
    ...record,
    $formspecComponent: typeof record.$formspecComponent === 'string' ? record.$formspecComponent : '1.0',
    version: typeof record.version === 'string' ? record.version : '0.1.0',
    ...(record.tree ? { tree: synthesizePagedPreviewTree(normalizeTree(record.tree), definition) } : {}),
    targetDefinition: {
      ...targetDefinition,
      ...(definitionUrl ? { url: definitionUrl } : {}),
    },
  };
}

export function normalizeThemeDoc(doc: unknown, definition: unknown): unknown {
  const theme = doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {};
  const fallback = defaultThemeJson;
  const definitionUrl =
    definition && typeof definition === 'object'
      ? (definition as Record<string, unknown>).url
      : undefined;

  return {
    $formspecTheme: fallback.$formspecTheme,
    version: fallback.version,
    name: fallback.name,
    targetDefinition: {
      ...fallback.targetDefinition,
      ...((theme.targetDefinition as Record<string, unknown> | undefined) ?? {}),
      ...(definitionUrl ? { url: definitionUrl } : {}),
    },
    tokens: {
      ...fallback.tokens,
      ...((theme.tokens as Record<string, unknown> | undefined) ?? {}),
    },
    defaults: {
      ...fallback.defaults,
      ...((theme.defaults as Record<string, unknown> | undefined) ?? {}),
    },
    breakpoints: {
      ...((theme.breakpoints as Record<string, unknown> | undefined) ?? {}),
    },
    selectors: Array.isArray(theme.selectors) ? theme.selectors : fallback.selectors,
    items: {
      ...((theme.items as Record<string, unknown> | undefined) ?? {}),
    },
  };
}
