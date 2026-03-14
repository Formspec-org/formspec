/**
 * Cross-tier page command handlers.
 *
 * All `pages.*` commands write primarily to Tier 2 (theme.pages) and
 * auto-sync Tier 1 (definition.formPresentation.pageMode) to keep
 * the two in lockstep. Users think "I want pages" — these handlers
 * manage the tier plumbing internally.
 *
 * @module handlers/pages
 */
import { registerHandler } from '../handler-registry.js';

let pageIdCounter = 0;

function generatePageId(): string {
  return `page-${Date.now()}-${pageIdCounter++}`;
}

function ensurePages(state: any): any[] {
  if (!state.theme.pages) state.theme.pages = [];
  return state.theme.pages as any[];
}

function ensureFormPresentation(state: any): any {
  if (!state.definition.formPresentation) state.definition.formPresentation = {};
  return state.definition.formPresentation;
}

function findPageById(pages: any[], id: string): any {
  const page = pages.find((p: any) => p.id === id);
  if (!page) throw new Error(`Page not found: ${id}`);
  return page;
}

// ── pages.addPage ────────────────────────────────────────────────────

registerHandler('pages.addPage', (state, payload) => {
  const { title, description } = payload as { title?: string; description?: string };
  const pages = ensurePages(state);
  const fp = ensureFormPresentation(state);

  pages.push({
    id: generatePageId(),
    title: title ?? `Page ${pages.length + 1}`,
    description,
    regions: [],
  });

  // Only promote to wizard if currently single or unset.
  // Preserve tabs mode — mode is rendering style, not structure.
  if (!fp.pageMode || fp.pageMode === 'single') {
    fp.pageMode = 'wizard';
  }

  return { rebuildComponentTree: true };
});

// ── pages.deletePage ─────────────────────────────────────────────────

registerHandler('pages.deletePage', (state, payload) => {
  const { id } = payload as { id: string };
  const pages = ensurePages(state);
  const index = pages.findIndex((p: any) => p.id === id);
  if (index === -1) throw new Error(`Page not found: ${id}`);

  pages.splice(index, 1);
  // Do NOT reset pageMode — empty page list means "ready to add pages",
  // not "switch to single." Use pages.setMode('single') explicitly.

  return { rebuildComponentTree: true };
});

// ── pages.setMode ────────────────────────────────────────────────────

registerHandler('pages.setMode', (state, payload) => {
  const { mode } = payload as { mode: 'single' | 'wizard' | 'tabs' };
  const fp = ensureFormPresentation(state);
  fp.pageMode = mode;

  // Pages are preserved in single mode (dormant, not destroyed).
  // Ensure pages array exists for wizard/tabs.
  if (mode !== 'single') {
    ensurePages(state);
  }

  return { rebuildComponentTree: true };
});

// ── pages.reorderPages ──────────────────────────────────────────────

registerHandler('pages.reorderPages', (state, payload) => {
  const { id, direction } = payload as { id: string; direction: 'up' | 'down' };
  const pages = ensurePages(state);
  const index = pages.findIndex((p: any) => p.id === id);
  if (index === -1) throw new Error(`Page not found: ${id}`);

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= pages.length) return { rebuildComponentTree: true };

  [pages[index], pages[swapIndex]] = [pages[swapIndex], pages[index]];
  return { rebuildComponentTree: true };
});

// ── pages.setPageProperty ───────────────────────────────────────────

registerHandler('pages.setPageProperty', (state, payload) => {
  const { id, property, value } = payload as { id: string; property: string; value: unknown };
  const pages = ensurePages(state);
  const page = findPageById(pages, id);
  page[property] = value;
  return { rebuildComponentTree: true };
});

// ── pages.assignItem ─────────────────────────────────────────────────

