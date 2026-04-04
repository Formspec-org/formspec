/** @filedesc Spatial and theme override helpers for the Layout workspace direct-manipulation canvas. */
import type { HelperResult } from './helper-types.js';
import type { Project } from './project.js';

/** Canonical CompNode type for layout tree traversal and rendering. */
export interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  title?: string;
  syntheticPage?: boolean;
  groupPath?: string;
  _layout?: boolean;
  children?: CompNode[];
  // Layout props (from component tree node)
  columns?: number;
  gap?: string;
  direction?: string;
  wrap?: boolean;
  align?: string;
  elevation?: number;
  width?: string;
  position?: string;
  defaultOpen?: boolean;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Layout-specific properties extracted from LayoutContainerProps. */
export interface ContainerLayoutProps {
  columns?: number;
  gap?: string;
  direction?: string;
  wrap?: boolean;
  align?: string;
  elevation?: number;
  width?: string;
  position?: string;
  title?: string;
  defaultOpen?: boolean;
  nodeStyle?: Record<string, unknown>;
}

/** A node reference — either a nodeId or a bind key, matching component.setNodeStyle's NodeRef. */
export interface NodeRef {
  nodeId?: string;
  bind?: string;
}

/** One entry in the cascade provenance array returned by getPropertySources. */
export interface PropertySource {
  /** Human-readable cascade source label. Matches ResolvedProperty.source from resolveThemeCascade. */
  source: 'default' | 'selector' | 'item-override';
  /** Optional detail (e.g. "selector #2: field + string"). */
  sourceDetail?: string;
  /** The value at this cascade level. */
  value: unknown;
}

/** Type-aware theme property descriptor returned by getEditableThemeProperties. */
export interface EditableThemeProperty {
  /** Property name (e.g. 'labelPosition', 'widget'). */
  prop: string;
  /** Property type: enum has fixed valid values, string is free text, object is complex. */
  type: 'enum' | 'string' | 'object';
  /** Valid enum values (only when type === 'enum'). */
  options?: string[];
}

// ── Tier 3 content detection ────────────────────────────────────────────

/**
 * Check if a component node has any Tier 3 (presentation) properties set.
 * Used to show a dot indicator on overflow buttons when the node has custom styles,
 * accessibility info, or CSS classes.
 */
export function hasTier3Content(nodeProps: Record<string, unknown> | undefined): boolean {
  if (!nodeProps) return false;
  const accessibility = nodeProps.accessibility as Record<string, unknown> | undefined;
  return !!(
    accessibility?.description ||
    accessibility?.role ||
    nodeProps.cssClass ||
    Object.keys((nodeProps.style as Record<string, unknown>) ?? {}).length > 0
  );
}

// ── Style helpers (Tier 3 — Component node style) ────────────────────

/**
 * Set `style.gridColumn = "span N"` on a component node.
 * Clamps N to [1, 12]. Preserves all other style properties.
 */
export function setColumnSpan(
  project: Project,
  ref: NodeRef,
  n: number,
): void {
  const clamped = Math.min(12, Math.max(1, n));
  project.setNodeStyleProperty(ref, 'gridColumn', `span ${clamped}`);
}

/**
 * Set `style.gridRow = "span N"` on a component node.
 * Clamps N to [1, 12]. Preserves all other style properties.
 */
export function setRowSpan(
  project: Project,
  ref: NodeRef,
  n: number,
): void {
  const clamped = Math.min(12, Math.max(1, n));
  project.setNodeStyleProperty(ref, 'gridRow', `span ${clamped}`);
}

/**
 * Set `style.padding` on a component node.
 * Preserves all other style properties.
 */
export function setPadding(
  project: Project,
  ref: NodeRef,
  value: string,
): void {
  project.setNodeStyleProperty(ref, 'padding', value);
}

// ── Theme helpers (Tier 2 — PresentationBlock cascade) ───────────────

/**
 * Walk all cascade levels for a PresentationBlock property on a given item.
 * Returns entries in ascending level order: default → selector(s) → item-override.
 * Only selectors whose match criteria apply to the item's type and dataType are included.
 */
