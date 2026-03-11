import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition, dispatch } from './helpers';

test.describe('Editor Authoring', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('add a field via AddItemPicker', async ({ page }) => {
    // Check status bar shows 0 fields initially
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');

    // Click the Add button
    await page.click('[data-testid="add-item"]');

    // Click "Field" in the picker
    await page.getByRole('button', { name: 'Field' }).click();

    // Click "string" data type
    await page.getByRole('button', { name: 'string' }).click();

    // A new field block should appear in the canvas
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid^="field-"]').first()).toBeVisible();

    // StatusBar should now show "1 field"
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('1 field');
  });

  test('select a field — Properties panel populates', async ({ page }) => {
    // Seed a field
    await seedDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    // Click on the field block
    await page.click('[data-testid="field-myField"]');

    // Properties panel should show the key
    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('myField');

    // Properties panel should show the data type (rendered as "String" via dataTypeInfo)
    await expect(properties).toContainText('String');
  });

  test('rename a field via Properties panel', async ({ page }) => {
    // Seed a field named "oldName"
    await seedDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'oldName', type: 'field', dataType: 'string', label: 'Old Name' }],
    });

    // Click the field block to select it
    await page.click('[data-testid="field-oldName"]');

    // Clear the key input in Properties and type a new name
    const keyInput = page.locator('[data-testid="properties"] input[type="text"]').first();
    await keyInput.fill('firstName');

    // Blur the input by clicking elsewhere (click the canvas area)
    await page.click('[data-testid="workspace-Editor"]');

    // Canvas should now show a field with the new key
    await expect(page.locator('[data-testid="field-firstName"]')).toBeVisible();
    // Old key should no longer exist
    await expect(page.locator('[data-testid="field-oldName"]')).not.toBeVisible();
  });

  test('duplicate a field via Properties panel', async ({ page }) => {
    // Seed a single field
    await seedDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'myField', type: 'field', dataType: 'string', label: 'My Field' }],
    });

    // Click the field block to select it
    await page.click('[data-testid="field-myField"]');

    // Click Duplicate in Properties panel
    await page.locator('[data-testid="properties"]').getByRole('button', { name: 'Duplicate' }).click();

    // There should now be two field blocks in the canvas
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const fieldBlocks = canvas.locator('[data-testid^="field-"]');
    await expect(fieldBlocks).toHaveCount(2);
  });

  test('delete a field via Properties panel', async ({ page }) => {
    // Seed a single field
    await seedDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'toDelete', type: 'field', dataType: 'string', label: 'To Delete' }],
    });

    // Click the field block to select it
    await page.click('[data-testid="field-toDelete"]');

    // Click Delete in Properties panel
    await page.locator('[data-testid="properties"]').getByRole('button', { name: 'Delete' }).click();

    // The field block should no longer exist
    await expect(page.locator('[data-testid="field-toDelete"]')).not.toBeVisible();
  });

  test('add a group with children', async ({ page }) => {
    // Add a Group via the picker
    await page.click('[data-testid="add-item"]');
    await page.getByRole('button', { name: 'Group' }).click();

    // A group block should appear
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const groupBlock = canvas.locator('[data-testid^="group-"]').first();
    await expect(groupBlock).toBeVisible();

    // Get the group key from the testid
    const groupTestId = await groupBlock.getAttribute('data-testid');
    const groupKey = groupTestId!.replace('group-', '');

    // Seed a child field inside the group via dispatch
    await dispatch(page, {
      type: 'definition.addItem',
      payload: { key: 'childField', type: 'field', dataType: 'string', parentPath: groupKey },
    });

    // The child field should appear inside the group block
    await expect(canvas.locator('[data-testid="field-childField"]')).toBeVisible();
  });
});
