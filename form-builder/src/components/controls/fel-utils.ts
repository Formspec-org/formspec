import { FelLexer } from '../../../../packages/formspec-engine/src/fel/lexer';
import { parser } from '../../../../packages/formspec-engine/src/fel/parser';
import type { FormspecInstance } from 'formspec-engine';

export interface FELEditorFieldOption {
  path: string;
  label: string;
}

export interface FELEditorFunctionOption {
  name: string;
  label: string;
  signature?: string;
}

export interface FELAutocompleteTrigger {
  start: number;
  end: number;
  query: string;
  insertionPrefix?: string;
  insertionSuffix?: string;
  instanceName?: string;
}

export interface FELHighlightToken {
  key: string;
  text: string;
  kind: 'plain' | 'keyword' | 'literal' | 'operator' | 'path' | 'function';
  functionName?: string;
  signature?: string;
}

const KEYWORD_TOKENS = new Set([
  'If',
  'Then',
  'Else',
  'Let',
  'And',
  'Or',
  'Not',
  'In',
  'True',
  'False',
  'Null'
]);

const LITERAL_TOKENS = new Set(['StringLiteral', 'NumberLiteral', 'DateLiteral', 'DateTimeLiteral']);

const OPERATOR_TOKENS = new Set([
  'Equals',
  'NotEquals',
  'LessEqual',
  'GreaterEqual',
  'Less',
  'Greater',
  'Question',
  'DoubleQuestion',
  'Plus',
  'Minus',
  'Asterisk',
  'Slash',
  'Percent',
  'Ampersand',
  'Colon',
  'Comma',
  'Dot'
]);

export const FEL_FUNCTION_SIGNATURES: Record<string, string> = {
  sum: 'sum(array)',
  avg: 'avg(array)',
  min: 'min(array)',
  max: 'max(array)',
  count: 'count(array)',
  countWhere: 'countWhere(array, predicate)',
  upper: 'upper(string)',
  lower: 'lower(string)',
  length: 'length(string)',
  substring: 'substring(string, start, length?)',
  startsWith: 'startsWith(string, substring)',
  endsWith: 'endsWith(string, substring)',
  contains: 'contains(string, substring)',
  replace: 'replace(string, old, new)',
  trim: 'trim(string)',
  matches: 'matches(string, pattern)',
  format: 'format(template, ...values)',
  today: 'today()',
  now: 'now()',
  year: 'year(date)',
  month: 'month(date)',
  day: 'day(date)',
  hours: 'hours(dateTime)',
  minutes: 'minutes(dateTime)',
  seconds: 'seconds(dateTime)',
  dateAdd: "dateAdd(date, amount, unit:'days'|'months'|'years')",
  dateDiff: "dateDiff(dateA, dateB, unit:'days'|'months'|'years')",
  time: 'time(hours, minutes, seconds)',
  timeDiff: "timeDiff(timeA, timeB, unit:'seconds'|'minutes'|'hours')",
  abs: 'abs(number)',
  round: 'round(number, precision?)',
  floor: 'floor(number)',
  ceil: 'ceil(number)',
  power: 'power(base, exponent)',
  isNumber: 'isNumber(value)',
  isString: 'isString(value)',
  isDate: 'isDate(value)',
  typeOf: 'typeOf(value)',
  string: 'string(value)',
  number: 'number(value)',
  boolean: 'boolean(value)',
  date: 'date(value)',
  isNull: 'isNull(value)',
  present: 'present(value)',
  empty: 'empty(value)',
  coalesce: 'coalesce(...values)',
  money: 'money(amount, currency)',
  moneyAmount: 'moneyAmount(money)',
  moneyCurrency: 'moneyCurrency(money)',
  moneyAdd: 'moneyAdd(moneyA, moneyB)',
  moneySum: 'moneySum(moneyArray)',
  selected: 'selected(value, option)',
  prev: 'prev(fieldName)',
  next: 'next(fieldName)',
  parent: 'parent(fieldName)',
  valid: 'valid(path)',
  relevant: 'relevant(path)',
  readonly: 'readonly(path)',
  required: 'required(path)',
  instance: 'instance(name, path?)',
  if: 'if(condition, thenValue, elseValue)'
};

