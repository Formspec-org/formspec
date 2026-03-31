# FEL Grammar Specification Reference Map

> specs/fel/fel-grammar.md -- 395 lines, ~14K -- Companion: Normative FEL Grammar (PEG)

## Overview

This document defines the **normative Parsing Expression Grammar (PEG)** for the Formspec Expression Language (FEL). It is the authoritative syntax specification, superseding the informative grammar in Formspec v1.0 section 3.7. It defines syntax only -- all semantics (evaluation rules, type coercion, function behavior) are specified in sections 3.2-3.12 of the core Formspec specification. A conformant parser MUST accept exactly this language and reject everything else.

## Section Map

### Preamble and Notation (Lines 1-44)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1 | Introduction | Establishes this grammar as the normative PEG companion to Formspec v1.0 section 3. States it supersedes the informative grammar in section 3.7. | PEG formalism, normative vs informative, companion spec | Determining which grammar document is authoritative; understanding relationship to core spec |
| 2 | Notation | Explains the PEG notation conventions used throughout the grammar: literal matching, character classes, sequence, ordered choice, repetition, lookahead, grouping, exact repetition. | PEG operators (`/` ordered choice, `!` negative lookahead, `&` positive lookahead, `{n}` exact repetition, `.` any character), PascalCase non-terminals, `<-` rule arrow | Reading or writing any grammar production rule; understanding what PEG operators mean |

### Lexical Grammar (Lines 46-170)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Lexical Grammar | Introduces the low-level token definitions that the expression grammar (section 4) references. Parent section for all token types. | Tokens, lexical rules | Understanding the tokenization layer before expression parsing |
| 3.1 | Whitespace and Comments | Defines whitespace (`_` production) as insignificant between tokens. Supports `//` line comments and `/* */` block comments. Block comments do NOT nest. | `_` production, LineComment, BlockComment, non-nesting block comments, LineTerminator | Implementing tokenizer whitespace/comment skipping; debugging comment-related parse issues |
| 3.2 | Identifiers | Identifiers are ASCII-only: `[a-zA-Z_][a-zA-Z0-9_]*`. Must not collide with reserved words when used as function names. `$`-prefixed field references are exempt from the reserved word restriction because the sigil disambiguates. | Identifier production, ASCII-only restriction, `$` sigil exemption, `!ReservedWord` guard | Validating function names; understanding why `$true` is a valid field reference but `true()` is not a valid function call |
| 3.3 | Reserved Words | Lists all 11 reserved words: `true`, `false`, `null`, `and`, `or`, `not`, `in`, `if`, `then`, `else`, `let`. Uses trailing `![a-zA-Z0-9_]` negative lookahead to prevent matching prefixes of longer identifiers. | ReservedWord production, word-boundary lookahead, 11 reserved words | Checking if a new function name is valid; understanding why `notify` parses as an identifier not `not` + `ify` |
| 3.4 | String Literals | Supports single-quoted and double-quoted strings with identical escape handling. Defines 7 escape sequences: `\\`, `\'`, `\"`, `\n`, `\r`, `\t`, `\uXXXX`. Unrecognized escape sequences are syntax errors. | StringSQ, StringDQ, StringLiteral, EscapeSeq, HexDigit, `\uXXXX` unicode escapes, unrecognized escape = error | Implementing string parsing; handling escape sequences; debugging string literal errors |
| 3.5 | Number Literals | Defines numeric syntax: optional leading `-`, integer or decimal, optional exponent. No leading dot (`.5` invalid), no trailing dot (`5.` invalid). Leading `-` allowed on literals but is also the unary negation operator. | NumberLiteral, IntegerPart, Exponent, no leading/trailing dot, `0` / `[1-9][0-9]*` integer forms | Implementing number tokenization; understanding why `.5` is rejected; distinguishing negation from negative literal |
| 3.6 | Date and DateTime Literals | Defines `@YYYY-MM-DD` date literals and `@YYYY-MM-DDThh:mm:ss[Z/+-hh:mm]` datetime literals. `DateTimeLiteral` MUST be tried before `DateLiteral` (ordered choice) to avoid partial match. | DateLiteral, DateTimeLiteral, TimeZone, Digit, `@` prefix, ordered choice requirement, `Z` / `+-HH:MM` timezone | Implementing date/datetime tokenization; debugging partial date matches; understanding the `@` prefix on dates vs `@` on context refs |
| 3.7 | Boolean and Null Literals | `true`, `false`, `null` -- subject to the reserved word trailing lookahead. `trueValue` parses as identifier, not `true` + `Value`. | BooleanLiteral, NullLiteral, word-boundary disambiguation, `!IdContinue` | Understanding literal parsing; debugging identifier vs keyword conflicts |
| 3.8 | Integer (Array Index) | `[0-9]+` -- used exclusively in array-index position within path expressions (e.g., `$items[1]`). Distinct from NumberLiteral (no sign, no decimal, no exponent). | Integer production, array index context | Implementing path subscript parsing; understanding difference from NumberLiteral |

