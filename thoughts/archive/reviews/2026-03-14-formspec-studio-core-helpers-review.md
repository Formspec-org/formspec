# Studio-Core Helpers Spec — Combined Review

**Sources:** API/usability review · Technical correctness review (code-verified) · Studio usage analysis (3 parallel agents)

---

> **Root issue (all reviewers converged independently):** The helper layer is being designed around `batchWithRebuild()` not existing — and that single missing primitive is the source of several cascading spec problems. The spec treats it as future debt. All reviews conclude it is the root domino. The studio usage analysis then confirms the real operational patterns helpers must support — and reveals several operations the spec is missing entirely.

---

## CRITICAL Issues

### [API] C1 — `commandResults` in `HelperResult` leaks implementation internals

`commandResults: CommandResult[]` contains `rebuildComponentTree: boolean`, `insertedPath`, etc. — meaningless to LLMs and CLI tools. Drop `commandResults` from the public return type. Add `createdId?: string` for operations that create addressable entities (pages, validation shapes, submit buttons, wrapped layout nodes).

**Studio evidence:** `useComponent.ts` reimplements the authored/generated component merge logic that `Project.component` getter already provides — because raw `CommandResult` types don't expose the right derived views. Nine files use `(definition as any).binds`, `(definition as any).shapes`, `(state.component as any)?.tree?.component` — unsafe casts that a proper `HelperResult` contract would make unnecessary. `canvas-operations.ts` line 261 does `(result as any).nodeRef?.nodeId` to recover a new node ID after `component.wrapNode` — the exact gap `createdId` would close.

### [API] C2 — `renameVariable` is specced in v1 but cannot be implemented

The handler `definition.renameVariable` does not exist in studio-core. The helper will throw `COMMAND_FAILED` at runtime. MCP rev 5 already promises this as a v1 tool. **Contradiction between specs.** Must either defer the helper explicitly (mark "v2 — awaiting handler" in both specs) or build the handler first.

### [TECH] C3 — `removeItem` Steps 3+4 atomicity gap is fixable and should be fixed

The current spec has Step 3 (batch cleanup) succeed and Step 4 (`deleteItem`) potentially throw — leaving cross-references cleaned up but the item still present. Code review confirmed combining Steps 3 and 4 into a single batch is safe: `setBind` null-deletions and `deleteItem` operate on different bind entries, no conflict. This is a one-line fix that eliminates the gap entirely.

### [TECH] C4 — `removeItem` misses inline item expressions

`fieldDependents()` scans `definition.binds`, `definition.shapes`, and `definition.variables` — but NOT inline FEL properties set directly on items (`relevant`, `required`, `readonly`, `calculate`, `constraint` as item properties, not bind entries). Confirmed via `definition-items.ts`: `rewriteAllPathReferences()` handles these during renames. `removeItem`'s dependency collector must too. Forms built via `setItemProperty` for FEL properties will leave dangling expressions after deletion — a real data-integrity gap, not theoretical.

---

## MAJOR Issues

### [API] M1 — `updateItem` / `ItemChanges` is a four-tier grab-bag that will confuse LLMs

Routes item properties, FEL bind expressions, component-tier widget, theme-tier style, and page assignment through one bag. An LLM has no mental model for why `required` takes a FEL string while `label` takes a plain string, or why `style` means "theme override" while `page` means "assign to page."

**Studio evidence:** The same confusion manifests as duplicated dispatch routing in three studio files (`BindsSection.tsx` lines 46–68, `FieldConfigSection.tsx` lines 83–97, `SelectedItemProperties.tsx` lines 148–178) — all containing an identical fork:
```ts
if (type === 'pre-populate') → dispatch setItemProperty { property: 'prePopulate' }
else                         → dispatch setBind { properties: { [type]: value } }
```
This `prePopulate` vs. bind routing is **undocumented** in `ItemChanges`. It must be added to the routing table. At minimum the spec needs the complete key-to-handler routing table; ideally `updateItem` is split: `updateField` for item-level properties only, with bind/style/page covered by the dedicated helpers.

### [API] M2 — `addField` undo-recovery hazard: redo stack corruption

After dispatch #1 succeeds and dispatch #2 fails, `undo()` correctly restores pre-call state. But the redo stack now contains the failed intermediate state (item exists, no widget). If the user calls `redo()`, they get a broken half-state. Fix: after `undo()` recovery, clear the redo stack explicitly. Better fix: `batchWithRebuild()`.

### [API] M3 — No query helpers for state introspection

An LLM that called `addPage` three times has no way to get page IDs to pass to `placeOnPage` — it must parse `project.state.theme.pages` raw internals, directly contradicting the spec's goal of hiding three-tier architecture. MCP works around this with query formatters; CLI and UI consumers are left unprotected. Minimum: add `listPages(project): PageInfo[]`.

