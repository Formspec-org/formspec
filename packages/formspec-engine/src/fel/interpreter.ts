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
    return this.visit(cst);
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
    round: (n: number, p: number = 0) => {
        const factor = Math.pow(10, p);
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
    abs: (n: number) => Math.abs(n || 0),
    power: (b: number, e: number) => Math.pow(b || 0, e || 0),
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
    floor: (n: number) => Math.floor(n || 0),
    ceil: (n: number) => Math.ceil(n || 0),
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
    /** Validates and returns an ISO 8601 date string. Throws if the input is not a valid date. */
    date: (v: any) => {
        if (v === null || v === undefined) return null;
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
    /** Returns the value of a sibling field from the previous repeat instance (index - 1). Returns null if at the first instance or not inside a repeat. */
    prev: (name: string) => {
        const parts = this.context.currentItemPath.split(/[\[\].]/).filter(Boolean);
        let lastNumIndex = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (!isNaN(parseInt(parts[i]))) { lastNumIndex = i; break; }
        }
        if (lastNumIndex === -1) return null;
        const idx = parseInt(parts[lastNumIndex]);
        if (idx <= 0) return null;
        const siblingsPath = parts.slice(0, lastNumIndex).join('.') + `[${idx-1}].` + name;
        return this.context.getSignalValue(siblingsPath);
    },
    /** Returns the value of a sibling field from the next repeat instance (index + 1). Returns null if not inside a repeat. */
    next: (name: string) => {
        const parts = this.context.currentItemPath.split(/[\[\].]/).filter(Boolean);
        let lastNumIndex = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (!isNaN(parseInt(parts[i]))) { lastNumIndex = i; break; }
        }
        if (lastNumIndex === -1) return null;
        const idx = parseInt(parts[lastNumIndex]);
        const siblingsPath = parts.slice(0, lastNumIndex).join('.') + `[${idx+1}].` + name;
        return this.context.getSignalValue(siblingsPath);
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
    /** Walks up the path hierarchy from the current item, returning the value of the first ancestor field matching `name`. */
    parent: (name: string) => {
        const parts = this.context.currentItemPath.split(/[\[\].]/).filter(Boolean);
        for (let i = parts.length - 2; i >= 0; i--) {
            const path = parts.slice(0, i).join('.') + (i > 0 ? '.' : '') + name;
            const val = this.context.getSignalValue(path);
            if (val !== undefined) return val;
        }
        return this.context.getSignalValue(name);
    },
    /** MIP query: returns true if the field at `path` has zero validation errors. Argument is extracted as a path string, not evaluated. */
    valid: (path: string) => {
        return this.context.getValidationErrors(path) === 0;
    },
    /** MIP query: returns the relevance (visibility) state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    relevant: (path: string) => {
        return this.context.getRelevantValue(path);
    },
    /** MIP query: returns the readonly state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    readonly: (path: string) => {
        return this.context.getReadonlyValue(path);
    },
    /** MIP query: returns the required state of the field at `path`. Argument is extracted as a path string, not evaluated. */
    required: (path: string) => {
        return this.context.getRequiredValue(path);
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
        // Implement scope/environment for let
        return this.visit(ctx.inExpr);
    }
    return this.visit(ctx.ifExpr);
  }

  ifExpr(ctx: any) {
    if (ctx.If) {
        const condition = this.visit(ctx.condition);
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
        return val ? this.visit(ctx.trueExpr) : this.visit(ctx.falseExpr);
    }
    return val;
  }

  logicalOr(ctx: any) {
    let result = this.visit(ctx.logicalAnd[0]);
    for (let i = 1; i < ctx.logicalAnd.length; i++) {
        result = result || this.visit(ctx.logicalAnd[i]);
    }
    return result;
  }

  logicalAnd(ctx: any) {
    let result = this.visit(ctx.equality[0]);
    for (let i = 1; i < ctx.equality.length; i++) {
        result = result && this.visit(ctx.equality[i]);
    }
    return result;
  }

  equality(ctx: any) {
    let result = this.visit(ctx.comparison[0]);
    for (let i = 1; i < ctx.comparison.length; i++) {
        const next = this.visit(ctx.comparison[i]);
        if (ctx.Equals && ctx.Equals[i-1]) {
            result = result === next;
        } else {
            result = result !== next;
        }
    }
    return result;
  }

  comparison(ctx: any) {
    let result = this.visit(ctx.membership[0]);
    for (let i = 1; i < ctx.membership.length; i++) {
        const next = this.visit(ctx.membership[i]);
        if (ctx.LessEqual && ctx.LessEqual[i-1]) result = result <= next;
        else if (ctx.GreaterEqual && ctx.GreaterEqual[i-1]) result = result >= next;
        else if (ctx.Less && ctx.Less[i-1]) result = result < next;
        else if (ctx.Greater && ctx.Greater[i-1]) result = result > next;
    }
    return result;
  }

  membership(ctx: any) {
    const val = this.visit(ctx.nullCoalesce[0]);
    if (ctx.In || ctx.Not) {
        const list = this.visit(ctx.nullCoalesce[1]);
        const isIn = Array.isArray(list) ? list.includes(val) : false;
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
        const op = ops[i - 1];
        if (op === '+') result = result + next;
        else if (op === '-') result = result - next;
        else if (op === '&') result = String(result) + String(next);
    }
    return result;
  }

  multiplication(ctx: any) {
    let result = this.visit(ctx.unary[0]);
    if (ctx.unary.length <= 1) return result;
    const ops = sortedOperators({ Asterisk: ctx.Asterisk, Slash: ctx.Slash, Percent: ctx.Percent });
    for (let i = 1; i < ctx.unary.length; i++) {
        const next = this.visit(ctx.unary[i]);
        const op = ops[i - 1];
        if (op === '*') result = result * next;
        else if (op === '/') result = result / next;
        else if (op === '%') result = result % next;
    }
    return result;
  }

  unary(ctx: any) {
    if (ctx.Not) {
        return !this.visit(ctx.unary);
    }
    if (ctx.Minus) {
        return -this.visit(ctx.unary);
    }
    return this.visit(ctx.postfix);
  }

  postfix(ctx: any) {
    let val = this.visit(ctx.atom);
    if (ctx.pathTail) {
        for (const tail of ctx.pathTail) {
            // postfix resolution
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
        const str = ctx.StringLiteral[0].image;
        return str.substring(1, str.length - 1);
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

        const parentPath = this.getParentPath(this.context.currentItemPath);
        const fullPath = parentPath ? `${parentPath}.${name}` : name;

        let val = this.context.getSignalValue(fullPath);
        if (val === undefined) {
            val = this.context.getSignalValue(name);
        }
        return val;
    }
    if (ctx.contextRef) return this.visit(ctx.contextRef);
    if (ctx.Identifier) {
        let name = ctx.Identifier[0].image;
        if (ctx.pathTail) {
            for (const tail of ctx.pathTail) {
                name = this.appendPathTail(name, this.visit(tail));
            }
        }
        const parentPath = this.getParentPath(this.context.currentItemPath);
        const fullPath = parentPath ? `${parentPath}.${name}` : name;

        let val = this.context.getSignalValue(fullPath);
        if (val === undefined) {
            val = this.context.getSignalValue(name);
        }
        return val;
    }
  }

  contextRef(ctx: any) {
    const ident = ctx.Identifier[0].image;
    if (ident === 'index') {
        const parts = this.context.currentItemPath.split(/[\[\]]/).filter(p => !isNaN(parseInt(p)));
        return parts.length > 0 ? parseInt(parts[parts.length - 1]) + 1 : 1; // 1-based as per spec
    }
    if (ident === 'current') {
        return this.context.getSignalValue(this.context.currentItemPath);
    }
    if (ident === 'count') {
        // Return total instances in current repeat group
        // Walk back from currentItemPath to find enclosing repeat group
        const path = this.context.currentItemPath;
        const bracketIdx = path.lastIndexOf('[');
        if (bracketIdx !== -1) {
            const groupPath = path.substring(0, bracketIdx);
            return this.context.getRepeatsValue(groupPath);
        }
        return 0;
    }
    // Resolve @variableName via engine's lexical scope lookup
    if (this.context.engine?.getVariableValue) {
        const val = this.context.engine.getVariableValue(ident, this.context.currentItemPath);
        if (val !== undefined) return val;
    }
    return null;
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

    // Build path from tokens: skip $ prefix, join identifiers with dots
    let path = '';
    for (const tok of tokens) {
        if (tok.image === '$') continue; // skip dollar sign
        if (tok.image === '.') continue; // skip dots (we add our own)
        if (/^[a-zA-Z_]/.test(tok.image)) {
            path += (path ? '.' : '') + tok.image;
        }
    }

    // Resolve relative to parent path
    const parentPath = this.getParentPath(this.context.currentItemPath);
    if (path && !path.includes('.') && parentPath) {
        return `${parentPath}.${path}`;
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
    return null;
  }

  ifCall(ctx: any) {
    const args = ctx.argList ? this.visit(ctx.argList) : [];
    return args[0] ? args[1] : args[2];
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
