import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import {
  handleField,
  handleContent,
  handleGroup,
  handleUpdate,
  handleEdit,
  editMissingAction,
  handlePage,
  handlePlace,
  handleSubmitButton,
} from '../src/tools/structure.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleField ──────────────────────────────────────────────────

describe('handleField', () => {
  it('adds a field (single mode)', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, { path: 'name', label: 'Full Name', type: 'text' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
  });

  it('returns error for unknown field type', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'not_a_real_type' });
    expect(result.isError).toBe(true);
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });
    expect(parseResult(result).code).toBe('WRONG_PHASE');
  });

  it('accepts optional props', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, {
      path: 'email', label: 'Email', type: 'email',
      props: { placeholder: 'you@example.com', required: true },
    });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('email');
  });

  // ── Batch mode ──

  it('adds multiple fields in batch mode', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, {
      items: [
        { path: 'name', label: 'Name', type: 'text' },
        { path: 'email', label: 'Email', type: 'email' },
        { path: 'phone', label: 'Phone', type: 'text' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(3);
    expect(data.failed).toBe(0);
    expect(data.results).toHaveLength(3);
  });

  it('handles partial failure in batch mode', () => {
    const { registry, projectId } = registryWithProject();
    // Add a field first, then try to batch-add a duplicate
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleField(registry, projectId, {
      items: [
        { path: 'name', label: 'Duplicate', type: 'text' }, // will fail
        { path: 'email', label: 'Email', type: 'email' },   // should succeed
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined(); // partial success is not an error
    expect(data.succeeded).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.results[0].success).toBe(false);
    expect(data.results[1].success).toBe(true);
  });

  it('returns error when all batch items fail', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleField(registry, projectId, {
      items: [
        { path: 'a', label: 'A', type: 'text' },
      ],
    });
    // WRONG_PHASE throws before batch even starts
    expect(result.isError).toBe(true);
  });
});

// ── handleContent ────────────────────────────────────────────────

describe('handleContent', () => {
  it('adds content with kind', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, { path: 'intro', body: 'Welcome', kind: 'heading' });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('intro');
  });

  it('adds content without kind', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, { path: 'note', body: 'Please read' });
    expect(result.isError).toBeUndefined();
  });

  it('batch adds multiple content items', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, {
      items: [
        { path: 'h1', body: 'Title', kind: 'heading' },
        { path: 'p1', body: 'Description', kind: 'paragraph' },
      ],
    });
    const data = parseResult(result);
    expect(data.succeeded).toBe(2);
  });

  it('places content on a page when props.page is provided', () => {
    const { registry, projectId, project } = registryWithProject();
    const pageResult = project.addPage('Page One');
    const pageId = pageResult.createdId!;
    const groupKey = pageResult.affectedPaths[0];

    // Content must go inside the page's group in a paged definition
    const result = handleContent(registry, projectId, {
      path: `${groupKey}.intro`,
      body: 'Welcome',
      kind: 'heading',
      props: { page: pageId },
    });

    expect(result.isError).toBeUndefined();
    // Content was placed inside the page's group — verify it exists in the definition
    const def = (project.core as any).state.definition;
    const group = (def.items ?? []).find((i: any) => i.key === groupKey);
    expect(group).toBeDefined();
    const contentItem = (group.children ?? []).find((c: any) => c.key === 'intro');
    expect(contentItem).toBeDefined();
  });

  it('returns PAGE_NOT_FOUND error when props.page does not exist', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, {
      path: 'intro',
      body: 'Welcome',
      props: { page: 'no-such-page' },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('PAGE_NOT_FOUND');
  });

  it('adds content inside a group via parentPath prop', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });
    const result = handleContent(registry, projectId, {
      path: 'heading',
      body: 'Section Title',
      kind: 'heading',
      props: { parentPath: 'section' },
    });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('section.heading');
  });
});

// ── handleGroup ──────────────────────────────────────────────────

describe('handleGroup', () => {
  it('adds a group', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleGroup(registry, projectId, { path: 'address', label: 'Address' });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('address');
  });

  it('adds a group with repeat config in props', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleGroup(registry, projectId, {
      path: 'items',
      label: 'Line Items',
      props: { repeat: { min: 1, max: 10 } },
    });
    expect(result.isError).toBeUndefined();
  });

  it('batch adds multiple groups', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleGroup(registry, projectId, {
      items: [
        { path: 'personal', label: 'Personal Info' },
        { path: 'work', label: 'Work Info' },
      ],
    });
    const data = parseResult(result);
    expect(data.succeeded).toBe(2);
  });

  it('adds nested group via parentPath prop', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'outer', label: 'Outer' });
    const result = handleGroup(registry, projectId, {
      path: 'inner',
      label: 'Inner',
      props: { parentPath: 'outer' },
    });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result).affectedPaths).toContain('outer.inner');
  });
});

