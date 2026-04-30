/** @filedesc Playwright helper utilities for formspec-studio E2E tests (navigation, import, tab switching). */
import { Page, type Locator } from '@playwright/test';

/** Select row in this container's header only (nested layout nodes also use layout-select-row). */
export function layoutContainerHeaderSelectRow(container: Locator): Locator {
  return container.locator(':scope > div').first().getByTestId('layout-select-row');
}

/** Wait for the app to be fully loaded (Shell visible) and Editor column mounted (Edit mode). */
export async function waitForApp(page: Page) {
  await page.goto('?skipOnboarding=1&studioMode=edit');
  await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
  await switchMode(page, 'edit');
}

/** Wait for app with e2e=1 so window.__FORMSPEC_TEST_EXPORT is available for export validation tests. */
export async function waitForAppWithExport(page: Page) {
  await page.goto('?e2e=1&skipOnboarding=1&studioMode=edit');
  await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
  await switchMode(page, 'edit');
}

/** Switch the Studio surface to a specific mode. */
export async function switchMode(page: Page, mode: 'chat' | 'edit' | 'design' | 'preview') {
  await page.click(`[data-testid="mode-toggle-${mode}"]`);
  // Map mode to expected workspace visibility for wait logic
  const workspaceTestId = mode === 'chat' ? 'chat-panel' 
    : mode === 'preview' ? 'workspace-Preview' 
    : mode === 'design' ? 'design-canvas-shell'
    : 'workspace-Editor';
  await page.waitForSelector(`[data-testid="${workspaceTestId}"]`);
}

/** Switch to a workspace tab (Legacy wrapper around switchMode). */
export async function switchTab(page: Page, tabName: string) {
  const modeMap: Record<string, 'chat' | 'edit' | 'design' | 'preview'> = {
    'Editor': 'edit',
    'Layout': 'design',
    'Preview': 'preview',
    'Design': 'design',
  };
  const mode = modeMap[tabName] || 'edit';
  await switchMode(page, mode);
}

/**
 * Open the Mapping workspace. UnifiedStudio mounts it as an advanced tab (not a mode toggle).
 */
export async function openMappingWorkspace(page: Page) {
  await switchTab(page, 'Editor');
  const sidebar = page.locator('[data-testid="blueprint-sidebar"]');
  await sidebar.getByRole('button', { name: 'Open Mappings tab' }).click();
  await page.waitForSelector('[data-testid="workspace-Mapping"]');
}

/** Canonical desktop properties rail locator. */
export function propertiesPanel(page: Page) {
  return page.locator('[data-testid="properties-panel"]');
}

/** Top-level editor field rows, excluding nested summary/detail elements. */
export function editorFieldRows(page: Page) {
  return page.locator('[data-testid="workspace-Editor"] [data-editor-path][data-testid^="field-"]');
}

/** Top-level editor group rows, excluding nested summary/detail elements. */
export function editorGroupRows(page: Page) {
  return page.locator('[data-testid="workspace-Editor"] [data-editor-path][data-testid^="group-"]');
}

/** Top-level editor display rows, excluding nested summary/detail elements. */
export function editorDisplayRows(page: Page) {
  return page.locator('[data-testid="workspace-Editor"] [data-editor-path][data-testid^="display-"]');
}

/**
 * Import a definition via the Import Dialog UI.
 * The import remains in undo history.
 */
export async function importDefinition(page: Page, definition: unknown) {
  // Import button is inside the account dropdown menu — open the menu first
  await page.getByRole('button', { name: 'Open account menu' }).click();
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

    // Import button is inside the account dropdown menu — open the menu first
    await page.getByRole('button', { name: 'Open account menu' }).click();
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

/** Add from the Layout workspace palette (layout + display only; fields and groups use Editor). */
export async function addFromLayoutPalette(page: Page, label: string) {
  await switchMode(page, 'design');
  await page.click('[data-testid="layout-add-item"]');
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
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+KeyK`);
  await page.waitForSelector('[data-testid="command-palette"]');
  await page.fill('[data-testid="command-palette"] input', query);
}
