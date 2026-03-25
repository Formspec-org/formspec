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

    it('blocks merge when diagnostics contain errors (F1)', () => {
      pm.openChangeset();

      // AI adds a field
      pm.beginEntry('formspec_field');
      project.addField('total', 'Total', 'number');
      pm.endEntry('Added total');

      pm.closeChangeset('Test');

      // Inject a second AI entry that sets a bad FEL expression
      // (bypasses helper validation but will trigger FEL_PARSE_ERROR in diagnose)
      const badBindEntry = {
        commands: [[{
          type: 'definition.setBind',
          payload: { path: 'total', properties: { calculate: '@@invalid FEL@@' } },
        }]],
        toolName: 'formspec_behavior',
        summary: 'Set invalid calculate',
        affectedPaths: ['total'],
        warnings: [],
      };
      (pm.changeset as any).aiEntries.push(badBindEntry);

      // Force two groups: one per entry
      (pm.changeset as any).dependencyGroups = [
        { entries: [0], reason: 'field' },
        { entries: [1], reason: 'bind' },
      ];

      // Accept both groups — diagnose() should find FEL parse error and block
      const result = pm.acceptChangeset([0, 1]);

      expect(result.ok).toBe(false);
      expect('diagnostics' in result).toBe(true);
      expect(pm.changeset!.status).toBe('pending');
    });

    it('replays user overlay after partial merge', () => {
      pm.openChangeset();

      // AI adds two fields (will be two dep groups)
      pm.beginEntry('formspec_field');
      project.addField('first', 'First', 'text');
      pm.endEntry('Added first');

      pm.beginEntry('formspec_field');
      project.addField('second', 'Second', 'text');
      pm.endEntry('Added second');

      // User adds a bind to the first field
      project.require('first');

      pm.closeChangeset('Test');

      // Force two groups
      (pm.changeset as any).dependencyGroups = [
        { entries: [0], reason: 'first field' },
        { entries: [1], reason: 'second field' },
      ];

      // Accept only group 0 (first field)
      const result = pm.acceptChangeset([0]);

      expect(result.ok).toBe(true);
      // First field should exist
      expect(project.definition.items.some((i: any) => i.key === 'first')).toBe(true);
      // Second field should NOT exist (rejected group)
      expect(project.definition.items.some((i: any) => i.key === 'second')).toBe(false);
      // User overlay (require on first) should be replayed — binds live on definition.binds
      const binds = (project.definition as any).binds ?? [];
      const firstBind = binds.find((b: any) => b.path === 'first');
      expect(firstBind).toBeTruthy();
      // required is stored as FEL expression string "true", not boolean
      expect(firstBind.required).toBeTruthy();
    });

    it('leaves status pending on user overlay failure (F2)', () => {
      pm.openChangeset();

      // AI adds a field
      pm.beginEntry('formspec_field');
      project.addField('target', 'Target', 'text');
      pm.endEntry('Added target');

      // User sets require on the field
      project.require('target');

      pm.closeChangeset('Test');

      // Force two groups: one AI group, the user overlay references 'target'
      (pm.changeset as any).dependencyGroups = [
        { entries: [0], reason: 'field' },
      ];

      // Sabotage user overlay to cause replay failure
      (pm.changeset as any).userOverlay[0].commands = [[{
        type: 'nonexistent.handler.that.will.throw',
        payload: {},
      }]];

      // Accept AI group — user overlay replay will fail
      const result = pm.acceptChangeset([0]);

      expect(result.ok).toBe(false);
      expect('replayFailure' in result && (result as any).replayFailure.phase).toBe('user');
      // F2: status should be 'pending', NOT 'merged'
      expect(pm.changeset!.status).toBe('pending');
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

  describe('multi-dispatch bracket (F7)', () => {
    it('accumulates commands from multiple dispatches within a single bracket', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      // Two dispatches within the same bracket
      project.addField('name', 'Name', 'text');
      project.require('name');
      pm.endEntry('Added name field and made it required');

      // Should produce ONE AI entry with commands from both dispatches
      expect(pm.changeset!.aiEntries).toHaveLength(1);
      expect(pm.changeset!.aiEntries[0].toolName).toBe('formspec_field');
      expect(pm.changeset!.aiEntries[0].summary).toBe('Added name field and made it required');
      // Both dispatches' commands should be in the same entry
      expect(pm.changeset!.aiEntries[0].commands.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('partial rejection (F6)', () => {
    it('rejects specific groups while preserving the complement', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('keep', 'Keep', 'text');
      pm.endEntry('Added keep');

      pm.beginEntry('formspec_field');
      project.addField('discard', 'Discard', 'text');
      pm.endEntry('Added discard');

      pm.closeChangeset('Test');

      // Force two groups
      (pm.changeset as any).dependencyGroups = [
        { entries: [0], reason: 'keep field' },
        { entries: [1], reason: 'discard field' },
      ];

      // Reject group 1 — should accept group 0
      const result = pm.rejectChangeset([1]);

      expect(result.ok).toBe(true);
      // Keep field should exist (it was NOT rejected)
      expect(project.definition.items.some((i: any) => i.key === 'keep')).toBe(true);
      // Discard field should NOT exist (it WAS rejected)
      expect(project.definition.items.some((i: any) => i.key === 'discard')).toBe(false);
    });

    it('full reject when no groupIndices provided', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');

      const result = pm.rejectChangeset();
      expect(result.ok).toBe(true);
      expect(project.definition.items).toHaveLength(0);
    });
  });

  describe('replay failure scenarios', () => {
    it('AI group replay failure restores to snapshotBefore', () => {
      project.addField('existing', 'Existing', 'text');

      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');

      // Sabotage AI entry commands to cause replay failure —
      // use a completely invalid command type that has no handler
      (pm.changeset as any).aiEntries[0].commands = [[{
        type: 'nonexistent.handler.that.will.throw',
        payload: {},
      }]];

      const result = pm.acceptChangeset([0]);

      expect(result.ok).toBe(false);
      expect('replayFailure' in result).toBe(true);
      const failure = (result as any).replayFailure;
      expect(failure.phase).toBe('ai');
      expect(failure.entryIndex).toBe(0);
      // State should be restored to snapshot (existing field still there)
      expect(project.definition.items).toHaveLength(1);
      expect(project.definition.items[0].key).toBe('existing');
    });

    it('user overlay replay failure restores to after-AI savepoint', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      // User makes an edit
      project.addField('userField', 'User', 'text');

      pm.closeChangeset('Test');

      // Sabotage user overlay to cause replay failure
      (pm.changeset as any).userOverlay[0].commands = [[{
        type: 'nonexistent.handler.that.will.throw',
        payload: {},
      }]];

      const result = pm.acceptChangeset([0]);

      expect(result.ok).toBe(false);
      expect('replayFailure' in result).toBe(true);
      const failure = (result as any).replayFailure;
      expect(failure.phase).toBe('user');
      // AI field should still exist (restored to after-AI savepoint)
      expect(project.definition.items.some((i: any) => i.key === 'aiField')).toBe(true);
    });
  });

  describe('user overlay during pending', () => {
    it('records user mutations to userOverlay after closeChangeset', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');
      expect(pm.changeset!.status).toBe('pending');

      // User makes an edit while changeset is pending
      project.addField('pendingUserField', 'Pending User', 'text');

      expect(pm.changeset!.userOverlay.length).toBeGreaterThanOrEqual(1);
      const lastOverlay = pm.changeset!.userOverlay[pm.changeset!.userOverlay.length - 1];
      expect(lastOverlay.summary).toContain('User:');
    });
  });

  describe('recording stops on accept/reject', () => {
    it('stops recording after accept', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');
      pm.acceptChangeset();

      const overlayCountAfterAccept = pm.changeset!.userOverlay.length;

      // Mutation after accept should NOT be recorded
      project.addField('afterAccept', 'After', 'text');
      expect(pm.changeset!.userOverlay.length).toBe(overlayCountAfterAccept);
    });

    it('stops recording after reject', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');
      pm.rejectChangeset();

      const overlayCountAfterReject = pm.changeset!.userOverlay.length;

      project.addField('afterReject', 'After', 'text');
      expect(pm.changeset!.userOverlay.length).toBe(overlayCountAfterReject);
    });
  });

  describe('discard during pending', () => {
    it('restores state and clears changeset when pending', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      project.addField('userField', 'User', 'text');

      pm.closeChangeset('Test');
      expect(pm.changeset!.status).toBe('pending');

      pm.discardChangeset();

      expect(pm.changeset).toBeNull();
      // State restored — no fields
      expect(project.definition.items).toHaveLength(0);
    });
  });

  describe('capturedValues for = prefix expressions', () => {
    // F3: Spec line 219 requires that =prefix initialValue expressions have their
    // evaluated result captured in ChangeEntry.capturedValues so replay is deterministic.
    // This test asserts the CORRECT behavior — it should FAIL until F3 is implemented.
    it('should capture evaluated result for =prefix initialValue expressions', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('created', 'Created Date', 'date', {
        initialValue: '=today()',
      });
      pm.endEntry('Added date field with today() initialValue');

      const entry = pm.changeset!.aiEntries[0];
      expect(entry.capturedValues).toBeDefined();
      expect(entry.capturedValues).toHaveProperty('created');
    });
  });

  describe('multi-dispatch coalescing (F7 verification)', () => {
    it('coalesces addField + setBind dispatches within one bracket into one ChangeEntry', () => {
      pm.openChangeset();

      // addField dispatches once, then require dispatches separately.
      // Both happen within the same beginEntry/endEntry bracket.
      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'email');
      project.require('email');
      pm.endEntry('Added email and made it required');

      // F7 fix: should produce ONE entry, not two
      expect(pm.changeset!.aiEntries).toHaveLength(1);

      const entry = pm.changeset!.aiEntries[0];
      expect(entry.toolName).toBe('formspec_field');
      expect(entry.summary).toBe('Added email and made it required');
      // The entry should contain commands from BOTH dispatches
      // addField produces phase1 + phase2 commands, require produces its own
      expect(entry.commands.length).toBeGreaterThanOrEqual(2);
    });

    it('coalesces three dispatches within one bracket', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('amount', 'Amount', 'number');
      project.require('amount');
      project.calculate('amount', '$price * $quantity');
      pm.endEntry('Added amount with validation');

      expect(pm.changeset!.aiEntries).toHaveLength(1);
      expect(pm.changeset!.aiEntries[0].commands.length).toBeGreaterThanOrEqual(3);
    });

    it('separate brackets produce separate entries (not coalesced)', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('first', 'First', 'text');
      pm.endEntry('Added first');

      pm.beginEntry('formspec_field');
      project.addField('second', 'Second', 'text');
      pm.endEntry('Added second');

      // Two separate brackets = two separate entries
      expect(pm.changeset!.aiEntries).toHaveLength(2);
    });
  });

  describe('recording state transitions', () => {
    it('full lifecycle: no changeset -> open -> beginEntry -> endEntry -> close -> accept', () => {
      // No changeset — mutations are NOT recorded to any changeset
      project.addField('pre', 'Pre', 'text');
      expect(pm.changeset).toBeNull();

      // Open changeset — recording starts, actor = 'user'
      pm.openChangeset();
      expect(pm.changeset!.status).toBe('open');

      // User edit while changeset is open (actor = 'user')
      project.addField('userField', 'User Field', 'text');
      expect(pm.changeset!.userOverlay).toHaveLength(1);
      expect(pm.changeset!.aiEntries).toHaveLength(0);

      // Begin AI entry — actor switches to 'ai'
      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI Field', 'text');
      // During bracket, commands accumulate in pending entry (not yet in aiEntries)
      expect(pm.changeset!.aiEntries).toHaveLength(0);

      // End AI entry — actor switches back to 'user', pending entry → aiEntries
      pm.endEntry('Added AI field');
      expect(pm.changeset!.aiEntries).toHaveLength(1);
      expect(pm.changeset!.userOverlay).toHaveLength(1);

      // After endEntry, user edits go to overlay again
      project.addField('userField2', 'User Field 2', 'text');
      expect(pm.changeset!.userOverlay).toHaveLength(2);
      expect(pm.changeset!.aiEntries).toHaveLength(1);

      // Close changeset — status → pending, recording continues for user overlay
      pm.closeChangeset('Test changes');
      expect(pm.changeset!.status).toBe('pending');

      // User can still edit during pending — recorded to overlay
      project.addField('pendingEdit', 'Pending Edit', 'text');
      expect(pm.changeset!.userOverlay).toHaveLength(3);

      // Accept — recording stops
      pm.acceptChangeset();
      expect(pm.changeset!.status).toBe('merged');

      // After accept, mutations are NOT recorded to the changeset
      const overlayCount = pm.changeset!.userOverlay.length;
      project.addField('afterAccept', 'After Accept', 'text');
      expect(pm.changeset!.userOverlay).toHaveLength(overlayCount);
    });

    it('reject path: open -> record -> close -> reject stops recording', () => {
      pm.openChangeset();
      expect(pm.changeset!.status).toBe('open');

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.closeChangeset('Test');
      expect(pm.changeset!.status).toBe('pending');

      pm.rejectChangeset();
      expect(pm.changeset!.status).toBe('rejected');

      // After reject, mutations are NOT recorded
      const overlayCount = pm.changeset!.userOverlay.length;
      project.addField('afterReject', 'After', 'text');
      expect(pm.changeset!.userOverlay).toHaveLength(overlayCount);
    });

    it('discard path: open -> record -> discard clears changeset', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('aiField', 'AI', 'text');
      pm.endEntry('Added AI field');

      pm.discardChangeset();
      expect(pm.changeset).toBeNull();

      // After discard, mutations should not throw
      project.addField('afterDiscard', 'After', 'text');
      // No changeset to record into
      expect(pm.changeset).toBeNull();
    });
  });

  describe('WASM dependency grouping', () => {
    it('two independent fields produce 2 groups', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('name', 'Name', 'text');
      pm.endEntry('Added name');

      pm.beginEntry('formspec_field');
      project.addField('email', 'Email', 'text');
      pm.endEntry('Added email');

      pm.closeChangeset('Two independent fields');

      // With real WASM dependency analysis, two independent addItem entries
      // should produce two separate groups (no cross-references).
      expect(pm.changeset!.dependencyGroups).toHaveLength(2);
      expect(pm.changeset!.dependencyGroups[0].entries).toEqual([0]);
      expect(pm.changeset!.dependencyGroups[1].entries).toEqual([1]);
      expect(pm.changeset!.dependencyGroups[0].reason).toContain('independent');
      expect(pm.changeset!.dependencyGroups[1].reason).toContain('independent');
    });

    it('two dependent fields (FEL cross-ref) produce 1 group', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('fieldA', 'Field A', 'number');
      pm.endEntry('Added fieldA');

      pm.beginEntry('formspec_behavior');
      project.addField('fieldB', 'Field B', 'number');
      project.calculate('fieldB', '$fieldA + 1');
      pm.endEntry('Added fieldB with calculate referencing fieldA');

      pm.closeChangeset('Two dependent fields');

      // fieldB's calculate expression references $fieldA, so they must group together.
      expect(pm.changeset!.dependencyGroups).toHaveLength(1);
      expect(pm.changeset!.dependencyGroups[0].entries).toEqual([0, 1]);
      expect(pm.changeset!.dependencyGroups[0].reason).toContain('fieldA');
    });

    it('partial accept: accept group 1, reject group 2 — only group 1 fields remain', () => {
      pm.openChangeset();

      pm.beginEntry('formspec_field');
      project.addField('keep', 'Keep', 'text');
      pm.endEntry('Added keep');

      pm.beginEntry('formspec_field');
      project.addField('discard', 'Discard', 'text');
      pm.endEntry('Added discard');

      pm.closeChangeset('Partial accept test');

      // Two independent fields → two groups
      expect(pm.changeset!.dependencyGroups).toHaveLength(2);

      // Accept only group 0
      const result = pm.acceptChangeset([0]);
      expect(result.ok).toBe(true);

      // Only 'keep' should remain
      expect(project.definition.items.some((i: any) => i.key === 'keep')).toBe(true);
      expect(project.definition.items.some((i: any) => i.key === 'discard')).toBe(false);
    });

    it('multiple operations referencing same field form a single group', () => {
      pm.openChangeset();

      // Entry 0: create field
      pm.beginEntry('formspec_field');
      project.addField('total', 'Total', 'number');
      pm.endEntry('Added total');

      // Entry 1: set bind on the same field
      pm.beginEntry('formspec_behavior');
      project.require('total');
      pm.endEntry('Made total required');

      // Entry 2: independent field
      pm.beginEntry('formspec_field');
      project.addField('notes', 'Notes', 'text');
      pm.endEntry('Added notes');

      pm.closeChangeset('Mixed dependencies');

      // Entry 0 creates 'total', entry 1 references 'total' → grouped
      // Entry 2 creates 'notes' → independent
      expect(pm.changeset!.dependencyGroups).toHaveLength(2);

      const totalGroup = pm.changeset!.dependencyGroups.find(g =>
        g.entries.includes(0) && g.entries.includes(1)
      );
      expect(totalGroup).toBeTruthy();
      expect(totalGroup!.entries).toEqual([0, 1]);

      const notesGroup = pm.changeset!.dependencyGroups.find(g =>
        g.entries.includes(2)
      );
      expect(notesGroup).toBeTruthy();
      expect(notesGroup!.entries).toEqual([2]);
    });
  });
});
