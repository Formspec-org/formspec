import type { ProjectState } from './types.js';

// ── Public types ─────────────────────────────────────────────────────

/**
 * Enriched region from theme.schema.json Region with existence check.
 * Schema source: theme.schema.json#/$defs/Region
 */
export interface ResolvedRegion {
  key: string;
  span: number;       // default 12 per schema
  start?: number;
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

/**
 * Resolves the current page structure from studio-managed internal state.
 *
 * Reads `theme.pages` as the canonical source. No tier cascade —
 * Studio is the sole writer and keeps all documents consistent.
 */
export function resolvePageStructure(
  state: ProjectState,
  definitionItemKeys: string[],
): ResolvedPageStructure {
  const diagnostics: PageDiagnostic[] = [];
  const def = state.definition as any;
  const themePages = (state.theme.pages ?? []) as any[];
  const pageMode: string = def.formPresentation?.pageMode ?? 'single';
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
      return region;
    }),
  }));

  // Build itemPageMap and emit diagnostics for unknown keys
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

  // Compute unassigned items
  const unassignedItems = definitionItemKeys.filter(k => !(k in itemPageMap));

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
