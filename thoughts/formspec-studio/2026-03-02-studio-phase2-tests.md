# Studio Phase 2–3 Integration & E2E Tests

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add integration tests (vitest) and E2E tests (Playwright) covering live preview, import/export, artifact editors, and options editing. Fix broken E2E tests caused by Phase 2–3 implementation changes.

**Architecture:** Unit tests use vitest + @testing-library/preact + happy-dom. E2E tests use Playwright against `form-builder/dist/` (built with `npx vite build` in `form-builder/`). Preview tests mock `formspec-webcomponent` at unit level; E2E tests exercise the real web component.

**Tech Stack:** vitest, @testing-library/preact, happy-dom, Playwright, Chromium

---

### Task 1: Fix broken E2E tests from Phase 2–3 changes

The topbar import/export buttons no longer show "Phase 2" toasts — they now trigger real file picker / download. The E2E test `shows import and export toasts` in `topbar-and-sidebar.spec.ts` is broken.

**Files:**
- Modify: `tests/e2e/playwright/studio/topbar-and-sidebar.spec.ts`

**Step 1: Update the broken test**

Replace the "shows import and export toasts" test. Export now triggers a download (which we can verify via the download event). Import opens a file picker (which we can verify doesn't crash).

```ts
test('export button triggers download and shows success toast', async ({ page }) => {
  await page.getByRole('button', { name: 'Export project' }).click();

  // The download triggers a blob URL — Playwright captures it as a download event
  // But file:// pages may not produce download events, so just check the toast
  await expect(page.locator('.toast')).toContainText('Definition exported');
});
```

**Step 2: Rebuild and run E2E**

```bash
cd form-builder && npx vite build
cd .. && npx playwright test tests/e2e/playwright/studio/ --reporter=list
```

**Step 3: Commit**

```
fix(studio): update E2E tests for import/export behavior change
```

---

### Task 2: E2E — Live preview renders form fields

**Files:**
- Create: `tests/e2e/playwright/studio/live-preview.spec.ts`

**Tests:**

```
'preview pane renders formspec-render element on load'
'preview shows seed definition fields (Full Name, Email, Additional Notes)'
'preview updates when field is added via tree editor'
'preview updates when field is deleted from tree'
'preview shows error overlay when definition is invalid'
'preview recovers from error when valid definition is restored'
```

**Step 1: Write the spec file**

```ts
import { expect, test } from '@playwright/test';
import { gotoStudio, selectTreeNode } from './helpers';

test.describe('Formspec Studio - Live Preview', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('preview pane renders formspec-render element on load', async ({ page }) => {
    const preview = page.locator('.preview-container');
    await expect(preview).toBeVisible();
    // formspec-render is a custom element inside the preview container
    await expect(preview.locator('formspec-render')).toBeAttached();
  });

  test('preview shows seed definition fields', async ({ page }) => {
    const preview = page.locator('.preview-container formspec-render');
    // Wait for the debounced render (300ms + render time)
    await page.waitForTimeout(500);
    // Seed definition has: basicInfo group with fullName + email, and notes
    await expect(preview.locator('[data-name="fullName"]')).toBeAttached();
    await expect(preview.locator('[data-name="email"]')).toBeAttached();
    await expect(preview.locator('[data-name="notes"]')).toBeAttached();
  });

  test('preview updates when field is added via tree editor', async ({ page }) => {
    // Add a new root field
    await page.locator('.tree-add-root .tree-add-btn').click();
    await page.fill('.inline-add-input', 'Phone');
    await page.press('.inline-add-input', 'Enter');

    // Wait for debounced update
    await page.waitForTimeout(600);
    const preview = page.locator('.preview-container formspec-render');
    await expect(preview.locator('[data-name="phone"]')).toBeAttached();
  });

  test('preview updates when field is deleted from tree', async ({ page }) => {
    const preview = page.locator('.preview-container formspec-render');
    await page.waitForTimeout(500);
    await expect(preview.locator('[data-name="notes"]')).toBeAttached();

    await selectTreeNode(page, 'Additional Notes');
    await page.getByTitle('Delete').click();

    await page.waitForTimeout(600);
    await expect(preview.locator('[data-name="notes"]')).not.toBeAttached();
  });

  test('preview shows error overlay when definition is invalid', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON' }).click();
    await page.locator('.json-editor-textarea').fill('{}');
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    await expect(page.locator('.preview-error')).toBeVisible();
    await expect(page.locator('.preview-error')).toContainText('Fix definition errors');
  });

  test('preview recovers from error when valid definition is restored', async ({ page }) => {
    // Break definition
    await page.getByRole('button', { name: 'JSON' }).click();
    const editor = page.locator('.json-editor-textarea');
    const original = await editor.inputValue();
    await editor.fill('{}');
    await page.getByRole('button', { name: 'Apply Changes' }).click();
    await expect(page.locator('.preview-error')).toBeVisible();

    // Restore
    await editor.fill(original);
    await page.getByRole('button', { name: 'Apply Changes' }).click();
    await expect(page.locator('.preview-error')).not.toBeVisible();
  });
});
```

**Step 2: Build and run**

```bash
cd form-builder && npx vite build
cd .. && npx playwright test tests/e2e/playwright/studio/live-preview.spec.ts --reporter=list
```

**Step 3: Fix any failures and commit**

```
test(studio): add E2E tests for live preview rendering
```

---

### Task 3: E2E — Selection sync (tree ↔ preview)

**Files:**
- Create: `tests/e2e/playwright/studio/selection-sync.spec.ts`

**Tests:**

```
'clicking tree node highlights corresponding field in preview'
'clicking field in preview selects corresponding tree node'
'highlight fades after delay'
'selecting a different tree node removes previous highlight'
```

**Step 1: Write the spec file**

```ts
import { expect, test } from '@playwright/test';
import { gotoStudio, selectTreeNode } from './helpers';

test.describe('Formspec Studio - Selection Sync', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
    // Wait for preview to render seed definition
    await page.waitForTimeout(600);
  });

  test('clicking tree node highlights corresponding field in preview', async ({ page }) => {
    await selectTreeNode(page, 'Full Name');
    const previewField = page.locator('.preview-container [data-name="fullName"]');
    await expect(previewField).toHaveClass(/preview-highlight/);
  });

  test('clicking field in preview selects corresponding tree node', async ({ page }) => {
    const previewField = page.locator('.preview-container [data-name="fullName"]');
    await previewField.click();

    // Tree node should be selected
    const treeNode = page.locator('.tree-node.selected .tree-node-label');
    await expect(treeNode).toHaveText('Full Name');
    // Properties panel should show field properties
    await expect(page.locator('.property-type-header')).toContainText('Field');
  });

  test('highlight fades after delay', async ({ page }) => {
    await selectTreeNode(page, 'Full Name');
    const previewField = page.locator('.preview-container [data-name="fullName"]');
    await expect(previewField).toHaveClass(/preview-highlight/);

    // After 1.5s the highlight should be removed
    await page.waitForTimeout(1800);
    await expect(previewField).not.toHaveClass(/preview-highlight/);
  });

  test('selecting a different tree node removes previous highlight', async ({ page }) => {
    await selectTreeNode(page, 'Full Name');
    const fullNameField = page.locator('.preview-container [data-name="fullName"]');
    await expect(fullNameField).toHaveClass(/preview-highlight/);

    await selectTreeNode(page, 'Email');
    const emailField = page.locator('.preview-container [data-name="email"]');
    await expect(emailField).toHaveClass(/preview-highlight/);
    await expect(fullNameField).not.toHaveClass(/preview-highlight/);
  });
});
```

**Step 2: Build and run**

```bash
cd form-builder && npx vite build
cd .. && npx playwright test tests/e2e/playwright/studio/selection-sync.spec.ts --reporter=list
```

**Step 3: Commit**

```
test(studio): add E2E tests for bidirectional selection sync
```

---

### Task 4: E2E — Artifact editors (create, edit, remove)

**Files:**
- Create: `tests/e2e/playwright/studio/artifact-editors.spec.ts`

**Tests:**

```
'Create from Scratch creates component artifact and shows JSON editor'
'artifact JSON editor applies valid changes'
'artifact JSON editor shows error on invalid JSON'
'artifact JSON editor reverts to last applied state'
'Remove button clears artifact and returns to empty tab'
'sidebar shows configured status after creating artifact'
```

**Step 1: Write the spec file**

```ts
import { expect, test } from '@playwright/test';
import { gotoStudio } from './helpers';

test.describe('Formspec Studio - Artifact Editors', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('Create from Scratch creates component artifact and shows JSON editor', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Component"]').click();
    await expect(page.locator('.empty-tab-title')).toHaveText('Component not configured');

    await page.getByRole('button', { name: 'Create from Scratch' }).click();
    await expect(page.locator('.toast')).toContainText('component created');

    // Should now show the JSON editor (not empty tab)
    await expect(page.locator('.json-editor-textarea')).toBeVisible();
    const json = await page.locator('.json-editor-textarea').inputValue();
    expect(json).toContain('$formspecComponent');
  });

  test('artifact JSON editor applies valid changes', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Theme"]').click();
    await page.getByRole('button', { name: 'Create from Scratch' }).click();

    const editor = page.locator('.json-editor-textarea');
    const current = await editor.inputValue();
    const modified = current.replace('"1.0.0"', '"2.0.0"');
    await editor.fill(modified);
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    await expect(page.locator('.json-editor-status.applied')).toContainText('Applied');
  });

  test('artifact JSON editor shows error on invalid JSON', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Mapping"]').click();
    await page.getByRole('button', { name: 'Create from Scratch' }).click();

    await page.locator('.json-editor-textarea').fill('{invalid');
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    await expect(page.locator('.json-editor-status.error')).toBeVisible();
  });

  test('artifact JSON editor reverts to last applied state', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Registry"]').click();
    await page.getByRole('button', { name: 'Create from Scratch' }).click();

    const editor = page.locator('.json-editor-textarea');
    const original = await editor.inputValue();
    await editor.fill('{ "modified": true }');
    await page.getByRole('button', { name: 'Revert' }).click();

    await expect(editor).toHaveValue(original);
  });

  test('Remove button clears artifact and returns to empty tab', async ({ page }) => {
    await page.locator('.sidebar-tab[title="Changelog"]').click();
    await page.getByRole('button', { name: 'Create from Scratch' }).click();
    await expect(page.locator('.json-editor-textarea')).toBeVisible();

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.toast')).toContainText('changelog removed');
    await expect(page.locator('.empty-tab-title')).toHaveText('Changelog not configured');
  });

  test('sidebar shows configured status after creating artifact', async ({ page }) => {
    // Hover sidebar to expand it
    await page.locator('.studio-sidebar').hover();

    // Before: unconfigured
    const componentTab = page.locator('.sidebar-tab[title="Component"]');
    await expect(componentTab.locator('.sidebar-tab-status')).toContainText('—');

    // Create component artifact
    await componentTab.click();
    await page.getByRole('button', { name: 'Create from Scratch' }).click();

    // After: configured
    await page.locator('.studio-sidebar').hover();
    await expect(componentTab.locator('.sidebar-tab-status')).toContainText('✓');
  });
});
```

**Step 2: Build and run**

```bash
cd form-builder && npx vite build
cd .. && npx playwright test tests/e2e/playwright/studio/artifact-editors.spec.ts --reporter=list
```

**Step 3: Commit**

```
test(studio): add E2E tests for artifact editors (create, edit, remove)
```

---

### Task 5: E2E — Options editing for choice/multiChoice fields

**Files:**
- Create: `tests/e2e/playwright/studio/options-editor.spec.ts`

**Tests:**

```
'options editor appears when data type is set to choice'
'options editor appears when data type is set to multiChoice'
'options editor hidden for non-choice data types'
'add option creates a new value/label row'
'edit option value and label updates definition'
'remove option removes the row'
'options persist through JSON round-trip'
```

**Step 1: Write the spec file**

```ts
import { expect, test } from '@playwright/test';
import { gotoStudio, propertyInput, selectTreeNode } from './helpers';

test.describe('Formspec Studio - Options Editor', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
    await selectTreeNode(page, 'Full Name');
  });

  test('options editor appears when data type is set to choice', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('choice');
    await expect(page.locator('.options-editor')).toBeVisible();
    await expect(page.locator('.add-option-btn')).toBeVisible();
  });

  test('options editor appears when data type is set to multiChoice', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('multiChoice');
    await expect(page.locator('.options-editor')).toBeVisible();
  });

  test('options editor hidden for non-choice data types', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('string');
    await expect(page.locator('.options-editor')).not.toBeVisible();
  });

  test('add option creates a new value/label row', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('choice');
    await page.locator('.add-option-btn').click();

    await expect(page.locator('.option-row')).toHaveCount(1);
    await expect(page.getByLabel('Option 1 value')).toBeVisible();
    await expect(page.getByLabel('Option 1 label')).toBeVisible();
  });

  test('edit option value and label updates definition', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('choice');
    await page.locator('.add-option-btn').click();

    await page.getByLabel('Option 1 value').fill('opt_a');
    await page.getByLabel('Option 1 label').fill('Option A');

    // Verify in JSON
    await page.getByRole('button', { name: 'JSON' }).click();
    const json = await page.locator('.json-editor-textarea').inputValue();
    expect(json).toContain('"opt_a"');
    expect(json).toContain('"Option A"');
  });

  test('remove option removes the row', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('choice');
    await page.locator('.add-option-btn').click();
    await page.locator('.add-option-btn').click();
    await expect(page.locator('.option-row')).toHaveCount(2);

    await page.getByLabel('Remove option 1').click();
    await expect(page.locator('.option-row')).toHaveCount(1);
  });

  test('options persist through JSON round-trip', async ({ page }) => {
    await propertyInput(page, 'Data Type').selectOption('choice');
    await page.locator('.add-option-btn').click();
    await page.getByLabel('Option 1 value').fill('yes');
    await page.getByLabel('Option 1 label').fill('Yes');

    // Switch to JSON and back
    await page.getByRole('button', { name: 'JSON' }).click();
    await page.getByRole('button', { name: 'Guided' }).click();

    await selectTreeNode(page, 'Full Name');
    await expect(page.locator('.option-row')).toHaveCount(1);
    await expect(page.getByLabel('Option 1 value')).toHaveValue('yes');
  });
});
```

**Step 2: Build and run**

```bash
cd form-builder && npx vite build
cd .. && npx playwright test tests/e2e/playwright/studio/options-editor.spec.ts --reporter=list
```

**Step 3: Commit**

```
test(studio): add E2E tests for choice/multiChoice options editor
```

---

### Task 6: Integration test — Preview component (vitest)

**Files:**
- Modify: `form-builder/src/__tests__/preview.test.tsx`

The existing preview test file has 3 basic tests. Expand to cover more integration scenarios with mocked state.

**Tests to add:**

```
'creates formspec-render custom element on mount'
'sets definition on formspec-render when definitionVersion changes'
'click on data-name element sets selectedPath'
'scrolls and highlights element when selectedPath changes'
'cleans up event listener and element on unmount'
```

**Step 1: Expand the test file**

These tests mock `formspec-webcomponent` (no real custom element registration in happy-dom) and verify the Preview component's DOM manipulation and event wiring.

**Step 2: Run**

```bash
cd form-builder && npx vitest run src/__tests__/preview.test.tsx
```

**Step 3: Commit**

```
test(studio): expand preview integration tests
```

---

### Task 7: Integration test — Import/Export actions (vitest)

The existing `import-export.test.ts` covers the pure logic functions. Add integration tests for the action wrappers (`handleImport`, `handleExport`).

**Files:**
- Create: `form-builder/src/logic/__tests__/import-export-actions.test.ts`

**Tests:**

```
'handleExport calls exportDefinitionJSON and shows success toast'
'handleExport shows error toast on failure'
'handleImport calls setDefinition on valid file'
'handleImport shows error toast on invalid file'
'handleImport does nothing when file picker is cancelled'
```

**Step 1: Write tests**

Mock `pickAndReadJSONFile` and `exportDefinitionJSON` from `../import-export`, verify toast and state side effects.

**Step 2: Run**

```bash
cd form-builder && npx vitest run src/logic/__tests__/import-export-actions.test.ts
```

**Step 3: Commit**

```
test(studio): add integration tests for import/export actions
```

---

### Summary of all test files

| File | Type | Count | Focus |
|------|------|-------|-------|
| `topbar-and-sidebar.spec.ts` | E2E | fix 1 | Fix broken toast test |
| `live-preview.spec.ts` | E2E | 6 | Preview renders, updates, error/recovery |
| `selection-sync.spec.ts` | E2E | 4 | Tree↔preview selection, highlight |
| `artifact-editors.spec.ts` | E2E | 6 | Create/edit/revert/remove artifacts |
| `options-editor.spec.ts` | E2E | 7 | Choice field options CRUD + round-trip |
| `preview.test.tsx` | Unit | +5 | Preview DOM manipulation, events |
| `import-export-actions.test.ts` | Unit | 5 | Action wrappers, toasts |

**Total: ~34 new tests across 7 files**
