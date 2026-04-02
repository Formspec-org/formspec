# Layout Workspace Completion

## Context

A swarm audit (2026-04-01) inventoried all 17 files in the layout workspace and
cross-referenced them against the component spec (§3–§13). Results:
**18 implemented / 15 partial / 28 missing**.

The headline finding: the workspace is **read-heavy, write-light**. The tree
authoring loop works (add items, bind fields, set pages, write `when`
expressions), but once a node is in the tree its properties are locked. You can
see a Grid's column count but you can't change it. You can see a Stack's
direction but you can't flip it. The property panels are display surfaces, not
editing surfaces.

The good news: the underlying API layer is substantially complete.
`component.setNodeProperty` is fully generic. `project.moveLayoutNode`,
`project.placeOnPage`, `project.reorderComponentNode` all exist.
`project.setItemOverride` already accepts any property key. Almost every gap is
a UI wiring problem, not an API gap.

Three entire spec sections (§7 custom components, §9 responsive, §10 tokens)
have no UI at all despite having backend handler support. These are explicitly
out of scope for this plan — they belong in a dedicated authoring surface, not
the layout workspace.

---

## Goals

1. Make every property visible in the workspace also editable.
2. Fix the DnD provider so drag operations use the project API and produce
   correct results.
3. Expand the component toolbar to include all core and high-value container
   types.
4. Expose ConditionalGroup (Core-required, §5) and DataTable (highest-value
   progressive, §6) for authoring.
5. Add component-specific property sections so different components show the
   right controls.

**Not in scope:** §7 custom components, §9 responsive overrides, §10 design
tokens, §12 conformance validation UI. These are architectural additions that
need separate planning.

---

## Pre-flight Check

Before touching any of the P3/P4 items (Accordion, DataTable,
ConditionalGroup), verify that the webcomponent renderer actually supports
rendering them. Check `packages/formspec-webcomponent/src/components/` for
each type. If the renderer can't render it, authoring it is pointless — fix the
renderer first or defer.

Also check `packages/formspec-studio/tests/e2e/playwright/` for any existing
layout workspace E2E tests. Run them to establish a baseline before any
changes. The DnD bugs suggest some "implemented" features may never have been
exercised.

Close ADR-0052 as Accepted-Alternative before starting: update
`thoughts/adr/0052-remove-theme-page-layout.md` status and note that the
alternative path was fully executed by `page-mode-as-presentation` (2026-03-26),
including the additional Wizard type deprecation. `theme.pages` remains in the
schema intentionally for non-Studio consumers.

---

## Phase 0 — Fix Display Node Tier (spec compliance bug)

**Do this first. Heading and Divider are on the wrong tier. Everything else
builds on the component tree — don't add more on top of a known spec violation.**

### The bug

When the palette adds Heading or Divider, `addItemToLayout` creates a Tier 1
`type: "display"` definition item. This is wrong per component spec §5.13–5.15:

- `Heading` requires `level` (integer 1–6) and `text` — neither exists on a
  Tier 1 display item's schema. Tier 1 display uses `label` for content.
- `Heading` bind is FORBIDDEN. Tier 1 display items can have `relevant`. These
  are behaviorally different.
- The tree-reconciler auto-generates a `Text` node from any display item —
  a `Heading` node should never emerge from reconciliation of a display item.

`render-tree.tsx` currently handles these as a fragile fallback (lines 135–153):
it resolves `node.nodeId` against `defLookup` hoping it matches the definition
item key. This works incidentally but is not correct behavior.

**Text Block is fine**: `type: "display"` with `widgetHint: "paragraph"` is
spec-consistent (Core §4.2.4, §4.2.5.1). It has semantic form identity, uses
`label` for text, and the Tier 1 fallback rendering works without a Component
Document. Leave it as Tier 1.

### Fix

**0.1 Heading and Divider palette items**

Update `addItemToLayout` (studio-core `project.ts:2616`) so that when
`itemType === 'display'` and the component is `'Heading'` or `'Divider'`, call
`component.addNode` instead of `definition.addItem`:

```ts
// Heading
project.addLayoutNode(parentNodeId, 'Heading', {
  _layout: true,
  level: 2,
  text: label || 'Heading',
});

// Divider
project.addLayoutNode(parentNodeId, 'Divider', {
  _layout: true,
  label: '',
});
```

No definition item is created. The component node is preserved across
reconciler rebuilds via the existing `_layout: true` snapshot/restore in
`tree-reconciler.ts` (lines 22–23).

**0.2 render-tree.tsx — explicit `_layout` display handling**

