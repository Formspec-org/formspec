import { test, expect } from '@playwright/test';
import { addFromPalette, editorFieldRows, editorGroupRows, importDefinition, waitForApp } from './helpers';

test.describe('Editor Authoring', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
  });

  test('add a field via AddItemPicker', async ({ page }) => {
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');
    await addFromPalette(page, 'Text');

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid^="field-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('1 field');
  });

  test('adding an item in wizard mode selects the new field in the inspector', async ({ page }) => {
    // Editor/Layout split: The Editor is now a flat tree — no page tabs.
    // Adding an item always appends to the root definition items list.
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:wizard-add-select',
      formPresentation: { pageMode: 'wizard' },
      items: [
        {
          key: 'pageOne',
          type: 'group',
          label: 'Page One',
          children: [{ key: 'marital', type: 'field', dataType: 'string', label: 'Marital Status' }],
        },
        {
          key: 'pageTwo',
          type: 'group',
          label: 'Page Two',
          children: [],
        },
      ],
    });

    // Select an existing field first
    await page.click('[data-testid="field-marital"]');

    // Add a new field via palette
    await addFromPalette(page, 'Text');

    // The newly added field should be auto-selected (has selected styling)
    const fields = editorFieldRows(page);
    const allFields = await fields.all();
    const lastField = allFields[allFields.length - 1];
    // The newly added field should have selected styling (border-accent)
    await expect(lastField).toHaveClass(/border-accent/);
  });

  test('adding a Single Choice field auto-selects the new field', async ({ page }) => {
    await addFromPalette(page, 'Single Choice');

    // After adding, the new field should be auto-selected (has border-accent styling)
    const fields = editorFieldRows(page);
    await expect(fields).toHaveCount(1);
    await expect(fields.first()).toHaveClass(/border-accent/);
  });

  test('select a field — field row shows selected styling with key and type', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    await page.click('[data-testid="field-myField"]');

    // Field row should have selected styling
    const row = page.locator('[data-testid="field-myField"]');
    await expect(row).toHaveClass(/border-accent/);
    // Key text and data type should be visible in the row
    await expect(row).toContainText('myField');
    await expect(row).toContainText('string');
  });

  test('rename a field via inline key editing', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'oldName', type: 'field', dataType: 'string', label: 'Old Name' }],
    });

    // Select the field
    await page.click('[data-testid="field-oldName"]');

    // Click the key text to open inline key editor
    const row = page.locator('[data-testid="field-oldName"]');
    await row.locator('[data-testid="field-oldName-key-edit"]').click();

    // Fill the inline key input
    const keyInput = page.getByLabel('Inline key');
    await keyInput.fill('firstName');
    await keyInput.press('Enter');

    await expect(page.locator('[data-testid="field-firstName"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-oldName"]')).not.toBeVisible();
  });

  test('duplicate a field via context menu', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    await page.click('[data-testid="field-myField"]', { button: 'right' });
    await page.click('[data-testid="ctx-duplicate"]');

    const fieldBlocks = editorFieldRows(page);
    await expect(fieldBlocks).toHaveCount(2);
  });

  test('delete a field via context menu', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'toDelete', type: 'field', dataType: 'string', label: 'To Delete' }],
    });

    await page.click('[data-testid="field-toDelete"]', { button: 'right' });
    await page.click('[data-testid="ctx-delete"]');
    // Confirm the delete dialog
    await page.getByRole('button', { name: /Confirm Delete/i }).click();

    await expect(page.locator('[data-testid="field-toDelete"]')).not.toBeVisible();
  });

  // BUG-001: Display node component overrides survive tree rebuilds.
  // This is covered in formspec-studio-core tree-sync tests because the
  // behavior is internal state management, not a UI workflow.

  // BUG-004: AddItemPalette is not mobile-safe — grid stays two-column on narrow viewports
  // RED: The palette uses `grid grid-cols-2` with no responsive breakpoint, so at mobile
  // widths the palette items remain in a two-column grid instead of collapsing to a single
  // column. The fix requires adding `sm:grid-cols-2` (or similar responsive prefix) to
  // switch to one column below the sm breakpoint.
  test('add item palette collapses to single-column layout on narrow viewport [BUG-004]', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('[data-testid="add-item"]');

    const palette = page.locator('[data-testid="add-item-palette"]');
    await palette.waitFor({ state: 'visible' });
    await expect(palette).toBeVisible();

    const itemGrid = page.locator('[data-testid="add-item-grid"]').first();
    await expect(itemGrid).toBeVisible();

    const gridTemplateColumns = await itemGrid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns
    );

    const columnCount = gridTemplateColumns.trim().split(/\s+/).length;
    expect(columnCount).toBe(1);
  });

  test('add a group, then add another item with the group selected', async ({ page }) => {
    await addFromPalette(page, 'Group');

    const groupBlock = editorGroupRows(page).first();
    await expect(groupBlock).toBeVisible();

    await groupBlock.click();
    await addFromPalette(page, 'Text');

    await expect(editorGroupRows(page)).toHaveCount(1);
    await expect(editorFieldRows(page)).toHaveCount(1);
  });

  test('field details: Pre-fill via Value section Add Behavior menu', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:e2e-tree-pre-fill',
      version: '1.0.0',
      items: [
        { key: 'accountNumber', type: 'field', dataType: 'string', label: 'Account Number' },
      ],
    });

    const row = page.locator('[data-testid="field-accountNumber"]');
    await row.locator('[data-testid="field-accountNumber-select"]').click();

    await row.getByTestId('field-accountNumber-category-Value').click();

    // Click "Add Calculation / Pre-population" menu and select Pre-populate
    await row.getByRole('button', { name: /Add Calculation/i }).click();
    await page.getByText('Pre-populate', { exact: false }).click();

    // A PrePopulateCard should now be visible in the Value section
    await expect(row.locator('[data-testid="field-accountNumber-lower-panel"]')).toBeVisible();
  });
});
