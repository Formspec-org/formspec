# Pages Tab Rewrite Plan

## Vocabulary

- **Page** — a presentation surface. A wizard step, tab, or section that organizes what the user sees. Implemented as `theme.pages[]` with a 12-column grid.
- **Group** — a data container. A structural grouping of fields that shapes the response. Implemented as `definition.items[]` with `type: 'group'`.
- **Region** — assigns an item to a page. A reference by key (`page.regions[].key`) that bridges response structure and presentation.
- **Item** — any collectable or displayable element: field, group, or display item. Items exist in the response structure; regions assign them to pages.
- **Unassigned item** — an item not yet assigned to any page.

## Design Thesis: Domains, Not Documents

Formspec has three specification tiers (definition, theme, component), but the studio should not expose these as separate documents. They are interconnected domains with distinct intents:

| Domain | Intent | Studio Surface |
|---|---|---|
| **Business logic** (definition) | What data the form collects, how it's validated, what's computed. Shapes the response JSON. | Editor tab |
| **Presentation** (theme) | How the form looks and flows. Pages, layout grid, visual organization. | Pages tab |
| **Interaction** (component) | How the form behaves. Widget types, input affordances. | Properties panel / component settings |

The definition can hint at presentation (via `formPresentation`, `layout.page`) when no theme exists, but its primary purpose is the **data contract** — the shape of the response that comes back when someone submits the form. The Editor tab should make this clear: adding a field adds a key to the response. Adding a group nests the response structure. Adding validation constrains what values are accepted.

Pages are a separate concern: how the form guides the user through collecting that data. The same data structure can be presented as a single page, a multi-step wizard, or tabbed sections. A field belongs to one group (shaping the response) but can appear on any page (shaping the experience).

| | Editor Tab | Pages Tab |
|---|---|---|
| **Domain** | Response shape | User journey |
| **Organizes by** | Groups (data containers) | Pages (presentation surfaces) |
| **User thinks** | "What does the form collect?" | "How does the user move through it?" |
| **Primary action** | Add/configure fields and groups | Assign items to pages, set flow mode |
| **Output shaped** | The response JSON structure | The visual flow and layout |

### Convenience coupling

For the 80% case (wizard step = logical data grouping), `addPage` creates a paired group as a shortcut. But the UI never presents pages and groups as the same concept. The coupling is a convenience, not an identity:

- **"Add page"** creates a theme page + a paired definition group + a region linking them (the common case)
- **"Add empty page"** creates only a theme page with no regions (the power-user case)
- Cross-page item reassignment is always available — users who outgrow the 1:1 pattern can freely move items between pages
- Page deletion does NOT cascade into group deletion (see "Helper changes" below)

## Goal

Rewrite `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx` from scratch so the Pages workspace reads as one coherent surface instead of an overview plus a semi-separate layout tool. The result should preserve current page-management behavior, make item assignment obvious, and introduce explicit `View mode` and `Edit mode`.

Additionally, rename the Editor tab's `PageTabs` component to reflect that it navigates groups (response structure), not pages (presentation), and ensure the Editor conveys that its domain is the data contract — the shape of what comes back when someone fills out the form.

## Why Rewrite Instead of Refactor

The current implementation mixes too many responsibilities in one component:

- flow mode selection
- page overview cards
- inline metadata editing
- page deletion workflow
- unassigned item placement
- page reordering drag affordances
- handoff into `PagesFocusView`

That makes the UI feel stitched together. A rewrite is cheaper than preserving the current shape because the project is greenfield and the behavioral contract is already captured in tests.

**Scope clarification (from review):** The two-mode split already exists implicitly in the current code (`focusedPageId !== null` = Edit, `null` = View). The rewrite names something that exists and makes the transition intentional and visible. The actual new work is: explicit mode labels/UI, cross-page item reassignment in View mode, and the empty-only delete guard.

## Front-End Direction

- Visual thesis: editorial planning board with a calm production surface, not a stack of utility cards.
- Content plan: workspace header, mode controls, page rail, page planner, precise layout editor.
- Interaction thesis:
  - explicit mode switch between planning and layout work
  - fast item assignment in view mode without entering grid editing
  - direct transition into edit mode for spatial layout changes

## Product Decisions

### 1. Two explicit modes

The tab will have two workspace states:

- `View mode`: page planning, page metadata, item-to-page assignment, page ordering, empty-state guidance
- `Edit mode`: precise layout editing for one page, powered by the existing `PagesFocusView`

This keeps layout editing available without pretending it is a different workspace.

**Mode boundary rule:** View mode owns *which items are assigned to which page* (region membership). Edit mode owns *where regions sit on the grid* (span, offset, responsive breakpoints). Do not allow grid-column or offset editing in View mode — that collapses the modes.

