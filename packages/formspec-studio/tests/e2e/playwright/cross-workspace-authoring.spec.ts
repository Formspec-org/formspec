import { test, expect } from '@playwright/test';
import {
  addFromPalette,
  editorFieldRows,
  importDefinition,
  importProject,
  openMappingWorkspace,
  propertiesPanel,
  switchTab,
  waitForApp,
} from './helpers';

test.describe('Cross-Workspace Authoring', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('Editor → Manage → Preview round-trip', async ({ page }) => {
    const definition = {
      $formspec: '1.0',
      items: [
        { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
        { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
        { key: 'dob', type: 'field', dataType: 'date', label: 'Date of Birth' },
      ],
    };

    await importDefinition(page, definition);

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    await expect(canvas.locator('[data-testid="field-firstName"]')).toBeVisible();
    await expect(canvas.locator('[data-testid="field-lastName"]')).toBeVisible();
    await expect(canvas.locator('[data-testid="field-dob"]')).toBeVisible();

    const outputBlueprint = propertiesPanel(page).locator('[data-testid="output-blueprint"]');
    await expect(outputBlueprint).toContainText('firstName');
    await expect(outputBlueprint).toContainText('lastName');
    await expect(outputBlueprint).toContainText('dob');

    await switchTab(page, 'Preview');
    const previewWorkspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(previewWorkspace.getByLabel('First Name')).toBeVisible();
    await expect(previewWorkspace.getByLabel('Last Name')).toBeVisible();
    await expect(previewWorkspace.getByLabel('Date of Birth')).toBeVisible();
  });

  test('Editor → Manage round-trip with required bind', async ({ page }) => {
    const definition = {
      $formspec: '1.0',
      items: [{ key: 'income', type: 'field', dataType: 'decimal', label: 'Income' }],
      binds: { income: { required: 'true' } },
    };

    await importDefinition(page, definition);

    const canvas = page.locator('[data-testid="workspace-Editor"]');
    const incomeBlock = canvas.locator('[data-testid="field-income"]');
    await expect(incomeBlock).toBeVisible();
    await expect(incomeBlock.getByText('must fill')).toBeVisible();

    // Switch to Manage view and verify the bind
    await page.getByRole('radio', { name: 'Manage' }).click();
    await expect(page.getByText(/required \(1\)/)).toBeVisible();

    // Switch back to Build view
    await page.getByRole('radio', { name: 'Build' }).click();
    const incomeBlockAgain = page.locator('[data-testid="workspace-Editor"]').locator('[data-testid="field-income"]');
    await expect(incomeBlockAgain).toBeVisible();
    await expect(incomeBlockAgain.getByText('must fill')).toBeVisible();
  });

  test('Full authoring cycle — all workspaces show seeded content', async ({ page }) => {
    const projectState = {
      definition: {
        $formspec: '1.0',
        items: [
          { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
          { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
          {
            key: 'address',
            type: 'group',
            label: 'Address',
            children: [{ key: 'street', type: 'field', dataType: 'string', label: 'Street' }],
          },
        ],
        binds: [
          { path: 'name', required: 'true' },
          { path: 'age', constraint: '$age >= 0' },
        ],
        shapes: [
          { id: 'ageCheck', target: 'age', severity: 'error', constraint: '$age >= 0', message: '' },
        ],
      },
      theme: {
        tokens: { 'color.primaryColor': '#3b82f6', spacing: '8px' },
      },
      mapping: {
        direction: 'forward',
        version: '1.0.0',
        definitionRef: 'urn:formspec:test',
        rules: [{ sourcePath: 'name', targetPath: 'fullName', transform: 'preserve' }],
        targetSchema: { format: 'json' },
      },
    };

    await importProject(page, projectState);

    const editorWorkspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(editorWorkspace.locator('[data-testid="field-name"]')).toBeVisible();
    await expect(editorWorkspace.locator('[data-testid="field-email"]')).toBeVisible();
    await expect(editorWorkspace.locator('[data-testid="field-age"]')).toBeVisible();
    await expect(editorWorkspace.locator('[data-testid="group-address"]')).toBeVisible();

    // Switch to Manage view — verify logic content
    await page.getByRole('radio', { name: 'Manage' }).click();
    await expect(page.getByText(/required \(1\)/)).toBeVisible();
    await expect(editorWorkspace.getByText('ageCheck')).toBeVisible();

    // Verify data content in Manage view (Response Inspector is in Form Health panel)
    await page.getByRole('radio', { name: 'Build' }).click();
    const responsePanel = propertiesPanel(page).locator('[data-testid="output-blueprint"]');
    await expect(responsePanel).toContainText('name');
    await expect(responsePanel).toContainText('email');

    await switchTab(page, 'Layout');
    const themeSidebar = page.locator('[data-testid="blueprint-sidebar"]');
    await themeSidebar.getByRole('button', { name: 'Colors' }).click();
    const colorToken = themeSidebar.locator('[data-testid="color-token-color.primaryColor"]');
    await colorToken.scrollIntoViewIfNeeded();
    await expect(colorToken).toBeVisible();
    await expect(themeSidebar.locator('[data-testid="color-value-color.primaryColor"]')).toHaveValue('#3b82f6');

    await openMappingWorkspace(page);
    const mappingWorkspace = page.locator('[data-testid="workspace-Mapping"]');
    await expect(mappingWorkspace.getByTestId('direction-picker')).toContainText('forward');

    await switchTab(page, 'Preview');
    const previewWorkspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(previewWorkspace.getByLabel('Name')).toBeVisible();
    await expect(previewWorkspace.getByLabel('Email')).toBeVisible();

    await switchTab(page, 'Editor');
    const fields = editorFieldRows(page);
    const fieldCountBefore = await fields.count();

    await addFromPalette(page, 'Text');
    await expect(fields).toHaveCount(fieldCountBefore + 1);

    await page.click('[data-testid="undo-btn"]');
    await expect(fields).toHaveCount(fieldCountBefore);

    await expect(page.locator('[data-testid="redo-btn"]')).not.toBeDisabled();

    await page.click('[data-testid="redo-btn"]');
    await expect(fields).toHaveCount(fieldCountBefore + 1);
  });
});
