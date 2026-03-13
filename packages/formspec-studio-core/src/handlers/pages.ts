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

  fp.pageMode = 'wizard';
  return { rebuildComponentTree: false };
});

// ── pages.deletePage ─────────────────────────────────────────────────

registerHandler('pages.deletePage', (state, payload) => {
  const { id } = payload as { id: string };
  const pages = ensurePages(state);
  const index = pages.findIndex((p: any) => p.id === id);
  if (index === -1) throw new Error(`Page not found: ${id}`);

  pages.splice(index, 1);

  const fp = ensureFormPresentation(state);
  if (pages.length === 0) {
    fp.pageMode = 'single';
  }

  return { rebuildComponentTree: false };
});

// ── pages.setMode ────────────────────────────────────────────────────

registerHandler('pages.setMode', (state, payload) => {
  const { mode } = payload as { mode: 'single' | 'wizard' | 'tabs' };
  const fp = ensureFormPresentation(state);
  fp.pageMode = mode;

  if (mode === 'single') {
    // Clear theme pages
    state.theme.pages = [];
  } else {
    // Ensure pages array exists
    ensurePages(state);
  }

  return { rebuildComponentTree: false };
});

// ── pages.reorderPages ──────────────────────────────────────────────

registerHandler('pages.reorderPages', (state, payload) => {
  const { id, direction } = payload as { id: string; direction: 'up' | 'down' };
  const pages = ensurePages(state);
  const index = pages.findIndex((p: any) => p.id === id);
  if (index === -1) throw new Error(`Page not found: ${id}`);

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= pages.length) return { rebuildComponentTree: false };

  [pages[index], pages[swapIndex]] = [pages[swapIndex], pages[index]];
  return { rebuildComponentTree: false };
});

// ── pages.setPageProperty ───────────────────────────────────────────

registerHandler('pages.setPageProperty', (state, payload) => {
  const { id, property, value } = payload as { id: string; property: string; value: unknown };
  const pages = ensurePages(state);
  const page = findPageById(pages, id);
  page[property] = value;
  return { rebuildComponentTree: false };
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

  return { rebuildComponentTree: false };
});

// ── pages.unassignItem ──────────────────────────────────────────────

registerHandler('pages.unassignItem', (state, payload) => {
  const { pageId, key } = payload as { pageId: string; key: string };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  if (page.regions) {
    page.regions = page.regions.filter((r: any) => r.key !== key);
  }
  return { rebuildComponentTree: false };
});

// ── pages.autoGenerate ──────────────────────────────────────────────

registerHandler('pages.autoGenerate', (state, payload) => {
  const pages = ensurePages(state);
  const fp = ensureFormPresentation(state);
  const items = state.definition.items ?? [];

  // Clear existing pages
  pages.length = 0;

  // Walk definition items looking for groups with layout.page hints
  const pageMap = new Map<string, any>();
  for (const item of items) {
    if ((item as any).type === 'group' && (item as any).layout?.page) {
      const pageHint = (item as any).layout.page;
      if (!pageMap.has(pageHint)) {
        pageMap.set(pageHint, {
          id: generatePageId(),
          title: (item as any).label ?? (item as any).key,
          regions: [],
        });
      }
      const page = pageMap.get(pageHint)!;
      // Add child keys as regions
      const children = (item as any).children ?? [];
      for (const child of children) {
        page.regions.push({ key: child.key, span: 12 });
      }
    }
  }

  if (pageMap.size > 0) {
    pages.push(...pageMap.values());
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

  fp.pageMode = 'wizard';
  return { rebuildComponentTree: false };
});