**Mode indicator:** When in Edit mode, the workspace header must show which page is being edited and provide a clear "Back to pages" affordance. The user should always know what mode they're in.

**Mode persistence:** Entering Edit mode is transient — navigating away from the Pages tab and returning always resets to View mode. Edit mode state does not persist across tab switches.

### 2. View mode owns page planning

View mode will let users:

- switch `single` / `wizard` / `tabs` flow mode
- add pages (with or without a paired group)
- rename pages
- edit page descriptions
- reorder pages
- inspect which items are assigned to each page (via regions)
- reassign an item to a different page directly from its row (cross-page reassignment)
- assign unassigned items onto a page
- enter edit mode for exact layout work on a specific page

**Design decision (from review):** Intra-page item ordering is cut from View mode scope. Region ordering on the grid doesn't map to a simple "up/down" concept — it depends on span, offset, and responsive rules. View mode handles item *assignment* (which page); Edit mode handles item *positioning* (where on the grid). Intra-page ordering is Edit mode's job.

### 3. Page deletion rule

A page can only be deleted when it has no item regions. This is a **UI-layer policy**, not a spec-level or core-layer constraint — the core will delete pages with regions if asked.

**Definition of "empty":** A page is empty when it has no regions referencing definition items. A freshly-created page (via "Add page" with paired group) has one region pointing to an empty group — this counts as empty for deletion purposes since the group contains no fields.

UI implications:

- delete action stays behind an explicit secondary action (e.g. More menu)
- pages with item regions show a visible inline explanation: "Reassign all items to another page before deleting" (not just a disabled button)
- empty pages require confirmation before removal
- undo toast for deletion (restores the empty page)

**Considered but deferred:** "Delete page and reassign all items to..." affordance that lets users pick a destination page during deletion. Revisit if the empty-first constraint proves frustrating in practice.

**Minimum page count:** `project.removePage` has no minimum page count constraint — it will delete the last page without complaint. The UI must enforce its own minimum page count guard (at least one page must exist). Surface this as a disabled delete with an inline explanation, same as the non-empty guard.

**Page deletion does NOT delete groups.** `removePage` must only delete the page and its regions. The groups and their fields remain intact and become unassigned items. Deleting a presentation surface does not destroy the response structure.

### 4. Keep the layout editor focused

`PagesFocusView` remains the precision tool for:

- region grid widths (span)
- region offsets (start)
- responsive breakpoints
- drag/drop region ordering inside the canvas
- remove-from-page actions (unassigns item, returns to unassigned pool)
- intra-page region ordering

The rewrite will change the entry and framing around it, not duplicate that logic in overview mode. The `PagesFocusView` entry contract (`pageId`, `onBack`, `onNavigate`) must not change.

### 5. Dormant pages in View mode

When the flow mode is `single`, only one page is active. Dormant pages are visible but visually de-emphasized. In View mode, dormant pages are read-only except for title and description editing. All item assignment actions are disabled on dormant pages. Edit mode shows the existing "Dormant" badge.

**Mode activation transition:** When switching FROM `single` TO `wizard` or `tabs`, all dormant pages become active simultaneously. The UI should not require additional user action — the mode switch itself is the activation event. Pages preserved during single mode are immediately available as wizard steps or tabs.

## Editor Tab Changes

The Editor tab is the **response shape** workspace — it shows what data the form collects and how it's structured. Currently it uses `PageTabs` to navigate top-level groups, but the naming says "pages" when it means "groups." The behavior is already correct (it filters `definition.items` for groups); only the vocabulary is wrong.

### Rename `PageTabs` → `GroupTabs`

- `packages/formspec-studio/src/workspaces/editor/PageTabs.tsx` → `GroupTabs.tsx`
- The component navigates **groups** — data containers that shape the response — not pages
- Tab labels show group labels, not page titles — this is already the behavior, just fix the naming
- Double-click to rename edits the group label, not a page title

### Rename `activePageKey` context

- `useActivePage()` → `useActiveGroup()` (or similar)
- `activePageKey` → `activeGroupKey`
- `ActivePageContext` → `ActiveGroupContext`
- This rename touches both tabs — the Pages tab also subscribes to this context for cross-tab coordination

**Scope note:** The context rename is mechanical but wide-reaching. It can be done as a separate commit before or after the PagesTab rewrite. The PagesTab rewrite should use the new name if the rename lands first, or the old name with a TODO if it doesn't.

### Editor tab behavior is unchanged

The Editor canvas continues to:
- Show the active group's fields in paged modes (wizard/tabs)
- Show all items in single mode
- Render groups as `GroupBlock` headers with indented children
- Support drag/drop reordering within the response structure

The Editor does not gain any page-awareness. It operates in the business logic domain — what data the form collects, how it's validated, what's computed. Presentation is the Pages tab's concern.

## Helper Changes (studio-core)

