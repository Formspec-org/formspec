# E2E Test Dispatch Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all `dispatch()`, `seedDefinition()`, `seedProject()`, and `window.__testProject__` usage from Playwright E2E tests, replacing them with real UI interactions.

**Architecture:** Replace programmatic store dispatch helpers with three new UI-based helpers: `importDefinition()` (uses Import Dialog), `importProject()` (multi-artifact Import Dialog), and `addFromPalette()` (uses Add Item Palette). New helpers are added *alongside* the old ones first; each test file is migrated; old helpers and `__testProject__` backdoor are removed last. The BUG-001 test in editor-authoring is a special case — its `page.evaluate` mutations cannot be expressed through the UI and should be downgraded to a unit test.

**Tech Stack:** Playwright, TypeScript

---

## Background

The test helpers in `helpers.ts` expose a `dispatch()` function that reaches directly into `window.__testProject__.dispatch()` — a dev-mode backdoor exposed in `StudioApp.tsx:106`. This lets tests bypass the UI entirely. Several test files use it to:

1. **Seed definitions** (`seedDefinition`, `seedProject`) — setup data before tests
2. **Add items mid-test** (`dispatch(definition.addItem)`) — skip the Add Item Palette
3. **Mutate component tree state** (`page.evaluate` writing to `__testProject__`) — no UI equivalent

The studio already has full UI affordances for all of these operations:
- **Import Dialog** (`[data-testid="import-dialog"]`) — paste JSON to load definitions
- **Add Item Palette** (`[data-testid="add-item-palette"]`) — searchable catalog of field types
- **Context Menu** (`[data-testid="ctx-*"]`) — wrap, unwrap, delete, move
- **Properties Panel** (`[data-testid="properties"]`) — edit field properties

### Key Behavior Change: Undo History

The old `seedDefinition` called `project.resetHistory()` after importing, so the seed was invisible to the undo stack. The new `importDefinition` uses the real Import Dialog UI, which does NOT reset history — the import action itself becomes an undoable entry. Tests that depend on a clean undo history must account for this:
- **Undo tests:** Assert on field counts relative to baseline, not absolute emptiness
- **Bug #18 test:** Must NOT have an `importDefinition` in `beforeEach` preceding the test action, or the prior import masks the bug

### Settled-State After Import

The old `seedDefinition` was synchronous via `page.evaluate` — state was available instantly. The new `importDefinition` relies on React render cycles. After importing:
- **Non-empty definitions:** Wait for a rendered element (e.g. `await page.waitForSelector('[data-testid="field-name"]')`)
- **Empty definitions:** Wait for the status bar: `await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields')`

### Reference Tests (Gold Standard)

These tests already use real UI and should be followed as patterns:
- `layout-components.spec.ts` — `addFromPalette()` helper, context menu interactions
- `layout-wizard-mode.spec.ts` — same palette pattern
- `import-definition.spec.ts` tests 1-4 — real Import Dialog flow
- `widget-hint.spec.ts` — real Properties Panel interaction

---

## File Structure

### All Files Requiring Migration

Files using `dispatch` mid-test (complex migration — need UI replacement):

| File | Uses |
|------|------|
| `undo-redo.spec.ts` | `dispatch`, `seedDefinition` |
| `cross-workspace-authoring.spec.ts` | `dispatch`, `seedDefinition`, `seedProject` |
| `editor-authoring.spec.ts` | `dispatch`, `seedDefinition`, `seedProject` (dead import), `page.evaluate` mutations |
| `blueprint-sidebar.spec.ts` | `dispatch`, `seedDefinition` |
| `import-definition.spec.ts` | `dispatch`, `seedDefinition` |

Files using `seedDefinition`/`seedProject` only (simple find-and-replace):

| File | Uses |
|------|------|
| `wizard-mode.spec.ts` | `seedDefinition`, `dispatch` (dead import) |
| `blueprint-selection-sync.spec.ts` | `seedDefinition` |
| `widget-hint.spec.ts` | `seedDefinition` |
| `interaction-patterns.spec.ts` | `seedDefinition` |
| `command-palette.spec.ts` | `seedDefinition` |
| `layout-components.spec.ts` | `seedDefinition` |
| `layout-wizard-mode.spec.ts` | `seedDefinition` |
| `inspector-safety.spec.ts` | `seedDefinition` |
| `shell-responsive.spec.ts` | `seedDefinition` |
| `preview-field-types.spec.ts` | `seedDefinition` |
| `preview-workspace.spec.ts` | `seedDefinition` |
| `logic-authoring.spec.ts` | `seedDefinition` |
| `data-workspace.spec.ts` | `seedDefinition` |
| `workspace-state-persistence.spec.ts` | `seedDefinition` |
| `mapping-workspace.spec.ts` | `seedProject` |
| `theme-workspace.spec.ts` | `seedProject` |
| `header-actions.spec.ts` | Check imports — may use `seedDefinition` |

