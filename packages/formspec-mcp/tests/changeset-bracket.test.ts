/** @filedesc Tests for withChangesetBracket integration with mutation tool handlers. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import {
  handleChangesetOpen,
  handleChangesetClose,
  withChangesetBracket,
  bracketMutation,
} from '../src/tools/changeset.js';
import { handleField, handleContent, handleGroup, handleUpdate, handleEdit, handlePage, handlePlace, handleSubmitButton } from '../src/tools/structure.js';
import { handleBehavior } from '../src/tools/behavior.js';
import { handleFlow } from '../src/tools/flow.js';
import { handleStyle } from '../src/tools/style.js';
import { handleData } from '../src/tools/data.js';
import { handleScreener } from '../src/tools/screener.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

function isError(result: unknown): boolean {
  return (result as any).isError === true;
}

describe('withChangesetBracket', () => {
  describe('records AI entries when changeset is open', () => {
    it('records a field addition as an AI entry', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      // Call handleField wrapped in withChangesetBracket
      const result = withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Full Name', type: 'text' }),
      );

      expect(isError(result)).toBe(false);

      // The changeset should have 1 AI entry
      const pm = project.proposals!;
      const cs = pm.changeset!;
      expect(cs.aiEntries).toHaveLength(1);
      expect(cs.aiEntries[0].toolName).toBe('formspec_field');
      // With O1 fix, summary comes from HelperResult, not the generic fallback
      expect(cs.aiEntries[0].summary).toContain('Added');
    });

    it('records behavior changes as an AI entry', () => {
      const { registry, projectId, project } = registryWithProject();

      // Add a field first (outside changeset)
      project.addField('email', 'Email', 'email');

      handleChangesetOpen(registry, projectId);

      const result = withChangesetBracket(project, 'formspec_behavior', () =>
        handleBehavior(registry, projectId, { action: 'require', target: 'email' }),
      );

      expect(isError(result)).toBe(false);

      const cs = project.proposals!.changeset!;
      expect(cs.aiEntries).toHaveLength(1);
      expect(cs.aiEntries[0].toolName).toBe('formspec_behavior');
    });

    it('records multiple tool calls as separate AI entries', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );

      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' }),
      );

      withChangesetBracket(project, 'formspec_content', () =>
        handleContent(registry, projectId, { path: 'intro', body: 'Welcome', kind: 'heading' }),
      );

      const cs = project.proposals!.changeset!;
      expect(cs.aiEntries).toHaveLength(3);
      expect(cs.aiEntries[0].toolName).toBe('formspec_field');
      expect(cs.aiEntries[1].toolName).toBe('formspec_field');
      expect(cs.aiEntries[2].toolName).toBe('formspec_content');
    });
  });

  describe('passes through when no changeset is open', () => {
    it('field mutation works normally without a changeset', () => {
      const { registry, projectId, project } = registryWithProject();

      // No changeset opened
      const result = withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Full Name', type: 'text' }),
      );

      expect(isError(result)).toBe(false);
      const data = parseResult(result);
      expect(data.affectedPaths).toContain('name');

      // No proposals tracking
      expect(project.proposals!.changeset).toBeNull();
    });
  });

  describe('extracts summary from HelperResult', () => {
    it('captures summary string from successful helper result', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );

      const entry = project.proposals!.changeset!.aiEntries[0];
      // The summary should come from HelperResult or fallback to tool name
      expect(entry.summary).toBeTruthy();
    });
  });

  describe('handles errors gracefully', () => {
    it('does not create an AI entry when the handler returns an error (no commands dispatched)', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      // First call succeeds
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );

      // Second call with duplicate path fails before dispatching commands
      const result = withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name Again', type: 'text' }),
      );

      expect(isError(result)).toBe(true);

      // Only the successful entry is recorded (no commands = no entry)
      const cs = project.proposals!.changeset!;
      expect(cs.aiEntries).toHaveLength(1);
    });

    it('resets actor to user after an error', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );

      // Force an error response
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name Again', type: 'text' }),
      );

      // Next successful call should still work
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' }),
      );

      const cs = project.proposals!.changeset!;
      expect(cs.aiEntries).toHaveLength(2);
      expect(cs.aiEntries[1].toolName).toBe('formspec_field');
    });

    it('handles a throwing fn by ending the entry and re-throwing', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      expect(() => {
        withChangesetBracket(project, 'formspec_field', () => {
          throw new Error('boom');
        });
      }).toThrow('boom');

      // Actor should be reset to user so subsequent calls work
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );

      const cs = project.proposals!.changeset!;
      expect(cs.aiEntries).toHaveLength(1);
    });
  });

  describe('end-to-end: bracket-wrapped tools in changeset workflow', () => {
    it('open → bracket-wrapped mutations → close → accept preserves state', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      // All mutations via withChangesetBracket
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
      );
      withChangesetBracket(project, 'formspec_field', () =>
        handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' }),
      );
      withChangesetBracket(project, 'formspec_behavior', () =>
        handleBehavior(registry, projectId, { action: 'require', target: 'email' }),
      );

      // Close
      const closeResult = handleChangesetClose(registry, projectId, 'Added fields and validation');
      const closeData = parseResult(closeResult);
      expect(closeData.ai_entry_count).toBe(3);
      expect(closeData.status).toBe('pending');

      // Verify fields exist before accept
      expect(project.definition.items.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('bracketMutation', () => {
  it('records an AI entry when changeset is open', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_field', () =>
      handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
    );

    const cs = project.proposals!.changeset!;
    expect(cs.aiEntries).toHaveLength(1);
    expect(cs.aiEntries[0].toolName).toBe('formspec_field');
  });

  it('passes through when no changeset is open', () => {
    const { registry, projectId } = registryWithProject();

    const result = bracketMutation(registry, projectId, 'formspec_field', () =>
      handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
    );

    expect(isError(result)).toBe(false);
    const data = parseResult(result);
    expect(data.affectedPaths).toContain('name');
  });

  it('falls through gracefully when project is in bootstrap phase', () => {
    const { registry, projectId } = registryInBootstrap();

    // bracketMutation should not throw — the handler produces the error response
    const result = bracketMutation(registry, projectId, 'formspec_field', () =>
      handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
    );

    expect(isError(result)).toBe(true);
    expect(parseResult(result).code).toBe('WRONG_PHASE');
  });

  it('falls through gracefully when project does not exist', () => {
    const { registry } = registryWithProject();

    const result = bracketMutation(registry, 'nonexistent-id', 'formspec_field', () =>
      handleField(registry, 'nonexistent-id', { path: 'name', label: 'Name', type: 'text' }),
    );

    expect(isError(result)).toBe(true);
    expect(parseResult(result).code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('batch items[] mode within bracket', () => {
  it('batch handleField with items[] produces entries within a changeset bracket', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    // Call handleField in batch mode (items[]) within a bracket
    const result = withChangesetBracket(project, 'formspec_field', () =>
      handleField(registry, projectId, {
        items: [
          { path: 'name', label: 'Full Name', type: 'text' },
          { path: 'email', label: 'Email', type: 'email' },
          { path: 'phone', label: 'Phone', type: 'text' },
        ],
      }),
    );

    expect(isError(result)).toBe(false);
    const data = parseResult(result);
    expect(data.succeeded).toBe(3);
    expect(data.failed).toBe(0);

    // The bracket should produce ONE AI entry that coalesces all batch dispatches.
    // F7 fix: multi-dispatch within a single beginEntry/endEntry bracket
    // produces one ChangeEntry with all command sets combined.
    const cs = project.proposals!.changeset!;
    expect(cs.aiEntries).toHaveLength(1);

    const entry = cs.aiEntries[0];
    expect(entry.toolName).toBe('formspec_field');
    // Multiple dispatches (one per batch item) → multiple command arrays
    expect(entry.commands.length).toBeGreaterThanOrEqual(3);
  });

  it('batch with partial failure still records the successful dispatches', () => {
    const { registry, projectId, project } = registryWithProject();
    // Pre-add a field so the duplicate will fail
    project.addField('existing', 'Existing', 'text');

    handleChangesetOpen(registry, projectId);

    const result = withChangesetBracket(project, 'formspec_field', () =>
      handleField(registry, projectId, {
        items: [
          { path: 'new1', label: 'New 1', type: 'text' },
          { path: 'existing', label: 'Duplicate', type: 'text' }, // will fail
          { path: 'new2', label: 'New 2', type: 'text' },
        ],
      }),
    );

    // Partial success — not an error
    expect(isError(result)).toBe(false);
    const data = parseResult(result);
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(1);

    // The successful items dispatched commands, so there should be an entry
    const cs = project.proposals!.changeset!;
    expect(cs.aiEntries).toHaveLength(1);
    // At least the successful items' commands should be captured
    expect(cs.aiEntries[0].commands.length).toBeGreaterThanOrEqual(2);
  });
});

describe('summary extraction from MCP response (O1 bug)', () => {
  // O1: withChangesetBracket receives the MCP response envelope from wrapHelperCall(),
  // not the raw HelperResult. The `'summary' in result` check never matches because
  // the envelope is { content: [{type: 'text', text: ...}] }. Every entry gets the
  // generic "${toolName} executed" fallback instead of the rich HelperResult.summary.
  // These tests assert the CORRECT behavior — they should FAIL until O1 is fixed.

  it('should extract rich summary from HelperResult through MCP envelope', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    withChangesetBracket(project, 'formspec_field', () =>
      handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' }),
    );

    const entry = project.proposals!.changeset!.aiEntries[0];
    // Should contain the rich summary from HelperResult, e.g. "Added field 'name' (text)"
    expect(entry.summary).toContain('Added');
  });

  it('bracketMutation should extract rich summary, not generic fallback', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);
    project.addField('f1', 'F1', 'text');

    bracketMutation(registry, projectId, 'formspec_behavior', () => {
      return handleBehavior(registry, projectId, { action: 'require', target: 'f1' });
    });

    const entry = project.proposals!.changeset!.aiEntries[0];
    // Should contain the rich summary, not "formspec_behavior executed"
    expect(entry.summary).not.toBe('formspec_behavior executed');
  });
});

describe('bracketMutation with each mutation tool', () => {
  it('formspec_field', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_field', () =>
      handleField(registry, projectId, { path: 'f1', label: 'F1', type: 'text' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_content', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_content', () =>
      handleContent(registry, projectId, { path: 'intro', body: 'Hello', kind: 'heading' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_group', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_group', () =>
      handleGroup(registry, projectId, { path: 'grp', label: 'Group' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_update', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('f1', 'F1', 'text');
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_update', () =>
      handleUpdate(registry, projectId, 'item', { path: 'f1', changes: { label: 'Updated' } }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_edit (remove)', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('f1', 'F1', 'text');
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_edit', () =>
      handleEdit(registry, projectId, 'remove', { path: 'f1' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_behavior', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('f1', 'F1', 'text');
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_behavior', () =>
      handleBehavior(registry, projectId, { action: 'require', target: 'f1' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_flow', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_flow', () =>
      handleFlow(registry, projectId, { action: 'set_mode', mode: 'wizard' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_style', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('f1', 'F1', 'text');
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_style', () =>
      handleStyle(registry, projectId, { action: 'style', path: 'f1', properties: { width: '50%' } }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_data (choices)', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_data', () =>
      handleData(registry, projectId, {
        resource: 'choices',
        action: 'add',
        name: 'colors',
        options: [{ value: 'red', label: 'Red' }],
      }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_page (add)', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_page', () =>
      handlePage(registry, projectId, 'add', { title: 'Page 2' }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_submit_button', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_submit_button', () =>
      handleSubmitButton(registry, projectId, 'Submit'),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_screener (create_document)', () => {
    const { registry, projectId, project } = registryWithProject();
    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_screener', () =>
      handleScreener(registry, projectId, {
        action: 'create_document',
        title: 'Gate',
        url: 'urn:test:gate',
      }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });

  it('formspec_place', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('f1', 'F1', 'text');
    // Need a page to place on
    const pages = project.listPages();
    const pageId = pages[0]?.id;
    if (!pageId) return; // skip if no pages

    handleChangesetOpen(registry, projectId);

    bracketMutation(registry, projectId, 'formspec_place', () =>
      handlePlace(registry, projectId, { action: 'place', target: 'f1', page_id: pageId }),
    );

    expect(project.proposals!.changeset!.aiEntries).toHaveLength(1);
  });
});
