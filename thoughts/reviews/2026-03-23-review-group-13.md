# Group 13 Review — Workspace Tooling & Plans

**Commits:** 9a70cd6, abba423, b51aaa9, 5c0d4b4
**Branch:** `new`
**Date:** 2026-03-23

---

## Summary

Four housekeeping commits that collectively land the ADR, baseline measurements, implementation plan, specs/schema audit, and tooling infrastructure for the WASM runtime/tools split (ADR 0050). The most substantive work is spread across committed docs and uncommitted engine changes that are currently in-progress.

The ADR is well-structured and logically sound. The dep fences script is correct. The implementation plan is actionable. The filemap is accurate. The Makefile changes are correct but incomplete (one open item). The uncommitted engine changes are a coherent partial landing of the split — the TS layer is done; the Rust crate split is not.

One significant gap: both `wasm-pkg-runtime` and `wasm-pkg-tools` currently build from the same `crates/formspec-wasm` crate, so there is no actual runtime size reduction yet. The plan correctly documents this but the ADR acceptance criteria (`runtime artifact strictly smaller than monolith`) cannot be met until the Rust crate/feature split happens. This is the known blocking open item.

Overall verdict: **approve with notes**. Nothing here blocks forward progress. The two medium findings and two low findings are worth tracking but none require re-work of committed artifacts.

---

## Findings

### Medium: `find-large-code-files.sh` exclusion is stale for new WASM pkg directories

**File:** `scripts/find-large-code-files.sh:70`

**Details:** The script has a single exclusion pattern `*/wasm-pkg/*` for generated WASM build artifacts. The split now produces two additional directories: `wasm-pkg-runtime/` and `wasm-pkg-tools/` (both gitignored, but present on disk after a build). The generated JS glue files in those directories — `formspec_wasm_runtime.js`, `formspec_wasm_tools.js`, and their `_bg.js` counterparts — are multi-hundred-line generated files. The exclusion does not match `wasm-pkg-runtime/` or `wasm-pkg-tools/`.

When the script is run post-build, these generated glue files will appear in the large-file report as noise, masking real findings.

**Recommendation:** Update the exclusion to `*/wasm-pkg*/*` (wildcard suffix) or add explicit cases for the two new directories. One-line fix in `should_skip()`. Low-urgency, but it will pollute the next large-file audit.

---

### Medium: ADR acceptance criteria §Measure-and-gate is not satisfiable until Rust crate split

**File:** `thoughts/archive/adr/0050-wasm-runtime-tools-split.md:156`, `thoughts/reviews/2026-03-23-wasm-split-baseline.md`

**Details:** ADR acceptance criterion reads: "Recorded baseline measurements show a clear runtime size reduction versus the current monolith." The baseline doc correctly acknowledges that both artifacts are currently built from the same `crates/formspec-wasm` crate, so their `.wasm` sizes differ by only a few bytes (3,400,310 vs 3,400,302 raw). This criterion cannot be met in the current tree.

The baseline doc is honest about this, and the plan has the Rust crate split as a future phase. The issue is that the ADR lists the size criterion under "Acceptance Criteria" — not under "Follow-up Work" — which means it formally blocks the ADR from being considered fully implemented.

This is not a mistake in the ADR logic; the decision to split modules is sound independent of the size win. But the framing creates a gap: the ADR says "Accepted" and has passing structural criteria (init flow, isolation tests) but the core measurable win is still outstanding.

**Recommendation:** Add a brief "Implementation Status" note to the ADR (or a linked section) stating: "Structural split complete as of 2026-03-23; Rust crate/feature split (which delivers the actual size reduction) is in progress per `thoughts/archive/plans/2026-03-23-wasm-runtime-tools-split.md` §3." This keeps the ADR honest without requiring re-work.

---

### Low: Dep fences script false-positive guard was missing; now fixed (uncommitted)

**File:** `scripts/check-dep-fences.mjs:93` (uncommitted change)

