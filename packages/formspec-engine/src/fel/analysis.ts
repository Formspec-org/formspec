/** @filedesc Static analysis and path rewriting for FEL expressions. */
import { type IToken } from 'chevrotain';
import { FelLexer } from './lexer.js';
import { parser } from './parser.js';
import { dependencyVisitor } from './dependency-visitor.js';

/** A parser/lexer error from FEL analysis with best-effort source location metadata. */
export interface FELAnalysisError {
  message: string;
  offset?: number;
  line?: number;
  column?: number;
}

/** Parser-backed structural analysis output for a FEL expression. */
export interface FELAnalysis {
  valid: boolean;
  errors: FELAnalysisError[];
  references: string[];
  variables: string[];
  functions: string[];
  cst?: unknown;
}

/** Callback options used by {@link rewriteFELReferences}. */
export interface FELRewriteOptions {
  rewriteFieldPath?: (path: string) => string;
  rewriteCurrentPath?: (path: string) => string;
  rewriteVariable?: (name: string) => string;
  rewriteInstanceName?: (name: string) => string;
  rewriteNavigationTarget?: (name: string, fn: 'prev' | 'next' | 'parent') => string;
}

type ParseResult = {
  tokens: IToken[];
  cst?: any;
  errors: FELAnalysisError[];
};

type Replacement = {
  start: number;
  end: number;
  text: string;
};

const RESERVED_CONTEXT_NAMES = new Set(['current', 'index', 'count', 'instance']);
const NAV_FUNCTIONS = new Set(['prev', 'next', 'parent']);

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function tokenEndOffset(token: IToken): number {
  if (typeof token.endOffset === 'number') return token.endOffset;
  return token.startOffset + token.image.length - 1;
}

function toLexError(err: any): FELAnalysisError {
  return {
    message: err.message ?? 'FEL lexer error',
    offset: typeof err.offset === 'number' ? err.offset : undefined,
    line: typeof err.line === 'number' ? err.line : undefined,
    column: typeof err.column === 'number' ? err.column : undefined,
  };
}

function toParseError(err: any): FELAnalysisError {
  const token = err?.token;
  return {
    message: err?.message ?? 'FEL parse error',
    offset: typeof token?.startOffset === 'number' ? token.startOffset : undefined,
    line: typeof token?.startLine === 'number' ? token.startLine : undefined,
    column: typeof token?.startColumn === 'number' ? token.startColumn : undefined,
  };
}

/** Tokenize and parse a FEL expression, preserving partial CST output when parsing reaches the grammar. */
function parseExpression(expression: string): ParseResult {
  const lexResult = FelLexer.tokenize(expression);
  if (lexResult.errors.length > 0) {
    return {
      tokens: lexResult.tokens,
      errors: lexResult.errors.map(toLexError),
    };
  }

  parser.input = lexResult.tokens;
  const cst = parser.expression();
  if (parser.errors.length > 0) {
    return {
      tokens: lexResult.tokens,
      cst,
      errors: parser.errors.map(toParseError),
    };
  }

  return {
    tokens: lexResult.tokens,
    cst,
    errors: [],
  };
}

/** Depth-first traversal over Chevrotain CST nodes, invoking the visitor for every named rule node. */
function walkCst(node: any, visitor: (node: any) => void): void {
  if (!node || typeof node !== 'object') return;
  if (typeof node.name === 'string') {
    visitor(node);
  }

  const children = node.children;
  if (!children || typeof children !== 'object') return;

  for (const value of Object.values(children)) {
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (child && typeof child === 'object' && typeof (child as any).name === 'string') {
        walkCst(child, visitor);
      }
    }
  }
}

/** Collect all tokens contained within a CST subtree so callers can compute exact source ranges. */
function collectNodeTokens(node: any, tokens: IToken[]): void {
  if (!node || typeof node !== 'object') return;
  const children = node.children;
  if (!children || typeof children !== 'object') return;

  for (const value of Object.values(children)) {
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (!child || typeof child !== 'object') continue;
      if (typeof (child as any).image === 'string' && typeof (child as any).startOffset === 'number') {
        tokens.push(child as IToken);
      } else if (typeof (child as any).name === 'string') {
        collectNodeTokens(child, tokens);
      }
    }
  }
}

/** Compute the inclusive source range covered by a CST subtree. */
function nodeRange(node: any): { start: number; end: number } | undefined {
  const tokens: IToken[] = [];
  collectNodeTokens(node, tokens);
  if (tokens.length === 0) return undefined;
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const token of tokens) {
    if (token.startOffset < start) start = token.startOffset;
    const tokenEnd = tokenEndOffset(token);
    if (tokenEnd > end) end = tokenEnd;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return { start, end };
}

