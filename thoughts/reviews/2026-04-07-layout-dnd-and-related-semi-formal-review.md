# Semi-formal code review — layout DnD + related changes

**Scope:** `git diff HEAD` (uncommitted / working tree vs `HEAD`).  
**Method:** Evidence from file:line; static analysis unless noted.

---

## Implementation plan (research & proposal)

This plan closes the gaps called out in **Findings 1–5** and the **Conclusion** below. It assumes red–green: add or extend a failing test for each behavioral change before implementation.

### Goals

1. **Eliminate incorrect sibling reordering** when `sortablePlacement` is absent — **done** via `siblingIndicesForTreeReorder` / `findParentOfNodeRef` (see **Conclusion**).
2. **Resolve or bound dual-droppable risk** on the layout container shell — **manual QA / Phase 2** only until a bug is reproduced.
3. **Tighten confidence** — **partially done:** Vitest `extractSortablePlacement` contracts + Playwright spatial reorder; optional sortable-only E2E remains.

### Design fork (pick one before coding Finding 1)

| Approach | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. Tree-derived fallback** | When `placement` is null, `sourceRef`/`targetRef` exist, and `areComponentNodeSiblings` holds, compute source/target indices by walking the parent’s `children` in `project.component.tree` and derive `'up' \| 'down'` for `handleTreeReorder`. | Single source of truth; no duplicate index in React `data`. | Requires a small, well-tested tree helper (parent lookup + indexOf). |
| **B. Restore `index` in sortable `data`** | Mirror `sortableIndex` (and optionally group id) into `useSortable({ data: { …, index } })` on `FieldBlock` / `LayoutContainer`. | Minimal change to `handleDragEnd`; fallback behaves as before. | Duplicates information already owned by Sortable; can drift if data is stale vs internal sortable state. |
| **C. Remove fallback** | Delete the block at `LayoutDndProvider.tsx:245–254` if **every** in-canvas drag is guaranteed to produce non-null `extractSortablePlacement(source)`. | Smallest diff. | **High risk** unless proven: `extractSortablePlacement` returns null when `data.type !== 'tree-node'` or index/group missing (`LayoutDndProvider.tsx:127–141`). |

**Recommendation:** **A (tree-derived fallback)** unless profiling shows hot-path cost; it preserves `handleTreeReorder` for any future non-sortable sibling drags without lying in `data`.

### Phased work

**Phase 0 — Documentation & hygiene (same PR as Phase 1 or immediate follow-up)**

- Fix the stale comment at `LayoutDndProvider.tsx:266` (`isDragging` → `isDragSource` or neutral wording).
- Document the `bind:` group encoding contract next to `layoutSortGroupToTargetParent` (`LayoutDndProvider.tsx:115–124`) and/or the call site in `render-tree.tsx` (Finding 5): what strings are valid groups, and that real `nodeId` values must not use the `bind:` prefix.

**Phase 1 — Finding 1 (correctness)**

1. Add a **failing unit test** for `handleDragEnd`: sibling `source`/`target` with `nodeRef`s, **no** `sortablePlacement`, and **no** `index` in `source.data`/`target.data` — assert the project still receives the correct `reorderComponentNode` direction (or document intentional no-op if product says so).
2. Implement the chosen fork (**A** recommended): e.g. `findSiblingIndices(tree, parent, sourceRef, targetRef)` returning `{ sourceIndex, targetIndex } | null`, then reuse existing `handleTreeReorder` logic.
3. If **B** is chosen instead, add `index` (and verify group if needed) to sortable `data` and add a test that fallback indices match `sortableIndex`.

**Phase 2 — Finding 2 (LayoutContainer layering)**

1. **Manual QA matrix:** nested `LayoutContainer` inside `LayoutContainer`, grid vs stack, drag field vs drag container, drop on `container-drop` vs insert slot vs sortable reorder. Note any wrong-target or “stuck” drop.
2. If mis-hits occur: **spike** moving `useDroppable` (`container-drop`) to an **inner** element (e.g. chrome/header strip) so Sortable’s droppable facet and explicit container drop do not share the same geometry; keep `useSortable` on the outer interactive shell. Re-run the matrix.
3. Only merge structural DOM changes if the spike fixes a reproduced bug (avoid layout churn without evidence).

**Phase 3 — Finding 4 (integration-style test)**

