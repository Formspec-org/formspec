# `studiofixes` Implementation List

Date: 2026-03-13
Sources: commit-by-commit review of `studiofixes` against `main`, plan review of `docs/superpowers/plans/2026-03-12-studio-review-fixes.md`
Branch: `studiofixes` at `bfb8737`

---

## Implementation Status

Status: implemented on `studiofixes`
Implementation commit: `6540b50` (`fix: implement studio review regressions`)

Resolved items:
- Issue 1: restored and wired `New Form`, `Export`, repeat cardinality editing, choice option editing, `+ Add Token`, `Add Data Source`, and `Run Test Response`
- Issue 2: fixed depth-increase path rewriting for moved subtrees
- Issue 3: preview/runtime now treats screener as active only when `enabled !== false` and `items.length > 0`
- Issue 4: `definition.moveItem` now enforces the paged-mode root guard
- Issue 5: `rewriteAllPathReferences()` now rewrites `innerRules[*].reverse`
- Issue 6: completed the local Studio `FUNCTION_DETAILS` table rather than moving metadata into the engine export
- Issue 7: fixed uncontrolled `MappingTab` active-tab styling
- Issue 8: updated the stale `moveItem` JSDoc to match actual rewrite behavior

Verification performed:
- `packages/formspec-studio-core`: `npm test -- --run tests/definition-items.test.ts`
- `packages/formspec-webcomponent`: `npm test -- --run tests/render-lifecycle.test.ts`
- `packages/formspec-studio`: targeted Vitest runs covering header, shell, item properties, token editor, data sources, test response, FEL popup, theme tab, and mapping tab
- `packages/formspec-studio`: `npx playwright test tests/e2e/playwright/header-actions.spec.ts`

Notes:
- The implementation intentionally left the “correctly removed” and “judgment call” items unchanged.
- The quick local metadata fix for issue 6 is sufficient for current coverage, but the preferred longer-term direction remains moving signature/description metadata into the engine catalog export.

---

## Tier 1 — High severity

### 1. Restore removed features and wire them up

The plan classified incomplete feature stubs as "dead controls" and deleted them. The CLAUDE.md principle "delete, don't preserve" applies to wrong abstractions and cruft, not to features that need implementation. A button with no `onChange` is an incomplete feature; a button that silently hardcodes `required: 'true()'` is a broken affordance.

**Restore and wire up:**

| Feature | Component | Wiring needed |
|---|---|---|
| `New Form` button | `Header.tsx` | Add `onNew` prop, pass handler from `Shell` that resets project state |
| `Export` button | `Header.tsx` | Add `onExport` prop, pass handler from `Shell` that serializes and downloads definition JSON |
| Min Repeat / Max Repeat inputs | `ItemProperties.tsx` | `onBlur` → `dispatch('definition.setItemProperty', { path, property: 'minRepeat'/'maxRepeat', value })` |
| Choice option value/label editing | `ItemProperties.tsx` | `onBlur` → `dispatch('definition.setItemProperty', { path, property: 'options', value: updatedArray })` |
| `+ Add Token` buttons | `TokenEditor.tsx` | Needs token creation flow — at minimum, prompt for key/value and `dispatch` to set the theme token |
| `Add Data Source` button | `DataSources.tsx` | Needs instance creation flow |
| `Run Test Response` button | `TestResponse.tsx` | Needs response generation using engine |

**Correctly removed (leave as-is):**
- `+ Add Rule` button in `ItemProperties.tsx` — silently hardcoded `required: 'true()'` regardless of context
- Rule expression `<input>` in `ItemProperties.tsx` — disconnected from any dispatch
- Fake variable edit mode in `VariablesSection.tsx` — `readOnly` input gave illusion of editing

**Judgment calls (leave as-is for now):**
- Option set cards `<button>` → `<div>` in `OptionSets.tsx` — no selection behavior yet
- Variable palette hits marked read-only in `CommandPalette.tsx` — no variable editor to navigate to

Files:
- [Header.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx)
- [Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx)
- [ItemProperties.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx)
- [TokenEditor.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx)
- [DataSources.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/DataSources.tsx)
- [TestResponse.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/TestResponse.tsx)

### 2. Fix `rewritePathPrefix()` depth-increase path corruption

When a move changes `field` to `group.field`, descendant paths are rewritten as if the moved node were replaced instead of nested, so descendants lose the moved node segment.

Trace for `field.child` with old=`field`, new=`group.field`:
- `oldParts = ['field']` (length 1), `newParts = ['group', 'field']` (length 2)
- Loop runs for `i = 0` only → `rewritten[0] = 'group'`
- Remaining appended → `rewritten[1] = 'child'`
- **Result: `group.child`** — wrong, should be `group.field.child`

Root cause: the rewriting loop iterates `oldParts.length` times. When `newParts` is longer, the extra segments are never inserted.

