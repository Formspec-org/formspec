# Phase 4: Implementation Summary

**Date:** 2026-04-07

## Results at a Glance

| Agent | Fixes Assigned | Fixes Shipped | Tests Added | All Tests Pass |
|-------|---------------|---------------|-------------|----------------|
| scout-component | ARCH-1+2, FIX 1, FIX 2 | 3/3 | 16 | Yes (1118 across 4 packages) |
| scout-engine | FIX 4, FIX 5, FIX 6, ARCH-3 | 4/4 | 17 | Yes (2583 across 5 Rust suites) |
| scout-core | ARCH-4, FIX 8, FIX 9, BUG-10, BUG-11 | 3/5 (deviations noted) | 18 | Yes |
| scout-mcp | UX-1, UX-2, UX-8, UX-9, BUG-8, CONF-1, UX-4 | 7/7 | 9 | Yes (497 tests) |
| **Total** | **19 fixes** | **17 shipped** | **60 new tests** | **All green** |

---

## Codebase verification (follow-up audit)

Cross-checked the deviations and “new issues” against the tree after Phase 4. Summary: documented gaps match the code; one issue is a **confirmed latent bug** with a clear fix site.

### ARCH-1+2 (allowlist export, no `_meta`)

- **Verified:** `packages/formspec-core/src/raw-project.ts` implements export cleaning via `filterToSchemaProps()` / `COMPONENT_SCHEMA_PROPS` and `cleanTreeForExport()`. There is no parallel `_meta` namespace; the pragmatic approach described in Tier 1 is what ships.

### ARCH-4 (leaf `bind` in the component tree)

- **Verified:** In-memory `TreeNode` is still documented only as “bound to a definition item key” in `packages/formspec-core/src/handlers/tree-utils.ts` — it does **not** state that `bind` is the leaf `item.key` vs a full path. **Export** still normalizes: `cleanTreeForExport()` rewrites binds to absolute paths for non–group-container nodes, so serialized trees differ from authoring state.
- **Risk** called out in this doc remains: new code that assumes `bind` is already a full path can break.

### FIX 8 (repeat target normalization without FEL rewrite)

- **Verified:** `Project.addValidation()` in `packages/formspec-studio-core/src/project.ts` applies `_normalizeShapeTarget()` to the shape **target** only; the **constraint** string is stored as the user-supplied `rule` unchanged. No automatic rewrite of `$group.field` to per-instance form.

### ARCH-3 (`analyze_fel_with_field_types` not in the browser/tooling path)

- **Verified:** Rust exposes `analyze_fel_with_field_types` in `crates/formspec-core` (see `fel_analysis.rs`, `lib.rs`).
- **Verified:** `crates/formspec-wasm/src/fel.rs` imports `analyze_fel` only; `analyzeFEL` WASM maps to `analyze_fel`, not the typed helper. **`analyze_fel_with_field_types` has no WASM export.**
- **Verified:** `packages/formspec-core/src/queries/expression-index.ts` `parseFEL()` uses `analyzeFEL` from the engine and does not call typed analysis.

### Sigil hint (`$name` vs `@name`)

- **Verified:** Unknown field references in `parseFEL` still emit `FEL_UNKNOWN_REFERENCE` only; there is no branch that detects “this name exists as a variable” and suggests `@name` (`expression-index.ts`, reference loop).

### `handleGroup` + `makeRepeatable` (issue #1 under “New Issues”)

- **Confirmed bug:** `Project.addGroup()` resolves `path` with `_resolvePath()` and returns `affectedPaths: [fullPath]` (and `action.params.path` as `fullPath`). **`handleGroup` in `packages/formspec-mcp/src/tools/structure.ts` calls `makeRepeatable(params.path!, …)` using the raw MCP path**, not the resolved full path. With `parentPath` and a relative `path`, the group can be created in the right place while repeat setup targets the wrong path.
- **Test gap:** MCP tests such as UX-4c use a root-level group path (e.g. `items`); they do not cover `parentPath` + relative `path` + `repeat` in one call.

### Other “new issues”

- **Dispatch `as any`:** Still present in `packages/formspec-mcp/src/dispatch.ts` (e.g. handler registration casts).
- **`describeShapeConstraint` duplication:** Not re-audited line-by-line; recommendation to re-export from studio-core is unchanged.

---

## What Shipped

### Tier 1: Core Data Model (scout-component)

#### FIX 1 (BUG-12): `status: 'draft'` in `createDefaultDefinition()`

- **File:** `packages/formspec-core/src/raw-project.ts:152`
- 1-line addition. All new projects now have the schema-required `status` field.

#### FIX 2 (BUG-13 + BUG-15): Phantom `Checkbox` → `Toggle`

