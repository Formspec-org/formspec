import { describe, it, expect } from 'vitest';
import { buildLabelMap } from '../../../src/workspaces/pages/usePageStructure';

describe('buildLabelMap', () => {
  it('maps item keys to labels', () => {
    const items = [
      { key: 'name', label: 'Full Name', type: 'field' },
      { key: 'email', label: 'Email', type: 'field' },
    ];
    const map = buildLabelMap(items);
    expect(map.get('name')).toBe('Full Name');
    expect(map.get('email')).toBe('Email');
  });

  it('falls back to key when label is absent', () => {
    const items = [{ key: 'age', type: 'field' }];
    const map = buildLabelMap(items);
    expect(map.get('age')).toBe('age');
  });

  it('walks children recursively', () => {
    const items = [
      {
        key: 'group1', label: 'Group', type: 'group',
        children: [{ key: 'child1', label: 'Child', type: 'field' }],
      },
    ];
    const map = buildLabelMap(items);
    expect(map.get('group1')).toBe('Group');
    expect(map.get('child1')).toBe('Child');
  });

  it('returns empty map for empty items', () => {
    expect(buildLabelMap([]).size).toBe(0);
  });
});
