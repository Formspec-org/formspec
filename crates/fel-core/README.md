# fel-core

Rust implementation of **Formspec Expression Language (FEL)** — lex, parse, evaluate, and analyze dependencies with **base-10 decimal** arithmetic (`rust_decimal`), aligned with Formspec core spec semantics.

## Scope

| Layer | Role |
|--------|------|
| **lexer** | Tokenize source with spans (chars + decimal literals). |
| **parser** | Recursive descent → `ast::Expr`. |
| **evaluator** | Tree walk, null propagation, builtins, `Environment` trait for `$` / `@` / MIPs. |
| **dependencies** | Static AST walk for field/context/MIP refs (no evaluation). |
| **types** | `FelValue`, dates, money. |
| **convert** | Canonical `serde_json::Value` ↔ `FelValue`. |
| **environment** | Full `FormspecEnvironment` for engine-style evaluation. |
| **extensions** | Optional `ExtensionRegistry` for host functions. |

Normative behavior is defined in the Formspec repo under `specs/fel/` and `schemas/`; this crate is a **reference-quality** engine for Rust callers (`formspec-core`, `formspec-eval`, WASM bridges, tests).

## Architecture

**Authoritative API detail** is `cargo doc -p fel-core --no-deps`. A **single-file Markdown mirror** of the same rustdoc (for editors and LLM context) is [`docs/rustdoc-md/API.md`](docs/rustdoc-md/API.md), produced by [cargo-doc-md](https://github.com/Crazytieguy/cargo-doc-md) plus `scripts/bundle-rustdoc-md.mjs`.

### Pipeline

```text
Source string
    → Lexer::tokenize → Vec<SpannedToken>
    → Parser::parse_expression → Expr (AST)
    → Evaluator::eval (or extract_dependencies for static analysis)
    → FelValue + Vec<Diagnostic>
```

- **Parse errors** surface as `FelError::Parse`.
- **Eval errors** usually produce `Diagnostic` entries and a null or partial value; some paths return `FelError::Eval`.

### Source modules (`src/`)

| File | Responsibility |
|------|----------------|
| `lib.rs` | Crate root, `#![warn(missing_docs)]` + `clippy::missing_docs_in_private_items`, re-exports, `tokenize` / JSON helpers for FFI. |
| `lexer.rs` | `Token`, `Lexer`, spans. |
| `parser.rs` | `parse()`, precedence per module doc comment. |
| `ast.rs` | `Expr`, `PathSegment`, operators. Large `Expr` enum uses `#[allow(missing_docs)]` on variants; see type-level rustdoc. |
| `evaluator.rs` | `Environment`, `MapEnvironment`, `Evaluator`, `evaluate()`. |
| `types.rs` | `FelValue`, `FelDate`, `FelMoney`, literals, date helpers. |
| `error.rs` | `FelError`, `Diagnostic`, `Severity`. |
| `dependencies.rs` | `Dependencies`, `extract_dependencies`, JSON wire helpers. |
| `environment.rs` | `FormspecEnvironment`, repeat + MIP + instances. |
| `context_json.rs` | `formspec_environment_from_json_map` for WASM-style payloads. |
| `convert.rs` | `json_to_fel`, `fel_to_json`, field maps. |
| `extensions.rs` | Built-in catalog metadata, `ExtensionRegistry`. |
| `printer.rs` | `print_expr` (AST → source). |
| `wire_style.rs` | `JsonWireStyle` for dependency JSON key casing. |

### Monorepo consumers

- **formspec-core** — FEL analysis, rewrites, shared types.
- **formspec-eval** — Batch definition evaluation.
- **formspec-wasm** (if present) — Thin FFI over `tokenize`, `parse`, `evaluate`, JSON helpers.

## For LLM assistants

Before answering questions about this crate’s API, behavior, or module layout:

1. Read this README (**Architecture** above for layout and pipeline).
2. Read [`docs/rustdoc-md/API.md`](docs/rustdoc-md/API.md) in full (bundled public rustdoc).

Skipping that file will miss public-item rustdoc that is not duplicated here.

## Quick start

```rust
use fel_core::{parse, evaluate, MapEnvironment, FelValue};
use std::collections::HashMap;
use rust_decimal::Decimal;

let expr = parse("$a + 1").unwrap();
let mut fields = HashMap::new();
fields.insert("a".into(), FelValue::Number(Decimal::from(2)));
let env = MapEnvironment::with_fields(fields);
let out = evaluate(&expr, &env);
assert_eq!(out.value, FelValue::Number(Decimal::from(3)));
```

## API documentation (rustdoc)

From the repo root:

```bash
cargo doc -p fel-core --no-deps --open
```

With **warnings as errors** for missing public docs (CI-style):

```bash
RUSTDOCFLAGS='-D missing_docs' cargo doc -p fel-core --no-deps
```

### Markdown export (from doc comments)

One-time install:

```bash
cargo install cargo-doc-md
```

Regenerate HTML + bundled Markdown:

```bash
npm run docs:fel-core
```

This runs `cargo doc-md` into `target/doc-md-fel-core`, `scripts/bundle-rustdoc-md.mjs` → `docs/rustdoc-md/API.md`, then `cargo doc -p fel-core --no-deps`.

## Internal (private) documentation

`src/lib.rs` enables **`clippy::missing_docs_in_private_items`** (with **`#![warn(missing_docs)]`**) so private helpers are covered in CI-style `cargo clippy`.

- **Narrative + allow** — Large internal pipelines (`lexer`, `parser`, `evaluator`, `dependencies`, `environment`, `extensions`, `printer`, `context_json`) extend the module `//!` with a short internal overview and use `#![allow(clippy::missing_docs_in_private_items)]` so lexer/parser/evaluator internals are not each annotated with `///`.
- **Tests** — Each `#[cfg(test)] mod tests` uses `#![allow(clippy::missing_docs_in_private_items)]` for helper fns inside suites.

Strict check (lint only this crate):

```bash
cargo clippy -p fel-core --no-deps -- -D clippy::missing_docs_in_private_items
```

## Tests

```bash
cargo test -p fel-core
```

Integration-style suites live under `crates/fel-core/tests/`.

## License

Apache-2.0 — see [LICENSE](../../LICENSE) and [LICENSING.md](../../LICENSING.md).
