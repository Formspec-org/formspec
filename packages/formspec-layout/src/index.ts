/**
 * formspec-layout — Pure layout planning utilities for Formspec.
 *
 * Provides theme cascade resolution, token resolution, responsive breakpoint
 * merging, default component mapping, and parameter interpolation. All
 * functions are pure (no DOM, no signals, no side effects beyond warnings).
 *
 * @module
 */

// Theme cascade
export {
    resolvePresentation,
    resolveWidget,
} from './theme-resolver.js';
export type {
    ThemeDocument,
    PresentationBlock,
    ItemDescriptor,
    AccessibilityBlock,
    ThemeSelector,
    SelectorMatch,
    Tier1Hints,
    FormspecDataType,
    Page,
    Region,
    LayoutHints,
    StyleHints,
} from './theme-resolver.js';

// Token resolution
export { resolveToken } from './tokens.js';

// Responsive breakpoint merging
export { resolveResponsiveProps } from './responsive.js';

// Parameter interpolation (custom component expansion)
export { interpolateParams } from './params.js';

// Default component mapping
export { getDefaultComponent } from './defaults.js';
export { widgetTokenToComponent } from './widget-vocabulary.js';

// Layout planner
export { planComponentTree, planDefinitionFallback, resetNodeIdCounter } from './planner.js';

// Types
export type { LayoutNode, PlanContext } from './types.js';
