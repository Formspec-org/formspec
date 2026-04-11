# ADR-0029: Studio Fixes — Post-Review Cleanup

**Date:** 2026-03-13
**Status:** Implemented
**Branch:** `studiofixes`

## Context

Code review of uncommitted `studiofixes` work identified circular-reference hazards, browser-safety issues, diagnostic false positives, and spec-conformance gaps in the example artifacts. Investigation confirmed that circular references **can** be created through `definition.moveItem` and `component.moveNode` dispatch handlers (no ancestor check exists). Per MEMORY.md ("find the root domino"), fixes target mutation boundaries rather than scattering defensive guards.

Diagnostic failures in the e2e-examples test suite revealed that studio-core's consistency checks were both too loose (missing cycle guards) and too strict (flagging valid spec patterns as warnings). The example files themselves contained spec-nonconformant data that had been authored without validation feedback.

## Changes

### 1. Circular move guards at mutation boundaries

**Files:** `handlers/definition-items.ts`, `handlers/component-tree.ts`

`definition.moveItem` — path-prefix ancestry check before any mutation. `targetParentPath === sourcePath` or `targetParentPath.startsWith(sourcePath + '.')` prevents moving a node into itself or any descendant. O(1) string check.

`component.moveNode` — refactored to resolve both source and target before any mutation, then walks the source subtree checking object identity (`n === targetResult.node`). Catches self-move, direct child, and deep descendant cases. The previous two-phase (remove-then-insert) design silently lost nodes on self-move because the target disappeared after the source was spliced out.

### 2. WeakSet cycle guard in schema-validator

**File:** `packages/formspec-engine/src/schema-validator.ts`

Added `visited: WeakSet<object>` parameter to `walkComponentNodes`. External JSON could contain reference cycles even with mutation guards in place; this prevents infinite recursion during per-node validation. Consistent with all other tree walks in the codebase.

### 3. Bind normalization at mutation boundaries

**Files:** `handlers/component-tree.ts`, `handlers/component-properties.ts`

`component.addNode` — normalizes the `bind` parameter through `normalizeIndexedPath()`, stripping repeat indices (`group[0].field` → `group.field`). Component binds reference definition item paths, not instance-specific indexed paths.

`component.setDocumentProperty` — when setting `tree`, recursively normalizes all `bind` values in the tree. This is the code path used by `hydrateComponent` in the e2e-examples test, and was the root cause of indexed bind paths appearing in reconstructed component trees.

### 4. Diagnostic correctness

**File:** `project.ts` (`diagnose()` method)

**Stale mapping source** — changed from `normalizedFieldPaths` to `normalizedItemPaths`. Groups (repeatables, sections) are valid mapping source paths per the mapping spec. Added `isKnownPath()` helper that also accepts sub-property paths of known items (e.g. `budget.requestedAmount.amount` where `budget.requestedAmount` is a money field) — money field decomposition into `.amount`/`.currency` is a documented mapping pattern.

**DISPLAY_ITEM_BIND** — narrowed to only fire when a non-group-aware component (e.g. `TextInput`) is bound to a **group** item. Previously flagged display items, which are valid bind targets per the component spec (Text, Summary, etc. legitimately bind to display items).

**PAGED_ROOT_NON_GROUP** — kept as `warning` severity. The spec says `formPresentation` is advisory, but root-level non-group items in wizard/tabs mode will genuinely be hidden. The fix was to correct the example data, not suppress the diagnostic.

Removed unused derived sets (`normalizedFieldPaths`, `fieldKeysWithUniqueKey`) that were artifacts of the old, overly-narrow checks.

### 5. Example data fixes

**grant-application:**
- `component.json`: normalized indexed bind paths (`budget.lineItems[0].category` → `budget.lineItems.category`)
- `definition.json`: added `projectPhasesTotal` as a display item inside the `projectPhases` group (was a variable with no corresponding definition item; components bind to items, not variables)

**grant-report** (tribal-base, tribal-long, tribal-short):
- Moved root-level fields (`applicableTopics`, `hasAdministrationCosts`, `administrationExpenditure`) into the `expenditures` group where they logically belong
- Updated all bind paths, FEL references (`$applicableTopics` → `$expenditures.applicableTopics`), and shape targets to reflect the new paths

### 6. Housekeeping

- Fixed typo `__FORMPEC_TEST_EXPORT` → `__FORMSPEC_TEST_EXPORT` across Shell.tsx, helpers.ts, pages-workspace.spec.ts
- Fixed `repoRoot` resolution in pages-workspace.spec.ts: `process.cwd()`-relative → `__dirname`-relative (matching other test files)
- Guarded `process.env.DIAGNOSE_DEBUG` with `typeof process !== 'undefined'` for browser safety
- Wired `test:studio:e2e` into root package.json and Makefile (`make test-studio-e2e`)

## Decisions

- **Fix at the mutation boundary, not downstream.** Circular move guards go in the handlers that perform splicing, not in every tree walker. The `WeakSet` guards in `project.ts` tree walks remain as belt-and-suspenders but are no longer the primary defense.

- **Validate-then-mutate.** `component.moveNode` was refactored to resolve both source and target before any structural mutation. This eliminates the ghost-target class of bugs (target disappears because it was inside the removed source).

- **Normalize at ingestion.** Bind paths are normalized when entering studio-core (in `addNode` and `setDocumentProperty`), not when reading them out. This keeps the internal representation clean and avoids normalizing on every diagnostic/query call.

- **Diagnostics match the spec, not assumptions.** The component spec allows `bind` on display items. The mapping spec allows groups as source paths. Money fields decompose into `.amount`/`.currency`. Diagnostics were corrected to match these realities rather than suppressing warnings by loosening severity.

- **Fix example data, not just diagnostics.** When examples trigger diagnostics, the right response is to fix both the examples and the code that produced them — not to weaken the checks until the examples pass.

## Verification

```bash
# Engine (schema-validator)
cd packages/formspec-engine && npm run build
node --test packages/formspec-engine/tests/schema-validator.test.mjs  # 9 pass

# Studio-core (all 27 test files)
cd packages/formspec-studio-core && npx vitest run  # 390 pass

# Key test files
npx vitest run tests/diagnostics.test.ts tests/e2e-examples.test.ts \
  tests/definition-items.test.ts tests/component-tree.test.ts tests/e2e.test.ts
```
