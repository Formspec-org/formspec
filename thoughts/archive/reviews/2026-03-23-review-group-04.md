# Group 4 Review — Rustdoc Audit & API Docs

## Summary

Seven commits adding rustdoc annotations and bundled `API.md` files across four Rust crates (`fel-core`, `formspec-core`, `formspec-lint`, `formspec-eval`). The work covers: public API documentation, private `clippy::missing_docs_in_private_items` compliance, crate `README.md` files, a shared bundler script (`scripts/bundle-rustdoc-md.mjs`), and two focused spec cross-reference commits.

Overall quality is high. The docs are substantive rather than cosmetic — descriptions explain behavior and design decisions, not just restate names. The spec cross-references are accurate and point to real sections. The bundle script is functional. There are two real findings: a non-idempotent timestamp in the bundle output, and a staleness gap created by later commits that added `prepare_host.rs` after the fel-core README was written.

---

## Findings

### Low: Bundle script produces non-idempotent output due to live timestamp

**File:** `scripts/bundle-rustdoc-md.mjs:70`

**Details:** The bundler writes `Generated: <new Date().toISOString()>` into the file header on every run. This means re-running `npm run docs:fel-core` (or any of the four docs scripts) produces a file that differs from the committed version even when the source rustdoc content is identical. The consequence is that any CI or developer run of these scripts unconditionally diffs `API.md`, making it impossible to gate freshness by comparing file content.

There is no staleness check covering these files in `docs:check` (which covers spec artifacts and filemap, not Rust API bundles). The non-idempotent timestamp removes the possibility of adding one cheaply.

**Recommendation:** Replace the live `new Date().toISOString()` with a stable marker or use the source file mtime/hash as the stamp. If staleness checking for API.md is not desired now, leave it but document the intentional exclusion. The simplest fix: omit the timestamp entirely, or replace it with a content hash of the bundled sources. If a human-readable date matters, derive it from the most recent mtime of the input `.md` files rather than from `Date.now()`.

---

### Low: `prepare_host` module missing from `fel-core` README module table and not present in committed API.md

**File:** `crates/fel-core/README.md` (Source modules table, line ~40–54), `crates/fel-core/docs/rustdoc-md/API.md`

**Details:** `prepare_host.rs` is a public module with public re-exports (`prepare_fel_expression_for_host`, `prepare_fel_expression_owned`, `prepare_fel_host_options_from_json_map`, `PrepareFelHostInput`, `PrepareFelHostOptionsOwned`) — it is the FEL source normalization prepass used by WASM and Python hosts. It was added in commit `9641ec2` (feat: WASM parity surfaces), which came after the group 4 README commit (`6034192`) but is now in the branch ahead of `main`. The committed API.md (generated at `6034192`+`0e4feeb` time) also does not contain `prepare_host` entries.

This means an LLM reading the README will have an incomplete module map, and the API.md omits a publicly meaningful module. The commit message for `6034192` says "Remove custom fel-core doc generator script in favor of cargo-doc-md" — this is accurate, but the README table was not updated after `prepare_host` was added.

**Recommendation:** When regenerating `npm run docs:fel-core`, the API.md will pick up `prepare_host` automatically (cargo-doc-md sees the public module). The README module table needs a manual row added:

```
| `prepare_host.rs` | FEL source normalization before host evaluation (parity with TS `normalizeExpressionForWasmEvaluation`). |
```

This is a gap created by later commits, not the group 4 commits themselves. Acceptable to fix in a follow-up.

---

### Low: `§3 Item` / `§4 Bind` notation in spec cross-references is informal and not machine-navigable

**Files:** `crates/formspec-core/src/definition_items.rs:18`, `crates/formspec-eval/src/rebuild/item_tree.rs:17`, `crates/formspec-lint/src/extensions.rs:24`

**Details:** The spec cross-reference comments cite `**§3 Item**` and `**§4 Bind**` as section labels in `specs/core/spec.llm.md`. The spec file does not use `§` notation — it uses `### 3. Item` and `### 4. Bind` under the "Six Core Abstractions" heading. The references are not broken (a reader can find the sections), but `§3` is an informal alias that doesn't appear in the file and would silently fail a grep. The "Phase 1: Rebuild" reference is accurate (`### Phase 1: Rebuild` exists verbatim in the spec).

**Recommendation:** Minor issue only. Either align to the exact heading text (`**3. Item**`, `**4. Bind**`) or note that these are conceptual abbreviations. Not worth a dedicated fix commit — acceptable to address in the next round of rustdoc touches.

---

### Low: Code change hidden in `docs(formspec-core)` commit (`runtime_mapping/document.rs`)