registerHandler('pages.assignItem', (state, payload) => {
  const { pageId, key, span } = payload as { pageId: string; key: string; span?: number };
  const pages = ensurePages(state);

  // Remove from any existing page first
  for (const page of pages) {
    if (page.regions) {
      page.regions = page.regions.filter((r: any) => r.key !== key);
    }
  }

  // Add to target page
  const targetPage = findPageById(pages, pageId);
  if (!targetPage.regions) targetPage.regions = [];
  const region: any = { key };
  if (span !== undefined) region.span = span;
  targetPage.regions.push(region);

  return { rebuildComponentTree: true };
});

// ── pages.unassignItem ──────────────────────────────────────────────

registerHandler('pages.unassignItem', (state, payload) => {
  const { pageId, key } = payload as { pageId: string; key: string };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  if (page.regions) {
    page.regions = page.regions.filter((r: any) => r.key !== key);
  }
  return { rebuildComponentTree: true };
});

// ── pages.autoGenerate ──────────────────────────────────────────────

registerHandler('pages.autoGenerate', (state, payload) => {
  const pages = ensurePages(state);
  const fp = ensureFormPresentation(state);
  const items = state.definition.items ?? [];

  // Clear existing pages
  pages.length = 0;

  // Walk definition items looking for groups with presentation.layout.page hints
  // Schema path: definition.schema.json Presentation.layout.page
  const pageMap = new Map<string, any>();
  const pageOrder: string[] = [];
  let lastPageHint: string | null = null;

  for (const item of items) {
    if ((item as any).type !== 'group') continue;

    const pageHint = (item as any).presentation?.layout?.page;

    if (pageHint) {
      lastPageHint = pageHint;
      if (!pageMap.has(pageHint)) {
        pageMap.set(pageHint, {
          id: generatePageId(),
          title: (item as any).label ?? (item as any).key,
          regions: [],
        });
        pageOrder.push(pageHint);
      }
    }

    // Attach to current page (if has hint) or preceding page (if no hint)
    // Per schema: "Groups without a page attach to the preceding page"
    const targetHint = pageHint ?? lastPageHint;
    if (targetHint && pageMap.has(targetHint)) {
      const page = pageMap.get(targetHint)!;
      const children = (item as any).children ?? [];
      for (const child of children) {
        page.regions.push({ key: child.key, span: 12 });
      }
    }
  }

  if (pageMap.size > 0) {
    for (const hint of pageOrder) {
      pages.push(pageMap.get(hint)!);
    }
  } else {
    // Fallback: single page with all root items
    const fallbackPage: any = {
      id: generatePageId(),
      title: 'Page 1',
      regions: [],
    };
    for (const item of items) {
      fallbackPage.regions.push({ key: (item as any).key, span: 12 });
    }
    pages.push(fallbackPage);
  }

  // Only promote to wizard if currently single or unset
  if (!fp.pageMode || fp.pageMode === 'single') {
    fp.pageMode = 'wizard';
  }

  return { rebuildComponentTree: true };
});

// ── pages.reorderRegion ────────────────────────────────────────────

registerHandler('pages.reorderRegion', (state, payload) => {
  const { pageId, key, targetIndex } = payload as { pageId: string; key: string; targetIndex: number };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  if (!page.regions) return { rebuildComponentTree: true };

  const regions = page.regions as any[];
  const fromIndex = regions.findIndex((r: any) => r.key === key);
  if (fromIndex === -1) throw new Error(`Region not found: ${key}`);

  const [region] = regions.splice(fromIndex, 1);
  const clampedIndex = Math.min(targetIndex, regions.length);
  regions.splice(clampedIndex, 0, region);

  return { rebuildComponentTree: true };
});

// ── pages.setRegionProperty ────────────────────────────────────────

registerHandler('pages.setRegionProperty', (state, payload) => {
  const { pageId, key, property, value } = payload as {
    pageId: string; key: string; property: 'span' | 'start'; value: number | undefined;
  };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  const region = (page.regions ?? []).find((r: any) => r.key === key);
  if (!region) throw new Error(`Region not found: ${key}`);

  if (value === undefined) {
    delete region[property];
  } else {
    region[property] = value;
  }

  return { rebuildComponentTree: true };
});