/** Remove surrounding quotes from a FEL string literal and unescape supported quote/backslash sequences. */
function unquoteStringLiteral(literal: string): string {
  if (literal.length < 2) return literal;
  const quote = literal[0];
  if ((quote !== '\'' && quote !== '"') || literal[literal.length - 1] !== quote) {
    return literal;
  }
  const inner = literal.slice(1, -1);
  return inner.replace(/\\(['"\\])/g, '$1');
}

/** Quote and escape a string value using the caller's preferred quote style. */
function quoteStringLiteral(value: string, quote: '\'' | '"'): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(quote === '\'' ? /'/g : /"/g, `\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

/** Reconstruct the tail of a field path (`.name`, `[0]`, `[*]`) from parser nodes. */
function readPathTailSegments(pathTailNodes: any[] | undefined): string[] {
  if (!Array.isArray(pathTailNodes)) return [];
  const segments: string[] = [];
  for (const tail of pathTailNodes) {
    if (tail.children.Identifier?.[0]?.image) {
      segments.push(tail.children.Identifier[0].image);
      continue;
    }
    if (tail.children.LSquare && tail.children.RSquare) {
      if (tail.children.NumberLiteral?.[0]?.image) {
        segments.push(`[${tail.children.NumberLiteral[0].image}]`);
        continue;
      }
      if (tail.children.Asterisk?.[0]?.image) {
        segments.push('[*]');
      }
    }
  }
  return segments;
}

/** Read a `fieldRef` CST node back into the dotted path string it represents. */
function readFieldRefPath(fieldRefNode: any): string | undefined {
  const identifier = fieldRefNode.children.Identifier?.[0]?.image as string | undefined;
  const tailSegments = readPathTailSegments(fieldRefNode.children.pathTail);

  if (fieldRefNode.children.Dollar) {
    if (!identifier) return undefined;
    const pathSegments: string[] = [identifier];
    for (const seg of tailSegments) {
      if (seg.startsWith('[')) {
        const last = pathSegments[pathSegments.length - 1];
        pathSegments[pathSegments.length - 1] = `${last}${seg}`;
      } else {
        pathSegments.push(seg);
      }
    }
    return pathSegments.join('.');
  }

  if (!identifier) return undefined;
  const pathSegments: string[] = [identifier];
  for (const seg of tailSegments) {
    if (seg.startsWith('[')) {
      const last = pathSegments[pathSegments.length - 1];
      pathSegments[pathSegments.length - 1] = `${last}${seg}`;
    } else {
      pathSegments.push(seg);
    }
  }
  return pathSegments.join('.');
}

/** Rebuild a field reference after rewriting, preserving whether the source used `$path` or a bare path. */
function replacementTextForFieldRef(node: any, rewrittenPath: string): string {
  if (node.children.Dollar) return `$${rewrittenPath}`;
  return rewrittenPath;
}

/** Extract the path segments following `@current` from a `contextRef` CST node. */
function readContextPathSegments(contextNode: any): string[] {
  const identifiers = contextNode.children.Identifier as IToken[] | undefined;
  if (!identifiers || identifiers.length <= 1) return [];
  return identifiers.slice(1).map(token => token.image);
}

/** Collect all function names invoked in the parsed expression, deduplicated in encounter order. */
function collectFunctionNames(cst: any): string[] {
  const functions: string[] = [];
  walkCst(cst, node => {
    if (node.name !== 'functionCall') return;
    const fnToken = node.children.Identifier?.[0];
    if (fnToken?.image) functions.push(fnToken.image);
  });
  return dedupe(functions);
}

/** Collect non-reserved `@variable` references, excluding context refs like `@current` and `@instance(...)`. */
function collectVariableNames(cst: any): string[] {
  const variables: string[] = [];
  walkCst(cst, node => {
    if (node.name !== 'contextRef') return;
    const ident = node.children.Identifier?.[0]?.image as string | undefined;
    if (!ident) return;
    if (node.children.LRound) return;
    if (RESERVED_CONTEXT_NAMES.has(ident)) return;
    variables.push(ident);
  });
  return dedupe(variables);
}

/** Build concrete source edits for parser-aware FEL rewriting callbacks. */
function collectRewriteReplacements(cst: any, options: FELRewriteOptions): Replacement[] {
  const replacements: Replacement[] = [];

  walkCst(cst, node => {
    if (node.name === 'fieldRef') {
      if (!node.children.Dollar) return;
      const path = readFieldRefPath(node);
      if (!path || !options.rewriteFieldPath) return;
      const rewritten = options.rewriteFieldPath(path);
      if (rewritten === path) return;
      const range = nodeRange(node);
      if (!range) return;
      replacements.push({
        start: range.start,
        end: range.end + 1,
        text: replacementTextForFieldRef(node, rewritten),
      });
      return;
    }

    if (node.name === 'contextRef') {
      const identToken = node.children.Identifier?.[0] as IToken | undefined;
      const ident = identToken?.image;
      if (!ident) return;

      if (ident === 'instance' && options.rewriteInstanceName && node.children.LRound && node.children.StringLiteral?.[0]) {
        const strToken = node.children.StringLiteral[0] as IToken;
        const quote = strToken.image[0] === '"' ? '"' : '\'';
        const currentName = unquoteStringLiteral(strToken.image);
        const rewritten = options.rewriteInstanceName(currentName);
        if (rewritten !== currentName) {
          replacements.push({
            start: strToken.startOffset,
            end: tokenEndOffset(strToken) + 1,
            text: quoteStringLiteral(rewritten, quote),
          });
        }
        return;
      }

      if (ident === 'current' && options.rewriteCurrentPath) {
        const segments = readContextPathSegments(node);
        if (segments.length === 0) return;
        const currentPath = segments.join('.');
        const rewritten = options.rewriteCurrentPath(currentPath);
        if (rewritten === currentPath) return;
        const identifiers = node.children.Identifier as IToken[] | undefined;
        const first = identifiers?.[1];
        const last = identifiers?.[identifiers.length - 1];
        if (!first || !last) return;
        replacements.push({
          start: first.startOffset,
          end: tokenEndOffset(last) + 1,
          text: rewritten,
        });
        return;
      }

      if (options.rewriteVariable && !RESERVED_CONTEXT_NAMES.has(ident) && !node.children.LRound) {
        const rewritten = options.rewriteVariable(ident);
        if (rewritten !== ident) {
          replacements.push({
            start: identToken.startOffset,
            end: tokenEndOffset(identToken) + 1,
            text: rewritten,
          });
        }
      }
      return;
    }

    if (node.name === 'functionCall' && options.rewriteNavigationTarget) {
      const fnToken = node.children.Identifier?.[0] as IToken | undefined;
      const fnName = fnToken?.image as 'prev' | 'next' | 'parent' | undefined;
      if (!fnName || !NAV_FUNCTIONS.has(fnName)) return;
      const argList = node.children.argList?.[0];
      if (!argList) return;
      const firstExpression = argList.children.expression?.[0];
      if (!firstExpression) return;

      const argumentTokens: IToken[] = [];
      collectNodeTokens(firstExpression, argumentTokens);
      const literalTokens = argumentTokens.filter(token => token.tokenType?.name === 'StringLiteral');
      if (literalTokens.length !== 1) return;
      const hasNonLiteralStructure = argumentTokens.some((token) => {
        const name = token.tokenType?.name;
        return name !== 'StringLiteral' && name !== 'LRound' && name !== 'RRound';
      });
      if (hasNonLiteralStructure) return;
      const literal = literalTokens[0];

      const current = unquoteStringLiteral(literal.image);
      const rewritten = options.rewriteNavigationTarget(current, fnName);
      if (rewritten === current) return;

      const quote = literal.image[0] === '"' ? '"' : '\'';
      replacements.push({
        start: literal.startOffset,
        end: tokenEndOffset(literal) + 1,
        text: quoteStringLiteral(rewritten, quote),
      });
    }
  });

  return replacements;
}

/** Apply a set of non-overlapping source edits right-to-left so offsets stay valid. */
function applyReplacements(expression: string, replacements: Replacement[]): string {
  if (replacements.length === 0) return expression;
  replacements.sort((a, b) => b.start - a.start);
  let out = expression;
  for (const replacement of replacements) {
    out = out.slice(0, replacement.start) + replacement.text + out.slice(replacement.end);
  }
  return out;
}

/**
 * Parse and analyze a FEL expression using the engine's Chevrotain parser stack.
 * References, variables, and functions are extracted structurally from the CST.
 */
export function analyzeFEL(expression: string, options?: { includeCst?: boolean }): FELAnalysis {
  const parsed = parseExpression(expression);
  if (!parsed.cst || parsed.errors.length > 0) {
    return {
      valid: false,
      errors: parsed.errors,
      references: [],
      variables: [],
      functions: [],
    };
  }

  const references = dependencyVisitor.getDependencies(parsed.cst);
  const variables = collectVariableNames(parsed.cst);
  const functions = collectFunctionNames(parsed.cst);

  return {
    valid: true,
    errors: [],
    references,
    variables,
    functions,
    cst: options?.includeCst ? parsed.cst : undefined,
  };
}

/** Parser-backed field dependency extraction for FEL expressions that returns an empty array on parse failure. */
export function getFELDependencies(expression: string): string[] {
  const analysis = analyzeFEL(expression);
  return analysis.valid ? analysis.references : [];
}

/**
 * Rewrites FEL references using parser-aware callbacks.
 * Non-reference text is preserved untouched; invalid expressions are returned as-is.
 */
export function rewriteFELReferences(expression: string, options: FELRewriteOptions): string {
  const parsed = parseExpression(expression);
  if (!parsed.cst || parsed.errors.length > 0) {
    return expression;
  }

  const replacements = collectRewriteReplacements(parsed.cst, options);
  return applyReplacements(expression, replacements);
}
