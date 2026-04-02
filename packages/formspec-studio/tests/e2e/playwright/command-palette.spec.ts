import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

// Definition with binds and shapes for testing rule/FEL surfacing in the palette
// Bug #5: command palette does not expose bind rules or shape constraints as searchable results
const LOGIC_SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'grossIncome', type: 'field', dataType: 'integer', label: 'Gross Income' },
    { key: 'netIncome', type: 'field', dataType: 'decimal', label: 'Net Income' },
    { key: 'ageField', type: 'field', dataType: 'integer', label: 'Applicant Age' },
  ],
  binds: {
    netIncome: { calculate: '$grossIncome * 0.8', readonly: 'true' },
    ageField: { constraint: '$ageField >= 18', required: 'true' },
  },
  shapes: [
    { name: 'incomeCheck', severity: 'error', constraint: '$grossIncome > 0' },
  ],
};

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });
  });

  test('open and close with keyboard', async ({ page }) => {
    // Press Meta+k to open the palette
    await page.keyboard.press('Meta+k');

    // The command palette should be visible
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // The command palette should be gone
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
  });

  test('search filters field results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Type "first" in the search input
    await page.fill('[data-testid="command-palette"] input', 'first');

    // "firstName" should appear in results
    const results = page.locator('[data-testid="palette-result"]');
    await expect(results.filter({ hasText: 'firstName' })).toBeVisible();

    // "lastName" should not be visible (filtered out)
    await expect(results.filter({ hasText: 'lastName' })).not.toBeVisible();
  });

  test('click result selects item and closes palette', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Type "firstName" to narrow results
    await page.fill('[data-testid="command-palette"] input', 'firstName');

    // Click the firstName result
    await page.locator('[data-testid="palette-result"]').filter({ hasText: 'firstName' }).click();

    // Palette should close
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();

    // The field should be selected in the editor (border-accent styling)
    await expect(page.locator('[data-testid="field-firstName"]')).toHaveClass(/border-accent/);
  });

  test('keyboard navigation selects the highlighted result', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');
    await page.fill('[data-testid="command-palette"] input', 'name');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
    // The second "name" result (lastName) should be selected in the editor
    await expect(page.locator('[data-testid="field-lastName"]')).toHaveClass(/border-accent/);
  });

  test('reopening the palette resets the previous search', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');
    await page.fill('[data-testid="command-palette"] input', 'first');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();

    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('[data-testid="command-palette"] input');
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('[data-testid="palette-result"]').filter({ hasText: 'firstName' })).toBeVisible();
    await expect(page.locator('[data-testid="palette-result"]').filter({ hasText: 'lastName' })).toBeVisible();
  });

  // Bug #5: Command palette does not surface bind rules, shapes, or FEL expressions
  // as searchable results. Searching for a bind path or FEL keyword present in the
  // Logic workspace should produce results in a dedicated "Binds" or "Rules" section.
  test('bug #5: searching for a bind path shows bind rules and FEL expressions in results', async ({ page }) => {
    // Seed with a definition that has meaningful binds and shapes
    await importDefinition(page, LOGIC_SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-grossIncome"]', { timeout: 5000 });

    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Search for "netIncome" — it is both a field key AND a bind target.
    // The palette should show a dedicated "Binds" section with the FEL expression.
    await page.fill('[data-testid="command-palette"] input', 'netIncome');

    // A "Binds" section header should appear in the results
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette.getByText('Binds', { exact: false })).toBeVisible();

    // A palette result entry for the bind rule (showing the FEL expression) should appear
    const bindResult = page.locator('[data-testid="palette-result"]').filter({ hasText: '$grossIncome * 0.8' });
    await expect(bindResult).toBeVisible();
  });

  // Bug #5 (part 2): Searching for a shape constraint keyword should surface shape rules
  test('bug #5: searching for a shape name shows shape constraint rules in results', async ({ page }) => {
    await importDefinition(page, LOGIC_SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-grossIncome"]', { timeout: 5000 });

    await page.keyboard.press('Meta+k');
    await page.waitForSelector('[data-testid="command-palette"]');

    // Search for "incomeCheck" — this is a shape name, not an item key
    await page.fill('[data-testid="command-palette"] input', 'incomeCheck');

    // A "Rules" or "Shapes" section header should appear
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette.getByText(/Rules|Shapes/i)).toBeVisible();

    // A result for the shape constraint should appear
    const shapeResult = page.locator('[data-testid="palette-result"]').filter({ hasText: 'incomeCheck' });
    await expect(shapeResult).toBeVisible();
  });
});
