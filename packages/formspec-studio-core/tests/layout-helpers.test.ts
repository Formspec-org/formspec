/** @filedesc Tests for spatial and theme override helpers in layout-helpers. */
import { describe, expect, it } from 'vitest';
import { createProject } from '../src/project.js';
import type { CompNode } from '../src/layout-helpers.js';
import {
  componentTreeForLayout,
  setColumnSpan,
  setRowSpan,
  setPadding,
  setStyleProperty,
  removeStyleProperty,
  getPropertySources,
  getEditableThemeProperties,
  setThemeOverride,
  clearThemeOverride,
} from '../src/layout-helpers.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeProject() {
  const p = createProject();
  p.addField('name', 'Name', 'text');
  p.addField('email', 'Email', 'email');
  return p;
}

/**
 * Get the component tree node bound to a given key.
 * Walks the full tree depth-first.
 */
function findNode(project: ReturnType<typeof createProject>, bind: string): CompNode | undefined {
  const root = componentTreeForLayout(project.component);
  if (!root) return undefined;

  const stack: CompNode[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.bind === bind) return node;
    for (const child of node.children ?? []) stack.push(child);
  }
  return undefined;
}

// ── setColumnSpan ────────────────────────────────────────────────────

describe('setColumnSpan', () => {
  it('writes style.gridColumn = "span N" on the node', () => {
    const p = makeProject();
    const node = findNode(p, 'name');
    expect(node).toBeDefined();
    const ref = { bind: 'name' };

    setColumnSpan(p, ref, 2);

    const updated = findNode(p, 'name')!;
    expect(updated.style?.gridColumn).toBe('span 2');
  });

  it('clamps n < 1 to 1', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setColumnSpan(p, ref, 0);
    expect(findNode(p, 'name')?.style?.gridColumn).toBe('span 1');
  });

  it('clamps n > 12 to 12', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setColumnSpan(p, ref, 13);
    expect(findNode(p, 'name')?.style?.gridColumn).toBe('span 12');
  });

  it('preserves existing style keys (does not clobber padding)', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    // First set padding directly
    setPadding(p, ref, '16px');
    // Then set column span
    setColumnSpan(p, ref, 3);
    const node = findNode(p, 'name')!;
    expect(node.style?.gridColumn).toBe('span 3');
    expect(node.style?.padding).toBe('16px');
  });
});

// ── setRowSpan ────────────────────────────────────────────────────────

describe('setRowSpan', () => {
  it('writes style.gridRow = "span N" on the node', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setRowSpan(p, ref, 2);
    expect(findNode(p, 'name')?.style?.gridRow).toBe('span 2');
  });

  it('clamps n < 1 to 1', () => {
    const p = makeProject();
    setRowSpan(p, { bind: 'name' }, 0);
    expect(findNode(p, 'name')?.style?.gridRow).toBe('span 1');
  });

  it('clamps n > 12 to 12', () => {
    const p = makeProject();
    setRowSpan(p, { bind: 'name' }, 15);
    expect(findNode(p, 'name')?.style?.gridRow).toBe('span 12');
  });

  it('preserves existing style.gridColumn when setting gridRow', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setColumnSpan(p, ref, 4);
    setRowSpan(p, ref, 2);
    const node = findNode(p, 'name')!;
    expect(node.style?.gridColumn).toBe('span 4');
    expect(node.style?.gridRow).toBe('span 2');
  });
});

// ── setPadding ────────────────────────────────────────────────────────

describe('setPadding', () => {
  it('writes style.padding on the node', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setPadding(p, ref, '8px');
    expect(findNode(p, 'name')?.style?.padding).toBe('8px');
  });

  it('preserves existing style.gridColumn when setting padding', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setColumnSpan(p, ref, 3);
    setPadding(p, ref, '12px');
    const node = findNode(p, 'name')!;
    expect(node.style?.padding).toBe('12px');
    expect(node.style?.gridColumn).toBe('span 3');
  });
});

// ── setStyleProperty / removeStyleProperty ───────────────────────────

