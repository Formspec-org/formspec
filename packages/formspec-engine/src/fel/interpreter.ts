/**
 * @module fel/interpreter
 *
 * Chevrotain CstVisitor that evaluates FEL Concrete Syntax Trees at runtime.
 *
 * This is the third stage of the FEL pipeline (Lexer -> Parser -> Interpreter).
 * It walks the CST produced by {@link FelParser} and evaluates each node against
 * a {@link FelContext} that provides reactive signal values from the FormEngine.
 * Includes `felStdLib` — a record of 40+ built-in functions covering aggregation,
 * string manipulation, date arithmetic, type coercion, money, MIP queries, and more.
 */
import { parser } from './parser.js';

const BaseVisitor = parser.getBaseCstVisitorConstructor();

/**
 * Merge per-type operator token arrays and return their `image` strings
 * sorted by source offset. Used by addition/multiplication visitors to
 * determine the correct operator when multiple operator types are interleaved
 * (e.g. `a + b - c * d`).
 */
function sortedOperators(tokenMap: Record<string, any[] | undefined>): string[] {
  const all: Array<{ image: string; offset: number }> = [];
  for (const [, tokens] of Object.entries(tokenMap)) {
    if (!tokens) continue;
    for (const tok of tokens) {
      all.push({ image: tok.image, offset: tok.startOffset });
    }
  }
  all.sort((a, b) => a.offset - b.offset);
  return all.map(t => t.image);
}

function isNullish(value: any): boolean {
  return value === null || value === undefined;
}

function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: any): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isString(value: any): value is string {
  return typeof value === 'string';
}

function isMoney(value: any): boolean {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'amount' in value
    && 'currency' in value;
}

function valueKind(value: any): string {
  if (isNullish(value)) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isMoney(value)) return 'money';
  return typeof value;
}

function setNestedValue(target: any, path: string, value: any): void {
  if (!path) return;
  const segments = path.match(/([^[.\]]+)|\[(\d+)\]/g) ?? [];
  let current = target;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isIndex = segment.startsWith('[');
    const key: string | number = isIndex ? Number(segment.slice(1, -1)) : segment;
    const isLast = i === segments.length - 1;

    if (isLast) {
      current[key] = value;
      return;
    }

    const nextIsIndex = segments[i + 1].startsWith('[');
    if (current[key] === undefined) {
      current[key] = nextIsIndex ? [] : {};
    }
    current = current[key];
  }
}

/** Built-in FEL function metadata exposed for tooling/autocomplete surfaces. */
export interface FELBuiltinFunctionCatalogEntry {
  name: string;
  category: string;
}

const FEL_BUILTIN_FUNCTION_CATEGORY: Record<string, string> = {
  // Aggregate
  sum: 'aggregate',
  count: 'aggregate',
  countWhere: 'aggregate',
  avg: 'aggregate',
  min: 'aggregate',
  max: 'aggregate',
  // String
  upper: 'string',
  lower: 'string',
  length: 'string',
  substring: 'string',
  startsWith: 'string',
  endsWith: 'string',
  contains: 'string',
  replace: 'string',
  trim: 'string',
  matches: 'string',
  format: 'string',
  // Numeric
  round: 'numeric',
  abs: 'numeric',
  power: 'numeric',
  floor: 'numeric',
  ceil: 'numeric',
  number: 'numeric',
  // Date/Time
  today: 'date',
  now: 'date',
  date: 'date',
  dateAdd: 'date',
  dateDiff: 'date',
  year: 'date',
  month: 'date',
  day: 'date',
  hours: 'date',
  minutes: 'date',
  seconds: 'date',
  time: 'date',
  timeDiff: 'date',
  // Logical / control
  if: 'logical',
  coalesce: 'logical',
  isNull: 'logical',
  present: 'logical',
  empty: 'logical',
  selected: 'logical',
  boolean: 'logical',
  // Type
  isNumber: 'type',
  isString: 'type',
  isDate: 'type',
  typeOf: 'type',
  string: 'type',
  // Money
  money: 'money',
  moneyAmount: 'money',
  moneyCurrency: 'money',
  moneyAdd: 'money',
  moneySum: 'money',
  // Repeat/navigation
  prev: 'repeat',
  next: 'repeat',
  parent: 'repeat',
  // MIP
  valid: 'mip',
  relevant: 'mip',
  readonly: 'mip',
  required: 'mip',
  // Instance
  instance: 'instance',
};

export class FelUnsupportedFunctionError extends Error {
  constructor(functionName: string) {
    super(`Unsupported FEL function: ${functionName}`);
    this.name = 'FelUnsupportedFunctionError';
  }
}

/**
 * Runtime context provided to the interpreter for each FEL evaluation.
 *
 * Bridges the interpreter to the FormEngine's reactive signal graph. Each
 * callback reads from a Preact signal so that evaluations are automatically
 * tracked as signal dependencies, enabling reactive re-computation when
 * upstream values change.
 */
