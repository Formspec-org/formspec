/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
/**
 * Component subtree instantiated when this custom component is used.
 */
export type AnyComponent = {
  [k: string]: unknown;
} & {
  component: string;
};
/**
 * Ordered list of child components. Renderers MUST preserve array order.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "ChildrenArray".
 */
export type ChildrenArray = AnyComponent[];

/**
 * A Formspec Component Document per the Component Specification v1.0. Defines a Tier 3 parallel presentation tree of UI components bound to a Formspec Definition's items via slot binding. The component tree controls layout and widget selection but cannot override core behavioral semantics (required, relevant, readonly, calculate, constraint) from the Definition. Multiple Component Documents MAY target the same Definition for platform-specific presentations.
 */
export interface ComponentDocument {
  /**
   * Component specification version. MUST be '1.0'.
   */
  $formspecComponent: '1.0';
  /**
   * Canonical URI identifier for this Component Document.
   */
  url?: string;
  /**
   * Machine-friendly short identifier.
   */
  name?: string;
  /**
   * Human-readable name.
   */
  title?: string;
  /**
   * Human-readable description.
   */
  description?: string;
  /**
   * Version of this Component Document.
   */
  version: string;
  targetDefinition: TargetDefinition;
  breakpoints?: Breakpoints;
  tokens?: Tokens;
  /**
   * Registry of custom component templates. Keys are PascalCase names (MUST NOT collide with built-in names). Each template has params and a tree that is instantiated with {param} interpolation.
   */
  components?: {
    [k: string]: CustomComponentDef;
  };
  tree: AnyComponent;
  /**
   * This interface was referenced by `ComponentDocument`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Binding to the target Formspec Definition and optional compatibility range.
 */
export interface TargetDefinition {
  /**
   * Canonical URL of the target Definition (its url property).
   */
  url: string;
  /**
   * Semver range expression describing which Definition versions this document supports. When absent, compatible with any version.
   */
  compatibleVersions?: string;
}
/**
 * Named viewport breakpoints for responsive prop overrides. Keys are breakpoint names; values are minimum viewport widths in pixels. Mobile-first cascade: base props apply to all widths, then overrides merge in ascending order.
 */
export interface Breakpoints {
  [k: string]: number;
}
/**
 * Flat key-value map of design tokens. Referenced in style objects and token-able props via $token.key syntax. Tier 3 tokens override Tier 2 theme tokens of the same key.
 */
export interface Tokens {
  [k: string]: string | number;
}
/**
 * A reusable component template. Instantiated by using the registry key as the component value and providing params. Templates MUST NOT reference themselves (directly or indirectly).
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[A-Z][a-zA-Z0-9]*$".
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "CustomComponentDef".
 */
export interface CustomComponentDef {
  /**
   * Parameter names accepted by this template. Each name MUST match [a-zA-Z][a-zA-Z0-9_]*. Referenced in allowed string props via {paramName} interpolation.
   */
  params?: string[];
  tree: AnyComponent;
}
/**
 * Flat style map. Values MAY contain $token.path references (e.g. $token.color.primary). Not CSS — renderers map to platform equivalents.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "StyleMap".
 */
export interface StyleMap {
  [k: string]: string | number;
}
/**
 * Accessibility overrides applied to the component's root element. Supplements or replaces renderer defaults.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "AccessibilityBlock".
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
 * Breakpoint-keyed prop overrides. Keys are breakpoint names; values are objects of component-specific props to shallow-merge at that breakpoint. MUST NOT contain component, bind, when, children, or responsive.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "ResponsiveOverrides".
 */
export interface ResponsiveOverrides {
  [k: string]: unknown;
}
/**
 * Base properties shared by all component objects. Every component inherits these via $ref.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "ComponentBase".
 */
export interface ComponentBase {
  /**
   * Optional unique identifier for this node within the component tree. Used for locale string addressing ($component.<id>.prop), test selectors, and accessibility anchoring. When present, MUST be unique across the entire component tree document. Inside repeat templates (DataTable, Accordion), the id identifies the template node — all rendered instances share the same id.
   */
  id?: string;
  /**
   * Component type name. MUST be a built-in name or a key in the components registry.
   */
  component: string;
  /**
   * FEL boolean expression for conditional rendering. false/null hides the component and all children. Presentation-only — does NOT affect data (unlike Bind relevant which may clear data). When BOTH when and relevant apply: relevant=false always wins; when=false hides but preserves data.
   */
  when?: string;
  responsive?: ResponsiveOverrides;
  style?: StyleMap;
  accessibility?: AccessibilityBlock;
  /**
   * CSS class name(s) applied to root element. Additive to renderer-generated classes. Non-web renderers MAY ignore. Values MAY contain $token. references.
   */
  cssClass?: string | string[];
}
