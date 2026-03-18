# Rust Crate Reconciliation Plan

**Goal:** Bring the valuable logic from `rust_merged` into `main` by reading the diff and writing new code against `main`'s current architecture. No git merge — `rust_merged` is read-only reference material.

**Spec review (2026-03-18):** All error codes verified against Python reference linter and normative specs. Three review rounds complete — see "Known Gaps" and "Hazards" sections.

## Current State

**`main`** (compiles, 239 tests pass via `--lib` + `evaluator_tests`):
- `fel-core`: 11 source files including printer — **no touch**
- `formspec-core`: 7 source files — **no touch**
- `formspec-eval`: 1 file (`lib.rs` with 28 tests, topo sort, inheritance, NRB, wildcards) — **no touch**
- `formspec-lint`: 3 files (`lib.rs`/`passes.rs`/`types.rs` with 27 tests, pass gating, LintMode, E302/W300/E600) — **this is what we're extending**
- `formspec-wasm`: 1 file — **no touch** (binding gap noted below)
- `formspec-py`: 1 file — **no touch** (binding gap noted below)

**`rust_merged`** is reference material only. It contains deeper lint pass logic from a prior session that never made it to `main`. We will diff it, understand the intent, and rewrite against `main`'s types and orchestrator.

### What `rust_merged` has that `main` doesn't

Read for logic and test cases. Don't copy verbatim — they use old types (`diagnostic::LintDiagnostic`, `policy::LintMode`) that `main` has superseded.

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
3. **Red-green-refactor per module.** For each new module: read the test scenarios from the diff, write failing tests against `main`'s API (RED), implement the module (GREEN), clean up (REFACTOR).
4. **`rust_merged` is never checked out or merged.** It stays as-is on its branch for reference. Once `main` has all the logic, `rust_merged` can be deleted.

## Hazards

Things the diff will be misleading about — don't blindly follow the old code for these:

- **Binds structure divergence.** The definition schema defines `binds` as an **array** of objects with a `path` property — `rust_merged` follows this. `main`'s `passes.rs` treats `binds` as an **object** keyed by bind path (a deviation from the schema). The new typed modules must decide which shape to support. Since the linter accepts raw `serde_json::Value`, either works, but be aware that the diff's bind-walking code is schema-correct while `main`'s is not.
- **E200/E201 split will break existing tests.** `main`'s `test_lint_duplicate_keys` currently asserts E201 for what should be E200 (global key duplicates). Update these tests when introducing the split.
- **`suppressed_in` needs extending for W802.** Currently only W300 is suppressed in authoring mode. W802 (compatible-with-warning fallback) also varies by mode — update `suppressed_in` in `types.rs`. Note: E802 is always an error regardless of mode; only W802 needs mode-sensitive handling.
- **W700 semantics will change.** `main`'s current W700 checks for unresolved `$token.X` references in selectors — this is what the Python reference calls **W704**. Python's W700 is color token value validation. When `pass_theme.rs` is written, the existing W700 behavior will be **replaced** with proper color validation semantics, and the token-ref checking will move to W704.

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

Replace raw `serde_json::Value` pass-through with proper typed intermediates. Write as new modules against `main`'s types, using the diff to understand the data shapes.

Each module follows red-green-refactor: read test scenarios from the diff → write failing tests → implement → verify.

1. **`tree.rs`** — `ItemTreeIndex` with `by_key: HashMap`, `by_full_path: HashMap`, `repeatable_groups: Vec`, `ambiguous_keys: HashSet`. Built by pass 2.
   - Must emit E200 for global key duplicates and E201 for path duplicates (matching Python reference — current `main` conflates these).
   - `ambiguous_keys` is used downstream by pass 3 (references) for better "ambiguous reference" error messages.
2. **`expressions.rs`** — `CompiledExpression` struct with bind target tracking. Built by pass 4. Must handle all FEL slots:
   - `binds[].{calculate|relevant|required|readonly|constraint}` (existing on main)
   - `binds[].default` (new — parse when value looks like FEL via heuristic, matching Python `_looks_like_fel`)
   - `shapes[].{constraint|activeWhen}` (existing on main)
   - `shapes[].context[key]` (new — context values are FEL expression strings per schema)
   - `screener.routes[].condition` (existing on main)
   - `screener.binds[].{calculate|relevant|required|readonly|constraint}` (new)
   - `variables[].expression` (new — variables can reference fields/other variables, creating cycles detectable by pass 5)
   - Composed shapes: `shapes[].and[]`, `shapes[].or[]`, `shapes[].not`, `shapes[].xone[]` (new — these are plain FEL strings, not objects with a `.constraint` property)
