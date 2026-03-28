/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
/**
 * Criteria for which items this selector applies to. MUST contain at least one of 'type' or 'dataType'. When both are present, an item must satisfy both (AND semantics).
 */
export type SelectorMatch = {
  [k: string]: unknown;
} & {
  /**
   * Match items of this structural type. 'field': data-capture items with a dataType. 'group': container items with children, optionally repeatable. 'display': read-only content items (headings, instructions) with no data or children.
   */
  type?: 'group' | 'field' | 'display';
  /**
   * Match field items of this dataType. Only applicable to items with type 'field'. The 13 core dataTypes cover all Formspec field varieties.
   */
  dataType?:
    | 'string'
    | 'text'
    | 'integer'
    | 'decimal'
    | 'boolean'
    | 'date'
    | 'dateTime'
    | 'time'
    | 'uri'
    | 'attachment'
    | 'choice'
    | 'multiChoice'
    | 'money';
};
/**
 * A Formspec Theme document — a sidecar JSON file that controls the visual presentation of a Formspec Definition without modifying it. A Theme binds to a Definition by URL, overrides inline Tier 1 presentation hints through a three-level cascade (defaults → selectors → item overrides), assigns widgets with typed configuration and fallback chains, defines page layout on a 12-column grid, and provides design tokens for visual consistency. Multiple Theme documents MAY target the same Definition, enabling platform-specific rendering (web, mobile, PDF, kiosk). A Theme MUST NOT affect data collection, validation, or behavioral semantics — it controls only how items are displayed.
 */
export interface ThemeDocument {
  /**
   * Theme specification version. MUST be '1.0'.
   */
  $formspecTheme: '1.0';
  /**
   * Canonical identifier for this theme. Stable across theme versions — the pair (url, version) SHOULD be globally unique.
   */
  url?: string;
  /**
   * Version of this theme document. SemVer is RECOMMENDED. The pair (url, version) SHOULD be unique across all published theme versions.
   */
  version: string;
  /**
   * Machine-friendly short identifier for programmatic use.
   */
  name?: string;
  /**
   * Human-readable display name for the theme.
   */
  title?: string;
  /**
   * Human-readable description of the theme's purpose and target audience.
   */
  description?: string;
  targetDefinition: TargetDefinition;
  /**
   * Target rendering platform. Informational — processors that do not recognize a platform value SHOULD apply the theme regardless. Well-known values: 'web' (desktop/mobile browsers), 'mobile' (native apps), 'pdf' (PDF rendering), 'print' (print-optimized), 'kiosk' (public terminals), 'universal' (no platform assumptions, implicit default).
   */
  platform?: string;
  tokens?: Tokens;
  defaults?: PresentationBlock;
  /**
   * Cascade level 2: type/dataType-based presentation overrides. Each selector has a 'match' (criteria) and 'apply' (PresentationBlock). Selectors are evaluated in document order — all matching selectors apply, with later matches overriding earlier ones per-property. Overrides defaults (level 1); overridden by items (level 3).
   */
  selectors?: Selector[];
  /**
   * Cascade level 3 (highest theme specificity): per-item overrides keyed by the item's 'key' from the Definition. Overrides all lower cascade levels. Item keys that do not correspond to any item in the target Definition SHOULD produce a warning but MUST NOT cause failure.
   */
  items?: {
    [k: string]: PresentationBlock;
  };
  /**
   * Page layout — ordered list of pages grouping items into logical sections with a 12-column grid. When absent, the renderer walks the Definition's item tree top-to-bottom without page grouping. Items not referenced by any region on any page SHOULD be rendered after all pages in default order. The cascade (defaults/selectors/items) still applies regardless of page layout.
   */
  pages?: PageLayout[];
  breakpoints?: Breakpoints;
  /**
   * Extension namespace for platform-specific or vendor-specific metadata. All keys MUST be x- prefixed. Processors MUST ignore unrecognized extensions. Extensions MUST NOT alter core presentation semantics.
   */
  extensions?: {};
  /**
   * External CSS stylesheet URIs. Web renderers SHOULD load these before rendering the form. Loaded in array order — later sheets take CSS precedence over earlier sheets. Renderers MUST NOT fail if a stylesheet cannot be loaded; they SHOULD warn and continue. Non-web renderers (PDF, native) MAY ignore stylesheets. Subject to host application security policy (CSP, CORS).
   */
  stylesheets?: string[];
}
/**
 * Binding to the target Formspec Definition and compatible version range. The theme will only be applied to Definitions matching this target. If compatibleVersions is present and the Definition version falls outside the range, the processor SHOULD warn and MAY fall back to Tier 1 hints only (null theme). The processor MUST NOT fail on a version mismatch.
 */
