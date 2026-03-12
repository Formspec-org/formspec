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

/** Dispatch a command by evaluating in the page context. */
export async function dispatch(page: Page, command: { type: string; payload: unknown }) {
  await page.evaluate((cmd) => {
    (window as any).__testProject__.dispatch(cmd);
  }, command);
}

/** Seed the project with a definition before the test starts. */
export async function seedDefinition(page: Page, definition: unknown) {
  await page.evaluate((def) => {
    const project = (window as any).__testProject__;
    project.dispatch({
      type: 'project.import',
      payload: { definition: def },
    });
    // Clear undo/redo history so the seed itself is not part of authoring history.
    project.resetHistory();
  }, definition);
}

/** Seed a complete project state (definition + theme + mapping + component). */
export async function seedProject(page: Page, state: Record<string, unknown>) {
  await page.evaluate((s) => {
    const project = (window as any).__testProject__;
    project.dispatch({ type: 'project.import', payload: s });
    // Clear undo/redo history so the seed itself is not part of authoring history.
    project.resetHistory();
  }, state);
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
