/** @filedesc Tests for core-owned DefinitionTreeEditor row helper derivations. */
import { describe, expect, it } from 'vitest';
import {
  buildAdvisories,
  buildDefinitionAdvisoryIssues,
  buildCategorySummaries,
  buildExpressionDiagnostics,
  buildMissingPropertyActions,
  buildRowSummaries,
  buildStatusPills,
  summarizeExpression,
} from '../src/editor-tree-helpers';
import type { Advisory, DefinitionAdvisoryIssue, ExpressionDiagnostic } from '../src/editor-tree-helpers';

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
      { label: 'Pre-fill', value: '@profile.income.amount' },
      { label: 'Relevant', value: 'Enabled is Yes' },
    ]);
  });

  it('builds status pills with verb-intent labels and specTerm tooltips', () => {
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
      { text: 'must fill', color: 'accent', specTerm: 'required' },
      { text: 'shows if', color: 'logic', specTerm: 'relevant' },
      { text: 'formula', color: 'green', specTerm: 'calculate' },
      { text: 'linked', color: 'amber', specTerm: 'prePopulate' },
      { text: 'validates', color: 'error', specTerm: 'constraint' },
      { text: 'locked', color: 'muted', specTerm: 'readonly' },
    ]);
  });

  it('buildStatusPills omits calculate/readonly pills when category Value already shows formula/locked', () => {
    const item = { key: 'x', type: 'field' } as any;
    const binds = { calculate: '$a', readonly: 'true' } as any;
    const summaries = buildCategorySummaries(item, binds);
    expect(summaries.Value).toContain('formula');
    expect(summaries.Value).toContain('locked');
    const pills = buildStatusPills(binds, item, { categorySummaries: summaries });
    expect(pills.find((p) => p.specTerm === 'calculate')).toBeUndefined();
    expect(pills.find((p) => p.specTerm === 'readonly')).toBeUndefined();
  });

  it('buildStatusPills with categorySummaries omits readonly pill when Value is only locked', () => {
    const item = { key: 'x', type: 'field' } as any;
    const binds = { readonly: 'true' } as any;
    const summaries = buildCategorySummaries(item, binds);
    expect(summaries.Value).toBe('locked');
    expect(buildStatusPills(binds, item, { categorySummaries: summaries })).toEqual([]);
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

  it('surfaces default bind as a status pill with specTerm', () => {
    const pills = buildStatusPills(
      { default: '42' },
      { key: 'age', type: 'field' } as any,
    );
    expect(pills).toContainEqual({ text: 'resets to', color: 'green', specTerm: 'default' });
  });

  it('includes default bind value in row summaries', () => {
    const summaries = buildRowSummaries(
      { key: 'age', type: 'field', dataType: 'integer', label: 'Age' } as any,
      { default: '42' },
    );
    expect(summaries).toContainEqual({ label: 'Default', value: '42' });
  });

  it('humanizes FEL default bind expressions in row summaries', () => {
    const summaries = buildRowSummaries(
      { key: 'age', type: 'field', dataType: 'integer', label: 'Age' } as any,
      { default: '$baseAge + 1' },
    );
    const def = summaries.find((s) => s.label === 'Default');
    expect(def).toBeDefined();
    // summarizeExpression returns humanized form or passthrough
    expect(def!.value).toBe('$baseAge + 1');
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

  describe('buildCategorySummaries', () => {
    it('produces four category slots for a field with binds and format', () => {
      const result = buildCategorySummaries(
        {
          key: 'amount', type: 'field', dataType: 'money', label: 'Amount',
          currency: 'USD', precision: 2,
        } as any,
        { required: 'true', relevant: '$enabled = true', constraint: '. > 0' },
      );
      expect(result).toEqual({
        Visibility: 'Enabled is Yes',
        Validation: '2 rules',
        Value: '\u2014',
        Format: 'USD 2dp',
      });
    });

    it('shows "Always" for visibility when no relevant bind', () => {
      const result = buildCategorySummaries(
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' } as any,
        {},
      );
      expect(result.Visibility).toBe('Always');
    });

    it('shows dash for empty categories', () => {
      const result = buildCategorySummaries(
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' } as any,
        {},
      );
      expect(result.Validation).toBe('\u2014');
      expect(result.Value).toBe('\u2014');
      expect(result.Format).toBe('\u2014');
    });

    it('summarizes value category with most relevant source', () => {
      const result = buildCategorySummaries(
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' } as any,
        { calculate: '$a + $b' },
      );
      expect(result.Value).toContain('formula');
    });

    it('counts validation rules (required + constraint)', () => {
      const result = buildCategorySummaries(
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' } as any,
        { required: 'true' },
      );
      expect(result.Validation).toBe('1 rule');
    });

    it('returns only Visibility and Description for display items', () => {
      const result = buildCategorySummaries(
        { key: 'header', type: 'display', label: 'Section Header', description: 'About you' } as any,
        { relevant: '$page = 2' },
      );
      expect(Object.keys(result)).toEqual(['Visibility', 'Description']);
      expect(result.Visibility).not.toBe('Always');
      expect(result.Description).toBe('About you');
    });

    it('shows format summary for money with currency only', () => {
      const result = buildCategorySummaries(
        { key: 'price', type: 'field', dataType: 'money', label: 'Price', currency: 'EUR' } as any,
        {},
      );
      expect(result.Format).toBe('EUR');
    });

    it('shows value as "locked" when only readonly is set', () => {
      const result = buildCategorySummaries(
        { key: 'status', type: 'field', dataType: 'string', label: 'Status' } as any,
        { readonly: 'true' },
      );
      expect(result.Value).toBe('locked');
    });

    it('shows formula and locked when calculate and readonly binds both exist', () => {
      const result = buildCategorySummaries(
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' } as any,
        { calculate: '$a + $b', readonly: 'true' },
      );
      expect(result.Value).toBe('formula \u00b7 locked');
    });

    it('appends locked when initial value and explicit readonly bind both exist', () => {
      const result = buildCategorySummaries(
        { key: 'code', type: 'field', dataType: 'string', label: 'Code', initialValue: 'ABC' } as any,
        { readonly: '$admin = false' },
      );
      expect(result.Value).toBe('ABC \u00b7 locked');
    });
  });

  describe('buildDefinitionAdvisoryIssues', () => {
    it('returns issues with path, label, and code for fields with advisories', () => {
      const issues: DefinitionAdvisoryIssue[] = buildDefinitionAdvisoryIssues(
        [
          { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
        ] as any,
        [{ path: 'name', required: 'true', readonly: 'true' }] as any,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe('name');
      expect(issues[0].label).toBe('Name');
      expect(issues[0].code).toBe('W900');
      expect(issues[0].message).toContain('locked with no value source');
    });

    it('produces advisories for nested items inside groups', () => {
      const issues: DefinitionAdvisoryIssue[] = buildDefinitionAdvisoryIssues(
        [
          {
            key: 'contact',
            type: 'group',
            label: 'Contact',
            children: [
              { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
            ],
          },
        ] as any,
        [{ path: 'contact.email', required: 'true', readonly: 'true' }] as any,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toBe('contact.email');
      expect(issues[0].label).toBe('Email');
      expect(issues[0].code).toBe('W900');
      expect(issues[0].message).toContain('locked with no value source');
    });

    it('returns empty when no field advisories', () => {
      expect(buildDefinitionAdvisoryIssues([], [])).toEqual([]);
      expect(
        buildDefinitionAdvisoryIssues(
          [{ key: 'x', type: 'field', dataType: 'string', label: 'X' }] as any,
          [],
        ),
      ).toEqual([]);
    });
  });

  describe('buildAdvisories', () => {
    // Advisory pattern 1: required + readonly without value source
    it('warns when required + readonly with no value source', () => {
      const advisories: Advisory[] = buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'locked', type: 'field', dataType: 'string', label: 'Locked' } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].code).toBe('W900');
      expect(advisories[0].message).toContain('locked with no value source');
      expect(advisories[0].actions).toEqual([
        { key: 'add_formula', label: 'Add formula' },
        { key: 'add_initial_value', label: 'Add initial value' },
        { key: 'add_pre_fill', label: 'Add pre-fill' },
      ]);
    });

    // Advisory pattern 2: prePopulate + calculate
    it('warns when prePopulate + calculate both present', () => {
      const advisories = buildAdvisories(
        { calculate: '$a + $b' },
        {
          key: 'total', type: 'field', dataType: 'decimal', label: 'Total',
          prePopulate: { instance: 'src', path: 'val' },
        } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].code).toBe('W901');
      expect(advisories[0].message).toContain('replaces the starting value from pre-fill');
      expect(advisories[0].actions).toEqual([
        { key: 'remove_pre_populate', label: 'Remove pre-fill' },
        { key: 'remove_formula', label: 'Remove formula' },
      ]);
    });

    // Advisory pattern 3: required + readonly + calculate
    it('warns when required + readonly + calculate makes required usually redundant', () => {
      const advisories = buildAdvisories(
        { required: 'true', readonly: 'true', calculate: '$x * 2' },
        { key: 'computed', type: 'field', dataType: 'decimal', label: 'Computed' } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].code).toBe('W902');
      expect(advisories[0].message).toContain('usually redundant unless the formula can return empty');
      expect(advisories[0].actions).toEqual([
        { key: 'remove_required', label: 'Remove mandatory rule' },
        { key: 'review_formula', label: 'Review formula' },
      ]);
    });

    // Non-advisory: required only
    it('returns empty for required only', () => {
      expect(buildAdvisories(
        { required: 'true' },
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' } as any,
      )).toEqual([]);
    });

    // Non-advisory: readonly only
    it('returns empty for readonly only', () => {
      expect(buildAdvisories(
        { readonly: 'true' },
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' } as any,
      )).toEqual([]);
    });

    // Non-advisory: required + calculate (formula provides value)
    it('returns empty for required + calculate (formula provides value)', () => {
      expect(buildAdvisories(
        { required: 'true', calculate: '$x + 1' },
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' } as any,
      )).toEqual([]);
    });

    // Non-advisory: required + initialValue (value source exists)
    it('returns empty for required + initialValue (value source exists)', () => {
      expect(buildAdvisories(
        { required: 'true' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age', initialValue: '18' } as any,
      )).toEqual([]);
    });

    // Non-advisory: readonly + calculate (only triggers when all 3 present)
    it('returns empty for readonly + calculate without required', () => {
      expect(buildAdvisories(
        { readonly: 'true', calculate: '$x' },
        { key: 'comp', type: 'field', dataType: 'string', label: 'Comp' } as any,
      )).toEqual([]);
    });

    // Edge case: required + readonly with initialValue — NOT an advisory (value source exists)
    it('returns empty for required + readonly + initialValue', () => {
      expect(buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F', initialValue: 'default' } as any,
      )).toEqual([]);
    });

    // Edge case: required + readonly with prePopulate — NOT an advisory (value source exists)
    it('returns empty for required + readonly + prePopulate', () => {
      expect(buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F', prePopulate: { instance: 'src', path: 'p' } } as any,
      )).toEqual([]);
    });

    // Edge case: empty binds, no item properties
    it('returns empty for no binds and plain field', () => {
      expect(buildAdvisories(
        {},
        { key: 'f', type: 'field', dataType: 'string', label: 'F' } as any,
      )).toEqual([]);
    });

    // Edge case: pattern 3 should NOT also trigger pattern 1
    // (required+readonly+calculate has a value source via calculate, so pattern 1 should not fire)
    it('required + readonly + calculate only triggers pattern 3, not pattern 1', () => {
      const advisories = buildAdvisories(
        { required: 'true', readonly: 'true', calculate: '$x' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F' } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].message).toContain('usually redundant');
    });

    // Edge case: required + readonly + calculate + prePopulate triggers pattern 3 AND pattern 2
    it('required + readonly + calculate + prePopulate triggers both pattern 3 and pattern 2', () => {
      const advisories = buildAdvisories(
        { required: 'true', readonly: 'true', calculate: '$x' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F', prePopulate: { instance: 's', path: 'p' } } as any,
      );
      expect(advisories).toHaveLength(2);
      expect(advisories[0].message).toContain('usually redundant');
      expect(advisories[1].message).toContain('replaces the starting value');
    });

    // Edge case: initialValue of 0 (falsy but valid value source)
    it('treats initialValue of 0 as a valid value source', () => {
      expect(buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'f', type: 'field', dataType: 'integer', label: 'F', initialValue: 0 } as any,
      )).toEqual([]);
    });

    // Edge case: initialValue of empty string is NOT a value source
    it('treats empty-string initialValue as no value source', () => {
      const advisories = buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F', initialValue: '' } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].message).toContain('locked with no value source');
    });

    // Edge case: whitespace-only initialValue is NOT a value source
    it('treats whitespace-only initialValue as no value source', () => {
      const advisories = buildAdvisories(
        { required: 'true', readonly: 'true' },
        { key: 'f', type: 'field', dataType: 'string', label: 'F', initialValue: '   ' } as any,
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].message).toContain('locked with no value source');
    });
  });

  describe('buildExpressionDiagnostics', () => {
    const keys = ['enabled', 'age', 'name', 'status'];

    it('returns null for empty expressions', () => {
      const result = buildExpressionDiagnostics({ required: '', relevant: '' }, keys);
      expect(result.required).toBeNull();
      expect(result.relevant).toBeNull();
    });

    it('returns null for valid literal expressions', () => {
      const result = buildExpressionDiagnostics({ required: 'true', readonly: 'true' }, keys);
      expect(result.required).toBeNull();
      expect(result.readonly).toBeNull();
    });

    it('returns null when all $-prefixed references are valid', () => {
      const result = buildExpressionDiagnostics(
        { relevant: '$enabled = true', calculate: '$age + $status' },
        keys,
      );
      expect(result.relevant).toBeNull();
      expect(result.calculate).toBeNull();
    });

    it('returns error with message for undefined $-prefixed references', () => {
      const result = buildExpressionDiagnostics(
        { relevant: '$unknownField = true' },
        keys,
      );
      expect(result.relevant).not.toBeNull();
      expect(result.relevant!.message).toContain('unknownField');
    });

    it('provides suggestions based on substring match', () => {
      const result = buildExpressionDiagnostics(
        { relevant: '$stat = true' },
        keys,
      );
      expect(result.relevant).not.toBeNull();
      expect(result.relevant!.suggestions).toContain('status');
    });

    it('returns empty suggestions when no substring match exists', () => {
      const result = buildExpressionDiagnostics(
        { relevant: '$zzzzz = true' },
        keys,
      );
      expect(result.relevant).not.toBeNull();
      expect(result.relevant!.suggestions).toEqual([]);
    });

    it('handles multiple broken references in one expression', () => {
      const result = buildExpressionDiagnostics(
        { calculate: '$foo + $bar' },
        keys,
      );
      expect(result.calculate).not.toBeNull();
      expect(result.calculate!.message).toContain('foo');
      expect(result.calculate!.message).toContain('bar');
    });

    it('handles dotted $-prefixed references by checking root key', () => {
      const result = buildExpressionDiagnostics(
        { relevant: '$enabled.sub = true' },
        keys,
      );
      // $enabled is valid even with .sub suffix
      expect(result.relevant).toBeNull();
    });

    it('ignores non-$ tokens', () => {
      const result = buildExpressionDiagnostics(
        { constraint: '. > 0 and someFunction(123)' },
        keys,
      );
      expect(result.constraint).toBeNull();
    });
  });

  describe('buildStatusPills with diagnostics', () => {
    it('sets warn on pills whose bind has a diagnostic error', () => {
      const binds = { relevant: '$badRef = true', required: 'true' };
      const diagnostics: Record<string, ExpressionDiagnostic | null> = {
        relevant: { message: 'Undefined reference: badRef', suggestions: [] },
        required: null,
      };
      const pills = buildStatusPills(binds, { key: 'f', type: 'field' } as any, {
        diagnostics,
      });
      const relevantPill = pills.find(p => p.specTerm === 'relevant');
      const requiredPill = pills.find(p => p.specTerm === 'required');
      expect(relevantPill?.warn).toBe(true);
      expect(requiredPill?.warn).toBeUndefined();
    });

    it('does not set warn when no diagnostics provided', () => {
      const pills = buildStatusPills(
        { required: 'true' },
        { key: 'f', type: 'field' } as any,
      );
      expect(pills[0].warn).toBeUndefined();
    });
  });
});
