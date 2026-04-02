import { describe, it, expect } from 'vitest';
import { CommandPipeline } from '../src/pipeline.js';
import type { CommandHandler, ProjectState, AnyCommand } from '../src/types.js';

function minimalState(): ProjectState {
  return {
    definition: { $formspec: '1.0', url: '', version: '', status: 'draft', title: '', items: [] } as any,
    component: {},
    theme: {},
    mappings: {},
    selectedMappingId: 'default',
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  } as ProjectState;
}

describe('CommandPipeline', () => {
  const setTitle: CommandHandler = (state, payload) => {
    const { title } = payload as { title: string };
    state.definition.title = title;
    return { rebuildComponentTree: false };
  };

  const addItem: CommandHandler = (state, payload) => {
    const { key } = payload as { key: string };
    (state.definition.items as any[]).push({ key, type: 'field' });
    return { rebuildComponentTree: true };
  };

  const handlers: Record<string, CommandHandler> = {
    'definition.setFormTitle': setTitle,
    'definition.addItem': addItem,
  };

  it('executes a single-phase command', () => {
    const pipeline = new CommandPipeline(handlers, []);
    const state = minimalState();
    const { newState, results } = pipeline.execute(
      state,
      [[{ type: 'definition.setFormTitle', payload: { title: 'Hello' } }]],
      () => {},
    );
    expect(newState.definition.title).toBe('Hello');
    expect(results).toHaveLength(1);
    expect(results[0].rebuildComponentTree).toBe(false);
    // Original state untouched
    expect(state.definition.title).toBe('');
  });

  it('executes multi-phase with reconcile between phases', () => {
    let reconcileCount = 0;
    const pipeline = new CommandPipeline(handlers, []);
    const { results } = pipeline.execute(
      minimalState(),
      [
        [{ type: 'definition.addItem', payload: { key: 'f1' } }],
        [{ type: 'definition.setFormTitle', payload: { title: 'After' } }],
      ],
      () => { reconcileCount++; },
    );
    expect(reconcileCount).toBe(1);
    expect(results).toHaveLength(2);
  });

  it('does NOT reconcile when no command signals rebuild', () => {
    let reconcileCount = 0;
    const pipeline = new CommandPipeline(handlers, []);
    pipeline.execute(
      minimalState(),
      [
        [{ type: 'definition.setFormTitle', payload: { title: 'A' } }],
        [{ type: 'definition.setFormTitle', payload: { title: 'B' } }],
      ],
      () => { reconcileCount++; },
    );
    expect(reconcileCount).toBe(0);
  });

  it('throws on unknown command type', () => {
    const pipeline = new CommandPipeline(handlers, []);
    expect(() => pipeline.execute(
      minimalState(),
      [[{ type: 'nonexistent.command', payload: {} }]],
      () => {},
    )).toThrow('Unknown command type: nonexistent.command');
  });

  it('runs middleware wrapping the entire execution', () => {
    const log: string[] = [];
    const middleware = [
      (state: any, commands: any, next: any) => {
        log.push('before');
        const result = next(commands);
        log.push('after');
        return result;
      },
    ];
    const pipeline = new CommandPipeline(handlers, middleware);
    pipeline.execute(
      minimalState(),
      [[{ type: 'definition.setFormTitle', payload: { title: 'X' } }]],
      () => {},
    );
    expect(log).toEqual(['before', 'after']);
  });

  it('middleware can reject by not calling next', () => {
    const middleware = [
      (state: any, _commands: any, _next: any) => {
        return { newState: structuredClone(state), results: [{ rebuildComponentTree: false }] };
      },
    ];
    const pipeline = new CommandPipeline(handlers, middleware);
    const state = minimalState();
    const { newState } = pipeline.execute(
      state,
      [[{ type: 'definition.setFormTitle', payload: { title: 'Blocked' } }]],
      () => {},
    );
    expect(newState.definition.title).toBe('');
  });

  it('rolls back if any command throws', () => {
    const badHandler: CommandHandler = () => { throw new Error('boom'); };
    const pipeline = new CommandPipeline(
      { ...handlers, 'bad.command': badHandler },
      [],
    );
    expect(() => pipeline.execute(
      minimalState(),
      [[
        { type: 'definition.setFormTitle', payload: { title: 'Set' } },
        { type: 'bad.command', payload: {} },
      ]],
      () => {},
    )).toThrow('boom');
  });

  it('collects results from all commands across all phases', () => {
    const pipeline = new CommandPipeline(handlers, []);
    const { results } = pipeline.execute(
      minimalState(),
      [
        [
          { type: 'definition.addItem', payload: { key: 'f1' } },
          { type: 'definition.setFormTitle', payload: { title: 'T' } },
        ],
        [
          { type: 'definition.addItem', payload: { key: 'f2' } },
        ],
      ],
      () => {},
    );
    expect(results).toHaveLength(3);
    expect(results[0].rebuildComponentTree).toBe(true);
    expect(results[1].rebuildComponentTree).toBe(false);
    expect(results[2].rebuildComponentTree).toBe(true);
  });
});
