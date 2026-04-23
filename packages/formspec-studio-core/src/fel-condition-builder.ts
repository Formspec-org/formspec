/**
 * @filedesc FEL condition builder: generate FEL from structured conditions; parse supported FEL back via WASM only
 * (`tryLiftConditionGroup` → `crates/formspec-core/src/fel_condition_group_lift.rs`).
 */
import { tryLiftConditionGroup, type FELConditionGroupLifted } from '@formspec-org/engine';
import type { FELEditorFieldOption } from './fel-editor-utils';

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
export type BooleanOperator = 'is_true' | 'is_false';
export type StringOperator = 'contains' | 'starts_with';
export type NullCheckOperator = 'is_null' | 'is_not_null' | 'is_empty' | 'is_present';
export type MoneyOperator = 'money_eq' | 'money_neq' | 'money_gt' | 'money_gte' | 'money_lt' | 'money_lte';

export type Operator =
  | ComparisonOperator
  | BooleanOperator
  | StringOperator
  | NullCheckOperator
  | MoneyOperator;

export interface Condition {
  field: string;
  operator: Operator;
  value: string;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: Condition[];
}

export interface OperatorInfo {
  operator: Operator;
  label: string;
  requiresValue: boolean;
}

const OPERATOR_INFO: Record<Operator, OperatorInfo> = {
  eq: { operator: 'eq', label: 'equals', requiresValue: true },
  neq: { operator: 'neq', label: 'does not equal', requiresValue: true },
  gt: { operator: 'gt', label: 'is greater than', requiresValue: true },
  gte: { operator: 'gte', label: 'is at least', requiresValue: true },
  lt: { operator: 'lt', label: 'is less than', requiresValue: true },
  lte: { operator: 'lte', label: 'is at most', requiresValue: true },
  is_true: { operator: 'is_true', label: 'is Yes', requiresValue: false },
  is_false: { operator: 'is_false', label: 'is No', requiresValue: false },
  contains: { operator: 'contains', label: 'contains', requiresValue: true },
  starts_with: { operator: 'starts_with', label: 'starts with', requiresValue: true },
  is_null: { operator: 'is_null', label: 'is empty (null)', requiresValue: false },
  is_not_null: { operator: 'is_not_null', label: 'is not empty', requiresValue: false },
  is_empty: { operator: 'is_empty', label: 'is blank', requiresValue: false },
  is_present: { operator: 'is_present', label: 'has a value', requiresValue: false },
  money_eq: { operator: 'money_eq', label: 'amount equals', requiresValue: true },
  money_neq: { operator: 'money_neq', label: 'amount does not equal', requiresValue: true },
  money_gt: { operator: 'money_gt', label: 'amount is greater than', requiresValue: true },
  money_gte: { operator: 'money_gte', label: 'amount is at least', requiresValue: true },
  money_lt: { operator: 'money_lt', label: 'amount is less than', requiresValue: true },
  money_lte: { operator: 'money_lte', label: 'amount is at most', requiresValue: true },
};