export function validateFEL(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed.length) {
    return null;
  }

  const lexResult = FelLexer.tokenize(expression);
  if (lexResult.errors.length) {
    const first = lexResult.errors[0];
    return formatLocationMessage(first.line, first.column, first.message);
  }

  parser.input = lexResult.tokens;
  parser.expression();
  if (parser.errors.length) {
    const first = parser.errors[0];
    const token = first.token as { startLine?: number; startColumn?: number } | undefined;
    return formatLocationMessage(token?.startLine, token?.startColumn, first.message);
  }

  return null;
}

export function buildFELHighlightTokens(
  expression: string,
  functionSignatures: Record<string, string> = {}
): FELHighlightToken[] {
  if (!expression.length) {
    return [];
  }

  const lexResult = FelLexer.tokenize(expression);
  if (!lexResult.tokens.length) {
    return [{ key: '0', text: expression, kind: 'plain' }];
  }

  const tokens: FELHighlightToken[] = [];
  let cursor = 0;

  for (let index = 0; index < lexResult.tokens.length; index += 1) {
    const token = lexResult.tokens[index];
    const startOffset = token.startOffset ?? cursor;
    const endOffset = token.endOffset ?? (startOffset + token.image.length - 1);

    if (startOffset > cursor) {
      tokens.push({
        key: `plain-${cursor}`,
        text: expression.slice(cursor, startOffset),
        kind: 'plain'
      });
    }

    const kind = classifyToken(token.tokenType.name, lexResult.tokens[index + 1]?.tokenType.name);
    const highlight: FELHighlightToken = {
      key: `${token.startOffset ?? index}-${token.tokenType.name}-${index}`,
      text: token.image,
      kind
    };

    if (kind === 'function') {
      highlight.functionName = token.image;
      highlight.signature =
        functionSignatures[token.image] ??
        FEL_FUNCTION_SIGNATURES[token.image] ??
        `${token.image}(...)`;
    }

    tokens.push(highlight);
    cursor = endOffset + 1;
  }

  if (cursor < expression.length) {
    tokens.push({
      key: `plain-${cursor}`,
      text: expression.slice(cursor),
      kind: 'plain'
    });
  }

  return tokens;
}

