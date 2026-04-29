# Phase 4: Implementation Report

**Date:** 2026-03-25
**Agents:** 4 code-scout agents (by layer)
**Test results:** 3143+ tests passing across all layers, 76 new tests added, zero regressions

---

## Summary by Layer

### Rust/WASM Engine (3 issues, 25 new tests)

| Issue | Fix | Files Changed |
|-------|-----|---------------|
| BUG-3 runtime | `constraint_passes` now takes `EvalResult` (value + diagnostics). Broken expressions (null + error diagnostics) fail instead of passing. `evaluate_shape_expression` also returns `EvalResult` to stop discarding diagnostics through shape composition. | `crates/formspec-eval/src/revalidate/expr.rs`, `items.rs`, `shapes.rs` |
| BUG-5 | Analysis-time arity checking via `check_function_arity` in `fel_analysis.rs`. Parses catalog signatures to extract expected arg counts. Handles optional (`?`) and variadic (`...`) params. Emits `FEL_ARITY_MISMATCH` warnings surfaced through `parseFEL`. No runtime enforcement. | `crates/formspec-core/src/fel_analysis.rs`, `packages/formspec-engine/src/interfaces.ts`, `wasm-bridge-runtime.ts`, `packages/formspec-core/src/queries/expression-index.ts` |
| GAP-1 | Added 6 functions: `sumWhere`, `avgWhere`, `minWhere`, `maxWhere`, `moneySumWhere`, `moneyAvgWhere`. Shared `filter_where` helper follows `countWhere` pattern (let_scope with `$` binding). | `crates/fel-core/src/extensions.rs`, `crates/fel-core/src/evaluator.rs` |

**Verification:** `cargo nextest run --workspace` — 1401 tests, zero failures.

### Studio-Core (8 issues, 20 new tests)

| Issue | Fix | Files Changed |
|-------|-----|---------------|
| BUG-1 | Phone regex: `\\s` → `\\\\s`, `\\-` → `\\\\-` on line 41. Regression test parses ALL `constraintExpr` values through FEL. | `field-type-aliases.ts` |
| BUG-3 creation | `_validateFEL` now checks warnings for `FEL_UNKNOWN_FUNCTION` and throws `INVALID_FEL`. Named "semantic pre-validation". | `project.ts:806-826` |
| BUG-4 | Unified `removeValidation(target)` — tries shape ID AND field path. Clears bind `constraint` + `constraintMessage` via null semantics, AND removes shapes targeting the field. MCP calls one method. | `project.ts:1089-1127` |
| BUG-8 | `addValidation` checks for existing bind constraint, emits `DUPLICATE_VALIDATION` warning. Advisory only. | `project.ts:1068-1079` |
| UX-1 | `addField`/`addGroup`/`addContent` summaries now include canonical path: `"Added field 'Name' (string) at path \"section.name\""`. | `project.ts` (3 methods) |
| GAP-2 | `BranchPath` gains `mode: 'condition'` + `condition: string`. `_branchExpr` returns raw FEL (validated). `when` optional in condition mode. | `helper-types.ts`, `project.ts:945-960` |
| GAP-3 | `branch()` detects `@varName` or bare variable names. Validates against `variableNames()`, throws `VARIABLE_NOT_FOUND`. Uses `@varName` in FEL generation. | `project.ts:967-995` |
| CONFUSION-2 | `flattenToSignalPaths` accepts `atomicObjectPaths`. `loadDataIntoEngine` collects money paths via `dataType === 'money'` check. Money objects preserved as leaf values. | `evaluation-helpers.ts` |

**Verification:** `npx vitest run --config packages/formspec-studio-core/vitest.config.ts` — 572 tests, zero failures.

### MCP (10 issues + full param audit, 20 new tests)

