import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, importDefinition } from './helpers';

const PREVIEW_DEF = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'notes', type: 'display', label: 'Please review carefully' },
    {
      key: 'address',
      type: 'group',
      label: 'Address',
      children: [
        { key: 'street', type: 'field', dataType: 'string', label: 'Street' },
      ],
    },
  ],
};

const CALCULATED_DEF = {
  $formspec: '1.0',
  url: 'urn:preview-calculated',
  version: '1.0.0',
  items: [
    { key: 'grossAnnualIncome', type: 'field', dataType: 'integer', label: 'Gross Annual Income' },
    { key: 'incomeSummary', type: 'field', dataType: 'string', label: 'Income Summary' },
  ],
  binds: {
    incomeSummary: { calculate: 'string($grossAnnualIncome)' },
  },
};

const REPEATABLE_DEF = {
  $formspec: '1.0',
  url: 'urn:preview-repeatable',
  version: '1.0.0',
  items: [
    {
      key: 'members',
      type: 'group',
      label: 'Members',
      repeatable: true,
      children: [
        { key: 'memberName', type: 'field', dataType: 'string', label: 'Member Name' },
      ],
    },
  ],
};

test.describe('Preview Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, PREVIEW_DEF);
    await switchTab(page, 'Preview');
  });

  test('renders form inputs for fields, group fieldset, and display text', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    // Wait for debounced sync to formspec-render (500ms) and for form to render
    await expect(workspace.getByText('First Name', { exact: true })).toBeVisible({ timeout: 3000 });

    // Field items render label text; inputs are accessible via their associated label
    await expect(workspace.getByLabel('First Name')).toBeVisible();
    await expect(workspace.getByText('Last Name', { exact: true })).toBeVisible();
    await expect(workspace.getByLabel('Last Name')).toBeVisible();

    // Group renders its children (street field is accessible via label)
    await expect(workspace.getByLabel('Street')).toBeVisible();

    // Display item renders its label text
    await expect(workspace.getByText('Please review carefully')).toBeVisible();
  });

  test('viewport switcher changes preview container width to tablet (768px)', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    // Click Tablet button
    await workspace.getByRole('button', { name: 'Tablet' }).click();

    // The preview container has style.width = '768px' (may be constrained by maxWidth: 100%)
    // Check the inline style attribute rather than the computed CSS value
    const container = workspace.locator('.bg-surface.rounded.border.border-border.p-4');
    const widthStyle = await container.evaluate((el: HTMLElement) => el.style.width);
    expect(widthStyle).toBe('768px');
  });

  test('desktop and tablet preview viewports produce measurably different rendered widths', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');
    const container = workspace.locator('.bg-surface.rounded.border.border-border.p-4');

    await workspace.getByRole('button', { name: 'Desktop' }).click();
    const desktopWidth = await container.evaluate((el: HTMLElement) => el.getBoundingClientRect().width);

    await workspace.getByRole('button', { name: 'Tablet' }).click();
    const tabletWidth = await container.evaluate((el: HTMLElement) => el.getBoundingClientRect().width);

    expect(tabletWidth).toBeLessThan(desktopWidth);
  });

  test('viewport switcher changes preview container width to mobile (375px)', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    await workspace.getByRole('button', { name: 'Mobile' }).click();

    const container = workspace.locator('.bg-surface.rounded.border.border-border.p-4');
    const widthStyle = await container.evaluate((el: HTMLElement) => el.style.width);
    expect(widthStyle).toBe('375px');
  });

  test('viewport switcher resets to desktop (100%) width', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    // First go to mobile, then back to desktop
    await workspace.getByRole('button', { name: 'Mobile' }).click();
    await workspace.getByRole('button', { name: 'Desktop' }).click();

    const container = workspace.locator('.bg-surface.rounded.border.border-border.p-4');
    const widthStyle = await container.evaluate((el: HTMLElement) => el.style.width);
    expect(widthStyle).toBe('100%');
  });

  test('calculated preview fields recalculate when the source field changes', async ({ page }) => {
    await importDefinition(page, CALCULATED_DEF);
    await switchTab(page, 'Preview');

    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('spinbutton', { name: 'Gross Annual Income' })).toBeVisible({ timeout: 3000 });

    await workspace.getByRole('spinbutton', { name: 'Gross Annual Income' }).fill('60000');
    await workspace.getByRole('spinbutton', { name: 'Gross Annual Income' }).press('Tab');

    await expect(workspace.getByRole('textbox', { name: 'Income Summary' })).toHaveValue('60000');
  });

  test('repeatable preview groups expose a Remove action after adding an instance', async ({ page }) => {
    await importDefinition(page, REPEATABLE_DEF);
    await switchTab(page, 'Preview');

    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await expect(workspace.getByRole('button', { name: /add members/i })).toBeVisible({ timeout: 3000 });

    await workspace.getByRole('button', { name: /add members/i }).click();

    await expect(workspace.getByRole('button', { name: /remove/i })).toBeVisible();
  });

  // Bug #39: Preview JSON view has no "Copy to clipboard" button on the Definition sub-tab.
  // The JsonDocumentsView component renders a <pre> block with JSON but provides no copy action.
  test('bug #39: Json tab Definition sub-tab renders a copy-to-clipboard button', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Preview"]');

    // Switch to the JSON mode inside the Preview workspace
    await workspace.getByTestId('preview-mode-json').click();

    // The Definition sub-tab should be active by default; confirm JSON content is visible
    await expect(workspace.getByTestId('json-doc-definition')).toBeVisible();

    // A "Copy" button should be present to copy the displayed JSON to the clipboard
    await expect(workspace.getByRole('button', { name: /copy/i })).toBeVisible();
  });

  // Bug #71: Component and Theme sub-tabs in Preview JSON view show stub placeholder
  // objects (e.g. { "targetDefinition": { "url": "..." } }) rather than real authored
  // content. The studio has no authoring surface for component or theme documents,
  // so they permanently remain as stubs — only the Definition sub-tab renders real content.
  //
  // Root cause: Only the Definition sub-tab renders real content; Component/Theme
  // sub-tabs show minimal stub objects because there is no authoring surface that
  // populates these documents with real widget bindings, tokens, or theme rules.
  test('bug #71: Component sub-tab shows a real component tree with widget bindings, not a targetDefinition stub', async ({ page }) => {
    // Seed a definition that includes a choice-type field; a properly authored component
    // document should bind it to a Dropdown or Select widget — not the generic TextInput
    // fallback that the automatic rebuild assigns to every field.
    await importDefinition(page, {
      $formspec: '1.0',
      items: [
        { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'status', type: 'field', dataType: 'string', label: 'Status',
          optionSet: 'statuses' },
      ],
      optionSets: {
        statuses: { options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]},
      },
    });
    await switchTab(page, 'Preview');

    const workspace = page.locator('[data-testid="workspace-Preview"]');
    await workspace.getByTestId('preview-mode-json').click();

    // Switch to the Component sub-tab
    await workspace.getByRole('button', { name: 'Component' }).click();

    const componentDoc = workspace.getByTestId('json-doc-component');
    await expect(componentDoc).toBeVisible();

    // A properly authored component document should show a non-generic choice widget
    // for the option-backed field "status", rather than the TextInput fallback.
    await expect(componentDoc).toContainText(/Select|Dropdown/);
  });

});
