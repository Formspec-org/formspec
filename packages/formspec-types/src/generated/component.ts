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
  component: string;
} & (
  | Page
  | Stack
  | Grid
  | Spacer
  | TextInput
  | NumberInput
  | DatePicker
  | Select
  | CheckboxGroup
  | Toggle
  | FileUpload
  | Heading
  | Text
  | Divider
  | Card
  | Collapsible
  | ConditionalGroup
  | Columns
  | Tabs
  | SubmitButton
  | Accordion
  | RadioGroup
  | MoneyInput
  | Slider
  | Rating
  | Signature
  | Alert
  | Badge
  | ProgressBar
  | Summary
  | ValidationSummary
  | DataTable
  | Panel
  | Modal
  | Popover
  | CustomComponentRef
);
/**
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "AnyComponent".
 */
export type AnyComponent1 = {
  component: string;
} & AnyComponent2;
export type AnyComponent2 =
  | Page
  | Stack
  | Grid
  | Spacer
  | TextInput
  | NumberInput
  | DatePicker
  | Select
  | CheckboxGroup
  | Toggle
  | FileUpload
  | Heading
  | Text
  | Divider
  | Card
  | Collapsible
  | ConditionalGroup
  | Columns
  | Tabs
  | SubmitButton
  | Accordion
  | RadioGroup
  | MoneyInput
  | Slider
  | Rating
  | Signature
  | Alert
  | Badge
  | ProgressBar
  | Summary
  | ValidationSummary
  | DataTable
  | Panel
  | Modal
  | Popover
  | CustomComponentRef;
/**
 * Ordered list of child components. Renderers MUST preserve array order.
 *
 * This interface was referenced by `ComponentDocument`'s JSON-Schema
 * via the `definition` "ChildrenArray".
 */
export type ChildrenArray = AnyComponent1[];
/**
 * Root component node of the presentation tree. MUST be a single component object (wrap multiple children in Stack or Page).
 */
export type AnyComponent3 = {
  component: string;
} & (
  | Page
  | Stack
  | Grid
  | Spacer
  | TextInput
  | NumberInput
  | DatePicker
  | Select
  | CheckboxGroup
  | Toggle
  | FileUpload
  | Heading
  | Text
  | Divider
  | Card
  | Collapsible
  | ConditionalGroup
  | Columns
  | Tabs
  | SubmitButton
  | Accordion
  | RadioGroup
  | MoneyInput
  | Slider
  | Rating
  | Signature
  | Alert
  | Badge
  | ProgressBar
  | Summary
  | ValidationSummary
  | DataTable
  | Panel
  | Modal
  | Popover
  | CustomComponentRef
);

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
  tree: AnyComponent3;
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
 * Top-level page/section container. In a multi-step form, each Page is one step. Pages MAY also be used standalone within a Stack for sectioned single-page forms.
 */
export interface Page {
  component: 'Page';
  /**
   * Page heading displayed at the top of the section.
   */
  title?: string;
  /**
   * Subtitle or description text rendered below the title.
   */
  description?: string;
  children?: ChildrenArray;
}
/**
 * Flexbox stacking container arranging children vertically or horizontally. The most common layout primitive — typically used as the root component.
 */
export interface Stack {
  component: 'Stack';
  /**
   * Stack axis.
   */
  direction?: 'vertical' | 'horizontal';
  /**
   * Spacing between children. String for CSS values or $token refs, number for pixels.
   */
  gap?: string | number;
  /**
   * Cross-axis alignment.
   */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /**
   * Whether children wrap to new lines when direction is horizontal.
   */
  wrap?: boolean;
  children?: ChildrenArray;
}
/**
 * Multi-column grid layout distributing children across columns in source order, wrapping to new rows as needed.
 */
export interface Grid {
  component: 'Grid';
  /**
   * Column count (integer) or CSS grid-template-columns value (string, e.g. '1fr 2fr 1fr').
   */
  columns?: string | number;
  /**
   * Spacing between grid cells.
   */
  gap?: string | number;
  /**
   * Vertical spacing between rows. Inherits gap if absent.
   */
  rowGap?: string | number;
  children?: ChildrenArray;
}
/**
 * Empty spacing element inserting visual space between siblings. Leaf component — no children, no binding.
 */
