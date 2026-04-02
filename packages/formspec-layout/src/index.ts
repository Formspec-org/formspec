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
    setTailwindMerge,
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
export { resolveToken, emitMergedThemeCssVars } from './tokens.js';

// Responsive breakpoint merging
export { resolveResponsiveProps } from './responsive.js';

// Parameter interpolation (custom component expansion)
export { interpolateParams } from './params.js';

// Default component mapping
export { getDefaultComponent } from './defaults.js';

// Widget vocabulary — canonical source of truth for widget ↔ component mappings
export {
    widgetTokenToComponent,
    KNOWN_COMPONENT_TYPES,
    SPEC_WIDGET_TO_COMPONENT,
    COMPONENT_TO_HINT,
    COMPATIBILITY_MATRIX,
} from './widget-vocabulary.js';

// Form presentation merge (definition + component document)
export { mergeFormPresentationForPlanning } from './form-presentation.js';

// Layout planner
export { planComponentTree, planDefinitionFallback, resetNodeIdCounter, planContains, ensureSubmitButton } from './planner.js';
export { resolvePageSequence } from './page-sequence.js';
export type { PageSequenceEntry } from './page-sequence.js';

// Anchored overlays (Modal / Popover positioning)
export {
    positionPopupNearTrigger,
    clearPopupFixedPosition,
    POPUP_EDGE_PADDING,
    POPUP_TRIGGER_GAP,
    MODAL_FIRST_FOCUSABLE_SELECTOR,
} from './popup-position.js';
export type { PopupPlacement } from './popup-position.js';

// Types
export type { LayoutNode, PlanContext } from './types.js';
