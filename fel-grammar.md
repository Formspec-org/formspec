# Formspec Expression Language (FEL) — Normative Grammar

**Version:** 1.0 
**Status:** Normative companion to Formspec v1.0 §3

---

## 1. Introduction

This document defines the **normative** Parsing Expression Grammar (PEG) for
the Formspec Expression Language (FEL). It is a companion to the Formspec
specification v1.0 §3 and supersedes the **informative** grammar given in §3.7
of that specification.

A conformant FEL parser MUST accept exactly the language described by this
grammar. The semantics of each construct are defined in §§3.2–3.12 of the
Formspec specification; this document defines only the syntax.

## 2. Notation

This grammar uses the Parsing Expression Grammar (PEG) formalism as defined by
Bryan Ford in *"Parsing Expression Grammars: A Recognition-Based Syntactic
Foundation"* (POPL 2004). PEGs are unambiguous by construction: for every
input there is at most one valid parse tree.

The following notation conventions are used throughout:

| Notation | Meaning |
|----------|------------------------------------------|
| `'text'` | Literal string match |
| `[a-z]` | Character class (any character in range) |
| `e1 e2` | Sequence: match `e1` then `e2` |
| `e1 / e2`| Ordered choice: try `e1`; if it fails, try `e2` |
| `e*` | Zero or more repetitions of `e` |
| `e+` | One or more repetitions of `e` |
| `e?` | Optional: zero or one occurrence of `e` |
| `!e` | Negative lookahead: succeeds iff `e` fails; consumes no input |
| `&e` | Positive lookahead: succeeds iff `e` succeeds; consumes no input |
| `( )` | Grouping |
| `{n}` | Exactly `n` repetitions |
| `.` | Any single character |

Non-terminals are written in `PascalCase`. Terminals (literal strings and
character classes) appear inline. Rule definitions use the `←` arrow.

## 3. Lexical Grammar

The lexical grammar defines the low-level tokens of FEL. These rules are
referenced by the expression grammar in §4.

### 3.1 Whitespace and Comments

Whitespace and comments are **insignificant** except inside string literals.
The `_` production matches optional whitespace and/or comments and may appear
between any two tokens.

```peg
_              ← (Whitespace / Comment)*
Whitespace     ← [ \t\n\r]
Comment        ← LineComment / BlockComment
LineComment    ← '//' (!LineTerminator .)* LineTerminator?
BlockComment   ← '/*' (!'*/' .)* '*/'
LineTerminator ← '\n' / '\r\n' / '\r'
```

Block comments do **not** nest. The input `/* a /* b */ c */` is a block
comment `/* a /* b */` followed by the tokens `c`, `*`, `/`.

### 3.2 Identifiers

Identifiers are ASCII-only in FEL v1.0.

```peg
Identifier     ← !ReservedWord [a-zA-Z_] [a-zA-Z0-9_]*
```

An identifier MUST NOT be a reserved word (§3.5) when used as a function name.
Field keys referenced via `$` are not subject to this restriction because the
`$` sigil disambiguates them.

### 3.3 Reserved Words

The following words are reserved. They MUST NOT be used as function names
(built-in or extension).

```peg
ReservedWord   ← ('true' / 'false' / 'null'
               /  'and' / 'or' / 'not' / 'in'
               /  'if' / 'then' / 'else' / 'let')
                  ![a-zA-Z0-9_]
```

The trailing negative lookahead ensures that identifiers such as `notify` or
`informal` are not incorrectly matched as containing a reserved word.

### 3.4 String Literals

FEL supports single-quoted and double-quoted strings with escape sequences.

```peg
StringSQ       ← '\'' (EscapeSeq / !('\'' / '\\') .)* '\''
StringDQ       ← '"' (EscapeSeq / !('"' / '\\') .)* '"'
StringLiteral  ← StringDQ / StringSQ

EscapeSeq      ← '\\' [\\'"nrt]
               / '\\u' HexDigit{4}
HexDigit       ← [0-9a-fA-F]
```

Defined escape sequences:

| Escape | Character |
|--------|-----------|
| `\\` | Backslash (`U+005C`) |
| `\'` | Single quote (`U+0027`) |
| `\"` | Double quote (`U+0022`) |
| `\n` | Line feed (`U+000A`) |
| `\r` | Carriage return (`U+000D`) |
| `\t` | Horizontal tab (`U+0009`) |
| `\uXXXX` | Unicode code point (4 hex digits) |

An unrecognised escape sequence (e.g., `\a`) is a syntax error.

### 3.5 Number Literals

```peg
NumberLiteral  ← '-'? IntegerPart ('.' [0-9]+)? Exponent?
IntegerPart    ← '0' / [1-9] [0-9]*
Exponent       ← ('e' / 'E') ('+' / '-')? [0-9]+
```

