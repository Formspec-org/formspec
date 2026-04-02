/** @filedesc FEL editor helpers for validation, highlighting, and autocomplete. */
import { analyzeFEL, tokenizeFEL, type FormspecInstance } from '@formspec-org/engine';

export interface FELEditorFieldOption {
  path: string;
  label: string;
  dataType?: string;
}

export interface FELEditorFunctionOption {
  name: string;
  label: string;
  signature?: string;
  description?: string;
  category?: string;
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
  'Null',
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
  'Dot',
]);

export function validateFEL(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed.length) return null;

  let analysis: ReturnType<typeof analyzeFEL>;
  try {
    analysis = analyzeFEL(expression);
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid expression';
  }
  if (analysis.errors.length) {
    const first = analysis.errors[0];
    return formatLocationMessage(first.line, first.column, first.message);
  }

  return null;
}

/** Token types that can continue a path reference after `$` or `@`. */
const PATH_CONTINUATION_TOKENS = new Set([
  'Identifier',
  'Dot',
  'LSquare',
  'RSquare',
  'Asterisk',
  'NumberLiteral',
]);

export function buildFELHighlightTokens(
  expression: string,
  functionSignatures: Record<string, string> = {},
): FELHighlightToken[] {
  if (!expression.length) return [];

  let lexedTokens: ReturnType<typeof tokenizeFEL>;
  try {
    lexedTokens = tokenizeFEL(expression).filter((token) => token.tokenType !== 'EOF');
  } catch {
    return [{ key: '0', text: expression, kind: 'plain' }];
  }
  if (!lexedTokens.length) {
    return [{ key: '0', text: expression, kind: 'plain' }];
  }

  const tokens: FELHighlightToken[] = [];
  let cursor = 0;

  for (let index = 0; index < lexedTokens.length; index += 1) {
    const token = lexedTokens[index];
    const startOffset = token.start;

    if (startOffset > cursor) {
      tokens.push({
        key: `plain-${cursor}`,
        text: expression.slice(cursor, startOffset),
        kind: 'plain',
      });
    }

    // When we encounter a path sigil ($ or @), greedily consume all
    // adjacent path-continuation tokens to form one merged path token.
    if (token.tokenType === 'Dollar' || token.tokenType === 'At') {
      let pathEnd = token.end;
      let consumed = 0;
      for (let j = index + 1; j < lexedTokens.length; j += 1) {
        const next = lexedTokens[j];
        if (next.start !== pathEnd || !PATH_CONTINUATION_TOKENS.has(next.tokenType)) break;
        pathEnd = next.end;
        consumed += 1;
      }
      tokens.push({
        key: `path-${startOffset}`,
        text: expression.slice(startOffset, pathEnd),
        kind: 'path',
      });
      index += consumed;
      cursor = pathEnd;
      continue;
    }

    const endOffset = token.end;
    const nextToken = lexedTokens[index + 1];
    const kind = classifyToken(token.tokenType, nextToken?.tokenType);
    const highlight: FELHighlightToken = {
      key: `${token.start}-${token.tokenType}-${index}`,
      text: token.text,
      kind,
    };

    if (kind === 'function') {
      highlight.functionName = token.text;
      highlight.signature = functionSignatures[token.text] ?? `${token.text}(...)`;
    }

    tokens.push(highlight);
    cursor = endOffset;
  }

  if (cursor < expression.length) {
    tokens.push({
      key: `plain-${cursor}`,
      text: expression.slice(cursor),
      kind: 'plain',
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
        instanceName,
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
        insertionPrefix: '$',
      };
    }

    return null;
  }

  return null;
}