export function getPropertySources(
  project: Project,
  itemKey: string,
  prop: string,
  itemType: string = 'field',
  itemDataType?: string,
): PropertySource[] {
  const theme = project.state.theme;
  const sources: PropertySource[] = [];

  // Level 1: theme defaults
  const defaults = (theme.defaults ?? {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
    sources.push({ source: 'default', value: defaults[prop] });
  }

  // Level 2: theme selectors — only include selectors that match this item's type/dataType
  const selectors = (theme.selectors ?? []) as Array<{
    match?: { type?: string; dataType?: string };
    apply?: Record<string, unknown>;
  }>;
  for (let i = 0; i < selectors.length; i++) {
    const sel = selectors[i];
    // Apply same match logic as resolveThemeCascade / selectorMatches in theme-cascade.ts
    const match = sel.match;
    if (match) {
      if (match.type && match.type !== itemType) continue;
      if (match.dataType && match.dataType !== itemDataType) continue;
    }
    const apply = sel.apply ?? {};
    if (Object.prototype.hasOwnProperty.call(apply, prop)) {
      const parts: string[] = [];
      if (sel.match?.type) parts.push(sel.match.type);
      if (sel.match?.dataType) parts.push(sel.match.dataType);
      const sourceDetail = `selector #${i + 1}${parts.length ? ': ' + parts.join(' + ') : ''}`;
      sources.push({ source: 'selector', sourceDetail, value: apply[prop] });
    }
  }

  // Level 3: item-level override
  const items = (theme.items ?? {}) as Record<string, Record<string, unknown>>;
  const itemOverride = items[itemKey];
  if (itemOverride && Object.prototype.hasOwnProperty.call(itemOverride, prop)) {
    sources.push({ source: 'item-override', value: itemOverride[prop] });
  }

  return sources;
}

// ── Type-aware theme property definitions ───────────────────────────────────

/**
 * Display components (Heading, Text, Divider, Alert, Badge, etc.)
 * that do not have a label and should not show labelPosition.
 */
const DISPLAY_COMPONENTS = new Set([
  'Heading',
  'Text',
  'Divider',
  'Alert',
  'Badge',
  'Summary',
  'Message',
]);

/**
 * Group/layout components (Stack, Grid, Card, Panel, etc.)
 * that do not have a label themselves.
 */
const GROUP_COMPONENTS = new Set([
  'Stack',
  'Grid',
  'Flex',
  'Card',
  'Panel',
  'Collapsible',
  'Accordion',
  'Tab',
  'Tabs',
  'Section',
]);

/**
 * Valid enum values for theme properties.
 */
const LABEL_POSITION_ENUM = ['top', 'start', 'hidden'];

/**
 * Returns type-aware theme properties that can be overridden for a given item.
 * Properties returned vary by component type:
 * - Display components: no labelPosition, widget, or fallback
 * - Group components: no labelPosition or fallback
 * - Input components: all properties available
 * - Other: all properties available
 */
export function getEditableThemeProperties(
  project: Project,
  itemKey: string,
): EditableThemeProperty[] {
  // Determine the component type and item type
  const definition = project.state.definition;
  const core = definition.core ?? {};
  const items = (core.items ?? []) as Array<{
    key?: string;
    type?: string;
    dataType?: string;
  }>;
  const item = items.find((i) => i.key === itemKey);
  const itemType = item?.type ?? 'field';

  // Look up the component that renders this item
  let component = '';
  if (itemType === 'field' && item?.key) {
    // For fields, find the component in the layout's render tree
    const layout = definition.layout ?? {};
    const findComponent = (node: unknown): string => {
      if (typeof node !== 'object' || node === null) return '';
      const n = node as Record<string, unknown>;
      // Check if this is a field binding
      if (n.bind === itemKey && typeof n.component === 'string') {
        return n.component;
      }
      // Recurse into children
      const children = n.children as unknown[];
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findComponent(child);
          if (found) return found;
        }
      }
      return '';
    };
    if (typeof layout === 'object' && layout !== null) {
      component = findComponent(layout);
    }
    // If no component found yet, assume TextInput as a safe default
    if (!component) {
      component = 'TextInput';
    }
  }

  const isDisplayComponent = DISPLAY_COMPONENTS.has(component);
  const isGroupComponent = GROUP_COMPONENTS.has(component);

  const props: EditableThemeProperty[] = [];

  // labelPosition: only for input components (not display or groups)
  if (!isDisplayComponent && !isGroupComponent) {
    props.push({
      prop: 'labelPosition',
      type: 'enum',
      options: LABEL_POSITION_ENUM,
    });
  }

  // widget: all components except layout-only groups
  if (!isGroupComponent || itemType === 'field' || itemType === 'display') {
    props.push({
      prop: 'widget',
      type: 'string', // widget values are flexible/extensible, not a fixed enum
    });
  }

  // widgetConfig: all components
  props.push({
    prop: 'widgetConfig',
    type: 'object',
  });

  // style: all components
  props.push({
    prop: 'style',
    type: 'object',
  });

  // cssClass: all components
  props.push({
    prop: 'cssClass',
    type: 'string',
  });

  // accessibility: all components
  props.push({
    prop: 'accessibility',
    type: 'object',
  });

  // fallback: only for input components (not display or groups)
  if (!isDisplayComponent && !isGroupComponent) {
    props.push({
      prop: 'fallback',
      type: 'string',
    });
  }

  return props;
}

/**
 * Set a per-item theme override via the existing project.setItemOverride path.
 */
export function setThemeOverride(
  project: Project,
  itemKey: string,
  prop: string,
  value: unknown,
): HelperResult {
  return project.setItemOverride(itemKey, prop, value);
}

/**
 * Remove a single per-item theme override property.
 * Calls theme.setItemOverride with value=null, which deletes the property.
 */
export function clearThemeOverride(
  project: Project,
  itemKey: string,
  prop: string,
): HelperResult {
  return project.setItemOverride(itemKey, prop, null);
}