// ── handleUpdate ─────────────────────────────────────────────────

describe('handleUpdate', () => {
  it('updates item properties', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleUpdate(registry, projectId, 'item', {
      path: 'name', changes: { label: 'Full Name' },
    });
    expect(result.isError).toBeUndefined();
  });

  it('updates form metadata', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleUpdate(registry, projectId, 'metadata', {
      changes: { title: 'My Form', description: 'A test form' },
    });
    expect(result.isError).toBeUndefined();
  });

  it('translates nested repeat shape to flat keys', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'items', label: 'Items' });

    const result = handleUpdate(registry, projectId, 'item', {
      path: 'items',
      changes: { repeat: { min: 1, max: 5 } } as Record<string, unknown>,
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.affectedPaths).toContain('items');
  });

  it('translates nested repeat with only min (no max)', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'lines', label: 'Lines' });

    const result = handleUpdate(registry, projectId, 'item', {
      path: 'lines',
      changes: { repeat: { min: 1 } } as Record<string, unknown>,
    });
    expect(result.isError).toBeUndefined();
  });

  it('rejects unknown top-level keys even after repeat expansion', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'items', label: 'Items' });

    const result = handleUpdate(registry, projectId, 'item', {
      path: 'items',
      changes: { bogusKey: 42 } as Record<string, unknown>,
    });
    expect(result.isError).toBe(true);
  });
});

// ── handleEdit ───────────────────────────────────────────────────

describe('handleEdit', () => {
  it('removes an item', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'temp', label: 'Temp', type: 'text' });

    const result = handleEdit(registry, projectId, 'remove', { path: 'temp' });
    expect(result.isError).toBeUndefined();
  });

  it('copies an item', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleEdit(registry, projectId, 'copy', { path: 'name' });
    expect(result.isError).toBeUndefined();
  });

  it('copies an item to a target group via target_path', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'individual', label: 'Individual' });
    handleField(registry, projectId, { path: 'individual.phone', label: 'Phone', type: 'text' });
    handleGroup(registry, projectId, { path: 'business', label: 'Business' });

    const result = handleEdit(registry, projectId, 'copy', {
      path: 'individual.phone',
      target_path: 'business',
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.affectedPaths[0]).toBe('business.phone');
  });

  it('copies an item to target in batch mode', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'src', label: 'Source' });
    handleField(registry, projectId, { path: 'src.email', label: 'Email', type: 'email' });
    handleGroup(registry, projectId, { path: 'dest', label: 'Dest' });

    const result = handleEdit(registry, projectId, 'copy', {
      items: [
        { path: 'src.email', target_path: 'dest' },
      ],
    });
    const data = parseResult(result);
    expect(data.succeeded).toBe(1);
    expect(data.results[0].success).toBe(true);
    // Verify the item actually landed in the target group
    const project = registry.getProject(projectId);
    expect(project.itemAt('dest.email')).toBeDefined();
  });

  it('renames an item', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleEdit(registry, projectId, 'rename', { path: 'name', new_key: 'full_name' });
    expect(result.isError).toBeUndefined();
  });

  // ── Batch mode ──

  it('batch moves multiple items into a group', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });
    handleField(registry, projectId, { path: 'phone', label: 'Phone', type: 'text' });

    const result = handleEdit(registry, projectId, 'move', {
      items: [
        { path: 'name', target_path: 'section' },
        { path: 'email', target_path: 'section' },
        { path: 'phone', target_path: 'section' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(3);
    expect(data.failed).toBe(0);
    expect(data.results).toHaveLength(3);
  });

  it('batch move reports partial failure', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, { path: 'section', label: 'Section' });
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleEdit(registry, projectId, 'move', {
      items: [
        { path: 'name', target_path: 'section' },
        { path: 'nonexistent', target_path: 'section' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.results[0].success).toBe(true);
    expect(data.results[1].success).toBe(false);
  });

  it('batch returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleEdit(registry, projectId, 'move', {
      items: [{ path: 'a', target_path: 'b' }],
    });
    expect(result.isError).toBe(true);
  });

  it('batch uses per-item action when top-level action is a fallback', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });
    handleField(registry, projectId, { path: 'b', label: 'B', type: 'text' });

    // Top-level action is 'remove' but items override with their own actions
    const result = handleEdit(registry, projectId, 'remove', {
      items: [
        { path: 'a', action: 'copy' },
        { path: 'b', action: 'remove' },
      ],
    });
    const data = parseResult(result);
    expect(data.succeeded).toBe(2);
  });

  it('returns MISSING_ACTION when no action and no items', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });

    const result = editMissingAction();
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.code).toBe('MISSING_ACTION');
  });
});

