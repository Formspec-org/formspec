import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Version Comparison Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /definition.json to pre-populate changelog textareas
    await page.route('**/definition.json', (route) =>
      route.fulfill({ json: { url: 'https://example.gov/forms/grant', version: '1.0.0', items: [], binds: [] } })
    );
    // Mock /changelog
    await page.route('**/changelog', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const oldItems = body.old?.items || [];
      const newItems = body.new?.items || [];
      if (newItems.length > oldItems.length) {
        await route.fulfill({
          json: {
            semverImpact: 'minor',
            fromVersion: body.old?.version || '1.0.0',
            toVersion: body.new?.version || '1.1.0',
            changes: [
              { type: 'added', path: 'items.newField', key: 'newField', impact: 'compatible', description: 'Added new field.' },
            ],
          },
        });
      } else {
        await route.fulfill({
          json: {
            semverImpact: 'patch',
            fromVersion: body.old?.version || '1.0.0',
            toVersion: body.new?.version || '1.0.0',
            changes: [],
          },
        });
      }
    });
    await page.goto(TOOLS_URL);
    await page.locator('.tools-tab[data-tab="changelog"]').click();
  });

  test('pre-loads definition into both text areas', async ({ page }) => {
    // Wait for the definition to load
    await expect(page.locator('#changelog-old')).not.toHaveValue('');
    const oldVal = await page.locator('#changelog-old').inputValue();
    expect(JSON.parse(oldVal)).toHaveProperty('version', '1.0.0');
  });

  test('comparing identical definitions shows no changes', async ({ page }) => {
    await expect(page.locator('#changelog-old')).not.toHaveValue('');
    await page.click('#btn-changelog');

    await expect(page.locator('#changelog-result')).toBeVisible();
    await expect(page.locator('#changelog-impact')).toHaveText('patch');
    await expect(page.locator('#changelog-changes')).toContainText('No changes');
  });

  test('adding an item shows the change with minor impact', async ({ page }) => {
    await expect(page.locator('#changelog-old')).not.toHaveValue('');

    // Modify the "new" textarea to add an item
    const oldVal = await page.locator('#changelog-old').inputValue();
    const newDef = JSON.parse(oldVal);
    newDef.version = '1.1.0';
    newDef.items = [{ key: 'newField', type: 'field', dataType: 'string', label: 'New' }];
    await page.locator('#changelog-new').fill(JSON.stringify(newDef));

    await page.click('#btn-changelog');

    await expect(page.locator('#changelog-result')).toBeVisible();
    await expect(page.locator('#changelog-impact')).toHaveText('minor');
    await expect(page.locator('#changelog-changes')).toContainText('added');
  });
});
