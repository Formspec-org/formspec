/**
 * Theme cascade resolver.
 *
 * Resolves the effective {@link PresentationBlock} for a given item by
 * merging the 5-level theme cascade:
 *
 *   1. Tier 1 formPresentation (lowest)
 *   2. Tier 1 item.presentation
 *   3. Theme defaults
 *   4. Matching theme selectors (document order)
 *   5. Theme items[key] (highest)
 *
 * Also provides {@link resolveWidget} for selecting the best available
 * widget from a preference + fallback chain.
 *
 * @module
 */

import { widgetTokenToComponent } from './widget-vocabulary.js';

// ── Shared Types ────────────────────────────────────────────────────

/** Union of all `dataType` values recognized by the Formspec schema for selector matching and field definitions. */
export type FormspecDataType =
    | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
    | 'date' | 'dateTime' | 'time' | 'uri'
    | 'attachment' | 'choice' | 'multiChoice' | 'money';

// ── Theme Types ─────────────────────────────────────────────────────

/** ARIA-related presentation hints applied to a rendered element. */
export interface AccessibilityBlock {
    role?: string;
    description?: string;
    liveRegion?: 'off' | 'polite' | 'assertive';
}

/** Merged presentation directives for a single item: widget choice, label position, styles, CSS classes, accessibility, and fallback chain. */
export interface PresentationBlock {
    widget?: string;
    widgetConfig?: Record<string, unknown>;
    labelPosition?: 'top' | 'start' | 'hidden';
    style?: Record<string, string | number>;
    accessibility?: AccessibilityBlock;
    fallback?: string[];
    cssClass?: string | string[];
}

/** Criteria for a theme selector rule: matches items by type, dataType, or both. */
export interface SelectorMatch {
    type?: 'group' | 'field' | 'display';
    dataType?: FormspecDataType;
}

/** A theme selector rule pairing a {@link SelectorMatch} condition with a {@link PresentationBlock} to apply. */
export interface ThemeSelector {
    match: SelectorMatch;
    apply: PresentationBlock;
}

/** A named layout region within a page, with optional grid span/start and responsive overrides. */
export interface Region {
    key: string;
    span?: number;
    start?: number;
    responsive?: Record<string, { span?: number; start?: number; hidden?: boolean }>;
}

/** A page definition within a theme, used for wizard/tab page layouts with optional region grid. */
export interface Page {
    id: string;
    title: string;
    description?: string;
    regions?: Region[];
}

/** Top-level theme document: tokens, defaults, selectors, per-item overrides, pages, breakpoints, and stylesheets. */
export interface ThemeDocument {
    $formspecTheme: '1.0';
    version: string;
    targetDefinition: { url: string; compatibleVersions?: string };
    url?: string;
    name?: string;
    title?: string;
    description?: string;
    platform?: string;
    tokens?: Record<string, string | number>;
    defaults?: PresentationBlock;
    selectors?: ThemeSelector[];
    items?: Record<string, PresentationBlock>;
    pages?: Page[];
    breakpoints?: Record<string, number>;
    stylesheets?: string[];
    extensions?: Record<string, unknown>;
}

/** Lightweight identifier for a definition item, used as the input to the theme cascade resolver. */
export interface ItemDescriptor {
    key: string;
    type: 'group' | 'field' | 'display';
    dataType?: FormspecDataType;
}

/** Tier 1 layout hints from the definition: flow direction, grid columns, collapsibility, and page assignment. */
export interface LayoutHints {
    flow?: 'stack' | 'grid' | 'inline';
    columns?: number;
    colSpan?: number;
    newRow?: boolean;
    collapsible?: boolean;
    collapsedByDefault?: boolean;
    page?: string;
}

/** Tier 1 visual emphasis and sizing hints from the definition. */
export interface StyleHints {
    emphasis?: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
    size?: 'compact' | 'default' | 'large';
}

/** Definition-level (Tier 1) presentation hints that feed into the lowest two levels of the theme cascade. */
export interface Tier1Hints {
    /** Per-item presentation hints from the definition */
    itemPresentation?: {
        widgetHint?: string;
        layout?: LayoutHints;
        styleHints?: StyleHints;
    };
    /** Form-wide presentation defaults from the definition */
    formPresentation?: {
        labelPosition?: 'top' | 'start' | 'hidden';
        density?: 'compact' | 'comfortable' | 'spacious';
        pageMode?: 'single' | 'wizard' | 'tabs';
    };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Normalize cssClass to a flat string array. */
function normalizeCssClass(val: string | string[] | undefined): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.flatMap(c => c.split(/\s+/).filter(Boolean));
    return val.split(/\s+/).filter(Boolean);
}

function asRecord(val: unknown): Record<string, unknown> | null {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    return val as Record<string, unknown>;
}

/**
 * Merge two PresentationBlocks. `higher` overrides `lower` for scalar
 * properties (shallow merge). `cssClass` is unioned, not replaced.
 * `style`, `widgetConfig`, and `accessibility` are shallow-merged.
 */
