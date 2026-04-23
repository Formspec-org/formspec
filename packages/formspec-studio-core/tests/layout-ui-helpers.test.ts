/** @filedesc Tests for layout-ui-helpers: business logic extracted from Studio UI into studio-core. */
import { describe, expect, it } from 'vitest';
import { createProject } from '../src/project.js';
import {
  resolveLayoutInsertTarget,
  getItemOverrides,
  addStyleOverride,
  validateTokenName,
  applyBreakpointPresets,
  summarizeSelectorRule,
  getTokensByGroup,
  getGroupedTokens,
  getSortedBreakpoints,
  getEditablePropertiesForNode,
  parseTokenRegistry,
  getTokenRegistryEntry,
  getEnrichedTokensByGroup,
  getEnrichedGroupedTokens,
} from '../src/layout-ui-helpers.js';

// ── 1. resolveLayoutInsertTarget ──────────────────────────────────────

describe('resolveLayoutInsertTarget', () => {
  it('returns root parentNodeId when project has no pages', () => {
    const project = createProject();
    const result = resolveLayoutInsertTarget(project);
    expect(result.parentNodeId).toBe('root');
  });

  it('returns root parentNodeId in single-page mode even with no active pageId', () => {
    const project = createProject();
    const result = resolveLayoutInsertTarget(project, undefined);
    expect(result.parentNodeId).toBe('root');
  });

  it('returns pageId as parentNodeId when multi-page project has an active page', () => {
    const project = createProject();
    const pageResult = project.addPage('Page One');
    const pageId = pageResult.createdId!;
    const result = resolveLayoutInsertTarget(project, pageId);
    expect(result.parentNodeId).toBe(pageId);
    expect(result.pageId).toBe(pageId);
  });

  it('falls back to root when pageId is provided but not found in tree', () => {
    const project = createProject();
    const result = resolveLayoutInsertTarget(project, 'nonexistent-page');
    expect(result.parentNodeId).toBe('root');
  });
});

// ── 2. getItemOverrides ───────────────────────────────────────────────

describe('getItemOverrides', () => {
  it('returns empty object when no theme overrides exist', () => {
    const project = createProject();
    expect(getItemOverrides(project, 'some-field')).toEqual({});
  });

  it('returns empty object for unknown item key', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(getItemOverrides(project, 'name')).toEqual({});
  });

  it('returns existing overrides when set via setItemOverride', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    project.setItemOverride('email', 'labelPosition', 'start');
    const overrides = getItemOverrides(project, 'email');
    expect(overrides).toHaveProperty('labelPosition', 'start');
  });

  it('returns multiple overrides when set', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.setItemOverride('name', 'labelPosition', 'top');
    project.setItemOverride('name', 'widget', 'textarea');
    const overrides = getItemOverrides(project, 'name');
    expect(overrides).toHaveProperty('labelPosition', 'top');
    expect(overrides).toHaveProperty('widget', 'textarea');
  });
});

// ── 3. addStyleOverride ────────────────────────────────────────────────

describe('addStyleOverride', () => {
  it('adds a style key to the item', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    addStyleOverride(project, 'name', 'fontWeight', 'bold');
    const overrides = getItemOverrides(project, 'name');
    expect(overrides.style).toBeDefined();
    expect((overrides.style as Record<string, unknown>)?.fontWeight).toBe('bold');
  });

  it('throws on empty key', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(() => addStyleOverride(project, 'name', '', 'bold')).toThrow();
  });

  it('throws on whitespace-only key', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(() => addStyleOverride(project, 'name', '   ', 'bold')).toThrow();
  });

  it('preserves existing style keys when adding a new one', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    addStyleOverride(project, 'name', 'color', 'red');
    addStyleOverride(project, 'name', 'fontWeight', 'bold');
    const overrides = getItemOverrides(project, 'name');
    const style = overrides.style as Record<string, unknown>;
    expect(style?.color).toBe('red');
    expect(style?.fontWeight).toBe('bold');
  });
});

// ── 4. validateTokenName ───────────────────────────────────────────────