describe('setStyleProperty', () => {
  it('adds a style property to a field node', () => {
    const p = makeProject();
    setStyleProperty(p, { bind: 'name' }, 'color', 'red');
    expect(findNode(p, 'name')?.style?.color).toBe('red');
  });

  it('adds a style property to a layout node', () => {
    const p = makeProject();
    const result = p.addLayoutNode('root', 'Card');
    const nodeId = result.createdId!;
    setStyleProperty(p, { nodeId }, 'padding', '8px');
    // The node is a layout-only node; verify through the tree
    const tree = componentTreeForLayout(p.component);
    const layoutNode = tree?.children?.find((c) => c.nodeId === nodeId);
    expect(layoutNode?.style?.padding).toBe('8px');
  });
});

describe('removeStyleProperty', () => {
  it('removes a style property from a field node', () => {
    const p = makeProject();
    const ref = { bind: 'name' };
    setStyleProperty(p, ref, 'color', 'red');
    setStyleProperty(p, ref, 'padding', '8px');
    removeStyleProperty(p, ref, 'color');
    const node = findNode(p, 'name')!;
    expect(node.style?.color).toBeUndefined();
    expect(node.style?.padding).toBe('8px');
  });

  it('removes a style property from a layout node', () => {
    const p = makeProject();
    const result = p.addLayoutNode('root', 'Card');
    const nodeId = result.createdId!;
    setStyleProperty(p, { nodeId }, 'padding', '8px');
    setStyleProperty(p, { nodeId }, 'margin', '4px');
    removeStyleProperty(p, { nodeId }, 'padding');
    const tree = componentTreeForLayout(p.component);
    const layoutNode = tree?.children?.find((c) => c.nodeId === nodeId);
    expect(layoutNode?.style?.padding).toBeUndefined();
    expect(layoutNode?.style?.margin).toBe('4px');
  });

  it('is a no-op when the property does not exist', () => {
    const p = makeProject();
    expect(() => removeStyleProperty(p, { bind: 'name' }, 'nonexistent')).not.toThrow();
  });
});

// ── getPropertySources ────────────────────────────────────────────────

describe('getPropertySources', () => {
  it('returns empty array when no cascade levels have the property', () => {
    const p = makeProject();
    const sources = getPropertySources(p, 'name', 'labelPosition');
    expect(sources).toEqual([]);
  });

  it('returns source from theme defaults (level 1)', () => {
    const p = makeProject();
    p.setThemeDefault('labelPosition', 'top');

    const sources = getPropertySources(p, 'name', 'labelPosition');
    expect(sources.length).toBeGreaterThan(0);
    const defaultSource = sources.find((s) => s.source === 'default');
    expect(defaultSource).toBeDefined();
    expect(defaultSource?.value).toBe('top');
  });

  it('returns source from item override (level 3)', () => {
    const p = makeProject();
    p.setItemOverride('name', 'labelPosition', 'start');

    const sources = getPropertySources(p, 'name', 'labelPosition');
    const override = sources.find((s) => s.source === 'item-override');
    expect(override).toBeDefined();
    expect(override?.value).toBe('start');
  });

  it('returns multiple sources when multiple cascade levels have the property', () => {
    const p = makeProject();
    p.setThemeDefault('labelPosition', 'top');
    p.setItemOverride('name', 'labelPosition', 'start');

    const sources = getPropertySources(p, 'name', 'labelPosition');
    expect(sources.length).toBe(2);
    const levels = sources.map((s) => s.source);
    expect(levels).toContain('default');
    expect(levels).toContain('item-override');
  });

  it('returns sources in ascending level order (default before item-override)', () => {
    const p = makeProject();
    p.setThemeDefault('labelPosition', 'top');
    p.setItemOverride('name', 'labelPosition', 'start');

    const sources = getPropertySources(p, 'name', 'labelPosition');
    expect(sources[0].source).toBe('default');
    expect(sources[sources.length - 1].source).toBe('item-override');
  });

  it('includes only selectors whose match.type matches itemType', () => {
    const p = makeProject();
    p.addThemeSelector({ type: 'field' }, { labelPosition: 'side' });
    p.addThemeSelector({ type: 'display' }, { labelPosition: 'none' });

    const sources = getPropertySources(p, 'name', 'labelPosition', 'field');
    const selectorSources = sources.filter((s) => s.source === 'selector');
    // Only the 'field' selector should match
    expect(selectorSources.length).toBe(1);
    expect(selectorSources[0].value).toBe('side');
  });

  it('includes only selectors whose match.dataType matches itemDataType', () => {
    const p = makeProject();
    p.addThemeSelector({ type: 'field', dataType: 'email' }, { widget: 'EmailInput' });
    p.addThemeSelector({ type: 'field', dataType: 'text' }, { widget: 'TextInput' });

    // email field: only the email dataType selector should match
    const emailSources = getPropertySources(p, 'email', 'widget', 'field', 'email');
    const emailSelectors = emailSources.filter((s) => s.source === 'selector');
    expect(emailSelectors.length).toBe(1);
    expect(emailSelectors[0].value).toBe('EmailInput');

    // text field: only the text dataType selector should match
    const textSources = getPropertySources(p, 'name', 'widget', 'field', 'text');
    const textSelectors = textSources.filter((s) => s.source === 'selector');
    expect(textSelectors.length).toBe(1);
    expect(textSelectors[0].value).toBe('TextInput');
  });

  it('includes selectors with no match criteria for any itemType', () => {
    const p = makeProject();
    p.addThemeSelector({}, { labelPosition: 'top' });

    // Should match regardless of itemType since match has no type/dataType constraints
    const sources = getPropertySources(p, 'name', 'labelPosition', 'field');
    const selectorSources = sources.filter((s) => s.source === 'selector');
    expect(selectorSources.length).toBeGreaterThan(0);
  });
});

