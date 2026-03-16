import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import {
  handleField,
  handleContent,
  handleUpdate,
  handleRemove,
  handleCopy,
  handlePage,
  handleGroup,
  handleRepeat,
  handleMetadata,
  handleSubmitButton,
  handlePlace,
  handleUnplace,
  handleRemovePage,
  handleMovePage,
} from '../src/tools/structure.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleField ──────────────────────────────────────────────────

describe('handleField', () => {
  it('adds a field and returns affectedPaths', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, 'name', 'Full Name', 'text');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
    expect(data.summary).toBeTruthy();
  });

  it('returns error for unknown field type', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, 'q1', 'Q1', 'not_a_real_type');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleField(registry, projectId, 'q1', 'Q1', 'text');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });

  it('accepts optional props', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleField(registry, projectId, 'email', 'Email', 'email', {
      placeholder: 'you@example.com',
      required: true,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('email');
  });
});

// ── handleContent ────────────────────────────────────────────────

describe('handleContent', () => {
  it('adds content with kind', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, 'intro', 'Welcome to the form', 'heading');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('intro');
  });

  it('adds content without kind (defaults)', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleContent(registry, projectId, 'note', 'Please read carefully');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('note');
  });
});

// ── handleGroup ──────────────────────────────────────────────────

describe('handleGroup', () => {
  it('adds a group', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleGroup(registry, projectId, 'address', 'Address');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('address');
  });
});

// ── handleUpdate ─────────────────────────────────────────────────

describe('handleUpdate', () => {
  it('updates a field label', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Question 1', 'text');

    const result = handleUpdate(registry, projectId, 'q1', { label: 'Updated Label' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('q1');
  });

  it('returns error for invalid key', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Q1', 'text');

    const result = handleUpdate(registry, projectId, 'q1', { notAValidKey: 'bad' } as any);
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });
});

// ── handleRemove ─────────────────────────────────────────────────

describe('handleRemove', () => {
  it('removes a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Q1', 'text');

    const result = handleRemove(registry, projectId, 'q1');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('q1');
  });

  it('returns error for nonexistent path', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleRemove(registry, projectId, 'nonexistent');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });
});

// ── handleCopy ───────────────────────────────────────────────────

describe('handleCopy', () => {
  it('copies a field and returns new path in affectedPaths', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Q1', 'text');

    const result = handleCopy(registry, projectId, 'q1');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
    // The new path is a variant of the original (e.g. "q1_1")
    expect(data.affectedPaths[0]).toMatch(/^q1/);
  });
});

// ── handlePage ───────────────────────────────────────────────────

describe('handlePage', () => {
  it('adds a page and returns page_id in affectedPaths', () => {
    const { registry, projectId } = registryWithProject();
    const result = handlePage(registry, projectId, 'Personal Info', 'Enter your details');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });
});

// ── handleRemovePage ─────────────────────────────────────────────

describe('handleRemovePage', () => {
  it('removes a page', () => {
    const { registry, projectId } = registryWithProject();
    const pageResult = handlePage(registry, projectId, 'Temp Page');
    const pageData = parseResult(pageResult);
    const pageId = pageData.affectedPaths[0];

    // Add a second page so we can remove the first (can't delete last)
    handlePage(registry, projectId, 'Another Page');

    const result = handleRemovePage(registry, projectId, pageId);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain(pageId);
  });
});

// ── handleRepeat ─────────────────────────────────────────────────

describe('handleRepeat', () => {
  it('makes a group repeatable', () => {
    const { registry, projectId } = registryWithProject();
    handleGroup(registry, projectId, 'items', 'Items');

    const result = handleRepeat(registry, projectId, 'items', { min: 1, max: 5 });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('items');
  });
});

// ── handleMetadata ───────────────────────────────────────────────

describe('handleMetadata', () => {
  it('sets form title', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleMetadata(registry, projectId, { title: 'My Form' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toBeTruthy();
  });
});

// ── handleSubmitButton ───────────────────────────────────────────

describe('handleSubmitButton', () => {
  it('adds a submit button', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleSubmitButton(registry, projectId, 'Send');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });
});

// ── handlePlace / handleUnplace ──────────────────────────────────

describe('handlePlace', () => {
  it('places a field on a page', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Q1', 'text');
    const pageResult = handlePage(registry, projectId, 'Page 1');
    const pageId = parseResult(pageResult).affectedPaths[0];

    const result = handlePlace(registry, projectId, 'q1', pageId);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('q1');
  });
});

describe('handleUnplace', () => {
  it('unplaces a field from a page', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'q1', 'Q1', 'text');
    const pageResult = handlePage(registry, projectId, 'Page 1');
    const pageId = parseResult(pageResult).affectedPaths[0];
    handlePlace(registry, projectId, 'q1', pageId);

    const result = handleUnplace(registry, projectId, 'q1', pageId);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('q1');
  });
});

// ── handleMovePage ───────────────────────────────────────────────

describe('handleMovePage', () => {
  it('reorders a page', () => {
    const { registry, projectId } = registryWithProject();
    handlePage(registry, projectId, 'Page 1');
    const page2Result = handlePage(registry, projectId, 'Page 2');
    const page2Id = parseResult(page2Result).affectedPaths[0];

    const result = handleMovePage(registry, projectId, page2Id, 'up');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain(page2Id);
  });
});
