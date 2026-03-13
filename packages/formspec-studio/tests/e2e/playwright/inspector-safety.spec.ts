import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, switchTab } from './helpers';

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

  test('non-Editor workspaces do not expose Duplicate and Delete inspector actions for the last Editor selection', async ({ page }) => {
    await page.click('[data-testid="field-name"]');

    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.getByRole('button', { name: 'Duplicate' })).toBeVisible();
    await expect(properties.getByRole('button', { name: 'Delete' })).toBeVisible();

    await switchTab(page, 'Data');

    await expect(properties.getByRole('button', { name: 'Duplicate' })).toBeHidden();
    await expect(properties.getByRole('button', { name: 'Delete' })).toBeHidden();
  });
});

// ─── Cluster A: Inspector Panel Gaps ─────────────────────────────────────────

test.describe('Inspector Panel — Bug Cluster A', () => {
  // #22 KEY stale on switch
  // The KEY input uses `defaultValue` (uncontrolled) so switching selection
  // does not update the DOM input — it keeps the previous field's key.
  test('#22 KEY input updates when switching selection between fields', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, {
      $formspec: '1.0',
      url: 'urn:key-stale-test',
      items: [
        { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
        { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
      ],
    });

    // Select field A first
    await page.click('[data-testid="field-fieldA"]');
    const properties = page.locator('[data-testid="properties"]');
    const keyInput = properties.locator('input[type="text"]').first();
    await expect(keyInput).toHaveValue('fieldA');

    // Now switch to field B
    await page.click('[data-testid="field-fieldB"]');

    // BUG #22: The key input still shows "fieldA" because defaultValue is used
    // (uncontrolled input). The correct value is "fieldB".
    await expect(keyInput).toHaveValue('fieldB');
  });

  // #25 Rename breaks inspector
  // After renaming a field via Tab-commit, the selectedKey still holds the old
  // path. flatItems won't find it, so the inspector shows "Item not found".
  test('#25 inspector still shows the renamed item after editing KEY with Tab', async ({ page }) => {
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
    const properties = page.locator('[data-testid="properties"]');

    // Edit the KEY input and commit with Tab
    const keyInput = properties.locator('input[type="text"]').first();
    await keyInput.click();
    await keyInput.fill('newKey');
    await keyInput.press('Tab');

    // BUG #25: Inspector shows "Item not found: oldKey" after the rename
    // because selectedKey is still the old path.
    // After a rename the inspector should continue displaying the renamed item.
    await expect(properties).not.toContainText('Item not found');

    // The key input should now show the new key
    await expect(keyInput).toHaveValue('newKey');
  });

  // #32 Behavior Rules never show
  // Even when a field has binds, the "Behavior Rules" section is never rendered
  // in the inspector. The section is guarded by `Object.keys(binds).length > 0`
  // but the binds lookup may fail when definition uses object-keyed binds format.
  test('#32 Behavior Rules section is visible in inspector when a field has binds', async ({ page }) => {
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

    // Select the field that has binds
    await page.click('[data-testid="field-income"]');

    const properties = page.locator('[data-testid="properties"]');

    // BUG #32: "Behavior Rules" section never appears even though income has binds.
    await expect(properties).toContainText('Behavior Rules');

    // The bind expressions should be rendered inside the section
    await expect(properties).toContainText('required');
    await expect(properties).toContainText('constraint');
  });

  // #12 "add behavior rule" button
  // The AddBehaviorMenu component renders a button labeled "+ add behavior rule"
  // (lowercase). Clicking it should open a dropdown menu of available rule types.
  test('#12 clicking "+ add behavior rule" opens a behavior type menu', async ({ page }) => {
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

    // Select the field to reveal Behavior Rules
    await page.click('[data-testid="field-age"]');

    const properties = page.locator('[data-testid="properties"]');

    // Wait for the Behavior Rules section to be present
    await expect(properties).toContainText('Behavior Rules');

    // The AddBehaviorMenu renders "+ add behavior rule" (lowercase)
    await properties.getByRole('button', { name: /add behavior rule/i }).click();

    // After clicking, the dropdown menu of rule types should appear.
    // AddBehaviorMenu renders available bind types as buttons in an overlay menu.
    // The "required" type is already used, so at least one other type must appear.
    const menuItems = page.locator('[role="button"], button').filter({ hasText: /relevant|readonly|calculate|constraint|pre-populate/i });
    await expect(menuItems.first()).toBeVisible();
  });

  // #52 No cardinality settings
  // Clicking a repeatable group header shows only the Identity section in the
  // inspector — min/max cardinality controls are never rendered.
  test('#52 inspector shows min/max cardinality controls for a repeatable group', async ({ page }) => {
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

    const properties = page.locator('[data-testid="properties"]');

    // BUG #52: The inspector shows only the Identity section — no cardinality
    // controls for min/max repeat appear.
    // The inspector should show min and max cardinality inputs or a dedicated section.
    const minControl = properties.locator(
      'input[name*="min"], input[aria-label*="min"], [data-testid*="min-repeat"], [data-testid*="cardinality"]'
    ).or(properties.getByText(/min(imum)?.*repeat|repeat.*min(imum)?/i));
    const maxControl = properties.locator(
      'input[name*="max"], input[aria-label*="max"], [data-testid*="max-repeat"]'
    ).or(properties.getByText(/max(imum)?.*repeat|repeat.*max(imum)?/i));

    await expect(minControl.first()).toBeVisible();
    await expect(maxControl.first()).toBeVisible();
  });

  // #53 No choice options editor
  // Selecting a Choice field (select1 / select) in the inspector shows only the
  // Identity section — there is no "Choices" or "Options" section for managing
  // the list of choices.
  test('#53 inspector shows a Choices/Options section for a Select One field', async ({ page }) => {
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

    // Select the choice field
    await page.click('[data-testid="field-status"]');

    const properties = page.locator('[data-testid="properties"]');

    // BUG #53: No "Choices" or "Options" section renders for select1 fields.
    // The inspector should surface a section listing the choice options with the
    // ability to add/remove/edit them.
    await expect(
      properties.getByText(/choices|options/i).first()
    ).toBeVisible();
  });

  // #57 No label field
  // The inspector only shows a Key input — there is no Label/Title input for
  // editing the human-readable field label.
  test('#57 inspector shows a Label/Title input for editing a field label', async ({ page }) => {
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

    const properties = page.locator('[data-testid="properties"]');

    // BUG #57: There is no Label/Title input in the inspector at all. Only the
    // Key input is present. The inspector should show a Label input that allows
    // editing the human-readable label that appears on the field card.
    //
    // We look for an input labeled "Label" or "Title", or an input whose current
    // value matches the field's label text "First Name".
    const labelInput = properties.locator(
      'input[aria-label*="Label" i], input[placeholder*="Label" i], input[name*="label" i]'
    ).or(
      properties.locator('input[type="text"]').filter({ hasText: 'First Name' })
    );

    // Alternative: look for a "Label" row label next to an input
    const labelRow = properties.locator('label, dt, .label-text').filter({ hasText: /^label$/i });

    const inputVisible = await labelInput.first().isVisible().catch(() => false);
    const rowVisible = await labelRow.first().isVisible().catch(() => false);

    // BUG: neither a labelled input nor a "Label" row exists
    expect(inputVisible || rowVisible).toBe(true);
  });
});