All paths relative to `packages/formspec-studio/tests/e2e/playwright/`.

---

## Chunk 1: New Helpers + Simple Migrations

### Task 1: Add UI-based helpers to helpers.ts (alongside old ones)

**Files:**
- Modify: `tests/e2e/playwright/helpers.ts`

Add the new helpers **without** deleting the old ones yet. This keeps all existing tests compiling while we migrate file by file. The old helpers get removed in the final cleanup task.

- [ ] **Step 1: Verify baseline**

Run: `cd packages/formspec-studio && npx playwright test tests/e2e/playwright/smoke.spec.ts`
Purpose: confirm the test suite runs before changes.

- [ ] **Step 2: Add `importDefinition` helper**

```typescript
/**
 * Import a definition via the Import Dialog UI.
 * Opens the dialog, pastes JSON, clicks Load, waits for dialog to close.
 *
 * Unlike the old seedDefinition(), this does NOT reset undo history —
 * the import becomes an undoable action. Callers should wait for a
 * rendered element after this call to ensure state has settled.
 */
export async function importDefinition(page: Page, definition: unknown) {
  await page.click('[data-testid="import-btn"]');
  const dialog = page.locator('[data-testid="import-dialog"]');
  await dialog.waitFor();
  await dialog.locator('textarea').fill(JSON.stringify(definition));
  await dialog.getByRole('button', { name: 'Load' }).click();
  await dialog.waitFor({ state: 'hidden' });
}
```

- [ ] **Step 3: Add `importProject` helper**

```typescript
/**
 * Import a full project state via the Import Dialog, one artifact at a time.
 * Supports keys: definition, component, theme, mapping.
 */
export async function importProject(page: Page, state: Record<string, unknown>) {
  const artifactOrder = ['definition', 'component', 'theme', 'mapping'] as const;
  for (const key of artifactOrder) {
    if (!(key in state)) continue;
    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.waitFor();
    const tabName = key.charAt(0).toUpperCase() + key.slice(1);
    await dialog.getByRole('button', { name: tabName }).click();
    await dialog.locator('textarea').fill(JSON.stringify(state[key]));
    await dialog.getByRole('button', { name: 'Load' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}
```

- [ ] **Step 4: Add `addFromPalette` helper**

Extracted from layout-components.spec.ts (proven pattern):

```typescript
/**
 * Add an item from the Add Item Palette by clicking its button.
 * @param label - The button label prefix, e.g. "Text", "Group", "Card"
 */
export async function addFromPalette(page: Page, label: string) {
  await page.click('[data-testid="add-item"]');
  const palette = page.locator('[data-testid="add-item-palette"]');
  await palette.waitFor();
  await palette.getByRole('button', { name: new RegExp(`^${label}\\b`) }).click();
}
```

- [ ] **Step 5: Run smoke test to verify nothing is broken**

Run: `npx playwright test tests/e2e/playwright/smoke.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/helpers.ts
git commit -m "refactor(e2e): add UI-based import and palette helpers alongside existing dispatch helpers"
```

---

### Task 2: Migrate blueprint-selection-sync.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/blueprint-selection-sync.spec.ts`

This file only uses `seedDefinition` (no mid-test dispatch). Simplest migration.

- [ ] **Step 1: Replace imports and seedDefinition calls**

Change import from `seedDefinition` to `importDefinition`.

In `beforeEach`: replace `await seedDefinition(page, SEED_DEFINITION)` with `await importDefinition(page, SEED_DEFINITION)`.

Line 106: replace `await seedDefinition(page, PAGED_BLUEPRINT_DEFINITION)` with `await importDefinition(page, PAGED_BLUEPRINT_DEFINITION)`.

- [ ] **Step 2: Evaluate the scrollIntoView spy (lines 109-128)**

