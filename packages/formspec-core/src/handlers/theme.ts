/**
 * Theme command handlers.
 *
 * The Formspec theme document controls visual presentation through a three-level
 * cascade that determines how each form item is rendered:
 *
 *   - **Cascade Level 1 (Defaults)** -- Form-wide presentation baseline. Every
 *     item inherits these unless overridden by a more specific level.
 *   - **Cascade Level 2 (Selectors)** -- Pattern-based overrides that match items
 *     by `type` and/or `dataType`. Selectors apply in document order; later
 *     selectors win when they match the same property. Order matters.
 *   - **Cascade Level 3 (Per-Item Overrides)** -- Highest-specificity level.
 *     PresentationBlock overrides keyed by an item's `key`. These always win.
 *
 * In addition to the cascade, the theme document manages:
 *   - **Design tokens** -- Named values (e.g. `color.primary`, `spacing.md`) that
 *     can be referenced from style properties via `$token.key` syntax. Theme tokens
 *     are Tier 2; component-level tokens (Tier 3) override them.
 *   - **Breakpoints** -- Named responsive breakpoints (e.g. `tablet: 768`) that
 *     drive responsive style/layout switching.
 *   - **Page layout** -- A multi-page structure where each page contains 12-column
 *     grid regions. Each region binds to a definition item key.
 *   - **Stylesheets** -- External CSS URLs to load at render time.
 *
 * All handlers return `{ rebuildComponentTree: false }` because theme mutations
 * do not alter the definition item tree structure.
 *
 * @module handlers/theme
 */
import { registerHandler } from '../handler-registry.js';
import type { FormspecThemeDocument } from '../types.js';

/** Auto-incrementing counter for generating unique page IDs. */
let pageCounter = 0;

/**
 * Ensures the theme document has an `items` map and returns it.
 * Lazily initializes `theme.items` to an empty object if absent.
 *
 * @param theme - The theme document to ensure items on.
 * @returns The items record (created or existing).
 */
function ensureItems(theme: FormspecThemeDocument): Record<string, any> {
  if (!theme.items) theme.items = {};
  return theme.items as Record<string, any>;
}

/**
 * Ensures a per-item PresentationBlock entry exists for the given item key
 * and returns it. Lazily initializes both the `items` map and the specific
 * item's block if absent.
 *
 * @param theme - The theme document.
 * @param itemKey - The definition item key to ensure a block for.
 * @returns The PresentationBlock record for the item.
 */
function ensureItemBlock(theme: FormspecThemeDocument, itemKey: string): Record<string, any> {
  const items = ensureItems(theme);
  if (!items[itemKey]) items[itemKey] = {};
  return items[itemKey];
}

/**
 * Finds a page by its ID within the theme's pages array.
 *
 * @param theme - The theme document containing pages.
 * @param pageId - The unique page identifier to locate.
 * @returns The page object.
 * @throws Error if no pages are defined or the page ID is not found.
 */
