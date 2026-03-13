import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition, switchTab } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string' },
    { key: 'lastName', type: 'field', dataType: 'string' },
    { key: 'email', type: 'field', dataType: 'string' },
    {
      key: 'address',
      type: 'group',
      children: [{ key: 'street', type: 'field', dataType: 'string' }],
    },
  ],
};

const PAGED_BLUEPRINT_DEFINITION = {
  $formspec: '1.0',
  formPresentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'pageOne',
      type: 'group',
      label: 'Page One',
      children: [{ key: 'firstName', type: 'field', dataType: 'string' }],
    },
    {
      key: 'pageTwo',
      type: 'group',
      label: 'Page Two',
      children: [{ key: 'email', type: 'field', dataType: 'string' }],
    },
  ],
};

test.describe('Blueprint Selection Sync', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEFINITION);
    // Wait for the first field to be rendered before proceeding
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });
  });

  test('Structure Tree click populates the Properties panel', async ({ page }) => {
    // Click on "firstName" in the Structure Tree
    await page.click('[data-testid="tree-item-firstName"]');

    // Properties panel should show "firstName" in the key input
    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Properties panel should show data type info (String)
    await expect(properties).toContainText('String');
  });

  test('Editor canvas click highlights the tree item', async ({ page }) => {
    // Click on the field block in the Editor canvas
    await page.click('[data-testid="field-firstName"]');

    // The tree item for firstName should now be selected (has accent styling)
    const treeItem = page.locator('[data-testid="tree-item-firstName"]');
    await expect(treeItem).toBeVisible();

    // Selected tree item gets bg-accent/10 text-accent classes
    await expect(treeItem).toHaveClass(/text-accent/);
  });

  test('Selection persists across tab switches', async ({ page }) => {
    // Select firstName in the editor
    await page.click('[data-testid="field-firstName"]');

    // Verify it is selected before switching
    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Switch to Logic tab
    await switchTab(page, 'Logic');

    // Switch back to Editor tab
    await switchTab(page, 'Editor');

    // Field block should still have selected styling (border-accent)
    await expect(page.locator('[data-testid="field-firstName"]')).toHaveClass(/border-accent/);

    // Properties panel should still show "firstName"
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');
  });

  test('Clicking canvas background deselects the item', async ({ page }) => {
    // Select firstName first
    await page.click('[data-testid="field-firstName"]');
    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('firstName');

    // Click on the canvas container background (outside any field block)
    // Use the workspace container and click at the very top (above field blocks)
    await page.click('[data-testid="workspace-Editor"]', { position: { x: 10, y: 5 } });

    // Properties panel should fall back to form-level properties.
    await expect(properties).toContainText('Form Properties');
    await expect(properties).toContainText('Identity');
  });

  test('Clicking a structure item on another page scrolls that canvas field into view after switching pages', async ({ page }) => {
    await importDefinition(page, PAGED_BLUEPRINT_DEFINITION);
    await page.waitForSelector('[role="tablist"]');

    await page.evaluate(() => {
      (window as any).__lastScrolledTestId = null;
      const original = HTMLElement.prototype.scrollIntoView;
      (window as any).__originalScrollIntoView = original;
      HTMLElement.prototype.scrollIntoView = function scrollIntoViewSpy() {
        (window as any).__lastScrolledTestId = this.getAttribute('data-testid');
        return original.apply(this, arguments as any);
      };
    });

    await page.getByRole('button', { name: /page two/i }).click();
    await page.evaluate(() => {
      (window as any).__lastScrolledTestId = null;
    });

    await page.click('[data-testid="tree-item-pageTwo.email"]');

    await expect(page.getByRole('tab', { name: 'Page Two' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="properties"] input[type="text"]').first()).toHaveValue('email');
    await expect.poll(async () => page.evaluate(() => (window as any).__lastScrolledTestId)).toBe('field-email');
  });
});
