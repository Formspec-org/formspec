# Plan Review: `2026-03-12-studio-review-fixes.md`

Date: 2026-03-13
Reviewed against: `docs/superpowers/plans/2026-03-12-studio-review-fixes.md`
Branch: `studiofixes` at `bfb8737`

---

## Issue 1: Chunk 2 removed features instead of wiring them up

**Severity: High — functional regression**

The plan classified incomplete feature stubs as "dead controls" and prescribed deletion. The CLAUDE.md principle "delete, don't preserve" applies to wrong abstractions and legacy cruft, not to features that need implementation.

### What was removed that should have been wired up

| Removed Feature | Component | Why it should have been wired up |
|---|---|---|
| `New Form` button | `Header.tsx` | Core workflow — users need to create new forms. `Shell` should pass an `onNew` handler. |
| `Export` button | `Header.tsx` | Core workflow — users need to export definitions. `Shell` should pass an `onExport` handler. |
| Min Repeat / Max Repeat inputs | `ItemProperties.tsx` | Cardinality editing for repeatable groups — essential for authoring. Needs `onChange` → `dispatch('definition.setItemProperty')`. |
| Choice option value/label editing | `ItemProperties.tsx` | Editing select/radio/checkbox options — essential for authoring. Needs `onChange` → `dispatch('definition.setItemProperty')`. |
| `+ Add Token` buttons | `TokenEditor.tsx` | Theme token management — core feature of the Theme workspace. |
| `Add Data Source` button | `DataSources.tsx` | Data source creation — core feature of the Data workspace. |
| `Run Test Response` button | `TestResponse.tsx` | Response testing — core feature of the Data workspace. |

### What was correctly removed

| Removed Feature | Component | Why removal was correct |
|---|---|---|
| `+ Add Rule` button | `ItemProperties.tsx` | Silently hardcoded `required: 'true()'` regardless of user intent — a misleading mutation, not a feature stub. |
| Rule expression `<input>` | `ItemProperties.tsx` | Disconnected from any dispatch — purely cosmetic. |
| Fake variable edit mode | `VariablesSection.tsx` | The `readOnly` input gave the illusion of editing. Correct to show expression as plain text. |

### What was a judgment call

| Change | Component | Assessment |
|---|---|---|
| Option set cards `<button>` → `<div>` | `OptionSets.tsx` | Reasonable — there's no selection behavior yet. But these will need to become interactive when option set editing is built. |
| Variable palette hits marked read-only | `CommandPalette.tsx` | Reasonable — no variable editor exists to navigate to. |

---

## Issue 2: `rewritePathPrefix()` corrupts descendant paths on depth-increasing moves

**Severity: High — correctness bug introduced by the plan**

The plan's Task 15 added path reference rewriting to `moveItem` using `rewriteAllPathReferences()`. The underlying `rewritePathPrefix()` function (lines 190–216 of `definition-items.ts`) only replaces `oldParts.length` segments, discarding extra segments from `newParts` when the move increases path depth.

### Reproduction

Moving `field` to `group.field`:
- `oldPath = 'field'` → `oldParts = ['field']` (length 1)
- `newPath = 'group.field'` → `newParts = ['group', 'field']` (length 2)
- For descendant path `field.child`:
  - Loop runs for `i = 0` only (up to `oldParts.length = 1`)
  - `rewritten[0] = newParts[0] = 'group'`
  - Remaining segments appended: `rewritten[1] = 'child'`
  - **Result: `group.child`** (wrong — should be `group.field.child`)

The second `newParts` segment (`'field'`) is never emitted. This silently corrupts bind paths, shape targets, FEL references, and mapping rules for any item with descendants that moves to a deeper scope.

### Root cause

The rewriting loop iterates `oldParts.length` times and indexes into `newParts[i]` for substitution. When `newParts` is longer than `oldParts`, the extra `newParts` segments are never inserted.

---

## Issue 3: Mapping `innerRules[*].reverse` not rewritten

**Severity: Medium — incomplete coverage in the plan's own Task 15**

`rewriteAllPathReferences()` at lines 338–349 processes `innerRules[*].sourcePath`, `.expression`, and `.condition`, but does not process `innerRules[*].reverse`. The top-level `rule.reverse` (lines 325–337) IS handled. This is an oversight — the same `reverse.sourcePath`, `reverse.targetPath`, `reverse.expression`, and `reverse.condition` fields exist on inner rules.

---