**Studio evidence:** `buildDefLookup(items)` (builds path→item map from definition items) is called independently in four places: `EditorCanvas.tsx`, `ItemProperties.tsx`, `LogicTab.tsx`, `usePageStructure.ts`. `normalizeBinds()` exists in two incompatible shapes in `LogicTab.tsx` and `CommandPalette.tsx`. `Project.fieldPaths()` and `Project.bindFor(path)` already exist on the Project API — the studio reinvents them because it doesn't know to use them, and the helpers spec hasn't surfaced them at the right abstraction level.

### [API] M4 — `branch()` auto-detection is invisible to callers

Mode is auto-detected from `on` field's `dataType`, but an LLM cannot predict this without knowing field types. The spec doesn't say what happens when the `on` field doesn't exist yet, or when a `when` value type mismatches the field's dataType. Include the resolution algorithm and error behavior.

### [API] M5 — Snake_case/camelCase inconsistency in property names

`choices_from`, `add_label`, `remove_label` (snake_case) alongside `ariaLabel`, `initialValue` (camelCase) in the same interfaces. LLMs generalize from patterns — inconsistency generates wrong guesses.

### [API] M6 — `updateItem({ widget })` is missing the `presentation.widgetHint` sync — silent data-loss bug

The spec routes `widget` solely to `component.setFieldWidget`. Studio's `WidgetHintSection.tsx` lines 42–58 shows the correct sequence requires two dispatches:
1. `component.setFieldWidget { fieldKey, widget }` — updates component tree
2. `definition.setItemProperty { path, property: 'presentation.widgetHint', value: widgetHintForComponent(widget, dataType) }` — updates definition

The widgetHint on the definition item is what survives form export and reload. Omitting it means fields lose their widget assignment on every round-trip. **This is a silent data-loss bug in the current spec.**

`WidgetHintSection.tsx` also wraps `component.setFieldWidget` in try/catch: `// Some items have no component-tree node yet`. The spec doesn't acknowledge this failure mode. The helper must handle it — either silent skip (matching studio behavior) or `HelperWarning { code: 'COMPONENT_NODE_NOT_FOUND' }`.

### [API] M7 — Missing operations: `wrapItemsInGroup`, `wrapInLayoutComponent`, `batchDeleteItems`, `batchDuplicateItems`

Four concrete operations exist in studio with multiple implementations but no equivalent in the helpers spec:

**`wrapItemsInGroup(project, paths[], label?)`** — `canvas-operations.ts` implements this twice (single-item lines 219–241, multi-select lines 159–185). Both do: `dispatch(addItem group at target position)` → read `insertedPath` → `batch(moveItem × N into group)`. High-frequency structural operation. The spec has `addGroup` and `moveItem` separately but nothing that composes them.

**`wrapInLayoutComponent(project, path, component: 'Card'|'Stack'|'Collapsible')`** — Distinct from `applyLayout`. Dispatches `component.wrapNode { node: { bind: leafKey }, wrapper: { component } }`. `canvas-operations.ts` line 254 does `path.split('.').pop()!` inline — leaf-key extraction a helper should own. Result is read as `(result as any).nodeRef?.nodeId` — another untyped access that `createdId` on `HelperResult` would eliminate.

**`batchDeleteItems(project, paths[])`** / **`batchDuplicateItems(project, paths[])`** — Exact code duplication confirmed: `canvas-operations.ts` lines 139–156 and `MultiSelectSummary.tsx` lines 14–31. Both do: `pruneDescendants(selectedKeys)` → `sortForBatchDelete(pruned)` → `batch(map(deleteItem|duplicateItem))`. These belong on the helpers surface.

### [API] M8 — `addPage` (spec) vs. `addWizardPage` (studio): two different models conflated

The spec's `addPage` dispatches `pages.addPage` (theme-tier page objects). Studio's actual wizard page creation in `StructureTree.tsx` lines 173–192 does:
1. `definition.addItem { type: 'group', key, label: 'New Page' }` — definition-tier group
2. `definition.setFormPresentation { property: 'pageMode', value: 'wizard' }` — conditional: only if not already paged

These are different: wizard groups are definition-tier (they appear in the response structure); `pages.addPage` creates theme-tier navigation objects. Using `addPage` for a wizard form does the wrong thing. The spec must either distinguish them or document exactly when each is appropriate.

### [TECH] M9 — `copyItem` dispatch sequence underspecified for `deep: true`

Code review confirmed `duplicateItem` only clones the item subtree — it does not touch binds or shapes. The `deep: true` path must dispatch multiple `setBind`/`addShape` commands after `duplicateItem`, but the FEL rewriting algorithm, shape ID generation for cloned shapes, and recursive group handling are unspecified.

### [TECH] M10 — `batch()` bypasses middleware — undocumented