describe('validateTokenName', () => {
  it('accepts alphanumeric names', () => {
    expect(validateTokenName('token123')).toBe(true);
  });

  it('accepts names with hyphens', () => {
    expect(validateTokenName('color-primary')).toBe(true);
  });

  it('accepts names with underscores', () => {
    expect(validateTokenName('my_token')).toBe(true);
  });

  it('accepts mixed alphanumeric + hyphen + underscore', () => {
    expect(validateTokenName('color-primary_01')).toBe(true);
  });

  it('rejects names with dots', () => {
    expect(validateTokenName('color.primary')).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(validateTokenName('color token')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateTokenName('')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(validateTokenName('my@token')).toBe(false);
  });
});

// ── 5. applyBreakpointPresets ──────────────────────────────────────────

describe('applyBreakpointPresets', () => {
  it('sets mobile at 0px', () => {
    const project = createProject();
    applyBreakpointPresets(project);
    expect(project.state.theme.breakpoints?.mobile).toBe(0);
  });

  it('sets tablet at 768px', () => {
    const project = createProject();
    applyBreakpointPresets(project);
    expect(project.state.theme.breakpoints?.tablet).toBe(768);
  });

  it('sets desktop at 1024px', () => {
    const project = createProject();
    applyBreakpointPresets(project);
    expect(project.state.theme.breakpoints?.desktop).toBe(1024);
  });

  it('applies all three breakpoints in one call', () => {
    const project = createProject();
    applyBreakpointPresets(project);
    const bp = project.state.theme.breakpoints ?? {};
    expect(Object.keys(bp)).toEqual(expect.arrayContaining(['mobile', 'tablet', 'desktop']));
  });
});

// ── 6. summarizeSelectorRule ───────────────────────────────────────────

describe('summarizeSelectorRule', () => {
  it('returns "Any item" for empty match', () => {
    expect(summarizeSelectorRule({})).toBe('Any item');
  });

  it('returns "Any item" for match with no type or dataType', () => {
    expect(summarizeSelectorRule({ match: {} })).toBe('Any item');
  });

  it('returns just the type when only type is set', () => {
    expect(summarizeSelectorRule({ match: { type: 'field' } })).toBe('field');
  });

  it('returns just the dataType when only dataType is set', () => {
    expect(summarizeSelectorRule({ match: { dataType: 'string' } })).toBe('string');
  });

  it('returns type + dataType joined with " + " when both set', () => {
    expect(summarizeSelectorRule({ match: { type: 'field', dataType: 'string' } })).toBe('field + string');
  });
});

// ── 7. getTokensByGroup ────────────────────────────────────────────────

describe('getTokensByGroup', () => {
  it('returns empty array when no tokens exist', () => {
    const project = createProject();
    expect(getTokensByGroup(project, 'color')).toEqual([]);
  });

  it('returns only tokens in the specified group', () => {
    const project = createProject();
    project.setToken('color.primary', '#ff0000');
    project.setToken('color.secondary', '#00ff00');
    project.setToken('font.size', '16px');
    const colorTokens = getTokensByGroup(project, 'color');
    expect(colorTokens).toHaveLength(2);
    const keys = colorTokens.map((t) => t.key);
    expect(keys).toContain('color.primary');
    expect(keys).toContain('color.secondary');
    expect(keys).not.toContain('font.size');
  });

  it('returns token with name stripped of group prefix', () => {
    const project = createProject();
    project.setToken('color.primary', '#ff0000');
    const tokens = getTokensByGroup(project, 'color');
    expect(tokens[0].name).toBe('primary');
  });

  it('returns token with correct value', () => {
    const project = createProject();
    project.setToken('color.primary', '#ff0000');
    const tokens = getTokensByGroup(project, 'color');
    expect(tokens[0].value).toBe('#ff0000');
  });

  it('returns empty array for non-existent group', () => {
    const project = createProject();
    project.setToken('color.primary', '#ff0000');
    expect(getTokensByGroup(project, 'typography')).toEqual([]);
  });
});

// ── 8. getGroupedTokens ────────────────────────────────────────────────

describe('getGroupedTokens', () => {
  it('returns empty Map when no tokens exist', () => {
    const project = createProject();
    const grouped = getGroupedTokens(project);
    expect(grouped.size).toBe(0);
  });

  it('groups tokens by dot-prefix', () => {
    const project = createProject();
    project.setToken('color.primary', '#ff0000');
    project.setToken('color.secondary', '#00ff00');
    project.setToken('font.size', '16px');
    const grouped = getGroupedTokens(project);
    expect(grouped.has('color')).toBe(true);
    expect(grouped.has('font')).toBe(true);
    expect(grouped.get('color')!).toHaveLength(2);
    expect(grouped.get('font')!).toHaveLength(1);
  });

  it('places tokens without dots in "other" group', () => {
    const project = createProject();
    project.setToken('mytoken', 'val');
    const grouped = getGroupedTokens(project);
    expect(grouped.has('other')).toBe(true);
    expect(grouped.get('other')!).toHaveLength(1);
  });

  it('tokens in groups have key, name, and value', () => {
    const project = createProject();
    project.setToken('color.accent', '#0000ff');
    const grouped = getGroupedTokens(project);
    const token = grouped.get('color')![0];
    expect(token.key).toBe('color.accent');
    expect(token.name).toBe('accent');
    expect(token.value).toBe('#0000ff');
  });
});

// ── 9. getSortedBreakpoints ────────────────────────────────────────────

describe('getSortedBreakpoints', () => {
  it('returns empty array when no breakpoints defined', () => {
    const project = createProject();
    expect(getSortedBreakpoints(project)).toEqual([]);
  });

  it('returns breakpoints sorted by ascending width', () => {
    const project = createProject();
    project.setBreakpoint('desktop', 1024);
    project.setBreakpoint('mobile', 0);
    project.setBreakpoint('tablet', 768);
    const sorted = getSortedBreakpoints(project);
    expect(sorted.map((b) => b.name)).toEqual(['mobile', 'tablet', 'desktop']);
  });

  it('each entry has name and width', () => {
    const project = createProject();
    project.setBreakpoint('tablet', 768);
    const sorted = getSortedBreakpoints(project);
    expect(sorted[0]).toEqual({ name: 'tablet', width: 768 });
  });

  it('handles a single breakpoint', () => {
    const project = createProject();
    project.setBreakpoint('mobile', 0);
    const sorted = getSortedBreakpoints(project);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe('mobile');
  });
});

// ── 10. getEditablePropertiesForNode ──────────────────────────────────

describe('getEditablePropertiesForNode', () => {
  it('Grid node returns container properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Grid');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).toContain('columns');
    expect(props).toContain('gap');
  });

  it('Stack node returns direction and gap properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Stack');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).toContain('direction');
    expect(props).toContain('gap');
  });

  it('Card node returns container properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Card');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).toContain('elevation');
    expect(props).toContain('padding');
  });

  it('Heading node does not return container layout properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Heading');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).not.toContain('columns');
    expect(props).not.toContain('direction');
    expect(props).not.toContain('elevation');
  });

  it('Divider node does not return container layout properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Divider');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).not.toContain('columns');
    expect(props).not.toContain('direction');
  });

  it('all non-Heading/Divider nodes include common properties', () => {
    const project = createProject();
    const result = project.addLayoutNode('root', 'Stack');
    const nodeId = result.createdId!;
    const props = getEditablePropertiesForNode(project, `__node:${nodeId}`);
    expect(props).toContain('when');
  });
});