**Details:** Before the uncommitted change, the WASM fence loop ran a grep and then immediately flagged every matched line as a violation — there was no `WASM_PATTERN.test(line)` filter before emitting the error. A comment in a TypeScript file containing the string `wasm-pkg` (e.g., a JSDoc explaining why something doesn't use it) would have triggered a false violation.

The uncommitted change adds `if (!WASM_PATTERN.test(line)) continue;` which correctly gates violations on the regex match rather than the raw grep hit. The updated `WASM_PATTERN` also extends coverage to the new `wasm-pkg-runtime`, `wasm-pkg-tools`, and `formspec_wasm_runtime`/`formspec_wasm_tools` names.

This is a correctness improvement. The logic is right. The only note: the grep command string includes `formspec_wasm_runtime` and `formspec_wasm_tools` as explicit alternatives, but `wasm-pkg` in the grep already matches `wasm-pkg-runtime` and `wasm-pkg-tools` as substrings, so those alternatives are redundant (not wrong, just noisy). Not worth changing.

**Recommendation:** Commit these changes. They are ready.

---

### Low: Makefile `build-wasm` target comment is stale after the split

**File:** `Makefile:28`

**Details:** The `build-wasm` target now correctly delegates to `npm run build:wasm --workspace=formspec-engine`, which in turn runs both `build:wasm:runtime` and `build:wasm:tools`. However the Makefile comment above the `build:` target reads: "Full compile: Rust workspace + npm workspaces (WASM via formspec-engine) + formspec_rust into active Python." This is accurate. No issue there.

The slight inconsistency: the split plan (§6, open items) notes that `Makefile / root build scripts` still has open tasks around updating targets that assumed a single artifact. The current Makefile correctly delegates to the npm script, so there is no broken target. But the plan checkbox `[ ] Makefile / root build scripts: update any target that assumes a single formspec-wasm artifact` is technically satisfied — it should be closed.

**Recommendation:** Mark that plan checkbox done.

---

## Detailed Notes by File

### `thoughts/archive/adr/0050-wasm-runtime-tools-split.md`

Well-structured. The context section correctly identifies the problem (monolith payload, tooling deps in runtime path). The decision is narrow — it decides on module ownership and loading strategy, not on crate architecture. Alternative §3 correctly preserves the two-crates vs. one-crate-with-features decision for the implementation. The "Alternatives Considered" section is honest about tradeoffs.

One structural observation: the Implementation Plan section is quite detailed for an ADR. This is a style choice, not a defect — in a project where plans are separate documents, it would be cleaner to keep the ADR focused on the decision and link to the plan. The level of detail here is more plan-like than ADR-like. Not a blocker; just worth noting for ADR authoring consistency as the archive grows.

The follow-up item `~~Replace fancy-regex with regex crate~~ — tried; no material size reduction` is a good signal that the team ran the experiment before claiming a win. That's the right discipline.

### `scripts/check-dep-fences.mjs` (committed + uncommitted)

The committed layer table matches `CLAUDE.md` exactly:

| Layer | Package(s) |
|-------|------------|
| 0 | formspec-types |
| 1 | formspec-engine, formspec-layout |
| 2 | formspec-webcomponent, formspec-core |
| 3 | formspec-adapters, formspec-studio-core |
| 4 | formspec-mcp |
| 5 | formspec-chat |
| 6 | formspec-studio |

Correct and consistent. WASM exclusivity is properly enforced. The uncommitted fix (WASM_PATTERN expansion + false-positive guard) is ready to land.

### Engine uncommitted changes (`wasm-bridge.ts`, `init-formspec-engine.ts`, `index.ts`, `package.json`)

These represent the completed TypeScript layer of the split. Assessed against the plan's §5 matrix:

- Runtime wrappers (`wasmEvalFEL`, `wasmEvalFELWithContext`, `wasmPrepareFelExpression`, `wasmResolveOptionSetsOnDefinition`, `wasmApplyMigrationsToResponseData`, `wasmCoerceFieldValue`, `wasmGetFELDependencies`, `wasmAnalyzeFEL`, `wasmNormalizeIndexedPath`, `wasmItemAtPath`, `wasmItemLocationAtPath`, `wasmEvaluateDefinition`, `wasmEvaluateScreener`) — all call `wasm()`. Correct.
- Tools wrappers (`wasmParseFEL`, `wasmTokenizeFEL`, `wasmExtractDependencies`, `wasmCollectFELRewriteTargets`, `wasmRewriteFELReferences`, `wasmRewriteFelForAssembly`, `wasmRewriteMessageTemplate`, `wasmPrintFEL`, `wasmListBuiltinFunctions`, `wasmLintDocumentWithRegistries`, `wasmParseRegistry`, `wasmFindRegistryEntry`, `wasmValidateLifecycleTransition`, `wasmWellKnownRegistryUrl`, `wasmGenerateChangelog`, `wasmValidateExtensionUsage`, `wasmDetectDocumentType`, `wasmJsonPointerToJsonPath`, `wasmPlanSchemaValidation`, `wasmAssembleDefinition`, `wasmExecuteMapping`, `wasmExecuteMappingDoc`, `wasmLintDocument`) — all call `wasmTools()` or `assertWasmToolsReadySync()`. Correct.

The `resolveWasmAssetPathForNode` refactor (replacing the multi-fallback chain in the old `initWasm`) is a genuine improvement: it extracts the path resolution logic, makes it reusable for both runtime and tools, and removes dead code. The old three-fallback chain (`import.meta.resolve` → `createRequire` → `import.meta.url`) has been replaced with a single unified helper. This is the right direction.

The `verifyRuntimeToolsCompatibility` function (line 180-189) correctly implements the lockstep version check from the plan (§11). The `split_abi.rs` Rust module returns `"1"` as the ABI version from both artifacts (since both currently build from the same crate). The compatibility check will work correctly and will become meaningful once the crate split happens and the versions could diverge.

The isolation test at `tests/isolation/wasm-runtime-isolation.mjs` and idempotence test at `tests/wasm-tools-init.test.mjs` are minimal but test the right behaviors: (1) runtime init leaves tools unloaded, (2) tools bridge throws before tools init, (3) tools init enables bridge, (4) tools init is idempotent.

The `initWasmTools` guard `if (!_wasmReady || !_wasm)` throws before attempting to import tools if runtime isn't ready. This is the correct order enforcement. Error message clearly names both the required call and the alternative.

### `thoughts/archive/plans/2026-03-23-wasm-runtime-tools-split.md`

19 items checked, 25 open. The split is approximately 43% complete on tracked tasks. The open items fall into three groups:

1. **Rust crate/feature split** (§3): the actual size-reduction work. Not started. This is the critical path to the ADR's size acceptance criterion.
2. **TS bridge completions** (§5): two open items — wasm-bridge-runtime.ts/wasm-bridge-tools.ts file split, and better error messages for tools-before-load. These are polish items; the current single-file wasm-bridge.ts works.
3. **Testing gaps** (§8): lazy tools full test, API compatibility test, compatibility guard test, regression suite, browser bundle proof. Most important among these is the browser bundle test — verifying that the initial network request graph doesn't include tools artifacts.

The plan is actionable. Each open item has enough context to be picked up without re-reading the ADR. The "Locked decisions" section (§11) is particularly valuable: it prevents future debate about packaging strategy and versioning by stating the decisions explicitly.

### `thoughts/archive/plans/2026-03-22-rust-wasm-engine-parity-plan.md`

Progress is embedded in the `Status` section prose (phases 1-6 landed). The plan does not use checkbox-style tracking — progress is described in the header paragraph. This is less scannable than the split plan's checkbox approach, but the content is accurate and complete. The per-phase Python impact table is well-structured.

### `thoughts/reviews/2026-03-23-presentation-tier-architecture-audit.md`

501 lines. Well-structured red/green team analysis. The "bottom line" section immediately states the thesis: three valid product jobs, invalid current contracts. The three authoring modes (definition-only, definition+theme, definition+component) are the right frame for evaluating the presentation tier. The main debt vectors (duplicated concepts, vocabulary drift, hybrid fallback model, weak selectors, wrong-direction coupling) are diagnosed at the right layer.

This document is diagnostic and correct but does not generate any immediate action items in this commit group — it's an audit that feeds future ADR/spec work.

### `filemap.json` (commit 5c0d4b4)

Spot-checked five engine entries:
- `packages/formspec-engine/src/wasm-bridge.ts` → "WASM bridge — lazy initialization and typed wrappers for all Rust WASM exports." Matches `@filedesc`.
- `packages/formspec-engine/src/init-formspec-engine.ts` → "Public `initFormspecEngine` / `isFormspecEngineInitialized` — wraps wasm-bridge load for apps." Matches `@filedesc`.
- `packages/formspec-engine/src/index.ts` → "Public API barrel for the Formspec engine package (WASM-backed evaluation)." Matches `@filedesc`.
- `packages/formspec-engine/wasm-pkg-runtime/` and `wasm-pkg-tools/` entries present and correct.
- `crates/formspec-wasm/src/split_abi.rs` → "Lockstep ABI marker shared by runtime and tools WASM artifacts." Accurate.

Note: `filemap.json` still includes `packages/formspec-engine/wasm-pkg/` entries (the old monolith directory). The directory is gitignored and present on disk. Since the filemap is auto-generated from disk state, these entries are technically accurate. However, they may be confusing alongside the new runtime/tools entries. This is cosmetic — once `make docs:filemap` is re-run on a clean tree (post-build), the old entries will be present only if the old `wasm-pkg/` directory still exists on disk. No action required unless the old directory is cleaned up.

### `Makefile`

The `build-wasm` target now correctly delegates to the npm script rather than running `wasm-pack` directly. This is the right separation — the engine package owns its own build commands, and the Makefile orchestrates across the workspace. The `build: build-rust build-js build-python` target is a clean addition. The `.PHONY` line is correctly updated.

One observation: the Makefile `build-wasm` target previously ran `wasm-opt` inline with specific flags. That is now done inside the npm script (`wasm-opt -Os --enable-bulk-memory --enable-nontrapping-float-to-int --enable-simd`). The old `Makefile` only had `-Os --enable-bulk-memory --enable-nontrapping-float-to-int` — the new scripts add `--enable-simd`. This is a legitimate optimization expansion, not a regression.

---

## Verdict

**Approve.** The committed artifacts are clean and accurate. The uncommitted changes are a coherent, well-tested partial landing of the WASM split — ready to commit as-is. The two medium findings are documentation/tracking issues, not implementation problems. The root work (Rust crate split) is correctly deferred as future work and is explicitly tracked in the plan.

**Next concrete steps after this group:**
1. Commit the in-progress engine changes (`wasm-bridge.ts`, `init-formspec-engine.ts`, `index.ts`, `package.json`, `check-dep-fences.mjs`, `thoughts/archive/plans/2026-03-23-wasm-runtime-tools-split.md`).
2. Fix `scripts/find-large-code-files.sh` exclusion for `wasm-pkg-runtime/` and `wasm-pkg-tools/`.
3. Add implementation status note to ADR 0050.
4. Begin Rust crate/feature split (§3 of plan) — this is the blocking item for the ADR size acceptance criterion.