3. **`dependencies.rs`** — Consumes `Vec<CompiledExpression>`, produces cycle diagnostics (E500). Canonical cycle dedup. Must include variable expressions in the dependency graph.
4. **`references.rs`** — Consumes `ItemTreeIndex`, produces E300/E301 with canonical path normalization, wildcard group validation.
5. **`extensions.rs`** — Consumes `ItemTreeIndex`, produces E600/E601/E602 via `formspec-core::extension_analysis` (already on `main`). Wire the existing `ExtensionErrorCode::ExtensionRetired` (E601) and `ExtensionErrorCode::ExtensionDeprecated` (E602) — don't reimplement inline.

Wire each into the orchestrator. For each module: implement → test → swap into `lib.rs` → delete the old function from `passes.rs`.

### Step 3: Write deep lint passes

The high-value logic. Read the diff for each pass, understand the rules, write fresh implementations using `main`'s types. Each follows red-green-refactor.

1. **`component_matrix.rs`** — 12 input component compatibility rules. Strict mode (runtime) vs authoring mode (studio). optionSet requirement flags. Use `decimal` (schema term) not `number` (spec prose term). Update `suppressed_in` in `types.rs` for W802 authoring suppression (E802 is always an error regardless of mode).
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

Wire into `lib.rs`, replacing skeletal `passes::pass_6_theme` and `passes::pass_7_components`.

**End state:** `passes.rs` is deleted entirely — all pass functions live in dedicated modules (`tree.rs`, `expressions.rs`, `dependencies.rs`, `references.rs`, `extensions.rs`, `pass_theme.rs`, `pass_component.rs`, `component_matrix.rs`).

### Step 4: Edge-case test backfill

Steps 2-3 each include per-module red-green-refactor tests. This step is for additional coverage extracted from the diff that wasn't covered during implementation.

1. Theme lint edge cases from `theme_lint_tests.rs` → add to test module
2. Component lint edge cases from `component_lint_tests.rs` → add to test module
3. Assembler/mapping test scenarios from `formspec-core` → rewrite against current API names

### Step 5: Verify

1. `cargo test --workspace --exclude formspec-py` — all tests pass
2. `cargo check --workspace` — including formspec-py
3. Count error codes — should be **35** (union of both sets, excluding E101)
4. Spot-check cross-artifact validation: lint a theme document with and without a paired definition — W705-W707 should only fire when definition is present

## Error Code Inventory (target: 35)

**Already on `main` (12):** E100, E201, E300, E301, E302, E400, E500, E600, E800, W300, W700 (semantics will change — see Hazards), W804

**Added by this plan (23):**
- Step 2.1 — tree: **E200** (split from E201)
- Step 2.5 — extensions: **E601**, **E602** (via `formspec-core::extension_analysis`)
- Step 3.2 — theme: **W701**, **W702**, **W703**, **W704**, **W705**, **W706**, **W707**, **W711**, **E710**
- Step 3.3 — component: **E801**, **E802**, **E803**, **E804**, **E805**, **E806**, **E807**, **W800**, **W801**, **W802**, **W803**

## Known Gaps (from spec review)

| # | Gap | Risk | Decision |
|---|-----|------|----------|
| 1 | **E101 (JSON Schema validation)** — Python linter validates documents against JSON Schema via `jsonschema` and uses E101 errors for pass gating. Rust has no equivalent. | Medium | **Accept.** Rust linter's value is in semantic passes 2-7. Caller can do schema validation externally. Pass gating in Rust uses E200/E201 structural errors instead. |
| 2 | **`when` expression FEL validation** — Component spec says `when` is a FEL boolean expression, but neither Python nor Rust validates `when` in component trees. Malformed `when` silently passes lint. | Low | **Defer.** Presentation-only, no data semantics impact. Add as future enhancement. |
| 3 | **`decimal` vs `number` vocabulary** — Spec prose says "number" in compatibility matrix, schema uses `decimal`. | Low | **Follow schema.** Python reference already uses `decimal`. Rust must match. (Addressed in Step 3.1.) |
| 4 | **WASM/PyO3 binding gap** — Adding `definition_document` to `LintOptions` compiles cleanly (defaults to `None`), but cross-artifact checks (W705-W707, W800-W804) are unreachable from WASM/Python until bindings are updated to pass `definition_document`. | Low | **Defer.** Follow-up adds `lintDocumentWithContext(doc, registries, definition)` to WASM and equivalent to PyO3. |

## What NOT to do