const COMPARISON_OPS: OperatorInfo[] = (['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as Operator[]).map(
  (op) => OPERATOR_INFO[op],
);

const MONEY_OPS: OperatorInfo[] = (['money_eq', 'money_neq', 'money_gt', 'money_gte', 'money_lt', 'money_lte'] as Operator[]).map(
  (op) => OPERATOR_INFO[op],
);

const OPERATORS_BY_DATA_TYPE: Record<string, OperatorInfo[]> = {
  boolean: [OPERATOR_INFO.is_true, OPERATOR_INFO.is_false],
  choice: [OPERATOR_INFO.eq, OPERATOR_INFO.neq],
  integer: [...COMPARISON_OPS, OPERATOR_INFO.is_null, OPERATOR_INFO.is_not_null],
  number: [...COMPARISON_OPS, OPERATOR_INFO.is_null, OPERATOR_INFO.is_not_null],
  money: [...MONEY_OPS, OPERATOR_INFO.is_null, OPERATOR_INFO.is_not_null],
  string: [OPERATOR_INFO.eq, OPERATOR_INFO.neq, OPERATOR_INFO.contains, OPERATOR_INFO.starts_with, OPERATOR_INFO.is_empty, OPERATOR_INFO.is_present],
  date: [OPERATOR_INFO.eq, OPERATOR_INFO.neq, OPERATOR_INFO.gt, OPERATOR_INFO.gte, OPERATOR_INFO.lt, OPERATOR_INFO.lte, OPERATOR_INFO.is_null, OPERATOR_INFO.is_not_null],
};

const DEFAULT_OPS: OperatorInfo[] = [...COMPARISON_OPS, OPERATOR_INFO.is_null, OPERATOR_INFO.is_not_null];

function fieldRef(field: string): string {
  return field === '$' ? '$' : `$${field}`;
}

export function conditionToFEL(condition: Condition): string {
  const { field, operator, value } = condition;
  const ref = fieldRef(field);

  switch (operator) {
    case 'eq': return `${ref} = ${value}`;
    case 'neq': return `${ref} != ${value}`;
    case 'gt': return `${ref} > ${value}`;
    case 'gte': return `${ref} >= ${value}`;
    case 'lt': return `${ref} < ${value}`;
    case 'lte': return `${ref} <= ${value}`;
    case 'is_true': return `${ref} = true`;
    case 'is_false': return `${ref} = false`;
    case 'contains': return `contains(${ref}, ${value})`;
    case 'starts_with': return `startsWith(${ref}, ${value})`;
    case 'is_null': return `isNull(${ref})`;
    case 'is_not_null': return `not isNull(${ref})`;
    case 'is_empty': return `empty(${ref})`;
    case 'is_present': return `present(${ref})`;
    case 'money_eq': return `moneyAmount(${ref}) = ${value}`;
    case 'money_neq': return `moneyAmount(${ref}) != ${value}`;
    case 'money_gt': return `moneyAmount(${ref}) > ${value}`;
    case 'money_gte': return `moneyAmount(${ref}) >= ${value}`;
    case 'money_lt': return `moneyAmount(${ref}) < ${value}`;
    case 'money_lte': return `moneyAmount(${ref}) <= ${value}`;
  }
}

export function groupToFEL(group: ConditionGroup): string {
  if (group.conditions.length === 0) return '';
  return group.conditions.map((c) => conditionToFEL(c)).join(` ${group.logic} `);
}

function isOperatorName(s: string): s is Operator {
  return Object.prototype.hasOwnProperty.call(OPERATOR_INFO, s);
}

function conditionGroupFromLift(lift: FELConditionGroupLifted): ConditionGroup | null {
  const conditions: Condition[] = [];
  for (const row of lift.conditions) {
    if (!isOperatorName(row.operator)) return null;
    conditions.push({
      field: row.field,
      operator: row.operator,
      value: row.value,
    });
  }
  return { logic: lift.logic, conditions };
}

/**
 * Parse supported FEL into a structured group via Rust/WASM only (`tryLiftConditionGroup`).
 * There is no JavaScript fallback parser; behavior matches `fel_condition_group_lift` in
 * `formspec-core`.
 *
 * **Requires** `await initFormspecEngine()` then `await initFormspecEngineTools()` before calling
 * (same as Studio startup; `packages/formspec-studio-core/tests/setup.ts` for tests). If tools
 * WASM is not loaded, throws like other engine tools APIs.
 *
 * Returns `null` for blank input, expressions the lift cannot structure (`unlifted`), or if the
 * lifted operator string is not in the Studio {@link Operator} set (`conditionGroupFromLift`).
 */
export function parseFELToGroup(fel: string): ConditionGroup | null {
  const trimmed = fel.trim();
  if (!trimmed) return null;

  const lift = tryLiftConditionGroup(trimmed);
  if (lift.status === 'lifted') {
    return conditionGroupFromLift(lift);
  }
  return null;
}

export function getOperatorsForDataType(dataType: string): OperatorInfo[] {
  return OPERATORS_BY_DATA_TYPE[dataType] ?? DEFAULT_OPS;
}

export function getOperatorLabel(operator: Operator): string {
  return OPERATOR_INFO[operator].label;
}

export function operatorRequiresValue(operator: Operator): boolean {
  return OPERATOR_INFO[operator].requiresValue;
}

export function fieldOptionsFromItems(items: FELEditorFieldOption[]): FELEditorFieldOption[] {
  return items.filter((f) => f.path !== '$');
}

export function emptyCondition(field?: string): Condition {
  return { field: field ?? '', operator: 'eq', value: '' };
}

export function emptyGroup(): ConditionGroup {
  return { logic: 'and', conditions: [emptyCondition()] };
}

export function unquoteFELValue(value: string): string {
  return value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
}

export function quoteFELValue(raw: string): string {
  const isNumeric = /^\d+(\.\d+)?$/.test(raw);
  const isKeyword = raw === 'true' || raw === 'false' || raw === 'null';
  const needsQuotes = raw.length > 0 && !isNumeric && !isKeyword;
  return needsQuotes ? "'" + raw + "'" : raw;
}
