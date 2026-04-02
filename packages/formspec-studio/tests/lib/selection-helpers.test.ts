import { describe, it, expect } from 'vitest';
import {
  pruneDescendants,
  sortForBatchDelete,
  buildBatchMoveCommands,
} from '@formspec-org/studio-core';

describe('pruneDescendants', () => {
  it('removes a child when its parent is also selected', () => {
    const paths = new Set(['contact', 'contact.email']);
    expect(pruneDescendants(paths)).toEqual(['contact']);
  });

  it('keeps siblings that are not ancestors of each other', () => {
    const paths = new Set(['name', 'age']);
    const result = pruneDescendants(paths);
    expect(result).toContain('name');
    expect(result).toContain('age');
    expect(result).toHaveLength(2);
  });

  it('handles deeply nested descendants', () => {
    const paths = new Set(['a', 'a.b', 'a.b.c']);
    expect(pruneDescendants(paths)).toEqual(['a']);
  });

  it('does not treat "foo" as ancestor of "foobar"', () => {
    const paths = new Set(['foo', 'foobar']);
    const result = pruneDescendants(paths);
    expect(result).toContain('foo');
    expect(result).toContain('foobar');
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty set', () => {
    expect(pruneDescendants(new Set())).toEqual([]);
  });

  it('prunes multiple branches independently', () => {
    const paths = new Set(['group1', 'group1.field1', 'group2', 'group2.field2']);
    const result = pruneDescendants(paths);
    expect(result.sort()).toEqual(['group1', 'group2']);
  });
});

describe('sortForBatchDelete', () => {
  it('sorts deepest paths first', () => {
    const paths = ['a', 'a.b', 'a.b.c'];
    expect(sortForBatchDelete(paths)).toEqual(['a.b.c', 'a.b', 'a']);
  });

  it('preserves order for same-depth paths', () => {
    const paths = ['x', 'y', 'z'];
    const sorted = sortForBatchDelete(paths);
    // All depth-1, so relative order among them is preserved
    expect(sorted).toEqual(['x', 'y', 'z']);
  });

  it('handles mixed depths', () => {
    const paths = ['root', 'group.nested.deep', 'group.nested', 'other'];
    const sorted = sortForBatchDelete(paths);
    // depth 3 first, then depth 2, then depth 1
    expect(sorted.indexOf('group.nested.deep')).toBeLessThan(sorted.indexOf('group.nested'));
    expect(sorted.indexOf('group.nested')).toBeLessThan(sorted.indexOf('root'));
  });

  it('returns empty array for empty input', () => {
    expect(sortForBatchDelete([])).toEqual([]);
  });
});

describe('buildBatchMoveCommands', () => {
  it('generates moveItem commands for each selected path', () => {
    const paths = new Set(['fieldA', 'fieldB']);
    const commands = buildBatchMoveCommands(paths, 'targetGroup');
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({
      type: 'definition.moveItem',
      payload: { sourcePath: 'fieldA', targetParentPath: 'targetGroup', targetIndex: 0 },
    });
    expect(commands[1]).toEqual({
      type: 'definition.moveItem',
      payload: { sourcePath: 'fieldB', targetParentPath: 'targetGroup', targetIndex: 1 },
    });
  });

  it('filters out the target group itself from the selection', () => {
    const paths = new Set(['fieldA', 'targetGroup', 'fieldB']);
    const commands = buildBatchMoveCommands(paths, 'targetGroup');
    expect(commands).toHaveLength(2);
    const sourcePaths = commands.map((c: any) => c.payload.sourcePath);
    expect(sourcePaths).not.toContain('targetGroup');
  });

  it('prunes descendants before generating commands', () => {
    const paths = new Set(['group1', 'group1.child', 'fieldA']);
    const commands = buildBatchMoveCommands(paths, 'targetGroup');
    const sourcePaths = commands.map((c: any) => c.payload.sourcePath);
    expect(sourcePaths).toContain('group1');
    expect(sourcePaths).toContain('fieldA');
    expect(sourcePaths).not.toContain('group1.child');
  });

  it('returns empty array when all paths are the target or descendants', () => {
    const paths = new Set(['targetGroup', 'targetGroup.child']);
    const commands = buildBatchMoveCommands(paths, 'targetGroup');
    expect(commands).toEqual([]);
  });

  it('assigns sequential targetIndex values', () => {
    const paths = new Set(['a', 'b', 'c']);
    const commands = buildBatchMoveCommands(paths, 'target');
    expect(commands.map((c: any) => c.payload.targetIndex)).toEqual([0, 1, 2]);
  });
});
