import { test, expect } from '@playwright/test';
import { addFromPalette, editorFieldRows, editorGroupRows, importDefinition, propertiesPanel, waitForApp } from './helpers';

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

    // The newly added field should be auto-selected in the inspector
    const fields = editorFieldRows(page);
    // marital is inside pageOne group, new field is at root — find the last editor field row
    const allFields = await fields.all();
    const lastField = allFields[allFields.length - 1];
    const newFieldTestId = await lastField.getAttribute('data-testid');
    const newFieldKey = newFieldTestId?.replace('field-', '');

    const properties = propertiesPanel(page);
    await expect(properties.locator('input[type="text"]').first()).toHaveValue(newFieldKey || '');
  });

  test('adding a Single Choice field immediately focuses the key input for renaming', async ({ page }) => {
    await addFromPalette(page, 'Single Choice');

    const keyInput = propertiesPanel(page).locator('input[type="text"]').first();
    await expect(keyInput).toBeFocused();
  });

  test('select a field — Properties panel populates', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    await page.click('[data-testid="field-myField"]');

    const properties = propertiesPanel(page);
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('myField');
    await expect(properties).toContainText('String');
  });

  test('rename a field via Properties panel', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'oldName', type: 'field', dataType: 'string', label: 'Old Name' }],
    });

    await page.click('[data-testid="field-oldName"]');

    const keyInput = propertiesPanel(page).locator('input[type="text"]').first();
    await keyInput.fill('firstName');
    await page.click('[data-testid="workspace-Editor"]');

    await expect(page.locator('[data-testid="field-firstName"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-oldName"]')).not.toBeVisible();
  });

  test('duplicate a field via Properties panel', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    await page.click('[data-testid="field-myField"]');
    await propertiesPanel(page).getByRole('button', { name: 'Duplicate' }).click();

    const fieldBlocks = editorFieldRows(page);
    await expect(fieldBlocks).toHaveCount(2);
  });

  test('delete a field via Properties panel', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'toDelete', type: 'field', dataType: 'string', label: 'To Delete' }],
    });

    await page.click('[data-testid="field-toDelete"]');
    await propertiesPanel(page).getByRole('button', { name: 'Delete' }).click();

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

  test('field details: Pre-fill launcher, combined source, and editable toggle', async ({ page }) => {
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

    await row.getByTestId('field-accountNumber-add-pre-fill').click();

    const preFillInput = row.getByLabel('Inline pre-fill');
    await expect(preFillInput).toBeVisible();
    await preFillInput.fill('@applicant.crm.account_number');

    await expect(row.getByTestId('field-accountNumber-pre-populate-extras')).toBeVisible();

    const editable = row.getByLabel('Inline pre-populate editable');
    await expect(editable).toBeChecked();
    await editable.focus();
    await expect(editable).toBeFocused();
    await page.keyboard.press('Space');
    await expect(editable).not.toBeChecked();

    // Orphan editor may dismiss when focus moves; edit source again from the summary row.
    await row.getByTestId('field-accountNumber-summary-edit-Pre-fill').click();
    const preFillSummaryInput = row.getByLabel('Inline pre-fill');
    await preFillSummaryInput.fill('$other.source.path');
    await expect(preFillSummaryInput).toHaveValue('$other.source.path');
  });
});