export interface TargetDefinition {
  /**
   * Canonical URL of the target Definition (its url property).
   */
  url: string;
  /**
   * Semver range expression using node/npm-style range syntax describing which Definition versions this document supports. When absent, compatible with any version.
   */
  compatibleVersions?: string;
}
/**
 * Design tokens — named values (colors, spacing, typography, borders) that promote visual consistency. Defined once here, referenced throughout the theme via '$token.<key>' syntax in style and widgetConfig string values. Token keys use dot-delimited category prefixes (e.g., 'color.primary', 'spacing.md'). Values MUST be strings or numbers. Token references MUST NOT be recursive.
 */
export interface Tokens {
  [k: string]: string | number;
}
/**
 * Cascade level 1 (lowest theme specificity): baseline PresentationBlock applied to every item before selectors or per-item overrides. Sets the form-wide visual baseline. Overrides Tier 1 inline presentation hints (level 0) and formPresentation globals (level -1). Overridden by selectors (level 2) and items (level 3). Merge is shallow per-property — nested objects (widgetConfig, style, accessibility) are replaced as a whole, not deep-merged. Exception: cssClass uses union semantics across all levels.
 */
export interface PresentationBlock {
  /**
   * Widget identifier — the UI control to render for this item. Uses the same vocabulary as Tier 1 widgetHint. Required widgets (MUST be supported): textInput, textarea, numberInput, checkbox, datePicker, dropdown, checkboxGroup, fileUpload, moneyInput. Progressive widgets (SHOULD be supported, with fallback): slider, stepper, rating, toggle, yesNo, radio, autocomplete, segmented, likert, multiSelect, richText, password, color, urlInput, dateInput, dateTimePicker, dateTimeInput, timePicker, timeInput, camera, signature. Group widgets: section, card, accordion, tab. Display widgets: heading, paragraph, divider, banner. Custom widgets MUST use 'x-' prefix (e.g., 'x-map-picker'). Set to 'none' to suppress a widget inherited from a lower cascade level.
   */
  widget?: string;
  /**
   * Widget-specific configuration. Properties depend on the widget. Renderers MUST ignore unrecognized keys. Fallback resolution does NOT carry widgetConfig forward — each fallback widget uses its own default configuration. Well-known configs by widget: textInput (maxLength, inputMode), textarea (rows, maxRows, autoResize), numberInput (showStepper, locale), datePicker (format, minDate, maxDate), dropdown (searchable, placeholder), checkboxGroup (columns, maxVisible), fileUpload (accept, maxSizeMb, preview), moneyInput (showCurrencySymbol, locale), slider (min, max, step, showTicks, showValue), toggle (onLabel, offLabel), radio (direction, columns), richText (toolbar), signature (strokeColor, height).
   */
  widgetConfig?: {
    [k: string]: unknown;
  };
  /**
   * Label placement relative to the item. 'top': label above the input (most common). 'start': label on the leading side — left in LTR locales, right in RTL locales. 'hidden': label visually hidden but MUST still be present in accessible markup for screen readers.
   */
  labelPosition?: 'top' | 'start' | 'hidden';
  /**
   * Flat style overrides as key-value pairs. Keys are renderer-interpreted style names (e.g., CSS property names in camelCase). String values may contain $token references (e.g., '$token.color.primary') which are resolved at theme-application time. Replaced as a whole during cascade merge — not deep-merged with lower levels.
   */
  style?: {
    [k: string]: string | number;
  };
  accessibility?: AccessibilityBlock;
  /**
   * Ordered list of fallback widget identifiers. When a renderer does not support the primary widget, it MUST try each fallback in order and use the first it supports. If no widget in the chain is supported, the renderer MUST use its default widget for the item's dataType. Fallback resolution does NOT carry widgetConfig forward — each fallback widget uses its own default configuration. Custom widgets (x- prefixed) MUST always include a fallback chain ending with a standard widget.
   */
  fallback?: string[];
  /**
   * CSS class name(s) applied to matching items. UNIQUE CASCADE BEHAVIOR: unlike all other PresentationBlock properties, cssClass uses union semantics — classes accumulate across cascade levels (defaults + selectors + item overrides) with duplicates removed. Order preserved: defaults first, then selectors in document order, then item overrides. This ensures adding a class at one level does not remove classes from other levels.
   */
  cssClass?: string | string[];
}
/**
 * Accessibility metadata for the item. Replaced as a whole during cascade merge — not deep-merged with lower levels.
 */
