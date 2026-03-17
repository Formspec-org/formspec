# Phase 2: Root Cause Analysis

**Date:** 2026-03-17

## Layer Heatmap

| Layer | Root Causes | Issues |
|-------|------------|--------|
| **spec** | 1 | Screener Route `message` property missing |
| **schema** | 1 | (same — Route schema) |
| **engine** | 2 | Shape null semantics (spec §3.8.1 violation), FEL catalog metadata sparse |
| **core** | 3 | `FELParseResult` missing variables, `parseFEL` no function validation, changelog stub wiring, `export()` reads wrong component state, `statistics()` missing screener counts |
| **studio-core** | 5 | `flattenToSignalPaths` destroys multichoice arrays, path resolution duplicated + buggy, missing path validation on bind helpers, missing `page` on GroupProps, circular variable not detected |
| **MCP** | 3 | `remove_rule` action missing, changelog stub, tool descriptions (today(), required+hidden, dateDiff) |

**Studio-core is the hottest layer** — 5 distinct root causes. Most are missing pre-validation that was fine when only trusted code called the helpers, but breaks under unpredictable MCP input.

---

## Issues Grouped by Root Layer

### Engine Layer (2 issues)

**E1. Shape constraint null semantics violate spec §3.8.1** (BUG-5: Jake)
- File: `packages/formspec-engine/src/index.ts`, `evaluateShapeConstraints` line 930
- Root cause: `!null === true` in JS, so null constraint result = "failed". Spec says null → passes.
- Bind constraints already handle this correctly at line 1415. Shape constraints don't.
- Fix: `const passes = result === null || result === undefined ? true : !!result;`
- Extract shared `constraintPasses(result)` helper for consistency.

**E2. FEL catalog lacks signatures/descriptions** (UX-1: Marcus; BUG-11: Dr. Chen)
- File: `packages/formspec-engine/src/fel/interpreter.ts`
- Root cause: `FELBuiltinFunctionCatalogEntry` only has `{name, category}`. No signatures, descriptions, or type hints.
- LLMs can't distinguish `contains()` (string) from `selected()` (multichoice). `dateDiff` arg order undiscoverable.
- Fix: Add `FEL_BUILTIN_FUNCTION_INFO` map with signatures and descriptions. Wire through to `listBuiltInFunctions`.

### Core Layer (3 issues)

**C1. `FELParseResult` missing variables; `expressionDependencies` drops them** (BUG-3: Jake, Dr. Chen)
- File: `packages/formspec-core/src/queries/expression-index.ts` lines 91-96, 308-310
- Root cause: `analysis.variables` is available from engine but not included in `FELParseResult` return. `expressionDependencies()` returns only field refs.
- Fix: Add `variables: string[]` to `FELParseResult` type, include in return.

**C2. `parseFEL` doesn't validate function names** (UX-3: Jake)
- File: `packages/formspec-core/src/queries/expression-index.ts`
- Root cause: Parser allows any `Identifier(args)` as syntactically valid. `parseFEL` never cross-references against function catalog.
- `sumWhere(...)` passes `check` even though it will fail at runtime. Typos in function names pass silently.
- Fix: Cross-reference `analysis.functions` against `felFunctionCatalog()`, emit `FEL_UNKNOWN_FUNCTION` warning.

**C3. `export()` reads authored component state, not effective component** (UX-5/BUG: Dr. Chen)
- File: `packages/formspec-core/src/raw-project.ts` line 238
- Root cause: `export()` reads `_state.component.tree` (authored), which is `undefined` for MCP-built forms. Should use `getCurrentComponentDocument()` which merges authored + generated.
- Fix: Replace with `getCurrentComponentDocument(this._state)`.

**C4. `statistics()` missing screener counts** (BUG-4: Priya)
- File: `packages/formspec-core/src/queries/statistics.ts`
- Root cause: Only walks `definition.items`, not `definition.screener.fields`.
- Fix: Add `screenerFieldCount` and `screenerRouteCount` to `ProjectStatistics`.