export function getFELAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null {
  const prefix = expression.slice(0, caret);
  const instancePathMatch = prefix.match(/@instance\s*\(\s*(['"])(.*?)\1\s*\)\s*\.([A-Za-z0-9_.\[\]*]*)$/);
  if (instancePathMatch) {
    const instanceName = instancePathMatch[2];
    const query = instancePathMatch[3] || '';

    if (instanceName.trim().length > 0) {
      return {
        start: caret - query.length,
        end: caret,
        query,
        insertionPrefix: '',
        instanceName
      };
    }
  }

  let cursor = caret - 1;

  while (cursor >= 0) {
    const char = expression[cursor];
    if (isPathChar(char)) {
      cursor -= 1;
      continue;
    }

    if (char === '$') {
      if (cursor > 0 && isPathChar(expression[cursor - 1])) {
        return null;
      }

      return {
        start: cursor,
        end: caret,
        query: expression.slice(cursor + 1, caret),
        insertionPrefix: '$'
      };
    }

    return null;
  }

  return null;
}

export function getFELInstanceNameAutocompleteTrigger(
  expression: string,
  caret: number
): FELAutocompleteTrigger | null {
  const prefix = expression.slice(0, caret);
  const match = prefix.match(/@instance\s*\(\s*(['"])([^'"]*)$/);
  if (!match) {
    return null;
  }

  const quote = match[1];
  const query = match[2] || '';
  const start = prefix.lastIndexOf(quote) + 1;
  if (start < 0 || start > caret) {
    return null;
  }

  return {
    start,
    end: caret,
    query,
    insertionSuffix: `${quote})`
  };
}

export function getInstanceNameOptions(instances: Record<string, FormspecInstance> | undefined, query: string): string[] {
  if (!instances) {
    return [];
  }

  const trimmed = query.trim().toLowerCase();
  const names = Object.keys(instances).sort((left, right) => left.localeCompare(right));

  if (!trimmed.length) {
    return names.slice(0, 10);
  }

  return names
    .filter((name) => name.toLowerCase().includes(trimmed))
    .slice(0, 10);
}

export function getFELFunctionAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null {
  if (caret <= 0) {
    return null;
  }

  let cursor = caret - 1;
  while (cursor >= 0 && isFunctionIdentifierChar(expression[cursor])) {
    cursor -= 1;
  }

  const start = cursor + 1;
  if (start >= caret) {
    return null;
  }

  const query = expression.slice(start, caret);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(query)) {
    return null;
  }

  const prefix = expression[cursor];
  if (prefix === '$' || prefix === '@') {
    return null;
  }

  return {
    start,
    end: caret,
    query
  };
}

export function filterFELFieldOptions(options: FELEditorFieldOption[], query: string): FELEditorFieldOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.length) {
    return options.slice(0, 10);
  }

  return options
    .filter((option) => {
      const path = option.path.toLowerCase();
      const label = option.label.toLowerCase();
      return path.includes(trimmed) || label.includes(trimmed);
    })
    .sort((left, right) => {
      const leftStarts = left.path.toLowerCase().startsWith(trimmed) ? 0 : 1;
      const rightStarts = right.path.toLowerCase().startsWith(trimmed) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.path.localeCompare(right.path);
    })
    .slice(0, 10);
}

export function filterFELFunctionOptions(
  options: FELEditorFunctionOption[],
  query: string
): FELEditorFunctionOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.length) {
    return options.slice(0, 10);
  }

  return options
    .filter((option) => {
      const name = option.name.toLowerCase();
      const label = option.label.toLowerCase();
      return name.includes(trimmed) || label.includes(trimmed);
    })
    .sort((left, right) => {
      const leftStarts = left.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
      const rightStarts = right.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);
}

export function getInstanceFieldOptions(
  instances: Record<string, FormspecInstance> | undefined,
  instanceName: string
): FELEditorFieldOption[] {
  const instance = instances?.[instanceName];
  if (!instance || !isRecord(instance)) {
    return [];
  }

  const paths = new Set<string>();

  if (isRecord(instance.schema)) {
    collectInstancePathsFromSchema(instance.schema, '', paths, new Set());
  }

  if (instance.data !== undefined) {
    collectInstancePathsFromData(instance.data as unknown, '', paths, new Set());
  }

  return [...paths]
    .sort((left, right) => left.localeCompare(right))
    .map((path) => ({ path, label: path }));
}

function classifyToken(tokenName: string, nextTokenName: string | undefined): FELHighlightToken['kind'] {
  if (tokenName === 'Dollar' || tokenName === 'At') {
    return 'path';
  }

  if (tokenName === 'Identifier' && nextTokenName === 'LRound') {
    return 'function';
  }

  if (KEYWORD_TOKENS.has(tokenName)) {
    return 'keyword';
  }

  if (LITERAL_TOKENS.has(tokenName)) {
    return 'literal';
  }

  if (OPERATOR_TOKENS.has(tokenName)) {
    return 'operator';
  }

  return 'plain';
}

function formatLocationMessage(line: number | undefined, column: number | undefined, message: string): string {
  const cleanMessage = message.replace(/\s+/g, ' ').trim();
  if (typeof line === 'number' && typeof column === 'number') {
    return `Line ${line}, column ${column}: ${cleanMessage}`;
  }
  return cleanMessage;
}

function isPathChar(char: string | undefined): boolean {
  if (!char) {
    return false;
  }

  return /[A-Za-z0-9_.\[\]*]/.test(char);
}

function isFunctionIdentifierChar(char: string | undefined): boolean {
  if (!char) {
    return false;
  }
  return /[A-Za-z0-9_]/.test(char);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectInstancePathsFromSchema(
  schema: Record<string, unknown>,
  prefix: string,
  paths: Set<string>,
  seen: Set<object>
): void {
  if (seen.has(schema)) {
    return;
  }

  seen.add(schema);

  for (const [key, value] of Object.entries(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.add(path);

    if (isRecord(value)) {
      collectInstancePathsFromSchema(value, path, paths, seen);
    }
  }
}

function collectInstancePathsFromData(
  data: unknown,
  prefix: string,
  paths: Set<string>,
  seen: Set<object>
): void {
  if (!isRecord(data) && !Array.isArray(data)) {
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return;
    }

    if (prefix) {
      paths.add(prefix);
    }

    const arrayItemPrefix = prefix ? `${prefix}[1]` : '[1]';
    collectInstancePathsFromData(data[0], arrayItemPrefix, paths, seen);
    return;
  }

  if (seen.has(data)) {
    return;
  }

  seen.add(data);

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.add(path);
    collectInstancePathsFromData(value, path, paths, seen);
  }
}