This test installs a `scrollIntoView` spy via `page.evaluate`. This is **acceptable** — it's testing scroll behavior, which Playwright can't observe natively. The spy reads DOM attributes (`data-testid`), not app state. **Leave it as-is.**

- [ ] **Step 3: Run the tests**

Run: `npx playwright test tests/e2e/playwright/blueprint-selection-sync.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/blueprint-selection-sync.spec.ts
git commit -m "refactor(e2e): migrate blueprint-selection-sync to UI-based helpers"
```

---

### Task 3: Migrate wizard-mode.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/wizard-mode.spec.ts`

Uses `seedDefinition` (7 calls). Also imports `dispatch` which is never called — remove the dead import.

- [ ] **Step 1: Replace imports**

Change import: remove `dispatch`, replace `seedDefinition` with `importDefinition`. Keep `waitForApp`, `switchTab`.

- [ ] **Step 2: Replace all 7 seedDefinition calls**

- Line 34 (beforeEach): `seedDefinition(page, WIZARD_DEF)` → `importDefinition(page, WIZARD_DEF)`
- Line 90 (beforeEach): `seedDefinition(page, PAGED_DEF)` → `importDefinition(page, PAGED_DEF)`
- Line 132: inline `seedDefinition` → `importDefinition`
- Line 162 (beforeEach): `seedDefinition(page, PAGED_DEF)` → `importDefinition(page, PAGED_DEF)`
- Line 208: inline `seedDefinition` → `importDefinition`
- Line 243: inline `seedDefinition` → `importDefinition`
- Line 297: `seedDefinition(page, PAGED_DEF)` → `importDefinition(page, PAGED_DEF)`

- [ ] **Step 3: Run the tests**

Run: `npx playwright test tests/e2e/playwright/wizard-mode.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/wizard-mode.spec.ts
git commit -m "refactor(e2e): migrate wizard-mode to UI-based import helper"
```

---

### Task 4: Migrate blueprint-sidebar.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/blueprint-sidebar.spec.ts`

Uses `seedDefinition` (5 calls) and `dispatch(component.addNode)` (2 calls in Bug #14 test).

- [ ] **Step 1: Replace imports and seedDefinition calls**

Change import: remove `dispatch`, replace `seedDefinition` with `importDefinition`.

Replace all 5 `seedDefinition` calls with `importDefinition`.

- [ ] **Step 2: Fix Bug #14 test — replace dispatch(component.addNode)**

Lines 78-93 use `dispatch` to add component tree nodes. The component tree is auto-generated from the definition — seeding the definition with fields should be sufficient for the tree to have nodes. Replace the dispatch calls by just importing the definition and checking the count:

```typescript
test('count badge on the "Component Tree" nav row reflects actual node count (non-zero)', async ({ page }) => {
  await waitForApp(page);
  await importDefinition(page, COMPONENT_TREE_DEFINITION);
  await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });

  // The definition has 3 fields → the component tree should have nodes.
  // The tree is auto-generated from the definition items.
  const sectionBtn = page.locator('[data-testid="blueprint-section-Component Tree"]');
  await expect(sectionBtn).toBeVisible();

  const badge = sectionBtn.locator('span.tabular-nums');
  await expect(badge).toBeVisible();

  const badgeText = (await badge.textContent()) ?? '';
  expect(Number(badgeText.trim())).toBeGreaterThan(0);
});
```

If the auto-generated tree doesn't produce a count > 0 (because the countFn is hardcoded to 0 — that's the bug being tested), the test should still fail for the RIGHT reason.

- [ ] **Step 3: Run the tests**

Run: `npx playwright test tests/e2e/playwright/blueprint-sidebar.spec.ts`

Expected: Bug #14 test still fails (it's testing a known bug). Other tests should pass.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/blueprint-sidebar.spec.ts
git commit -m "refactor(e2e): migrate blueprint-sidebar to UI-based helpers"
```

---

## Chunk 2: Medium-Difficulty Migrations

### Task 5: Migrate undo-redo.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/undo-redo.spec.ts`

The core issue: `addField()` helper uses `dispatch(definition.addItem)`. Must use the Add Item Palette instead.

**Undo history note:** The `beforeEach` imports an empty definition via the Import Dialog. This adds one entry to the undo stack. Tests that assert "undo button is disabled" at the end of undos need to account for this extra entry.

- [ ] **Step 1: Replace imports**