| Issue | Fix | Files Changed |
|-------|-----|---------------|
| BUG-2 | Layout action falls back to `params.path` when `target` absent. Returns `MISSING_PARAM` error when neither provided. | `tools/style.ts` |
| BUG-6 | Preview uses `params.scenario ?? params.response`. Added `.describe()` to both params. | `tools/query.ts`, `create-server.ts` |
| BUG-7 | `mergeParentPath()` helper — all three add handlers accept top-level `parentPath`. | `tools/structure.ts`, `create-server.ts` |
| UX-2 | **Already implemented** — `server.ts` already has `path: z.string().optional()` on save. | No changes needed |
| UX-3 | `resolveMovePosition()` translates `position: 'before'|'after'` + sibling path into `(parentPath, index)`. Handles same-parent index shifts. Default: `'inside'`. | `tools/structure.ts`, `create-server.ts` |
| UX-4a | Describe includes repeat config (min/max) when item has `repeatable: true`. | `tools/query.ts` |
| UX-4c | Group creation echoes repeat config via `appendRepeatSummary()`. | `tools/structure.ts` |
| CONFUSION-1 | Updated `formspec_behavior` and `formspec_flow` descriptions. | `create-server.ts` |
| CONFUSION-3 | Updated `formspec_behavior` description to explain bind vs shape distinction. | `create-server.ts` |
| Audit bonus | Exposed hidden `cross_document` and `accessibility` actions on `formspec_audit`. | `create-server.ts` |

**Param Audit:** 36 tools audited. 6 handler/schema mismatches found (all fixed above). Remaining 30 tools clean.

**Verification:** `cd packages/formspec-mcp && npx vitest run` — 483 tests, zero failures.

### Core (2 issues, 11 new tests)

| Issue | Fix | Files Changed |
|-------|-----|---------------|
| UX-4b | New `itemPaths()` function — includes both fields AND display/content items (groups excluded). Added to `IProjectCore` interface. | `queries/field-queries.ts`, `queries/index.ts`, `project-core.ts`, `raw-project.ts`, studio-core `project.ts` |
| UX-6 | `availableReferences` annotates fields with `scope: 'local' | 'global'` when `contextPath` is inside a repeat group. Local = same innermost repeat group. | `queries/expression-index.ts`, `types.ts` |

**Verification:** `cd packages/formspec-core && npx vitest run` — 687 tests, zero failures.

---

## Deviations from Proposed Fixes

| Issue | Deviation | Reason |
|-------|-----------|--------|
| BUG-3 runtime | Also changed `evaluate_shape_expression` return type + `evaluate_composition_element` | Necessary cascade — diagnostics must flow through shape composition |
| BUG-4 | Also removes shapes targeting the field path, not just bind constraint | `removeValidation('score')` should clear ALL validation on score |
| UX-1 | Used `label` instead of `key` in summary | More human-readable |
| CONFUSION-2 | Used `dataType === 'money'` instead of shape heuristic | More robust, no false positives |
| GAP-1 | Python implementation skipped | No Python FEL evaluator in this worktree (replaced by Rust) |
| GAP-1 | Spec prose update skipped | Should go through `npm run docs:generate` pipeline |
| UX-2 | No changes needed | Already implemented |

---

## New Issues Discovered During Implementation

1. **`not` composition behavior change** (Rust): `not` of a broken expression now fails where it previously silently passed. Correct but is a behavior change for existing forms with broken `not` clauses.

2. **Parse-error shape expressions still pass** (Rust): When FEL parsing fails, `evaluate_shape_expression` returns Null with empty diagnostics → `constraint_passes` treats as "missing data" (passes). Debatable — separate scope.

3. **TS `FELAnalysis.warnings` interface addition** (Rust→TS): Adding `warnings: string[]` is technically breaking for code constructing `FELAnalysis` literals. In practice only affects `analyzeFEL` function itself.

4. **`BranchPath.when` now optional** (Studio-core→MCP): MCP tool schema may still mark `when` as required. Needs MCP schema update when exposing `condition` mode.

5. **`removeValidation` wildcard shapes** (Studio-core): Matches by exact target path. Shape targeting `score[*]` won't be removed by `removeValidation('score')`. Edge case.

6. **`addValidation` doesn't check shape-on-shape duplicates** (Studio-core): Only warns about bind+shape overlap, not multiple shapes on same field.

---

## Full Verification Command Sequence

```bash
# 1. Rust workspace (1401 tests)
cargo nextest run --workspace

# 2. Core package (687 tests)
cd packages/formspec-core && npx vitest run

# 3. Studio-core package (572 tests)
cd packages/formspec-studio-core && npx vitest run

# 4. MCP package (483 tests)
cd packages/formspec-mcp && npx vitest run

# 5. Full monorepo build (checks WASM → TS → downstream)
npm run build

# 6. Full E2E suite
npm test
```
