import { describe, expect, it } from 'vitest';
import {
  buildFieldDetailLaunchers,
  computeOrphanFieldDetailLabel,
  fieldDetailOrphanHeading,
} from '../../../src/workspaces/editor/item-row-field-detail';

describe('item-row-field-detail', () => {
  it('buildFieldDetailLaunchers lists only unused, applicable keys', () => {
    const item = {
      key: 'a',
      type: 'field' as const,
      dataType: 'money',
      label: 'Amt',
    };
    const launchers = buildFieldDetailLaunchers({
      item,
      testIdPrefix: 'field-a',
      activeInlineSummary: null,
      isDecimalLike: true,
    });
    const labels = launchers.map((l) => l.label);
    expect(labels).toContain('Initial');
    expect(labels).toContain('Pre-fill');
    expect(labels).toContain('Currency');
    expect(labels).toContain('Precision');
    expect(launchers.find((l) => l.label === 'Initial')?.testId).toBe('field-a-add-initial');
  });

  it('buildFieldDetailLaunchers omits keys that are set', () => {
    const item = {
      key: 'a',
      type: 'field' as const,
      dataType: 'string',
      label: 'x',
      prefix: '$',
    };
    const launchers = buildFieldDetailLaunchers({
      item,
      testIdPrefix: 'field-a',
      activeInlineSummary: null,
      isDecimalLike: false,
    });
    expect(launchers.map((l) => l.label)).not.toContain('Prefix');
  });

  it('computeOrphanFieldDetailLabel requires summary row absent', () => {
    expect(
      computeOrphanFieldDetailLabel('Semantic', [{ label: 'Hint' }]),
    ).toBe('Semantic');
    expect(
      computeOrphanFieldDetailLabel('Semantic', [{ label: 'Semantic' }]),
    ).toBeNull();
    expect(computeOrphanFieldDetailLabel('Hint', [{ label: 'Hint' }])).toBeNull();
  });

  it('fieldDetailOrphanHeading maps spec ids to display titles', () => {
    expect(fieldDetailOrphanHeading('Initial')).toBe('Initial value');
    expect(fieldDetailOrphanHeading('Semantic')).toBe('Semantic type');
    expect(fieldDetailOrphanHeading('Prefix')).toBe('Prefix');
    expect(fieldDetailOrphanHeading('Pre-fill')).toBe('Pre-fill');
  });

  it('buildFieldDetailLaunchers omits Pre-fill when prePopulate is set', () => {
    const item = {
      key: 'a',
      type: 'field' as const,
      dataType: 'string',
      label: 'x',
      prePopulate: { instance: 'p', path: 'q' },
    };
    const launchers = buildFieldDetailLaunchers({
      item,
      testIdPrefix: 'field-a',
      activeInlineSummary: null,
      isDecimalLike: false,
    });
    expect(launchers.map((l) => l.label)).not.toContain('Pre-fill');
    expect(launchers.find((l) => l.label === 'Pre-fill')).toBeUndefined();
  });
});
