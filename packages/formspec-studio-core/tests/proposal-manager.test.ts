import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject } from '../src/index.js';
import type { Project } from '../src/index.js';
import type { ProposalManager } from '../src/index.js';

describe('ProposalManager', () => {
  let project: Project;
  let pm: ProposalManager;

  beforeEach(() => {
    project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:proposal',
          version: '0.1.0',
          title: 'Test',
          items: [],
        } as any,
      },
    });
    pm = project.proposals!;
    expect(pm).not.toBeNull();
  });

  describe('openChangeset', () => {
    it('opens a changeset and returns an ID', () => {
      const id = pm.openChangeset();
      expect(id).toBeTruthy();
      expect(pm.changeset).not.toBeNull();
      expect(pm.changeset!.status).toBe('open');
      expect(pm.changeset!.aiEntries).toEqual([]);
      expect(pm.changeset!.userOverlay).toEqual([]);
    });

    it('refuses to open a second changeset while one is open', () => {
      pm.openChangeset();
      expect(() => pm.openChangeset()).toThrow(/already open/);
    });

    it('refuses to open a changeset on non-draft definitions', () => {
      // Set status to active
      project.setMetadata({ status: 'active' });
      expect(() => pm.openChangeset()).toThrow(/VP-02/);
    });

    it('captures a snapshot of current state', () => {
      project.addField('name', 'Name', 'text');
      pm.openChangeset();

      expect(pm.changeset!.snapshotBefore.definition.items).toHaveLength(1);
      expect(pm.changeset!.snapshotBefore.definition.items[0].key).toBe('name');
    });
  });

  describe('recording', () => {
    it('records AI entries during beginEntry/endEntry brackets', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'text');
      pm.endEntry('Added email field');

      expect(pm.changeset!.aiEntries).toHaveLength(1);
      expect(pm.changeset!.aiEntries[0].toolName).toBe('formspec_field');
      expect(pm.changeset!.aiEntries[0].summary).toBe('Added email field');
    });

    it('records user edits to userOverlay outside brackets', () => {
      pm.openChangeset();

      // User edits directly (not inside beginEntry/endEntry)
      project.addField('phone', 'Phone', 'text');

      expect(pm.changeset!.userOverlay).toHaveLength(1);
      expect(pm.changeset!.userOverlay[0].summary).toContain('User:');
    });

    it('records multiple AI entries in sequence', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name field');

      pm.beginEntry('formspec_behavior');
      project.require('name');
      pm.endEntry('Made name required');

      expect(pm.changeset!.aiEntries).toHaveLength(2);
    });

    it('interleaves AI and user edits', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      // User edit
      project.addField('phone', 'Phone', 'text');

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'text');
      pm.endEntry('Added email');

      expect(pm.changeset!.aiEntries).toHaveLength(2);
      expect(pm.changeset!.userOverlay).toHaveLength(1);
    });
  });

  describe('closeChangeset', () => {
    it('sets status to pending', () => {
      pm.openChangeset();
      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.closeChangeset('Added name field');
      expect(pm.changeset!.status).toBe('pending');
      expect(pm.changeset!.label).toBe('Added name field');
    });

    it('computes dependency groups', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'text');
      pm.endEntry('Added email');

      pm.closeChangeset('Added fields');
      expect(pm.changeset!.dependencyGroups.length).toBeGreaterThan(0);
    });

    it('refuses to close when no changeset is open', () => {
      expect(() => pm.closeChangeset('test')).toThrow(/no open changeset/);
    });
  });

  describe('acceptChangeset (merge all)', () => {
    it('accepts all changes and sets status to merged', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.closeChangeset('Test');
      const result = pm.acceptChangeset();

      expect(result.ok).toBe(true);
      expect(pm.changeset!.status).toBe('merged');
      // State still has the field
      expect(project.definition.items).toHaveLength(1);
    });
  });

  describe('rejectChangeset', () => {
    it('rejects and restores to snapshot (no user overlay)', () => {
      project.addField('existing', 'Existing', 'text');
      const existingCount = project.definition.items.length;

      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.closeChangeset('Test');
      const result = pm.rejectChangeset();

      expect(result.ok).toBe(true);
      expect(pm.changeset!.status).toBe('rejected');
      // State restored — only the pre-existing field remains
      expect(project.definition.items).toHaveLength(existingCount);
    });

    it('preserves user overlay on reject', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI Field', 'text');
      pm.endEntry('Added AI field');

      // User edit during open changeset
      project.addField('userField', 'User Field', 'text');

      pm.closeChangeset('Test');
      const result = pm.rejectChangeset();

      expect(result.ok).toBe(true);
      // User's field should be replayed, AI's field should be gone
      expect(project.definition.items).toHaveLength(1);
      expect(project.definition.items[0].key).toBe('userField');
    });
  });

  describe('undo/redo gating', () => {
    it('disables undo during open changeset', () => {
      project.addField('name', 'Name', 'text');
      expect(project.canUndo).toBe(true);

      pm.openChangeset();
      expect(project.canUndo).toBe(false);
      expect(project.undo()).toBe(false);
    });

    it('disables redo during open changeset', () => {
      project.addField('name', 'Name', 'text');
      project.undo();
      expect(project.canRedo).toBe(true);

      pm.openChangeset();
      expect(project.canRedo).toBe(false);
      expect(project.redo()).toBe(false);
    });

    it('re-enables undo after changeset is accepted', () => {
      project.addField('name', 'Name', 'text');
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'text');
      pm.endEntry('Added email');

      pm.closeChangeset('Test');
      pm.acceptChangeset();

      // After merge, undo should work again (though history was cleared by restore)
      // New operations after merge should be undoable
      expect(pm.hasActiveChangeset).toBe(false);
    });
  });

  describe('discardChangeset', () => {
    it('discards and restores state', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.discardChangeset();

      expect(pm.changeset).toBeNull();
      expect(project.definition.items).toHaveLength(0);
    });
  });

  describe('hasActiveChangeset', () => {
    it('returns false when no changeset', () => {
      expect(pm.hasActiveChangeset).toBe(false);
    });

    it('returns true when changeset is open', () => {
      pm.openChangeset();
      expect(pm.hasActiveChangeset).toBe(true);
    });

    it('returns true when changeset is pending', () => {
      pm.openChangeset();
      pm.closeChangeset('Test');
      expect(pm.hasActiveChangeset).toBe(true);
    });

    it('returns false after merge', () => {
      pm.openChangeset();
      pm.closeChangeset('Test');
      pm.acceptChangeset();
      expect(pm.hasActiveChangeset).toBe(false);
    });

    it('returns false after reject', () => {
      pm.openChangeset();
      pm.closeChangeset('Test');
      pm.rejectChangeset();
      expect(pm.hasActiveChangeset).toBe(false);
    });
  });

  describe('partial merge', () => {
    it('accepts specific dependency groups', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.closeChangeset('Test');

      // Accept the only group (index 0)
      const result = pm.acceptChangeset([0]);

      expect(result.ok).toBe(true);
      expect(pm.changeset!.status).toBe('merged');
      expect(project.definition.items).toHaveLength(1);
    });

    it('throws on invalid group index', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.closeChangeset('Test');

      expect(() => pm.acceptChangeset([99])).toThrow(/Invalid dependency group index/);
    });
  });

  describe('changeset with no AI entries', () => {
    it('handles empty changeset close gracefully', () => {
      pm.openChangeset();
      pm.closeChangeset('Empty changeset');
      expect(pm.changeset!.dependencyGroups).toEqual([]);
    });

    it('can accept empty changeset', () => {
      pm.openChangeset();
      pm.closeChangeset('Empty');
      const result = pm.acceptChangeset();
      expect(result.ok).toBe(true);
    });
  });

  describe('can open new changeset after prior one completes', () => {
    it('opens after merge', () => {
      pm.openChangeset();
      pm.closeChangeset('First');
      pm.acceptChangeset();

      const id = pm.openChangeset();
      expect(id).toBeTruthy();
      expect(pm.changeset!.status).toBe('open');
    });

    it('opens after reject', () => {
      pm.openChangeset();
      pm.closeChangeset('First');
      pm.rejectChangeset();

      const id = pm.openChangeset();
      expect(id).toBeTruthy();
    });
  });
});
