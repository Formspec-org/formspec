import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import {
  handleChangesetOpen,
  handleChangesetClose,
  handleChangesetList,
  handleChangesetAccept,
  handleChangesetReject,
} from '../src/tools/changeset.js';
import { handleField } from '../src/tools/structure.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

function isError(result: unknown): boolean {
  return (result as any).isError === true;
}

describe('changeset MCP tools', () => {
  describe('formspec_changeset_open', () => {
    it('opens a changeset and returns ID', () => {
      const { registry, projectId } = registryWithProject();
      const result = handleChangesetOpen(registry, projectId);
      const data = parseResult(result);

      expect(isError(result)).toBe(false);
      expect(data.changeset_id).toBeTruthy();
      expect(data.status).toBe('open');
    });

    it('fails when changeset already open', () => {
      const { registry, projectId } = registryWithProject();
      handleChangesetOpen(registry, projectId);
      const result = handleChangesetOpen(registry, projectId);

      expect(isError(result)).toBe(true);
    });
  });

  describe('formspec_changeset_close', () => {
    it('closes changeset with label and dependency groups', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      // Add a field via the project directly (simulating MCP tool)
      const pm = project.proposals!;
      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name field');

      const result = handleChangesetClose(registry, projectId, 'Added name field');
      const data = parseResult(result);

      expect(isError(result)).toBe(false);
      expect(data.status).toBe('pending');
      expect(data.ai_entry_count).toBe(1);
      expect(data.dependency_groups).toHaveLength(1);
    });
  });

  describe('formspec_changeset_list', () => {
    it('returns empty when no changeset', () => {
      const { registry, projectId } = registryWithProject();
      const result = handleChangesetList(registry, projectId);
      const data = parseResult(result);

      expect(data.changesets).toEqual([]);
    });

    it('returns changeset details when open', () => {
      const { registry, projectId } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      const result = handleChangesetList(registry, projectId);
      const data = parseResult(result);

      expect(data.changesets).toHaveLength(1);
      expect(data.changesets[0].status).toBe('open');
    });
  });

  describe('formspec_changeset_accept', () => {
    it('accepts all changes', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      const pm = project.proposals!;
      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      handleChangesetClose(registry, projectId, 'Test');
      const result = handleChangesetAccept(registry, projectId);
      const data = parseResult(result);

      expect(isError(result)).toBe(false);
      expect(data.ok).toBe(true);
      expect(data.status).toBe('merged');
    });

    it('accepts specific groups (partial merge)', () => {
      const { registry, projectId, project } = registryWithProject();
      handleChangesetOpen(registry, projectId);

      const pm = project.proposals!;
      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      handleChangesetClose(registry, projectId, 'Test');
      const result = handleChangesetAccept(registry, projectId, [0]);
      const data = parseResult(result);

      expect(isError(result)).toBe(false);
      expect(data.ok).toBe(true);
    });
  });

  describe('formspec_changeset_reject', () => {
    it('rejects and restores state', () => {
      const { registry, projectId, project } = registryWithProject();
      const itemsBefore = project.definition.items.length;

      handleChangesetOpen(registry, projectId);

      const pm = project.proposals!;
      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      handleChangesetClose(registry, projectId, 'Test');
      const result = handleChangesetReject(registry, projectId);
      const data = parseResult(result);

      expect(isError(result)).toBe(false);
      expect(data.ok).toBe(true);
      expect(data.status).toBe('rejected');

      // State should be restored
      expect(project.definition.items.length).toBe(itemsBefore);
    });
  });

  describe('full workflow', () => {
    it('open → record AI entries → close → accept', () => {
      const { registry, projectId, project } = registryWithProject();

      // Open
      const openResult = handleChangesetOpen(registry, projectId);
      expect(isError(openResult)).toBe(false);

      // Record entries via proposal manager
      const pm = project.proposals!;

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name field');

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'email');
      pm.endEntry('Added email field');

      pm.beginEntry('formspec_behavior');
      project.require('email');
      pm.endEntry('Made email required');

      // Close
      const closeResult = handleChangesetClose(registry, projectId, 'Added name and email fields');
      const closeData = parseResult(closeResult);
      expect(closeData.ai_entry_count).toBe(3);

      // Accept
      const acceptResult = handleChangesetAccept(registry, projectId);
      const acceptData = parseResult(acceptResult);
      expect(acceptData.ok).toBe(true);
      expect(acceptData.status).toBe('merged');

      // Verify state has the fields
      expect(project.definition.items.length).toBeGreaterThanOrEqual(2);
    });

    it('open → record → close → reject → state restored', () => {
      const { registry, projectId, project } = registryWithProject();
      const initialItems = project.definition.items.length;

      handleChangesetOpen(registry, projectId);

      const pm = project.proposals!;
      pm.beginEntry('formspec_field');
      project.addField('temp', 'Temp', 'text');
      pm.endEntry('Added temp');

      handleChangesetClose(registry, projectId, 'Temp change');
      handleChangesetReject(registry, projectId);

      expect(project.definition.items.length).toBe(initialItems);
    });
  });
});
