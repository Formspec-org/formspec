import { describe, expect, it } from 'vitest';
import {
  formatPrePopulateCombined,
  parsePrePopulateCombined,
} from '../../../src/workspaces/editor/pre-populate-combined';

describe('pre-populate-combined', () => {
  it('formats with leading @', () => {
    expect(formatPrePopulateCombined('priorYear', 'totals.income')).toBe('@priorYear.totals.income');
    expect(formatPrePopulateCombined('a', '')).toBe('@a');
    expect(formatPrePopulateCombined('', '')).toBe('');
  });

  it('parsePrePopulateCombined prepends @ when missing', () => {
    expect(parsePrePopulateCombined('foo.bar')).toEqual({ instance: 'foo', path: 'bar' });
  });

  it('parsePrePopulateCombined accepts @ and $', () => {
    expect(parsePrePopulateCombined('@x.y')).toEqual({ instance: 'x', path: 'y' });
    expect(parsePrePopulateCombined('$db.field')).toEqual({ instance: 'db', path: 'field' });
  });

  it('parsePrePopulateCombined handles instance-only body', () => {
    expect(parsePrePopulateCombined('@only')).toEqual({ instance: 'only', path: '' });
    expect(parsePrePopulateCombined('')).toEqual({ instance: '', path: '' });
  });
});