export interface Spacer {
  component: 'Spacer';
  /**
   * Space amount. String for CSS/$token values, number for pixels.
   */
  size?: string | number;
}
/**
 * Single-line or multi-line text input. Default input for string-type fields. When maxLines > 1, renders as textarea.
 */
export interface TextInput {
  component: 'TextInput';
  /**
   * Item key from the target Definition. Renderer inherits label, required, readonly, relevant, and validation.
   */
  bind: string;
  /**
   * Placeholder text displayed when the field is empty.
   */
  placeholder?: string;
  /**
   * Maximum visible lines. 1 = single-line input, >1 = multi-line textarea.
   */
  maxLines?: number;
  /**
   * Input mode hint for virtual keyboards.
   */
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'search';
  /**
   * Static text rendered before the input (e.g. 'https://').
   */
  prefix?: string;
  /**
   * Static text rendered after the input (e.g. '.com').
   */
  suffix?: string;
}
/**
 * Numeric input with optional step controls. Suitable for integers, decimals, and monetary values (when paired with prefix/suffix).
 */
export interface NumberInput {
  component: 'NumberInput';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Increment/decrement step value.
   */
  step?: number;
  /**
   * Minimum allowed value.
   */
  min?: number;
  /**
   * Maximum allowed value.
   */
  max?: number;
  /**
   * Whether to show increment/decrement buttons.
   */
  showStepper?: boolean;
  /**
   * Locale for number formatting (e.g. 'en-US').
   */
  locale?: string;
}
/**
 * Date, datetime, or time picker. Mode is automatically determined by the bound item's dataType (date → date picker, dateTime → date+time, time → time picker).
 */
export interface DatePicker {
  component: 'DatePicker';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Display format hint (e.g. 'MM/DD/YYYY'). Does not affect stored value (always ISO 8601).
   */
  format?: string;
  /**
   * Earliest selectable date (ISO 8601).
   */
  minDate?: string;
  /**
   * Latest selectable date (ISO 8601).
   */
  maxDate?: string;
  /**
   * Whether to include time selection (relevant for dateTime).
   */
  showTime?: boolean;
}
/**
 * Dropdown selection control. Options are read from the bound item's options array or optionSet reference in the Definition.
 */
export interface Select {
  component: 'Select';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Enable type-ahead search/filtering of options.
   */
  searchable?: boolean;
  /**
   * Placeholder text when no option is selected.
   */
  placeholder?: string;
  /**
   * Whether the user can clear the selection to null.
   */
  clearable?: boolean;
}
/**
 * Group of checkboxes for multi-select fields. Options are read from the bound item's options or optionSet.
 */
export interface CheckboxGroup {
  component: 'CheckboxGroup';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Number of columns to arrange checkboxes in.
   */
  columns?: number;
  /**
   * Whether to display a 'Select All' control.
   */
  selectAll?: boolean;
}
/**
 * Boolean switch/toggle control for yes/no, on/off, or true/false fields.
 */
export interface Toggle {
  component: 'Toggle';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Label displayed when toggle is true.
   */
  onLabel?: string;
  /**
   * Label displayed when toggle is false.
   */
  offLabel?: string;
}
/**
 * File upload control for attachment-type fields. Supports single or multiple file selection with optional type and size constraints.
 */
export interface FileUpload {
  component: 'FileUpload';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Accepted MIME types (comma-separated, e.g. 'image/*,application/pdf').
   */
  accept?: string;
  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;
  /**
   * Whether multiple files may be uploaded.
   */
  multiple?: boolean;
  /**
   * Whether to display a drag-and-drop zone.
   */
  dragDrop?: boolean;
}
/**
 * Section heading element for visual hierarchy. Purely presentational — does not bind to data.
 */
export interface Heading {
  component: 'Heading';
  /**
   * Heading level 1–6. Corresponds to HTML <h1>–<h6> semantics.
   */
  level: number;
  /**
   * Heading text content.
   */
  text: string;
}
/**
 * Static or data-bound text block. When bind is present, displays the bound item's current value as read-only. When absent, displays the static text prop.
 */