function mergeBlocks(lower: PresentationBlock, higher: PresentationBlock): PresentationBlock {
    const merged: PresentationBlock = { ...lower };

    if (higher.widget !== undefined) merged.widget = higher.widget;
    if (higher.labelPosition !== undefined) merged.labelPosition = higher.labelPosition;
    if (higher.fallback !== undefined) merged.fallback = higher.fallback;

    // cssClass: union across cascade levels
    const lowerClasses = normalizeCssClass(merged.cssClass);
    const higherClasses = normalizeCssClass(higher.cssClass);
    if (higherClasses.length > 0) {
        const union = new Set([...lowerClasses, ...higherClasses]);
        merged.cssClass = [...union];
    }

    // Shallow-merge objects
    if (higher.widgetConfig !== undefined) {
        const lowerCfg = asRecord(merged.widgetConfig) || {};
        const higherCfg = asRecord(higher.widgetConfig) || {};
        const combined: Record<string, unknown> = { ...lowerCfg, ...higherCfg };

        // Support additive merge for `widgetConfig["x-classes"]` slot mappings.
        const lowerSlots = asRecord(lowerCfg['x-classes']);
        const higherSlots = asRecord(higherCfg['x-classes']);
        if (lowerSlots || higherSlots) {
            combined['x-classes'] = {
                ...(lowerSlots || {}),
                ...(higherSlots || {}),
            };
        }

        merged.widgetConfig = combined;
    }
    if (higher.style !== undefined) {
        merged.style = { ...merged.style, ...higher.style };
    }
    if (higher.accessibility !== undefined) {
        merged.accessibility = { ...merged.accessibility, ...higher.accessibility };
    }

    return merged;
}

/** Check if a selector matches an item descriptor. */
function selectorMatches(match: SelectorMatch, item: ItemDescriptor): boolean {
    // Schema requires at least one of type/dataType via anyOf.
    // Guard against empty match objects that slip past schema validation.
    if (match.type === undefined && match.dataType === undefined) return false;
    if (match.type !== undefined && match.type !== item.type) return false;
    if (match.dataType !== undefined && match.dataType !== item.dataType) return false;
    return true;
}

// ── Main Resolver ───────────────────────────────────────────────────

/**
 * Resolve the effective {@link PresentationBlock} for a single item by
 * merging five cascade levels (lowest to highest priority):
 *
 * 1. Tier 1 form-wide presentation hints (`formPresentation`)
 * 2. Tier 1 per-item presentation hints (`item.presentation`)
 * 3. Theme defaults
 * 4. Theme selectors (document order; later selectors override earlier)
 * 5. Theme `items[key]` overrides
 *
 * Scalar properties are replaced at each level. `cssClass` is unioned,
 * and `style`, `widgetConfig`, and `accessibility` are shallow-merged.
 *
 * @param theme - The active theme document, or `null`/`undefined` for no theme.
 * @param item  - Descriptor identifying the definition item (key, type, dataType).
 * @param tier1 - Optional Tier 1 hints from the definition (form-wide and per-item).
 * @returns The fully merged presentation block for the item.
 */
export function resolvePresentation(
    theme: ThemeDocument | null | undefined,
    item: ItemDescriptor,
    tier1?: Tier1Hints
): PresentationBlock {
    let result: PresentationBlock = {};

    // Level 1: Tier 1 form-wide hints (lowest priority)
    if (tier1?.formPresentation) {
        const fp = tier1.formPresentation;
        if (fp.labelPosition) result.labelPosition = fp.labelPosition;
    }

    // Level 2: Tier 1 per-item hints
    if (tier1?.itemPresentation) {
        const ip = tier1.itemPresentation;
        if (ip.widgetHint) result.widget = ip.widgetHint;
        // Map layout hints that have presentation equivalents
        if (ip.layout?.collapsible) {
            // Layout hints don't map directly to PresentationBlock properties,
            // but are available through the Tier1Hints for consumers
        }
    }

    if (!theme) return result;

    // Level 3: Theme defaults
    if (theme.defaults) {
        result = mergeBlocks(result, theme.defaults);
    }

    // Level 4: Theme selectors (document order)
    if (theme.selectors) {
        for (const selector of theme.selectors) {
            if (selectorMatches(selector.match, item)) {
                result = mergeBlocks(result, selector.apply);
            }
        }
    }

    // Level 5: Theme items[key] (highest priority)
    if (theme.items?.[item.key]) {
        result = mergeBlocks(result, theme.items[item.key]);
    }

    return result;
}

/**
 * Select the best available widget from a presentation block's preference
 * and fallback chain.
 *
 * Tries the preferred `widget` first, then each entry in `fallback` in order.
 * If none are available in the component registry, logs a warning (per Theme
 * spec section 7) and returns `null` so the caller can fall back to the default
 * component for the item's dataType.
 *
 * @param presentation - The resolved presentation block containing widget preference and fallback chain.
 * @param isAvailable  - Predicate that returns `true` when a component type string is registered.
 * @returns The first available widget type string, or `null` if the theme specifies no widget or none are registered.
 */
export function resolveWidget(
    presentation: PresentationBlock,
    isAvailable: (type: string) => boolean
): string | null {
    if (!presentation.widget) return null;

    // Try the preferred widget first
    const preferred = widgetTokenToComponent(presentation.widget);
    if (preferred && isAvailable(preferred)) return preferred;

    // Try fallback chain
    if (presentation.fallback) {
        for (const fb of presentation.fallback) {
            const fallback = widgetTokenToComponent(fb);
            if (fallback && isAvailable(fallback)) return fallback;
        }
    }

    // Theme widget unavailable, no fallback matched — emit diagnostic per spec §7
    const tried = [presentation.widget, ...(presentation.fallback || [])].join(', ');
    console.warn(`Theme widget unavailable: tried [${tried}]. Falling back to default.`);
    return null;
}