- Prefer **Vitest + real `DragDropProvider`** with a minimal layout tree (one stack, two `FieldBlock`s) if the test harness can fire a realistic `onDragEnd` with `operation.source` shaped like production. If that is impractical, add **one Playwright** case: drag block A before B, assert tree order or DOM order changed.
- Keep the existing pure `handleDragEnd` tests; they remain the fast regression net.

**Phase 4 — Verification**

- `npm test` (or scoped `packages/formspec-studio` Vitest) and, if Playwright added, the new E2E.
- Optional: log (dev-only) when fallback runs after Phase 1 to confirm path is rare or dead as expected.

### Risks & out of scope

- **Risks:** Tree-walk bugs (wrong parent for bind-only nodes); Playwright flakiness on DnD — use stable selectors and `data-testid` on handles.
- **Out of scope for this plan:** `gemini-adapter.ts` and `FormspecPreviewHost.tsx` changes in the same diff — no behavioral coupling to layout DnD; review them separately if needed.

### Implementation status (follow-up)

| Phase | Status | Notes |
| --- | --- | --- |
| **0** | Done | `LayoutDndProvider` DragOverlay comment uses `isDragSource`; `layoutSortGroupToTargetParent` JSDoc documents `bind:` vs `nodeId`; `render-tree` cross-reference on `sortableGroupId`. |
| **1** | Done | `findParentOfNodeRef`, `siblingIndicesForTreeReorder`, sibling fallback in `handleDragEnd` uses tree indices; `layout-dnd-provider.test.tsx` updated + new cases. |
| **2** | Open (checklist) | No code change until a mis-hit is reproduced. **Manual QA:** nested `LayoutContainer` in `LayoutContainer`; grid vs stack; drag field vs container chrome; drop on insert slot vs `container-drop` row vs sortable peer; confirm expected `moveComponentNodeToIndex` / `reorder` behavior. |
| **3** | Done | `extractSortablePlacement` **exported** + Vitest contract cases (`layout-dnd-provider.test.tsx`) for top-level vs nested `sortable` shapes. Playwright: `reorders fields within a Stack using a spatial insert slot` in `layout-components.spec.ts` (validates live DnD + `handleSpatialDrop`; insert-slot still preempts sortable in `handleDragEnd`). |
| **4** | Partial | `vitest run tests/workspaces/layout/` passes (layout suite). Run `npx playwright test tests/e2e/playwright/layout-components.spec.ts` locally (`packages/formspec-studio`, dev server via Playwright config). |

### Post-review code fixes (tray + drag UI)

- **`handleTrayDrop`:** Unassigned tray items **already exist in the definition**; calling `addItemToLayout` → `addField` threw duplicate-key and the E2E “tray back to canvas” case never showed `layout-field-*`. Now **`project.itemAt(key)`** → **`placeOnPage(key, activePageId ?? 'root')`**; only unknown keys use **`addItemToLayout`**. See `LayoutDndProvider.tsx` (`handleTrayDrop`).
- **`onDragStart`:** **`setLayoutDragActive(true)`** on every drag in the provider so **insert slots** render for **tray `useDraggable`** drags (payload shape may omit `operation.source.id` reliably).

---

## Executive summary

**Remediation:** See **Implementation plan (research & proposal)** and **Implementation status** at the top.

**Original review issues (historical):** sibling fallback vs missing drag `index`; dual-droppable on `LayoutContainer`; stale `isDragging` comment; thin integration coverage for sortable source shape.

**Current status (after follow-up implementation):**

1. **Sibling fallback** — **Resolved:** `siblingIndicesForTreeReorder` + `findParentOfNodeRef` derive indices from `project.component.tree` (`LayoutDndProvider.tsx:299–311`). No reliance on `sourceData.index` / `targetData.index`.
2. **`LayoutContainer` layering** — **Open (manual QA only):** `useSortable` + `useDroppable(container-drop)` still share the outer shell until a mis-hit is reproduced (Phase 2 checklist).
3. **Stale comment** — **Resolved:** provider JSDoc references `isDragSource` (`LayoutDndProvider.tsx:323`).
4. **Tests** — **Improved:** Vitest for `extractSortablePlacement` contract shapes; Playwright stack + grid insert-slot reorder; tray tests updated for `placeOnPage` vs `addItemToLayout`. **Remaining gap:** no dedicated E2E that ends in **sortable-only** placement (no insert-slot) to assert live `operation.source` through `extractSortablePlacement`.
5. **Tray duplicate-key** — **Resolved (post-review):** `handleTrayDrop` uses `placeOnPage` when `project.itemAt(key)` (`LayoutDndProvider.tsx:97–111`); `onDragStart` always sets layout drag active for insert slots (`LayoutDndProvider.tsx:330–334`).

