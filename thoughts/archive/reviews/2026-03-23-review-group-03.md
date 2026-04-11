# Group 3 Review — WASM Parity Phase 4 & Rust Features

Commits reviewed (oldest to newest):
- 29b848f fix(formspec-wasm): clear clippy nits in mapping and wasm_tests
- d510e42 refactor(formspec-wasm): share JSON helpers; align coerce parsing with Python
- 07fa356 fix: merge duplicate bind paths in changelog diff
- 2b569ef fix(fel-core): skip PostfixAccess env fast path when root is let-bound
- 17b6057 fix: block repeat-alias rewrite after dot in FEL host prepass
- 9641ec2 feat(rust,python): WASM parity surfaces and eval context
- 33a64c0 feat: complete wasm parity phase 4

---

## Summary

This group is a substantial cross-cutting push that (a) adds four new Rust modules giving the WASM/Python surface parity with TS helper logic, (b) fixes two real FEL evaluation correctness bugs, (c) fixes a changelog diffing bug triggered by real data, and (d) splits the WASM artifact into runtime and tools packages. The refactor work (29b848f, d510e42) is mechanical cleanup. The two bug-fix commits (2b569ef, 17b6057) are targeted, tested, and correct.

The main concern is in the new modules: `response_migration.rs` uses lexicographic string comparison for semver version ordering, which is the same approach used by the TypeScript `migrateResponseData` call-through — but worth flagging explicitly. The new modules are well-covered by unit tests. The TS/Rust boundary wiring in `wasm-bridge.ts` is correct: runtime-only calls go to `wasm()`, tools-only calls go to `wasmTools()`, and the ABI version check is a good defensive gate.

---

## Findings

### [High]: Migration version ordering is lexicographic, not semver

**File(s):** `crates/formspec-core/src/response_migration.rs:112–126`

**Details:**
`apply_migrations_to_response_data` filters migrations where `fromVersion >= from_version` using Rust's `str::cmp`, which is lexicographic. The sort is also lexicographic. This matches what the TypeScript `migrateResponseData` was doing before it was delegated to this Rust function (the TS code was a thin wrapper that passed straight through to WASM — confirmed at `response-assembly.ts:98`). However, lexicographic comparison produces wrong ordering for semver strings: `"2.0.0" > "10.0.0"` under lexicographic comparison because `'2' > '1'`. The filter line:

```rust
migration_from_version(obj).is_some_and(|v| v >= from_version)
```

will misclassify migrations with two-digit major/minor/patch components. In practice, definition authors are unlikely to have 10+ migration steps with double-digit version numbers any time soon, but this is a latent semantic bug.

**Recommendation:** File as a known limitation in a code comment at the sort site — it matches the TS behavior before this commit, so there is no regression. Add a test case with `"10.0.0"` vs `"9.0.0"` to document the limitation. Fix with true semver comparison when/if migration sets grow.

---

### [Medium]: `PostfixAccess` fast path only checks current let_scopes, not parent frames

**File(s):** `crates/fel-core/src/evaluator.rs:284–287`

**Details:**
The fix correctly bails out of the env fast path when the identifier is bound in any let scope:

```rust
let bound_in_let = self
    .let_scopes
    .iter()
    .any(|scope| scope.contains_key(name));
```

This is correct: `let_scopes` is a stack of `HashMap`, one entry per active `let` binding. The fix iterates all frames, so nested `let` expressions are handled. The regression test (`let x = {a: 1} in x.a`) is the canonical broken case.

However, the fast path being skipped only prevents the `resolve_field` short-circuit; the fallthrough to `eval(expr)` + `access_path(base, path)` handles the let-bound case correctly. The fix is sound.

One edge case is not tested: `let x = {a: {b: 2}} in x.a.b` (multi-level dot access on a let-bound object literal). The current fix should handle this because `combined` will still contain only `Dot` segments and `bound_in_let` will be true — but a test would confirm it.

**Recommendation:** Add a test for nested property access on a let-bound object: `let x = {a: {b: 2}} in x.a.b`. This costs nothing and closes the coverage gap.

---

### [Medium]: Repeat-alias rewrite blocking after dot is correct but test coverage is thin

**File(s):** `crates/fel-core/src/prepare_host.rs:213–217`, `packages/formspec-engine/tests/wasm-evaluate-definition.test.mjs:174`

**Details:**
The fix adds `.` to `is_blocked_implicit_prefix`, preventing `x.rows.score` from being rewritten to `x.$rows[*].score`. The logic is correct: a `.` immediately before the alias means the alias is a property access tail, not a standalone alias reference. The existing unit test in `prepare_host.rs` is updated to reflect the fix, and one new WASM test exercises the dot-blocked case.

The concern is the explicit `$alias` pass (`replace_explicit_dollar_repeat_alias`). When an expression contains `x.$rows.score` (a `$`-prefixed access through a dotted parent), the implicit pass would skip it (no `.` before `$`), but then the explicit pass would transform it to `$rows[*].score`. This is probably correct FEL behavior — `$rows` is a legitimate wildcard ref — but there is no test for `x.$rows.score` specifically to confirm the two passes interact correctly at this boundary.

**Recommendation:** Add a test for `x.$rows.score` in `prepare_host.rs::tests` to explicitly document the intended behavior. Given the complexity of the two-pass design, the test is more valuable than any code change.

---

### [Medium]: `assembler.rs` rewrites do not traverse into `items` within assembled group children

