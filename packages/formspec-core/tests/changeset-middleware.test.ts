import { describe, it, expect, vi } from 'vitest';
import { createRawProject, createChangesetMiddleware } from '../src/index.js';
import type { ChangesetRecorderControl } from '../src/index.js';
import type { AnyCommand, CommandResult, ProjectState } from '../src/index.js';

function createTestControl(overrides?: Partial<ChangesetRecorderControl>): ChangesetRecorderControl {
  return {
    recording: false,
    currentActor: 'user',
    onCommandsRecorded: vi.fn(),
    ...overrides,
  };
}

function createProjectWithMiddleware(control: ChangesetRecorderControl) {
  const middleware = createChangesetMiddleware(control);
  return createRawProject({
    middleware: [middleware],
    seed: {
      definition: {
        $formspec: '1.0',
        url: 'urn:test:changeset',
        version: '0.1.0',
        title: 'Test',
        items: [],
      },
    },
  });
}

describe('createChangesetMiddleware', () => {
  it('does not record when recording is off', () => {
    const control = createTestControl({ recording: false });
    const project = createProjectWithMiddleware(control);

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });

    expect(control.onCommandsRecorded).not.toHaveBeenCalled();
  });

  it('records commands when recording is on', () => {
    const control = createTestControl({ recording: true, currentActor: 'ai' });
    const project = createProjectWithMiddleware(control);

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });

    expect(control.onCommandsRecorded).toHaveBeenCalledTimes(1);
    const [actor, commands, results, priorState] = (control.onCommandsRecorded as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(actor).toBe('ai');
    expect(commands).toHaveLength(1); // one phase
    expect(commands[0]).toHaveLength(1); // one command in that phase
    expect(commands[0][0].type).toBe('definition.addItem');
    expect(results).toHaveLength(1);
    expect(priorState.definition.items).toHaveLength(0); // prior state had no items
  });

  it('records the current actor at dispatch time', () => {
    const control = createTestControl({ recording: true, currentActor: 'user' });
    const project = createProjectWithMiddleware(control);

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });

    expect((control.onCommandsRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('user');

    // Switch actor mid-session
    control.currentActor = 'ai';
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'email', label: 'Email', type: 'field', dataType: 'string' },
    });

    expect((control.onCommandsRecorded as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe('ai');
  });

  it('records batch commands as a single recording call', () => {
    const control = createTestControl({ recording: true, currentActor: 'ai' });
    const project = createProjectWithMiddleware(control);

    project.batch([
      { type: 'definition.addItem', payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' } },
      { type: 'definition.addItem', payload: { key: 'email', label: 'Email', type: 'field', dataType: 'string' } },
    ]);

    expect(control.onCommandsRecorded).toHaveBeenCalledTimes(1);
    const [, commands] = (control.onCommandsRecorded as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(commands[0]).toHaveLength(2);
  });

  it('does not block or transform commands', () => {
    const control = createTestControl({ recording: true, currentActor: 'ai' });
    const project = createProjectWithMiddleware(control);

    const result = project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });

    // Command succeeded — item was added
    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('name');
    expect(result.rebuildComponentTree).toBe(true);
  });

  it('can toggle recording on and off', () => {
    const control = createTestControl({ recording: false });
    const project = createProjectWithMiddleware(control);

    // Not recording
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });
    expect(control.onCommandsRecorded).not.toHaveBeenCalled();

    // Start recording
    control.recording = true;
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'email', label: 'Email', type: 'field', dataType: 'string' },
    });
    expect(control.onCommandsRecorded).toHaveBeenCalledTimes(1);

    // Stop recording
    control.recording = false;
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'phone', label: 'Phone', type: 'field', dataType: 'string' },
    });
    expect(control.onCommandsRecorded).toHaveBeenCalledTimes(1); // still 1
  });

  it('records batchWithRebuild as two phases', () => {
    const control = createTestControl({ recording: true, currentActor: 'ai' });
    const project = createProjectWithMiddleware(control);

    project.batchWithRebuild(
      [{ type: 'definition.addItem', payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' } }],
      [{ type: 'definition.setFormTitle', payload: { title: 'Updated' } }],
    );

    expect(control.onCommandsRecorded).toHaveBeenCalledTimes(1);
    const [, commands] = (control.onCommandsRecorded as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(commands).toHaveLength(2); // two phases
  });
});

describe('RawProject.restoreState', () => {
  it('restores state to a prior snapshot', () => {
    const project = createRawProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:restore',
          version: '0.1.0',
          title: 'Test',
          items: [],
        },
      },
    });

    const snapshot = structuredClone(project.state);

    // Mutate state
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });
    expect(project.definition.items).toHaveLength(1);

    // Restore
    project.restoreState(snapshot);
    expect(project.definition.items).toHaveLength(0);
  });

  it('clears history on restore', () => {
    const project = createRawProject();

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });
    expect(project.canUndo).toBe(true);

    const snapshot = structuredClone(project.state);
    project.restoreState(snapshot);
    expect(project.canUndo).toBe(false);
    expect(project.canRedo).toBe(false);
  });

  it('notifies listeners on restore', () => {
    const project = createRawProject();
    const listener = vi.fn();
    project.onChange(listener);

    const snapshot = structuredClone(project.state);
    project.restoreState(snapshot);

    expect(listener).toHaveBeenCalledTimes(1);
    const [, event] = listener.mock.calls[0];
    expect(event.command.type).toBe('restoreState');
    expect(event.source).toBe('restore');
  });

  it('invalidates cached component', () => {
    const project = createRawProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test:cache',
          version: '0.1.0',
          title: 'Test',
          items: [{ key: 'name', type: 'field', label: 'Name', dataType: 'string' }],
        },
      },
    });

    // Access component to populate cache
    const _comp1 = project.component;

    // Restore to empty state
    const emptyDef = {
      $formspec: '1.0' as const,
      url: 'urn:test:cache',
      version: '0.1.0',
      title: 'Empty',
      items: [],
    };
    const emptyState = structuredClone(project.state);
    emptyState.definition = emptyDef;
    project.restoreState(emptyState);

    // Component should reflect new state (no items)
    expect(project.definition.items).toHaveLength(0);
  });

  it('works with commands dispatched after restore', () => {
    const project = createRawProject();
    const snapshot = structuredClone(project.state);

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', label: 'Name', type: 'field', dataType: 'string' },
    });

    project.restoreState(snapshot);

    // Should be able to dispatch new commands after restore
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'email', label: 'Email', type: 'field', dataType: 'string' },
    });

    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('email');
    expect(project.canUndo).toBe(true);
  });
});
