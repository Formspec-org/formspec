# WASM runtime — deeper Rust size trim (beyond `wasm_bindgen` features)

**Context:** Runtime `.wasm` uses `formspec-wasm` with `--no-default-features` (no `full-wasm`, no `formspec-lint`). Size is dominated by **`fel-core` + `formspec-eval` + `formspec-core`** code that still links for **`evaluateDefinition`**, FEL eval, coercion, migrations, option sets, screener — not by the removed JS glue modules.

**Baseline numbers** (post granular features, `wasm-opt -Os`): see [2026-03-23-wasm-split-baseline.md](../reviews/2026-03-23-wasm-split-baseline.md) — runtime **~1.67 MiB** raw, **~440 KiB** brotli.

## What still pulls weight (evidence)

### 1. Two regular-expression stacks

| Crate | Engine | Role on runtime path |
|-------|--------|----------------------|
| **`fel-core`** | `regex` | `prepare_host.rs` — fixed path/segment patterns; `evaluator.rs` — **dynamic** `RegexBuilder` for a user-facing builtin (pattern from expression). |
| **`formspec-eval`** | **`fancy-regex`** | `revalidate/items.rs` — **extension `pattern`** constraints (registry metadata); needs look-around / backrefs vs plain `regex`. |

So the runtime ships **both** `regex` + `fancy-regex` (+ their automata). Native proxy **`cargo bloat`** on `formspec-wasm-bloat-runtime` previously showed large **`regex_automata`** / related share — still directionally valid after feature gating.

**FEL lexer** (`fel-core` lexer) is **not** regex-driven — good; don’t assume “rewrite lexer” without profiling.

### 2. `formspec-core` in the eval pipeline

`formspec-eval` depends on **`formspec-core`** for item-tree walks, wire keys, registry version checks, JSON helpers, etc. **`schema_validator`** / `schema_validation_plan` are **pure Rust + serde** (host runs JSON Schema); they **do not** pull `jsonschema` into this repo. Unused `formspec-core` modules should **LTO-strip**, but monolithic `lib.rs` re-exports can still leave more object code linked than a split crate would — **measure before big refactors**.

### 3. No `jsonschema` on runtime path

`formspec-lint` (and its transitive **`jsonschema` / ICU** stack) is **optional** and **off** in the runtime build — already the largest win vs tools.

## Ranked opportunities (highest leverage first)

### A. `fancy-regex` scope (medium effort, potentially large)

- **Audit** extension/registry **`pattern`** strings in specs + fixtures: if production patterns are **`regex`-safe** (no look-around, no backrefs), switch constraint matching to **`regex::Regex`** and **drop `fancy-regex`** from `formspec-eval`.
- If some extensions require PCRE-style features, consider **splitting**: `regex` for common case + optional `fancy-regex` only when pattern fails `regex` compile (two code paths, still ship both until a policy says “extensions must be RE2-like”).
- **Tests:** conformance + extension constraint tests that use `PATTERN_MISMATCH` / email-style patterns.

### B. `fel-core` dynamic regex (lower effort, incremental)

- **`RegexBuilder::new(&pattern)`** in evaluator: ensure **strict size/time limits** (already has `size_limit`); add **compile cache** keyed by pattern string if profiling shows repeated compiles on hot paths.
- **Fixed patterns** in `prepare_host.rs`: compile **once** (`lazy_static` / `OnceLock`) instead of per-call if any path recompiles today.

### C. Crate split: `formspec-eval-runtime` vs full eval (high effort, architectural)

- Extract a **`formspec-eval-minimal`** (or feature `minimal`) that exposes only **`pipeline::evaluate_*`** and deps **strictly required** for batch eval — move lint-only or studio-only helpers out of the dependency closure.
- **Risk:** feature unification in Cargo workspaces; prefer **two crates** with a thin shared `formspec-eval-base` if the graph stays tangled.

### D. `formspec-core` modularization (medium effort)

- Replace “kitchen sink” internal use with **narrow paths** (e.g. `formspec_core::item_tree` only) so **unused** modules are not referenced from `formspec-eval` entry points — helps **LLVM dead-strip** even before a physical crate split.

### E. `wasm-opt` / Rust profile (low effort, tune)

- Try **`wasm-opt -Oz`**, **`opt-level = "z"`**, **`panic = "abort"`** for wasm target — remeasure brotli; watch **speed** regressions on eval.

## How to verify each step

1. **`twiggy diff`** runtime `.wasm` before/after: [scripts/twiggy-wasm.sh](../../scripts/twiggy-wasm.sh) `diff` (compare against a saved previous `.wasm` if not side-by-side in git).
2. **`cargo bloat --release -p formspec-wasm --bin formspec-wasm-bloat-runtime --no-default-features --crates`** — proxy for **crate-level** `.text` (host, not wasm bytes).
3. **Conformance:** `cargo test -p formspec-eval`, `cargo test -p fel-core`, `npm test` / `pytest` as appropriate for behavior changes.

## Suggested first slice

1. **Profile** extension `pattern` usage (grep registries + tests + spec examples).
2. If **≥90%** are plain regex: implement **`regex` fast path** + keep `fancy-regex` behind `cfg` or fallback only.
3. Re-record **raw/gzip/brotli** in the baseline doc.

---

**Status:** Research / backlog — not a committed roadmap. Update when a slice lands.