Design Decision #1 says helpers use `batch()` to bypass middleware, but doesn't fully account for the consequence: all helpers except `addField` bypass middleware entirely. If any middleware performs authorization or validation, helper-dispatched mutations circumvent it silently.

### [API] M11 — Key generation ownership is undefined

Studio's `EditorCanvas.tsx` lines 44–47 uses a module-level counter (`let nextItemId = 1; function uniqueKey(prefix)`) that resets on hot reload and is not collision-safe across sessions. The helpers spec says nothing about how `path` values are generated for `addField`, `addGroup`, etc. Every consumer ends up implementing their own key generation. The spec must either: (a) state that callers supply the full path (including generated key), or (b) define a key generation contract on Project or the helpers module.

---

## MINOR Issues (consolidated)

- `HelperError` is specced as `interface` but you cannot `throw` an interface — must be `class HelperError extends Error`
- `addContent` `kind` values are out of sync between helpers spec and MCP rev 5 (`paragraph` listed in spec, but `instructions` is the correct alias mapping to `paragraph` widgetHint)
- No `INSTANCE_NOT_FOUND` error code — has `VARIABLE_NOT_FOUND` but not its instance equivalent; `definition.setInstance` throws "Instance not found" which the helper layer should catch
- `moveItem` is a pass-through with zero added value — document it as a convenience wrapper or add path/bounds validation
- `applyStyle` leaf-key collision (acknowledged in spec) should emit `HelperWarning { code: 'AMBIGUOUS_ITEM_KEY', detail: { conflictingPaths } }` when the leaf key is shared across groups
- `branch()` should pre-validate `on` field existence before building FEL expressions — currently generates dangling references silently
- `removeItem` shape cleanup is lossy: deletes the entire shape when any expression is broken, even if the shape references multiple fields. Consider clearing the broken property and emitting a warning instead, leaving the shape skeleton for repair
- `setMetadata` "submitMode/language rejected as INVALID_KEY" — verify `language` is not actually valid in the definition schema before documenting the rejection reason
- **Widget Alias Table is incomplete:** studio's `field-helpers.ts` contains `WIDGET_MAP`, `COMPONENT_TO_HINT`, `HINT_TO_COMPONENT` with 60+ entries vs. the spec's ~10. These are the authoritative vocabulary mappings and should be ported into the spec verbatim
- **`renameItem` should document `affectedPaths[0]` = new path:** studio's `ItemProperties.tsx` lines 42–46 manually reconstructs the post-rename path (`parentPath ? ${parentPath}.${nextKey} : nextKey`) after every `renameItem` dispatch. Documenting that `affectedPaths[0]` is the new full path would eliminate this pattern everywhere
- **`addGroup` and `addContent` need `affectedPaths` contract clarified** — what is `affectedPaths[0]` for a display item with no "path" in the response sense?

---

## Top 5 Spec Changes Before Implementation

*(Expanded from 3 to capture the studio-validated additions)*

1. **Combine `removeItem` Steps 3+4 into a single batch** (C3). Trivial change, eliminates the atomicity gap. Simultaneously add inline item expression scanning to the dependency collector (C4) — forms using `setItemProperty` for FEL properties silently produce dangling references otherwise.

2. **Replace `commandResults` with `createdId?: string` in `HelperResult`** (C1). One type change. Fixes page ID ergonomics, validation shape ID ergonomics, submit button node ID, and `wrapInLayoutComponent` node ID simultaneously. The studio's `(result as any).nodeRef?.nodeId` pattern is the concrete evidence of what this buys.

3. **Defer `renameVariable` explicitly, or build `definition.renameVariable` handler first** (C2). The current spec promises a v1 tool that throws `COMMAND_FAILED` at runtime. Mark "v2 — awaiting handler" in both specs, or build the handler.

4. **Add `wrapItemsInGroup`, `batchDeleteItems`/`batchDuplicateItems`, and clarify `addWizardPage` vs `addPage` distinction** (M7, M8). These are real operations with multiple implementations in the studio today — the most concrete evidence of what helpers should replace.

5. **Fix `updateItem({ widget })` to include `definition.setItemProperty(presentation.widgetHint)` and document the `COMPONENT_NODE_NOT_FOUND` warning** (M6). Silent data-loss bug: exported forms lose widget assignments on reload. `WidgetHintSection.tsx` is the concrete evidence.

---

> **Structural tension (all three analyses converged):** The spec tries to hide the three-tier architecture from consumers while simultaneously leaking it through `commandResults`, the `ItemChanges` routing table, and the convention that `affectedPaths[0]` is a page ID. The studio analysis makes this concrete: nine files use `as any` casts into `definition.binds`, `definition.shapes`, and `state.component` — all reaching past the abstraction boundary the helpers are supposed to provide. The fix is not more helpers — it is a cleaner `HelperResult` contract that actually abstracts away tier internals.