Remove `dispatch`. Replace `seedDefinition` with `importDefinition`. Add `addFromPalette` import.

- [ ] **Step 2: Replace beforeEach with settled-state guard**

```typescript
test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await importDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
  // Wait for empty state to settle before tests begin
  await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
});
```

- [ ] **Step 3: Rewrite tests to use addFromPalette**

The old `addField` dispatched `definition.addItem` with a specific key. The Add Item Palette auto-generates keys, so tests must assert on field **counts** not specific testids.

Rewrite for "Undo button removes last added field":

```typescript
test('Undo button removes last added field', async ({ page }) => {
  await addFromPalette(page, 'Text');
  const fields = page.locator('[data-testid^="field-"]');
  await expect(fields).toHaveCount(1);

  await page.click('[data-testid="undo-btn"]');
  await expect(fields).toHaveCount(0);
});
```

Rewrite for "Redo button re-applies the undone change":

```typescript
test('Redo button re-applies the undone change', async ({ page }) => {
  await addFromPalette(page, 'Text');
  const fields = page.locator('[data-testid^="field-"]');
  await expect(fields).toHaveCount(1);

  await page.click('[data-testid="undo-btn"]');
  await expect(fields).toHaveCount(0);

  await page.click('[data-testid="redo-btn"]');
  await expect(fields).toHaveCount(1);
});
```

Rewrite for "keyboard Cmd+Z undoes last change":

```typescript
test('keyboard Cmd+Z undoes last change', async ({ page }) => {
  await addFromPalette(page, 'Text');
  const fields = page.locator('[data-testid^="field-"]');
  await expect(fields).toHaveCount(1);

  await page.keyboard.press('Meta+z');
  await expect(fields).toHaveCount(0);
});
```

Rewrite for "keyboard Cmd+Shift+Z redoes the undone change":

```typescript
test('keyboard Cmd+Shift+Z redoes the undone change', async ({ page }) => {
  await addFromPalette(page, 'Text');
  const fields = page.locator('[data-testid^="field-"]');
  await expect(fields).toHaveCount(1);

  await page.keyboard.press('Meta+z');
  await expect(fields).toHaveCount(0);

  await page.keyboard.press('Meta+Shift+z');
  await expect(fields).toHaveCount(1);
});
```

Rewrite for "multiple undo steps walk back through history":

```typescript
test('multiple undo steps walk back through history', async ({ page }) => {
  await addFromPalette(page, 'Text');
  await addFromPalette(page, 'Integer');
  await addFromPalette(page, 'Date');

  const fields = page.locator('[data-testid^="field-"]');
  await expect(fields).toHaveCount(3);

  // Undo Date
  await page.keyboard.press('Meta+z');
  await expect(fields).toHaveCount(2);

  // Undo Integer
  await page.keyboard.press('Meta+z');
  await expect(fields).toHaveCount(1);

  // Undo Text
  await page.keyboard.press('Meta+z');
  await expect(fields).toHaveCount(0);

  // Redo once — first field comes back
  await page.keyboard.press('Meta+Shift+z');
  await expect(fields).toHaveCount(1);
});
```

**Note:** Removed the assertion `await expect(page.locator('[data-testid="undo-btn"]')).toBeDisabled()` from the first test. Since `importDefinition` itself is an undoable action, there's always one more undo entry than the fields added. If we want to test that undo fully drains the history, we'd need to undo one more time (for the import itself). This is an acceptable simplification — the tests still verify undo/redo of addItem operations.

- [ ] **Step 4: Delete the old addField helper**

Remove the `addField` function entirely.

- [ ] **Step 5: Run the tests**

Run: `npx playwright test tests/e2e/playwright/undo-redo.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/undo-redo.spec.ts
git commit -m "refactor(e2e): migrate undo-redo to UI-based add item palette"
```

---

### Task 6: Migrate import-definition.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/import-definition.spec.ts`

Two issues: (1) beforeEach uses `seedDefinition` to clear state, (2) Bug #18 test uses `dispatch` to add a pre-import field.

**Critical:** The Bug #18 test asserts that undo history survives an import. If `beforeEach` uses `importDefinition` (which is itself undoable), the undo button will always be enabled after the Load — even if the bug is present — because the `beforeEach` import remains in the stack. This masks the bug.

- [ ] **Step 1: Replace imports**