**File(s):** `crates/formspec-core/src/assembler.rs:258–270`

**Details:**
When a `$ref` item resolves, `perform_assembly` builds the assembled group item with its `children` from the fragment. Then `resolve_item` recursively descends into `children` to handle nested `$ref` entries. However, the recursion uses `children` as the child array — and the Formspec item tree uses both `children` (for groups) and `items` (for definitions). Within an assembled fragment that itself contains `items` arrays (not `children`), those nested `items` would not be traversed.

Looking at the schema: top-level definitions have `items`; group/repeat items use `children`. `perform_assembly` calls `select_source_items`, which selects from the `items` of the referenced definition. These are then placed as `children` of the assembled group item. So the recursion over `children` is correct for the assembled output — the output uses `children` only. The `items`-vs-`children` duality is handled at the boundary.

This appears sound as written, but the code comment at line 4 of `assembler.rs` ("Private functions walk `items`... `resolve_items`... `resolve_item`") conflates the two concepts. The logic is actually correct — just the documentation is ambiguous.

**Recommendation:** Add a comment at `perform_assembly` clarifying that the assembled output always uses `children` (never `items`) and that the recursion at line 258 descends into those `children` arrays specifically. No code change needed.

---

### [Low]: `dedupe_bind_entries` in changelog is applied only for the array-format path

**File(s):** `crates/formspec-core/src/changelog.rs`

**Details:**
`index_binds_by_path` calls `dedupe_bind_entries` on the result of both the object-format and array-format branches. For the object-format branch (`Value::Object`), JSON object keys are unique by construction, so `dedupe_bind_entries` is a no-op that costs one pass. This is harmless but slightly wasteful. More importantly, the deduplication is correctly applied to both branches, so the fix covers the Python depythonize case (array format with duplicate paths) as well as any hypothetical object-format duplicates.

**Recommendation:** No change needed. The no-op on object-format branches is negligible cost.

---

### [Low]: `wasmEvaluateScreener` is exposed via `IFormEngine.evaluateScreener` but not re-exported from index.ts

**File(s):** `packages/formspec-engine/src/index.ts`, `packages/formspec-engine/src/interfaces.ts:295`

**Details:**
`IFormEngine` declares `evaluateScreener` and `FormEngine` implements it (via `wasmEvaluateScreener`). The standalone `wasmEvaluateScreener` bridge function is exported from `wasm-bridge.ts` directly, but there is no `evaluateScreener` re-export in `index.ts`. Callers using `FormEngine` get it through the class; callers who want a stateless standalone screener evaluation need to import from `wasm-bridge.ts` directly or go through a `FormEngine` instance. Given the MCP and studio layers always construct a `FormEngine`, this is unlikely to cause problems in practice.

**Recommendation:** If a standalone `evaluateScreener(definition, answers)` is needed as a public API (parallel to how `evaluateDefinition` is re-exported as a standalone), add the re-export. Otherwise, leave it as-is — the use of `FormEngine.evaluateScreener` is the correct pattern for consumers.

---

### [Low]: `resolve_option_sets_on_definition` does not recursively handle `items` arrays inside `children`

**File(s):** `crates/formspec-core/src/option_sets.rs:17–35`

**Details:**
`visit_items` recurses into `children` but not into nested `items` arrays. In the formspec data model, `children` is the correct recursion key for item trees (groups use `children`, not `items`). The function comment says "Walk `definition.items` (recursively)" — the recursion through `children` is the right behavior for the item tree. This is consistent with the TS `resolveOptionSetsOnDefinition` which also recurses via `children`. There is a test for this (`nested_children_resolved`).

**Recommendation:** No change needed.

---

### [Low]: Regex objects are re-compiled per call in `prepare_host.rs`

**File(s):** `crates/fel-core/src/prepare_host.rs`

**Details:**
`prepare_host.rs` creates `Regex` objects with `Regex::new(...).expect(...)` inside the bodies of functions that may be called repeatedly (e.g., `current_field_leaf`, `path_segments`, `get_repeat_ancestors`, `to_fel_indexed_path`, `build_repeat_aliases_sorted`). Each call compiles the regex from scratch. In the Rust `regex` crate, this is slow — the recommendation is to use `once_cell::sync::Lazy` or `std::sync::OnceLock` to compile once. Given this is a hot path (called once per FEL expression per evaluation cycle), this is a latent performance issue.

**Recommendation:** Move regexes to module-level `OnceLock<Regex>` constants. This is a mechanical change but meaningful for evaluation throughput at scale.

---

## Verdict

**Ship with fixes.**

The two FEL bug fixes (2b569ef, 17b6057) are correct, tested, and should go out. The parity work (9641ec2, 33a64c0) is architecturally sound — the new modules faithfully port the TS logic, the WASM split boundary is correctly maintained, and the ABI version guard is a good addition. The clippy and refactor commits (29b848f, d510e42) are clean.

Required before merge:
- Add a test for nested property access on a let-bound object (closes the gap noted in the Medium finding about `PostfixAccess`).

Recommended (not blocking):
- Document the lexicographic-not-semver version comparison in a code comment in `response_migration.rs`.
- Add a test for `x.$rows.score` in `prepare_host.rs` tests to document the explicit-dollar pass behavior at the dot boundary.
- Schedule a follow-up to convert `prepare_host.rs` regex constructions to `OnceLock` before this path becomes a measured bottleneck.
