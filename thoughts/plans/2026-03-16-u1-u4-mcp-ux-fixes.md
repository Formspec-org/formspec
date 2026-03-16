# Plan: U1 + U4 — MCP UX Fixes

**Date**: 2026-03-16
**Status**: Proposed
**Branch**: `studiofixes`

---

## U1: `formspec_place` is theme-only — wizard mode needs definition-level groups

### Problem

LLMs follow the natural workflow: add fields → add pages → place fields on pages → set wizard mode. But `formspec_place` (→ `placeOnPage`) only creates theme-tier page regions. In wizard mode, the engine renders by iterating definition-level groups — root-level fields placed via theme are invisible. The audit catches this with `PAGED_ROOT_NON_GROUP` warnings, but the warning fires even when fields *are* properly theme-placed and doesn't explain how to fix it.

### Root Cause Chain

```
formspec_page (action: "add")
  → project.addPage()          → creates theme-tier page only (pages.addPage command)

formspec_place
  → project.placeOnPage()      → assigns item to theme page region only

formspec_flow (action: "set_mode", mode: "wizard")
  → project.setFlowMode()      → sets formPresentation.pageMode = "wizard"

Audit: PAGED_ROOT_NON_GROUP
  → diagnostics.ts line 255    → checks: if pageMode is wizard/tabs AND item.type !== 'group'
                                  fires on ALL root non-group items, ignoring theme placements
```

The diagnostic is correct that root non-group items won't render in wizard mode. But it's also misleading — it fires the same warning whether items are theme-placed or not, providing no actionable guidance.

Meanwhile, `addWizardPage` exists in studio-core (line 1620) and does exactly what's needed: creates a definition-level group AND sets wizard mode atomically. But it's not exposed in the MCP server.

### Root Layer

**Two layers:**
1. **Core diagnostics** (`diagnostics.ts`) — `PAGED_ROOT_NON_GROUP` is a false-positive when items ARE theme-placed; should differentiate
2. **MCP** (`structure.ts` + `server.ts`) — `formspec_page` only exposes `addPage` (theme-tier); should also expose `addWizardPage` (definition-tier)

### Proposed Fix

#### Part A: Expose `addWizardPage` in `formspec_page`

Add `action: "add_group"` to `formspec_page` that routes to `project.addWizardPage(title)`.

**File: `packages/formspec-mcp/src/tools/structure.ts`** — `handlePage`

```typescript
// Current:
export function handlePage(
  registry: ProjectRegistry,
  projectId: string,
  action: 'add' | 'remove' | 'move',
  params: { title?: string; description?: string; page_id?: string; direction?: 'up' | 'down' },
)

// Proposed:
export function handlePage(
  registry: ProjectRegistry,
  projectId: string,
  action: 'add' | 'add_group' | 'remove' | 'move',
  params: { title?: string; description?: string; page_id?: string; direction?: 'up' | 'down' },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'add':
        return project.addPage(params.title!, params.description);
      case 'add_group':
        return project.addWizardPage(params.title!);    // <-- NEW
      case 'remove':
        return project.removePage(params.page_id!);
      case 'move':
        return project.reorderPage(params.page_id!, params.direction!);
    }
  });
}
```

**File: `packages/formspec-mcp/src/server.ts`** — `formspec_page` registration

Update `action` enum and description:

```typescript
action: z.enum(['add', 'add_group', 'remove', 'move']).describe(
  'add: create theme page; add_group: create wizard step (definition-level group that auto-sets wizard mode); remove: delete page; move: reorder'
),
```

#### Part B: Fix the `PAGED_ROOT_NON_GROUP` diagnostic

The diagnostic should check whether root non-group items are theme-placed before warning. If they ARE placed on a theme page, change the message to explain the theme-vs-definition distinction.

**File: `packages/formspec-core/src/queries/diagnostics.ts`** — lines 253-266

