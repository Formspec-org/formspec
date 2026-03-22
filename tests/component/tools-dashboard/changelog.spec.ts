import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

async function gotoChangelogTab(page: import('@playwright/test').Page) {
  await page.goto(TOOLS_URL);
  await page.waitForSelector('html[data-formspec-wasm-ready="1"]', { timeout: 30_000 });
  await page.locator('.tools-tab[data-tab="changelog"]').click();
}

test.describe('Version Comparison Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/examples/grant-application/definition.json', (route) =>
      route.fulfill({
        json: {
          $formspec: '1.0',
          url: 'https://example.gov/forms/grant',
          version: '1.0.0',
          title: 'Grant',
          items: [],
          binds: [],
        },
      }),
    );
    await gotoChangelogTab(page);
  });

  test('pre-loads definition into both text areas', async ({ page }) => {
    await expect(page.locator('#changelog-old')).not.toHaveValue('');
    const oldVal = await page.locator('#changelog-old').inputValue();
    expect(JSON.parse(oldVal)).toHaveProperty('version', '1.0.0');
  });

  test('comparing identical definitions shows no changes', async ({ page }) => {
    const same = JSON.stringify({
      $formspec: '1.0',
      url: 'https://example.gov/forms/grant',
      version: '1.0.0',
      title: 'Grant',
      items: [],
      binds: [],
      shapes: [],
    });
    await page.locator('#changelog-old').fill(same);
    await page.locator('#changelog-new').fill(same);
    await page.click('#btn-changelog');

    await expect(page.locator('#changelog-result')).toBeVisible();
    await expect(page.locator('#changelog-changes')).toContainText('No changes');
  });

  test('adding an item shows the change with minor impact', async ({ page }) => {
    await expect(page.locator('#changelog-old')).not.toHaveValue('');

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