### `removePage` — presentation changes must not destroy data

**Current behavior:** Deletes theme page AND any root-level definition groups referenced by regions.

**New behavior:** Deletes only the page and its regions. Groups and their fields remain intact as unassigned items. Removing a presentation surface should never destroy the response structure.

**Bug in current code:** `removePage` deletes ALL root-level groups referenced by regions, not just the group that was paired during `addPage`. If a user assigns an existing group to a page and deletes the page, that group gets destroyed. The new behavior eliminates this bug entirely.

### `addPage` — keep convenience, add standalone option

**Current behavior:** Atomically creates definition group + theme page + region.

**New behavior:** Two paths:
- `addPage(title, description?)` — convenience path, creates a group (response structure) + page (presentation) + region linking them (the 80% case)
- `addPage(title, description?, { standalone: true })` — creates only the page, no paired group

The convenience path remains the default because most users think "add a wizard step" = "add a place for fields." The standalone path is the escape hatch for composing pages from existing items.

### `addGroup` — stop creating paired pages

**Current behavior:** In paged modes (wizard/tabs), adding a root-level group also atomically creates a theme page and assigns the group.

**New behavior:** `addGroup` creates only the group (response structure). Page assignment is a separate action via the Pages tab. Adding to the response shape is a business logic decision; how to present it is a separate decision.

## State Management Decisions

### Delete confirmation is card-local

Under the empty-only delete rule, the tab no longer needs to coordinate which card is confirming a delete. Each page card manages its own two-step confirmation state locally.

### Active group context on item reassignment

When an item that is the current `activeGroupKey` is reassigned to a different page, `activeGroupKey` follows the item to its new page. The expanded card switches to the destination page.

### Callback surface

If the callback surface per page card exceeds ~8 props, extract a `usePageActions(pageId)` hook that returns the callback object. Keep the component's JSX readable.

### Delete toast

The current `position: fixed` toast rendered from `PagesTab` is acceptable for now. Do not introduce a global toast system for this rewrite, but do not entrench the pattern further either.

## Empty States

Three distinct empty states need treatment:

1. **No pages at all** — show guidance to add the first page (currently handled)
2. **Page exists but has no item regions** — show the page card with an empty region list and a prompt to assign items. The delete action is enabled. Distinguish visually from non-empty pages via text, not just color.
3. **All items assigned, no unassigned pool** — hide the unassigned section entirely (currently handled)

## Region Item Display

Page regions reference definition items of different types:

- **Fields** — shown with their label and type indicator
- **Groups** — shown as a single row representing the entire group subtree, with a child count indicator (e.g. "Contact Info (3 fields)"). The group's children are not individually listed in View mode — they are managed inside the group via the Editor tab (response structure domain).
- **Display items** — shown with their widget hint (paragraph, heading, divider, banner)
- **Broken regions** — regions referencing keys that no longer exist in the definition (`PageItemView.status === 'broken'`). Show with a warning indicator and the raw key. Broken regions should be removable from the page.

## Implementation Plan

### Phase 0: Helper decoupling (prerequisite)

Fix the studio-core helpers before touching the UI:

- `removePage` — stop deleting definition groups on page deletion
- `addGroup` — stop creating paired pages in paged modes
- `addPage` — add `standalone` option (keep paired creation as default)
- Update tests in `packages/formspec-studio-core/tests/` to match new behavior
- Verify `packages/formspec-core/` handler tests still pass (they should — handlers are already decoupled)

### Phase 1: Write the new test contract (RED)

Define the new UI's behavioral contract in `pages-tab.test.tsx` before touching the component:

- explicit mode labels and transitions (View/Edit)
- flow mode switching
- add page (with and without paired group)
- active-group sync (including item-reassignment follow behavior)
- inline title/description edits
- cross-page item reassignment via destination selector
- unassigned item placement affordances
- edit mode entry (with page indicator) and exit (back to View)
- empty-only page deletion with inline explanation (no group cascade)
- dormant page read-only behavior
- minimum page count guard

Run the tests — they must fail against the current code. This is the red phase.

### Phase 2: Delete and rebuild PagesTab.tsx (GREEN)

Delete `PagesTab.tsx` and start fresh. Build a smaller top-level component with:

- workspace-level mode state: `view` | `edit`
- selected page state for edit mode
- explicit action bar and planner layout
- page planner cards as local subcomponents:
  - compact page header
  - inline title and description editing
  - per-page region list (read-only ordering, shows assigned items)
  - item destination selector (cross-page reassignment)
  - `Edit layout` action
  - safe delete action with empty-page guard and inline explanation
  - card-local delete confirmation state
- active-group synchronization with `ActiveGroupContext`

Wire planner actions to existing project helpers:

