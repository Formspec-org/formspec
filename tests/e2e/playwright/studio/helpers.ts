import { expect, type Locator, type Page } from '@playwright/test';
import path from 'path';

export const STUDIO_URL = `file://${path.resolve(process.cwd(), 'form-builder/dist/index.html')}`;

export async function gotoStudio(page: Page) {
  await page.goto(STUDIO_URL);
  await expect(page.locator('.studio-root')).toBeVisible();
  await expect(page.locator('.tree-editor')).toBeVisible();
}

export function treeNodeByLabel(page: Page, label: string): Locator {
  return page.locator('.tree-node').filter({
    has: page.locator('.tree-node-label', { hasText: label }),
  });
}

export function propertyInput(page: Page, label: string): Locator {
  return page
    .locator('.property-row')
    .filter({ has: page.locator('.property-label', { hasText: label }) })
    .locator('input, select')
    .first();
}

export async function selectTreeNode(page: Page, label: string) {
  await treeNodeByLabel(page, label).click();
}
