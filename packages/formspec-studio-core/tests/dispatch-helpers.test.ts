/** @filedesc Unit tests for generic delegate dispatch executor. */
import { describe, expect, it, vi } from 'vitest';
import { exec, execBatch } from '../src/lib/dispatch-helpers.js';
import type { ProjectInternals } from '../src/project-internals.js';

function stubProject(): { project: ProjectInternals; dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const project = { core: { dispatch } } as unknown as ProjectInternals;
  return { project, dispatch };
}

describe('exec', () => {
  it('dispatches params as payload when spec has no payload mapper', () => {
    const { project, dispatch } = stubProject();
    const result = exec(project, 'removeScreenField', { key: 'k' }, {
      command: 'screener.deleteItem',
      summary: (p) => `Removed ${p.key}`,
      affectedPaths: (p) => [p.key],
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'screener.deleteItem', payload: { key: 'k' } });
    expect(result.summary).toBe('Removed k');
    expect(result.affectedPaths).toEqual(['k']);
    expect(result.action).toEqual({ helper: 'removeScreenField', params: { key: 'k' } });
  });

  it('dispatches payload(params) when spec defines payload mapper', () => {
    const { project, dispatch } = stubProject();
    exec(project, 'removeScreenRoute', { phaseId: 'p', routeIndex: 2 }, {
      command: 'screener.deleteRoute',
      payload: (p) => ({ phaseId: p.phaseId, index: p.routeIndex }),
      summary: () => 'ok',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'screener.deleteRoute',
      payload: { phaseId: 'p', index: 2 },
    });
  });

  it('runs beforeDispatch then dispatch then afterDispatch', () => {
    const { project, dispatch } = stubProject();
    const order: string[] = [];
    exec(project, 'x', { id: '1' }, {
      command: 'theme.addSelector',
      summary: () => 's',
      beforeDispatch: () => { order.push('before'); },
      afterDispatch: () => {
        order.push('after');
        return { warnings: [{ code: 'W', message: 'm' }] };
      },
    });
    expect(order).toEqual(['before', 'after']);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('merges afterDispatch createdId and warnings into HelperResult', () => {
    const { project, dispatch } = stubProject();
    const result = exec(project, 'addThemeSelector', {}, {
      command: 'theme.addSelector',
      summary: () => 'Added',
      afterDispatch: () => ({ createdId: '3', warnings: [{ code: 'W1', message: 'note' }] }),
    });
    expect(result.createdId).toBe('3');
    expect(result.warnings).toEqual([{ code: 'W1', message: 'note' }]);
    expect(dispatch).toHaveBeenCalled();
  });
});

describe('execBatch', () => {
  it('dispatches command array and uses summary(project, params)', () => {
    const { project, dispatch } = stubProject();
    const result = execBatch(project, 'unmapField', { sourcePath: '/a' }, {
      buildCommands: () => [
        { type: 'mapping.deleteRule', payload: { index: 1 } },
        { type: 'mapping.deleteRule', payload: { index: 0 } },
      ],
      summary: (_proj, p) => `Unmapped ${p.sourcePath} (2)`,
      affectedPaths: (p) => [p.sourcePath],
    });
    expect(dispatch).toHaveBeenCalledWith([
      { type: 'mapping.deleteRule', payload: { index: 1 } },
      { type: 'mapping.deleteRule', payload: { index: 0 } },
    ]);
    expect(result.summary).toBe('Unmapped /a (2)');
    expect(result.affectedPaths).toEqual(['/a']);
  });

  it('skips dispatch when buildCommands returns empty', () => {
    const { project, dispatch } = stubProject();
    execBatch(project, 'noop', { x: 1 }, {
      buildCommands: () => [],
      summary: () => 'no-op',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