- A leading dot is **not** permitted: `.5` is invalid; write `0.5`.
- A trailing dot is **not** permitted: `5.` is invalid; write `5` or `5.0`.
- A bare minus sign is the unary negation operator, not part of a number
  literal. However, the grammar allows a leading `-` on `NumberLiteral` so
  that negative constants are parsed as a single token in literal position.

### 3.6 Date and DateTime Literals

```peg
DateTimeLiteral ← '@' Digit{4} '-' Digit{2} '-' Digit{2} 'T'
                   Digit{2} ':' Digit{2} ':' Digit{2}
                   TimeZone?
DateLiteral     ← '@' Digit{4} '-' Digit{2} '-' Digit{2}

TimeZone        ← 'Z' / [+-] Digit{2} ':' Digit{2}
Digit           ← [0-9]
```

Note: `DateTimeLiteral` MUST be tried before `DateLiteral` (ordered choice)
to avoid partial matching.

### 3.7 Boolean and Null Literals

```peg
BooleanLiteral ← 'true' / 'false'
NullLiteral    ← 'null'
```

These are listed under `ReservedWord` (§3.3) and the trailing `![a-zA-Z0-9_]`
lookahead applies to prevent `trueValue` from being parsed as `true` + `Value`.

### 3.8 Integer (Array Index)

```peg
Integer        ← [0-9]+
```

Used only in array-index position within path expressions.

## 4. Expression Grammar

The expression grammar defines the full syntax of FEL expressions. Operator
precedence is encoded structurally: lower-precedence operators appear higher
in the grammar (closer to the start symbol).

```peg
# ============================================================
# Formspec Expression Language (FEL) — Normative PEG Grammar
# Version 1.0
# ============================================================

Expression     ← _ LetExpr _

# --- Let binding ---
LetExpr        ← 'let' _ Identifier _ '=' _ LetExpr _ 'in' _ LetExpr
               / IfExpr

# --- If-then-else (keyword form) ---
IfExpr         ← 'if' _ Ternary _ 'then' _ IfExpr _ 'else' _ IfExpr
               / Ternary

# --- Ternary conditional (precedence 1, right-associative) ---
Ternary        ← LogicalOr (_ '?' _ Expression _ ':' _ Expression)?

# --- Logical OR (precedence 2, left-associative) ---
LogicalOr      ← LogicalAnd (_ 'or' !IdContinue _ LogicalAnd)*

# --- Logical AND (precedence 3, left-associative) ---
LogicalAnd     ← Equality (_ 'and' !IdContinue _ Equality)*

# --- Equality (precedence 4, left-associative) ---
Equality       ← Comparison ((_ '!=' / _ '=') _ Comparison)*

# --- Comparison (precedence 5, left-associative) ---
Comparison     ← Membership ((_ '<=' / _ '>=' / _ '<' / _ '>') _ Membership)*

# --- Membership (precedence 6, non-associative) ---
Membership     ← NullCoalesce (_ 'not' _ 'in' _ NullCoalesce
                              / _ 'in' !IdContinue _ NullCoalesce)?

# --- Null-coalescing (precedence 7, left-associative) ---
NullCoalesce   ← Addition (_ '??' _ Addition)*

# --- Addition / concatenation (precedence 8, left-associative) ---
Addition       ← Multiplication ((_ '+' / _ '-' / _ '&') _ Multiplication)*

# --- Multiplication (precedence 9, left-associative) ---
Multiplication ← Unary ((_ '*' / _ '/' / _ '%') _ Unary)*

# --- Unary prefix (precedence 10, right-associative) ---
Unary          ← 'not' !IdContinue _ Unary
               / Atom

# --- Atoms ---
Atom           ← FunctionCall
               / FieldRef
               / ObjectLiteral
               / ArrayLiteral
               / Literal
               / '(' _ Expression _ ')'

# --- Helper: identifier-continue character ---
IdContinue     ← [a-zA-Z0-9_]
```

### 4.1 Function Calls

```peg
FunctionCall   ← Identifier '(' _ ArgList? _ ')'
ArgList        ← Expression (_ ',' _ Expression)*
```

The function name is an `Identifier` and MUST NOT be a reserved word (§3.3).
Note: `if(cond, a, b)` is a built-in function call, **not** the keyword
`if-then-else` form — the opening parenthesis disambiguates.

### 4.2 Object Literals

```peg
ObjectLiteral  ← '{' _ ObjectEntries? _ '}'
ObjectEntries  ← ObjectEntry (_ ',' _ ObjectEntry)*
ObjectEntry    ← ObjectKey _ ':' _ Expression
ObjectKey      ← Identifier / StringLiteral
```

Object literal keys are either bare identifiers or string literals. Duplicate
keys within a single object literal are a syntax error.

### 4.3 Array Literals

```peg
ArrayLiteral   ← '[' _ (Expression (_ ',' _ Expression)*)? _ ']'
```

All elements of an array literal MUST be of the same type (enforced during
type checking, not at the grammar level).

### 4.4 Literals