---

## Consolidated function trace (behavior-critical)

| Function / method | File:Line | Inputs | Output | Verified behavior |
| --- | --- | --- | --- | --- |
| `findParentOfNodeRef` | `LayoutDndProvider.tsx:20–40` | tree, `NodeRef` | parent or `null` / `undefined` | Walks tree; returns parent of matching node |
| `siblingIndicesForTreeReorder` | `LayoutDndProvider.tsx:50–68` | tree, two `NodeRef`s | indices or `null` | Shared-parent sibling indices for fallback reorder |
| `handleTrayDrop` | `LayoutDndProvider.tsx:97–111` | project, tray item, `activePageId` | void | Existing def → `placeOnPage`; else `addItemToLayout` |
| `moveComponentNodeToIndex` | `project.ts:~3636` | `ref`, `targetParent`, `insertIndex` | `HelperResult` | Dispatches `component.moveNode` |
| `handleSpatialDrop` | `LayoutDndProvider.tsx:132` | `sourceRef`, `targetParent`, index | void | Calls `moveComponentNodeToIndex` |
| `layoutSortGroupToTargetParent` | `LayoutDndProvider.tsx:170` | `group` | parent ref or null | `bind:` vs `nodeId` encoding |
| `extractSortablePlacement` | `LayoutDndProvider.tsx:181` | raw source | payload or null | `tree-node` + `index`/`group` from source or nested `sortable` |
| `handleDragEnd` | `LayoutDndProvider.tsx:218–312` | normalized `DragEndEvent` | void | Tray → insert-slot / container-drop → sortable → **tree-based** sibling fallback |
| `areComponentNodeSiblings` | `LayoutDndProvider.tsx:72–82` | tree, two refs | boolean | Delegates to `findParentOfNodeRef` |
| `renderLayoutTree` | `render-tree.tsx` | …, `sortableGroupId` | `ReactNode[]` | Indexed loop; threads sortable group + index |
| `LayoutContainer` (hooks) | `LayoutContainer.tsx` | sortable + droppable | refs | `useSortable` + `useDroppable` on same root `div` |
| `FieldBlock` `useSortable` | `FieldBlock.tsx` | `sortableGroup`, `sortableIndex` | `isDragSource` | `data`: `nodeRef` + `type: 'tree-node'` (no list index in `data`) |

---

## Per-file diff review (`git diff HEAD`)

### `packages/formspec-studio-core/src/project.ts`

**Delta:** `moveComponentNodeToIndex` second parameter changes from `targetContainerId: string` to `targetParent: { nodeId?: string; bind?: string }`; dispatch passes `targetParent` through; summary/`action.params`/`affectedPaths` use `targetKey = nodeId ?? bind`.

**Intent:** Support bind-only container parents in the component tree (aligns with `component.moveNode` handler accepting either ref shape).

**Callers updated in this diff:** `LayoutDndProvider.handleSpatialDrop` and tests (`project-methods.test.ts`).

**Observation:** API break for any external caller of `moveComponentNodeToIndex` still passing a string — repo-internal usages in diff are updated.

---

### `packages/formspec-studio/src/workspaces/layout/LayoutDndProvider.tsx`

**Delta (cumulative):** Sortable routing + `extractSortablePlacement` (exported) + `moveComponentNodeToIndex` target-parent object; **`findParentOfNodeRef`**, **`siblingIndicesForTreeReorder`**, sibling **fallback uses tree indices** (`LayoutDndProvider.tsx:299–311`); **`handleTrayDrop`** branches **`placeOnPage`** vs **`addItemToLayout`** (`97–111`); **`onDragStart`** always **`setLayoutDragActive(true)`** (`330–334`) for tray insert slots; JSDoc for `bind:` encoding and `isDragSource` (`323`).

**dnd-kit:** Sortable `group`/`index` / `initial*` align with grouped list moves; `extractSortablePlacement` reads nested `source.sortable` when needed.

---

### `packages/formspec-studio/src/workspaces/layout/render-tree.tsx`