// ── 11. parseTokenRegistry ────────────────────────────────────────────

describe('parseTokenRegistry', () => {
  it('returns empty map for document with no categories', () => {
    const registry = parseTokenRegistry({ $formspecTokenRegistry: '1.0' });
    expect(registry.size).toBe(0);
  });

  it('parses a minimal registry into a map', () => {
    const registry = parseTokenRegistry({
      $formspecTokenRegistry: '1.0',
      categories: {
        color: {
          type: 'color',
          darkPrefix: 'color.dark',
          tokens: {
            'color.primary': { description: 'Primary', default: '#111', dark: '#eee' },
          },
        },
      },
    });
    expect(registry.size).toBe(1);
    const color = registry.get('color')!;
    expect(color.type).toBe('color');
    expect(color.darkPrefix).toBe('color.dark');
    const entry = color.entries.get('color.primary')!;
    expect(entry.description).toBe('Primary');
    expect(entry.defaultValue).toBe('#111');
    expect(entry.darkKey).toBe('color.dark.primary');
  });

  it('parses multiple categories', () => {
    const registry = parseTokenRegistry({
      $formspecTokenRegistry: '1.0',
      categories: {
        color: { type: 'color', tokens: { 'color.bg': { default: '#fff' } } },
        spacing: { type: 'dimension', tokens: { 'spacing.sm': { default: '0.5rem' } } },
      },
    });
    expect(registry.size).toBe(2);
    expect(registry.get('spacing')!.type).toBe('dimension');
  });

  it('omits darkKey when category has no darkPrefix', () => {
    const registry = parseTokenRegistry({
      $formspecTokenRegistry: '1.0',
      categories: {
        spacing: {
          type: 'dimension',
          tokens: { 'spacing.sm': { default: '0.5rem' } },
        },
      },
    });
    const entry = registry.get('spacing')!.entries.get('spacing.sm')!;
    expect(entry.darkKey).toBeUndefined();
  });
});