### Expression Grammar (Lines 171-297)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Expression Grammar | Defines the full expression syntax with operator precedence encoded structurally (lower precedence = higher in grammar). Contains the complete PEG from `Expression` start symbol down through `Atom`. The `LetValue` production restricts `in` membership operator in let-value position to avoid ambiguity with `let ... in` keyword. | Expression start symbol, precedence encoding, LetExpr, LetValue, IfExpr, Ternary, LogicalOr, LogicalAnd, Equality, Comparison, Membership, NullCoalesce, Addition, Multiplication, Unary, Postfix, Atom, IdContinue, `!` bang prefix | Implementing the expression parser; understanding precedence; tracing parse ambiguities; understanding LetValue restriction |
| 4.1 | Function Calls | `IfCall` handles `if(cond, a, b)` as a special production since `if` is reserved and cannot match `Identifier`. All other functions use `Identifier '(' ArgList? ')'`. Parser MUST try `IfCall` before `FunctionCall`. The opening parenthesis disambiguates `if(...)` from `if ... then ... else ...`. | IfCall, FunctionCall, ArgList, `if()` disambiguation from `if...then...else` | Implementing function call parsing; understanding why `if` gets special treatment; adding new built-in functions |
| 4.2 | Object Literals | `{ key: value, ... }` syntax. Keys are bare identifiers or string literals. Duplicate keys within a single object literal are a syntax error. | ObjectLiteral, ObjectEntries, ObjectEntry, ObjectKey, duplicate key prohibition | Implementing object literal parsing; validating object keys |
| 4.3 | Array Literals | `[expr, expr, ...]` syntax. All elements MUST be the same type (enforced during type checking, not at grammar level). | ArrayLiteral, homogeneous type constraint (semantic not syntactic) | Implementing array literal parsing; understanding type-check vs parse-time constraints |
| 4.4 | Literals | Ordered choice over all literal types. `DateTimeLiteral` MUST be tried before `DateLiteral`. Boolean and null literals require `!IdContinue` lookahead to prevent matching keyword prefixes in longer identifiers. | Literal production, ordered choice priority, `!IdContinue` guard | Understanding literal parse priority; debugging ambiguous literal matches |

### Operator Precedence (Lines 299-321)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Operator Precedence Table | Normative table listing all operators from lowest (0) to highest (10) precedence with associativity. Postfix (`.field`, `[index]`) binds tighter than all prefix operators. Parenthesized sub-expressions override precedence. | 11 precedence levels (0-10), associativity (Left/Right/Non), postfix tightest binding | Quick-reference for precedence questions; verifying parser correctness; understanding expression grouping |

### Path Expressions (Lines 323-369)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | Path Expressions | Defines `FieldRef` (`$ident` paths), `PathTail` (`.ident` and `[n]`/`[*]` subscripts), and `ContextRef` (`@ident` references). These are atoms in the expression grammar, not general expressions. | FieldRef, PathTail, ContextRef, `$` field sigil, `@` context sigil, `[*]` wildcard, `[n]` indexed | Implementing path reference parsing; understanding field/variable/instance resolution |
| 6.1 | Reference Forms | Complete table of all 14 reference syntaxes: 7 field reference forms (`$`, `$ident`, `$a.b.c`, `$a[n]`, `$a[*]`, `$a[n].b`, `$a[*].b`) and 7 context reference forms (`@current`, `@index`, `@count`, `@name`, `@instance('n')`, `@source`, `@target`). | Self-reference `$`, nested paths, 1-based indexing, wildcard arrays, repeat context vars (`@current`, `@index`, `@count`), named variables (`@name`), instance lookup (`@instance`), mapping bindings (`@source`, `@target`) | Quick-reference for all path forms; implementing path resolution; understanding what each `@` context variable means |
| 6.2 | Path Resolution Rules | Four normative rules: (1) lexical scoping inside repeat groups, (2) 1-based index bounds checking with error on out-of-bounds, (3) `@instance('name')` must match a declared Data Source, (4) dot-segment chaining after subscripts enables multi-subscript paths. | Lexical scoping, 1-based indexing, out-of-bounds = evaluation error, instance lookup validation, multi-subscript chaining (`$a[1].nested[*].value`) | Implementing path resolution logic; debugging scope issues in repeating groups; handling index errors |

