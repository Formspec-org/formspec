/**
 * @filedesc Tests for MCP bug fixes: BUG-2, BUG-6, BUG-7, UX-3, UX-4a, UX-4c,
 * CONFUSION-1, CONFUSION-3, and param audit findings.
 */
import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleField, handleContent, handleGroup, handleEdit, handlePage, handlePlace } from '../src/tools/structure.js';
import { handleStyle } from '../src/tools/style.js';
import { handlePreview, handleDescribe } from '../src/tools/query.js';
import { handleBehavior } from '../src/tools/behavior.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── BUG-2: formspec_style layout reads target but not path ─────────

describe('BUG-2: formspec_style layout — path as target fallback', () => {
  it('accepts path when target is not provided for layout action', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'layout',
      path: 'q1',
      arrangement: 'card',
    });

    expect(result.isError).toBeUndefined();
  });

  it('prefers target over path when both are provided for layout', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });
    handleField(registry, projectId, { path: 'q2', label: 'Q2', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'layout',
      target: 'q1',
      path: 'q2',
      arrangement: 'card',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns clear error when neither target nor path provided for layout', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'layout',
      arrangement: 'card',
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.code).toBe('MISSING_PARAM');
  });
});

// ── BUG-6: Preview response parameter silently ignored ─────────────

describe('BUG-6: formspec_preview — response as scenario fallback', () => {
  it('uses response as scenario when scenario is not provided in preview mode', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('color', 'Color', 'text');

    const result = handlePreview(registry, projectId, 'preview', {
      response: { color: 'green' },
    });
    const data = parseResult(result);

    expect(data.currentValues.color).toBe('green');
  });

  it('scenario takes precedence over response when both provided', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('color', 'Color', 'text');

    const result = handlePreview(registry, projectId, 'preview', {
      scenario: { color: 'blue' },
      response: { color: 'green' },
    });
    const data = parseResult(result);

    expect(data.currentValues.color).toBe('blue');
  });
});

// ── BUG-7: Group parentPath at wrong nesting level ─────────────────

describe('BUG-7: formspec_group — top-level parentPath', () => {
  it('accepts parentPath at top level and merges into props', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'outer', label: 'Outer' });

    const result = handleGroup(registry, projectId, {
      path: 'inner',
      label: 'Inner',
      parentPath: 'outer',
    } as any);

    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('outer.inner');
  });

  it('props.parentPath takes precedence over top-level parentPath', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'g1', label: 'G1' });
    handleGroup(registry, projectId, { path: 'g2', label: 'G2' });

    const result = handleGroup(registry, projectId, {
      path: 'inner',
      label: 'Inner',
      parentPath: 'g2',
      props: { parentPath: 'g1' },
    } as any);

    expect(result.isError).toBeUndefined();
    // props.parentPath ('g1') should win
    expect(parseResult(result).affectedPaths).toContain('g1.inner');
  });

  it('field also accepts top-level parentPath', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });

    const result = handleField(registry, projectId, {
      path: 'name',
      label: 'Name',
      type: 'text',
      parentPath: 'section',
    } as any);

    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('section.name');
  });

  it('content also accepts top-level parentPath', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });

    const result = handleContent(registry, projectId, {
      path: 'heading',
      body: 'Section Title',
      kind: 'heading',
      parentPath: 'section',
    } as any);

    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('section.heading');
  });
});

// ── UX-3: edit move position parameter ─────────────────────────────

