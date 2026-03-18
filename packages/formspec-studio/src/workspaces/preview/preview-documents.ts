/** @filedesc Normalizes and materializes project documents into the shapes expected by the preview host. */
import defaultThemeJson from '../../../../formspec-webcomponent/src/default-theme.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTree(tree: unknown): unknown {
  if (!isRecord(tree)) return tree;
  return tree.component === 'Root' ? { ...tree, component: 'Stack' } : tree;
}

export function normalizeDefinitionDoc(definition: unknown): unknown {
  if (!definition || typeof definition !== 'object') return definition;
  const doc = { ...(definition as Record<string, unknown>) };

  // Normalize `presentation` → `formPresentation` for webcomponent compatibility
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
      ? record.targetDefinition as Record<string, unknown>
      : {};

  return {
    ...record,
    ...(record.tree ? { tree: normalizeTree(record.tree) } : {}),
    targetDefinition: {
      ...targetDefinition,
      ...(definitionUrl ? { url: definitionUrl } : {}),
    },
  };
}

export function normalizeThemeDoc(doc: unknown, definition: unknown): unknown {
  const theme = doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {};
  const fallback = defaultThemeJson as Record<string, unknown>;
  const definitionUrl =
    definition && typeof definition === 'object'
      ? (definition as Record<string, unknown>).url
      : undefined;

  return {
    ...fallback,
    ...theme,
    targetDefinition: {
      ...(fallback.targetDefinition as Record<string, unknown> | undefined),
      ...((theme.targetDefinition as Record<string, unknown> | undefined) ?? {}),
      ...(definitionUrl ? { url: definitionUrl } : {}),
    },
    tokens: {
      ...((fallback.tokens as Record<string, unknown> | undefined) ?? {}),
      ...((theme.tokens as Record<string, unknown> | undefined) ?? {}),
    },
    defaults: {
      ...((fallback.defaults as Record<string, unknown> | undefined) ?? {}),
      ...((theme.defaults as Record<string, unknown> | undefined) ?? {}),
    },
    breakpoints: {
      ...((fallback.breakpoints as Record<string, unknown> | undefined) ?? {}),
      ...((theme.breakpoints as Record<string, unknown> | undefined) ?? {}),
    },
    selectors: Array.isArray(theme.selectors) ? theme.selectors : fallback.selectors,
    pages: Array.isArray(theme.pages) ? theme.pages : fallback.pages,
    items: {
      ...((fallback.items as Record<string, unknown> | undefined) ?? {}),
      ...((theme.items as Record<string, unknown> | undefined) ?? {}),
    },
  };
}