export interface Text {
  component: 'Text';
  /**
   * Item key. When present, displays the bound item's formatted value (read-only).
   */
  bind?: string;
  /**
   * Static text content. Ignored when bind is present.
   */
  text?: string;
  /**
   * Text format. 'markdown' enables basic Markdown rendering (bold, italic, links, lists). Renderers MUST sanitize to prevent script injection.
   */
  format?: 'plain' | 'markdown';
}
/**
 * Horizontal rule separating sections of the form.
 */
export interface Divider {
  component: 'Divider';
  /**
   * Optional label text centered on the divider line.
   */
  label?: string;
}
/**
 * Bordered surface that visually groups related content with optional header.
 */
export interface Card {
  component: 'Card';
  /**
   * Card header title.
   */
  title?: string;
  /**
   * Card header subtitle, rendered below the title.
   */
  subtitle?: string;
  /**
   * Shadow depth level.
   */
  elevation?: number;
  children?: ChildrenArray;
}
/**
 * Expandable/collapsible section. User toggles child visibility via clickable header. Collapsed children stay in DOM — bound data is preserved.
 */
export interface Collapsible {
  component: 'Collapsible';
  /**
   * Collapsible section header. Visible regardless of open/closed state.
   */
  title: string;
  /**
   * Whether the section is initially expanded.
   */
  defaultOpen?: boolean;
  children?: ChildrenArray;
}
/**
 * Container whose visibility is controlled by a REQUIRED when expression. Exists solely to conditionally show/hide a group of children. Data-bound children retain values when hidden (unlike Bind relevant).
 */
export interface ConditionalGroup {
  component: 'ConditionalGroup';
  /**
   * Text displayed when the condition is false.
   */
  fallback?: string;
  children?: ChildrenArray;
}
/**
 * Explicit multi-column layout with per-child column widths. Unlike Grid which auto-distributes into equal cells, Columns gives precise per-column sizing.
 */
export interface Columns {
  component: 'Columns';
  /**
   * Per-child column widths as CSS values (e.g. ['1fr', '2fr', '1fr']). Array length SHOULD match child count.
   */
  widths?: (string | number)[];
  /**
   * Spacing between columns.
   */
  gap?: string | number;
  children?: ChildrenArray;
}
/**
 * Tabbed navigation container. Each child is one tab's content. Tab labels from child Page titles or tabLabels array. All children stay mounted — switching changes visibility, not lifecycle.
 */
export interface Tabs {
  component: 'Tabs';
  /**
   * Tab bar position.
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Explicit tab labels. When absent, reads title from each child Page.
   */
  tabLabels?: string[];
  /**
   * Zero-based index of the initially active tab.
   */
  defaultTab?: number;
  children?: ChildrenArray;
}
/**
 * Button that triggers renderer submission. Calls the host renderer's submit API and can optionally emit the formspec-submit event.
 */
export interface SubmitButton {
  component: 'SubmitButton';
  /**
   * Button label text.
   */
  label?: string;
  /**
   * Validation mode used for response/report generation when clicked.
   */
  mode?: 'continuous' | 'submit';
  /**
   * Whether clicking the button dispatches the formspec-submit CustomEvent.
   */
  emitEvent?: boolean;
  /**
   * Label text shown while shared submit pending state is true.
   */
  pendingLabel?: string;
  /**
   * Whether the button is disabled while shared submit pending state is true.
   */
  disableWhenPending?: boolean;
}
/**
 * Vertical list of collapsible sections. By default only one expanded at a time. Children SHOULD have title props (Page, Card, Collapsible) for section headers.
 */
export interface Accordion {
  component: 'Accordion';
  /**
   * Optional bind path to a repeating group. When provided, each instance becomes one accordion section.
   */
  bind?: string;
  /**
   * Whether multiple sections may be expanded simultaneously. When false, expanding one collapses others.
   */
  allowMultiple?: boolean;
  /**
   * Zero-based index of the initially expanded section.
   */
  defaultOpen?: number;
  /**
   * Section header labels. labels[i] is the summary text for children[i]. Falls back to 'Section {i+1}' when absent.
   */
  labels?: string[];
  children?: ChildrenArray;
}
/**
 * Radio buttons for single-select choice fields. All options visible simultaneously — suitable for short lists (typically ≤7 items).
 */
