import { test, expect } from '@playwright/test';
import { addFromPalette, importDefinition, waitForApp } from './helpers';

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

  test('adding an item on a later wizard page selects the new field in the inspector', async ({ page }) => {
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

    await page.click('[data-testid="field-marital"]');
    await page.locator('[data-testid="workspace-Editor"] [role="tab"]').nth(1).click();

    await addFromPalette(page, 'Text');

    const newField = page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]').first();
    const newFieldTestId = await newField.getAttribute('data-testid');
    const newFieldKey = newFieldTestId?.replace('field-', '');

    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue(newFieldKey || '');
    await expect(properties).not.toContainText('Marital Status');
  });

  test('adding a Single Choice field immediately focuses the key input for renaming', async ({ page }) => {
    await addFromPalette(page, 'Single Choice');

    const keyInput = page.locator('[data-testid="properties"] input[type="text"]').first();
    await expect(keyInput).toBeFocused();
  });

  test('select a field — Properties panel populates', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    await page.click('[data-testid="field-myField"]');

    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('myField');
    await expect(properties).toContainText('String');
  });

  test('rename a field via Properties panel', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'oldName', type: 'field', dataType: 'string', label: 'Old Name' }],
    });

    await page.click('[data-testid="field-oldName"]');

    const keyInput = page.locator('[data-testid="properties"] input[type="text"]').first();
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
    await page.locator('[data-testid="properties"]').getByRole('button', { name: 'Duplicate' }).click();

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const fieldBlocks = canvas.locator('[data-testid^="field-"]');
    await expect(fieldBlocks).toHaveCount(2);
  });

  test('delete a field via Properties panel', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'toDelete', type: 'field', dataType: 'string', label: 'To Delete' }],
    });

    await page.click('[data-testid="field-toDelete"]');
    await page.locator('[data-testid="properties"]').getByRole('button', { name: 'Delete' }).click();

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

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const groupBlock = canvas.locator('[data-testid^="group-"]').first();
    await expect(groupBlock).toBeVisible();

    await groupBlock.click();
    await addFromPalette(page, 'Text');

    await expect(canvas.locator('[data-testid^="group-"]')).toHaveCount(1);
    await expect(canvas.locator('[data-testid^="field-"]')).toHaveCount(1);
  });
});