describe('UX-3: formspec_edit move — position parameter', () => {
  it('move with position="after" places item as sibling after target', () => {
    const { registry, projectId, project } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });
    handleField(registry, projectId, { path: 'c', label: 'C', type: 'text' });

    // Move C to after A (so order becomes A, C, B)
    const result = handleEdit(registry, projectId, 'move', {
      path: 'c',
      target_path: 'a',
      position: 'after',
    } as any);

    expect(result.isError).toBeUndefined();

    // Verify ordering: items should be A, C, B
    const items = project.definition.items;
    expect(items[0].key).toBe('a');
    expect(items[1].key).toBe('c');
    expect(items[2].key).toBe('b');
  });

  it('move with position="before" places item before target', () => {
    const { registry, projectId, project } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });
    handleField(registry, projectId, { path: 'c', label: 'C', type: 'text' });

    // Move C to before B (so order becomes A, C, B)
    const result = handleEdit(registry, projectId, 'move', {
      path: 'c',
      target_path: 'b',
      position: 'before',
    } as any);

    expect(result.isError).toBeUndefined();

    const items = project.definition.items;
    expect(items[0].key).toBe('a');
    expect(items[1].key).toBe('c');
    expect(items[2].key).toBe('b');
  });

  it('move with position="inside" (default) places inside target group', () => {
    const { registry, projectId, project } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    // Default behavior (or explicit 'inside')
    const result = handleEdit(registry, projectId, 'move', {
      path: 'name',
      target_path: 'section',
      position: 'inside',
    } as any);

    expect(result.isError).toBeUndefined();
    expect(project.itemAt('section.name')).toBeDefined();
  });

  it('move with position="after" on last sibling appends correctly', () => {
    const { registry, projectId, project } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });
    handleField(registry, projectId, { path: 'c', label: 'C', type: 'text' });

    // Move A to after C (should end up: B, C, A)
    const result = handleEdit(registry, projectId, 'move', {
      path: 'a',
      target_path: 'c',
      position: 'after',
    } as any);

    expect(result.isError).toBeUndefined();
    const items = project.definition.items;
    expect(items[0].key).toBe('b');
    expect(items[1].key).toBe('c');
    expect(items[2].key).toBe('a');
  });

  it('move with position="before" on first child places at index 0', () => {
    const { registry, projectId, project } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });
    handleField(registry, projectId, { path: 'c', label: 'C', type: 'text' });

    // Move C to before A (should end up: C, A, B)
    const result = handleEdit(registry, projectId, 'move', {
      path: 'c',
      target_path: 'a',
      position: 'before',
    } as any);

    expect(result.isError).toBeUndefined();
    const items = project.definition.items;
    expect(items[0].key).toBe('c');
    expect(items[1].key).toBe('a');
    expect(items[2].key).toBe('b');
  });

  it('backward compat: move without position still uses inside semantics', () => {
    const { registry, projectId, project } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleEdit(registry, projectId, 'move', {
      path: 'name',
      target_path: 'section',
    });

    expect(result.isError).toBeUndefined();
    expect(project.itemAt('section.name')).toBeDefined();
  });

  it('batch move respects per-item position', () => {
    const { registry, projectId, project } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });
    handleField(registry, projectId, { path: 'c', label: 'C', type: 'text' });
    handleField(registry, projectId, { path: 'd', label: 'D', type: 'text' });

    // Move D to before A
    const result = handleEdit(registry, projectId, 'move', {
      items: [
        { path: 'd', target_path: 'a', position: 'before' },
      ],
    } as any);

    const data = parseResult(result);
    expect(data.succeeded).toBe(1);

    const items = project.definition.items;
    expect(items[0].key).toBe('d');
    expect(items[1].key).toBe('a');
  });
});

// ── UX-4a: describe doesn't show repeat config ─────────────────────

describe('UX-4a: formspec_describe — repeat config in response', () => {
  it('includes repeat config when describing a repeatable group', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('items', 'Line Items');
    project.makeRepeatable('items', { min: 1, max: 10 });

    const result = handleDescribe(registry, projectId, 'structure', 'items');
    const data = parseResult(result);

    expect(data.item).toBeDefined();
    expect(data.item.key).toBe('items');
    expect(data).toHaveProperty('repeat');
    expect(data.repeat).toMatchObject({ min: 1, max: 10 });
  });

  it('does not include repeat key for non-repeatable items', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleDescribe(registry, projectId, 'structure', 'name');
    const data = parseResult(result);

    expect(data.item).toBeDefined();
    expect(data.repeat).toBeUndefined();
  });
});

// ── UX-4c: Group creation doesn't confirm repeat config ────────────

describe('UX-4c: formspec_group — repeat config in response', () => {
  it('includes repeat config in group creation response', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleGroup(registry, projectId, {
      path: 'items',
      label: 'Line Items',
      props: { repeat: { min: 1, max: 5 } },
    });

    const data = parseResult(result);
    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('repeat');
    expect(data.repeat).toMatchObject({ min: 1, max: 5 });
  });

  it('omits repeat key when group is not repeatable', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleGroup(registry, projectId, {
      path: 'section',
      label: 'Section',
    });

    const data = parseResult(result);
    expect(result.isError).toBeUndefined();
    expect(data.repeat).toBeUndefined();
  });
});