export interface RadioGroup {
  component: 'RadioGroup';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Number of columns to arrange radio buttons in.
   */
  columns?: number;
  /**
   * Layout direction of the radio buttons.
   */
  orientation?: 'horizontal' | 'vertical';
}
/**
 * Currency-aware numeric input displaying currency symbol and formatted number. Stores raw numeric value without formatting.
 */
export interface MoneyInput {
  component: 'MoneyInput';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Increment/decrement step value (applies to amount).
   */
  step?: number;
  /**
   * Minimum allowed amount.
   */
  min?: number;
  /**
   * Maximum allowed amount.
   */
  max?: number;
  /**
   * Whether to show increment/decrement buttons (amount input).
   */
  showStepper?: boolean;
  /**
   * ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP').
   */
  currency?: string;
  /**
   * Whether to display the currency symbol.
   */
  showCurrency?: boolean;
  /**
   * Locale for number/currency formatting (e.g. 'en-US').
   */
  locale?: string;
}
/**
 * Range slider for selecting a numeric value within a continuous range.
 */
export interface Slider {
  component: 'Slider';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Minimum value.
   */
  min?: number;
  /**
   * Maximum value.
   */
  max?: number;
  /**
   * Step increment.
   */
  step?: number;
  /**
   * Whether to display the current numeric value adjacent to the slider.
   */
  showValue?: boolean;
  /**
   * Whether to display tick marks at step intervals.
   */
  showTicks?: boolean;
}
/**
 * Star (or icon) rating control for selecting an integer value within a small range (typically 1–5 or 1–10).
 */
export interface Rating {
  component: 'Rating';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Maximum rating value (number of icons).
   */
  max?: number;
  /**
   * Icon type. Renderers MAY support additional icons.
   */
  icon?: 'star' | 'heart' | 'circle';
  /**
   * Whether half-values are allowed (stored as decimal, e.g. 3.5).
   */
  allowHalf?: boolean;
}
/**
 * Signature capture pad recording a drawn signature as an image attachment.
 */
export interface Signature {
  component: 'Signature';
  /**
   * Item key from the target Definition.
   */
  bind: string;
  /**
   * Stroke color for the signature pen (e.g. '#000000').
   */
  strokeColor?: string;
  /**
   * Height of the signature pad. Number for pixels, string for CSS value.
   */
  height?: string | number;
  /**
   * Stroke width in pixels.
   */
  penWidth?: number;
  /**
   * Whether to show a clear/reset control.
   */
  clearable?: boolean;
}
/**
 * Status message block for informational banners, warnings, error summaries, or success messages.
 */
export interface Alert {
  component: 'Alert';
  /**
   * Alert severity. Determines visual styling and ARIA role (alert for error/warning, status for info/success).
   */
  severity: 'info' | 'success' | 'warning' | 'error';
  /**
   * Alert message text.
   */
  text: string;
  /**
   * Whether the user can dismiss the alert.
   */
  dismissible?: boolean;
}
/**
 * Small label badge for status indicators, counts, or tags.
 */
export interface Badge {
  component: 'Badge';
  /**
   * Badge label text.
   */
  text: string;
  /**
   * Visual variant controlling color/style.
   */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}
/**
 * Visual progress indicator. When bound, reads value from data. When unbound, uses static value prop.
 */
export interface ProgressBar {
  component: 'ProgressBar';
  /**
   * Item key. When present, reads current value from data.
   */
  bind?: string;
  /**
   * Current progress value. Ignored when bind is present.
   */
  value?: number;
  /**
   * Maximum value (100% completion).
   */
  max?: number;
  /**
   * Accessible label for the progress bar.
   */
  label?: string;
  /**
   * Whether to display percentage text.
   */
  showPercent?: boolean;
}
/**
 * Key-value summary display showing multiple field labels and current values. Useful for review pages.
 */