Add an explicit branch before the existing display fallback (line 135):

```ts
// _layout display node (Heading, Divider — Tier 3 component nodes)
if (node._layout && (node.component === 'Heading' || node.component === 'Divider' || node.component === 'Text')) {
  result.push(
    <DisplayBlock
      key={`node:${node.nodeId}`}
      itemKey={node.nodeId!}
      selectionKey={`__node:${node.nodeId!}`}
      label={(node.text as string) || (node.label as string) || node.component}
      widgetHint={node.component}
      selected={ctx.selectedKey === `__node:${node.nodeId!}`}
      onSelect={(key) => ctx.onSelect(key, 'layout')}
    />,
  );
  continue;
}
```

**0.3 ComponentSpecificSection — display nodes**

`Heading`: `level` select → `[1, 2, 3, 4, 5, 6]` rendered as `h1`–`h6` labels.
`text` text input.

`Divider`: `label` text input (optional section title).

Both write via `project.setNodeProperty(nodeId, prop, value)` — same API as
layout containers.

### Migration

Existing projects that have Heading/Divider as Tier 1 definition items will
still render (the tree-reconciler produces a `Text` node for them). No
forced migration needed. New authoring creates Tier 3 nodes; old data degrades
gracefully to reconciler-generated `Text` nodes. If a migration is desired
later, it can be a one-pass transform in the project load path.

### Testing

Red-green for each component:
1. Add Heading via palette → assert no definition item created, component tree
   has `_layout: true, component: 'Heading', level: 2` node.
2. Add Divider via palette → assert no definition item, tree has Divider node.
3. Existing Text Block via palette → assert definition item still created
   (Tier 1 path unchanged).
4. render-tree renders `_layout: true` Heading/Divider nodes without
   falling through to the nodeId-heuristic path.

---

## Phase 1 — Editable Property Panels

**The highest-leverage change. Every container is currently an unconfigured
wrapper.**

### 1.1 ContainerSection

Replace every `<span>{value || '—'}</span>` with an editable control. Wire each
to `project.setNodeProperty(nodeIdOrBind, property, value)`.

The node reference needs care: for layout nodes (nodeId), use
`project.setNodeProperty` with the nodeId. For bound group nodes (bind path),
look up the component node first via `project.componentFor(itemKey)` then
update.

Controls needed:

**Stack**
- Direction: `<select>` → `['column', 'row', 'column-reverse', 'row-reverse']`
- Gap: `<input type="number">` (tokens or px, keep as string to allow `"md"`)
- Padding: text input (same)
- Align: `<select>` → `['start', 'center', 'end', 'stretch']`
- Wrap: `<select>` → `['nowrap', 'wrap']`

**Grid**
- Columns: `<input type="number" min="1" max="12">`
- Gap: text input
- Padding: text input
- Column template: text input (for `auto` / `fr` expressions — optional, lower priority)

**Card**
- Padding: text input
- Elevation: `<select>` → `['flat', 'raised', 'floating']`

**Panel**
- Position: `<select>` → `['left', 'right', 'float']`
- Width: text input

**Collapsible**
- Title: text input (maps to `label` on the node)
- Default open: `<input type="checkbox">`

**Accordion** (once added to toolbar)
- Same as Collapsible plus multi-open toggle

The `TextPropertyInput` component already exists in `ComponentProperties.tsx`
(lines 22–56). Extract it to a shared `PropertyInput.tsx` in `components/ui/`
and use it consistently. Add `SelectPropertyInput` and `NumberPropertyInput`
alongside it.

### 1.2 LayoutSection

Replace column-span and row-span displays with number inputs:

```tsx
<NumberPropertyInput
  label="Column Span"
  value={colSpan}
  min={1}
  max={12}
  onCommit={(v) => project.setNodeProperty(ref, 'gridColumnSpan', v)}
/>
```

### 1.3 AppearanceSection — expand editable properties

`project.setItemOverride(itemKey, property, value)` already accepts any
property. Currently only `labelPosition` has a control. Add:

- **Compact mode**: `<select>` → `['', 'compact', 'comfortable', 'spacious']`
- **Help text position**: `<select>` → `['below', 'tooltip', 'above']`
- **Error display**: `<select>` → `['inline', 'tooltip', 'none']`
- **Input size**: `<select>` → `['sm', 'md', 'lg']`
- **Floating label**: checkbox

These are all single `setItemOverride` calls with no new API work.

### Testing

For each property control: write a unit test that renders the section with a
mock project, changes the control, and asserts `setNodeProperty` was called with
the correct arguments. Follow red-green: write the failing test first, then wire
the control.