export interface AccessibilityBlock {
  /**
   * ARIA role override (e.g. 'region', 'group', 'status'). Replaces renderer-default role.
   */
  role?: string;
  /**
   * Accessible description text. Renderers SHOULD wire to aria-describedby.
   */
  description?: string;
  /**
   * Sets aria-live on root element. Renderers MUST NOT apply live-region semantics unless explicitly set.
   */
  liveRegion?: 'off' | 'polite' | 'assertive';
}
/**
 * A cascade level 2 rule: matches items by type and/or dataType and applies a PresentationBlock. Selectors are evaluated in document order. All matching selectors apply — later matches override earlier ones per-property (shallow merge). This enables layered styling: a broad type selector can set a baseline, and a narrower dataType selector can refine it.
 *
 * This interface was referenced by `ThemeDocument`'s JSON-Schema
 * via the `definition` "Selector".
 */
export interface Selector {
  match: SelectorMatch;
  apply: PresentationBlock;
}
/**
 * A logical page layout grouping items into a section with a title and a 12-column grid. Pages define navigation structure (wizard steps, tabs, or sections). Each page contains regions that assign Definition items to grid positions.
 *
 * This interface was referenced by `ThemeDocument`'s JSON-Schema
 * via the `definition` "PageLayout".
 */
export interface PageLayout {
  /**
   * Unique page identifier within this theme. Used for navigation and anchoring.
   */
  id: string;
  /**
   * Page title displayed in navigation controls (wizard step labels, tab headers, section headings).
   */
  title: string;
  /**
   * Optional page-level instructions or description displayed below the title.
   */
  description?: string;
  /**
   * Ordered list of regions assigning Definition items to grid positions on this page. A group key includes its entire subtree. Items not referenced by any region on any page SHOULD be rendered after all pages in default order.
   */
  regions?: Region[];
}
/**
 * Assigns a Definition item to a position on the page's 12-column grid. A region referencing a group key includes the group's entire subtree — layout within the group is controlled by the group's own Tier 1 presentation.layout, not by the page grid. A repeatable group renders all repeat instances within its region. Unknown keys SHOULD produce a warning but MUST NOT cause failure.
 *
 * This interface was referenced by `ThemeDocument`'s JSON-Schema
 * via the `definition` "Region".
 */
export interface Region {
  /**
   * Item key from the target Definition. A group key includes its entire subtree (all children and nested groups).
   */
  key: string;
  /**
   * Number of grid columns this region occupies (1–12). Default: 12 (full width). Two span-6 regions create a two-column layout.
   */
  span?: number;
  /**
   * Grid column start position (1–12). When absent, the region follows the previous region in natural flow. Use to create gaps or explicit positioning.
   */
  start?: number;
  /**
   * Breakpoint-keyed responsive overrides. Keys are breakpoint names defined in the top-level 'breakpoints' object. Each override can set span, start, or hidden for that viewport size.
   */
  responsive?: {
    [k: string]: {
      /**
       * Override column span at this breakpoint.
       */
      span?: number;
      /**
       * Override column start at this breakpoint.
       */
      start?: number;
      /**
       * Hide this region entirely at this breakpoint.
       */
      hidden?: boolean;
    };
  };
}
/**
 * Named responsive breakpoints as min-width pixel values. Referenced by regions' 'responsive' objects to override span, start, or visibility at different viewport sizes. Processors that do not support responsive layouts SHOULD use the base span and start values.
 */
export interface Breakpoints {
  [k: string]: number;
}