Fix: rebuild as `newParts + rawParts.slice(oldParts.length)`, preserving index/wildcard suffixes on the final matched old segment.

Files:
- [definition-items.ts#L190](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L190)
- Tests: [definition-items.test.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/tests/definition-items.test.ts)

### 3. Honor screener `enabled: false` in preview/runtime

Studio core now preserves a disabled screener as `{ enabled: false, ... }`, but the runtime still treats any present `screener.items` array as active. Disabling the screener in studio still renders and blocks on it in preview.

Runtime checks that need the `enabled !== false` guard:
- `getScreenerState()` at [element.ts#L143](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/element.ts#L143): `!!this._definition?.screener?.items`
- `render()` at [element.ts#L390](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/element.ts#L390): `this._definition.screener?.items`
- Screener renderer at [screener.ts#L15](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/rendering/screener.ts#L15): never checks `enabled`

Fix: define one canonical rule — `enabled !== false && items.length > 0` — and apply it at all three entry points.

Files:
- [element.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/element.ts)
- [screener.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/rendering/screener.ts)
- Tests: [render-lifecycle.test.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/tests/render-lifecycle.test.ts)

---

## Tier 2 — Medium severity

### 4. Add paged-mode root guard to `moveItem`

`definition.addItem` blocks root-level non-group items in wizard/tabs mode, but `definition.moveItem` has no equivalent guard. A move with no `targetParentPath` can silently place a field at root level in a paged definition, recreating the hidden-root state the guard prevents.

Fix: apply the same guard from [definition-items.ts#L377](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L377) in `moveItem` at [definition-items.ts#L576](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L576).

Files:
- [definition-items.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts)
- Tests: [definition-items.test.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/tests/definition-items.test.ts)

### 5. Rewrite `innerRules[*].reverse` on move/rename

`rewriteAllPathReferences()` updates top-level `rule.reverse` but skips `innerRules[*].reverse`, leaving stale nested reverse references after move or rename. The mapping schema explicitly allows `innerRules[*].reverse` with `expression` and `condition` fields.

Fix: reuse the top-level reverse rewrite block for each `inner.reverse` inside the `innerRules` loop at [definition-items.ts#L338](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L338).

Files:
- [definition-items.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts)
- Schema ref: [mapping.schema.json#L560](/Users/mikewolfd/Work/formspec/schemas/mapping.schema.json#L560)
- Tests: [definition-items.test.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/tests/definition-items.test.ts)

### 6. Complete FEL popup function metadata

The popup now sources function names from the engine, but enriches them with a partial `FUNCTION_DETAILS` table. Missing entries fall back to `'()'` signature — incorrect for functions like `matches(value, pattern)`, `ceil(num)`, `hours(time)`.

Missing functions: `ceil`, `hours`, `isDate`, `isNumber`, `isString`, `matches`, `minutes`, `readonly`, `seconds`.

Fix (pick one):
- **Preferred:** move signature and description into the engine catalog export so studio doesn't maintain a second source of truth.
- **Quick:** complete the local `FUNCTION_DETAILS` table and add a test asserting no engine function lacks metadata.

Files:
- [FELReferencePopup.tsx#L31](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/FELReferencePopup.tsx#L31)
- [interpreter.ts#L295](/Users/mikewolfd/Work/formspec/packages/formspec-engine/src/fel/interpreter.ts#L295)
- Tests: [fel-reference-popup.test.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/tests/components/ui/fel-reference-popup.test.tsx)

---

## Tier 3 — Low severity

### 7. Fix `MappingTab` uncontrolled active-tab highlight

Button styling at line 61 checks `activeTab === tab.id` (raw prop) instead of `active === tab.id` (derived state). In uncontrolled usage, `activeTab` is `undefined` and no tab highlights.

Fix: change `activeTab` to `active` in the styling condition at [MappingTab.tsx#L61](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx#L61).

Files:
- [MappingTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx)
- Tests: [mapping-tab.test.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/tests/workspaces/mapping/mapping-tab.test.tsx)

### 8. Update stale `moveItem` JSDoc

The handler's JSDoc at [definition-items.ts#L572](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L572) states "Does not rewrite bind/shape paths" but lines 601–604 call `rewriteAllPathReferences()`. Update the doc comment to reflect the current behavior.

Files:
- [definition-items.ts#L555](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/definition-items.ts#L555)

---

## Validation Notes

Relevant test files for each issue (tests currently pass but do not cover the listed issues):
- `packages/formspec-studio-core/tests/definition-items.test.ts` — issues 2, 4, 5
- `packages/formspec-studio-core/tests/definition-screener.test.ts` — issue 3
- `packages/formspec-webcomponent/tests/render-lifecycle.test.ts` — issue 3
- `packages/formspec-studio/tests/components/ui/fel-reference-popup.test.tsx` — issue 6
- `packages/formspec-studio/tests/workspaces/mapping/mapping-tab.test.tsx` — issue 7