```peg
Literal        ← DateTimeLiteral
               / DateLiteral
               / NumberLiteral
               / StringLiteral
               / BooleanLiteral !IdContinue
               / NullLiteral !IdContinue
```

`DateTimeLiteral` MUST be tried before `DateLiteral` (ordered choice) to
prevent the date prefix from matching prematurely.

## 5. Operator Precedence Table

The following table lists all FEL operators from **lowest** to **highest**
precedence. This table is normative and matches the structural encoding in §4.

| Prec. | Operator(s) | Category | Assoc. | Example |
|:-----:|-------------|----------|:------:|------------------------------------------|
| 0 | `let … = … in …` | Binding | Right | `let x = 1 in x + 2` |
| 0 | `if … then … else …` | Conditional | Right | `if $a then 'yes' else 'no'` |
| 1 | `? :` | Ternary | Right | `$a > 0 ? 'pos' : 'neg'` |
| 2 | `or` | Logical OR | Left | `$a or $b` |
| 3 | `and` | Logical AND | Left | `$a and $b` |
| 4 | `=` `!=` | Equality | Left | `$x = 5` |
| 5 | `<` `>` `<=` `>=` | Comparison | Left | `$age >= 18` |
| 6 | `in` `not in` | Membership | Non | `$s in ['a','b']` |
| 7 | `??` | Null-coalescing| Left | `$x ?? 0` |
| 8 | `+` `-` `&` | Add / Concat | Left | `$a + $b`, `$s & '!'` |
| 9 | `*` `/` `%` | Multiply | Left | `$a * $b` |
| 10 | `not` (prefix) | Logical NOT | Right | `not $flag` |

Parenthesised sub-expressions (`( … )`) override precedence as usual.

## 6. Path Expressions

Path expressions reference Instance data. They are **not** general
expressions — they appear as atoms in the expression grammar.

```peg
FieldRef       ← '$' Identifier PathTail*
               / '$'
               / ContextRef

PathTail       ← '.' Identifier
               / '[' _ ( Integer / '*' ) _ ']'

ContextRef     ← '@' Identifier ('(' _ StringLiteral _ ')')? ('.' Identifier)*
```

### 6.1 Reference Forms

| Syntax | Description | Example |
|--------|-------------|---------|
| `$` | Current context node (self-reference). | `$ > 0` |
| `$ident` | Field reference resolved from nearest scope. | `$firstName` |
| `$a.b.c` | Nested field path through groups. | `$address.city` |
| `$a[n]` | 1-based index into a repeat collection. | `$items[1].name` |
| `$a[*]` | Wildcard — array of all values across repeat instances. | `sum($items[*].amt)` |
| `$a[n].b` | Field within indexed repeat instance. | `$items[2].qty` |
| `$a[*].b` | Field across all repeat instances (produces array). | `$items[*].qty` |
| `@current` | Explicit reference to the current repeat instance. | `@current.amount` |
| `@index` | 1-based position of current repeat instance. | `@index = 1` |
| `@count` | Total instances in current repeat collection. | `@count >= 1` |
| `@instance('n')` | Secondary data-source instance. | `@instance('prior').income` |
| `@source` | Source binding in mapping DSL. | `@source.fieldA` |
| `@target` | Target binding in mapping DSL. | `@target.fieldB` |

### 6.2 Path Resolution Rules

1. **Scope:** Field references are lexically scoped. Inside a repeatable
   group, `$sibling` resolves within the **same repeat instance**.
2. **Index bounds:** An explicit index `$repeat[n]` where `n < 1` or
   `n >` the number of instances MUST signal an evaluation error.
3. **Instance lookup:** `@instance('name')` MUST match a declared Data Source.
   If the named instance does not exist, the processor MUST signal a
   definition error.
4. **Chaining:** Dot-segments after an indexed or wildcard subscript continue
   path resolution into the selected object(s). Multiple subscripts may be
   chained: `$a[1].nested[*].value` is valid.

## 7. Conformance

A conformant FEL parser:

1. **MUST** accept all input strings that match the `Expression` production of
   this grammar.
2. **MUST** reject all input strings that do not match the `Expression`
   production. Rejection MUST include a diagnostic indicating the approximate
   position of the syntax error.
3. **MUST** treat whitespace and comments as insignificant except inside string
   literals.
4. **MUST** implement all escape sequences defined in §3.4. An unrecognised
   escape sequence MUST be rejected as a syntax error.
5. **MUST** enforce the reserved-word restriction in §3.3: reserved words MUST
   NOT be accepted as function names.
6. **MUST** parse the `|>` (pipe) character sequence as a syntax error in
   v1.0. This token is reserved for future use.
7. **SHOULD** produce a parse tree (or equivalent AST) that preserves the
   precedence and associativity encoded in this grammar. The parse tree
   structure determines evaluation order as specified in §3.3 and §3.8–3.10
   of the Formspec specification.

---

*End of normative grammar.*
