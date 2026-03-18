/** @filedesc Resolves theme pages into enriched page structures with diagnostics. */
import type { ThemeDocument, FormDefinition, FormItem } from './types.js';

// ── Public types ─────────────────────────────────────────────────────

/**
 * Enriched region from theme.schema.json Region with existence check.
 * Schema source: theme.schema.json#/$defs/Region
 */
export interface ResolvedRegion {
  key: string;
  span: number;       // default 12 per schema
  start?: number;
  responsive?: Record<string, { span?: number; start?: number; hidden?: boolean }>;
  exists: boolean;     // key exists in definition items?
}

/**
 * Resolved page from theme.schema.json Page with enriched regions.
 * Schema source: theme.schema.json#/$defs/Page
 */
export interface ResolvedPage {
  id: string;
  title: string;
  description?: string;
  regions: ResolvedRegion[];
}

export interface PageDiagnostic {
  code: 'UNKNOWN_REGION_KEY' | 'PAGEMODE_MISMATCH';
  severity: 'warning' | 'error';
  message: string;
}

export interface ResolvedPageStructure {
  mode: 'single' | 'wizard' | 'tabs';
  pages: ResolvedPage[];
  diagnostics: PageDiagnostic[];
  unassignedItems: string[];
  itemPageMap: Record<string, string>;
}

/** The two document slices resolvePageStructure reads. */
export type PageStructureInput = {
  theme: Pick<ThemeDocument, 'pages'>;
  definition: Pick<FormDefinition, 'formPresentation' | 'items'>;
};

/**
 * Resolves the current page structure from studio-managed internal state.
 *
 * Reads `theme.pages` as the canonical source. No tier cascade —
 * Studio is the sole writer and keeps all documents consistent.
 */
export function resolvePageStructure(
  state: PageStructureInput,
  definitionItemKeys: string[],
): ResolvedPageStructure {
  const diagnostics: PageDiagnostic[] = [];
  const themePages = (state.theme.pages ?? []) as any[];
  const pageMode: string = state.definition.formPresentation?.pageMode ?? 'single';
  const knownKeys = new Set(definitionItemKeys);

  // Build resolved pages from theme.pages (canonical source)
  // Maps theme.schema.json Page/Region to enriched ResolvedPage/ResolvedRegion
  const pages: ResolvedPage[] = themePages.map((p: any) => ({
    id: p.id ?? '',
    title: p.title ?? '',
    ...(p.description !== undefined && { description: p.description }),
    regions: (p.regions ?? []).map((r: any) => {
      const region: ResolvedRegion = {
        key: r.key ?? '',
        span: r.span ?? 12,  // Region.span default per schema
        exists: knownKeys.has(r.key ?? ''),
      };
      if (r.start !== undefined) region.start = r.start;
      if (r.responsive !== undefined) region.responsive = r.responsive;
      return region;
    }),
  }));

  // Build itemPageMap and emit diagnostics for unknown keys
  // 1. Explicitly assigned keys from regions
  const itemPageMap: Record<string, string> = {};
  for (const page of pages) {
    for (const region of page.regions) {
      if (region.exists) {
        itemPageMap[region.key] = page.id;
      } else if (region.key) {
        diagnostics.push({
          code: 'UNKNOWN_REGION_KEY',
          severity: 'warning',
          message: `Region key "${region.key}" on page "${page.title || page.id}" does not match any definition item.`,
        });
      }
    }
  }

  // 2. Inherit page IDs for child items (groups assign all children by default)
  function propagate(items: FormItem[], parentPageId?: string) {
    for (const item of items) {
      const inheritedId = itemPageMap[item.key] ?? parentPageId;
      if (inheritedId && !itemPageMap[item.key]) {
        itemPageMap[item.key] = inheritedId;
      }
      if (item.children) {
        propagate(item.children, inheritedId);
      }
    }
  }
  propagate(state.definition.items ?? []);

  // Compute unassigned items (top-level only)
  // An item is unassigned if it's not in any region and didn't inherit from parent.
  // We only show the highest-level unassigned item in any branch.
  const unassignedItems: string[] = [];
  const visited = new Set<string>();
  function collectUnassigned(items: FormItem[], parentUnassigned: boolean = false) {
    for (const item of items) {
      visited.add(item.key);
      const isUnassigned = !(item.key in itemPageMap);
      if (isUnassigned && !parentUnassigned) {
        unassignedItems.push(item.key);
      }
      if (item.children) {
        collectUnassigned(item.children, isUnassigned || parentUnassigned);
      }
    }
  }
  collectUnassigned(state.definition.items ?? []);

  // Also include keys from the input list that weren't in the items tree
  // (guards against mismatched inputs and supports minimal test cases)
  for (const key of definitionItemKeys) {
    if (!visited.has(key) && !(key in itemPageMap)) {
      unassignedItems.push(key);
    }
  }

  // Emit PAGEMODE_MISMATCH
  if (pages.length > 0 && pageMode === 'single') {
    diagnostics.push({
      code: 'PAGEMODE_MISMATCH',
      severity: 'warning',
      message: 'Theme pages exist but definition pageMode is "single". Pages may not render.',
    });
  }

  // Determine effective mode (definition.schema.json formPresentation.pageMode enum)
  const mode: 'single' | 'wizard' | 'tabs' =
    pageMode === 'tabs' ? 'tabs' : pageMode === 'wizard' ? 'wizard' : 'single';

  return {
    mode,
    pages,
    diagnostics,
    unassignedItems,
    itemPageMap,
  };
}