## Issue 4: `moveItem` JSDoc contradicts its implementation

**Severity: Low — documentation bug**

The `moveItem` handler's JSDoc (line 572) states:

> **Side effects**: ... Does not rewrite bind/shape paths (the item's key is unchanged).

But lines 601–604 DO call `rewriteAllPathReferences()`. The JSDoc was written before the plan's Task 15 and was never updated.

---

## Issue 5: Screener `enabled: false` state not honored by preview/runtime

**Severity: High — incomplete fix from the plan's Task 3**

The plan's Task 3 changed the studio-core screener handler to set `screener.enabled = false` instead of deleting. But the webcomponent's `FormspecRender` element (in `element.ts`) still treats any truthy `screener.items` as an active screener. Disabling the screener in Studio still renders and blocks on the screener in preview.

The plan didn't include a step to update the renderer's screener check to respect `enabled: false`.

---

## Issue 6: FEL popup metadata still incomplete

**Severity: Medium — incomplete fix from the plan's Task 14**

The plan replaced the hardcoded catalog with `getBuiltinFELFunctionCatalog()`, which correctly sources function names from the engine. But the popup still relies on `FUNCTION_DETAILS` (lines 31–85 of `FELReferencePopup.tsx`) for signature and description metadata. Engine functions not in this table — including `ceil`, `matches`, `readonly`, `hours`, `minutes`, `seconds`, `isDate`, `isNumber`, `isString` — display with the fallback `'()'` signature and generic description `'Built-in FEL function'`.

The plan's Task 14 Step 2 said "Transform the engine catalog into the shape the popup expects" but didn't address that the engine catalog doesn't include signature/description metadata, so a manual details table is still required and must be kept complete.

---

## Issue 7: `MappingTab` active tab styling uses raw prop instead of derived state

**Severity: Low — visual regression introduced by plan's Task 12**

`MappingTab.tsx` line 61 checks `activeTab === tab.id` (the raw prop) instead of `active === tab.id` (the derived controlled/uncontrolled state). When `MappingTab` is used without controlled props (uncontrolled mode), `activeTab` is `undefined` and no tab ever highlights.

The plan's Task 12 added the controlled/uncontrolled pattern but didn't update the tab styling check to use the derived `active` variable.

---

## Issue 8: `moveItem` can still create root-level hidden items in paged mode

**Severity: Medium — gap in the plan's guard coverage**

The plan's commit `26df835` added a guard to `addItem` preventing root-level non-group items in wizard/tabs mode. But the `moveItem` handler (lines 576–607) has no equivalent guard. A move with `targetParentPath` omitted (or set to root) can silently place a field at root level in a paged definition, recreating the hidden-root state the guard was designed to prevent.

---

## Issue 9: Plan steps left incomplete

Several plan tasks have unchecked steps that were bypassed during execution:

| Task | Unchecked Step | Impact |
|---|---|---|
| Tasks 1–5 | Commit steps unchecked | All changes were squashed into two commits (`105e226`, `3a3b2d0`) instead of the planned per-task commits. Not a bug, but makes the commit history less granular than planned. |
| Task 10 | Steps 2–3 (tsc verification) | The plan noted pre-existing type failures blocked verification. |
| Task 15 | Steps 1–8 (all) | Reference rewriting was partially implemented (landed in `882bff3`) but the plan's test cases were not executed as written. The `rewritePathPrefix` depth bug (Issue 2 above) would have been caught by the planned test. |
| Task 16 | Steps 1–4 (all) | Bind path normalization for command palette and logic workspace was not implemented. |

---

## Summary

| # | Category | Severity |
|---|---|---|
| 1 | Feature removal instead of implementation (Chunk 2) | High |
| 2 | `rewritePathPrefix()` depth-increase corruption | High |
| 3 | Missing `innerRules[*].reverse` rewriting | Medium |
| 4 | Stale `moveItem` JSDoc | Low |
| 5 | Screener `enabled: false` not honored by renderer | High |
| 6 | FEL popup incomplete function metadata | Medium |
| 7 | `MappingTab` active tab styling regression | Low |
| 8 | `moveItem` paged-mode root guard missing | Medium |
| 9 | Plan steps left incomplete | — |

Issues 2, 5, and 7 are bugs **introduced by the plan's execution**. Issue 1 is a **design error in the plan itself**. Issues 3, 6, and 8 are **gaps in the plan's coverage**. Issue 4 is a documentation inconsistency.
