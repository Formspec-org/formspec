# Rust Crate Reconciliation Plan

**Goal:** Bring the valuable logic from `rust_merged` into `main` by reading the diff and writing new code against `main`'s current architecture. No git merge — `rust_merged` is read-only reference material.

**Spec review (2026-03-18):** All error codes verified against Python reference linter and normative specs. Six gaps identified — see "Known Gaps" section.

## Current State

**`main`** (compiles, 239 tests pass via `--lib` + `evaluator_tests`):
- `fel-core`: 11 source files including printer — **complete, no touch**
- `formspec-core`: 7 source files — **complete, no touch**
- `formspec-eval`: 1 file (`lib.rs` with 28 tests, topo sort, inheritance, NRB, wildcards) — **no touch**
- `formspec-lint`: 3 files (`lib.rs`/`passes.rs`/`types.rs` with 27 tests, pass gating, LintMode, E302/W300/E600) — **this is what we're extending**
- `formspec-wasm`: 1 file — **complete, no touch**
- `formspec-py`: 1 file — **complete, no touch**

**`rust_merged`** is reference material only. It contains deeper lint pass logic from a prior session that never made it to `main`. We will diff it, understand the intent, and rewrite against `main`'s types and orchestrator.

### What `rust_merged` has that `main` doesn't

These files exist only on `rust_merged`. Read them for logic and test cases, but don't copy them verbatim — they use old types (`diagnostic::LintDiagnostic`, `policy::LintMode`) that `main` has superseded.

| File | Lines | What to extract |
|------|-------|-----------------|
| `formspec-lint/src/component_matrix.rs` | 225 | 12 input component compatibility rules (strict/authoring), optionSet requirement flags |
| `formspec-lint/src/pass_component.rs` | 803 | E800-E807, W800-W804 logic. Custom component cycles, Wizard children, bind resolution |
| `formspec-lint/src/pass_theme.rs` | 586 | W700-W711, E710 logic. Token value validation, cross-artifact checks, page semantics |
| `formspec-lint/src/dependencies.rs` | 178 | E500 with `CompiledExpression` typed input, canonical cycle dedup |
| `formspec-lint/src/expressions.rs` | 196 | E400 with bind target tracking, `CompiledExpression` output type |
| `formspec-lint/src/references.rs` | 172 | E300/E301 with canonical path normalization, wildcard group validation |
| `formspec-lint/src/tree.rs` | 161 | `ItemTreeIndex` with `by_key`, `by_full_path`, `repeatable_groups` |
| `formspec-lint/src/extensions.rs` | 159 | E600 with `RegistryLookup` trait, multi-registry support |
| `formspec-lint/src/linter.rs` | 331 | **Skip** — superseded by `main`'s `lib.rs` |
| `formspec-lint/src/diagnostic.rs` | 90 | **Skip** — superseded by `main`'s `types.rs` |
| `formspec-lint/src/policy.rs` | 46 | **Skip** — superseded by `main`'s `types.rs` |
| `formspec-lint/tests/component_lint_tests.rs` | — | Test cases (rewrite against current API) |
| `formspec-lint/tests/theme_lint_tests.rs` | — | Test cases (rewrite against current API) |
| `formspec-lint/tests/diagnostic_tests.rs` | — | **Skip** — covered by `main`'s lib tests |
| `formspec-eval/src/evaluator.rs` | — | **Skip** — superseded by `main`'s `lib.rs` |
| `formspec-eval/tests/pipeline_tests.rs` | — | **Skip** — old API |
| `formspec-core/tests/assembler_tests.rs` | — | Test scenarios (rewrite against current API names) |
| `formspec-core/tests/mapping_tests.rs` | — | Test scenarios (rewrite against current API names) |
| `fel-core/tests/clock_tests.rs` | — | **Skip** — uses API that doesn't exist |

## Strategy

1. **Diff, don't merge.** Run `git diff main..rust_merged -- crates/formspec-lint/` to understand what the old session built. Read the diff for intent and logic — don't try to apply it.
2. **Write fresh against `main`'s architecture.** All new code uses `main`'s `types::LintDiagnostic`, `types::LintMode`, and `lib.rs` orchestrator. New modules are written from scratch, informed by the diff.
3. **Test-first per usual.** Each new pass gets failing tests before implementation.
4. **`rust_merged` is never checked out or merged.** It stays as-is on its branch for reference. Once `main` has all the logic, `rust_merged` can be deleted.

## Steps

### Step 0: Diff and catalog

Generate the full diff for reference. This is the only time we touch `rust_merged`.

```bash
git diff main..rust_merged -- crates/formspec-lint/src/ > /tmp/lint-diff.patch
git diff main..rust_merged -- crates/formspec-lint/tests/ > /tmp/lint-tests-diff.patch
git diff main..rust_merged -- crates/formspec-core/tests/ > /tmp/core-tests-diff.patch
```

Read through these diffs to catalog:
- Every error/warning code and its triggering logic
- The typed intermediate structures and their fields
- Test case inputs and expected outputs (these become our new test fixtures)

### Step 1: Add `definition_document` to `LintOptions` (prerequisite)

Both pass 6 (theme) and pass 7 (components) need the paired definition document for cross-artifact validation (W705-W707 theme→definition checks, W800/E802-E803 component→definition bind resolution).

1. Add `definition_document: Option<&Value>` to `LintOptions` in `types.rs`
2. Thread it through the orchestrator in `lib.rs` to pass 6 and pass 7
3. Cross-artifact checks are conditional — passes must still work when `definition_document` is `None` (single-document mode)