// ── handlePage ───────────────────────────────────────────────────

describe('handlePage', () => {
  it('adds a page', () => {
    const { registry, projectId } = registryWithProject();
    const result = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    expect(result.isError).toBeUndefined();
  });

  it('removes a page', () => {
    const { registry, projectId } = registryWithProject();
    const addResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const addResult2 = handlePage(registry, projectId, 'add', { title: 'Page 2' });
    const pageId = parseResult(addResult).createdId;

    const result = handlePage(registry, projectId, 'remove', { page_id: pageId });
    expect(result.isError).toBeUndefined();
  });

  it('adds a page with a custom ID', () => {
    const { registry, projectId } = registryWithProject();
    const result = handlePage(registry, projectId, 'add', { title: 'Page 1', page_id: 'basics' });
    const data = parseResult(result);
    expect(data.createdId).toBe('basics');
  });

  it('rejects invalid custom page ID', () => {
    const { registry, projectId } = registryWithProject();
    const result = handlePage(registry, projectId, 'add', { title: 'Bad', page_id: '1invalid' });
    expect(result.isError).toBe(true);
  });

  it('lists pages', () => {
    const { registry, projectId } = registryWithProject();
    handlePage(registry, projectId, 'add', { title: 'Step 1', page_id: 's1' });
    handlePage(registry, projectId, 'add', { title: 'Step 2', page_id: 's2', description: 'Second' });

    const result = handlePage(registry, projectId, 'list', {});
    const data = parseResult(result);
    expect(data.pages).toHaveLength(2);
    expect(data.pages[0].id).toBe('s1');
    expect(data.pages[1].description).toBe('Second');
  });

  it('lists pages returns empty array for fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handlePage(registry, projectId, 'list', {});
    const data = parseResult(result);
    expect(data.pages).toEqual([]);
  });
});

// ── handlePlace ──────────────────────────────────────────────────

describe('handlePlace', () => {
  it('places an item on a page (single mode)', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    const pageResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const pageId = parseResult(pageResult).createdId;

    const result = handlePlace(registry, projectId, { action: 'place', target: 'name', page_id: pageId });
    expect(result.isError).toBeUndefined();
  });

  it('unplaces an item from a page (single mode)', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    const pageResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const pageId = parseResult(pageResult).createdId;
    handlePlace(registry, projectId, { action: 'place', target: 'name', page_id: pageId });

    const result = handlePlace(registry, projectId, { action: 'unplace', target: 'name', page_id: pageId });
    expect(result.isError).toBeUndefined();
  });

  // ── Batch mode ──

  it('places multiple items on a page in one call', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });
    handleField(registry, projectId, { path: 'phone', label: 'Phone', type: 'text' });
    const pageResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const pageId = parseResult(pageResult).createdId;

    const result = handlePlace(registry, projectId, {
      items: [
        { action: 'place', target: 'name', page_id: pageId },
        { action: 'place', target: 'email', page_id: pageId },
        { action: 'place', target: 'phone', page_id: pageId },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(3);
    expect(data.failed).toBe(0);
    expect(data.results).toHaveLength(3);
  });

  it('supports mixed place and unplace in one batch', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });
    const pageResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const pageId = parseResult(pageResult).createdId;

    // Place both first
    handlePlace(registry, projectId, { action: 'place', target: 'name', page_id: pageId });
    handlePlace(registry, projectId, { action: 'place', target: 'email', page_id: pageId });

    // Now batch unplace both
    const result = handlePlace(registry, projectId, {
      items: [
        { action: 'unplace', target: 'name', page_id: pageId },
        { action: 'unplace', target: 'email', page_id: pageId },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(0);
  });

  it('handles partial failure in batch (invalid page)', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });
    const pageResult = handlePage(registry, projectId, 'add', { title: 'Page 1' });
    const pageId = parseResult(pageResult).createdId;

    const result = handlePlace(registry, projectId, {
      items: [
        { action: 'place', target: 'name', page_id: pageId },
        { action: 'place', target: 'email', page_id: 'no-such-page' }, // should fail
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined(); // partial success is not an error
    expect(data.succeeded).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.results[0].success).toBe(true);
    expect(data.results[1].success).toBe(false);
  });

  it('returns WRONG_PHASE error in batch during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handlePlace(registry, projectId, {
      items: [
        { action: 'place', target: 'name', page_id: 'page1' },
      ],
    });
    expect(result.isError).toBe(true);
  });
});

// ── handleSubmitButton ───────────────────────────────────────────

describe('handleSubmitButton', () => {
  it('adds a submit button', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleSubmitButton(registry, projectId);
    expect(result.isError).toBeUndefined();
  });
});
