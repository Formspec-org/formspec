# Studio-Core Helpers Spec — Round 2 Review

**Sources:** API/usability review · Technical correctness review (code-verified) · Coverage/edge-case review · Studio dispatch-pattern analysis · Studio Boy Scout analysis (5 parallel opus agents)

**Spec version reviewed:** Rev 6 (studiofixes branch)

---

> **Root finding (code-verified):** Rev 6 fixed most structural issues from round 1. This round surfaces four implementation-blocking bugs (dispatch signature mismatch, clearRedo missing, addGroup two-phase, addItem type field wrong), plus a strong set of API inconsistencies and missing coverage that are straightforward to fix before implementation begins.

---

## CRITICAL — Implementation Blockers

### [TECH-C1] `dispatch()` notation throughout spec uses two-arg form; actual signature is single object

`project.dispatch()` takes one `AnyCommand` argument: `dispatch({ type, payload })`. The spec uses `dispatch('definition.setBind', { ... })` notation throughout (lines 65, 390–395, 455–457, 653–655, 812). Every helper written directly from the spec will fail to compile.

**Fix:** Add a note at the top of the helpers section: "All `dispatch('type', payload)` notation in this spec is shorthand for `dispatch({ type: 'type', payload })`. `batch()` commands use the full object form already."

---

### [TECH-C2] `clearRedo()` does not exist — interim protocol destroys ALL undo history

Design Decision #5 says on second-dispatch failure: "(2) clear the redo stack (via `project.resetHistory()` or equivalent `clearRedo()`)". `project.resetHistory()` clears **both** undo and redo stacks (confirmed: `project.ts:1688-1691`). There is no `clearRedo()` method on Project.

**Impact:** After a second-dispatch failure in `addField`, `wrapItemsInGroup`, or `copyItem(deep: true)`:
1. `project.undo()` moves the first dispatch's snapshot to the redo stack.
2. `project.resetHistory()` destroys the entire undo + redo stack.
The user loses all undo history — a severe data-loss regression for the UI.

**Fix:** Add `clearRedo()` to Project (one line: `this._redoStack.length = 0`). List in Future Work. Until it exists, the interim protocol should call `resetHistory()` with a documented caveat that all history is lost.

---

### [TECH-C3] `addGroup` with `props.display` is a two-phase operation — not listed as such

`definition.addItem` returns `{ rebuildComponentTree: true }`. `component.setGroupDisplayMode` looks up the node by `{ bind: groupKey }` — which does not exist until after the rebuild. If both are in a single `batch()`, `setGroupDisplayMode` throws `"No component node bound to group: ..."` (confirmed: `component-properties.ts:407-415`).

**Fix:** Add `addGroup` (when `props.display` is set) to the two-phase helper list in Design Decision #5. Apply the same TARGET (batchWithRebuild) + INTERIM dispatch protocol.

---

### [TECH-C4] `definition.addItem` payload has wrong `type` field

Line 377: `definition.addItem { key, type: dataType, dataType, label, ... }` — passes the data type string as `type`.

`type` is the item category (`'field'` | `'group'` | `'display'`), not the data type. The handler's `buildItem()` would create an item with `type: 'string'` or `type: 'integer'` — not `type: 'field'`. Must be `type: 'field', dataType: resolvedDataType`.

**Fix:** Change line 377: `type: dataType` → `type: 'field'`. (Confirmed in `definition-items.ts:390-424`.)

---

### [TECH-C5] `component.addNode` for `addSubmitButton` missing required `parent` NodeRef

`component.addNode` requires `{ parent: NodeRef, component, props? }`. The spec shows only `{ component: 'SubmitButton', props: { label } }` with no parent. The handler will throw `"parent is required"` (confirmed: `component-tree.ts:160-195`).

**Fix:** Add `parent: { nodeId: 'root' }` to the dispatch in `addSubmitButton`.

---

### [API-C1] `FieldProps.required` is `boolean`, `ItemChanges.required` is `string` — type clash

An LLM learns `required: true` from `addField`, then passes `required: true` to `updateItem` — which expects a FEL string. Same for `readonly`. Silent coercion to `"true"` is not valid FEL.

**Fix:** Change `ItemChanges.required` and `ItemChanges.readonly` to `boolean | string`. Document: when `true` → maps to `'true()'`; when `false` or `null` → null-deletion; when string → passes through as FEL.

---

## MAJOR — Fix Before Implementation

### [TECH-M1] `mapping.deleteRule` indices must be sorted descending in `removeItem`

`removeItem` collects all mapping rule indices then dispatches `mapping.deleteRule { index }` per rule in a single batch. The handler splices by index. If multiple rules match, deleting lower-index entries first shifts subsequent indices, causing off-by-one deletions or deleting the wrong rules.

