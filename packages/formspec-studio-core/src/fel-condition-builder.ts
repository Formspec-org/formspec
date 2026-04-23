/** @filedesc FEL condition builder: generate FEL from structured conditions and parse simple FEL back. */
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

export function parseFELToGroup(fel: string): ConditionGroup | null {
  const trimmed = fel.trim();
  if (!trimmed) return null;

  if (trimmed === 'true') {
    return { logic: 'and', conditions: [{ field: '', operator: 'is_true', value: '' }] };
  }
  if (trimmed === 'false') {
    return { logic: 'and', conditions: [{ field: '', operator: 'is_false', value: '' }] };
  }

  const connector = detectConnector(trimmed);
  if (!connector) return null;

  const parts = splitByConnector(trimmed, connector);
  if (!parts) return null;

  const conditions: Condition[] = [];
  for (const part of parts) {
    const cond = parseSingleCondition(part.trim());
    if (!cond) return null;
    conditions.push(cond);
  }

  if (conditions.length === 0) return null;
  return { logic: connector, conditions };
}

function detectConnector(fel: string): 'and' | 'or' | null {
  const hasAnd = containsTopLevel(fel, ' and ');
  const hasOr = containsTopLevel(fel, ' or ');

  if (hasAnd && hasOr) return null;
  if (hasOr) return 'or';
  return 'and';
}

function walkTopLevel(fel: string, onSegment: (offset: number) => void): void {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < fel.length; i++) {
    const ch = fel[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }

    if (depth === 0 && !inSingle && !inDouble) {
      onSegment(i);
    }
  }
}

function containsTopLevel(fel: string, token: string): boolean {
  let found = false;
  walkTopLevel(fel, (i) => {
    if (fel.slice(i, i + token.length) === token) found = true;
  });
  return found;
}

function splitByConnector(fel: string, connector: 'and' | 'or'): string[] | null {
  const token = ` ${connector} `;
  const parts: string[] = [];
  let lastSplit = 0;

  walkTopLevel(fel, (i) => {
    if (fel.slice(i, i + token.length) === token) {
      parts.push(fel.slice(lastSplit, i));
      lastSplit = i + token.length;
    }
  });

  if (lastSplit < fel.length) {
    parts.push(fel.slice(lastSplit));
  }

  return parts.length > 0 ? parts : null;
}

function parseSingleCondition(expr: string): Condition | null {
  const moneyMatch = expr.match(/^moneyAmount\((\$\w[\w.]*)\)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (moneyMatch) {
    const field = moneyMatch[1].slice(1);
    const op = moneyMatch[2];
    const value = moneyMatch[3].trim();
    return { field, operator: moneyOpToFEL(op), value };
  }

  const notIsNullMatch = expr.match(/^not\s+isNull\((\$\w[\w.]*)\)$/);
  if (notIsNullMatch) {
    return { field: notIsNullMatch[1].slice(1), operator: 'is_not_null', value: '' };
  }

  const isNullMatch = expr.match(/^isNull\((\$\w[\w.]*)\)$/);
  if (isNullMatch) {
    return { field: isNullMatch[1].slice(1), operator: 'is_null', value: '' };
  }

  const emptyMatch = expr.match(/^empty\((\$\w[\w.]*)\)$/);
  if (emptyMatch) {
    return { field: emptyMatch[1].slice(1), operator: 'is_empty', value: '' };
  }

  const presentMatch = expr.match(/^present\((\$\w[\w.]*)\)$/);
  if (presentMatch) {
    return { field: presentMatch[1].slice(1), operator: 'is_present', value: '' };
  }

  const containsMatch = expr.match(/^contains\((\$\w[\w.]*),\s*(.+)\)$/);
  if (containsMatch) {
    return {
      field: containsMatch[1].slice(1),
      operator: 'contains',
      value: normalizeStringValue(containsMatch[2].trim()),
    };
  }

  const startsWithMatch = expr.match(/^startsWith\((\$\w[\w.]*),\s*(.+)\)$/);
  if (startsWithMatch) {
    return {
      field: startsWithMatch[1].slice(1),
      operator: 'starts_with',
      value: normalizeStringValue(startsWithMatch[2].trim()),
    };
  }

  const comparisonMatch = expr.match(/^(\$[\w$.]*)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (comparisonMatch) {
    const field = comparisonMatch[1] === '$' ? '$' : comparisonMatch[1].slice(1);
    const op = comparisonMatch[2];
    const rawValue = comparisonMatch[3].trim();

    if (!isValidValue(rawValue)) return null;

    if (rawValue === 'true') {
      return { field, operator: 'is_true', value: '' };
    }
    if (rawValue === 'false') {
      return { field, operator: 'is_false', value: '' };
    }

    return { field, operator: comparisonOpToFEL(op), value: normalizeStringValue(rawValue) };
  }

  return null;
}

function comparisonOpToFEL(op: string): ComparisonOperator {
  switch (op) {
    case '=': return 'eq';
    case '!=': return 'neq';
    case '>': return 'gt';
    case '>=': return 'gte';
    case '<': return 'lt';
    case '<=': return 'lte';
    default: return 'eq';
  }
}

function moneyOpToFEL(op: string): MoneyOperator {
  switch (op) {
    case '=': return 'money_eq';
    case '!=': return 'money_neq';
    case '>': return 'money_gt';
    case '>=': return 'money_gte';
    case '<': return 'money_lt';
    case '<=': return 'money_lte';
    default: return 'money_eq';
  }
}

function isValidValue(value: string): boolean {
  if (/[:?]/.test(value)) return false;
  if (/[+\-*/%]/.test(value) && !/^@/.test(value)) {
    const cleaned = value.replace(/[-]/g, '');
    if (/[*+/%]/.test(cleaned)) return false;
  }
  return true;
}

function normalizeStringValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return `'${value.slice(1, -1)}'`;
  }
  return value;
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