function findPage(theme: FormspecThemeDocument, pageId: string): any {
  const pages = theme.pages as any[];
  if (!pages) throw new Error('No pages defined');
  const page = pages.find((p: any) => p.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  return page;
}

// ── Tokens & Defaults ───────────────────────────────────────────

/**
 * Set or remove a single design token on the theme document (Tier 2).
 *
 * Design tokens are named values (e.g. `color.primary`, `spacing.md`) that
 * style properties can reference via `$token.key` syntax. Token keys are
 * dot-delimited. Setting `value` to `null` removes the token.
 *
 * Component-level tokens (Tier 3) override theme tokens of the same key.
 *
 * @param payload.key - Dot-delimited token key (e.g. `"color.primary"`).
 * @param payload.value - The token value, or `null` to remove.
 */
registerHandler('theme.setToken', (state, payload) => {
  const { key, value } = payload as { key: string; value: unknown };
  if (!state.theme.tokens) state.theme.tokens = {};
  if (value === null) {
    delete state.theme.tokens[key];
  } else {
    state.theme.tokens[key] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Batch-set multiple design tokens in a single command.
 *
 * Merges the provided tokens into the existing token map. Does not remove
 * tokens not present in the payload -- use `theme.setToken` with `null`
 * to remove individual tokens.
 *
 * @param payload.tokens - Record of token keys to values.
 */
registerHandler('theme.setTokens', (state, payload) => {
  const { tokens } = payload as { tokens: Record<string, unknown> };
  if (!state.theme.tokens) state.theme.tokens = {};
  Object.assign(state.theme.tokens, tokens);
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a form-wide presentation default (Cascade Level 1).
 *
 * Defaults provide the baseline PresentationBlock properties that every
 * form item inherits unless overridden by a selector (Level 2) or a
 * per-item override (Level 3). Setting `value` to `null` removes the property.
 *
 * @param payload.property - The PresentationBlock property name (e.g. `"widget"`,
 *   `"labelPosition"`, `"cssClass"`).
 * @param payload.value - The default value, or `null` to remove.
 */
registerHandler('theme.setDefaults', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  if (!state.theme.defaults) state.theme.defaults = {};
  if (value === null) {
    delete state.theme.defaults[property];
  } else {
    state.theme.defaults[property] = value;
  }
  return { rebuildComponentTree: false };
});

// ── Selectors (Cascade Level 2) ─────────────────────────────────

/**
 * Add a pattern-based selector to the theme (Cascade Level 2).
 *
 * Selectors match items by `type` and/or `dataType` and apply a
 * PresentationBlock to all matching items. Selectors apply in document
 * order -- later selectors override earlier ones for the same property.
 *
 * The `match` object requires at least one of `type` or `dataType`.
 * The `apply` object is a PresentationBlock with the properties to set.
 *
 * @param payload.match - Criteria to match items against (type, dataType).
 * @param payload.apply - PresentationBlock properties to apply to matches.
 * @param payload.insertIndex - Position to insert at. Omit to append at end.
 */
registerHandler('theme.addSelector', (state, payload) => {
  const { match, apply, insertIndex } = payload as { match: unknown; apply: unknown; insertIndex?: number };
  if (!state.theme.selectors) state.theme.selectors = [];
  const selector = { match, apply };
  if (insertIndex !== undefined) {
    state.theme.selectors.splice(insertIndex, 0, selector);
  } else {
    state.theme.selectors.push(selector);
  }
  return { rebuildComponentTree: false };
});

/**
 * Update an existing selector's match criteria and/or apply block.
 *
 * Only the provided properties are updated; omitted properties are left
 * unchanged. This allows updating just the match or just the apply
 * independently.
 *
 * @param payload.index - Zero-based index of the selector to update.
 * @param payload.match - New match criteria (optional).
 * @param payload.apply - New PresentationBlock to apply (optional).
 * @throws Error if no selector exists at the given index.
 */
registerHandler('theme.setSelector', (state, payload) => {
  const { index, match, apply } = payload as { index: number; match?: unknown; apply?: unknown };
  if (!state.theme.selectors?.[index]) throw new Error(`Selector not found at index: ${index}`);
  const sel = state.theme.selectors[index] as any;
  if (match !== undefined) sel.match = match;
  if (apply !== undefined) sel.apply = apply;
  return { rebuildComponentTree: false };
});

/**
 * Remove a selector by index.
 *
 * @param payload.index - Zero-based index of the selector to remove.
 */
registerHandler('theme.deleteSelector', (state, payload) => {
  const { index } = payload as { index: number };
  if (!state.theme.selectors) return { rebuildComponentTree: false };
  state.theme.selectors.splice(index, 1);
  return { rebuildComponentTree: false };
});

/**
 * Swap a selector with its adjacent neighbor.
 *
 * Because selectors apply in document order (later wins), reordering
 * changes which selector's properties take precedence for overlapping matches.
 * No-ops silently if the move would go out of bounds.
 *
 * @param payload.index - Zero-based index of the selector to move.
 * @param payload.direction - `"up"` to swap with previous, `"down"` with next.
 */
registerHandler('theme.reorderSelector', (state, payload) => {
  const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
  if (!state.theme.selectors) return { rebuildComponentTree: false };
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= state.theme.selectors.length) return { rebuildComponentTree: false };
  [state.theme.selectors[index], state.theme.selectors[target]] =
    [state.theme.selectors[target], state.theme.selectors[index]];
  return { rebuildComponentTree: false };
});

// ── Per-Item Overrides (Cascade Level 3) ────────────────────────

/**
 * Set a single PresentationBlock property on a per-item override (Cascade Level 3).
 *
 * This is the highest-specificity cascade level. Overrides here are keyed by
 * the definition item's `key` and always take precedence over defaults (Level 1)
 * and selectors (Level 2).
 *
 * Setting `value` to `null` removes the property. If removing the property
 * leaves the item's PresentationBlock empty, the entire item entry is cleaned up.
 *
 * @param payload.itemKey - The definition item key to override.
 * @param payload.property - PresentationBlock property: `widget`, `widgetConfig`,
 *   `style`, `accessibility`, `fallback`, `labelPosition`, or `cssClass`.
 * @param payload.value - The value to set, or `null` to remove.
 */
registerHandler('theme.setItemOverride', (state, payload) => {
  const { itemKey, property, value } = payload as { itemKey: string; property: string; value: unknown };
  const items = ensureItems(state.theme);
  if (value === null) {
    if (items[itemKey]) {
      delete items[itemKey][property];
      if (Object.keys(items[itemKey]).length === 0) delete items[itemKey];
    }
  } else {
    const block = ensureItemBlock(state.theme, itemKey);
    block[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Remove the entire PresentationBlock for an item key.
 *
 * After deletion, the item falls back to selector matches (Level 2)
 * and form-wide defaults (Level 1) for its presentation.
 *
 * @param payload.itemKey - The definition item key whose overrides to remove.
 */
registerHandler('theme.deleteItemOverride', (state, payload) => {
  const { itemKey } = payload as { itemKey: string };
  const items = state.theme.items as Record<string, any>;
  if (items) delete items[itemKey];
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a single CSS property within a per-item style override.
 *
 * More ergonomic than replacing the entire style object via `setItemOverride`.
 * Values may contain `$token.key` references that resolve at render time.
 * Setting `value` to `null` removes the CSS property.
 *
 * @param payload.itemKey - The definition item key.
 * @param payload.property - CSS property name (e.g. `"backgroundColor"`, `"padding"`).
 * @param payload.value - CSS value (string or number), or `null` to remove.
 */
registerHandler('theme.setItemStyle', (state, payload) => {
  const { itemKey, property, value } = payload as { itemKey: string; property: string; value: unknown };
  const block = ensureItemBlock(state.theme, itemKey);
  if (!block.style) block.style = {};
  if (value === null) {
    delete block.style[property];
  } else {
    block.style[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a single widgetConfig property within a per-item override.
 *
 * Widget config properties are widget-specific options (e.g. `showCurrencySymbol`,
 * `placeholder`, `rows`). Setting `value` to `null` removes the property.
 *
 * @param payload.itemKey - The definition item key.
 * @param payload.property - Widget config property name.
 * @param payload.value - The config value, or `null` to remove.
 */
registerHandler('theme.setItemWidgetConfig', (state, payload) => {
  const { itemKey, property, value } = payload as { itemKey: string; property: string; value: unknown };
  const block = ensureItemBlock(state.theme, itemKey);
  if (!block.widgetConfig) block.widgetConfig = {};
  if (value === null) {
    delete block.widgetConfig[property];
  } else {
    block.widgetConfig[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a single accessibility property within a per-item override.
 *
 * Accessibility properties control ARIA attributes and live-region behavior
 * for assistive technologies.
 *
 * @param payload.itemKey - The definition item key.
 * @param payload.property - One of `"role"`, `"description"`, or `"liveRegion"`.
 * @param payload.value - The accessibility value (string), or `null` to remove.
 */
registerHandler('theme.setItemAccessibility', (state, payload) => {
  const { itemKey, property, value } = payload as { itemKey: string; property: string; value: unknown };
  const block = ensureItemBlock(state.theme, itemKey);
  if (!block.accessibility) block.accessibility = {};
  if (value === null) {
    delete block.accessibility[property];
  } else {
    block.accessibility[property] = value;
  }
  return { rebuildComponentTree: false };
});

// ── Page Layout ─────────────────────────────────────────────────
//
// Pages define a multi-page form layout. Each page has an id, title,
// optional description, and an array of regions. Regions use a 12-column
// grid system -- each region specifies a `key` (binding to a definition
// item), `span` (column width), and optional `start` (column offset).

/**
 * Add a new page to the theme's page layout.
 *
 * A page is a logical form section containing 12-column grid regions.
 * If `id` is omitted, a unique ID is auto-generated (`theme_page_N`).
 * New pages start with an empty regions array.
 *
 * @param payload.id - Unique page identifier. Auto-generated if omitted.
 * @param payload.title - Human-readable page title (defaults to empty string).
 * @param payload.description - Optional page description.
 * @param payload.insertIndex - Position to insert at. Omit to append at end.
 */
registerHandler('theme.addPage', (state, payload) => {
  const p = payload as { id?: string; title?: string; description?: string; insertIndex?: number };
  if (!state.theme.pages) state.theme.pages = [];
  const page: any = {
    id: p.id ?? `theme_page_${++pageCounter}`,
    title: p.title ?? '',
    regions: [],
  };
  if (p.description) page.description = p.description;
  if (p.insertIndex !== undefined) {
    (state.theme.pages as any[]).splice(p.insertIndex, 0, page);
  } else {
    (state.theme.pages as any[]).push(page);
  }
  return { rebuildComponentTree: false };
});

/**
 * Update a property on an existing page (e.g. `title` or `description`).
 *
 * @param payload.index - Zero-based index of the page in the pages array.
 * @param payload.property - The page property to set.
 * @param payload.value - The new value.
 * @throws Error if no page exists at the given index.
 */
registerHandler('theme.setPageProperty', (state, payload) => {
  const { index, property, value } = payload as { index: number; property: string; value: unknown };
  const pages = state.theme.pages as any[];
  if (!pages?.[index]) throw new Error(`Page not found at index: ${index}`);
  pages[index][property] = value;
  return { rebuildComponentTree: false };
});

/**
 * Delete a page by index.
 *
 * At least one page must remain -- deleting the last page throws an error.
 *
 * @param payload.index - Zero-based index of the page to delete.
 * @throws Error if attempting to delete the last remaining page.
 */
registerHandler('theme.deletePage', (state, payload) => {
  const { index } = payload as { index: number };
  const pages = state.theme.pages as any[];
  if (!pages) return { rebuildComponentTree: false };
  if (pages.length <= 1) throw new Error('Cannot delete the last page');
  pages.splice(index, 1);
  return { rebuildComponentTree: false };
});

/**
 * Swap a page with its adjacent neighbor to change page ordering.
 *
 * No-ops silently if the move would go out of bounds.
 *
 * @param payload.index - Zero-based index of the page to move.
 * @param payload.direction - `"up"` to swap with previous, `"down"` with next.
 */
registerHandler('theme.reorderPage', (state, payload) => {
  const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
  const pages = state.theme.pages as any[];
  if (!pages) return { rebuildComponentTree: false };
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= pages.length) return { rebuildComponentTree: false };
  [pages[index], pages[target]] = [pages[target], pages[index]];
  return { rebuildComponentTree: false };
});

/**
 * Add a 12-column grid region to a page.
 *
 * Regions define how definition items are laid out within a page. Each region
 * binds to a definition item via `key`, and controls its column span and
 * optional start offset within the 12-column grid.
 *
 * @param payload.pageId - The page to add the region to.
 * @param payload.key - Definition item key this region binds to.
 * @param payload.span - Number of columns this region spans (1-12).
 * @param payload.start - Starting column offset (0-based).
 * @param payload.insertIndex - Position within the page's region array. Omit to append.
 * @throws Error if the page is not found.
 */
registerHandler('theme.addRegion', (state, payload) => {
  const { pageId, key, span, start, insertIndex } = payload as {
    pageId: string; key?: string; span?: number; start?: number; insertIndex?: number;
  };
  const page = findPage(state.theme, pageId);
  if (!page.regions) page.regions = [];
  const region: any = {};
  if (key) region.key = key;
  if (span !== undefined) region.span = span;
  if (start !== undefined) region.start = start;
  if (insertIndex !== undefined) {
    page.regions.splice(insertIndex, 0, region);
  } else {
    page.regions.push(region);
  }
  return { rebuildComponentTree: false };
});

/**
 * Update a property on an existing region (e.g. `span`, `start`, `responsive`).
 *
 * @param payload.pageId - The page containing the region.
 * @param payload.regionIndex - Zero-based index of the region within the page.
 * @param payload.property - The region property to update.
 * @param payload.value - The new value.
 * @throws Error if the page or region is not found.
 */
registerHandler('theme.setRegionProperty', (state, payload) => {
  const { pageId, regionIndex, property, value } = payload as {
    pageId: string; regionIndex: number; property: string; value: unknown;
  };
  const page = findPage(state.theme, pageId);
  if (!page.regions?.[regionIndex]) throw new Error('Region not found');
  page.regions[regionIndex][property] = value;
  return { rebuildComponentTree: false };
});

/**
 * Remove a region from a page by index.
 *
 * @param payload.pageId - The page containing the region.
 * @param payload.regionIndex - Zero-based index of the region to remove.
 * @throws Error if the page is not found.
 */
registerHandler('theme.deleteRegion', (state, payload) => {
  const { pageId, regionIndex } = payload as { pageId: string; regionIndex: number };
  const page = findPage(state.theme, pageId);
  if (!page.regions) return { rebuildComponentTree: false };
  page.regions.splice(regionIndex, 1);
  return { rebuildComponentTree: false };
});

/**
 * Swap a region with its adjacent neighbor within a page.
 *
 * No-ops silently if the move would go out of bounds.
 *
 * @param payload.pageId - The page containing the region.
 * @param payload.regionIndex - Zero-based index of the region to move.
 * @param payload.direction - `"up"` to swap with previous, `"down"` with next.
 * @throws Error if the page is not found.
 */
registerHandler('theme.reorderRegion', (state, payload) => {
  const { pageId, regionIndex, direction } = payload as {
    pageId: string; regionIndex: number; direction: 'up' | 'down';
  };
  const page = findPage(state.theme, pageId);
  if (!page.regions) return { rebuildComponentTree: false };
  const target = direction === 'up' ? regionIndex - 1 : regionIndex + 1;
  if (target < 0 || target >= page.regions.length) return { rebuildComponentTree: false };
  [page.regions[regionIndex], page.regions[target]] = [page.regions[target], page.regions[regionIndex]];
  return { rebuildComponentTree: false };
});

/**
 * Change a page's unique identifier.
 *
 * Note: cross-artifact references to the old page ID (e.g. navigation targets)
 * are rewritten as part of post-dispatch normalization.
 *
 * @param payload.pageId - The current page ID.
 * @param payload.newId - The new page ID.
 * @throws Error if the page is not found.
 */
registerHandler('theme.renamePage', (state, payload) => {
  const { pageId, newId } = payload as { pageId: string; newId: string };
  const page = findPage(state.theme, pageId);
  page.id = newId;
  return { rebuildComponentTree: false };
});

/**
 * Change which definition item key a region is bound to.
 *
 * This updates the region's definition-item binding, controlling which
 * form item is rendered in this grid position.
 *
 * @param payload.pageId - The page containing the region.
 * @param payload.regionIndex - Zero-based index of the region.
 * @param payload.newKey - The new definition item key to bind to.
 * @throws Error if the page or region is not found.
 */
registerHandler('theme.setRegionKey', (state, payload) => {
  const { pageId, regionIndex, newKey } = payload as { pageId: string; regionIndex: number; newKey: string };
  const page = findPage(state.theme, pageId);
  if (!page.regions?.[regionIndex]) throw new Error('Region not found');
  page.regions[regionIndex].key = newKey;
  return { rebuildComponentTree: false };
});

/**
 * Bulk replace the entire pages array.
 *
 * Intended for import scenarios. For interactive editing, prefer the
 * granular `addPage`, `setPageProperty`, `deletePage`, `addRegion`, etc.
 * commands which produce cleaner undo history.
 *
 * @param payload.pages - The complete pages array to set.
 */
registerHandler('theme.setPages', (state, payload) => {
  const { pages } = payload as { pages: unknown[] };
  state.theme.pages = pages;
  return { rebuildComponentTree: false };
});

// ── Document-Level ──────────────────────────────────────────────

/**
 * Define or remove a named responsive breakpoint.
 *
 * Breakpoints are named viewport-width thresholds (e.g. `tablet: 768`,
 * `desktop: 1024`) used by the renderer to switch between responsive
 * style variants and layout configurations. Setting `minWidth` to `null`
 * removes the breakpoint.
 *
 * Theme breakpoints are the canonical set; component breakpoints are
 * synced from theme unless independently overridden.
 *
 * @param payload.name - Breakpoint name (e.g. `"tablet"`, `"desktop"`).
 * @param payload.minWidth - Minimum viewport width in pixels, or `null` to remove.
 */
registerHandler('theme.setBreakpoint', (state, payload) => {
  const { name, minWidth } = payload as { name: string; minWidth: number | null };
  if (!state.theme.breakpoints) state.theme.breakpoints = {};
  if (minWidth === null) {
    delete state.theme.breakpoints[name];
  } else {
    state.theme.breakpoints[name] = minWidth;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set the list of external CSS stylesheet URLs to load at render time.
 *
 * Replaces the entire stylesheets array.
 *
 * @param payload.urls - Array of CSS URLs.
 */
registerHandler('theme.setStylesheets', (state, payload) => {
  const { urls } = payload as { urls: string[] };
  state.theme.stylesheets = urls;
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a top-level theme document metadata property.
 *
 * Applicable properties include: `url`, `version`, `name`, `title`,
 * `description`, `platform`. Setting `value` to `null` removes the property.
 *
 * @param payload.property - The top-level property name.
 * @param payload.value - The new value, or `null` to remove.
 */
registerHandler('theme.setDocumentProperty', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  if (value === null) {
    delete (state.theme as any)[property];
  } else {
    (state.theme as any)[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a document-level `x-` extension property on the theme.
 *
 * Extension keys MUST be `x-` prefixed. Setting `value` to `null` removes
 * the extension property.
 *
 * @param payload.key - Extension key (must start with `"x-"`).
 * @param payload.value - The extension value, or `null` to remove.
 */
registerHandler('theme.setExtension', (state, payload) => {
  const { key, value } = payload as { key: string; value: unknown };
  if (value === null) {
    delete (state.theme as any)[key];
  } else {
    (state.theme as any)[key] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or clear the `targetDefinition.compatibleVersions` constraint.
 *
 * This declares which definition versions this theme is compatible with,
 * without affecting the auto-synced `targetDefinition.url` (which is
 * always kept in sync with `definition.url` by post-dispatch normalization).
 *
 * @param payload.compatibleVersions - Semver range string, or `null` to clear.
 */
registerHandler('theme.setTargetCompatibility', (state, payload) => {
  const { compatibleVersions } = payload as { compatibleVersions: string };
  if (!state.theme.targetDefinition) {
    state.theme.targetDefinition = { url: '' };
  }
  state.theme.targetDefinition.compatibleVersions = compatibleVersions;
  return { rebuildComponentTree: false };
});