export interface FelContext {
  /** Read the current value of a field signal at the given dotted path. */
  getSignalValue: (path: string) => any;
  /** Read the current repeat instance count for a repeatable group. */
  getRepeatsValue: (path: string) => number;
  /** Read whether the field at the given path is currently relevant (visible). */
  getRelevantValue: (path: string) => boolean;
  /** Read whether the field at the given path is currently required. */
  getRequiredValue: (path: string) => boolean;
  /** Read whether the field at the given path is currently readonly. */
  getReadonlyValue: (path: string) => boolean;
  /** Read the count of validation errors for the field at the given path. */
  getValidationErrors: (path: string) => number;
  /** The fully-qualified dotted path of the item whose bind expression is being evaluated. Used for relative `$` field references. */
  currentItemPath: string;
  /** Reference to the FormEngine instance. Used by stdlib functions that need engine-level APIs (e.g. `instance()`, variable lookup). */
  engine: any;
}

/**
 * Chevrotain CstVisitor that evaluates a FEL CST against a live {@link FelContext}.
 *
 * Visitor methods mirror the grammar rules in {@link FelParser}. Each method
 * receives a CST node context object and returns the evaluated JavaScript value.
 * The class also houses {@link felStdLib}, a record of 40+ built-in functions
 * available to FEL expressions (e.g. `sum(...)`, `today()`, `money(...)`).
 *
 * Instantiate once and reuse via {@link interpreter}. Not thread-safe — the
 * `context` field is mutated on each call to {@link evaluate}.
 */
export class FelInterpreter extends BaseVisitor {
  private context!: FelContext;

  /**
   * Stack of let-binding scopes. Each entry is a Map of variable name to value.
   * Pushed when entering a `let...in` body and popped on exit. Innermost scope
   * takes priority (last-in wins for shadowing).
   */
  private letScopes: Array<Map<string, any>> = [];

  constructor() {
    super();
    this.validateVisitor();
  }

  /** Extract the parent segment of a dotted path (everything before the last `.`). Returns `''` for root-level paths. */
  private getParentPath(itemPath: string): string {
    const lastDot = itemPath.lastIndexOf('.');
    if (lastDot === -1) return '';
    return itemPath.substring(0, lastDot);
  }

  private normalizeSpecPathToSignalPath(path: string): string {
    return path.replace(/\[(\d+)\]/g, (_match, rawIndex) => `[${Number(rawIndex) - 1}]`);
  }

  private candidateLookupPaths(path: string): string[] {
    if (path === '') return [this.context.currentItemPath];

    const parentPath = this.getParentPath(this.context.currentItemPath);
    const normalizedPath = this.normalizeSpecPathToSignalPath(path);
    const candidates = [
      parentPath ? `${parentPath}.${normalizedPath}` : null,
      normalizedPath,
    ]
      .filter((candidate): candidate is string => Boolean(candidate))

    return [...new Set(candidates)];
  }

  private resolveValueLookupPath(path: string): string {
    const candidates = this.candidateLookupPaths(path);
    for (const candidate of candidates) {
      if (this.context.getSignalValue(candidate) !== undefined) return candidate;
    }
    return candidates[0] ?? path;
  }

  private resolveMipLookupPath(path: string): string {
    const candidates = this.candidateLookupPaths(path);
    const engine = this.context.engine;
    for (const candidate of candidates) {
      if (
        engine?.signals?.[candidate] !== undefined ||
        engine?.relevantSignals?.[candidate] !== undefined ||
        engine?.requiredSignals?.[candidate] !== undefined ||
        engine?.readonlySignals?.[candidate] !== undefined ||
        engine?.validationResults?.[candidate] !== undefined
      ) {
        return candidate;
      }
    }
    return candidates[0] ?? path;
  }

  /**
   * Evaluate a FEL CST and return the computed value.
   *
   * This is the main entry point for stage 3 of the FEL pipeline. The caller
   * provides the CST (from `parser.expression()`) and a {@link FelContext}
   * wired to the FormEngine's signal graph. The returned value is used for
   * calculated fields, conditional relevance, validation constraints, etc.
   */
  public evaluate(cst: any, context: FelContext) {
    this.context = context;
    // Reset let scopes on each top-level evaluation. The interpreter is a
    // singleton so a previously thrown error could leave stale scope frames.
    this.letScopes = [];
    return this.visit(cst);
  }