**File:** `crates/formspec-core/src/runtime_mapping/document.rs`

**Details:** Commit `489abf8` (`docs(formspec-core)`) contains a reformulation of an `if let` guard in `execute_mapping_doc`. The old form:

```rust
if let Some(allowed) = doc.direction_restriction {
    if allowed != direction {
```

was collapsed to:

```rust
if let Some(allowed) = doc.direction_restriction
    && allowed != direction
{
```

This is semantically equivalent (same control flow, Rust `if let` chain). There is no logic change — it is a Clippy-style refactor enabled by the Rust 2024 edition or `let_chains` feature. However, it is a non-doc change in a `docs()` commit. In isolation this is fine (the code is better), but reviewers scanning for "only doc changes" will miss it.

**Recommendation:** For future hygiene, separate refactors of this type into their own commit even when small. Low impact here since the semantics are identical and the change is mechanical.

---

### Medium: No staleness gate for committed `API.md` files — they can drift silently

**Files:** `crates/*/docs/rustdoc-md/API.md` (all four crates)

**Details:** The four API.md bundles are committed artifacts generated from `cargo doc-md` output. Unlike `filemap.json` (which has `docs:filemap:check`) and the spec LLM docs (which have `docs:check`), there is no CI gate verifying that the committed API.md files match what the current source would generate. The timestamp issue noted above makes a naive content-diff check impossible. In practice, this means the API.md files will silently drift whenever Rust source changes without regenerating docs.

The README and crate docs clearly state "do not edit by hand; regenerate via npm script", but that relies entirely on discipline.

**Recommendation:** Add a `docs:check:rust` script (or integrate into `docs:check`) that runs `cargo doc-md` in check-only mode (if supported) or does a content-hash comparison after stripping the timestamp header line. Alternatively, accept that Rust API.md files are best-effort reference artifacts and document that explicitly in the README. The "best-effort" position is defensible for this project given zero-user constraints.

---

### Informational: Rustdoc quality is substantive and accurate

Spot-checked across all four crates:

- `fel_core::evaluator::Environment` trait methods: each default method has a doc explaining the semantics (`// default true when not overridden`), not just the return type.
- `DefinitionItemKeyPolicy` variants: `RequireStringKey` and `CoerceNonStringKeyToEmpty` both explain the skip/descend behavior and the design rationale for two policies co-existing.
- `formspec-lint` pass table in README matches the `lib.rs` pass-numbering comments exactly (E100/E101 split, E600 as "pass 3b", pass count of 8).
- `formspec-eval` README entry points section correctly identifies `evaluate_definition_full_with_instances_and_context` in `pipeline.rs` as the primary orchestrator.
- Extension diagnostic path rationale (`key-based vs index-based`) is well-explained and references the product decision explicitly ("switching would be a user-visible behavior change, not a refactor").

No instances of docs that merely restate the function name were found.

---

### Informational: Two-commit evolution of `fel-core` docs approach is correct

Commits `6034192` and `0e4feeb` represent an in-progress correction: the first commit used `cargo doc-md` writing directly into the crate's `docs/rustdoc-md/` tree (per-module files), and the second replaced this with a single bundled `API.md` via `scripts/bundle-rustdoc-md.mjs`. The intermediate per-module files were correctly deleted and replaced. The final state is the right approach — one file per crate for LLM context windows, generated into `target/` and then bundled.

The `docs:fel-core` script in the first commit was intentionally superseded in the second. No orphaned scripts or stale references remain.

---

### Informational: README structure is consistent across all four crates

All four `crates/*/README.md` files follow the same structure: Scope table, Architecture section, Primary entry points (or pipeline), Source layout table, Monorepo consumers, LLM assistants section, Quick start, API documentation commands, Internal documentation policy, Tests, License. This makes navigation predictable for both humans and agents.

---

## Verdict

**Approve with minor notes.** The documentation work is substantive, accurate, and well-structured. The spec cross-references point to real spec sections with correct content. No hidden logic bugs were found (the `runtime_mapping/document.rs` change is an equivalent refactor). The bundle script is functionally correct.

Two items warrant follow-up (neither blocks merge):

1. **`prepare_host` README gap** — add a row to the `fel-core` source modules table and regenerate API.md. Low effort, no behavior change.
2. **Bundle timestamp non-idempotency** — decide whether to fix (strip timestamp or use content hash) or explicitly document the limitation. Affects the feasibility of any future freshness gate on these files.

The missing staleness gate for `API.md` is a known-class limitation (same as the per-module tree before these commits). Acceptable given project constraints, but worth recording so the next person doesn't try to write a naive content-diff check and fail due to the timestamp.
