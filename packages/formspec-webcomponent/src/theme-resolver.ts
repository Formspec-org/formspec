/**
 * Theme cascade resolver.
 *
 * Resolves the effective PresentationBlock for a given item by merging
 * the 3-level theme cascade (defaults -> selectors -> items) on top of
 * Tier 1 definition hints.
 *
 * Full precedence (low to high):
 *   Tier 1 formPresentation -> Tier 1 item.presentation
 *     -> theme defaults -> matching selectors (doc order) -> theme items[key]
 */

// ── Shared Types ────────────────────────────────────────────────────

/** All dataType values defined in the schema's SelectorMatch and definition. */
export type FormspecDataType =
    | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
    | 'date' | 'dateTime' | 'time' | 'uri'
    | 'attachment' | 'choice' | 'multiChoice' | 'money';

// ── Theme Types ─────────────────────────────────────────────────────

export interface AccessibilityBlock {
    role?: string;
    description?: string;
    liveRegion?: 'off' | 'polite' | 'assertive';
}

export interface PresentationBlock {
    widget?: string;
    widgetConfig?: Record<string, unknown>;
    labelPosition?: 'top' | 'start' | 'hidden';
    style?: Record<string, string | number>;
    accessibility?: AccessibilityBlock;
    fallback?: string[];
    cssClass?: string | string[];
}

export interface SelectorMatch {
    type?: 'group' | 'field' | 'display';
    dataType?: FormspecDataType;
}

export interface ThemeSelector {
    match: SelectorMatch;
    apply: PresentationBlock;
}

export interface Region {
    key: string;
    span?: number;
    start?: number;
    responsive?: Record<string, { span?: number; start?: number; hidden?: boolean }>;
}

export interface Page {
    id: string;
    title: string;
    description?: string;
    regions?: Region[];
}

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

export interface ItemDescriptor {
    key: string;
    type: 'group' | 'field' | 'display';
    dataType?: FormspecDataType;
}

export interface LayoutHints {
    flow?: 'stack' | 'grid' | 'inline';
    columns?: number;
    colSpan?: number;
    newRow?: boolean;
    collapsible?: boolean;
    collapsedByDefault?: boolean;
    page?: string;
}

export interface StyleHints {
    emphasis?: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
    size?: 'compact' | 'default' | 'large';
}

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
        merged.widgetConfig = { ...merged.widgetConfig, ...higher.widgetConfig };
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
 * Resolve the effective PresentationBlock for a single item.
 *
 * Cascade order (each level overrides the previous):
 *   1. Tier 1 form-wide presentation hints (formPresentation) — lowest
 *   2. Tier 1 per-item presentation hints (item.presentation)
 *   3. Theme defaults
 *   4. Theme selectors (document order, later overrides earlier)
 *   5. Theme items[key] — highest
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
 * Resolve a widget for an item, considering the theme's widget preference,
 * fallback chain, and the component registry's available components.
 *
 * Returns the widget type string to use, or null if theme doesn't specify one.
 * Emits a warning when the preferred widget and all fallbacks are unavailable.
 */
export function resolveWidget(
    presentation: PresentationBlock,
    isAvailable: (type: string) => boolean
): string | null {
    if (!presentation.widget) return null;

    // Try the preferred widget first
    if (isAvailable(presentation.widget)) return presentation.widget;

    // Try fallback chain
    if (presentation.fallback) {
        for (const fb of presentation.fallback) {
            if (isAvailable(fb)) return fb;
        }
    }

    // Theme widget unavailable, no fallback matched — emit diagnostic per spec §7
    const tried = [presentation.widget, ...(presentation.fallback || [])].join(', ');
    console.warn(`Theme widget unavailable: tried [${tried}]. Falling back to default.`);
    return null;
}