---

## Phase 2 — Fix DnD

The DnD provider currently bypasses the project API in both drop paths. Both
need to be rewritten to use proper API calls.

### 2.1 Tray-to-canvas

Current (broken):
```ts
(project as any).core.dispatch({
  type: 'component.addNode',
  payload: { parent: { nodeId: '__root' }, node: { component: 'TextInput', bind: sourceData.key } },
});
```

Fix: use `project.placeOnPage(itemKey, activePageId)` when a page is active.
When no page is active (single-page mode), use `project.addLayoutNode('root',
inferComponentFromItem(item))` where `inferComponentFromItem` maps the item's
dataType to a default component (use `compatibleWidgets(item.type,
item.dataType)[0]` — the first compatible widget is the correct default).

### 2.2 Tree reorder

Current (broken):
```ts
(project as any).core.dispatch({
  type: 'component.reorderNode',
  payload: { node: sourceRef, direction: 'down' },
});
```

Fix: use `project.moveLayoutNode(sourceNodeId, targetParentNodeId, targetIndex)`
with the actual drop position. The `@dnd-kit` event provides source and target
IDs — map these to nodeIds via the `data-layout-node-id` attribute on the drag
targets. The target index is the child-order position of the drop target within
its parent.

### 2.3 Drop target wiring

The existing drag handles in `FieldBlock.tsx` and `LayoutContainer.tsx` may
need `useDraggable` / `useDroppable` from `@dnd-kit/react` properly configured
with `nodeRef` data. Audit these components as part of the DnD rewrite.

Verify `@dnd-kit/react` and `@dnd-kit/dom` are in `package.json` for
`formspec-studio`. The current import suggests they're there, but confirm.

### Testing

Write an E2E test (Playwright) that:
1. Adds a field via the tray
2. Drags it onto the canvas
3. Asserts it appears in the tree with the correct component type (not hardcoded TextInput)
4. Drags it to reorder
5. Asserts the new position in the rendered tree

---

## Phase 3 — Expand Component Toolbar

### 3.1 Accordion and Collapsible (one-line fix each)

In `LayoutCanvas.tsx:69`:

```ts
const CONTAINER_PRESETS = ['Card', 'Stack', 'Grid', 'Panel'] as const;
```

Add `'Accordion'` and `'Collapsible'`. Both are already in `CONTAINER_TYPES`
in `ComponentProperties.tsx` — properties panel already handles them.

Note: Collapsible is a Core component (spec §5). Accordion is Progressive (spec
§6). Verify renderer supports Accordion before shipping it in the toolbar.

### 3.2 Unify the source of truth

`CONTAINER_PRESETS` and `CONTAINER_TYPES` are two independent local constants
that will drift. Extract a canonical `LAYOUT_CONTAINER_COMPONENTS` set from
`@formspec-org/studio-core` (or `@formspec-org/types`) and import it in both
places. One source, two consumers.

### 3.3 ConditionalGroup

Add `ConditionalGroup` to the toolbar or as a context menu action "Wrap in
Conditional Group" (analogous to existing "Wrap in Card" etc.). Creating a
ConditionalGroup requires a `when` expression — prompt for it on creation or
default to empty string (always visible, user sets it in the properties panel).

ConditionalGroup is Core-required per spec §5. Not having it is a conformance
gap.

Component-specific property section for ConditionalGroup: just needs the `when`
expression control (already exists as "Visual Condition") — no additional
properties.

---

## Phase 4 — DataTable for Repeat Groups

DataTable is the spec's mechanism for rendering repeat groups as tables. It's
the highest-value progressive component for institutional forms.

### 4.1 Widget catalog entry

In `ITEM_TYPE_WIDGETS` (studio-core), add DataTable as a widget option for
`group` items that have `repeatable: true`. Alongside the existing "stack of
group instances" default rendering.

### 4.2 Group display mode toggle

`component.setGroupDataTable` handler exists at the core level. Add a
`setGroupDisplayMode(itemKey, mode: 'stack' | 'table')` wrapper on the Project
class that invokes it. Expose in the widget selector for repeatable groups.

### 4.3 DataTable properties section

When a group node is rendered as DataTable, show a component-specific section:
- Column configuration: which group fields appear as columns (checkboxes per
  field key)
- Row actions: add/remove row controls visibility
- Header labels: override per-column labels

This is the most work in Phase 4 — the column configuration UI needs a
mini-editor. Consider a simple ordered list with checkboxes for MVP.

---

## Phase 5 — SubmitButton