// ── getEditableThemeProperties ────────────────────────────────────────

describe('getEditableThemeProperties', () => {
  it('returns typed descriptors for PresentationBlock-editable properties', () => {
    const p = makeProject();
    const props = getEditableThemeProperties(p, 'name');
    const propNames = props.map((d) => d.prop);
    expect(propNames).toEqual([
      'labelPosition',
      'widget',
      'widgetConfig',
      'style',
      'cssClass',
      'accessibility',
      'fallback',
    ]);
  });

  it('returns enum type with options for labelPosition', () => {
    const p = makeProject();
    const props = getEditableThemeProperties(p, 'name');
    const labelPos = props.find((d) => d.prop === 'labelPosition');
    expect(labelPos?.type).toBe('enum');
    expect(labelPos?.options).toEqual(['top', 'start', 'hidden']);
  });

  it('returns the same descriptors for fields with the same component', () => {
    const p = makeProject();
    const nameProps = getEditableThemeProperties(p, 'name').map((d) => d.prop);
    const emailProps = getEditableThemeProperties(p, 'email').map((d) => d.prop);
    expect(nameProps).toEqual(emailProps);
  });
});

// ── setThemeOverride ─────────────────────────────────────────────────

describe('setThemeOverride', () => {
  it('sets a per-item theme override via project.setItemOverride', () => {
    const p = makeProject();
    setThemeOverride(p, 'name', 'labelPosition', 'start');
    const items = p.state.theme.items ?? {};
    expect(items['name']?.labelPosition).toBe('start');
  });

  it('returns a HelperResult with expected shape', () => {
    const p = makeProject();
    const result = setThemeOverride(p, 'name', 'labelPosition', 'top');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('affectedPaths');
    expect(result.affectedPaths).toContain('name');
  });
});

// ── clearThemeOverride ───────────────────────────────────────────────

describe('clearThemeOverride', () => {
  it('removes a single per-item theme override', () => {
    const p = makeProject();
    p.setItemOverride('name', 'labelPosition', 'start');
    p.setItemOverride('name', 'cssClass', 'highlight');

    clearThemeOverride(p, 'name', 'labelPosition');

    const items = p.state.theme.items ?? {};
    expect(items['name']?.labelPosition).toBeUndefined();
    // Other overrides preserved
    expect(items['name']?.cssClass).toBe('highlight');
  });

  it('returns a HelperResult with expected shape', () => {
    const p = makeProject();
    p.setItemOverride('name', 'labelPosition', 'top');
    const result = clearThemeOverride(p, 'name', 'labelPosition');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('affectedPaths');
    expect(result.affectedPaths).toContain('name');
  });

  it('is a no-op when no override exists', () => {
    const p = makeProject();
    // Should not throw
    expect(() => clearThemeOverride(p, 'name', 'labelPosition')).not.toThrow();
  });
});