// ── 12. getTokenRegistryEntry ─────────────────────────────────────────

describe('getTokenRegistryEntry', () => {
  const registry = parseTokenRegistry({
    $formspecTokenRegistry: '1.0',
    categories: {
      color: { type: 'color', tokens: { 'color.primary': { description: 'Primary', default: '#111' } } },
      spacing: { type: 'dimension', tokens: { 'spacing.sm': { default: '0.5rem' } } },
    },
  });

  it('finds an entry across categories', () => {
    const entry = getTokenRegistryEntry('spacing.sm', registry);
    expect(entry).toBeDefined();
    expect(entry!.defaultValue).toBe('0.5rem');
  });

  it('returns undefined for unknown key', () => {
    expect(getTokenRegistryEntry('nonexistent.token', registry)).toBeUndefined();
  });
});

// ── 13. getEnrichedTokensByGroup ──────────────────────────────────────

describe('getEnrichedTokensByGroup', () => {
  const registry = parseTokenRegistry({
    $formspecTokenRegistry: '1.0',
    categories: {
      color: {
        type: 'color',
        darkPrefix: 'color.dark',
        tokens: {
          'color.primary': { description: 'Primary', default: '#111', dark: '#eee' },
          'color.error': { description: 'Error', default: '#f00', dark: '#faa' },
        },
      },
    },
  });

  it('enriches tokens with registry metadata', () => {
    const tokens = {
      'color.primary': '#222',
      'color.dark.primary': '#ddd',
      'color.error': '#f00',
      'color.dark.error': '#faa',
    };
    const enriched = getEnrichedTokensByGroup(tokens, 'color', registry);
    expect(enriched).toHaveLength(2); // dark tokens folded in
    const primary = enriched.find(t => t.key === 'color.primary')!;
    expect(primary.description).toBe('Primary');
    expect(primary.type).toBe('color');
    expect(primary.isModified).toBe(true); // #222 !== #111
    expect(primary.darkValue).toBe('#ddd');
    expect(primary.darkKey).toBe('color.dark.primary');
  });

  it('shows platform tokens even when theme omits them', () => {
    const tokens = { 'color.primary': '#222', 'color.dark.primary': '#ddd' };
    const enriched = getEnrichedTokensByGroup(tokens, 'color', registry);
    expect(enriched).toHaveLength(2);
    const error = enriched.find(t => t.key === 'color.error')!;
    expect(error.value).toBe('#f00'); // uses default
    expect(error.isModified).toBe(false);
  });

  it('includes custom tokens not in registry', () => {
    const tokens = {
      'color.primary': '#111',
      'color.dark.primary': '#eee',
      'color.custom': '#abc',
    };
    const enriched = getEnrichedTokensByGroup(tokens, 'color', registry);
    const custom = enriched.find(t => t.key === 'color.custom')!;
    expect(custom.isCustom).toBe(true);
  });

  it('works without a registry (all tokens are custom)', () => {
    const tokens = { 'color.primary': '#111', 'color.accent': '#222' };
    const enriched = getEnrichedTokensByGroup(tokens, 'color');
    expect(enriched).toHaveLength(2);
    expect(enriched.every(t => t.isCustom)).toBe(true);
  });
});

// ── 14. getEnrichedGroupedTokens ──────────────────────────────────────

