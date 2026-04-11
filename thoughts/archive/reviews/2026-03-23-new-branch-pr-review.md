# PR Review — `new` branch (64 commits ahead of `main`)

**Date:** 2026-03-23
**Reviewers:** formspec-scout agents (automated)
**Status:** Complete (reviewed + validated)

**Validated findings:** [2026-03-23-validated-findings.md](2026-03-23-validated-findings.md)

## Review Groups

| # | Group | Commits | Verdict | Details |
|---|-------|---------|---------|---------|
| 1 | Rust Crate Modularization | 5 | Ship | [review-group-01](2026-03-23-review-group-01.md) |
| 2 | Rust Core DRY / Centralization | 11 | Ship w/ fixes | [review-group-02](2026-03-23-review-group-02.md) |
| 3 | WASM Parity Phase 4 & Rust Features | 7 | Ship w/ fixes | [review-group-03](2026-03-23-review-group-03.md) |
| 4 | Rustdoc Audit & API Docs | 7 | Approve w/ notes | [review-group-04](2026-03-23-review-group-04.md) |
| 5 | TS Engine Split & WASM Init API | 2 | Ship w/ fixes | [review-group-05](2026-03-23-review-group-05.md) |
| 6+7 | Tailwind Adapter & Demo Integration | 9 | Ship w/ fixes | [review-group-06-07](2026-03-23-review-group-06-07.md) |
| 8+11+12 | Fixes, Core Bugs & Firebase | 6 | Ship w/ fixes | [review-group-08-11-12](2026-03-23-review-group-08-11-12.md) |
| 9 | Python/Rust Bridge Hardening | 3 | Ship w/ fixes | [review-group-09](2026-03-23-review-group-09.md) |
| 10 | Test Suite Hardening | 7 | Ship w/ fixes | [review-group-10](2026-03-23-review-group-10.md) |
| 13 | Workspace Tooling & Plans | 4 | Approve w/ notes | [review-group-13](2026-03-23-review-group-13.md) |

## Aggregate Findings by Severity

### High (4)

| # | Group | Finding |
|---|-------|---------|
| H1 | 8+11+12 | **Mapping schema/spec divergence** — spec says runtimes MAY accept missing `transform` in `innerRules`, but schema still has `required: ["transform"]`. Conforming documents fail validation. Pick a side. |
| H2 | 9 | **TS stale-binary guard incomplete** — `hasCurrentEvaluateDefSignature` doesn't check for `context=None`. Pre-`9641ec2` binaries pass guard but fail at runtime with 6 positional args. |
| H3 | 10 | **`e8fdcab` is a production fix miscategorized as test** — `loadDataIntoEngine` guard against `undefined` values is behavioral, not test hardening. |
| H4 | 10 | **`d1b412e` imported non-exported symbol** — `initWasm` from engine internals would have broken MCP tests. Fixed by follow-on commit before CI. |

### Medium (11)

| # | Group | Finding |
|---|-------|---------|
| M1 | 1 | `evaluate_pipeline.rs` is 3,575 lines in a single file — ironic for a large-file breakup. Split by eval phase before it grows. |
| M2 | 2 | `formspec-lint::extensions::build_registry` duplicates registry-doc parsing from `formspec-eval`. Extract shared helper. |
| M3 | 2 | `JsonDefinitionItem::declared_extensions` scans vestigial top-level `x-*` properties not in schema. Remove the `extra` scan. |
| M4 | 3 | Missing test for multi-level dot access (`let x = {a: {b: 2}} in x.a.b`) on PostfixAccess fix. |
| M5 | 4 | No staleness gate for committed `API.md` files — can drift silently. |
| M6 | 5 | `RuntimeMappingEngine.execute()` silently returns empty output when tools WASM isn't ready, unlike every other tools-tier function which throws. |
| M7 | 6+7 | CSS variable system inconsistent — Slider, Rating, MoneyInput, FileUpload, Wizard, Tabs embed raw Tailwind tokens instead of `--formspec-tw-*` vars. |
| M8 | 6+7 | `tailwindAdapter` imported but never registered in references app; no Tailwind example demonstrated. |
| M9 | 8+11+12 | Project import stale-page logic is all-or-nothing — one stale region key drops ALL pages. No tests. |
| M10 | 10 | Story 8 drag-reorder test permanently skipped — page reordering untested in E2E. |
| M11 | 10 | Export tests weakened from contract assertions to `not.toBeEmpty` — restore content-specific assertions. |

### Low (11)

| # | Group | Finding |
|---|-------|---------|
| L1 | 1 | `formspec-py/document.rs` imports `EvalContext` via internal submodule path |
| L2 | 2 | `wire_keys::ChangelogRootKeys` suppresses `missing_docs` instead of adding docs |
| L3 | 2 | Two residual clippy nits in `prepare_host.rs` |
| L4 | 3 | Migration version ordering is lexicographic not semver — latent bug for double-digit versions |
| L5 | 3 | Regex re-compilation on every call in `prepare_host.rs` — `OnceLock` candidate |
| L6 | 4 | Bundle script timestamp makes output non-idempotent |
| L7 | 4 | `prepare_host` module missing from fel-core README module table |
| L8 | 6+7 | `applyErrorStyling` has dead parameter logic; `radio-group.ts` bypasses it |
| L9 | 8+11+12 | Broken `[RFC 4180]` link — definition removed but 3 references remain |
| L10 | 9 | Premature `fastapi`/`httpx` test dependencies in `pyproject.toml` |
| L11 | 10 | `pages-workspace.spec.ts` imports from `formspec-engine/dist/wasm-bridge.js` — layer violation |

## Positive Callouts

- **Group 1**: Test count grew from 13 to 125+ in formspec-eval. Dead code (`apply_flatten`/`apply_nest`) correctly dropped.
- **Group 2**: Dramatic binding thinning — `formspec-py/mapping.rs` went 465→14 lines. Wire-key tables and `DefinitionItemKeyPolicy` are well-scoped abstractions.
- **Group 3**: Both FEL bug fixes are surgically correct with regression tests. Changelog dedup fix is thorough.
- **Group 5**: Clean split with no circular imports. Public API fully preserved. WASM init idempotency correct.
- **Group 6+7**: Semantic HTML across 15 components with proper ARIA. Demo lifecycle cleanly wound down.
- **Group 9**: `instantiate_wildcard_expr` index fix is a real 0-based correctness bug. Mapping test fixes match spec exactly.
- **Group 12**: Firebase analytics is properly env-gated with null-guards. No security concerns.
- **Group 13**: Uncommitted TS engine changes are complete and correct.

## Overall Assessment

**Ship with targeted fixes.** The branch represents substantial, well-structured work across Rust modularization, WASM parity, TS engine decomposition, and adapter development. The 4 High findings should be addressed before merge. The Medium findings are worth fixing but none are blocking — they're mostly missing tests, inconsistent patterns, or vestigial code. The Low findings are cleanup items.

The natural merge order follows the dependency chain: Groups 1→2→3→5 (core structural pipeline), then independent leaves (4, 6–13) in any order.