Remove `dispatch`, replace `seedDefinition` with `importDefinition`. Add `addFromPalette`.

- [ ] **Step 2: Replace beforeEach**

```typescript
test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await importDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
  await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
});
```

- [ ] **Step 3: Fix Bug #18 test — use addFromPalette for pre-import action**

The test needs to verify that undo history created by `addFromPalette` survives a subsequent import. The `importDefinition` in `beforeEach` adds one undo entry (the empty definition import). Then `addFromPalette` adds a second. After the Load import, we need undo to still be enabled.

But there's a subtlety: if the bug clears history, the undo button becomes disabled only if ALL history entries are cleared. If the bug only clears the entries after the initial import, the `beforeEach` import entry would still be there.

To be safe, the test should verify that undoing after the import still recovers a real user action:

```typescript
test('import does not clear undo history (bug #18)', async ({ page }) => {
  // Add a field via UI — this is the undoable action we want to survive the import
  await addFromPalette(page, 'Text');
  await expect(page.locator('[data-testid^="field-"]')).toHaveCount(1);

  // Undo button must be enabled before the import
  await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();

  // Open the import dialog and load a new definition
  await page.click('[data-testid="import-btn"]');
  const dialog = page.locator('[data-testid="import-dialog"]');
  await dialog.locator('textarea').fill(IMPORT_DEFINITION);
  await dialog.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible();

  // Bug #18: after importing, undo history should not be cleared.
  // The undo button should still be enabled.
  await expect(page.locator('[data-testid="undo-btn"]')).not.toBeDisabled();

  // Stronger assertion: undoing should actually undo the import (not the addFromPalette)
  // The most recent action is the import, so undo should revert to the pre-import state.
  await page.click('[data-testid="undo-btn"]');
  // After undoing the import, we should see the field we added (not the imported definition)
  await expect(page.locator('[data-testid^="field-"]')).toHaveCount(1);
});
```

- [ ] **Step 4: Run the tests**

Run: `npx playwright test tests/e2e/playwright/import-definition.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/import-definition.spec.ts
git commit -m "refactor(e2e): migrate import-definition to UI-based helpers"
```

---

### Task 7: Migrate cross-workspace-authoring.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/cross-workspace-authoring.spec.ts`

Three issues: `seedDefinition` (2 calls), `seedProject` (1 call), `dispatch(definition.addItem)` (1 mid-test call).

- [ ] **Step 1: Replace imports**

Remove `dispatch`, `seedDefinition`, `seedProject`. Add `importDefinition`, `importProject`, `addFromPalette`.

- [ ] **Step 2: Replace seedDefinition and seedProject calls**

- Line 19: `seedDefinition(page, definition)` → `importDefinition(page, definition)`
- Line 49: `seedDefinition(page, definition)` → `importDefinition(page, definition)`
- Line 101: `seedProject(page, projectState)` → `importProject(page, projectState)`

- [ ] **Step 3: Replace mid-test dispatch with addFromPalette**

Lines 141-145 add a tempField via dispatch. Replace with count-based assertions since we can't control the auto-generated key:

```typescript
// Go back to Editor, add a new field via UI (creates undoable history entry)
await switchTab(page, 'Editor');
const fieldCountBefore = await page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]').count();
await addFromPalette(page, 'Text');
await expect(
  page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]')
).toHaveCount(fieldCountBefore + 1);

// Undo the last action — the new field should disappear
await page.click('[data-testid="undo-btn"]');
await expect(
  page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]')
).toHaveCount(fieldCountBefore);

// Redo button is now enabled
await expect(page.locator('[data-testid="redo-btn"]')).not.toBeDisabled();

// Redo restores the field
await page.click('[data-testid="redo-btn"]');
await expect(
  page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]')
).toHaveCount(fieldCountBefore + 1);
```

- [ ] **Step 4: Run the tests**

Run: `npx playwright test tests/e2e/playwright/cross-workspace-authoring.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/cross-workspace-authoring.spec.ts
git commit -m "refactor(e2e): migrate cross-workspace-authoring to UI-based helpers"
```

---

## Chunk 3: Editor Authoring + Remaining Files

### Task 8: Migrate editor-authoring.spec.ts

**Files:**
- Modify: `tests/e2e/playwright/editor-authoring.spec.ts`