**Fix:** Add to the `removeItem` algorithm: "Sort mapping rule indices in descending order before dispatching `mapping.deleteRule` commands."

---

### [TECH-M2] `copyItem(deep: true)` — use `rewriteFELReferences()`, not `expressionDependencies()`

Line 808: "use `project.expressionDependencies()` to find references; rewrite via string substitution."

`project.expressionDependencies()` only returns which paths appear in an expression — it does not rewrite. The correct function is `rewriteFELReferences()` from `formspec-engine` (used in `definition-items.ts:220-226` for `renameItem`). String substitution is fragile (path prefix collisions).

**Fix:** Replace line 808 with: "use `rewriteFELReferences(expr, { rewriteFieldPath(path) { return rewritePathPrefix(path, oldPath, newPath); } })` from `formspec-engine` — the same function used by `definition.renameItem` internally."

---

### [TECH-M3] `makeRepeatable` pre-condition: component node must exist before dispatch

`component.setGroupRepeatable` and `component.setNodeProperty` (addLabel/removeLabel) look up the component tree node by bind key. If `makeRepeatable` is called on a group just added in the same transaction (before the tree is rebuilt), these handlers throw.

**Fix:** Add a pre-condition note: "`makeRepeatable` requires the group's component tree node to already exist. If the group was just created with `addGroup()`, `addGroup()`'s dispatch must complete (including tree rebuild) before calling `makeRepeatable`."

---

### [API-M1] `addField` path parameter: insertIndex not supported; parsing rules undocumented

`addField(project, path, label, type, props?)` takes `path` as a dot-path (`'contact.email'`). The helper must parse this into `parentPath: 'contact'` + `key: 'email'` before dispatching. This parsing is never documented. Additionally, `definition.addItem` supports `insertIndex` for field ordering within a group, but there is no way to pass it — LLMs cannot control field ordering without a separate `moveItem` call.

**Fix:** (a) Document path parsing: "The last segment of `path` is the key; preceding segments are the `parentPath`. Root-level fields use a bare key (e.g., `'email'`)." (b) Add `insertIndex?: number` to `FieldProps`.

---

### [API-M2] `widgetHintFor()` mapping function referenced but never defined

Lines 281–286 and the `widget` routing in `ItemChanges` reference `widgetHintFor(widget)` to compute `presentation.widgetHint` before the second dispatch. This function is never defined anywhere in the spec.

**Fix:** Add a column to the Widget Alias Table showing `presentation.widgetHint` value for each widget (most are 1:1 with the alias; `textarea` is `'textarea'`; components with no widgetHint = `undefined`). State the general rule: if the alias maps directly to a single component with no extra props, `widgetHint` = the alias string; exceptions are called out.

---

### [API-M3] `branch()` silently overwrites existing `relevant` expressions

If a field already has a `relevant` bind (from a prior `showWhen` or `branch` call), `branch()` overwrites it silently. Building complex forms with multiple conditional layers will break earlier conditions with no warning.

**Fix:** Pre-validate: if any target path already has a `relevant` bind, emit `HelperWarning { code: 'RELEVANT_OVERWRITTEN', detail: { path, previousExpression } }`. Document the composition pattern: "To combine conditions, use `showWhen()` directly with a hand-authored FEL expression."

---

### [API-M4] `addValidation` `rule` → `constraint` mapping not documented; `target` semantics not explained

The `addShape` handler takes `{ constraint, target, message, ... }`. The helper's `rule` parameter maps to `constraint`. This is never stated. Similarly, `target` accepts wildcards (`items[*].amount`), form-level (`'*'`), and group-level paths — none of which are documented.

**Fix:** Add dispatch mapping comment: `// rule → shape.constraint, target → shape.target`. Document target semantics: "dot-path for field-level, wildcard path for repeat group members (e.g. `'items[*].amount'`), `'*'` for form-level cross-field validation."

Same fix applies to `updateValidation.changes.rule` → dispatches as `{ property: 'constraint', value: changes.rule }`.

---

### [COVER-M1] Missing `reorderItem(project, path, direction)` helper

`definition.reorderItem` handler exists (swap-with-neighbor). No helper wraps it. `moveItem` handles cross-parent moves but not in-place reordering. `reorderPage` and `reorderScreenRoute` have parallel helpers. The gap is inconsistent.

**Fix:** Add:
```typescript
// Reorder item within its parent (swap with neighbor)
// Dispatches: definition.reorderItem { path, direction }
// direction 'up' swaps with previous sibling; 'down' swaps with next.
// No-op if item is already at the boundary.
export function reorderItem(project: Project, path: string, direction: 'up' | 'down'): HelperResult
```