### Studio-core Layer (5 issues)

**S1. `flattenToSignalPaths` destroys multichoice arrays** (BUG-1: Marcus, Jake, Dr. Chen — HIGH)
- File: `packages/formspec-studio-core/src/evaluation-helpers.ts` lines 18-26
- Root cause: Treats ALL arrays as repeat group data, splitting `["keynote"]` into `"sessions[0]": "keynote"`. Multichoice field signal stays at `""`.
- This is the root cause of BOTH preview scenario broken AND multichoice required validation broken.
- Fix: Accept `repeatGroupPaths: Set<string>` parameter. Only expand arrays for repeat group paths.

**S2. Path resolution duplicated + buggy across addField/addGroup/addContent** (CONFUSION-1: Jake, Dr. Chen, Priya — HIGH)
- File: `packages/formspec-studio-core/src/project.ts`, three methods
- Root cause: When `parentPath` is provided, entire dot-path becomes the key. `path="a.b" + parentPath="a"` → `a.a.b`.
- Also: `addGroup` missing `page` prop that `addField` and `addContent` have.
- Fix: Extract shared `_resolvePath(path, parentPath)` helper. Strip redundant prefix when parentPath overlaps dot-path. Add `page` to `GroupProps`.

**S3. Missing path validation on bind helpers** (BUG-8: Dr. Chen; BUG-7: Priya)
- File: `packages/formspec-studio-core/src/project.ts`, `showWhen`/`readonlyWhen`/`require`/`calculate`/`addValidation`
- Root cause: None of these check that `target` is a valid item path. Phantom binds and screener-path shapes accepted silently.
- Fix: Add `_requireItemPath(path)` guard. For `addValidation`, also validate non-wildcard targets.

**S4. Circular variable reference accepted silently** (BUG-9: Jake)
- File: `packages/formspec-studio-core/src/project.ts`, `addVariable` line 2336
- Root cause: `_validateFEL` only checks syntax. No self-reference check. `diagnose()` has cycle detection code but never calls it.
- Fix: Check `analysis.variables.includes(name)` in `addVariable`. Wire `dependencyGraph().cycles` into `diagnose()`.

**S5. Overwrite warnings missing on bind helpers** (UX-4: Marcus)
- File: `packages/formspec-studio-core/src/project.ts`, `require()` line 629
- Root cause: `require(target, condition)` silently overwrites existing `required` bind. No warning when unconditional → conditional or vice versa.
- Fix: Check `existingBind?.required`, emit `REQUIRED_OVERWRITTEN` warning if different value.

### MCP Layer (3 issues)

**M1. No `remove_rule` action in `formspec_behavior`** (BUG-2: Priya, Dr. Chen — MEDIUM)
- File: `packages/formspec-mcp/src/tools/behavior.ts` + `server.ts`
- Root cause: `studio-core` has `removeValidation(shapeId)`. MCP never exposes it.
- Fix: Add `remove_rule` to action enum. Route `target` as shapeId to `project.removeValidation()`.

**M2. Changelog stub not wired to implementation** (GAP-1: Jake, Dr. Chen)
- File: `packages/formspec-mcp/src/tools/query.ts` lines 104-107
- Root cause: Stub returns hardcoded message. `previewChangelog()` exists on `RawProject` but isn't delegated through `Project`.
- Fix: Add delegation in studio-core, replace stub with `project.previewChangelog()`.

**M3. Tool descriptions missing common patterns** (GAP-6: Priya; GAP-4: Marcus)
- `today()` exists but undiscoverable from field tool. `initialValue: "=today()"` supported but undocumented.
- Hidden group children already skip required validation at runtime, but MCP description doesn't say so.
- Fix: Enhance tool descriptions for `formspec_field` (date hints), `formspec_behavior` (require + hidden groups, calculate patterns).

### Schema Layer (1 issue)

