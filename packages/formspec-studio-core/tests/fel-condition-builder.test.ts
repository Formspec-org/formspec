/** @filedesc Tests for FEL condition builder: generation, parsing, and operator catalogs. */
import { describe, expect, it } from 'vitest';
import {
  conditionToFEL,
  groupToFEL,
  parseFELToGroup,
  getOperatorsForDataType,
  getOperatorLabel,
  operatorRequiresValue,
  type Condition,
  type ConditionGroup,
} from '../src/fel-condition-builder';

describe('fel-condition-builder', () => {
  describe('conditionToFEL', () => {
    it('generates equality comparison', () => {
      const c: Condition = { field: 'applicantType', operator: 'eq', value: "'nonprofit'" };
      expect(conditionToFEL(c)).toBe("$applicantType = 'nonprofit'");
    });

    it('generates inequality comparison', () => {
      const c: Condition = { field: 'orgType', operator: 'neq', value: "'government'" };
      expect(conditionToFEL(c)).toBe("$orgType != 'government'");
    });

    it('generates greater-than comparison', () => {
      const c: Condition = { field: 'age', operator: 'gt', value: '18' };
      expect(conditionToFEL(c)).toBe('$age > 18');
    });

    it('generates greater-than-or-equal comparison', () => {
      const c: Condition = { field: 'score', operator: 'gte', value: '5' };
      expect(conditionToFEL(c)).toBe('$score >= 5');
    });

    it('generates less-than comparison', () => {
      const c: Condition = { field: 'income', operator: 'lt', value: '50000' };
      expect(conditionToFEL(c)).toBe('$income < 50000');
    });

    it('generates less-than-or-equal comparison', () => {
      const c: Condition = { field: 'painLevel', operator: 'lte', value: '10' };
      expect(conditionToFEL(c)).toBe('$painLevel <= 10');
    });

    it('generates boolean true check', () => {
      const c: Condition = { field: 'hasAllergies', operator: 'is_true', value: '' };
      expect(conditionToFEL(c)).toBe('$hasAllergies = true');
    });

    it('generates boolean false check', () => {
      const c: Condition = { field: 'isMinor', operator: 'is_false', value: '' };
      expect(conditionToFEL(c)).toBe('$isMinor = false');
    });

    it('generates string contains check', () => {
      const c: Condition = { field: 'name', operator: 'contains', value: "'test'" };
      expect(conditionToFEL(c)).toBe("contains($name, 'test')");
    });

    it('generates string starts-with check', () => {
      const c: Condition = { field: 'code', operator: 'starts_with', value: "'ABC'" };
      expect(conditionToFEL(c)).toBe("startsWith($code, 'ABC')");
    });

    it('generates null check', () => {
      const c: Condition = { field: 'endDate', operator: 'is_null', value: '' };
      expect(conditionToFEL(c)).toBe('isNull($endDate)');
    });

    it('generates not-null check', () => {
      const c: Condition = { field: 'startDate', operator: 'is_not_null', value: '' };
      expect(conditionToFEL(c)).toBe('not isNull($startDate)');
    });

    it('generates empty check', () => {
      const c: Condition = { field: 'notes', operator: 'is_empty', value: '' };
      expect(conditionToFEL(c)).toBe('empty($notes)');
    });

    it('generates present check', () => {
      const c: Condition = { field: 'email', operator: 'is_present', value: '' };
      expect(conditionToFEL(c)).toBe('present($email)');
    });

    it('generates money amount less-than', () => {
      const c: Condition = { field: 'requestedAmount', operator: 'money_lt', value: '50000' };
      expect(conditionToFEL(c)).toBe('moneyAmount($requestedAmount) < 50000');
    });

    it('generates money amount greater-than-or-equal', () => {
      const c: Condition = { field: 'budget', operator: 'money_gte', value: '10000' };
      expect(conditionToFEL(c)).toBe('moneyAmount($budget) >= 10000');
    });

    it('generates self-reference for constraint binds', () => {
      const c: Condition = { field: '$', operator: 'gte', value: '0' };
      expect(conditionToFEL(c)).toBe('$ >= 0');
    });

    it('generates self-reference with boolean check', () => {
      const c: Condition = { field: '$', operator: 'is_true', value: '' };
      expect(conditionToFEL(c)).toBe('$ = true');
    });

    it('handles nested field paths', () => {
      const c: Condition = { field: 'applicantInfo.orgType', operator: 'eq', value: "'nonprofit'" };
      expect(conditionToFEL(c)).toBe("$applicantInfo.orgType = 'nonprofit'");
    });
  });

  describe('groupToFEL', () => {
    it('returns empty string for empty group', () => {
      const g: ConditionGroup = { logic: 'and', conditions: [] };
      expect(groupToFEL(g)).toBe('');
    });

    it('returns single condition without connector', () => {
      const g: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'age', operator: 'gte', value: '18' }],
      };
      expect(groupToFEL(g)).toBe('$age >= 18');
    });

    it('joins conditions with AND', () => {
      const g: ConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'age', operator: 'gte', value: '18' },
          { field: 'income', operator: 'lt', value: '50000' },
        ],
      };
      expect(groupToFEL(g)).toBe('$age >= 18 and $income < 50000');
    });

    it('joins conditions with OR', () => {
      const g: ConditionGroup = {
        logic: 'or',
        conditions: [
          { field: 'complaint', operator: 'eq', value: "'emergency'" },
          { field: 'painLevel', operator: 'gte', value: '8' },
        ],
      };
      expect(groupToFEL(g)).toBe("$complaint = 'emergency' or $painLevel >= 8");
    });

    it('joins three conditions with AND', () => {
      const g: ConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'a', operator: 'is_true', value: '' },
          { field: 'b', operator: 'is_true', value: '' },
          { field: 'c', operator: 'is_true', value: '' },
        ],
      };
      expect(groupToFEL(g)).toBe('$a = true and $b = true and $c = true');
    });
  });

  describe('parseFELToGroup', () => {
    it('returns null for empty string', () => {
      expect(parseFELToGroup('')).toBeNull();
    });

    it('returns null for whitespace', () => {
      expect(parseFELToGroup('   ')).toBeNull();
    });

    it('parses simple equality', () => {
      const result = parseFELToGroup("$applicantType = 'forprofit'");
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'applicantType', operator: 'eq', value: "'forprofit'" }],
      });
    });

    it('parses simple inequality', () => {
      const result = parseFELToGroup("$orgType != 'government'");
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'orgType', operator: 'neq', value: "'government'" }],
      });
    });

    it('parses greater-than', () => {
      const result = parseFELToGroup('$age > 18');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'age', operator: 'gt', value: '18' }],
      });
    });

    it('parses greater-than-or-equal', () => {
      const result = parseFELToGroup('$score >= 5');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'score', operator: 'gte', value: '5' }],
      });
    });

    it('parses less-than', () => {
      const result = parseFELToGroup('$income < 50000');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'income', operator: 'lt', value: '50000' }],
      });
    });

    it('parses less-than-or-equal', () => {
      const result = parseFELToGroup('$painLevel <= 10');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'painLevel', operator: 'lte', value: '10' }],
      });
    });

    it('parses boolean true', () => {
      const result = parseFELToGroup('$hasAllergies = true');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'hasAllergies', operator: 'is_true', value: '' }],
      });
    });

    it('parses boolean false', () => {
      const result = parseFELToGroup('$isMinor = false');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'isMinor', operator: 'is_false', value: '' }],
      });
    });

    it('parses contains()', () => {
      const result = parseFELToGroup("contains($name, 'test')");
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'name', operator: 'contains', value: "'test'" }],
      });
    });

    it('parses startsWith()', () => {
      const result = parseFELToGroup("startsWith($code, 'ABC')");
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'code', operator: 'starts_with', value: "'ABC'" }],
      });
    });

    it('parses isNull()', () => {
      const result = parseFELToGroup('isNull($endDate)');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'endDate', operator: 'is_null', value: '' }],
      });
    });

    it('parses not isNull()', () => {
      const result = parseFELToGroup('not isNull($startDate)');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'startDate', operator: 'is_not_null', value: '' }],
      });
    });

    it('parses empty()', () => {
      const result = parseFELToGroup('empty($notes)');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'notes', operator: 'is_empty', value: '' }],
      });
    });

    it('parses present()', () => {
      const result = parseFELToGroup('present($email)');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'email', operator: 'is_present', value: '' }],
      });
    });

    it('parses moneyAmount comparison', () => {
      const result = parseFELToGroup('moneyAmount($requestedAmount) < 50000');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'requestedAmount', operator: 'money_lt', value: '50000' }],
      });
    });

    it('parses moneyAmount greater-than-or-equal', () => {
      const result = parseFELToGroup('moneyAmount($budget) >= 10000');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'budget', operator: 'money_gte', value: '10000' }],
      });
    });

    it('parses self-reference constraint', () => {
      const result = parseFELToGroup('$ >= 0');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: '$', operator: 'gte', value: '0' }],
      });
    });

    it('parses nested field path', () => {
      const result = parseFELToGroup("$applicantInfo.orgType = 'nonprofit'");
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'applicantInfo.orgType', operator: 'eq', value: "'nonprofit'" }],
      });
    });

    it('parses AND-connected group', () => {
      const result = parseFELToGroup('$age >= 18 and $income < 50000');
      expect(result).toEqual({
        logic: 'and',
        conditions: [
          { field: 'age', operator: 'gte', value: '18' },
          { field: 'income', operator: 'lt', value: '50000' },
        ],
      });
    });

    it('parses OR-connected group', () => {
      const result = parseFELToGroup("$complaint = 'emergency' or $painLevel >= 8");
      expect(result).toEqual({
        logic: 'or',
        conditions: [
          { field: 'complaint', operator: 'eq', value: "'emergency'" },
          { field: 'painLevel', operator: 'gte', value: '8' },
        ],
      });
    });

    it('parses three-condition AND group', () => {
      const result = parseFELToGroup('$a = true and $b = true and $c = true');
      expect(result).toEqual({
        logic: 'and',
        conditions: [
          { field: 'a', operator: 'is_true', value: '' },
          { field: 'b', operator: 'is_true', value: '' },
          { field: 'c', operator: 'is_true', value: '' },
        ],
      });
    });

    it('returns null for complex expressions (function calls)', () => {
      expect(parseFELToGroup('sum($items[*].amount)')).toBeNull();
    });

    it('returns null for nested expressions', () => {
      expect(parseFELToGroup('($a > 0 or $b > 0) and $c > 0')).toBeNull();
    });

    it('returns null for mixed AND/OR', () => {
      expect(parseFELToGroup('$a > 0 and $b > 0 or $c > 0')).toBeNull();
    });

    it('returns null for ternary', () => {
      expect(parseFELToGroup('$a > 0 ? 1 : 0')).toBeNull();
    });

    it('returns null for let bindings', () => {
      expect(parseFELToGroup("let x = $a in x > 0")).toBeNull();
    });

    it('returns null for arithmetic', () => {
      expect(parseFELToGroup('$a + $b')).toBeNull();
    });

    it('parses bare true literal as single boolean true condition', () => {
      const result = parseFELToGroup('true');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: '', operator: 'is_true', value: '' }],
      });
    });

    it('parses bare false literal as single boolean false condition', () => {
      const result = parseFELToGroup('false');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: '', operator: 'is_false', value: '' }],
      });
    });

    it('parses string with double quotes', () => {
      const result = parseFELToGroup('$type = "nonprofit"');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'type', operator: 'eq', value: "'nonprofit'" }],
      });
    });

    it('handles whitespace around operators', () => {
      const result = parseFELToGroup('  $age  >=  18  ');
      expect(result).toEqual({
        logic: 'and',
        conditions: [{ field: 'age', operator: 'gte', value: '18' }],
      });
    });
  });

  describe('generation → parsing roundtrip', () => {
    it('roundtrips simple equality', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'applicantType', operator: 'eq', value: "'nonprofit'" },
        ],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips multi-condition AND', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'age', operator: 'gte', value: '18' },
          { field: 'income', operator: 'lt', value: '50000' },
        ],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips multi-condition OR', () => {
      const group: ConditionGroup = {
        logic: 'or',
        conditions: [
          { field: 'complaint', operator: 'eq', value: "'emergency'" },
          { field: 'painLevel', operator: 'gte', value: '8' },
        ],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips boolean true', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'flag', operator: 'is_true', value: '' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips boolean false', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'flag', operator: 'is_false', value: '' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips contains', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'name', operator: 'contains', value: "'test'" }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips isNull', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'endDate', operator: 'is_null', value: '' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips not isNull', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'startDate', operator: 'is_not_null', value: '' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips money comparison', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'amount', operator: 'money_lt', value: '50000' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips self-reference constraint', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: '$', operator: 'gte', value: '0' }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips nested field path', () => {
      const group: ConditionGroup = {
        logic: 'and',
        conditions: [{ field: 'applicantInfo.orgType', operator: 'eq', value: "'nonprofit'" }],
      };
      const fel = groupToFEL(group);
      const parsed = parseFELToGroup(fel);
      expect(parsed).toEqual(group);
    });

    it('roundtrips comparison and string operators not covered above', () => {
      const groups: ConditionGroup[] = [
        { logic: 'and', conditions: [{ field: 'x', operator: 'neq', value: "'a'" }] },
        { logic: 'and', conditions: [{ field: 'n', operator: 'gt', value: '0' }] },
        { logic: 'and', conditions: [{ field: 'n', operator: 'lt', value: '100' }] },
        { logic: 'and', conditions: [{ field: 'n', operator: 'lte', value: '10' }] },
        { logic: 'and', conditions: [{ field: 'code', operator: 'starts_with', value: "'AB'" }] },
        { logic: 'and', conditions: [{ field: 'notes', operator: 'is_empty', value: '' }] },
        { logic: 'and', conditions: [{ field: 'email', operator: 'is_present', value: '' }] },
        {
          logic: 'and',
          conditions: [{ field: 'amt', operator: 'money_eq', value: '100' }],
        },
      ];
      for (const group of groups) {
        expect(parseFELToGroup(groupToFEL(group))).toEqual(group);
      }
    });
  });

  describe('getOperatorsForDataType', () => {
    it('returns boolean operators for boolean type', () => {
      const ops = getOperatorsForDataType('boolean');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['is_true', 'is_false']),
      );
      expect(ops).toHaveLength(2);
    });

    it('returns comparison operators for integer type', () => {
      const ops = getOperatorsForDataType('integer');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      );
    });

    it('returns comparison and string operators for string type', () => {
      const ops = getOperatorsForDataType('string');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['eq', 'neq', 'contains', 'starts_with']),
      );
    });

    it('returns money operators for money type', () => {
      const ops = getOperatorsForDataType('money');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['money_eq', 'money_neq', 'money_gt', 'money_gte', 'money_lt', 'money_lte']),
      );
    });

    it('returns comparison operators for number type', () => {
      const ops = getOperatorsForDataType('number');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      );
    });

    it('returns equality operators for choice type', () => {
      const ops = getOperatorsForDataType('choice');
      expect(ops.map((o) => o.operator)).toEqual(
        expect.arrayContaining(['eq', 'neq']),
      );
    });

    it('returns all comparison operators for default/unknown type', () => {
      const ops = getOperatorsForDataType('unknown');
      expect(ops.length).toBeGreaterThan(0);
    });
  });

  describe('getOperatorLabel', () => {
    it('returns human-readable labels', () => {
      expect(getOperatorLabel('eq')).toBe('equals');
      expect(getOperatorLabel('neq')).toBe('does not equal');
      expect(getOperatorLabel('gt')).toBe('is greater than');
      expect(getOperatorLabel('gte')).toBe('is at least');
      expect(getOperatorLabel('lt')).toBe('is less than');
      expect(getOperatorLabel('lte')).toBe('is at most');
      expect(getOperatorLabel('is_true')).toBe('is Yes');
      expect(getOperatorLabel('is_false')).toBe('is No');
      expect(getOperatorLabel('contains')).toBe('contains');
      expect(getOperatorLabel('starts_with')).toBe('starts with');
      expect(getOperatorLabel('money_lt')).toBe('amount is less than');
      expect(getOperatorLabel('money_gte')).toBe('amount is at least');
    });
  });

  describe('operatorRequiresValue', () => {
    it('returns false for boolean operators', () => {
      expect(operatorRequiresValue('is_true')).toBe(false);
      expect(operatorRequiresValue('is_false')).toBe(false);
    });

    it('returns false for null/empty operators', () => {
      expect(operatorRequiresValue('is_null')).toBe(false);
      expect(operatorRequiresValue('is_not_null')).toBe(false);
      expect(operatorRequiresValue('is_empty')).toBe(false);
      expect(operatorRequiresValue('is_present')).toBe(false);
    });

    it('returns true for comparison operators', () => {
      expect(operatorRequiresValue('eq')).toBe(true);
      expect(operatorRequiresValue('neq')).toBe(true);
      expect(operatorRequiresValue('gt')).toBe(true);
      expect(operatorRequiresValue('money_lt')).toBe(true);
    });
  });
});