describe('getEnrichedGroupedTokens', () => {
  const registry = parseTokenRegistry({
    $formspecTokenRegistry: '1.0',
    categories: {
      color: {
        type: 'color',
        darkPrefix: 'color.dark',
        tokens: {
          'color.primary': { description: 'Primary', default: '#111', dark: '#eee' },
        },
      },
      spacing: {
        type: 'dimension',
        tokens: {
          'spacing.sm': { default: '0.5rem' },
        },
      },
    },
  });

  it('returns registry categories even with empty theme', () => {
    const groups = getEnrichedGroupedTokens({}, registry);
    expect(groups.has('color')).toBe(true);
    expect(groups.has('spacing')).toBe(true);
  });

  it('includes custom groups not in registry', () => {
    const tokens = { 'color.primary': '#111', 'brand.logo': 'url(...)' };
    const groups = getEnrichedGroupedTokens(tokens, registry);
    expect(groups.has('brand')).toBe(true);
    expect(groups.get('brand')![0].isCustom).toBe(true);
  });

  it('folds dark tokens into their parent group', () => {
    const tokens = { 'color.primary': '#222', 'color.dark.primary': '#ddd' };
    const groups = getEnrichedGroupedTokens(tokens, registry);
    // color.dark should NOT appear as a separate group
    expect(groups.has('color')).toBe(true);
    expect(groups.has('color.dark')).toBe(false);
  });

  it('works without a registry', () => {
    const tokens = { 'color.primary': '#111', 'spacing.sm': '0.5rem' };
    const groups = getEnrichedGroupedTokens(tokens);
    expect(groups.has('color')).toBe(true);
    expect(groups.has('spacing')).toBe(true);
  });
});

describe('affectedPaths for theme/mapping/screener helpers', () => {
  it('setToken returns token key in affectedPaths', () => {
    const project = createProject();
    const result = project.setToken('color.primary', '#ff0000');
    expect(result.affectedPaths).toEqual(['color.primary']);
  });

  it('setThemeDefault returns property in affectedPaths', () => {
    const project = createProject();
    const result = project.setThemeDefault('labelPosition', 'top');
    expect(result.affectedPaths).toEqual(['labelPosition']);
  });

  it('setBreakpoint returns breakpoint name in affectedPaths', () => {
    const project = createProject();
    const result = project.setBreakpoint('desktop', 1024);
    expect(result.affectedPaths).toEqual(['desktop']);
  });

  it('addThemeSelector returns selectors in affectedPaths', () => {
    const project = createProject();
    const result = project.addThemeSelector({ type: 'field' }, { labelPosition: 'side' });
    expect(result.affectedPaths).toEqual(['selectors']);
  });

  it('setLocaleString returns key in affectedPaths', () => {
    const project = createProject();
    project.core.dispatch({ type: 'locale.load', payload: { document: { locale: 'en' } } });
    project.core.dispatch({ type: 'locale.select', payload: { localeId: 'en' } });
    const result = project.setLocaleString('welcome', 'Welcome!');
    expect(result.affectedPaths).toEqual(['welcome']);
  });

  it('createMapping returns mapping id in affectedPaths', () => {
    const project = createProject();
    const result = project.createMapping('export-csv');
    expect(result.affectedPaths).toEqual(['export-csv']);
  });

  it('setMappingProperty returns mapping id in affectedPaths', () => {
    const project = createProject();
    project.createMapping('export');
    const result = project.setMappingProperty('name', 'Export', 'export');
    expect(result.affectedPaths).toEqual(['export']);
  });

  it('setMappingProperty without mappingId returns default in affectedPaths', () => {
    const project = createProject();
    const result = project.setMappingProperty('name', 'Default');
    expect(result.affectedPaths).toEqual(['default']);
  });

  it('deleteMapping returns mapping id in affectedPaths', () => {
    const project = createProject();
    project.createMapping('extra');
    const result = project.deleteMapping('extra');
    expect(result.affectedPaths).toEqual(['extra']);
  });

  it('createScreenerDocument returns screener in affectedPaths', () => {
    const project = createProject();
    const result = project.createScreenerDocument();
    expect(result.affectedPaths).toEqual(['screener']);
  });

  it('addEvaluationPhase returns phase id in affectedPaths', () => {
    const project = createProject();
    project.createScreenerDocument();
    const result = project.addEvaluationPhase('eligibility', 'score');
    expect(result.affectedPaths).toEqual(['eligibility']);
  });

  it('addScreenRoute returns phase id in affectedPaths', () => {
    const project = createProject();
    project.createScreenerDocument();
    const result = project.addScreenRoute('default', { target: '/next' });
    expect(result.affectedPaths).toEqual(['default']);
  });
});