**SCH1. Route schema missing `message` property** (GAP-3: Priya)
- File: `schemas/definition.schema.json`, Route definition
- Root cause: No way to customize screener rejection message. `target: "disqualified"` is a dead-end with no user-facing text.
- Fix: Add optional `message` property to Route. Cascade through types → core → studio-core → MCP.

### Spec/Feature Gaps (3 issues — lower priority)

**GAP-D. No page-level validation gating** (Dr. Chen)
- Fix: Extend `previewForm` page entries with per-page `validationErrors` count. No spec change needed.

**GAP-E. No computed display text** (Jake)
- Fix: Support `calculate` bind on display items. Engine needs to create a signal for display items with calculate binds.

**GAP-C. Copy ignores target_path** (Dr. Chen)
- Fix: Extend `copyItem` to accept optional `targetPath`. Do duplicate-then-move. Wire through MCP handler.

---

## Tech Debt Patterns

### Pattern 1: Missing input validation in studio-core helpers
Issues S2, S3, S4, S5 all share the same root: studio-core helpers were written as thin dispatch wrappers trusting callers to pass valid inputs. MCP exposes them to unpredictable input. **Fix pattern:** add pre-validation guards in the helper layer.

### Pattern 2: Duplicated logic across addField/addGroup/addContent
Issues S2 and S2-B (missing `page` on groups) stem from copy-pasted path resolution and page placement logic. **Fix pattern:** extract `_resolvePath()` and `_resolvePageAndParent()` shared helpers.

### Pattern 3: Sparse metadata on FEL catalog
Issues E2, C2, and UX-1 all trace to the catalog being `{name, category}` only. **Fix pattern:** enrich with signatures, descriptions, and type hints.

---

## Dependency Violations

None found. All proposed fixes respect the dependency direction:
- Engine fixes stay in engine (null semantics, catalog metadata)
- Core fixes stay in core (parse result types, function validation, export, statistics)
- Studio-core fixes stay in studio-core (flattening, path resolution, validation guards)
- MCP fixes stay in MCP (tool actions, descriptions, wiring)

---

## Recommended Fix Order

Accounting for masking effects (deeper fixes resolving shallower symptoms):

### Tier 1 — Fixes that resolve multiple issues
1. **S1: Fix `flattenToSignalPaths`** → resolves BUG-1 (preview broken, 3 personas) AND BUG-6 (multichoice required, 1 persona)
2. **S2: Extract `_resolvePath` + fix dot-path/parentPath** → resolves CONFUSION-1 (3 personas) AND UX-2 (group placement, 1 persona)
3. **S3: Add `_requireItemPath` to bind helpers** → resolves BUG-8 (phantom paths) AND BUG-7 (screener bleed)
4. **E2 + C1 + C2: Enrich FEL catalog + expose variables + validate functions** → resolves BUG-3, UX-1, UX-3, BUG-11 (contains/selected, sumWhere, dateDiff, variable refs)

### Tier 2 — Independent high-value fixes
5. **E1: Shape null semantics** → resolves BUG-5 (null comparison false-positives)
6. **M1: Add `remove_rule`** → resolves BUG-2 (no shape removal)
7. **C3: Fix `export()` component tree** → resolves UX-5 (null tree in publish)
8. **S4: Circular variable detection** → resolves BUG-9

### Tier 3 — Nice-to-haves and feature gaps
9. **M2: Wire changelog** → resolves GAP-1
10. **S5: Overwrite warnings** → resolves UX-4
11. **C4: Screener stats** → resolves BUG-4 (describe gaps)
12. **M3: Tool descriptions** → resolves GAP-6, GAP-4
13. **SCH1: Route message** → resolves GAP-3
14. **GAP-D: Page validation counts** → feature
15. **GAP-E: Computed display text** → feature
16. **GAP-C: Copy target_path** → feature
17. **B (duplicate messages): Warning on addValidation** → resolves BUG-12