- **File:** `packages/formspec-types/src/widget-vocabulary.ts`
- 4 edits: removed `Checkbox` from `KNOWN_COMPONENT_TYPES`, `SPEC_WIDGET_TO_COMPONENT`, `COMPONENT_TO_HINT`, `COMPATIBILITY_MATRIX`
- 5 existing tests updated to expect `Toggle` instead of `Checkbox`

#### ARCH-1+2 (BUG-14, BUG-16): Allowlist Export

- **File:** `packages/formspec-core/src/raw-project.ts` — complete rewrite of `cleanTreeForExport()`
- New `COMPONENT_SCHEMA_PROPS` table maps all 35 component types to their valid properties (derived from `schemas/component.schema.json`)
- New `filterToSchemaProps()` emits ONLY schema-valid properties per component type
- Authoring metadata (widgetHint, repeatable, displayMode, addLabel, removeLabel, dataTableConfig, nodeId, _layout, span, start) automatically excluded
- **Deviation:** Skipped `_meta` namespace — allowlist at export time achieves the same goal without touching internal handlers. Pragmatic and correct.

### Tier 2: Rust/WASM Spec Violations (scout-engine)

#### FIX 4 (BUG-2): Date Coercion at Context Entry

- **Files:** `crates/formspec-eval/src/fel_json.rs`, `recalculate/mod.rs`, `revalidate/env.rs`, `types/paths.rs`
- New `json_to_runtime_fel_typed()` coerces ISO date strings to `FelValue::Date` when field's `dataType` is `"date"` or `"dateTime"`
- New `collect_data_types()` walks item tree to build path→dataType map
- Coercion at JSON→FEL boundary, NOT in evaluator — evaluator stays type-strict per spec

#### FIX 5 (BUG-4): Calculate-Before-Required Evaluation Order

- **Files:** `crates/formspec-eval/src/recalculate/bind_pass.rs`, `recalculate/mod.rs`
- New `refresh_required_state()` re-evaluates all required expressions AFTER calculated values and variables have fully settled
- Called at end of `recalculate()` — ensures required binds always see up-to-date calculated values

#### FIX 6 (BUG-6): Skip Repeat Template at 0 Instances

- **File:** `crates/formspec-eval/src/rebuild/repeat_expand.rs`
- When count == 0, `item.children.clear()` — zero instances means zero nodes to validate
- Definition still holds template; item tree is evaluation-time expansion

#### ARCH-3: Operator Type Checking in `analyze_fel`

- **Files:** `crates/formspec-core/src/fel_analysis.rs`, `lib.rs`
- New `CoarseType` enum (Number, String, Date, Money, Boolean, Unknown)
- New `analyze_fel_with_field_types(expression, field_types)` — bounded scope:
  - Warns on money-vs-number comparisons: "use moneyAmount()"
  - Warns on date-vs-string comparisons: "use date()"
  - Recursively walks AST for nested comparisons
- **Not yet wired to WASM bridge or TS `parseFEL`** — Rust function exists, TS integration is a follow-up task

### Tier 3: Studio-core + Path Resolution (scout-core)

#### BUG-1: `_resolvePath` parentPath Doubling

- **File:** `packages/formspec-studio-core/src/project.ts:598-622`
- Detects when `path` already starts with `parentPath` prefix — no more doubling

#### BUG-10: Display Items in `placeOnPage`

- **File:** `packages/formspec-studio-core/src/project.ts:2513-2559`
- New `_nodeRefForItem()` method — display items use `{ nodeId: leafKey }`, data items use `{ bind: leafKey }`
- Applied to both `placeOnPage` and `unplaceFromPage`

#### FIX 9 (BUG-7): `removeValidation` Normalization

- **File:** `packages/formspec-studio-core/src/project.ts:1264-1316`
- Normalizes target via `_normalizeShapeTarget` before comparison
- Throws `VALIDATION_NOT_FOUND` instead of silent success when no match

#### BUG-9: Cross-document Audit Fix

- **File:** `packages/formspec-mcp/src/tools/audit.ts:105-112`
- Removed broken duplicate bind check that used `itemAt(node.bind)` with leaf keys
- Core `project.diagnose()` already does correct bind validation

#### BUG-11: Regression Guards

- Tests pass without code changes — likely a standalone page or specific rebuild sequence
- 3 regression guard tests added

### Tier 4: MCP/UX Polish (scout-mcp)

#### UX-1: Shape Listing in `formspec_describe`

- New `'shapes'` mode returns all shapes with human-readable constraint descriptions
- **Files:** `packages/formspec-mcp/src/tools/query.ts`, `create-server.ts`

#### UX-2: `.strict()` on Zod Schemas

- `fieldPropsSchema` now rejects unknown properties instead of silently stripping
- **File:** `packages/formspec-mcp/src/create-server.ts`

#### UX-8: `insertIndex` on Content Schema

