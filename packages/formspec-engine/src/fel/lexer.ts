/**
 * @module fel/lexer
 *
 * Chevrotain-based tokenizer for the Formspec Expression Language (FEL).
 *
 * This is the first stage of the FEL pipeline (Lexer -> Parser -> Interpreter).
 * It defines 35 token types covering whitespace/comments (skipped), keywords,
 * literals, operators, and punctuation. Token ordering in {@link allTokens}
 * controls Chevrotain's longest-match disambiguation — longer patterns (e.g.
 * DateTimeLiteral) must precede shorter ones (e.g. DateLiteral, NumberLiteral).
 */
import { createToken, Lexer } from 'chevrotain';

// ---------------------------------------------------------------------------
// Skipped tokens — consumed by the lexer but not forwarded to the parser
// ---------------------------------------------------------------------------

/** Matches one or more whitespace characters. Skipped during tokenization. */
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
});

/** Matches single-line comments starting with `//`. Skipped during tokenization. */
export const Comment = createToken({
  name: 'Comment',
  pattern: /\/\/.*/,
  group: Lexer.SKIPPED
});

/** Matches block comments delimited by `/* ... *\/`. Skipped during tokenization. */
export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED
});

// ---------------------------------------------------------------------------
// Boolean and null literals
// ---------------------------------------------------------------------------

/** Boolean literal `true`. */
export const True = createToken({ name: 'True', pattern: /true\b/ });
/** Boolean literal `false`. */
export const False = createToken({ name: 'False', pattern: /false\b/ });
/** Null literal `null`. */
export const Null = createToken({ name: 'Null', pattern: /null\b/ });

// ---------------------------------------------------------------------------
// Logical and set operators (keyword-style)
// ---------------------------------------------------------------------------

/** Logical AND operator (`and`). Short-circuits in the interpreter. */
export const And = createToken({ name: 'And', pattern: /and\b/ });
/** Logical OR operator (`or`). Short-circuits in the interpreter. */
export const Or = createToken({ name: 'Or', pattern: /or\b/ });
/** Logical NOT / membership negation operator (`not`). Used both as unary prefix and in `not in`. */
export const Not = createToken({ name: 'Not', pattern: /not\b/ });
/** Set membership operator (`in`). Tests whether a value exists in an array. Also used as the `in` keyword for `let ... in` bindings. */
export const In = createToken({ name: 'In', pattern: /in\b/ });

// ---------------------------------------------------------------------------
// Identifiers — must appear after all keyword tokens to avoid mis-matching
// ---------------------------------------------------------------------------

/** General identifier matching `[a-zA-Z_][a-zA-Z0-9_]*`. Used for field names, function names, and variable references. Listed last in {@link allTokens} so keyword tokens take priority. */
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/
});

// ---------------------------------------------------------------------------
// Control-flow keywords
// ---------------------------------------------------------------------------

/** Conditional keyword `if`. Categorized as an {@link Identifier} so that `if(...)` can also be parsed as a function call. */
export const If = createToken({ name: 'If', pattern: /if\b/, categories: [Identifier] });
/** Conditional keyword `then`, used in `if ... then ... else` expressions. */
export const Then = createToken({ name: 'Then', pattern: /then\b/ });
/** Conditional keyword `else`, used in `if ... then ... else` expressions. */
export const Else = createToken({ name: 'Else', pattern: /else\b/ });
/** Let-binding keyword `let`, used in `let x = expr in body` expressions for local variable scoping. */
export const Let = createToken({ name: 'Let', pattern: /let\b/ });

// ---------------------------------------------------------------------------
// Literal tokens
// ---------------------------------------------------------------------------

/** String literal enclosed in single or double quotes, with backslash escapes. Matches `"hello"` or `'world'`. */
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/
});

/** Numeric literal supporting integers, decimals, and scientific notation. Matches `-3`, `1.5`, `2e10`. */
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/
});

/** DateTime literal prefixed with `@`. Matches ISO 8601 datetime like `@2024-01-15T10:30:00Z`. Must precede {@link DateLiteral} in token order to win longest-match. */
export const DateTimeLiteral = createToken({
  name: 'DateTimeLiteral',
  pattern: /@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?/
});

/** Date literal prefixed with `@`. Matches ISO 8601 date like `@2024-01-15`. */
export const DateLiteral = createToken({
  name: 'DateLiteral',
  pattern: /@\d{4}-\d{2}-\d{2}/
});

// ---------------------------------------------------------------------------
// Brackets and grouping
// ---------------------------------------------------------------------------

