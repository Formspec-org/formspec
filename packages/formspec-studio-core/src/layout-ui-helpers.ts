/** @filedesc Business logic helpers extracted from Studio UI components for shared use by Studio and MCP. */
import { nodeIdFromLayoutId, isLayoutId } from './authoring-helpers.js';
import { findComponentNodeById } from './tree-utils.js';
import { componentTreeForLayout } from './layout-helpers.js';
import type { Project } from './project.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface Token {
  key: string;
  name: string;
  value: string;
}

/** Semantic token type from the registry. */
export type TokenType =
  | 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
  | 'duration' | 'opacity' | 'shadow' | 'number';

/** A single entry from a parsed token registry category. */
export interface TokenRegistryEntry {
  key: string;
  description?: string;
  type: TokenType;
  defaultValue?: string | number;
  dark?: string | number;
  darkKey?: string;
}

/** A parsed registry category. */
export interface TokenRegistryCategory {
  description?: string;
  type: TokenType;
  darkPrefix?: string;
  entries: Map<string, TokenRegistryEntry>;
}

/** Parsed token registry lookup structure. */
export type TokenRegistryMap = Map<string, TokenRegistryCategory>;

/** A token enriched with registry metadata. */
export interface EnrichedToken extends Token {
  description?: string;
  type: TokenType;
  defaultValue?: string | number;
  isModified: boolean;
  isCustom: boolean;
  darkValue?: string;
  darkDefaultValue?: string | number;
  darkKey?: string;
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
 * Mirrors LayoutCanvas parent resolution for `addItemToLayout` / `addLayoutNode`.
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

// ── 11. Token registry helpers ───────────────────────────────────────
interface RawTokenRegistryEntry {
  description?: string;
  type?: string;
  default?: string | number;
  dark?: string | number;
}

interface RawTokenRegistryCategory {
  description?: string;
  type?: string;
  darkPrefix?: string;
  tokens?: Record<string, RawTokenRegistryEntry>;
}

/** Parse a token-registry.json document into a lookup-friendly structure. */
export function parseTokenRegistry(registryDoc: { categories?: Record<string, RawTokenRegistryCategory> }): TokenRegistryMap {
  const map: TokenRegistryMap = new Map();
  const categories = registryDoc.categories;
  if (!categories) return map;

  for (const [catKey, category] of Object.entries(categories)) {
    const catType = (category.type || 'number') as TokenType;
    const darkPrefix = category.darkPrefix as string | undefined;
    const entries = new Map<string, TokenRegistryEntry>();

    if (category.tokens) {
      for (const [tokenKey, entry] of Object.entries(category.tokens)) {
        const suffix = tokenKey.startsWith(catKey + '.') ? tokenKey.slice(catKey.length + 1) : tokenKey;
        entries.set(tokenKey, {
          key: tokenKey,
          description: entry.description,
          type: (entry.type || catType) as TokenType,
          defaultValue: entry.default,
          dark: entry.dark,
          darkKey: darkPrefix && entry.dark !== undefined ? `${darkPrefix}.${suffix}` : undefined,
        });
      }
    }

    map.set(catKey, {
      description: category.description,
      type: catType,
      darkPrefix,
      entries,
    });
  }

  return map;
}

/** Look up registry metadata for a single token key. */
export function getTokenRegistryEntry(
  key: string,
  registry: TokenRegistryMap,
): TokenRegistryEntry | undefined {
  for (const category of registry.values()) {
    const entry = category.entries.get(key);
    if (entry) return entry;
  }
  return undefined;
}

/**
 * Get enriched tokens for a category group, merging live theme values with registry metadata.
 * Dark-mode tokens (color.dark.*) are NOT returned as separate entries — they are
 * folded into the darkValue/darkKey fields of their light counterpart.
 */
export function getEnrichedTokensByGroup(
  tokens: Record<string, string | number>,
  group: string,
  registry?: TokenRegistryMap,
): EnrichedToken[] {
  const category = registry?.get(group);
  const darkPrefix = category?.darkPrefix;
  const result: EnrichedToken[] = [];

  // Start with registry entries for this group (ensures all platform tokens appear even if not in theme)
  if (category) {
    for (const [key, entry] of category.entries) {
      const value = tokens[key];
      const darkValue = entry.darkKey ? String(tokens[entry.darkKey] ?? '') : undefined;
      const dotIdx = key.indexOf('.');
      result.push({
        key,
        name: dotIdx >= 0 ? key.slice(dotIdx + 1) : key,
        value: value !== undefined ? String(value) : String(entry.defaultValue ?? ''),
        description: entry.description,
        type: entry.type,
        defaultValue: entry.defaultValue,
        isModified: value !== undefined && String(value) !== String(entry.defaultValue),
        isCustom: false,
        darkValue: darkValue || undefined,
        darkDefaultValue: entry.dark,
        darkKey: entry.darkKey,
      });
    }
  }

  // Add any theme tokens in this group that are NOT in the registry (custom tokens)
  const groupPrefix = group + '.';
  const darkPrefixDot = darkPrefix ? darkPrefix + '.' : null;
  for (const [key, value] of Object.entries(tokens)) {
    if (!key.startsWith(groupPrefix)) continue;
    // Skip dark-mode tokens (they're folded into their light counterpart)
    if (darkPrefixDot && key.startsWith(darkPrefixDot)) continue;
    // Skip if already added from registry
    if (category?.entries.has(key)) continue;
    const dotIdx = key.indexOf('.');
    result.push({
      key,
      name: dotIdx >= 0 ? key.slice(dotIdx + 1) : key,
      value: String(value),
      type: category?.type ?? 'number',
      isModified: false,
      isCustom: true,
    });
  }

  return result;
}

/**
 * Get all tokens grouped by category, enriched with registry metadata.
 * Returns a Map of group name -> EnrichedToken[].
 */
export function getEnrichedGroupedTokens(
  tokens: Record<string, string | number>,
  registry?: TokenRegistryMap,
): Map<string, EnrichedToken[]> {
  const groups = new Map<string, EnrichedToken[]>();

  // Add all registry categories first
  if (registry) {
    for (const catKey of registry.keys()) {
      groups.set(catKey, getEnrichedTokensByGroup(tokens, catKey, registry));
    }
  }

  // Add any theme tokens that don't belong to a registry category
  for (const key of Object.keys(tokens)) {
    const dotIdx = key.indexOf('.');
    const group = dotIdx >= 0 ? key.slice(0, dotIdx) : key;
    if (groups.has(group)) continue; // already handled by registry

    // Check if this is a dark token whose parent group is already handled
    let isDarkOfKnownGroup = false;
    if (registry) {
      for (const cat of registry.values()) {
        if (cat.darkPrefix && key.startsWith(cat.darkPrefix + '.')) {
          isDarkOfKnownGroup = true;
          break;
        }
      }
    }
    if (isDarkOfKnownGroup) continue;

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    const arr = groups.get(group)!;
    // Only add if not already present
    if (!arr.some(t => t.key === key)) {
      arr.push({
        key,
        name: dotIdx >= 0 ? key.slice(dotIdx + 1) : key,
        value: String(tokens[key]),
        type: 'number',
        isModified: false,
        isCustom: true,
      });
    }
  }

  return groups;
}