  /** Return the built-in FEL function catalog sourced from the runtime stdlib. */
  public listBuiltInFunctions(): FELBuiltinFunctionCatalogEntry[] {
    return Object.keys(this.felStdLib)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        category: FEL_BUILTIN_FUNCTION_CATEGORY[name] ?? 'function',
      }));
  }

  private getRepeatContextInfo():
    | { groupPath: string; rowPath: string; index: number; count: number }
    | null {
    const match = this.context.currentItemPath.match(/^(.*)\[(\d+)\](?:\.|$)/);
    if (!match) return null;
    const groupPath = match[1];
    const index = Number(match[2]);
    return {
      groupPath,
      rowPath: `${groupPath}[${index}]`,
      index,
      count: this.context.getRepeatsValue(groupPath),
    };
  }

  private buildRepeatRow(rowPath: string): any {
    const signals = this.context.engine?.signals ?? {};
    const row: Record<string, any> = {};
    const prefix = `${rowPath}.`;
    for (const [path, signal] of Object.entries(signals)) {
      if (!path.startsWith(prefix)) continue;
      const relativePath = path.slice(prefix.length);
      setNestedValue(row, relativePath, (signal as any).value);
    }
    return Object.keys(row).length > 0 ? row : null;
  }

  private buildObjectAtPath(basePath: string): any {
    const signals = this.context.engine?.signals ?? {};
    const obj: Record<string, any> = {};
    const prefix = basePath ? `${basePath}.` : '';
    for (const [path, signal] of Object.entries(signals)) {
      if (!path.startsWith(prefix)) continue;
      const relativePath = path.slice(prefix.length);
      if (!relativePath || relativePath.startsWith('[')) continue;
      setNestedValue(obj, relativePath, (signal as any).value);
    }
    return Object.keys(obj).length > 0 ? obj : null;
  }

  private getRepeatParentInfo():
    | { parentPath: string; parentValue: any }
    | null {
    const repeat = this.getRepeatContextInfo();
    if (!repeat) return null;
    const lastDot = repeat.groupPath.lastIndexOf('.');
    if (lastDot === -1) return null;
    const parentPath = repeat.groupPath.slice(0, lastDot);
    return { parentPath, parentValue: this.buildObjectAtPath(parentPath) };
  }

  private applyBinaryOp(op: string, left: any, right: any): any {
    if (Array.isArray(left) || Array.isArray(right)) {
      return this.applyElementwiseBinaryOp(op, left, right);
    }
    return this.applyScalarBinaryOp(op, left, right);
  }

  private applyElementwiseBinaryOp(op: string, left: any, right: any): any {
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return null;
      return left.map((item, index) => this.applyScalarBinaryOp(op, item, right[index]));
    }
    if (Array.isArray(left)) {
      return left.map((item) => this.applyScalarBinaryOp(op, item, right));
    }
    if (Array.isArray(right)) {
      return right.map((item) => this.applyScalarBinaryOp(op, left, item));
    }
    return this.applyScalarBinaryOp(op, left, right);
  }

  private applyScalarBinaryOp(op: string, left: any, right: any): any {
    if (op === '=' || op === '!=') {
      const eq = this.applyScalarEquality(left, right);
      return op === '=' || eq === null ? eq : !eq;
    }

    if (isNullish(left) || isNullish(right)) return null;

    if (op === '&') {
      if (!isString(left) || !isString(right)) return null;
      return left + right;
    }

    if (op === '+' || op === '-' || op === '*' || op === '/' || op === '%') {
      if (!isNumber(left) || !isNumber(right)) return null;
      if ((op === '/' || op === '%') && right === 0) return null;
      if (op === '+') return left + right;
      if (op === '-') return left - right;
      if (op === '*') return left * right;
      if (op === '/') return left / right;
      return left % right;
    }

    if (op === '<' || op === '>' || op === '<=' || op === '>=') {
      if (valueKind(left) !== valueKind(right)) return null;
      if (!isNumber(left) && !isString(left)) return null;
      if (op === '<') return left < right;
      if (op === '>') return left > right;
      if (op === '<=') return left <= right;
      return left >= right;
    }

    return null;
  }

  private applyScalarEquality(left: any, right: any): boolean | null {
    if (isNullish(left) && isNullish(right)) return true;
    if (isNullish(left) || isNullish(right)) return false;
    if (valueKind(left) !== valueKind(right)) return null;
    if (isMoney(left) && isMoney(right)) {
      return left.amount === right.amount && left.currency === right.currency;
    }
    return left === right;
  }

  /**
   * FEL standard library — 40+ built-in functions available in any FEL expression.
   *
   * Categories:
   * - **Aggregation**: sum, avg, min, max, count, countWhere
   * - **Strings**: upper, lower, length, substring, startsWith, endsWith, contains, replace, trim, matches, format
   * - **Dates/Times**: today, now, year, month, day, hours, minutes, seconds, dateAdd, dateDiff, time, timeDiff
   * - **Math**: abs, round, floor, ceil, power
   * - **Type checking/conversion**: isNumber, isString, isDate, typeOf, string, number, boolean, date
   * - **Null/Presence**: isNull, present, empty, coalesce
   * - **Money**: money, moneyAmount, moneyCurrency, moneyAdd, moneySum
   * - **Selection**: selected
   * - **Navigation**: prev, next, parent
   * - **MIP queries**: valid, relevant, readonly, required
   * - **Instance data**: instance
   *
   * Functions are looked up by name at runtime in the `functionCall` visitor.
   * Each function receives already-evaluated arguments (except MIP queries and
   * countWhere, which use special argument handling).
   */
  private felStdLib: Record<string, Function> = {
    /** Sums an array of numbers. Extracts `.amount` from money objects. Non-finite values are treated as 0. */
    sum: (arr: any[]) => {
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((a, b) => {
            // Extract numeric amount from money objects so sum works on money arrays
            const raw = (b !== null && typeof b === 'object' && typeof b.amount === 'number') ? b.amount : b;
            const val = typeof raw === 'string' ? parseFloat(raw) : raw;
            return a + (Number.isFinite(val) ? val : 0);
        }, 0);
    },
    upper: (s: string) => (s || '').toUpperCase(),
    /** Rounds a number to `p` decimal places (default 0). Uses banker's-style Math.round. */
    round: (n: any, p: any = 0) => {
        if (n === null || n === undefined) return null;
        const factor = Math.pow(10, p || 0);
        return Math.round(n * factor) / factor;
    },
    year: (d: string) => d ? new Date(d).getFullYear() : null,
    /** Returns the first argument that is not null, undefined, or empty string. */
    coalesce: (...args: any[]) => args.find(a => a !== null && a !== undefined && a !== ''),
    /** Returns true if the value is null, undefined, or empty string. Broader than JS nullish. */
    isNull: (a: any) => a === null || a === undefined || a === '',
    /** Inverse of isNull — returns true if the value is non-null, defined, and non-empty. */
    present: (a: any) => a !== null && a !== undefined && a !== '',
    contains: (s: string, sub: string) => (s || '').includes(sub || ''),
    abs: (n: any) => n === null || n === undefined ? null : Math.abs(n),
    power: (b: any, e: any) => (b === null || e === null || b === undefined || e === undefined) ? null : Math.pow(b, e),
    /** Returns true if the value is null, undefined, empty string, or an empty array. */
    empty: (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
    /** Adds `n` units (days/months/years) to an ISO date string. Returns an ISO date string or null. */
    dateAdd: (d: string, n: number, unit: string) => {
        if (!d) return null;
        const date = new Date(d);
        if (isNaN(date.getTime())) return null;
        if (unit === 'days') date.setDate(date.getDate() + n);
        else if (unit === 'months') date.setMonth(date.getMonth() + n);
        else if (unit === 'years') date.setFullYear(date.getFullYear() + n);
        return date.toISOString().split('T')[0];
    },
    /** Returns the difference between two ISO dates in the given unit (days/months/years). Result is `d1 - d2`. */
    dateDiff: (d1: string, d2: string, unit: string) => {
        const a = new Date(d1);
        const b = new Date(d2);
        if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
        if (unit === 'days') {
            const diff = a.getTime() - b.getTime();
            return Math.floor(diff / (1000 * 60 * 60 * 24));
        }
        if (unit === 'months') {
            let months = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
            if (a.getDate() < b.getDate()) {
                months -= months > 0 ? 1 : months < 0 ? -1 : 0;
            }
            return months;
        }
        if (unit === 'years') {
            let years = a.getFullYear() - b.getFullYear();
            if (a.getMonth() < b.getMonth() || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate())) {
                years -= years > 0 ? 1 : years < 0 ? -1 : 0;
            }
            return years;
        }
        return null;
    },
    count: (arr: any[]) => Array.isArray(arr) ? arr.length : 0,
    avg: (arr: any[]) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
        return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    },
    min: (arr: any[]) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
        return valid.length ? Math.min(...valid) : 0;
    },
    max: (arr: any[]) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
        return valid.length ? Math.max(...valid) : 0;
    },
    length: (s: string) => (s || '').length,
    startsWith: (s: string, sub: string) => (s || '').startsWith(sub || ''),
    endsWith: (s: string, sub: string) => (s || '').endsWith(sub || ''),
    substring: (s: string, start: number, len?: number) => len === undefined ? (s || '').substring(start) : (s || '').substring(start, start + len),
    replace: (s: string, old: string, nw: string) => (s || '').split(old || '').join(nw || ''),
    lower: (s: string) => (s || '').toLowerCase(),
    trim: (s: string) => (s || '').trim(),
    matches: (s: string, pat: string) => new RegExp(pat).test(s || ''),
    floor: (n: any) => n === null || n === undefined ? null : Math.floor(n),
    ceil: (n: any) => n === null || n === undefined ? null : Math.ceil(n),
    today: () => new Date().toISOString().split('T')[0],
    now: () => new Date().toISOString(),
    month: (d: string) => d ? new Date(d).getMonth() + 1 : null,
    day: (d: string) => d ? new Date(d).getDate() : null,
    hours: (d: string) => d ? new Date(d).getHours() : null,
    minutes: (d: string) => d ? new Date(d).getMinutes() : null,
    seconds: (d: string) => d ? new Date(d).getSeconds() : null,
    /** Constructs an `HH:MM:SS` time string from numeric hour, minute, and second components. */
    time: (h: number, m: number, s: number) => {
        const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    },
    /** Tests whether `opt` is the current selection. For multi-select (array), checks inclusion; for single-select, checks equality. */
    selected: (val: any, opt: any) => Array.isArray(val) ? val.includes(opt) : val === opt,
    isNumber: (v: any) => typeof v === 'number' && !isNaN(v),
    /** Coerces any value to a string. Null/undefined become empty string. */
    string: (v: any) => v === null || v === undefined ? '' : String(v),
    isString: (v: any) => typeof v === 'string',
    isDate: (v: any) => !isNaN(Date.parse(v)),
    /** Returns the FEL type name: `'array'`, `'null'`, `'string'`, `'number'`, `'boolean'`, or `'object'`. */
    typeOf: (v: any) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v,
    /** Coerces a value to a number. Returns null if coercion fails. */
    number: (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
    /** Coerces a value to a boolean. Accepts booleans, numbers (0 = false), and `'true'`/`'false'` strings. Throws on unconvertible values. */
    boolean: (v: any) => {
        if (v === null || v === undefined) return false;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'boolean') return v;
        if (v === 'true') return true;
        if (v === 'false') return false;
        throw new Error(`boolean(): cannot convert "${v}" to boolean`);
    },
    /** Validates and returns an ISO 8601 date string. Returns null for null, undefined, or empty string. Throws if the input is a non-empty string that is not a valid date. */
    date: (v: any) => {
        if (v === null || v === undefined || v === '') return null;
        const d = new Date(v);
        if (isNaN(d.getTime())) throw new Error(`date(): "${v}" is not a valid ISO 8601 date`);
        return v;
    },
    /** Constructs a money object `{ amount, currency }` from numeric amount and currency code. */
    money: (amount: number, currency: string) => ({ amount, currency }),
    /** Extracts the numeric amount from a money object, or null if the input is not a money object. */
    moneyAmount: (m: any) => m && m.amount !== undefined ? m.amount : null,
    /** Extracts the currency code from a money object, or null if the input is not a money object. */
    moneyCurrency: (m: any) => m && m.currency !== undefined ? m.currency : null,
    /** Returns the previous repeat row, or a named sibling field from it when `name` is provided. */
    prev: (name?: string) => {
        const repeat = this.getRepeatContextInfo();
        if (!repeat || repeat.index <= 0) return null;
        const prevRowPath = `${repeat.groupPath}[${repeat.index - 1}]`;
        if (name) {
            const value = this.context.getSignalValue(`${prevRowPath}.${name}`);
            return value === undefined ? null : value;
        }
        return this.buildRepeatRow(prevRowPath);
    },
    /** Returns the next repeat row, or a named sibling field from it when `name` is provided. */
    next: (name?: string) => {
        const repeat = this.getRepeatContextInfo();
        if (!repeat || repeat.index >= repeat.count - 1) return null;
        const nextRowPath = `${repeat.groupPath}[${repeat.index + 1}]`;
        if (name) {
            const value = this.context.getSignalValue(`${nextRowPath}.${name}`);
            return value === undefined ? null : value;
        }
        return this.buildRepeatRow(nextRowPath);
    },
    /** Functional if: returns `thenVal` when `cond` is truthy, `elseVal` otherwise. Alternative to the `if ... then ... else` syntax. */
    if: (cond: any, thenVal: any, elseVal: any) => cond ? thenVal : elseVal,
    /** Sprintf-style formatting. Replaces `%s` placeholders in the format string with successive arguments. */
    format: (fmt: string, ...args: any[]) => {
        if (!fmt) return '';
        let i = 0;
        return fmt.replace(/%s/g, () => args[i] !== undefined ? String(args[i++]) : '');
    },
    /** Returns the absolute difference between two `HH:MM:SS` time strings in the given unit (seconds/minutes/hours). */
    timeDiff: (t1: string, t2: string, unit: string) => {
        const parse = (t: string) => {
            const parts = t.split(':').map(Number);
            return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        };
        const diff = Math.abs(parse(t1) - parse(t2));
        if (unit === 'seconds') return diff;
        if (unit === 'minutes') return Math.floor(diff / 60);
        if (unit === 'hours') return Math.floor(diff / 3600);
        return diff;
    },
    /** Adds two money objects, returning a new money object. Uses the currency from the first non-null operand. */
    moneyAdd: (a: any, b: any) => {
        if (!a || !b) return null;
        return { amount: (a.amount || 0) + (b.amount || 0), currency: a.currency || b.currency };
    },
    /** Sums an array of money objects. Returns a money object with the currency from the first element. */
    moneySum: (arr: any[]) => {
        if (!Array.isArray(arr)) return null;
        const valid = arr.filter(m => m && m.amount !== undefined);
        if (valid.length === 0) return null;
        return { amount: valid.reduce((s, m) => s + (m.amount || 0), 0), currency: valid[0].currency };
    },
    /** Returns the parent object for the current repeat context, or a named field from it when `name` is provided. */
    parent: (name?: string) => {
        const parent = this.getRepeatParentInfo();
        if (!parent) return null;
        if (!name) return parent.parentValue;
        const value = this.context.getSignalValue(`${parent.parentPath}.${name}`);
        return value === undefined ? null : value;
    },
    /** MIP query: returns true if the field at `path` has zero validation errors. Argument is extracted as a path string, not evaluated. */
    valid: (path: string) => {
        return this.context.getValidationErrors(this.resolveMipLookupPath(path)) === 0;
    },
    /** MIP query: returns the relevance (visibility) state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    relevant: (path: string) => {
        return this.context.getRelevantValue(this.resolveMipLookupPath(path));
    },
    /** MIP query: returns the readonly state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    readonly: (path: string) => {
        return this.context.getReadonlyValue(this.resolveMipLookupPath(path));
    },
    /** MIP query: returns the required state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    required: (path: string) => {
        return this.context.getRequiredValue(this.resolveMipLookupPath(path));
    },
    /** Retrieves inline instance data by name, optionally drilling into a sub-path. Delegates to `engine.getInstanceData()`. */
    instance: (name: string, path?: string) => {
        if (this.context.engine?.getInstanceData) {
            return this.context.engine.getInstanceData(name, path);
        }
        return undefined;
    },
    /** Counts array elements matching a predicate. The predicate receives each element and is evaluated with `$` rebound. See special handling in `functionCall` visitor. */
    countWhere: (arr: any[], predicate: Function) => {
        if (!Array.isArray(arr)) return 0;
        return arr.filter(item => predicate(item)).length;
    }
  };

  expression(ctx: any) {
    return this.visit(ctx.letExpr);
  }

  letExpr(ctx: any) {
    if (ctx.Let) {
        // Evaluate the binding value, then push a new scope frame so the bound
        // name is visible inside the body (inExpr) as a plain identifier.
        const name = ctx.Identifier[0].image;
        const value = this.visit(ctx.letValue);
        const scope = new Map<string, any>([[name, value]]);
        this.letScopes.push(scope);
        try {
            return this.visit(ctx.inExpr);
        } finally {
            this.letScopes.pop();
        }
    }
    return this.visit(ctx.ifExpr);
  }

  ifExpr(ctx: any) {
    if (ctx.If) {
        const condition = this.visit(ctx.condition);
        if (isNullish(condition)) return null;
        if (!isBoolean(condition)) return null;
        if (condition) {
            return this.visit(ctx.thenExpr);
        } else {
            return this.visit(ctx.elseExpr);
        }
    }
    return this.visit(ctx.ternary);
  }

  ternary(ctx: any) {
    const val = this.visit(ctx.logicalOr);
    if (ctx.Question) {
        if (isNullish(val)) return null;
        if (!isBoolean(val)) return null;
        return val ? this.visit(ctx.trueExpr) : this.visit(ctx.falseExpr);
    }
    return val;
  }

  logicalOr(ctx: any) {
    let result = this.visit(ctx.logicalAnd[0]);
    if (ctx.logicalAnd.length <= 1) return result;
    if (isNullish(result)) return null;
    if (!isBoolean(result)) return null;
    for (let i = 1; i < ctx.logicalAnd.length; i++) {
        if (result) return result;
        const next = this.visit(ctx.logicalAnd[i]);
        if (isNullish(next)) return null;
        if (!isBoolean(next)) return null;
        result = next;
    }
    return result;
  }

  logicalAnd(ctx: any) {
    let result = this.visit(ctx.equality[0]);
    if (ctx.equality.length <= 1) return result;
    if (isNullish(result)) return null;
    if (!isBoolean(result)) return null;
    for (let i = 1; i < ctx.equality.length; i++) {
        if (!result) return result;
        const next = this.visit(ctx.equality[i]);
        if (isNullish(next)) return null;
        if (!isBoolean(next)) return null;
        result = next;
    }
    return result;
  }

  equality(ctx: any) {
    let result = this.visit(ctx.comparison[0]);
    for (let i = 1; i < ctx.comparison.length; i++) {
        const next = this.visit(ctx.comparison[i]);
        result = this.applyBinaryOp(ctx.Equals && ctx.Equals[i - 1] ? '=' : '!=', result, next);
    }
    return result;
  }

  comparison(ctx: any) {
    let result = this.visit(ctx.membership[0]);
    for (let i = 1; i < ctx.membership.length; i++) {
        const next = this.visit(ctx.membership[i]);
        if (ctx.LessEqual && ctx.LessEqual[i - 1]) result = this.applyBinaryOp('<=', result, next);
        else if (ctx.GreaterEqual && ctx.GreaterEqual[i - 1]) result = this.applyBinaryOp('>=', result, next);
        else if (ctx.Less && ctx.Less[i - 1]) result = this.applyBinaryOp('<', result, next);
        else if (ctx.Greater && ctx.Greater[i - 1]) result = this.applyBinaryOp('>', result, next);
    }
    return result;
  }

  membership(ctx: any) {
    const val = this.visit(ctx.nullCoalesce[0]);
    if (ctx.In || ctx.Not) {
        const list = this.visit(ctx.nullCoalesce[1]);
        if (isNullish(val) || isNullish(list)) return null;
        if (!Array.isArray(list)) return null;
        const isIn = list.some((item) => this.applyScalarEquality(val, item) === true);
        return ctx.Not ? !isIn : isIn;
    }
    return val;
  }

  nullCoalesce(ctx: any) {
    let result = this.visit(ctx.addition[0]);
    for (let i = 1; i < ctx.addition.length; i++) {
        result = result ?? this.visit(ctx.addition[i]);
    }
    return result;
  }

  addition(ctx: any) {
    let result = this.visit(ctx.multiplication[0]);
    if (ctx.multiplication.length <= 1) return result;
    const ops = sortedOperators({ Plus: ctx.Plus, Minus: ctx.Minus, Ampersand: ctx.Ampersand });
    for (let i = 1; i < ctx.multiplication.length; i++) {
        const next = this.visit(ctx.multiplication[i]);
        result = this.applyBinaryOp(ops[i - 1], result, next);
    }
    return result;
  }

  multiplication(ctx: any) {
    let result = this.visit(ctx.unary[0]);
    if (ctx.unary.length <= 1) return result;
    const ops = sortedOperators({ Asterisk: ctx.Asterisk, Slash: ctx.Slash, Percent: ctx.Percent });
    for (let i = 1; i < ctx.unary.length; i++) {
        const next = this.visit(ctx.unary[i]);
        result = this.applyBinaryOp(ops[i - 1], result, next);
    }
    return result;
  }

  unary(ctx: any) {
    if (ctx.Not) {
        const value = this.visit(ctx.unary);
        if (isNullish(value) || !isBoolean(value)) return null;
        return !value;
    }
    if (ctx.Minus) {
        const value = this.visit(ctx.unary);
        if (isNullish(value) || !isNumber(value)) return null;
        return -value;
    }
    return this.visit(ctx.postfix);
  }

  postfix(ctx: any) {
    let val = this.visit(ctx.atom);
    if (ctx.pathTail) {
        for (const tail of ctx.pathTail) {
            if (isNullish(val)) return null;
            const tailValue = this.visit(tail);
            if (tailValue === '*') {
                if (!Array.isArray(val)) return null;
                continue;
            }
            if (typeof tailValue === 'string' && tailValue.startsWith('[')) {
                if (!Array.isArray(val)) return null;
                const index = Number(tailValue.slice(1, -1));
                if (!Number.isInteger(index) || index < 1 || index > val.length) return null;
                val = val[index - 1];
                continue;
            }
            if (typeof tailValue === 'string') {
                if (typeof val !== 'object') return null;
                val = (val as any)[tailValue];
                continue;
            }
            return null;
        }
    }
    return val;
  }

  pathTail(ctx: any) {
    if (ctx.Identifier) return ctx.Identifier[0].image;
    if (ctx.NumberLiteral) return `[${parseInt(ctx.NumberLiteral[0].image)}]`;
    return '*';
  }

  atom(ctx: any) {
    if (ctx.literal) return this.visit(ctx.literal);
    if (ctx.fieldRef) return this.visit(ctx.fieldRef);
    if (ctx.functionCall) return this.visit(ctx.functionCall);
    if (ctx.ifCall) return this.visit(ctx.ifCall);
    if (ctx.expression) return this.visit(ctx.expression);
    if (ctx.arrayLiteral) return this.visit(ctx.arrayLiteral);
    if (ctx.objectLiteral) return this.visit(ctx.objectLiteral);
    return null;
  }

  literal(ctx: any) {
    if (ctx.NumberLiteral) return parseFloat(ctx.NumberLiteral[0].image);
    if (ctx.StringLiteral) {
        const raw = ctx.StringLiteral[0].image.substring(1, ctx.StringLiteral[0].image.length - 1);
        return raw.replace(/\\([\s\S])/g, (_match: string, ch: string) => {
            if (ch === 'n') return '\n';
            if (ch === 't') return '\t';
            if (ch === 'r') return '\r';
            return ch; // \\, \", \', and any unrecognised escape → the char itself
        });
    }
    if (ctx.True) return true;
    if (ctx.False) return false;
    if (ctx.Null) return null;
    if (ctx.DateLiteral) return ctx.DateLiteral[0].image.substring(1);
    if (ctx.DateTimeLiteral) return ctx.DateTimeLiteral[0].image.substring(1);
  }

  private appendPathTail(name: string, tailVal: string): string {
    // Bracket indices like [0] are appended without a dot separator
    if (tailVal.startsWith('[')) return name + tailVal;
    return name ? `${name}.${tailVal}` : tailVal;
  }

  fieldRef(ctx: any) {
    if (ctx.Dollar) {
        let name = ctx.Identifier ? ctx.Identifier[0].image : '';
        if (ctx.pathTail) {
            for (const tail of ctx.pathTail) {
                name = this.appendPathTail(name, this.visit(tail));
            }
        }

        if (name === '') return this.context.getSignalValue(this.context.currentItemPath);
        const val = this.context.getSignalValue(this.resolveValueLookupPath(name));
        return val === undefined ? null : val;
    }
    if (ctx.contextRef) return this.visit(ctx.contextRef);
    if (ctx.Identifier) {
        const baseName = ctx.Identifier[0].image;

        // Check let-binding scopes (innermost first) before falling through
        // to signal lookup. Let-bound variables shadow field signals.
        if (this.letScopes.length > 0 && !ctx.pathTail) {
            for (let i = this.letScopes.length - 1; i >= 0; i--) {
                if (this.letScopes[i].has(baseName)) {
                    return this.letScopes[i].get(baseName);
                }
            }
        }

        let name = baseName;
        if (ctx.pathTail) {
            for (const tail of ctx.pathTail) {
                name = this.appendPathTail(name, this.visit(tail));
            }
        }
        const val = this.context.getSignalValue(this.resolveValueLookupPath(name));
        return val === undefined ? null : val;
    }
  }

  contextRef(ctx: any) {
    const ident = ctx.Identifier[0].image;
    const tail = (ctx.Identifier.slice(1) ?? []).map((token: any) => token.image);
    const applyTail = (value: any) => {
        let current = value;
        for (const segment of tail) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return null;
            }
            current = current[segment];
        }
        return current === undefined ? null : current;
    };
    if (ident === 'index') {
        const repeat = this.getRepeatContextInfo();
        return applyTail(repeat ? repeat.index + 1 : null); // 1-based as per spec
    }
    if (ident === 'current') {
        const repeat = this.getRepeatContextInfo();
        return applyTail(repeat ? this.buildRepeatRow(repeat.rowPath) : null);
    }
    if (ident === 'count') {
        const repeat = this.getRepeatContextInfo();
        return applyTail(repeat ? repeat.count : null);
    }
    // Resolve @variableName via engine's lexical scope lookup
    if (this.context.engine?.getVariableValue) {
        const val = this.context.engine.getVariableValue(ident, this.context.currentItemPath);
        if (val !== undefined) return applyTail(val);
    }
    return applyTail(null);
  }

  /**
   * Set of stdlib function names whose first argument should be extracted as a
   * raw path string rather than evaluated as a normal expression. This is
   * because MIP query functions (`valid`, `relevant`, `readonly`, `required`)
   * need the field path — not the field's value — to query the engine state.
   */
  private static MIP_QUERY_FUNCTIONS = new Set(['valid', 'relevant', 'readonly', 'required']);

  /**
   * Reconstructs a dotted field path string from an unevaluated CST argument node.
   *
   * Used by MIP query functions to extract the path the user wrote (e.g. `valid(email)`
   * yields `"email"`, `valid($group.field)` yields `"group.field"`) instead of evaluating
   * the argument to its runtime value. Walks the CST collecting tokens, sorts by offset,
   * strips `$` and `.` tokens, then joins identifiers with dots.
   */
  private extractPathFromArgTokens(argCstNode: any): string {
    // Collect all tokens from the argument CST node to reconstruct the path string.
    // This handles bare identifiers (email), dollar refs ($email), and dotted paths (group.field).
    const tokens: any[] = [];
    const collectTokens = (node: any) => {
        if (!node) return;
        if (typeof node !== 'object') return;
        // If it's a token (has image property and startOffset)
        if (node.image !== undefined && node.startOffset !== undefined) {
            tokens.push(node);
            return;
        }
        // If it's an array, recurse
        if (Array.isArray(node)) {
            for (const child of node) collectTokens(child);
            return;
        }
        // CST node: recurse into children
        if (node.children) {
            for (const key of Object.keys(node.children)) {
                collectTokens(node.children[key]);
            }
        } else {
            // Plain object with arrays/tokens as values
            for (const key of Object.keys(node)) {
                collectTokens(node[key]);
            }
        }
    };
    collectTokens(argCstNode);

    // Sort by position and reconstruct
    tokens.sort((a, b) => a.startOffset - b.startOffset);

    // Build the raw path string exactly as written, minus the leading `$`.
    let path = '';
    for (const tok of tokens) {
        if (tok.image === '$') continue;
        path += tok.image;
    }
    return path;
  }

  functionCall(ctx: any) {
    const name = ctx.Identifier[0].image;

    // MIP query functions: extract path string from argument instead of evaluating
    if (FelInterpreter.MIP_QUERY_FUNCTIONS.has(name) && ctx.argList) {
        const argExprs = ctx.argList[0].children.expression;
        if (argExprs && argExprs.length > 0) {
            const path = this.extractPathFromArgTokens(argExprs[0]);
            const fn = this.felStdLib[name];
            if (fn) return fn(path);
        }
    }

    if (name === 'if' && ctx.argList) {
        const argExprs = ctx.argList[0].children.expression;
        if (!argExprs || argExprs.length < 3) return null;
        const condition = this.visit(argExprs[0]);
        if (isNullish(condition) || !isBoolean(condition)) return null;
        return condition ? this.visit(argExprs[1]) : this.visit(argExprs[2]);
    }

    // countWhere: first arg is evaluated (array), second arg is predicate evaluated per-element with $ rebound
    if (name === 'countWhere' && ctx.argList) {
        const argExprs = ctx.argList[0].children.expression;
        if (argExprs && argExprs.length >= 2) {
            const arr = this.visit(argExprs[0]);
            if (!Array.isArray(arr)) return 0;
            const predicateExpr = argExprs[1];
            const savedPath = this.context.currentItemPath;
            let count = 0;
            for (const item of arr) {
                // Temporarily override getSignalValue for $ to return current item
                const origGetSignal = this.context.getSignalValue;
                this.context.getSignalValue = (path: string) => {
                    if (path === savedPath || path === '') return item;
                    return origGetSignal(path);
                };
                const result = this.visit(predicateExpr);
                this.context.getSignalValue = origGetSignal;
                if (result) count++;
            }
            return count;
        }
    }

    const args = ctx.argList ? this.visit(ctx.argList) : [];
    const fn = this.felStdLib[name];
    if (fn) return fn(...args);
    throw new FelUnsupportedFunctionError(name);
  }

  argList(ctx: any) {
    return ctx.expression.map((e: any) => this.visit(e));
  }

  arrayLiteral(ctx: any) {
    return ctx.expression ? ctx.expression.map((e: any) => this.visit(e)) : [];
  }

  objectLiteral(ctx: any) {
    const obj: any = {};
    if (ctx.objectEntries) {
        const entries = this.visit(ctx.objectEntries);
        for (const entry of entries) {
            obj[entry.key] = entry.value;
        }
    }
    return obj;
  }

  objectEntries(ctx: any) {
    return ctx.objectEntry.map((e: any) => this.visit(e));
  }

  objectEntry(ctx: any) {
    const key = ctx.Identifier ? ctx.Identifier[0].image : ctx.StringLiteral[0].image.slice(1, -1);
    const value = this.visit(ctx.expression);
    return { key, value };
  }
}

/**
 * Pre-instantiated FEL interpreter singleton.
 *
 * Shared across the engine to avoid repeated Chevrotain visitor validation.
 * Usage: call `interpreter.evaluate(cst, context)` where `cst` is the output
 * of `parser.expression()` and `context` is a {@link FelContext} wired to
 * the FormEngine's signal graph.
 */
export const interpreter = new FelInterpreter();
