export interface ParsedFelLiteral {
  kind: 'string' | 'number' | 'boolean' | 'raw';
  value: string;
}

export interface LogicalSplit {
  clauses: string[];
  operator: 'and' | 'or' | null;
  mixed: boolean;
}

export function quoteFelString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function parseFelLiteral(rawValue: string): ParsedFelLiteral {
  const value = rawValue.trim();
  if (!value.length) {
    return { kind: 'raw', value: '' };
  }

  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    const body = value.slice(1, -1);
    const unescaped = body
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    return { kind: 'string', value: unescaped };
  }

  if (value === 'true' || value === 'false') {
    return { kind: 'boolean', value };
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return { kind: 'number', value: String(numeric) };
  }

  return { kind: 'raw', value };
}

export function stripOuterParens(rawExpression: string): string {
  let expression = rawExpression.trim();
  while (expression.startsWith('(') && expression.endsWith(')')) {
    const body = expression.slice(1, -1);
    if (!isBalanced(body)) {
      break;
    }
    expression = body.trim();
  }
  return expression;
}

export function splitTopLevelLogical(rawExpression: string): LogicalSplit {
  const expression = rawExpression.trim();
  if (!expression.length) {
    return { clauses: [], operator: null, mixed: false };
  }

  const clauses: string[] = [];
  const operators: Array<'and' | 'or'> = [];

  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let start = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      const token = readLogicalToken(expression, index);
      if (token) {
        clauses.push(expression.slice(start, index).trim());
        operators.push(token);
        start = index + token.length;
        index += token.length - 1;
      }
    }
  }

  clauses.push(expression.slice(start).trim());

  const uniqueOperators = new Set(operators);
  if (uniqueOperators.size > 1) {
    return { clauses, operator: null, mixed: true };
  }

  return {
    clauses,
    operator: operators[0] ?? null,
    mixed: false
  };
}

export function isLikelyDateLiteral(value: string): boolean {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(trimmed);
}

function readLogicalToken(expression: string, index: number): 'and' | 'or' | null {
  if (matchesLogicalWord(expression, index, 'and')) {
    return 'and';
  }
  if (matchesLogicalWord(expression, index, 'or')) {
    return 'or';
  }
  return null;
}

function matchesLogicalWord(expression: string, index: number, word: 'and' | 'or'): boolean {
  if (!expression.startsWith(word, index)) {
    return false;
  }

  const previous = index > 0 ? expression[index - 1] : ' ';
  const next = expression[index + word.length] ?? ' ';
  return /\s/.test(previous) && /\s/.test(next);
}

function isBalanced(expression: string): boolean {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
    }

    if (char === ')') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }

  return depth === 0 && !quote;
}
