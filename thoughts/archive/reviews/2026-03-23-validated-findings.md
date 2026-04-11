# Validated PR Findings — `new` branch

**Date:** 2026-03-23
**Process:** 10 formspec-scout review agents → 11 code-scout validation agents
**Original findings:** 4 High / 11 Medium / 11 Low (26 total)
**After validation:** 0 High / 5 Medium / 8 Low / 8 Dropped / 5 Downgraded (26 total)

## Headline: All 4 original Highs were dropped or downgraded

| Original | Finding | Validation Result |
|----------|---------|-------------------|
| H1 | Mapping schema/spec divergence | **Dropped** — intentional by design; spec explicitly acknowledges schema is stricter |
| H2 | TS stale-binary guard incomplete | **Downgraded to Low** — Python-side guard catches it at import time; TS guard is convenience only |
| H3 | Production fix miscategorized | **Dropped** — commit already uses `fix:` prefix with its own test |
| H4 | Non-exported symbol import | **Dropped** — `initWasm` was exported when written; rename + import update happened in same commit |

## Ranked Action List

### Tier 1 — Do Now (real bugs or broken contracts)

| Rank | ID | Finding | Effort | Why now |
|------|-----|---------|--------|---------|
| 1 | L4→M | **Lexicographic version ordering in response migration** | Small (30 min) | Real bug — `"9.0.0" > "10.0.0"` lexicographically. Will bite when forms hit 10+ migrations. Use `semver` crate or tuple parsing. |
| 2 | M7 | **Tailwind CSS variable system inconsistent** | Low-Med (2-3h) | 27 hardcoded color tokens across 8 widget files. Defeats theming. Variables already exist — mechanical replacement. L8 folds in for free. |
| 3 | M11 | **Export tests weakened — lost ValidationReport shape assertions** | Low-Med (1-2h) | Real regression. Original tests verified full server-response contract; current tests only check `data` exists. Core contract untested at E2E level. |

### Tier 2 — Should Fix (correctness gaps, low effort)

| Rank | ID | Finding | Effort | Why |
|------|-----|---------|--------|-----|
| 4 | M6 | **RuntimeMappingEngine.execute() error code** | Trivial (1 line) | Uses `COERCE_FAILURE` for "WASM not ready" — should be distinct code. The "never throw" API is intentional, but callers can't distinguish init failure from execution error. |
| 5 | H2→L | **TS stale-binary guard: add `context=None` check** | Trivial (1 line) | One-line fix in `python.ts` line 32. Prevents confusing ImportError when auto-rebuild doesn't trigger. |
| 6 | L10 | **Remove unused `fastapi`/`httpx` test deps** | Trivial (delete 2 lines) | Zero consumers in codebase. Dead weight in `pyproject.toml`. |
| 7 | L9 | **Fix broken `[RFC 4180]` link references** | Trivial (add 1 line) | 3 broken link refs in mapping spec. Add link definition. |
| 8 | L5 | **`LazyLock` for 5 static regexes in prepare_host.rs** | Small (20 min) | 5 regex compilations × 250 calls per eval cycle. `LazyLock` is stable in Rust 2024. |

### Tier 3 — Nice to Have (cleanup, opportunistic)

| Rank | ID | Finding | Effort | Why |
|------|-----|---------|--------|-----|
| 9 | M9 | **Project import stale-page: per-page filtering** | Small (1-2h) | All-or-nothing is conservative but drops valid pages. Graceful handling exists downstream. Most imports include theme (bypasses this code). |
| 10 | L6→M5 | **Remove timestamp from bundle script → add staleness gate** | Small (L6 trivial, M5 small) | Timestamp blocks freshness checks. Remove it, then add `--check` mode for API.md files. |
| 11 | M1 | **Split evaluate_pipeline.rs** | Low-Med | 3,575 lines, 125 tests, zero organization. Do it next time tests are added. |
| 12 | M4 | **Add multi-level dot access test** | Trivial (5 min) | Fix obviously generalizes (nested AST structure), but documents correctness. |
| 13 | L1 | **Fix submodule path import in formspec-py** | Trivial | `types::EvalContext` → `EvalContext` via crate-root re-export. |

### Dropped / Non-Issues

| ID | Finding | Why dropped |
|----|---------|-------------|
| H1 | Mapping schema/spec divergence | Intentional design — schema strict for interchange, runtime lenient |
| H3 | Production fix miscategorized | Already labeled `fix:` with test coverage |
| H4 | Non-exported symbol import | Never a broken window — rename and import update were same commit |
| M2 | Registry-doc parsing duplication | Only ~20 lines of shared JSON navigation; output types legitimately differ |
| M3 | Vestigial top-level x-* scan | Confirmed dead for schema-valid docs but harmless; needs doc comment at most |
| M8 | tailwindAdapter imported but unused | Finding was wrong — only `uswdsAdapter` is imported |
| M10 | Drag-reorder test skipped | Logic has unit test coverage; E2E gap is a known Playwright/dnd-kit limitation |
| L2 | Missing docs suppressed | Cosmetic — field names are self-explanatory |
| L3 | Clippy nits in prepare_host | `sort_by_key` nit is real but trivial; nested `if let` is actually correct |
| L7 | prepare_host missing from README | Documentation gap only — covered in generated API.md |
| L8 | applyErrorStyling dead logic | Folds into M7 fix for free |
| L11 | Layer violation in pages-workspace | Not a violation — imports public API via relative path as intentional Playwright workaround |

## Summary

The branch is in good shape. The 64 commits represent substantial, well-structured work. The original review overestimated severity on several findings — all 4 Highs were false alarms after codebase validation. The real priorities are:

1. **One real bug** (L4: lexicographic version sort) — 30 min fix
2. **One theming regression** (M7: raw Tailwind tokens) — 2-3h mechanical fix
3. **One test regression** (M11: lost ValidationReport assertions) — 1-2h fix
4. **A handful of trivial cleanups** (H2, L10, L9, L5) — under 1h total

Everything else is opportunistic or can wait.