export function getFELInstanceNameAutocompleteTrigger(
  expression: string,
  caret: number,
): FELAutocompleteTrigger | null {
  const prefix = expression.slice(0, caret);
  const match = prefix.match(/@instance\s*\(\s*(['"])([^'"]*)$/);
  if (!match) return null;

  const quote = match[1];
  const query = match[2] || '';
  const start = prefix.lastIndexOf(quote) + 1;
  if (start < 0 || start > caret) return null;

  return {
    start,
    end: caret,
    query,
    insertionSuffix: `${quote})`,
  };
}

export function getInstanceNameOptions(
  instances: Record<string, FormspecInstance> | undefined,
  query: string,
): string[] {
  if (!instances) return [];

  const trimmed = query.trim().toLowerCase();
  const names = Object.keys(instances).sort((left, right) => left.localeCompare(right));
  if (!trimmed.length) return names.slice(0, 10);

  return names.filter((name) => name.toLowerCase().includes(trimmed)).slice(0, 10);
}

export function getFELFunctionAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null {
  if (caret <= 0) return null;

  let cursor = caret - 1;
  while (cursor >= 0 && isFunctionIdentifierChar(expression[cursor])) {
    cursor -= 1;
  }

  const start = cursor + 1;
  if (start >= caret) return null;

  const query = expression.slice(start, caret);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(query)) return null;

  const prefix = expression[cursor];
  if (prefix === '$' || prefix === '@') return null;

  return {
    start,
    end: caret,
    query,
  };
}

export function filterFELFieldOptions(options: FELEditorFieldOption[], query: string): FELEditorFieldOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.length) return options.slice(0, 10);

  return options
    .filter((option) => {
      const path = option.path.toLowerCase();
      const label = option.label.toLowerCase();
      return path.includes(trimmed) || label.includes(trimmed);
    })
    .sort((left, right) => {
      const leftStarts = left.path.toLowerCase().startsWith(trimmed) ? 0 : 1;
      const rightStarts = right.path.toLowerCase().startsWith(trimmed) ? 0 : 1;
      if (leftStarts !== rightStarts) return leftStarts - rightStarts;
      return left.path.localeCompare(right.path);
    })
    .slice(0, 10);
}

export function filterFELFunctionOptions(
  options: FELEditorFunctionOption[],
  query: string,
): FELEditorFunctionOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.length) return options.slice(0, 10);

  return options
    .filter((option) => {
      const name = option.name.toLowerCase();
      const label = option.label.toLowerCase();
      return name.includes(trimmed) || label.includes(trimmed);
    })
    .sort((left, right) => {
      const leftStarts = left.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
      const rightStarts = right.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
      if (leftStarts !== rightStarts) return leftStarts - rightStarts;
      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);
}

export function getInstanceFieldOptions(
  instances: Record<string, FormspecInstance> | undefined,
  instanceName: string,
): FELEditorFieldOption[] {
  const instance = instances?.[instanceName];
  if (!instance || !isRecord(instance)) return [];

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
  if (tokenName === 'Dollar' || tokenName === 'At') return 'path';
  if (tokenName === 'Identifier' && nextTokenName === 'LRound') return 'function';
  if (KEYWORD_TOKENS.has(tokenName)) return 'keyword';
  if (LITERAL_TOKENS.has(tokenName)) return 'literal';
  if (OPERATOR_TOKENS.has(tokenName)) return 'operator';
  return 'plain';
}

function formatLocationMessage(line: number | undefined, column: number | undefined, message: string): string {
  const cleanMessage = message.replace(/\s+/g, ' ').trim();
  if (typeof line === 'number' && !isNaN(line) && typeof column === 'number' && !isNaN(column)) {
    return `Line ${line}, column ${column}: ${cleanMessage}`;
  }
  return cleanMessage;
}

function isPathChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[A-Za-z0-9_.\[\]*]/.test(char);
}

function isFunctionIdentifierChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[A-Za-z0-9_]/.test(char);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectInstancePathsFromSchema(
  schema: Record<string, unknown>,
  prefix: string,
  paths: Set<string>,
  seen: Set<object>,
): void {
  if (seen.has(schema)) return;
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
  seen: Set<object>,
): void {
  if (!isRecord(data) && !Array.isArray(data)) return;

  if (Array.isArray(data)) {
    if (data.length === 0) return;
    if (prefix) paths.add(prefix);
    const arrayItemPrefix = prefix ? `${prefix}[1]` : '[1]';
    collectInstancePathsFromData(data[0], arrayItemPrefix, paths, seen);
    return;
  }

  if (seen.has(data)) return;
  seen.add(data);

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.add(path);
    collectInstancePathsFromData(value, path, paths, seen);
  }
}