- `project.setFlow`
- `project.addPage` / `project.addPage(..., { standalone: true })`
- `project.updatePage`
- `project.movePageToIndex` or `project.reorderPage`
- `project.placeOnPage` (assign item to page via region)
- `project.moveItemOnPageToIndex`
- `project.removePage` (theme-only, no group cascade)
- `project.unplaceFromPage` (unassign item, returns to unassigned pool)

### Phase 3: Editor tab rename

- Rename `PageTabs.tsx` → `GroupTabs.tsx`
- Rename `useActivePage` → `useActiveGroup`, `activePageKey` → `activeGroupKey`, `ActivePageContext` → `ActiveGroupContext`
- Update all consumers across both tabs
- Update Editor tab tests (`page-tabs.test.tsx` → `group-tabs.test.tsx`)

### Phase 4: Regression pass

- Run `pages-focus-view.test.tsx` — must pass without modification. If it breaks, the rewrite changed `PagesFocusView`'s entry contract unintentionally.
- Run the broader Pages workspace test suite if failures suggest coupling outside the tab.
- Run Editor tab tests to confirm the rename didn't break behavior.
- Clean up any test helpers, stubs, or compatibility shims from the old UI that no longer apply.

## Explicit Deferrals

The following spec features exist but are out of scope for this rewrite:

- **Page-level `when` conditions** (Component Tier): Pages within a Wizard can be conditionally shown/hidden based on data state via a `when` property. View mode does not surface conditional visibility. This is a runtime rendering concern, not a planning concern.
- **Tier 1 `layout.page` hints and `pages.autoGenerate`**: Definition groups can carry `layout.page` hints, and a `pages.autoGenerate` handler can auto-create theme pages from definition structure. Neither is surfaced in this rewrite. Consider `autoGenerate` as a possible empty-state affordance in a future iteration ("No pages yet — generate from definition structure?").
- **Wizard page validation semantics**: The wizard spec requires validating the current page's bound items before allowing forward navigation (unless `allowSkip` is true). This is runtime behavior, not relevant to View mode page planning. Note that `setFlow` supports `allowSkip` and `showProgress` as secondary properties via `FlowProps`.
- **Responsive breakpoint management**: Breakpoint configuration is Edit mode's concern. View mode does not surface `breakpointNames` or `breakpointValues` from `PageStructureView`.
- **Multiple presentations per form**: The decoupled architecture enables different themes to present the same response structure with different page layouts (e.g. compact mobile wizard vs expansive desktop tabs). This is a strategic unlock but not part of the current rewrite scope.

## Accessibility Requirements

This is a UI rewrite, so the implementation must explicitly keep:

- native buttons, inputs, and selects instead of ARIA-heavy custom controls
- visible labels for title/description/page destination controls
- visible focus styling
- logical tab order
- `aria-expanded` only where a disclosure actually exists
- no color-only status cues for empty/delete-locked pages
- keyboard-operable item destination selector (native `<select>` or buttons, not drag-only)
- inline text explanation for delete-locked state (not tooltip-only)

If any visual contrast is uncertain in the final styling, add a manual verification comment instead of guessing.

## Risks

- **Test migration is significant.** The existing 30+ tests are tightly coupled to specific aria labels, text content, and DOM attributes. Many will need full rewrites, not just updates. Test-first (Phase 1) mitigates this by defining the new contract before implementation.
- `PagesFocusView` is still a separate component; the rewrite should frame it as an internal edit mode, not a disconnected screen.
- Page deletion behavior changes from "confirm any page deletion" to "only empty pages are deletable", so tests must enforce the new rule.
- **DragDropProvider scope:** The current implementation wraps the page list in a single `DragDropProvider` for page reordering and item-to-page dropping. Since intra-page ordering is cut from View mode, the drag provider only handles page reordering + unassigned-to-page drops (same as today). No additional drag types needed.
- **Title editing duplication:** Both `PageCard` (View mode) and `PagesFocusView` (Edit mode) have separate inline title editing implementations. Accept this duplication for now — extracting a shared hook is a future simplification, not a blocker.
- **Context rename blast radius.** `ActivePageContext` → `ActiveGroupContext` touches both Editor and Pages tabs plus any other consumers. Phase 3 should be a standalone commit so it can be reviewed and reverted independently.
- **Helper behavior change in Phase 0.** Changing `removePage` to stop destroying response structure and `addGroup` to stop creating pages will break existing tests that expect the coupled behavior. These test updates are part of Phase 0 and must land before the UI work begins.

## Validation

Minimum validation before completion:

- targeted Vitest run for `pages-tab.test.tsx`
- targeted Vitest run for `pages-focus-view.test.tsx` (must pass without modification)
- targeted Vitest run for studio-core helper tests (Phase 0 changes)
- targeted Vitest run for Editor tab tests (Phase 3 rename)
- broader Pages workspace test run if failures suggest coupling outside the tab
