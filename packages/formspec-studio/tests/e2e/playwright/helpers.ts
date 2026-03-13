import { Page } from '@playwright/test';

/** Wait for the app to be fully loaded (Shell visible). */
export async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
}

/** Switch to a workspace tab by clicking its label. */
export async function switchTab(page: Page, tabName: string) {
  await page.click(`[data-testid="tab-${tabName}"]`);
  await page.waitForSelector(`[data-testid="workspace-${tabName}"]`);
}

/**
 * Import a definition via the Import Dialog UI.
 * The import remains in undo history.
 */
export async function importDefinition(page: Page, definition: unknown) {
  await page.click('[data-testid="import-btn"]');
  const dialog = page.locator('[data-testid="import-dialog"]');
  await dialog.waitFor();
  await dialog.locator('textarea').fill(JSON.stringify(definition));
  await dialog.getByRole('button', { name: 'Load' }).click();
  await dialog.waitFor({ state: 'hidden' });
}

/**
 * Import a full project via the Import Dialog UI, one artifact at a time.
 * Supports definition, component, theme, and mapping artifacts.
 */
export async function importProject(page: Page, state: Record<string, unknown>) {
  const artifactOrder = ['definition', 'component', 'theme', 'mapping'] as const;

  for (const key of artifactOrder) {
    if (!(key in state)) continue;

    await page.click('[data-testid="import-btn"]');
    const dialog = page.locator('[data-testid="import-dialog"]');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: `${key[0].toUpperCase()}${key.slice(1)}` }).click();
    await dialog.locator('textarea').fill(JSON.stringify(state[key]));
    await dialog.getByRole('button', { name: 'Load' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

/** Add an item from the Add Item Palette by clicking its button. */
export async function addFromPalette(page: Page, label: string) {
  await page.click('[data-testid="add-item"]');
  const palette = page.locator('[data-testid="add-item-palette"]');
  await palette.waitFor();
  await palette.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first().click();
}

/** Click a field block in the editor canvas. */
export async function selectField(page: Page, key: string) {
  await page.click(`[data-testid="field-${key}"]`);
}

/** Click a group block in the editor canvas. */
export async function selectGroup(page: Page, key: string) {
  await page.click(`[data-testid="group-${key}"]`);
}

/** Open the command palette and search. */
export async function openPaletteAndSearch(page: Page, query: string) {
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('[data-testid="command-palette"]');
  await page.fill('[data-testid="command-palette"] input', query);
}
