# FEL Normative Grammar (LLM Reference)

The normative PEG grammar for the Formspec Expression Language. Supersedes the informative grammar in the core spec §3.7. Defines syntax only; semantics are in the core spec §§3.2–3.12.

## Lexical Rules

**Whitespace/Comments**: Insignificant except inside strings. Line comments (`//`), block comments (`/* */`, non-nesting).

**Identifiers**: `[a-zA-Z_][a-zA-Z0-9_]*`, ASCII-only. Must not be a reserved word when used as function name (field keys with `$` prefix are exempt).

**Reserved words**: `true`, `false`, `null`, `and`, `or`, `not`, `in`, `if`, `then`, `else`, `let` — followed by non-identifier char.

**Strings**: Single or double quoted. Escapes: `\\`, `\'`, `\"`, `\n`, `\r`, `\t`, `\uXXXX`. Unrecognized escapes → syntax error.

**Numbers**: Optional `-`, integer part (no leading zeros except `0`), optional `.digits`, optional exponent. No leading dot (`.5` invalid), no trailing dot (`5.` invalid).

**Dates**: `@YYYY-MM-DD` (date), `@YYYY-MM-DDThh:mm:ss[Z|±hh:mm]` (datetime). DateTime tried before Date in ordered choice.

**Booleans/Null**: `true`, `false`, `null` — with trailing non-identifier lookahead.

## Expression Grammar (precedence encoded structurally)

```
Expression     ← _ LetExpr _
LetExpr        ← 'let' Identifier '=' LetValue 'in' LetExpr / IfExpr
IfExpr         ← 'if' Ternary 'then' IfExpr 'else' IfExpr / Ternary
Ternary        ← LogicalOr ('?' Expression ':' Expression)?
LogicalOr      ← LogicalAnd ('or' LogicalAnd)*
LogicalAnd     ← Equality ('and' Equality)*
Equality       ← Comparison (('!=' / '=') Comparison)*
Comparison     ← Membership (('<=' / '>=' / '<' / '>') Membership)*
Membership     ← NullCoalesce ('not' 'in' NullCoalesce / 'in' NullCoalesce)?
NullCoalesce   ← Addition ('??' Addition)*
Addition       ← Multiplication (('+' / '-' / '&') Multiplication)*
Multiplication ← Unary (('*' / '/' / '%') Unary)*
Unary          ← 'not' Unary / '-' Unary / Postfix
Postfix        ← Atom PathTail*
```

**Atoms**: `if(args)`, `func(args)`, `$field.path`, `{obj}`, `[arr]`, literal, `(expr)`.

**PathTail**: `.ident` or `[int | *]`.

## Operator Precedence (lowest → highest)

| Prec | Operators | Category | Assoc |
|------|-----------|----------|-------|
| 0 | `let…=…in…`, `if…then…else…` | Binding/Conditional | Right |
| 1 | `? :` | Ternary | Right |
| 2 | `or` | Logical OR | Left |
| 3 | `and` | Logical AND | Left |
| 4 | `=`, `!=` | Equality | Left |
| 5 | `<`, `>`, `<=`, `>=` | Comparison | Left |
| 6 | `in`, `not in` | Membership | Non-assoc |
| 7 | `??` | Null-coalescing | Left |
| 8 | `+`, `-`, `&` | Add/Concat | Left |
| 9 | `*`, `/`, `%` | Multiply | Left |
| 10 | `not`, `-` (unary) | Unary | Right |

Postfix (`.field`, `[index]`) binds tighter than all prefix operators.

## Path References

| Syntax | Meaning |
|--------|---------|
| `$` | Current context node (self) |
| `$ident` | Field from nearest scope |
| `$a.b.c` | Nested path through groups |
| `$a[n]` | 1-based index into repeat |
| `$a[*]` | All values across repeat (array) |
| `@current` | Current repeat instance |
| `@index` | 1-based position in repeat |
| `@count` | Total repeat instances |
| `@instance('name')` | Secondary data source |
| `@source`, `@target` | Mapping DSL bindings |

**Scoping**: Lexically scoped. Inside repeat, `$sibling` resolves within same instance. Index out of bounds → evaluation error. Unknown instance → definition error. Chaining allowed: `$a[1].nested[*].value`.

## Key Conformance Points

- `if(...)` parsed via special `IfCall` production (since `if` is reserved)
- Object literal duplicate keys → syntax error
- Array literal type homogeneity enforced at type-check time, not parse time
- `|>` (pipe) reserved for future use — must be rejected in v1.0
- Keyword operators (`and`, `or`, `not`, `in`) require non-identifier char after them (prevents `informal` from matching `in`)