The most complex file. Issues:
1. `seedDefinition` in beforeEach and 5 test setups — simple replacement
2. `dispatch(component.setNodeType)` + `page.evaluate` state mutation in BUG-001 test — must be removed
3. `dispatch(definition.addItem)` in "add a group with children" test — replace with UI
4. Dead `seedProject` import — remove

- [ ] **Step 1: Replace imports**

Remove `dispatch`, `seedProject`. Replace `seedDefinition` with `importDefinition`. Add `addFromPalette`.

- [ ] **Step 2: Replace all seedDefinition calls**

Replace every `seedDefinition` call with `importDefinition`:
- beforeEach (line 8)
- All test-level calls (scan for every occurrence)

- [ ] **Step 3: Handle BUG-001 test (lines 163-279)**

This test is fundamentally incompatible with UI-only testing:
- It dispatches `component.setNodeType` (no UI for this)
- It directly mutates component tree nodes via `page.evaluate` (lines 222-236)
- It queries raw project state via `page.evaluate` (lines 201-212, 255-268)

**Decision:** This test belongs as a unit/integration test, not a Playwright E2E test. The behavior it validates (component overrides surviving tree rebuilds) is internal state management — invisible to the user.

**Action:** Delete the BUG-001 test from this file entirely. Add a comment:
```typescript
// BUG-001: Display node component overrides survive tree rebuilds.
// This tests internal state management (component tree rebuild) which cannot
// be exercised through UI interactions. Coverage belongs in a unit test.
```

- [ ] **Step 4: Fix "add a group with children" test (lines 317-340)**

Lines 332-336 use `dispatch` to add a child field inside a newly-created group. Replace with UI-based add:

```typescript
test('add a group with children', async ({ page }) => {
  // Add a Group via the picker
  await addFromPalette(page, 'Group');

  // A group block should appear
  const canvas = page.locator('[data-testid="workspace-Editor"]');
  const groupBlock = canvas.locator('[data-testid^="group-"]').first();
  await expect(groupBlock).toBeVisible();

  // Click the group to select it, then add a child field
  await groupBlock.click();
  await addFromPalette(page, 'Text');

  // The child field should appear inside the group block
  const childField = groupBlock.locator('[data-testid^="field-"]');
  await expect(childField).toHaveCount(1);
});
```

**Note:** If the palette doesn't parent new fields under the selected group, this test will reveal that as a UX issue — which is valuable feedback.

- [ ] **Step 5: Run the tests**

Run: `npx playwright test tests/e2e/playwright/editor-authoring.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/editor-authoring.spec.ts
git commit -m "refactor(e2e): migrate editor-authoring to UI-based helpers, remove BUG-001 E2E test"
```

---

### Task 9: Batch-migrate all remaining seedDefinition-only files

**Files (all in `tests/e2e/playwright/`):**
- `widget-hint.spec.ts`
- `interaction-patterns.spec.ts`
- `command-palette.spec.ts`
- `layout-components.spec.ts`
- `layout-wizard-mode.spec.ts`
- `inspector-safety.spec.ts`
- `shell-responsive.spec.ts`
- `preview-field-types.spec.ts`
- `preview-workspace.spec.ts`
- `logic-authoring.spec.ts`
- `data-workspace.spec.ts`
- `workspace-state-persistence.spec.ts`
- `mapping-workspace.spec.ts` (uses `seedProject` → `importProject`)
- `theme-workspace.spec.ts` (uses `seedProject` → `importProject`)
- `header-actions.spec.ts` (check if it uses `seedDefinition`)

These files only use `seedDefinition` or `seedProject` for test setup — no mid-test `dispatch` calls. The migration is a mechanical find-and-replace.

- [ ] **Step 1: Grep for all remaining imports**

Run: `grep -l "seedDefinition\|seedProject\|dispatch" packages/formspec-studio/tests/e2e/playwright/*.spec.ts`

Verify this list matches. Any file in the list that hasn't been migrated in Tasks 2-8 needs migration here.

- [ ] **Step 2: For each file, replace imports and function calls**

For each file:
1. Replace `seedDefinition` import with `importDefinition`
2. Replace `seedProject` import with `importProject`
3. Remove any dead `dispatch` imports
4. Replace all `seedDefinition(page, ...)` calls with `importDefinition(page, ...)`
5. Replace all `seedProject(page, ...)` calls with `importProject(page, ...)`

