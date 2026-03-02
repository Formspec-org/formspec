import { expect, test, type Page } from '@playwright/test';
import { gotoStudio } from './helpers';

async function treePanePercent(page: Page) {
  return page.locator('.studio-tree-pane').evaluate((el) => {
    const style = (el as HTMLElement).style.flex;
    const match = style.match(/0 0 ([\d.]+)%/);
    return match ? Number(match[1]) : NaN;
  });
}

test.describe('Formspec Studio - Splitter', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStudio(page);
  });

  test('resizes and resets tree pane width', async ({ page }) => {
    const initial = await treePanePercent(page);
    expect(initial).toBe(50);

    const splitter = page.locator('.studio-splitter');
    const box = await splitter.boundingBox();
    if (!box) {
      throw new Error('Splitter not rendered');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2);
    await page.mouse.up();

    const resized = await treePanePercent(page);
    expect(resized).toBeGreaterThan(initial);

    await splitter.dblclick();
    await expect.poll(() => treePanePercent(page)).toBe(50);
  });
});