**Delta:** `renderContainer` + `renderLayoutTree` take `sortableGroupId` (default `'root'`) and sibling index `i`; `for` loop indexed; Page children recurse with `pageSortGroup = node.nodeId ?? pageId`; layout nodes use `innerSortGroup = node.nodeId!`; groups use `node.nodeId ? node.nodeId : \`bind:${node.bind}\``; passes`sortableGroup`/`sortableIndex` into `FieldBlock`,`DisplayBlock`,`renderContainer`; group`extraProps` may include `nodeId` when present for insert-slot `nodeId`.

**Invariant:** Sibling `sortableIndex` matches visual sibling order only if `nodes` array order matches rendered order (same as prior `for..of`).

---

### `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx`

**Delta:** Single argument: passes `'root'` as last arg to `renderLayoutTree` (`~673`).

**Caller:** Top-level canvas children use stack root `nodeId` `'root'` from core tree bootstrap — consistent with `layoutSortGroupToTargetParent` decoding.

---

### `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx`

**Delta:** `useDraggable` → `useSortable` (`id`, `group`, `index`, `data` without index in sortable payload); required `sortableGroup` / `sortableIndex`; merged `dropRef` + `sortableRef` on outer shell; `InsertSlot` uses `isDropTarget` for visual state; taller min-height slots; collapsed collapsible/accordion append `InsertSlot` at `layoutChildCount` with hint UI; drag handle uses callback ref setting `dragHandleRef.current` + `connectSortableHandle`.

**Collision / layering:** Same DOM node registers both Sortable (draggable + internal droppable) and explicit `useDroppable` for `container-drop` — verify in browser if hit-testing prefers the intended target.

---

### `packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx`

**Delta:** `useSortable` with `sortableGroup`/`sortableIndex`; removes `index` prop and removes `index` from `data`; `isDragging` → `isDragSource`; stronger drag styling; merged refs for root + handle.

**Coupling:** `FieldBlock` now **requires** `sortableGroup`/`sortableIndex` — all call sites must pass (render-tree does; tests mock `useSortable`).

---

### `packages/formspec-studio/src/workspaces/layout/DisplayBlock.tsx`

**Delta:** Optional layout sortable path with `useSortable` + `disabled: !layoutSortable`; conditional `DragHandle`; `effectiveSelected` excludes `isDragSource`; root ref merges `blockRef` + `sortableRef`.

**Observation:** When `layoutSortable` is false, `data` is `{}` so `extractSortablePlacement` will not treat it as `tree-node` — correct for non-canvas consumers.

---

### `packages/formspec-studio/src/workspaces/layout/UnassignedTray.tsx`

**Delta:** Tray item drag styling only — `cursor-grabbing`, opacity/ring while dragging.

**Scope:** Still `useDraggable` (not sortable); no change to tray data types for `handleDragEnd`.

---

### `packages/formspec-studio/src/workspaces/layout/LayoutLivePreviewSection.tsx`

**Delta:** Optional `appearance`; reads `useLayoutPreviewNav()`; passes `appearance`, `layoutPreviewPageIndex`, `layoutHighlightFieldPath` into `FormspecPreviewHost`.

**Data flow:** Depends on `LayoutPreviewNavProvider` in Shell (see `Shell.tsx`).

---

### `packages/formspec-studio/src/components/Shell.tsx`

**Delta:** Wraps tree with `LayoutPreviewNavProvider`; passes `appearance={colorScheme?.resolvedTheme ?? 'light'}` to `PreviewTab` and `LayoutLivePreviewSection`.

**Invariant:** Provider nesting order: `OpenDefinitionInEditorProvider` → `LayoutPreviewNavProvider` → `LayoutModeProvider` → …

---

### `packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx`

**Delta:** Optional `appearance?: ResolvedTheme`; forwards to `FormspecPreviewHost`.

---

### `packages/formspec-studio/src/workspaces/preview/FormspecPreviewHost.tsx`

**Delta (large ~300 lines):** Adds `appearance`, `layoutPreviewPageIndex`, `layoutHighlightFieldPath`; helpers for scroll parents, `CSS.escape` / attr selector safety, finding `.formspec-field[data-name=…]`; wizard/tab navigation via `goToWizardStep` or custom events; injects inspect/highlight styles; syncs layout page index and field highlight with `requestAnimationFrame` loop (bounded `PREVIEW_NAV_MAX_FRAMES`); sets `data-formspec-appearance` on `formspec-render`.