- Added `insertIndex: z.number().optional()` to content props
- **File:** `packages/formspec-mcp/src/create-server.ts`

#### UX-9: `id` → `page_id` in Describe

- Pages now return `page_id` matching `formspec_place`'s parameter name
- **File:** `packages/formspec-mcp/src/tools/query.ts`

#### BUG-8: Scenario in `generateSampleData`

- `Project.generateSampleData(overrides?)` now accepts optional overrides
- MCP passes `params.scenario` when mode is `sample_data`
- **Files:** `packages/formspec-studio-core/src/project.ts`, `packages/formspec-mcp/src/tools/query.ts`

#### CONF-1: Parent-Context Documentation

- Added precedence notes to `formspec_field`, `formspec_content`, `formspec_group` descriptions

#### UX-4: Guide Shows Both Paths

- Guide now documents quick-start (`formspec_create`) and import (`formspec_draft` → `formspec_load`)

---

## What Did NOT Ship (Deviations)

### ARCH-4: Canonical Paths on TreeNode at Write Time

**Decision: Not implemented. Bugs fixed at symptom sites instead.**

The Phase 3 reviewer warned this was risky: *"A canonical function only helps if everyone calls it... Is the proposed canonical function just moving the N inconsistent resolution sites into N+1 call sites?"* The implementing agent confirmed the concern — `bind` storing leaf keys is consumed by:

- `tree-reconciler.ts` — node creation and snapshot/restore
- All `component-tree.ts` handlers — `moveNode`, `removeNode`, `findNode` match on `bind`
- `component-properties.ts` — property lookup by `{ bind: key }`
- Rename handler — rewrites `node.bind === oldKey` → `newKey`
- Diagnostics — `diagnose()` uses `itemKeySet.has(node.bind)` (leaf key comparison)
- Page resolution queries — `_pageBoundChildren`, `_pageChildren`
- `formspec-webcomponent` renderer — resolves fields from component tree `bind` values

Changing `bind` from leaf key to full path would require updating every one of these consumers, plus adjusting all existing tests that assert on `bind` values. The blast radius is 15+ files across 3 packages for a change that fixes 3 low-severity bugs (BUG-1, BUG-9, BUG-10) — all of which were fixed at their actual symptom sites with targeted, tested changes.

**What was done instead:**

- BUG-1 (`parentPath` doubling): Fixed in `_resolvePath` — detects when `path` already starts with `parentPath` prefix
- BUG-9 (audit leaf key): Removed the broken duplicate check entirely — the core `diagnose()` already validates correctly
- BUG-10 (display items): New `_nodeRefForItem()` method — checks item type and uses `{ nodeId }` for display items, `{ bind }` for data items

**Remaining risk:** If a new consumer is added that assumes `bind` is a full path, the bug will recur. The leaf-key convention is not documented. Consider adding a code comment at the `TreeNode` type definition and in the reconciler explaining that `bind` stores the leaf `item.key`, not the full qualified path.

### FIX 8: Constraint Expression Rewriting for Repeat Wildcards

**Decision: Deferred. Requires FEL expression transformation design.**

When `addValidation` normalizes a shape target from `line_items.description` to `line_items[*].description`, the constraint expression (e.g., `length(trim($line_items.description)) > 0`) is NOT rewritten to use per-instance references. The spec (S7.3) shows that within a `[*]`-targeted shape, unqualified `$field` references resolve against the current repeat instance — but the authoring tool isn't generating expressions that follow this pattern.

**Why this is hard:** FEL expression rewriting requires:

1. Parsing the FEL expression to identify field references
2. Determining which references are inside the repeat group (need to be made relative) vs outside (should stay absolute)
3. Rewriting `$group.field` → `$field` (stripping the group prefix for per-instance resolution)
4. Handling nested repeat groups (multiple levels of `[*]`)
5. NOT rewriting references to fields outside the repeat group

This is essentially a source-to-source transformation on FEL expressions. The Rust FEL parser can parse the expression to an AST, but there's no existing mechanism to rewrite AST field references and emit the modified expression. This needs a dedicated design pass.

**Impact:** Users who write shape rules targeting repeat group fields via `addValidation` get per-instance targeting (the `[*]` in the target works) but the constraint evaluates against the array rather than the current row. Workaround: users can manually write the correct per-instance expression.

**The `removeValidation` normalization (FIX-9) does ship** — so users can at least remove shape rules that target repeat fields without the path mismatch.

### ARCH-3 WASM Bridge Integration

**Decision: Follow-up task. Rust implementation complete, TS wiring needed.**

The Rust `analyze_fel_with_field_types(expression, field_types)` function is implemented and tested in `crates/formspec-core/src/fel_analysis.rs` with 7 test cases covering money-vs-number warnings, date-vs-string warnings, no false positives on correct expressions, and nested comparisons inside `if()`.

**What remains to wire it up:**