### Step 2: Write typed intermediate structures

Replace raw `serde_json::Value` pass-through with proper typed intermediates. Write these as new modules in `main`, using the diff to understand the data shapes but writing idiomatic code against `main`'s types.

1. **`tree.rs`** — `ItemTreeIndex` with `by_key: HashMap`, `by_full_path: HashMap`, `repeatable_groups: Vec`. Built by pass 2.
   - Must emit E200 for global key duplicates and E201 for path duplicates (matching Python reference — current `main` conflates these).
2. **`expressions.rs`** — `CompiledExpression` struct with bind target tracking. Built by pass 4.
   - Must handle `screener.binds` FEL expressions (calculate, relevant, required, readonly, constraint), not just `screener.routes[].condition`.
   - Must handle nested shape expressions in composed shapes (`and`/`or`/`not`/`xone`).
3. **`dependencies.rs`** — Consumes `Vec<CompiledExpression>`, produces cycle diagnostics (E500). Canonical cycle dedup.
4. **`references.rs`** — Consumes `ItemTreeIndex`, produces E300/E301 with canonical path normalization, wildcard group validation.
5. **`extensions.rs`** — Consumes `ItemTreeIndex`, produces E600 via `RegistryLookup` trait with multi-registry support.

Wire each into the orchestrator, replacing the simpler pass implementations in `passes.rs` as each new module is verified.

### Step 3: Write deep lint passes

The high-value logic. Read the diff for each pass, understand the rules, write fresh implementations using `main`'s types.

1. **`component_matrix.rs`** — 12 input component compatibility rules. Strict mode (runtime) vs authoring mode (studio). optionSet requirement flags. Use `decimal` (schema term) not `number` (spec prose term).
2. **`pass_theme.rs`** — W700-W711, E710.
   - Token value validation (color → CSS color, spacing → CSS length, fontWeight → valid weights, lineHeight → unitless number)
   - Cross-artifact checks (W705-W707) — conditional on `definition_document.is_some()`
   - Page semantics (E710 duplicate IDs, W706 region keys, W711 responsive breakpoints)
3. **`pass_component.rs`** — E800-E807, W800-W804.
   - Root must be layout type (E800)
   - Unknown component detection (E801)
   - Input/dataType compatibility via component matrix (E802-E803)
   - richtext TextInput must bind string (E804)
   - Wizard children must be Page (E805)
   - Custom component param validation (E806) and cycle detection (E807)
   - Bind resolution warnings (W800-W804) — conditional on `definition_document.is_some()`

Wire into `lib.rs`, replacing skeletal `passes::pass_6_theme` and `passes::pass_7_components`. Remove the skeletal versions from `passes.rs`.

### Step 4: Write tests

Read test cases from the diff (`component_lint_tests.rs`, `theme_lint_tests.rs`, `assembler_tests.rs`, `mapping_tests.rs`). Extract the *scenarios* — input JSON + expected error codes — and rewrite them against the current public API.

1. Theme lint tests → new tests in `lib.rs` `#[cfg(test)]` or a dedicated test module
2. Component lint tests → same
3. Assembler/mapping test scenarios from `formspec-core` → rewrite against current API names

### Step 5: Verify

1. `cargo test --workspace --exclude formspec-py` — all tests pass
2. `cargo check --workspace` — including formspec-py
3. Count error codes — should be ~34 (union of both sets)
4. Spot-check cross-artifact validation: lint a theme document with and without a paired definition — W705-W707 should only fire when definition is present

## Known Gaps (from spec review)

| # | Gap | Risk | Decision |
|---|-----|------|----------|
| 1 | **E101 (JSON Schema validation)** — Python linter validates documents against JSON Schema via `jsonschema` and uses E101 errors for pass gating. Rust has no equivalent. | Medium | **Accept.** Rust linter's value is in semantic passes 2-7. Caller can do schema validation externally. Pass gating in Rust uses E200/E201 structural errors instead. |
| 2 | **`when` expression FEL validation** — Component spec says `when` is a FEL boolean expression, but neither Python nor Rust validates `when` in component trees. Malformed `when` silently passes lint. | Low | **Defer.** Presentation-only, no data semantics impact. Add as future enhancement. |
| 3 | **`decimal` vs `number` vocabulary** — Spec prose says "number" in compatibility matrix, schema uses `decimal`. | Low | **Follow schema.** Python reference already uses `decimal`. Rust must match. (Addressed in Step 3.1.) |

## What NOT to do

- Don't `git merge` or `git cherry-pick` from `rust_merged` — the branches have diverged too much
- Don't copy files verbatim — they use old types (`diagnostic::LintDiagnostic`, `policy::LintMode`) that don't exist on `main`
- Don't try to make the old test files compile as-is — they reference old module names and APIs
- Don't replace the new orchestrator with the old one — `main`'s `lib.rs` has pass gating and LintMode
- Don't touch `fel-core`, `formspec-core`, `formspec-wasm`, `formspec-py` — those are clean
- Don't touch `formspec-eval` — `main`'s `lib.rs` is strictly better than the old `evaluator.rs`

## Estimated effort

Step 0 is 15 minutes (generate and read diffs). Steps 1-3 are the bulk — writing fresh code informed by the diff, roughly 2-3 hours. Step 4 is test extraction and rewriting, roughly 1 hour. Total: ~4 hours of focused work.
