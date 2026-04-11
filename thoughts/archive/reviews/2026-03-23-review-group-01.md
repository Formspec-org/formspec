# Group 1 Review — Rust Crate Modularization

## Summary

Five commits split monolithic Rust source files (some 1,000–3,600 lines each) into focused modules across `formspec-eval`, `formspec-wasm`, `formspec-py`, and the `formspec-core` subsystems `runtime_mapping` and `registry_client`. The public API surface of each crate is unchanged for downstream consumers. The splits are structurally clean, visibility is correctly scoped with `pub(super)`/`pub(crate)`, dead code was removed, and test coverage grew (not shrank). One low-severity visibility inconsistency exists in `formspec-py`. One medium finding on the integration test file is worth noting before it becomes a future breakup target itself.

---

## Findings

### Low: Inconsistent import path for `EvalContext` in `formspec-py`

**File(s):** `crates/formspec-py/src/document.rs:18`

**Details:** `document.rs` imports `EvalContext` via `formspec_eval::{..., types::EvalContext}` — accessing the submodule path directly — while `formspec-wasm`'s equivalent `evaluate.rs` correctly uses the crate-root re-export `formspec_eval::EvalContext`. Both compile fine because `pub mod types` is present in `formspec-eval/src/lib.rs`. But the module-path form couples `formspec-py` to the internal layout of `formspec-eval` rather than its public API contract. If `types` is ever renamed or flattened, `formspec-py` breaks while `formspec-wasm` does not.

**Recommendation:** Change `crates/formspec-py/src/document.rs:18` from `types::EvalContext` to `EvalContext` in the existing `use formspec_eval::{...}` block. One-line change. No urgency — it works now — but worth fixing before any `formspec-eval` internals get reorganized.

---

### Low: `pub mod` on `formspec-eval` submodules exposes more than necessary

**File(s):** `crates/formspec-eval/src/lib.rs:25–31`

**Details:** `rebuild`, `recalculate`, `revalidate`, `screener`, `types`, `convert`, and `nrb` are all declared `pub mod`. This was true before the refactor as well (the pre-split `lib.rs` already had `pub mod` for the major phases), so no new surface was created. However, the refactor subdivided those modules further (e.g., `rebuild/item_tree.rs`, `rebuild/wildcard.rs`) and those inner files now have `pub fn` items accessible via `formspec_eval::rebuild::item_tree::rebuild_item_tree` — a deeper path than the flat re-export at crate root. No downstream consumer uses these deeper paths (verified: `formspec-wasm` and `formspec-py` only import via the crate root), so the risk is theoretical today.

**Recommendation:** No immediate action. If `formspec-eval` gains more consumers, consider auditing whether `pub mod` is needed on all seven top-level modules or whether `pub(crate) mod` with `pub use` re-exports would be sufficient. For now, the existing pattern matches the pre-refactor state — this is not a regression.

---

### Medium: Integration test file is already 3,575 lines

**File(s):** `crates/formspec-eval/tests/integration/evaluate_pipeline.rs`

**Details:** The `evaluate_pipeline.rs` integration test file was introduced in commit `73ca5e0` as part of the modularization and immediately landed at 3,575 lines with 125 tests. This is ironic given the commit's purpose of breaking up large files. The `find-large-code-files.sh` script correctly excludes `tests/` paths from its scan, so this won't appear in the large-file monitor. However, at the current growth rate (the file was written in a single commit), it will become as hard to navigate as the original monoliths it replaced. The split into `mod.rs` + `evaluate_pipeline.rs` provides no structural decomposition — there is only one file in the integration directory.

**Recommendation:** Not urgent now (tests are correct, all 125 pass). Before the file grows further, consider splitting by eval phase: `integration/rebuild.rs`, `integration/recalculate.rs`, `integration/revalidate.rs`, `integration/screener.rs`. The `tests/integration/mod.rs` structure already supports additional files with `mod` declarations.

---

### Low: Dead code correctly removed (`apply_flatten`, `apply_nest`)

**File(s):** `crates/formspec-core/src/runtime_mapping.rs` (deleted)

**Details:** The original `runtime_mapping.rs` contained two private helper functions — `apply_flatten` and `apply_nest` — that were defined but never called anywhere in the file. The split commit `268e6b2` correctly dropped them. The `Flatten` and `Nest` `TransformType` arms in `engine.rs` are implemented inline, which is the correct pattern given the complexity diverged from what those helper functions would have expressed. This is a positive finding confirming the split was not purely mechanical.

**Recommendation:** No action. The deletion was correct.

---

### Low: `version_satisfies` consolidation reduces duplication correctly

**File(s):** `crates/formspec-eval/src/revalidate/items.rs:7`, `crates/formspec-core/src/registry_client/version.rs:23`

**Details:** Before `73ca5e0`, `revalidate.rs` contained its own private `version_satisfies` and `parse_semver` functions (identical algorithm to `registry_client`'s). The refactor correctly removed the duplicate and routes `items.rs` to `formspec_core::registry_client::version_satisfies`. Both implementations used the same algorithm (split on whitespace, `>=`/`<=`/`>`/`<`/exact comparison, zero-padded three-part parse) — confirmed by reading both. The consolidation is semantically safe.

**Recommendation:** No action. This is the intended DRY improvement.

---

### Positive: Visibility discipline is correct throughout

**File(s):** All split modules

**Details:** Internal fields and helper functions are consistently scoped:
- `Registry.entries` and `Registry.by_name` are `pub(super)` — accessible only within `registry_client/`.
- `runtime_mapping` helpers (`split_path`, `get_by_path`, `set_by_path`, `build_mapping_env`) are `pub(crate)`.
- `recalculate` internals (`json_fel`, `repeats`) are `pub(crate) mod`.
- `revalidate` and `rebuild` internal submodules expose only what `mod.rs` re-exports.
- `wasm_tests` and `native_tests` are double-gated (`#[cfg(test)]` on the module declaration in `lib.rs` and the content is also inside `#[cfg(test)]` blocks).

No visibility was over-promoted to `pub` without a corresponding re-export through the crate root.

---

### Positive: Test coverage grew, not shrank

**Counts:**
- `formspec-eval`: 13 inline tests → 125 integration tests + 18 rebuild unit tests (68 total `#[test]` across all submodules per `--list` output)
- `runtime_mapping`: 63 tests before → 66 tests after (3 added)
- `registry_client`: 51 tests before → 51 tests after (identical)

The move from inline `mod tests` in monolithic files to dedicated `tests.rs` submodules and a separate `tests/integration/` harness is correct. No test was lost in any split.

---

### Positive: `formspec-py` workspace test linkage fix is correct

**File(s):** `crates/formspec-py/Cargo.toml`

**Details:** Changing `default = ["extension-module"]` to `default = []` (with `maturin` enabling the feature via `pyproject.toml`) is the correct fix for `cargo test --workspace` failures. PyO3's `extension-module` feature prevents linking `libpython` directly, which is required for `cargo test` but not for maturin extension wheels. This is a standard PyO3 pattern and the change is isolated to the dev/test path.

---

## Verdict

**Ship.** The splits are structurally sound, behaviorally unchanged, and leave the codebase in a better state than before. The two Low findings (import path inconsistency in `formspec-py`, theoretical over-exposure via `pub mod`) do not block shipping and require no immediate attention. The Medium finding (integration test file size) is a watch item but not a defect.