`project.addSubmitButton(label?, pageId?)` is fully implemented. Add a toolbar
button or palette entry to invoke it. On click: add a SubmitButton to the
current page (or root for single-page forms).

**Spec status**: SubmitButton is not in the component spec's 18 Core or 17
Progressive components (scout confirmed Appendix B lists exactly 35 with no
SubmitButton). It is a studio-core implementation extension. Before building
the UI, either: (a) add SubmitButton to the spec via the `formspec-specs:spec-expert`
agent and update the schema, or (b) treat it as an extension (`x-studio-submit`)
with the spec-extension mechanism (§13.3). Option (a) is preferred — a form
without a submit action is a real gap in the spec catalog. File this as a spec
addition before implementation.

---

## Component-Specific Property Dispatch

The current properties panel has generic sections but no mechanism to show
different controls for different component types. Before Phase 3/4 adds new
component types, establish the pattern.

Add a `ComponentSpecificSection` dispatcher in `ComponentProperties.tsx`:

```tsx
function ComponentSpecificSection({
  componentType,
  nodeProps,
  onSetProp,
}: {
  componentType: string;
  nodeProps: Record<string, unknown>;
  onSetProp: (key: string, value: unknown) => void;
}) {
  switch (componentType) {
    case 'Grid': return <GridSection {...} />;
    case 'Stack': return <StackSection {...} />;
    case 'Panel': return <PanelSection {...} />;
    case 'Collapsible':
    case 'Accordion': return <CollapsibleSection {...} />;
    case 'DataTable': return <DataTableSection {...} />;
    case 'Heading': return <HeadingSection {...} />;
    default: return null;
  }
}
```

This replaces the current `ContainerSection` which lumps all container types
into one read-only block.

---

## Display Node Property Editing

Handled in Phase 0. Heading and Divider are Tier 3 component nodes (`_layout:
true`) — their properties (`level`, `text`, `label`) live on the component node
and are edited via `project.setNodeProperty`. The `ComponentSpecificSection`
dispatcher handles them alongside layout containers.

Text Block remains Tier 1 (`type: "display"`, `widgetHint: "paragraph"`). Its
editable property is the definition item's `label` field — editable via the
standard item update path, not via `setNodeProperty`. No special property
section needed; the existing label-editing surface in the Editor workspace
covers it.

`Text` (component spec §5.14) as a Tier 3 node is a separate concept from Text
Block (Tier 1 display item). If the palette later adds a `Text` component entry
(for layout-workspace-only static text with `format` and `text` props), it
follows the same Phase 0 pattern: Tier 3 node, `_layout: true`, no definition
item, `format` select + `text` text area in the property panel.

---

## Execution Order

```
Pre-flight  Close ADR-0052 as Accepted-Alternative           [~15 min]
Pre-flight  Renderer support check (Accordion/DataTable/CG)  [~30 min]
Pre-flight  Run existing layout E2E baseline                 [~15 min]
Phase 0     Fix Heading/Divider tier (spec compliance bug)   [~3 hours]
Phase 1a    ContainerSection editable controls               [~4 hours]
Phase 1b    LayoutSection editable controls                  [~1 hour]
Phase 1c    AppearanceSection expand properties              [~2 hours]
Phase 2     DnD rewrite                                      [~4 hours]
Phase 3a    Accordion + Collapsible on toolbar               [~30 min]
Phase 3b    Unify CONTAINER_PRESETS / CONTAINER_TYPES        [~1 hour]
Phase 3c    ConditionalGroup authoring                       [~2 hours]
Phase 4     DataTable for repeat groups                      [~6 hours]
Phase 5     SubmitButton (add to spec first)                 [~1 hour + spec work]
```

TDD throughout. For each phase: write failing tests → implement → verify all
layers pass.

---

## Open Questions

1. **Renderer support check**: Do Accordion, DataTable, ConditionalGroup render
   correctly in `formspec-webcomponent`? Block P3/P4 on this answer.

2. **SubmitButton spec addition**: SubmitButton is not in the spec's 35 built-in
   components (confirmed by spec audit). The project API already implements it.
   Needs a spec addition before UI is built — file with `formspec-specs:spec-expert`
   to determine which tier/section it belongs in and whether it's Core or
   Progressive.

3. **setNodeType API**: The `component.setNodeType` handler exists at core
   level but has no Project wrapper. Worth adding so users can change a Stack to
   a Grid without delete-and-recreate? Low priority but would improve the
   authoring flow significantly.

~~**Display node storage**~~ — resolved. Heading and Divider are Tier 3
(`_layout: true`, no definition item). Text Block is Tier 1. Handled in Phase 0.