---

### [COVER-M2] Missing `default` bind property in `ItemChanges`

The core spec defines a `default` bind property: value applied when a previously non-relevant field becomes relevant again (distinct from `initialValue`). `removeItem` already mentions cleaning up `default` expressions, but `ItemChanges` does not expose it and there is no helper for it.

**Fix:** Add `default?: string` to `ItemChanges` routing table: `→ definition.setBind (null = delete)`.

---

### [API-M5] `INVALID_FEL` is in the error table but no helper documents when it is thrown

The error code exists with `detail.parseError.*`, but no helper description mentions FEL validation. LLMs cannot self-correct from `INVALID_FEL` if they don't know which helpers validate expressions.

**Fix:** Add a global statement in the helpers intro: "All helpers that accept a FEL expression string (`showWhen`, `readonlyWhen`, `require`, `calculate`, `addValidation`, `branch`, `updateItem` bind properties) parse the expression via `project.parseFEL()` before dispatching. Invalid expressions throw `INVALID_FEL`."

---

## MINOR

### [API-m1] `addContent` kind default not specified
Document: "Defaults to `'paragraph'` when omitted."

### [API-m2] `addVariable` scope parameter not documented
Document valid scope values and semantics, or remove the parameter if unused.

### [API-m3] `addScreenField` uses `key`, `addField` uses `path` — inconsistent naming
Document the distinction: screener items are always root-level (no nesting), so `key` is always a simple identifier with no dot-path semantics.

### [API-m4] `updateInstance` takes `property + value` separately — inconsistent with all other `update*` helpers
`updateItem`, `updatePage`, `updateValidation`, `updateScreenRoute`, `updateVariable` all take a changes bag. `updateInstance` takes `(name, property, value)` — one property per call. Change to `updateInstance(project, name, changes: Partial<InstanceProps>)` fanning out to `definition.setInstance` per property.

### [API-m5] `removeVariable` and `removeInstance` don't warn about broken references
`removeItem` cleans up FEL references; `removeInstance` documents "does NOT clean up @instance() FEL references — run audit() afterward" with no warning. `removeVariable` has no note at all.

At minimum, both should emit `HelperWarning { code: 'DANGLING_REFERENCES', detail: { referenceCount: N, paths: [...] } }` listing broken references. The Project can scan for these using `project.variableDependents()` and a similar scan for `@instance('name')` patterns.

### [TECH-m1] `component.setFieldWidget` throws on missing node — helper must catch
`component.setFieldWidget` throws `"No component node bound to field: ..."` (confirmed `component-properties.ts:309`). The spec says emit `COMPONENT_NODE_NOT_FOUND` warning. The dispatch must be wrapped in try/catch explicitly.

**Fix:** Add: "The `component.setFieldWidget` handler throws when the node is absent. Wrap in try/catch; catch → emit `COMPONENT_NODE_NOT_FOUND` warning and continue."

### [TECH-m2] `addWizardPage` — setFormPresentation vs pages.setMode

`pages.setMode` additionally ensures `theme.pages` exists and triggers `rebuildComponentTree: true`. `addWizardPage` uses `definition.setFormPresentation` which does neither. If studio's wizard model (top-level groups as pages) requires `theme.pages`, this is a bug.

**Fix:** Verify whether wizard mode requires `theme.pages`. If not, document that `definition.setFormPresentation` is intentional. If yes, change to `pages.setMode`.

### [TECH-m3] `removeItem` batch "independence" note needed

The Project documents batch commands as "independent: if a command needs results from an earlier command in the same batch, use sequential dispatch() calls instead." The `removeItem` batch mixes cleanup commands with `definition.deleteItem`. They operate on distinct entries (confirmed safe), but this contradicts the stated batch contract.

**Fix:** Add a note to `removeItem`: "The cleanup commands (`setBind` null-deletions, `deleteShape`) and `deleteItem` in this batch operate on distinct entries and do not conflict despite the Project's documentation warning."

### [COVER-m1] `copyItem(deep: true)` self-reference rewriting rule not stated

Does `age_copy` with constraint `age > 0` become `age_copy > 0` or stay `age > 0`? Implementers will make different choices.

**Fix:** Add: "Self-references within copied bind expressions MUST be rewritten to the new path. The copy's binds must be self-contained — referencing the copy's own fields, not the original's."

### [COVER-m2] `makeRepeatable` has no inverse

No `unmakeRepeatable` and no `repeatable`/`minRepeat`/`maxRepeat` in `ItemChanges`. The only reversal path is raw dispatch.

**Fix:** Add `repeatable?: boolean`, `minRepeat?: number`, `maxRepeat?: number` to `ItemChanges` routing to `definition.setItemProperty`, so `updateItem` handles it.

