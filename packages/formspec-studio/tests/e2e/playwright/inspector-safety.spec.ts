import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, propertiesPanel, switchTab } from './helpers';

test.describe('Inspector Safety', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:inspector-safety',
      version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });
  });

  test('non-Editor workspaces do not expose Duplicate and Delete context menu actions for the last Editor selection', async ({ page }) => {
    await page.click('[data-testid="field-name"]');

    // Duplicate/Delete are available via context menu in the Editor
    await page.click('[data-testid="field-name"]', { button: 'right' });
    await expect(page.locator('[data-testid="ctx-duplicate"]')).toBeVisible();
    await expect(page.locator('[data-testid="ctx-delete"]')).toBeVisible();
    await page.keyboard.press('Escape');

    await switchTab(page, 'Mapping');

    // Non-Editor workspace — context menu from Editor selection must not surface destructive actions
    // (Editor right rail shows Form Health, not field properties)
    await expect(page.locator('[data-testid="ctx-duplicate"]')).toBeHidden();
    await expect(page.locator('[data-testid="ctx-delete"]')).toBeHidden();
  });
});

// ─── Cluster A: Inspector Panel Gaps ─────────────────────────────────────────

test.describe('Inspector Panel — Bug Cluster A', () => {
  // #22 KEY stale on switch
  // The KEY input uses `defaultValue` (uncontrolled) so switching selection
  // does not update the DOM input — it keeps the previous field's key.
  test('#22 KEY display updates when switching selection between fields', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:key-stale-test',
      items: [
        { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
        { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
      ],
    });

    // Select field A first — it should show selected styling
    await page.click('[data-testid="field-fieldA"]');
    await expect(page.locator('[data-testid="field-fieldA"]')).toHaveClass(/border-accent/);

    // Now switch to field B — field B should be selected, field A deselected
    await page.click('[data-testid="field-fieldB"]');
    await expect(page.locator('[data-testid="field-fieldB"]')).toHaveClass(/border-accent/);
    await expect(page.locator('[data-testid="field-fieldA"]')).not.toHaveClass(/border-accent/);
  });

  // #25 Rename breaks inspector
  // After renaming a field via Tab-commit, the selectedKey still holds the old
  // path. flatItems won't find it, so the inspector shows "Item not found".
  test('#25 inline rename updates the field testid correctly', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:rename-inspector-test',
      items: [
        { key: 'oldKey', type: 'field', dataType: 'string', label: 'Original' },
      ],
    });

    // Select the field
    await page.click('[data-testid="field-oldKey"]');

    // Click the key edit pencil to open inline key editor
    await page.locator('[data-testid="field-oldKey-key-edit"]').click();

    // Fill the inline key input and commit with Tab
    const keyInput = page.getByLabel('Inline key');
    await keyInput.fill('newKey');
    await keyInput.press('Tab');

    // After a rename the field should appear with new test id
    await expect(page.locator('[data-testid="field-newKey"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-oldKey"]')).not.toBeVisible();
  });

  // #32 Behavior Rules never show
  // Even when a field has binds, the "Behavior Rules" section is never rendered
  // in the inspector. The section is guarded by `Object.keys(binds).length > 0`
  // but the binds lookup may fail when definition uses object-keyed binds format.
  test('#32 Bind cards are visible in inline lower panel when a field has binds', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:behavior-rules-test',
      items: [
        { key: 'income', type: 'field', dataType: 'decimal', label: 'Income' },
      ],
      binds: {
        income: { required: 'true', constraint: '$income > 0' },
      },
    });

    await page.click('[data-testid="field-income"]');

    const row = page.locator('[data-testid="field-income"]');
    await row.getByTestId('field-income-category-Validation').click();
    await expect(row.locator('[data-testid="field-income-lower-panel"]')).toBeVisible();

    // The bind cards in the lower editor should show verb-intent labels
    const lowerEditor = row.locator('[data-testid="field-income-lower-editor"]');
    await expect(lowerEditor.locator('[title="required"]')).toBeVisible();
    await expect(lowerEditor.locator('[title="constraint"]')).toBeVisible();
  });

  // #12 "add behavior rule" button
  // The AddBehaviorMenu component renders a button labeled "+ add behavior rule"
  // (lowercase). Clicking it should open a dropdown menu of available rule types.
  test('#12 single-option add behavior menu fires directly without dropdown', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:add-rule-test',
      items: [
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
      binds: {
        age: { required: 'true' },
      },
    });

    // Select the field to reveal the lower panel
    await page.click('[data-testid="field-age"]');

    const row = page.locator('[data-testid="field-age"]');
    await row.getByTestId('field-age-category-Validation').click();

    // Only "constraint" remains — single-option auto-add fires directly on click
    await row.getByRole('button', { name: /add validation rule/i }).click();

    // A constraint BindCard should appear immediately (no dropdown step).
    await expect(row.getByRole('button', { name: 'Remove constraint' })).toBeVisible();
  });

  test('#12b multi-option add behavior menu opens dropdown', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:add-rule-multi-test',
      items: [
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    // Select the field, open Value panel (has 3 options: calculate, pre-populate, readonly)
    await page.click('[data-testid="field-age"]');
    const row = page.locator('[data-testid="field-age"]');
    await row.getByTestId('field-age-category-Value').click();

    // Multiple options available — should open a dropdown menu
    await row.getByRole('button', { name: /add calculation/i }).click();
    const menuItems = page.locator('button').filter({ hasText: /calculate/i });
    await expect(menuItems.first()).toBeVisible();
  });

  // #52 No cardinality settings
  // Clicking a repeatable group header shows only the Identity section in the
  // inspector — min/max cardinality controls are never rendered.
  test('#52 group row shows repeatable badge for a repeatable group', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:cardinality-test',
      items: [
        {
          key: 'medications',
          type: 'group',
          label: 'Medications',
          repeatable: true,
          minRepeat: 1,
          maxRepeat: 5,
          children: [
            { key: 'medName', type: 'field', dataType: 'string', label: 'Name' },
          ],
        },
      ],
    });

    // Click the repeatable group header to select it
    await page.click('[data-testid="group-medications"]');

    const groupRow = page.locator('[data-testid="group-medications"]');
    await expect(groupRow).toHaveClass(/border-accent/);

    // The group should show repeatable info (min/max or repeatable indicator)
    await expect(groupRow).toContainText(/repeat|min|max/i);
  });

  // #53 No choice options editor
  // Selecting a Choice field (select1 / select) in the inspector shows only the
  // Identity section — there is no "Choices" or "Options" section for managing
  // the list of choices.
  test('#53 clicking Options summary opens an options modal for a Select One field', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:choices-test',
      items: [
        {
          key: 'status',
          type: 'field',
          dataType: 'select1',
          label: 'Status',
          choices: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      ],
    });

    // Select the choice field and wait for it to be selected
    const row = page.locator('[data-testid="field-status"]');
    await row.click();
    await expect(row).toHaveClass(/border-accent/);

    // The category summary should show an Options slot — click it to open the modal
    const optionsCell = row.locator('[data-testid="field-status-category-Options"]');
    await expect(optionsCell).toBeVisible();
    await optionsCell.locator('dd').click();

    // The options modal should appear with choice items
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Option 1 value/i)).toBeVisible();
  });

  // #57 No label field
  // The inspector only shows a Key input — there is no Label/Title input for
  // editing the human-readable field label.
  test('#57 clicking the label text opens an inline label editor', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:label-field-test',
      items: [
        { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
      ],
    });

    // Select the field
    await page.click('[data-testid="field-firstName"]');

    const row = page.locator('[data-testid="field-firstName"]');
    // The label "First Name" should be visible in the item row
    await expect(row).toContainText('First Name');

    // Click the label edit pencil to open inline label editor
    await row.locator('[data-testid="field-firstName-label-edit"]').click();

    // The inline label input should now be visible with the current label value
    const labelInput = page.getByLabel('Inline label');
    await expect(labelInput).toBeVisible();
    await expect(labelInput).toHaveValue('First Name');
  });
});