### Conformance (Lines 371-395)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Conformance | Seven normative MUST/SHOULD requirements for a conformant FEL parser: accept valid input, reject invalid with diagnostic position, insignificant whitespace, all escape sequences, reserved word enforcement, `\|>` pipe reserved for future use, precedence-preserving parse tree. | Conformance checklist, `\|>` pipe reservation, diagnostic requirement, 7 conformance rules | Verifying parser conformance; understanding what "compliant" means; checking future-reserved tokens |

## Cross-References

| Reference | Context |
|-----------|---------|
| Formspec v1.0 section 3 | This grammar is a companion to the FEL section of the core spec. All semantics are defined there. |
| Formspec v1.0 section 3.7 | The informative grammar in the core spec that this document supersedes. |
| Formspec v1.0 sections 3.2-3.12 | Semantics of each construct (evaluation, type rules, functions, etc.) |
| Formspec v1.0 section 3.3 | Parse tree structure determines evaluation order (referenced in conformance rule 7) |
| Formspec v1.0 sections 3.8-3.10 | Parse tree structure determines evaluation order (referenced in conformance rule 7) |
| Bryan Ford, "Parsing Expression Grammars: A Recognition-Based Syntactic Foundation" (POPL 2004) | The PEG formalism this grammar is based on; cited in section 2 |

## Operator Precedence Table

From lowest to highest precedence (normative):

| Prec. | Operator(s) | Category | Assoc. | Example |
|:-----:|-------------|----------|:------:|---------|
| 0 | `let ... = ... in ...` | Binding | Right | `let x = 1 in x + 2` |
| 0 | `if ... then ... else ...` | Conditional | Right | `if $a then 'yes' else 'no'` |
| 1 | `? :` | Ternary | Right | `$a > 0 ? 'pos' : 'neg'` |
| 2 | `or` | Logical OR | Left | `$a or $b` |
| 3 | `and` | Logical AND | Left | `$a and $b` |
| 4 | `=` `!=` | Equality | Left | `$x = 5` |
| 5 | `<` `>` `<=` `>=` | Comparison | Left | `$age >= 18` |
| 6 | `in` `not in` | Membership | Non | `$s in ['a','b']` |
| 7 | `??` | Null-coalescing | Left | `$x ?? 0` |
| 8 | `+` `-` `&` | Add / Concat | Left | `$a + $b`, `$s & '!'` |
| 9 | `*` `/` `%` | Multiply | Left | `$a * $b` |
| 10 | `not` / `!` (prefix), `-` (negate) | Unary | Right | `not $flag`, `!$flag`, `-$x` |

Postfix operators (`.field`, `[index]`) bind tighter than all prefix operators. Parenthesized sub-expressions override precedence.

## Path Reference Forms

### Field References (`$` sigil)

| Syntax | Description | Example |
|--------|-------------|---------|
| `$` | Current context node (self-reference) | `$ > 0` |
| `$ident` | Field reference resolved from nearest scope | `$firstName` |
| `$a.b.c` | Nested field path through groups | `$address.city` |
| `$a[n]` | 1-based index into a repeat collection | `$items[1].name` |
| `$a[*]` | Wildcard -- array of all values across repeat instances | `sum($items[*].amt)` |
| `$a[n].b` | Field within indexed repeat instance | `$items[2].qty` |
| `$a[*].b` | Field across all repeat instances (produces array) | `$items[*].qty` |

### Context References (`@` sigil)

| Syntax | Description | Example |
|--------|-------------|---------|
| `@current` | Explicit reference to the current repeat instance | `@current.amount` |
| `@index` | 1-based position of current repeat instance | `@index = 1` |
| `@count` | Total instances in current repeat collection | `@count >= 1` |
| `@name` | Value of a named variable declared in `variables` | `@total` |
| `@instance('n')` | Secondary data-source instance | `@instance('prior').income` |
| `@source` | Source binding in mapping DSL | `@source.fieldA` |
| `@target` | Target binding in mapping DSL | `@target.fieldB` |

### Grammar Productions