export interface Summary {
  component: 'Summary';
  /**
   * Array of summary entries. Each has a display label, a bind key for the value, and optional optionSet for resolving choice values to labels.
   */
  items?: {
    /**
     * Display label shown next to the value.
     */
    label: string;
    /**
     * Item key whose current value to display.
     */
    bind: string;
    /**
     * Named option set from the Definition. When set, the raw bound value is resolved to its display label.
     */
    optionSet?: string;
  }[];
}
/**
 * Validation message panel for live validation or the latest submit result. Can render jump links to focus affected fields.
 */
export interface ValidationSummary {
  component: 'ValidationSummary';
  /**
   * Validation source. 'live' reads continuous engine state; 'submit' reads the latest formspec-submit event detail.
   */
  source?: 'live' | 'submit';
  /**
   * Validation mode used when source is 'live'.
   */
  mode?: 'continuous' | 'submit';
  /**
   * Whether to include bind-level field errors in addition to shape-level findings.
   */
  showFieldErrors?: boolean;
  /**
   * Whether to render clickable links/buttons that call focusField(path) for jumpable targets.
   */
  jumpLinks?: boolean;
  /**
   * Whether duplicate messages (same severity/path/message) are collapsed.
   */
  dedupe?: boolean;
}
/**
 * Tabular display of repeatable group data. Each repeat instance becomes a row; each column displays a field within the repeat. One of the few components that MAY bind to a repeatable group.
 */
export interface DataTable {
  component: 'DataTable';
  /**
   * Repeatable group item key. Each repeat instance becomes a table row.
   */
  bind?: string;
  /**
   * Column definitions. Each specifies a header label and a field key within the repeat group.
   */
  columns?: {
    /**
     * Column header text.
     */
    header: string;
    /**
     * Item key within the repeat group.
     */
    bind: string;
    /**
     * Optional minimum value for numeric inputs.
     */
    min?: number;
    /**
     * Optional maximum value for numeric inputs.
     */
    max?: number;
    /**
     * Optional step for numeric inputs.
     */
    step?: number;
  }[];
  /**
   * Whether to display row numbers.
   */
  showRowNumbers?: boolean;
  /**
   * Whether to show an 'Add row' control.
   */
  allowAdd?: boolean;
  /**
   * Whether to show per-row 'Remove' controls.
   */
  allowRemove?: boolean;
}
/**
 * Side panel for supplementary content, help text, or contextual actions. Positioned alongside the main content.
 */
export interface Panel {
  component: 'Panel';
  /**
   * Panel position relative to main content.
   */
  position?: 'left' | 'right';
  /**
   * Panel header title.
   */
  title?: string;
  /**
   * Panel width. String for CSS value, number for pixels.
   */
  width?: string | number;
  children?: ChildrenArray;
}
/**
 * Dialog overlay displaying content above the main form. Requires explicit user action to open/close. Traps focus while open.
 */
export interface Modal {
  component: 'Modal';
  /**
   * Modal dialog title.
   */
  title: string;
  /**
   * Modal size.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /**
   * 'button': dedicated open button. 'auto': opens automatically based on when.
   */
  trigger?: 'button' | 'auto';
  /**
   * Label for the trigger button when trigger is 'button'.
   */
  triggerLabel?: string;
  /**
   * Whether the modal can be dismissed by the user.
   */
  closable?: boolean;
  children?: ChildrenArray;
}
/**
 * Lightweight anchored overlay showing contextual content when trigger is activated.
 */
export interface Popover {
  component: 'Popover';
  /**
   * Bind key whose live value is used as trigger text.
   */
  triggerBind?: string;
  /**
   * Fallback label for the trigger control.
   */
  triggerLabel?: string;
  /**
   * Preferred popover placement relative to the trigger.
   */
  placement?: 'top' | 'right' | 'bottom' | 'left';
  children?: ChildrenArray;
}
/**
 * Reference to a custom component defined in the components registry. The component name is looked up in the registry, params are interpolated into the template, and the resolved subtree replaces this reference.
 */
export interface CustomComponentRef {
  /**
   * Custom component name. MUST be a key in the components registry. MUST NOT be a built-in component name.
   */
  component: string;
  /**
   * Parameter values to interpolate into the template. Keys MUST match the template's declared params. Values MUST be strings.
   */
  params?: {
    [k: string]: string;
  };
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