/** Left parenthesis `(`. Used for grouping, function calls, and context ref parameters. */
export const LRound = createToken({ name: 'LRound', pattern: /\(/ });
/** Right parenthesis `)`. */
export const RRound = createToken({ name: 'RRound', pattern: /\)/ });
/** Left square bracket `[`. Used for array literals and indexed path access (e.g. `group[0]`). */
export const LSquare = createToken({ name: 'LSquare', pattern: /\[/ });
/** Right square bracket `]`. */
export const RSquare = createToken({ name: 'RSquare', pattern: /\]/ });
/** Left curly brace `{`. Used for object literals. */
export const LCurly = createToken({ name: 'LCurly', pattern: /\{/ });
/** Right curly brace `}`. */
export const RCurly = createToken({ name: 'RCurly', pattern: /\}/ });

// ---------------------------------------------------------------------------
// Punctuation and separators
// ---------------------------------------------------------------------------

/** Comma `,`. Separates function arguments, array elements, and object entries. */
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
/** Dot `.`. Path separator for field references (e.g. `group.field`) and postfix member access. */
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
/** Colon `:`. Separates keys from values in object literals and ternary false-branch. */
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
/** Single question mark `?`. Ternary operator (`cond ? a : b`). */
export const Question = createToken({ name: 'Question', pattern: /\?/ });
/** Double question mark `??`. Null-coalescing operator — returns the right operand when the left is null/undefined. */
export const DoubleQuestion = createToken({ name: 'DoubleQuestion', pattern: /\?\?/ });

// ---------------------------------------------------------------------------
// Comparison operators
// ---------------------------------------------------------------------------

/** Equality operator `=` or `==`. Both forms are accepted; FEL uses value equality. */
export const Equals = createToken({ name: 'Equals', pattern: /==?/ });
/** Inequality operator `!=`. */
export const NotEquals = createToken({ name: 'NotEquals', pattern: /!=/ });
/** Less-than-or-equal operator `<=`. Must precede {@link Less} in token order. */
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ });
/** Greater-than-or-equal operator `>=`. Must precede {@link Greater} in token order. */
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ });
/** Less-than operator `<`. */
export const Less = createToken({ name: 'Less', pattern: /</ });
/** Greater-than operator `>`. */
export const Greater = createToken({ name: 'Greater', pattern: />/ });

// ---------------------------------------------------------------------------
// Arithmetic operators
// ---------------------------------------------------------------------------

/** Addition operator `+`. Performs numeric addition. */
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
/** Subtraction / unary negation operator `-`. */
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
/** String concatenation operator `&`. Coerces both operands to strings before joining. */
export const Ampersand = createToken({ name: 'Ampersand', pattern: /&/ });
/** Multiplication operator `*`. Also used as a wildcard in path subscripts (`group[*].field`). */
export const Asterisk = createToken({ name: 'Asterisk', pattern: /\*/ });
/** Division operator `/`. */
export const Slash = createToken({ name: 'Slash', pattern: /\// });
/** Modulo (remainder) operator `%`. */
export const Percent = createToken({ name: 'Percent', pattern: /%/ });

// ---------------------------------------------------------------------------
// Special prefix characters
// ---------------------------------------------------------------------------

/** Dollar sign `$`. Prefixes relative field references that resolve from the current item's parent path. */
export const Dollar = createToken({ name: 'Dollar', pattern: /\$/ });
/** At sign `@`. Prefixes context references like `@index`, `@current`, `@count`, and user-defined variables. */
export const At = createToken({ name: 'At', pattern: /@/ });

/**
 * Ordered token array passed to the Chevrotain Lexer constructor.
 *
 * Order matters for disambiguation: tokens listed first win when multiple
 * patterns match at the same position. Key ordering constraints:
 * - DateTimeLiteral before DateLiteral (both start with `@` + digits)
 * - DateLiteral before NumberLiteral (the `@` prefix distinguishes dates)
 * - DoubleQuestion before Question (`??` vs `?`)
 * - LessEqual/GreaterEqual before Less/Greater (`<=` vs `<`)
 * - All keyword tokens (True, And, If, etc.) before Identifier
 * - Identifier is always last to act as a catch-all
 */
export const allTokens = [
  WhiteSpace,
  Comment,
  BlockComment,
  DateTimeLiteral,
  DateLiteral,
  NumberLiteral,
  StringLiteral,
  True,
  False,
  Null,
  And,
  Or,
  Not,
  In,
  If,
  Then,
  Else,
  Let,
  LRound,
  RRound,
  LSquare,
  RSquare,
  LCurly,
  RCurly,
  Comma,
  Dot,
  Colon,
  DoubleQuestion,
  Question,
  Equals,
  NotEquals,
  LessEqual,
  GreaterEqual,
  Less,
  Greater,
  Plus,
  Minus,
  Ampersand,
  Asterisk,
  Slash,
  Percent,
  Dollar,
  At,
  Identifier
];

/**
 * Pre-instantiated Chevrotain Lexer configured with all FEL token types.
 *
 * This singleton is the entry point for the first stage of the FEL pipeline.
 * Call `FelLexer.tokenize(input)` to produce a token vector that the
 * {@link parser} (stage 2) consumes to build a CST.
 */
export const FelLexer = new Lexer(allTokens);
