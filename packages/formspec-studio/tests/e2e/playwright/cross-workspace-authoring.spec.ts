import { test, expect } from '@playwright/test';
import { addFromPalette, editorFieldRows, importDefinition, importProject, switchTab, waitForApp } from './helpers';

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

    // Switch to Manage view — verify fields appear in the Response Inspector
    await page.getByText('Response Inspector').click();
    const panel = page.locator('[data-testid="response-inspector-content"]');
    await expect(panel).toContainText('firstName');
    await expect(panel).toContainText('lastName');
    await expect(panel).toContainText('dob');

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
    await expect(incomeBlock.getByText('req')).toBeVisible();

    // Switch to Manage view and verify the bind
    await page.getByRole('radio', { name: 'Manage' }).click();
    await expect(page.getByText(/required \(1\)/)).toBeVisible();

    // Switch back to Build view
    await page.getByRole('radio', { name: 'Build' }).click();
    const incomeBlockAgain = page.locator('[data-testid="workspace-Editor"]').locator('[data-testid="field-income"]');
    await expect(incomeBlockAgain).toBeVisible();
    await expect(incomeBlockAgain.getByText('req')).toBeVisible();
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
        tokens: { primaryColor: '#3b82f6', spacing: '8px' },
      },
      mapping: {
        direction: 'outbound',
        definitionRef: 'urn:formspec:test',
        rules: [{ source: 'name', target: 'fullName', transform: 'preserve' }],
        adapter: { format: 'JSON', options: {} },
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
    await page.getByText('Response Inspector').click();
    const responsePanel = page.locator('[data-testid="response-inspector-content"]');
    await expect(responsePanel).toContainText('name');
    await expect(responsePanel).toContainText('email');

    await switchTab(page, 'Theme');
    const themeWorkspace = page.locator('[data-testid="workspace-Theme"]');
    await expect(themeWorkspace.getByText('primaryColor', { exact: true })).toBeVisible();
    await expect(themeWorkspace.locator('[data-testid="swatch-primaryColor"]')).toBeVisible();

    await switchTab(page, 'Mapping');
    const mappingWorkspace = page.locator('[data-testid="workspace-Mapping"]');
    await expect(mappingWorkspace.getByText('outbound')).toBeVisible();

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