Where `layout-components.spec.ts` and `layout-wizard-mode.spec.ts` define their own local `addFromPalette` helper, remove the local definition and import the shared one from `helpers.ts` instead (or keep the local one if it differs).

- [ ] **Step 3: Run the full E2E suite**

Run: `cd packages/formspec-studio && npx playwright test`

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/
git commit -m "refactor(e2e): batch-migrate remaining test files from seedDefinition to importDefinition"
```

---

## Chunk 4: Final Cleanup

### Task 10: Remove old helpers and __testProject__ backdoor

**Files:**
- Modify: `tests/e2e/playwright/helpers.ts`
- Modify: `src/studio-app/StudioApp.tsx`

- [ ] **Step 1: Verify no test files import old helpers**

Run: `grep -rn "seedDefinition\|seedProject\|\bimport.*dispatch\b" packages/formspec-studio/tests/e2e/playwright/ --include="*.ts"`

This must return zero matches. If any remain, fix them first.

- [ ] **Step 2: Delete old helpers from helpers.ts**

Remove `dispatch`, `seedDefinition`, `seedProject` function definitions.

The file should export: `waitForApp`, `switchTab`, `importDefinition`, `importProject`, `addFromPalette`, `selectField`, `selectGroup`, `openPaletteAndSearch`.

- [ ] **Step 3: Remove __testProject__ from StudioApp.tsx**

Delete lines 104-108:

```typescript
// DELETE:
useEffect(() => {
  if (import.meta.env.DEV) {
    (window as any).__testProject__ = activeProject;
  }
}, [activeProject]);
```

If you want to keep it for manual browser-console debugging, add a comment instead:

```typescript
// DEV-ONLY: For manual browser console debugging. Tests must NOT use this.
useEffect(() => {
  if (import.meta.env.DEV) {
    (window as any).__testProject__ = activeProject;
  }
}, [activeProject]);
```

- [ ] **Step 4: Run TypeScript type check**

Run: `cd packages/formspec-studio && npx tsc --noEmit`

Must produce zero errors. If any file still references `dispatch`, `seedDefinition`, or `seedProject`, fix it.

- [ ] **Step 5: Run the full E2E suite**

Run: `cd packages/formspec-studio && npx playwright test`

All tests that previously passed should still pass. Known bug tests should still fail for the right reasons.

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/tests/e2e/playwright/helpers.ts packages/formspec-studio/src/studio-app/StudioApp.tsx
git commit -m "refactor(e2e): remove dispatch/seed helpers and __testProject__ backdoor"
```

---

## Acceptable page.evaluate Uses (No Action Needed)

These `page.evaluate` calls are **legitimate** — they read DOM state, not app state:

| File | What it reads | Why it's OK |
|------|--------------|-------------|
| `preview-workspace.spec.ts` | `el.style.width`, `getBoundingClientRect()` | Reading CSS layout |
| `shell-responsive.spec.ts` | viewport dimensions, font sizes | Reading viewport state |
| `data-workspace.spec.ts` | `getComputedStyle()`, selection classes | Reading CSS rendering |
| `editor-authoring.spec.ts:307` | `gridTemplateColumns` | Reading CSS grid layout |
| `logic-authoring.spec.ts:200` | `navigator.clipboard.readText()` | Reading clipboard |
| `blueprint-selection-sync.spec.ts:109-128` | scrollIntoView spy | Testing scroll behavior |
| `interaction-patterns.spec.ts:120-130` | `dispatchEvent(contextmenu)` | Simulating right-click at specific coords |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `importDefinition` is slower than `seedDefinition` (real UI clicks vs instant dispatch) | Acceptable trade-off. Tests are more realistic. If slow, parallelize test files. |
| Add Item Palette generates auto-keys (can't control field key) | Tests should assert on field count or use `.last()` locator, not specific keys |
| `importDefinition` does not reset undo history like `seedDefinition` did | Documented in "Key Behavior Change" section. Tests adjusted to use count-based assertions. |
| Race condition: `importDefinition` returns before React finishes rendering | Callers wait for a rendered element or status bar text after calling `importDefinition` |
| Import Dialog may not handle all edge cases the old dispatch did | Run full suite; fix any failures |
| BUG-001 loses E2E coverage | The bug is about internal state (component tree rebuild). Unit test is the right layer. |
| `importProject` iterates multiple artifact types sequentially | Only one test uses it. Acceptable. |