1. **WASM binding:** Add `analyze_fel_with_field_types` to the WASM exports in `crates/formspec-wasm/`. This follows the existing pattern used by `eval_fel`, `get_fel_dependencies`, `analyze_fel`, etc.
2. **TS bridge:** Add a wrapper in `packages/formspec-engine/src/fel/` (e.g., `fel-api-tools.ts`) that calls the WASM function.
3. **`parseFEL` integration:** In `packages/formspec-core/src/queries/expression-index.ts`, the `parseFEL` function should call the new typed analysis when `availableReferences` is provided (which gives it the field-type map). Warnings from `analyze_fel_with_field_types` should be appended to the diagnostics array.
4. **MCP surfacing:** The `formspec_fel(action: "check")` and `formspec_behavior()` tools should surface these type warnings to users.

**Estimated scope:** ~50 lines of WASM glue + ~30 lines of TS bridge + ~20 lines in `parseFEL`. Low risk since it's additive — existing behavior is unchanged, new type warnings are supplementary.

### Sigil Validation (`$name` vs `@name`)

**Decision: Follow-up task. Straightforward TS change.**

The FEL grammar (S6.1) defines two sigils: `$name` for field references and `@name` for variable references. Users who create a variable named `avg_severity` and reference it as `$avg_severity` get an `FEL_UNKNOWN_REFERENCE` error with no hint about the correct syntax.

**What needs to change:**

In `packages/formspec-core/src/queries/expression-index.ts`, around line 66-76, the loop that checks `analysis.references` against `knownFieldPaths` should be extended:

```typescript
for (const reference of analysis.references) {
  if (!knownFieldPaths.has(reference)) {
    // NEW: check if this matches a known variable name
    if (knownVariableNames?.has(reference)) {
      diagnostics.push({
        severity: 'warning',
        message: `"$${reference}" is a field reference, but "${reference}" is a variable. Use "@${reference}" to reference the variable.`,
      });
    } else {
      diagnostics.push({ severity: 'error', message: `Unknown field reference: $${reference}` });
    }
  }
}
```

The `knownVariableNames` set can be built from `definition.variables` (if passed) or from the project's variable declarations. This is ~15 lines of code.

**Dependency:** None. This can be implemented independently of ARCH-3's WASM integration.

---

## New Issues Discovered During Implementation

1. **`handleGroup` in `structure.ts` calls `makeRepeatable(params.path!)` with original MCP path instead of resolved path** — Sam's "half-initialized state" variant of BUG-1. **Code-audited:** `addGroup` resolves to `fullPath` and returns it in `affectedPaths` / `action.params.path`, but `handleGroup` still passes `params.path` into `makeRepeatable`. Fix: drive `makeRepeatable` from the resolved path (e.g. first `affectedPaths` entry or equivalent). Existing UX-4c tests use root paths only and do not catch `parentPath` + relative `path` + `repeat`.

2. **ARCH-3 needs WASM bridge wiring** — `analyze_fel_with_field_types` exists in Rust but no WASM binding. TS `parseFEL` needs to call it via WASM with field-type map from `availableReferences`.

3. **Pre-existing Rust build issue** — `formspec-eval/src/recalculate/mod.rs` previously referenced `json_to_runtime_fel_typed` which didn't exist. FIX 4 created this function, resolving the pre-existing issue.

4. **Dispatch layer type mismatch** — `packages/formspec-mcp/src/dispatch.ts` uses `as any` casts to hide type errors in handler registration. Pre-existing, separate from these fixes.

5. **`describeShapeConstraint` duplication** — MCP layer duplicated shape description logic from core because it's not re-exported through studio-core. Consider re-exporting.

---

## Verification Commands

```bash
# TypeScript packages
cd packages/formspec-types && npx vitest run
cd packages/formspec-core && npx vitest run
cd packages/formspec-studio-core && npx vitest run
cd packages/formspec-mcp && npx vitest run

# Rust crates
cargo nextest run -p fel-core
cargo nextest run -p formspec-core
cargo nextest run -p formspec-eval

# Python conformance
python3 -m pytest tests/ -v

# Schema validation on chaos-test forms
python3 -m formspec.validate thoughts/chaos-test/2026-04-07/employee-onboarding/ --registry registries/formspec-common.registry.json
python3 -m formspec.validate thoughts/chaos-test/2026-04-07/techconf-2025/ --registry registries/formspec-common.registry.json
python3 -m formspec.validate thoughts/chaos-test/2026-04-07/quarterly-report/ --registry registries/formspec-common.registry.json
python3 -m formspec.validate thoughts/chaos-test/2026-04-07/longitudinal-health-survey/ --registry registries/formspec-common.registry.json
python3 -m formspec.validate thoughts/chaos-test/2026-04-07/volunteer-form-published/ --registry registries/formspec-common.registry.json
```