```
FieldRef    <- '$' Identifier PathTail*
             / '$'
             / ContextRef

PathTail    <- '.' Identifier
             / '[' _ ( Integer / '*' ) _ ']'

ContextRef  <- '@' Identifier ('(' _ StringLiteral _ ')')? ('.' Identifier)*
```

## Critical Behavioral Rules

### Reserved Words
1. 11 reserved words: `true`, `false`, `null`, `and`, `or`, `not`, `in`, `if`, `then`, `else`, `let`.
2. Reserved words MUST NOT be used as function names (built-in or extension).
3. `$`-prefixed field references are exempt: `$true` is a valid field reference because the `$` sigil disambiguates.
4. Trailing lookahead `![a-zA-Z0-9_]` prevents matching reserved word prefixes in longer identifiers (e.g., `notify` is NOT parsed as `not` + `ify`).

### Null Propagation
5. Semantics for null are defined in core spec sections 3.2-3.12, not in this grammar.
6. The `??` null-coalescing operator at precedence 7 is the grammar-level mechanism for null handling.

### String Escaping
7. 7 recognized escape sequences: `\\`, `\'`, `\"`, `\n`, `\r`, `\t`, `\uXXXX`.
8. Unrecognized escape sequences (e.g., `\a`, `\b`, `\0`) are **syntax errors**, not pass-through.
9. Both single-quoted and double-quoted strings are supported with identical escape handling.

### Date Literal Format
10. Dates use `@` prefix: `@2024-01-15` (date), `@2024-01-15T09:30:00Z` (datetime).
11. The `@` prefix is shared with context references (`@current`, `@index`, etc.) -- the parser disambiguates by what follows.
12. `DateTimeLiteral` MUST be tried before `DateLiteral` in ordered choice to avoid partial matching.
13. Timezone is optional: `Z` for UTC, or `+HH:MM` / `-HH:MM` offset.

### Number Format Restrictions
14. No leading dot: `.5` is invalid (write `0.5`).
15. No trailing dot: `5.` is invalid (write `5` or `5.0`).
16. Leading `-` is allowed on number literals in literal position but is also the unary negation operator.
17. Exponent notation supported: `1e10`, `2.5E-3`.

### Equality Operator
18. FEL uses single `=` for equality (not `==`). Inequality is `!=`.
19. There is no assignment operator in FEL expressions (assignment only exists in `let` bindings using `=`).

### Let Binding Restriction
20. The `in` membership operator is NOT available as a bare operator in let-value position due to ambiguity with the `let ... in` keyword.
21. Workaround: parenthesize the membership test: `let x = (1 in $arr) in ...`.

### Block Comments
22. Block comments `/* ... */` do NOT nest.
23. `/* a /* b */ c */` parses as the comment `/* a /* b */` followed by tokens `c`, `*`, `/`.

### Membership Operator
24. `in` and `not in` are **non-associative** at precedence 6 (only one per expression level).
25. The `not in` form is two keywords: `not` followed by `in`.

### Array Type Homogeneity
26. All elements of an array literal MUST be of the same type -- but this is enforced at type-check time, not parse time.

### Object Literal Keys
27. Duplicate keys within a single object literal are a syntax error.
28. Keys can be bare identifiers or string literals.

### Future Reserved Token
29. The `|>` (pipe) character sequence MUST be rejected as a syntax error in v1.0. It is reserved for future use.

### Indexing
30. Array/repeat indices are **1-based** (not 0-based).
31. Out-of-bounds index (`n < 1` or `n > instance count`) MUST signal an evaluation error.
32. Wildcard `[*]` produces an array of all values across repeat instances.

### Postfix Binding
33. Postfix operators (`.field`, `[index]`) bind tighter than ALL prefix operators.
34. This enables patterns like `prev().field` and `(expr).field`.

### Function Call Disambiguation
35. `if(cond, a, b)` requires a special `IfCall` production because `if` is a reserved word and cannot match `Identifier` in `FunctionCall`. The parser MUST try `IfCall` before `FunctionCall`.
36. The opening parenthesis after `if` disambiguates function-call form from keyword conditional form.

### Unary Prefix Operators
37. Three unary prefix operators exist at precedence 10: `not`, `!` (bang, synonym for not), and `-` (negation).
38. The `!` bang operator is in the grammar (Unary production) and the precedence table but is easily overlooked.

### Conformance Diagnostics
39. Rejection of invalid input MUST include a diagnostic indicating the approximate position of the syntax error -- silent failure is non-conformant.
40. A conformant parser SHOULD produce a parse tree that preserves precedence and associativity as encoded in this grammar.