---

## Studio Evidence — DRY & Boy Scout (from 2 studio exploration agents)

These findings confirm the spec design is on the right track and surface additional context for Future Work.

### Confirmed existing patterns that helpers would replace

| Pattern | Files (count) | Helper | Correctness fix? |
|---|---|---|---|
| `pruneDescendants + sortForBatchDelete + batch(deleteItem)` | 2 | `batchDeleteItems` | **Yes** — no FEL cleanup today |
| `pruneDescendants + sortForBatchDelete + batch(duplicateItem)` | 2 | `batchDuplicateItems` | No |
| `addItem + moveItem(s)` (wrap in group) | 2 variants, same file | `wrapItemsInGroup` | No |
| bare `definition.deleteItem` with no cleanup | **5 separate files** | `removeItem` | **Yes** — 5 active bug sites |
| `definition.addItem + path-resolve + select` | 3 files | `addField/addWizardPage` | Fixes key collision |
| `component.setFieldWidget + definition.setItemProperty(widgetHint)` | 1 file | `updateItem({widget})` | **Yes** — already spec'd |

### `normalizeBinds()` — 4 incompatible implementations (→ Future Work)

`normalizeBinds()` exists in 4 forms:
- `StudioApp.tsx` — normalizes + rewrites legacy `true()` expressions
- `CommandPalette.tsx` — normalizes without expression rewriting
- `LogicTab.tsx` — normalizes + incorporates `prePopulate` from item definitions
- `field-helpers.ts` `bindsFor()` — yet another variant

All of these work around the fact that `project.bindFor(path)` exists for single-path access but there's no `project.allBindsNormalized()` for bulk access. Adding this query to Project would eliminate 60+ lines of duplicated code.

### `buildDefLookup()` — 4 independent usages (→ Future Work)

`buildDefLookup(items as any)` is called in 4 files to build a path→item map from the definition item tree. Every call requires `as any` cast and imports from `tree-helpers`. `project.fieldPaths()` exists but returns paths only. A `project.itemAt(path)` or `project.defLookup()` would eliminate all 4 usages.

### `uniqueKey()` collision risk — confirmed in 2 files (→ Future Work)

`StructureTree.tsx` and `EditorCanvas.tsx` each have their own module-level counter starting at 1. These can generate the same key (`string1`, `group2`, etc.) independently. Neither checks existing definition keys. A `generateUniqueKey(prefix, project)` utility inside studio-core or the helpers module would fix the collision risk and is naturally the key generation contract missing from the spec (issue [M11] from round 1).

### `as any` casts — 25+ across 15 files

Most casts are into properties that ARE typed on `FormspecDefinition` (`instances`, `optionSets`, `migrations`, `variables`, `binds`, `shapes`, `formPresentation`). Root cause: `buildDefLookup` and other lib functions accept looser types than `FormspecItem[]`, forcing casts at call sites. Not a helpers spec issue, but confirms the helpers spec should not leak raw definition access.

---

## Top 5 Spec Changes (Priority Order)

1. **Fix 6 CRITICAL implementation bugs** (TECH-C1 through TECH-C5, API-C1): dispatch notation, clearRedo, addGroup two-phase, addItem type field, addSubmitButton parent, FieldProps.required type. These are implementation blockers.

2. **Fix `copyItem(deep: true)` FEL rewriting** (TECH-M2): replace `expressionDependencies()` with `rewriteFELReferences()`. Different function, different behavior.

3. **Add `reorderItem` + `default` bind + `updateInstance` changes bag** (COVER-M1, COVER-M2, API-m4): three small additions that close obvious lifecycle gaps before the API surface is considered stable.

4. **Document `widgetHintFor()` mapping and `INVALID_FEL` coverage** (API-M2, API-M5): one is a missing mapping table, the other is a missing global statement. Both are blockers for implementers.

5. **Fix `mapping.deleteRule` descending sort + `branch()` RELEVANT_OVERWRITTEN warning** (TECH-M1, API-M3): two correctness issues that would produce silent data corruption at runtime.

---

## New Future Work Items (additions to spec)

- **`clearRedo()` on Project** — one-line addition; unblocks safe interim protocol for two-phase helpers
- **`project.allBindsNormalized()` query** — consolidates 4 incompatible `normalizeBinds` implementations
- **`project.defLookup()` query** — consolidates `buildDefLookup` called from 4 files with `as any`
- **`generateUniqueKey(prefix, project)` utility** — fixes collision risk in `uniqueKey()` duplication across 2 files
- **`addGroup` two-phase designation** — add to batchWithRebuild target list (currently only `addField`, `wrapItemsInGroup`, `copyItem(deep: true)`)
