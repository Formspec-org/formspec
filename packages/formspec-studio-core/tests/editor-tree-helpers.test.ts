/** @filedesc Tests for core-owned DefinitionTreeEditor row helper derivations. */
import { describe, expect, it } from 'vitest';
import {
  buildMissingPropertyActions,
  buildRowSummaries,
  buildStatusPills,
  summarizeExpression,
} from '../src/editor-tree-helpers';

describe('editor-tree-helpers', () => {
  it('humanizes simple FEL expressions for row summaries', () => {
    expect(summarizeExpression('$enabled = true')).toBe('Enabled is Yes');
    expect(summarizeExpression('$source.status')).toBe('$source.status');
  });

  it('builds prioritized field summaries from content, options, behavior, and config', () => {
    const summaries = buildRowSummaries(
      {
        key: 'amount',
        type: 'field',
        dataType: 'money',
        label: 'Amount',
        description: 'Monthly amount for review.',
        hint: 'Use gross income before deductions.',
        initialValue: '25',
        precision: 2,
        currency: 'USD',
        prefix: '$',
        semanticType: 'finance:amount',
        prePopulate: { instance: 'profile', path: 'income.amount' },
      } as any,
      { relevant: '$enabled = true', constraint: '. > 0' },
    );

    expect(summaries).toEqual([
      { label: 'Description', value: 'Monthly amount for review.' },
      { label: 'Hint', value: 'Use gross income before deductions.' },
      { label: 'Pre-fill', value: 'profile.income.amount' },
      { label: 'Relevant', value: 'Enabled is Yes' },
    ]);
  });

  it('builds status pills from binds and pre-populate state', () => {
    const pills = buildStatusPills(
      {
        required: 'true',
        relevant: '$enabled = true',
        calculate: '$source.status',
        constraint: '. > 0',
        readonly: '$locked = true',
      },
      { key: 'status', type: 'field', prePopulate: { instance: 'profile', path: 'status' } } as any,
    );

    expect(pills).toEqual([
      { text: 'req', color: 'accent' },
      { text: 'rel', color: 'logic' },
      { text: 'ƒx', color: 'green' },
      { text: 'pre', color: 'amber' },
      { text: 'rule', color: 'error' },
      { text: 'ro', color: 'muted' },
    ]);
  });

  it('suggests missing group description and hint before behavior', () => {
    const actions = buildMissingPropertyActions(
      { key: 'household', type: 'group', label: 'Household' } as any,
      {},
      'Household',
    );

    expect(actions).toEqual([
      { key: 'hint', label: '+ Add hint', ariaLabel: 'Add hint to Household' },
      { key: 'description', label: '+ Add description', ariaLabel: 'Add description to Household' },
      { key: 'behavior', label: '+ Add behavior', ariaLabel: 'Add behavior to Household' },
    ]);
  });

  it('does not suggest behavior when any behavior rule already exists', () => {
    const actions = buildMissingPropertyActions(
      { key: 'email', type: 'field', label: 'Email' } as any,
      { required: 'true' },
      'Email',
    );

    expect(actions).toEqual([]);
  });

  it('reads options from the spec-normative options property only (not choices)', () => {
    const summaries = buildRowSummaries(
      {
        key: 'color',
        type: 'field',
        dataType: 'choice',
        label: 'Color',
        options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
        choices: [{ value: 'x' }],
      } as any,
      {},
    );
    const optionsEntry = summaries.find((s) => s.label === 'Options');
    expect(optionsEntry?.value).toBe('2 choices');
  });

  it('does not fall back to a non-spec choices property when options is absent', () => {
    const summaries = buildRowSummaries(
      {
        key: 'color',
        type: 'field',
        dataType: 'choice',
        label: 'Color',
        choices: [{ value: 'x' }],
      } as any,
      {},
    );
    const optionsEntry = summaries.find((s) => s.label === 'Options');
    expect(optionsEntry).toBeUndefined();
  });
});
