import { parser } from './parser';

const BaseVisitor = parser.getBaseCstVisitorConstructor();

/** Merge per-type operator token arrays and return them sorted by source position. */
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

export interface FelContext {
  getSignalValue: (path: string) => any;
  getRepeatsValue: (path: string) => number;
  getRelevantValue: (path: string) => boolean;
  getRequiredValue: (path: string) => boolean;
  getReadonlyValue: (path: string) => boolean;
  getValidationErrors: (path: string) => number;
  currentItemPath: string;
  engine: any;
}

export class FelInterpreter extends BaseVisitor {
  private context!: FelContext;

  constructor() {
    super();
    this.validateVisitor();
  }

  private getParentPath(itemPath: string): string {
    const lastDot = itemPath.lastIndexOf('.');
    if (lastDot === -1) return '';
    return itemPath.substring(0, lastDot);
  }

  public evaluate(cst: any, context: FelContext) {
    this.context = context;
    return this.visit(cst);
  }

  private felStdLib: Record<string, Function> = {
    sum: (arr: any[]) => {
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((a, b) => {
            const val = typeof b === 'string' ? parseFloat(b) : b;
            return a + (Number.isFinite(val) ? val : 0);
        }, 0);
    },
    upper: (s: string) => (s || '').toUpperCase(),
    round: (n: number, p: number = 0) => {
        const factor = Math.pow(10, p);
        return Math.round(n * factor) / factor;
    },
    year: (d: string) => d ? new Date(d).getFullYear() : null,
    coalesce: (...args: any[]) => args.find(a => a !== null && a !== undefined && a !== ''),
    isNull: (a: any) => a === null || a === undefined || a === '',
    present: (a: any) => a !== null && a !== undefined && a !== '',
    contains: (s: string, sub: string) => (s || '').includes(sub || ''),
    abs: (n: number) => Math.abs(n || 0),
    power: (b: number, e: number) => Math.pow(b || 0, e || 0),
    empty: (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
    dateAdd: (d: string, n: number, unit: string) => {
        if (!d) return null;
        const date = new Date(d);
        if (isNaN(date.getTime())) return null;
        if (unit === 'days') date.setDate(date.getDate() + n);
        else if (unit === 'months') date.setMonth(date.getMonth() + n);
        else if (unit === 'years') date.setFullYear(date.getFullYear() + n);
        return date.toISOString().split('T')[0];
    },
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
    time: (h: number, m: number, s: number) => {
        const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    },
    selected: (val: any, opt: any) => Array.isArray(val) ? val.includes(opt) : val === opt,
    isNumber: (v: any) => typeof v === 'number' && !isNaN(v),
    string: (v: any) => v === null || v === undefined ? '' : String(v),
    isString: (v: any) => typeof v === 'string',
    isDate: (v: any) => !isNaN(Date.parse(v)),
    typeOf: (v: any) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v,
    number: (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
    boolean: (v: any) => {
        if (v === null || v === undefined) return false;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'boolean') return v;
        if (v === 'true') return true;
        if (v === 'false') return false;
        throw new Error(`boolean(): cannot convert "${v}" to boolean`);
    },
    date: (v: any) => {
        if (v === null || v === undefined) return null;
        const d = new Date(v);
        if (isNaN(d.getTime())) throw new Error(`date(): "${v}" is not a valid ISO 8601 date`);
        return v;
    },
    money: (amount: number, currency: string) => ({ amount, currency }),
    moneyAmount: (m: any) => m && m.amount !== undefined ? m.amount : null,
    moneyCurrency: (m: any) => m && m.currency !== undefined ? m.currency : null,
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
    if: (cond: any, thenVal: any, elseVal: any) => cond ? thenVal : elseVal,
    format: (fmt: string, ...args: any[]) => {
        if (!fmt) return '';
        let i = 0;
        return fmt.replace(/%s/g, () => args[i] !== undefined ? String(args[i++]) : '');
    },
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
    moneyAdd: (a: any, b: any) => {
        if (!a || !b) return null;
        return { amount: (a.amount || 0) + (b.amount || 0), currency: a.currency || b.currency };
    },
    moneySum: (arr: any[]) => {
        if (!Array.isArray(arr)) return null;
        const valid = arr.filter(m => m && m.amount !== undefined);
        if (valid.length === 0) return null;
        return { amount: valid.reduce((s, m) => s + (m.amount || 0), 0), currency: valid[0].currency };
    },
    parent: (name: string) => {
        const parts = this.context.currentItemPath.split(/[\[\].]/).filter(Boolean);
        for (let i = parts.length - 2; i >= 0; i--) {
            const path = parts.slice(0, i).join('.') + (i > 0 ? '.' : '') + name;
            const val = this.context.getSignalValue(path);
            if (val !== undefined) return val;
        }
        return this.context.getSignalValue(name);
    },
    valid: (path: string) => {
        return this.context.getValidationErrors(path) === 0;
    },
    relevant: (path: string) => {
        return this.context.getRelevantValue(path);
    },
    readonly: (path: string) => {
        return this.context.getReadonlyValue(path);
    },
    required: (path: string) => {
        return this.context.getRequiredValue(path);
    },
    instance: (name: string, path?: string) => {
        if (this.context.engine?.getInstanceData) {
            return this.context.engine.getInstanceData(name, path);
        }
        return undefined;
    },
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
    if (ctx.NumberLiteral) return parseInt(ctx.NumberLiteral[0].image);
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

  fieldRef(ctx: any) {
    if (ctx.Dollar) {
        let name = ctx.Identifier ? ctx.Identifier[0].image : '';
        if (ctx.pathTail) {
            for (const tail of ctx.pathTail) {
                const tailVal = this.visit(tail);
                name += (name ? '.' : '') + tailVal;
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
                const tailVal = this.visit(tail);
                name += (name ? '.' : '') + tailVal;
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

  // MIP query functions receive a path string, not a resolved value
  private static MIP_QUERY_FUNCTIONS = new Set(['valid', 'relevant', 'readonly', 'required']);

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

export const interpreter = new FelInterpreter();