```typescript
// Current (lines 253-266):
const defPageMode = (state.definition as any).formPresentation?.pageMode;
if (defPageMode === 'wizard' || defPageMode === 'tabs') {
  for (const item of state.definition.items) {
    if (item.type !== 'group') {
      consistency.push({
        artifact: 'definition',
        path: item.key,
        severity: 'warning',
        code: 'PAGED_ROOT_NON_GROUP',
        message: `Root-level ${item.type} "${item.key}" is not inside a page group — it will be hidden in ${defPageMode} mode`,
      });
    }
  }
}

// Proposed:
const defPageMode = (state.definition as any).formPresentation?.pageMode;
if (defPageMode === 'wizard' || defPageMode === 'tabs') {
  // Build set of item keys that ARE placed on theme pages
  const themePlacedKeys = new Set<string>();
  for (const page of (state.theme.pages ?? [])) {
    for (const region of (page as any).regions ?? []) {
      if (typeof region.key === 'string') themePlacedKeys.add(region.key);
    }
  }

  for (const item of state.definition.items) {
    if (item.type !== 'group') {
      const isThemePlaced = themePlacedKeys.has(item.key);
      consistency.push({
        artifact: 'definition',
        path: item.key,
        severity: 'warning',
        code: 'PAGED_ROOT_NON_GROUP',
        message: isThemePlaced
          ? `Root-level ${item.type} "${item.key}" is theme-placed but not inside a definition group — use formspec_page(action: "add_group") to create wizard steps, then formspec_edit(action: "move") to move items into them`
          : `Root-level ${item.type} "${item.key}" is not inside a page group — it will be hidden in ${defPageMode} mode`,
      });
    }
  }
}
```

#### Part C: Tests

**File: `packages/formspec-mcp/tests/structure.test.ts`** — add tests:
- `handlePage action "add_group"` creates a definition group and sets wizard mode
- `handlePage action "add_group"` returns `createdId` (the group key)

**File: `packages/formspec-core/tests/diagnostics.test.ts`** — add test:
- `PAGED_ROOT_NON_GROUP` message mentions "theme-placed" when item is on a theme page

### Scope

~30 lines of production code across 3 files. 2-3 new test cases.

---

## U4: No batch for `formspec_place` and `formspec_edit move`

### Problem

Agent 4 (grant application) made 14 individual `formspec_edit move` calls and 15 individual `formspec_place` calls. These tools lack batch support, unlike `formspec_field`, `formspec_behavior`, etc.

### Analysis: What's safe to batch?

| Operation | Independent? | Safe to batch? | Notes |
|-----------|-------------|---------------|-------|
| `place` | Yes — each assignment is independent | **Yes** | Order doesn't matter |
| `unplace` | Yes | **Yes** | Order doesn't matter |
| `move` | **No** — ordering matters | **Yes, but sequential** | Moving A into B then C into A requires order. `executeBatch` already processes sequentially. |
| `remove` | **No** — cascading side effects | **No** | Removing a group deletes children; later items may reference deleted paths |
| `rename` | **No** — path changes | **No** | Renaming changes paths that subsequent items may reference |
| `copy` | Yes | Marginal value | Rarely done in bulk |

**Decision**: Add batch to `formspec_place` (high value, safe). Add batch `items[]` to `formspec_edit` but restrict to `move` action only in batch mode (sequential processing via existing `executeBatch`).

### Root Layer

**MCP** (`structure.ts` + `server.ts`) — feature gap, no deeper domino.

### Proposed Fix

#### Part A: Batch `formspec_place`

**File: `packages/formspec-mcp/src/tools/structure.ts`** — `handlePlace`

```typescript
// Current:
export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  action: 'place' | 'unplace',
  target: string,
  pageId: string,
  options?: PlacementOptions,
)

// Proposed — add overload for batch:
interface PlaceItem {
  action: 'place' | 'unplace';
  target: string;
  page_id: string;
  options?: PlacementOptions;
}

export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: { action: 'place' | 'unplace'; target: string; page_id: string; options?: PlacementOptions },
): ReturnType<typeof wrapHelperCall>;
export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: PlaceItem[] },
): ReturnType<typeof wrapBatchCall>;
export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: { action?: string; target?: string; page_id?: string; options?: PlacementOptions; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const action = item.action as string;
      const target = item.target as string;
      const pageId = item.page_id as string;
      if (action === 'place') {
        return project!.placeOnPage(target, pageId, item.options as PlacementOptions | undefined);
      }
      return project!.unplaceFromPage(target, pageId);
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    if (params.action === 'place') {
      return project.placeOnPage(params.target!, params.page_id!, params.options);
    }
    return project.unplaceFromPage(params.target!, params.page_id!);
  });
}
```

**File: `packages/formspec-mcp/src/server.ts`** — `formspec_place` registration

Add `items` param to input schema:

```typescript
const placeItemSchema = z.object({
  action: z.enum(['place', 'unplace']),
  target: z.string().describe('Item path'),
  page_id: z.string().describe('Page ID'),
  options: z.object({ span: z.number() }).optional(),
});

// In tool registration:
inputSchema: {
  project_id: z.string(),
  // Single
  action: z.enum(['place', 'unplace']).optional(),
  target: z.string().optional(),
  page_id: z.string().optional(),
  options: z.object({ span: z.number() }).optional(),
  // Batch
  items: z.array(placeItemSchema).optional().describe('Batch: array of place/unplace operations'),
},
```

Update the handler dispatch:

```typescript
async ({ project_id, action, target, page_id, options, items }) => {
  if (items) {
    return structure.handlePlace(registry, project_id, { items });
  }
  return structure.handlePlace(registry, project_id, { action: action!, target: target!, page_id: page_id!, options });
}
```

#### Part B: Batch `formspec_edit` (move only)

**File: `packages/formspec-mcp/src/tools/structure.ts`** — `handleEdit`

```typescript
// Add batch support:
interface MoveItem {
  path: string;
  target_path?: string;
  index?: number;
}

export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: 'remove' | 'move' | 'rename' | 'copy',
  params: { path: string; target_path?: string; index?: number; new_key?: string; deep?: boolean },
): ReturnType<typeof wrapHelperCall>;
export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: 'move',
  params: { items: MoveItem[] },
): ReturnType<typeof wrapBatchCall>;
export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: 'remove' | 'move' | 'rename' | 'copy',
  params: { path?: string; target_path?: string; index?: number; new_key?: string; deep?: boolean; items?: BatchItem[] },
) {
  if (params.items) {
    // Batch mode — only supported for 'move'
    if (action !== 'move') {
      throw new Error(`Batch mode only supported for action "move", got "${action}"`);
    }
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      return project!.moveItem(item.path as string, item.target_path as string | undefined, item.index as number | undefined);
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'remove': return project.removeItem(params.path!);
      case 'move': return project.moveItem(params.path!, params.target_path, params.index);
      case 'rename': return project.renameItem(params.path!, params.new_key!);
      case 'copy': return project.copyItem(params.path!, params.deep);
    }
  });
}
```

**File: `packages/formspec-mcp/src/server.ts`** — `formspec_edit` registration

Add batch items param:

```typescript
const moveItemSchema = z.object({
  path: z.string().describe('Item path to move'),
  target_path: z.string().optional().describe('New parent path'),
  index: z.number().optional().describe('Position index'),
});

// In tool registration, add to inputSchema:
items: z.array(moveItemSchema).optional().describe('Batch: array of move operations (action must be "move")'),
```

Update description to mention batch:

```typescript
description: 'Structural tree mutations: remove, move, rename, or copy items. Action "remove" is DESTRUCTIVE — use formspec_undo to reverse. Move supports batch via items[] array.',
```

#### Part C: Tests

**File: `packages/formspec-mcp/tests/structure.test.ts`** — add tests:
- `handlePlace` batch: place 3 items on a page in one call
- `handlePlace` batch: mixed place/unplace
- `handlePlace` batch: partial failure (one invalid target)
- `handleEdit` batch move: move 3 items into a group in one call
- `handleEdit` batch non-move: error "Batch mode only supported for action move"

### Scope

~60 lines of production code across 2 files. 5 new test cases. No changes to studio-core or formspec-core — purely MCP layer.

---

## Implementation Order

1. **U1 Part A** — expose `addWizardPage` via `formspec_page` (quick, high value)
2. **U1 Part B** — fix diagnostic message (improves audit UX)
3. **U4 Part A** — batch `formspec_place` (high value, straightforward)
4. **U4 Part B** — batch `formspec_edit move` (moderate value, needs care)
5. **Tests for all** — TDD per CLAUDE.md: write failing tests first

## Files Modified

| File | Changes |
|------|---------|
| `packages/formspec-mcp/src/tools/structure.ts` | `handlePage` add `add_group`, `handlePlace` batch, `handleEdit` batch |
| `packages/formspec-mcp/src/server.ts` | Schema updates for `formspec_page`, `formspec_place`, `formspec_edit` |
| `packages/formspec-core/src/queries/diagnostics.ts` | Smarter `PAGED_ROOT_NON_GROUP` message |
| `packages/formspec-mcp/tests/structure.test.ts` | 5+ new tests |
| `packages/formspec-core/tests/diagnostics.test.ts` | 1 new test |
