import defaultThemeJson from '../../../../formspec-webcomponent/src/default-theme.json';

export function normalizeDefinitionDoc(definition: unknown): unknown {
  if (!definition || typeof definition !== 'object') return definition;
  const doc = { ...(definition as Record<string, unknown>) };
  const binds = doc.binds;

  if (binds && !Array.isArray(binds) && typeof binds === 'object') {
    doc.binds = Object.entries(binds as Record<string, Record<string, unknown>>).map(([path, config]) => ({
      path,
      ...(config ?? {}),
    }));
  }

  // Normalize `presentation` → `formPresentation` for webcomponent compatibility
  if (doc.presentation && !doc.formPresentation) {
    doc.formPresentation = doc.presentation;
  }

  return doc;
}

export function normalizeComponentDoc(doc: unknown, definition?: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const record = doc as Record<string, unknown>;
  const tree = record.tree as Record<string, unknown> | undefined;

  // When pageMode is 'wizard' or 'tabs', the auto-built component tree (a plain Stack)
  // does not know how to wrap pages in a Wizard/Tabs node. Strip the auto-built tree
  // so the webcomponent falls back to planDefinitionFallback, which handles wizard
  // wrapping via formPresentation.pageMode.
  //
  // We identify the auto-built tree by the absence of $formspecComponent (user-authored
  // component documents always set this to '1.0').
  if (definition && typeof definition === 'object') {
    const def = definition as Record<string, unknown>;
    const pageMode =
      (def.formPresentation as Record<string, unknown> | undefined)?.pageMode ??
      (def.presentation as Record<string, unknown> | undefined)?.pageMode;
    const isAutoBuiltTree = tree && !record.$formspecComponent;
    if ((pageMode === 'wizard' || pageMode === 'tabs') && isAutoBuiltTree) {
      const { tree: _stripped, ...rest } = record;
      return rest;
    }
  }

  if (tree?.component === 'Root') {
    return { ...record, tree: { ...tree, component: 'Stack' } };
  }
  return doc;
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