**Cross-cutting:** Not layout DnD — live preview UX + theme parity with shell.

**Test:** `preview-tab.test.tsx` asserts `data-formspec-appearance="dark"` when `appearance="dark"`.

---

### `packages/formspec-chat/src/gemini-adapter.ts`

**Delta:** System prompt shortened; response JSON schema refactored (`DATA_TYPES`, richer `FIELD_SCHEMA` descriptions, comments on Gemini `$ref` limits).

**Scope:** Chat/scaffolding only; no Studio layout runtime coupling in diff.

---

### `filemap.json`

**Delta:** Generated index churn — no behavioral review; regenerate via `npm run docs:filemap` if required by workflow.

---

### `packages/formspec-studio/tests/workspaces/layout/*.test.tsx`

| File | Change summary |
| --- | --- |
| `layout-dnd-provider.test.tsx` | Tray `placeOnPage` vs `addItemToLayout`; tree sibling fallback; `extractSortablePlacement` contract; `siblingIndicesForTreeReorder` / `findParentOfNodeRef`; sortable placement + insert-slot precedence |
| `layout-container-css.test.tsx` | `useSortable` mock; `sortableGroup`/`sortableIndex` on all `LayoutContainer` usages |
| `field-block-resize.test.tsx` / `field-block-inline-edit.test.tsx` | Mock `@dnd-kit/react/sortable`; add `sortableGroup`/`sortableIndex` defaults |
| `insert-slot-droppable.test.tsx` | `useSortable` mock; sortable props on containers; drop `useDraggable` from partial `@dnd-kit/react` mock |

**Gap:** No E2E asserts **sortable-only** drag-end (peer drop, no insert-slot) feeding **`extractSortablePlacement`**; Playwright covers **insert-slot** spatial drops and stack/grid reorder via slots.

---

### `packages/formspec-studio/tests/workspaces/preview/preview-tab.test.tsx`

**Delta:** New test that `formspec-render` receives `data-formspec-appearance="dark"` when `PreviewTab appearance="dark"` (fake timers + debounce).

---

## Findings — original review (historical) and resolution

```text
FINDING 1 (original): Sibling fallback used drag data indices; sortable `data` omitted `index`.
  Resolution: RESOLVED — `siblingIndicesForTreeReorder` + `findParentOfNodeRef` (`LayoutDndProvider.tsx:299–311`); Vitest covers sibling fallback without `index` in event data.
```

```text
FINDING 2 (original): `useSortable` + `useDroppable(container-drop)` on same `LayoutContainer` shell.
  Resolution: UNCHANGED — defer structural change until manual QA shows mis-hits (Phase 2 checklist).
```

```text
FINDING 3 (original): JSDoc/comment said `isDragging` vs `isDragSource`.
  Resolution: RESOLVED — provider comment at `LayoutDndProvider.tsx:323`.
```

```text
FINDING 4 (original): Thin coverage for live `operation.source` → `extractSortablePlacement`.
  Resolution: PARTIAL — exported `extractSortablePlacement` + Vitest contract tests; Playwright insert-slot / stack reorder. Gap: sortable-only peer-drop E2E still optional.
```

```text
FINDING 5 (original): `bind:` prefix encoding vs real `nodeId` collision risk.
  Resolution: MITIGATED — JSDoc on `layoutSortGroupToTargetParent` + `render-tree` `sortableGroupId` cross-reference (Phase 0).
```

**Additional fix (post-review, not in original numbered findings):** Tray `handleTrayDrop` must not call `addItemToLayout` for keys already in the definition — **`placeOnPage`** (`LayoutDndProvider.tsx:102–104`); **`onDragStart`** enables insert slots for tray drags (`330–334`).

---

## Conclusion

```text
VERDICT: APPROVE (layout DnD / tray scope), with follow-ups

Justification:
  - Sortable + spatial routing, `targetParent` object moves, tree-derived sibling fallback, tray `placeOnPage`, and drag-active UX align with intended behavior; code cites above.
  - Finding 2 (dual-droppable) remains a watch item for manual QA only — no regression proven in automation.

Coverage: ADEQUATE for unit + contract tests + insert-slot/stack Playwright; OPTIONAL GAP — sortable-only E2E for raw `operation.source`.

Confidence: HIGH for paths covered by tests; MEDIUM for LayoutContainer collision edge cases until QA or a targeted E2E reproduces them.
```
