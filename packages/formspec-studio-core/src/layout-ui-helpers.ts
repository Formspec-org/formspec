/** @filedesc Business logic helpers extracted from Studio UI components for shared use by Studio and MCP. */
import { findComponentNodeById, nodeIdFromLayoutId, isLayoutId } from './authoring-helpers.js';
import { componentTreeForLayout } from './layout-helpers.js';
import type { Project } from './project.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface Token {
  key: string;
  name: string;
  value: string;
}

export interface Breakpoint {
  name: string;
  width: number;
}

export interface LayoutInsertTarget {
  /** The resolved page node ID (or undefined for single-page). */
  pageId?: string;
  /** The parent node ID to pass to addLayoutNode / addItemToLayout. */
  parentNodeId: string;
}

// ── 1. resolveLayoutInsertTarget ──────────────────────────────────────

/**
 * Resolves the correct parent node for adding a new item to the layout.
 * In multi-page projects, the parent is the active page node.
 * In single-page projects, the parent is always 'root'.
 *
 * Extracted from LayoutCanvas.tsx:171-182.
 */
export function resolveLayoutInsertTarget(
  project: Project,
  pageId?: string,
): LayoutInsertTarget {
  if (!pageId) {
    return { parentNodeId: 'root' };
  }

  // Verify the page exists in the component tree
  const node = findComponentNodeById(componentTreeForLayout(project.component), pageId);
  if (!node) {
    return { parentNodeId: 'root' };
  }

  return { pageId, parentNodeId: pageId };
}

// ── 2. getItemOverrides ───────────────────────────────────────────────

/**
 * Returns the current per-item theme overrides for an item.
 * Replaces direct `(project.state.theme as any)?.items?.[itemKey] ?? {}` access.
 *
 * Extracted from AppearanceSection.tsx:70.
 */
export function getItemOverrides(
  project: Project,
  itemKey: string,
): Record<string, unknown> {
  const items = project.state.theme.items as Record<string, Record<string, unknown>> | undefined;
  return items?.[itemKey] ?? {};
}

// ── 3. addStyleOverride ────────────────────────────────────────────────

/**
 * Adds a style key/value to the per-item theme style override.
 * Validates that key is a non-empty string (after trimming).
 *
 * Extracted from AppearanceSection.tsx:81-88.
 */
export function addStyleOverride(
  project: Project,
  itemKey: string,
  key: string,
  value: string,
): void {
  const k = key.trim();
  if (!k) {
    throw new Error('Style key must be a non-empty string');
  }
  project.applyStyle(itemKey, { [k]: value });
}

// ── 4. validateTokenName ───────────────────────────────────────────────

/**
 * Returns true if the token name contains only valid characters:
 * alphanumeric, hyphens, and underscores. Empty string is rejected.
 *
 * Extracted from ColorPalette.tsx:22.
 */
export function validateTokenName(name: string): boolean {
  if (!name) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

// ── 5. applyBreakpointPresets ──────────────────────────────────────────

/**
 * Sets standard breakpoints on the theme: mobile (0), tablet (768), desktop (1024).
 *
 * Extracted from ScreenSizes.tsx:31-35.
 */
export function applyBreakpointPresets(project: Project): void {
  project.setBreakpoint('mobile', 0);
  project.setBreakpoint('tablet', 768);
  project.setBreakpoint('desktop', 1024);
}

// ── 6. summarizeSelectorRule ───────────────────────────────────────────

/**
 * Returns a human-readable string for a selector rule.
 * Format: "{type} + {dataType}", or just one if only one is set.
 * Falls back to "Any item" if neither is set.
 *
 * Extracted from FieldTypeRules.tsx:11-17.
 */
export function summarizeSelectorRule(rule: Record<string, unknown>): string {
  const match = rule.match as Record<string, string | undefined> | undefined;
  const parts: string[] = [];
  if (match?.type) parts.push(match.type);
  if (match?.dataType) parts.push(match.dataType);
  if (parts.length === 0) return 'Any item';
  return parts.join(' + ');
}

// ── 7. getTokensByGroup ────────────────────────────────────────────────

/**
 * Returns tokens whose name starts with `{group}.`.
 * Each token has key, name (suffix after dot), and value.
 *
 * Extracted from ColorPalette.tsx:14-15.
 */
export function getTokensByGroup(project: Project, group: string): Token[] {
  const tokens = project.state.theme.tokens ?? {};
  const prefix = `${group}.`;
  return Object.entries(tokens)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => ({
      key,
      name: key.slice(prefix.length),
      value: String(value),
    }));
}

// ── 8. getGroupedTokens ────────────────────────────────────────────────

/**
 * Groups all tokens by dot-prefix. Tokens without a dot go in "other".
 *
 * Extracted from AllTokens.tsx:23-28.
 */
export function getGroupedTokens(project: Project): Map<string, Token[]> {
  const tokens = project.state.theme.tokens ?? {};
  const groups = new Map<string, Token[]>();

  for (const [key, value] of Object.entries(tokens)) {
    const dotIdx = key.indexOf('.');
    const prefix = dotIdx >= 0 ? key.slice(0, dotIdx) : 'other';
    const name = dotIdx >= 0 ? key.slice(dotIdx + 1) : key;

    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push({ key, name, value: String(value) });
  }

  return groups;
}

// ── 9. getSortedBreakpoints ────────────────────────────────────────────

/**
 * Returns breakpoints sorted by numeric width ascending.
 *
 * Extracted from ScreenSizes.tsx:14-15.
 */
export function getSortedBreakpoints(project: Project): Breakpoint[] {
  const breakpoints = project.state.theme.breakpoints ?? {};
  return Object.entries(breakpoints)
    .sort(([, a], [, b]) => a - b)
    .map(([name, width]) => ({ name, width }));
}

// ── 10. getEditablePropertiesForNode ──────────────────────────────────

/**
 * Returns which properties are valid to set on a given component node.
 * Heading and Divider nodes hide container layout properties.
 *
 * Extracted from ComponentProperties.tsx:128-134.
 */
export function getEditablePropertiesForNode(
  project: Project,
  nodeRef: string,
): string[] {
  // Resolve nodeId from layoutId or use as-is
  const nodeId = isLayoutId(nodeRef) ? nodeIdFromLayoutId(nodeRef) : nodeRef;

  const node = findComponentNodeById(componentTreeForLayout(project.component), nodeId);
  const componentType = (node?.component as string) ?? '';

  // Common properties available for all nodes
  const common: string[] = ['when', 'accessibility'];

  // Heading and Divider are purely presentational — no container layout props
  if (['Heading', 'Divider'].includes(componentType)) {
    return common;
  }

  // Container-type-specific properties
  const containerProps: Record<string, string[]> = {
    Stack: ['direction', 'gap', 'padding', 'align', 'wrap'],
    Grid: ['columns', 'gap', 'padding'],
    Card: ['padding', 'elevation'],
    Panel: ['position', 'width'],
    Collapsible: ['label', 'defaultOpen'],
    Accordion: ['label', 'defaultOpen'],
  };

  const specific = containerProps[componentType] ?? [];
  return [...specific, ...common];
}