- Don't `git merge` or `git cherry-pick` from `rust_merged` — the branches have diverged too much
- Don't copy files verbatim — they use old types (`diagnostic::LintDiagnostic`, `policy::LintMode`) that don't exist on `main`
- Don't copy bind-walking code from either branch without understanding the shape — `rust_merged` uses binds-as-array (schema-correct), `main` uses binds-as-object (deviation). Decide which shape to target.
- Don't try to make the old test files compile as-is — they reference old module names and APIs
- Don't replace the new orchestrator with the old one — `main`'s `lib.rs` has pass gating and LintMode
- Don't touch `fel-core`, `formspec-core`, `formspec-wasm`, `formspec-py` — those are clean
- Don't touch `formspec-eval` — `main`'s `lib.rs` is strictly better than the old `evaluator.rs`

## Estimated effort

Step 0 is 15 minutes (generate and read diffs). Steps 1-3 are the bulk — writing fresh code with per-module TDD, roughly 4-5 hours. Step 4 is edge-case backfill, roughly 1 hour. Total: ~6-7 hours of focused work.

---

## Scope Expansion: Mapping Engine, Registry, Changelog → Rust

**Decision (2026-03-18):** Move mapping engine, registry client, and changelog diffing into the Rust kernel. Only format adapters (JSON, XML, CSV serialization) stay Python.

**Rationale:** These are all pure logic with no language-specific dependencies. The mapping engine is already partially duplicated (`formspec-core::runtime_mapping` exists). The registry client blocks TS tooling from doing extension validation without Python. Changelog is small and has no reason to stay.

### Step 9: Mapping Engine → `formspec-core`

`formspec-core::runtime_mapping` already handles bidirectional transforms with 7 transform types. The Python `mapping/engine.py` + `mapping/transforms.py` add:

- [ ] `autoMap` — automatic field-to-field mapping by path matching
- [ ] Array descriptors — repeat group mapping with `arrayPath` + `itemMapping`
- [ ] `concat` transform — join multiple source fields into one string
- [ ] `split` transform — split a string source into multiple targets
- [ ] `nest` transform — restructure flat fields into nested objects
- [ ] `flatten` transform — collapse nested objects into flat fields
- [ ] Full bidirectional engine with `direction: "forward" | "reverse"` orchestration

Extend `runtime_mapping.rs` or add `mapping_engine.rs` alongside it. Update WASM + PyO3 bindings.

### Step 10: Registry Client → `formspec-core`

Port `src/formspec/registry.py` to a new `registry_client.rs` in `formspec-core`:

- [ ] Registry document parsing (extensions array, metadata, lifecycle states)
- [ ] Semver constraint matching (`_version_satisfies` → Rust equivalent)
- [ ] Lifecycle state machine validation (draft → active → deprecated → retired)
- [ ] Well-known discovery URL construction
- [ ] Multi-registry resolution (search registries in order, first match wins)

Note: `RegistryLookup` trait already exists in `formspec-core` for the linter. The registry client implements this trait with actual registry document parsing, replacing the test-only `HashMap` wrapper.

### Step 11: Changelog → `formspec-core`

Port `src/formspec/changelog.py` to `changelog.rs` in `formspec-core`:

- [ ] Diff two definition versions into a structured changelog
- [ ] Classify changes as breaking / compatible / cosmetic
- [ ] Compute major / minor / patch semver impact
- [ ] Produce change objects per the changelog spec (`specs/registry/changelog-spec.llm.md`)

### Step 12: Update bindings + delete Python

- [ ] Add mapping engine, registry client, changelog exports to `formspec-wasm`
- [ ] Add mapping engine, registry client, changelog exports to `formspec-py`
- [ ] Wire PyO3 into Python backend — replace `from formspec.mapping import ...`, `from formspec.registry import ...`, `from formspec.changelog import ...` with `formspec_rust` calls
- [ ] Delete `src/formspec/mapping/engine.py`, `src/formspec/mapping/transforms.py`
- [ ] Delete `src/formspec/registry.py`
- [ ] Delete `src/formspec/changelog.py`
- [ ] Keep `src/formspec/adapters/` (JSON, XML, CSV) — stays Python

### What stays Python after all steps

Only format adapters and the artifact orchestrator:

| Module | File | Why it stays |
|--------|------|-------------|
| Base adapter ABC | `adapters/base.py` | Python abstract interface for format adapters |
| JSON adapter | `adapters/json_adapter.py` | Server-side serialization, Python `json` stdlib |
| XML adapter | `adapters/xml_adapter.py` | Server-side serialization, `xml.etree` stdlib |
| CSV adapter | `adapters/csv_adapter.py` | Server-side serialization, `csv` stdlib |
| Artifact Orchestrator | `validate.py` | CLI entry point, calls into Rust via PyO3 |
