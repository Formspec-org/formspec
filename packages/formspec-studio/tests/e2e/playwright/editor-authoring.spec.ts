import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition, seedProject, dispatch } from './helpers';

test.describe('Editor Authoring', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    // Clear the definition to have a clean slate for authoring tests
    await seedDefinition(page, { $formspec: '1.0', url: 'urn:test', items: [] });
  });

  test('add a field via AddItemPicker', async ({ page }) => {
    // Check status bar shows 0 fields initially
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('0 fields');

    // Click the Add button
    await page.click('[data-testid="add-item"]');

    // Search for "text" in the palette
    const searchInput = page.locator('input[placeholder="Search field types…"]');
    await searchInput.fill('text');

    // Click the "Text" option (which is a field item)
    await page.getByRole('button', { name: 'Text Short text — names,' }).click();

    // A new field block should appear in the canvas
    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid^="field-"]').first()).toBeVisible();

    // StatusBar should now show "1 field"
    await expect(page.locator('[data-testid="status-bar"]')).toContainText('1 field');
  });

  test('adding an item on a later wizard page selects the new field in the inspector', async ({ page }) => {
    await seedDefinition(page, {
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

    await page.click('[data-testid="add-item"]');
    await page.locator('input[placeholder="Search field types…"]').fill('text');
    await page.getByRole('button', { name: 'Text Short text — names,' }).click();

    const newField = page.locator('[data-testid="workspace-Editor"] [data-testid^="field-"]').first();
    const newFieldTestId = await newField.getAttribute('data-testid');
    const newFieldKey = newFieldTestId?.replace('field-', '');

    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue(newFieldKey || '');
    await expect(properties).not.toContainText('Marital Status');
  });

  test('adding a Single Choice field immediately focuses the key input for renaming', async ({ page }) => {
    await page.click('[data-testid="add-item"]');
    await page.locator('input[placeholder="Search field types…"]').fill('single');
    await page.getByRole('button', { name: 'Single Choice Pick exactly one' }).click();

    const keyInput = page.locator('[data-testid="properties"] input[type="text"]').first();
    await expect(keyInput).toBeFocused();
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

  // BUG-001: Display node component overrides lost during tree rebuilds
  // Tests that when two groups each contain a display item with the same key,
  // and each has a distinct component override, both overrides survive a
  // tree rebuild triggered by adding a new field.
  // RED: _rebuildComponentTree uses only item.key (not full path) as the map key
  // for display nodes, so same-key display items in different groups collide —
  // only one override survives the rebuild.
  test('display node component overrides survive tree rebuild [BUG-001]', async ({ page }) => {
    // 1. Seed a definition with two groups, each containing a field and a display item
    //    with the same key ("header") so the collision bug is triggered
    await seedDefinition(page, {
      $formspec: '1.0',
      url: 'urn:bug-001',
      items: [
        {
          key: 'groupA',
          type: 'group',
          label: 'Group A',
          children: [
            { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
            { key: 'header', type: 'display', label: 'Alpha Header' },
          ],
        },
        {
          key: 'groupB',
          type: 'group',
          label: 'Group B',
          children: [
            { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
            { key: 'header', type: 'display', label: 'Beta Header' },
          ],
        },
      ],
    });

    // 2. Override the display node in groupA: change component from Text → Alert with variant warning
    await dispatch(page, {
      type: 'component.setNodeType',
      payload: { node: { nodeId: 'header' }, component: 'Alert' },
    });
    // The nodeId collision means only the first 'header' node found is changed;
    // override groupB's header separately by dispatching setNodeProperty to set variant
    // (We rely on querying the raw project state to detect override loss)

    // 3. Verify the overrides are present before the rebuild by querying project state
    const overridesBeforeRebuild = await page.evaluate(() => {
      const project = (window as any).__testProject__;
      const tree = project.component.tree as any;
      const groupANode = tree?.children?.find((c: any) => c.bind === 'groupA');
      const groupBNode = tree?.children?.find((c: any) => c.bind === 'groupB');
      const groupAHeader = groupANode?.children?.find((c: any) => c.nodeId === 'header');
      const groupBHeader = groupBNode?.children?.find((c: any) => c.nodeId === 'header');
      return {
        groupAHeaderComponent: groupAHeader?.component,
        groupBHeaderComponent: groupBHeader?.component,
      };
    });
    // After setNodeType for nodeId:'header', one of them should be Alert
    // (the collision bug means only one gets changed, which is part of the problem)
    expect(
      overridesBeforeRebuild.groupAHeaderComponent === 'Alert' ||
      overridesBeforeRebuild.groupBHeaderComponent === 'Alert'
    ).toBe(true);

    // 4. Now set distinct overrides on both display nodes directly via project state
    //    manipulation so we can test the rebuild path precisely
    await page.evaluate(() => {
      const project = (window as any).__testProject__;
      // Access the tree directly and set distinct overrides on both header nodes
      const tree = (project.component.tree as any);
      const groupANode = tree?.children?.find((c: any) => c.bind === 'groupA');
      const groupBNode = tree?.children?.find((c: any) => c.bind === 'groupB');
      if (groupANode) {
        const h = groupANode.children?.find((c: any) => c.nodeId === 'header');
        if (h) { h.component = 'Alert'; h.variant = 'warning'; }
      }
      if (groupBNode) {
        const h = groupBNode.children?.find((c: any) => c.nodeId === 'header');
        if (h) { h.component = 'Callout'; h.variant = 'info'; }
      }
    });

    // 5. Navigate to Component Tree panel to visually verify overrides before rebuild
    await page.click('[data-testid="blueprint-section-Component Tree"]');
    const sidebar = page.locator('aside').first();

    // Both override component types should appear in the Component Tree sidebar
    await expect(sidebar).toContainText('Alert');
    await expect(sidebar).toContainText('Callout');

    // 6. Trigger a tree rebuild by adding a new field (definition.addItem triggers rebuildComponentTree)
    await dispatch(page, {
      type: 'definition.addItem',
      payload: { key: 'newField', type: 'field', dataType: 'string' },
    });

    // 7. After the rebuild, both display node overrides should survive.
    //    BUG-001: _rebuildComponentTree keys display nodes by item.key alone, so the
    //    second "header" node overwrites the first in existingById — only one override survives.
    const overridesAfterRebuild = await page.evaluate(() => {
      const project = (window as any).__testProject__;
      const tree = project.component.tree as any;
      const groupANode = tree?.children?.find((c: any) => c.bind === 'groupA');
      const groupBNode = tree?.children?.find((c: any) => c.bind === 'groupB');
      const groupAHeader = groupANode?.children?.find((c: any) => c.nodeId === 'header');
      const groupBHeader = groupBNode?.children?.find((c: any) => c.nodeId === 'header');
      return {
        groupAHeaderComponent: groupAHeader?.component,
        groupAHeaderVariant: groupAHeader?.variant,
        groupBHeaderComponent: groupBHeader?.component,
        groupBHeaderVariant: groupBHeader?.variant,
      };
    });

    // Both distinct overrides should survive the rebuild — this is the contract being violated
    expect(overridesAfterRebuild.groupAHeaderComponent).toBe('Alert');
    expect(overridesAfterRebuild.groupAHeaderVariant).toBe('warning');
    expect(overridesAfterRebuild.groupBHeaderComponent).toBe('Callout');
    expect(overridesAfterRebuild.groupBHeaderVariant).toBe('info');

    // Also verify the Component Tree sidebar reflects both overrides after rebuild
    await expect(sidebar).toContainText('Alert');
    await expect(sidebar).toContainText('Callout');
  });

  // BUG-004: AddItemPalette is not mobile-safe — grid stays two-column on narrow viewports
  // RED: The palette uses `grid grid-cols-2` with no responsive breakpoint, so at mobile
  // widths the palette items remain in a two-column grid instead of collapsing to a single
  // column. The fix requires adding `sm:grid-cols-2` (or similar responsive prefix) to
  // switch to one column below the sm breakpoint.
  test('add item palette collapses to single-column layout on narrow viewport [BUG-004]', async ({ page }) => {
    // Set a narrow mobile viewport (375px wide — typical iPhone SE width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Open the Add Item palette
    await page.click('[data-testid="add-item"]');

    // Wait for the palette to appear
    const palette = page.locator('[data-testid="add-item-palette"]').or(
      page.locator('input[placeholder="Search field types…"]').locator('..')
    );
    await page.locator('input[placeholder="Search field types…"]').waitFor({ state: 'visible' });

    // The item grid should be single-column on a narrow viewport.
    // The palette uses "grid grid-cols-2 gap-1.5" — at 375px this should switch to
    // a single column but currently does not (bug: no responsive prefix).
    const itemGrid = page.locator('[data-testid="add-item-grid"]').first();
    await expect(itemGrid).toBeVisible();

    // Get the computed CSS grid-template-columns value — should be a single column
    // (i.e. something like "375px" or one column fraction), not two equal columns.
    const gridTemplateColumns = await itemGrid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns
    );

    // A single-column grid produces one value; two-column produces two space-separated values.
    // "375px" → single column; "187.5px 187.5px" → two columns (the bug).
    const columnCount = gridTemplateColumns.trim().split(/\s+/).length;
    expect(columnCount).toBe(1);
  });

  test('add a group with children', async ({ page }) => {
    // Add a Group via the picker
    await page.click('[data-testid="add-item"]');
    await page.locator('input[placeholder="Search field types…"]').fill('group');
    await page.getByRole('button', { name: 'Group Container for a set' }).click();

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
