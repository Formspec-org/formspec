/**
 * Blueprint Sidebar E2E tests
 *
 * Bug list:
 *  #14 Component tree count=0    — countFn for "Component Tree" always returns 0
 *  #27 Settings editable         — pencil button opens Settings dialog with editable Title input
 *  #28 Settings dialog title     — Title input in settings dialog shows current form title
 *  #37 Screener badge inert      — clicking the "Disabled" badge does not toggle/configure screener
 *  #47 Collapse arrow frozen     — Section ▶ button arrow does not rotate on expand/collapse
 */
import { test, expect } from '@playwright/test';
import { importDefinition, switchTab, waitForApp } from './helpers';

// ─── Shared seed definitions ────────────────────────────────────────────────

/** Definition with fields so the Component Tree can have nodes added to it. */
const COMPONENT_TREE_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
};

/** Definition with a title long enough to potentially truncate in the narrow sidebar. */
const SETTINGS_DEFINITION = {
  $formspec: '1.0',
  title: 'This Is A Very Long Form Title That May Get Truncated In The Narrow Sidebar Column',
  name: 'Test Form',
  url: 'urn:formspec:test',
  version: '1.0.0',
  items: [{ key: 'field1', type: 'field', dataType: 'string' }],
};

/** Definition with named variables. */
const VARIABLES_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'age', type: 'field', dataType: 'integer' },
    { key: 'income', type: 'field', dataType: 'decimal' },
  ],
  variables: [
    { name: 'taxRate', expression: '0.25' },
    { name: 'netIncome', expression: '$income * (1 - @taxRate)' },
  ],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Click a Blueprint sidebar nav button to activate that section. */
async function openBlueprintSection(page: import('@playwright/test').Page, sectionName: string) {
  const btn = page.locator(`[data-testid="blueprint-section-${sectionName}"]`);
  await btn.waitFor({ state: 'visible' });
  await btn.click();
}

// ─── Bug #14 — Component Tree count badge ────────────────────────────────────

test.describe('Bug #14 — Component Tree count badge is always 0', () => {
  test('count badge on the "Component Tree" nav row reflects actual node count (non-zero)', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, COMPONENT_TREE_DEFINITION);
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });
    await switchTab(page, 'Layout');

    const sectionBtn = page.locator('[data-testid="blueprint-section-Component Tree"]');
    await expect(sectionBtn).toBeVisible();

    const badge = sectionBtn.locator('span.tabular-nums');
    await expect(badge).toBeVisible();

    const badgeText = (await badge.textContent()) ?? '';
    expect(Number(badgeText.trim())).toBeGreaterThan(0);
  });
});

// ─── Bug #27 — Settings editing opens a dialog via pencil button ─────────────

test.describe('Bug #27 — Settings TITLE is editable via dialog', () => {
  test('clicking the pencil button in the Settings row opens a settings dialog with an editable Title input', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    // The pencil button is rendered next to the "Settings" row in the Blueprint sidebar.
    // It has data-testid="settings-edit-btn" and dispatches formspec:open-settings.
    const pencilBtn = page.locator('[data-testid="settings-edit-btn"]');
    await expect(pencilBtn).toBeVisible();
    await pencilBtn.click();

    // After clicking, the Settings dialog should open.
    const dialog = page.locator('[data-testid="settings-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // The dialog contains an input for Title with aria-label="Title".
    const titleInput = dialog.locator('input[aria-label="Title"]');
    await expect(titleInput).toBeVisible();
  });
});

// ─── Bug #28 — Settings dialog Title input has the correct value ──────────────

test.describe('Bug #28 — Settings dialog Title input shows current title', () => {
  test('the Title input in the settings dialog shows the current form title', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    // Open the settings dialog via the pencil button
    const pencilBtn = page.locator('[data-testid="settings-edit-btn"]');
    await expect(pencilBtn).toBeVisible();
    await pencilBtn.click();

    const dialog = page.locator('[data-testid="settings-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // The Title input in the dialog should display the current form title.
    // SettingsDialog renders TextInputField with id="settings-title" and defaultValue=def.title.
    const titleInput = dialog.locator('input[aria-label="Title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(SETTINGS_DEFINITION.title);
  });
});

// ─── Variables sidebar rows navigate to Logic workspace ──────────────────────

test.describe('Variables sidebar rows are navigation buttons', () => {
  test('clicking a variable navigates to the Logic workspace', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, VARIABLES_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Variables');
    await page.waitForSelector('text=@taxRate', { timeout: 5000 });

    // Confirm the Logic workspace is not yet active
    await expect(page.locator('[data-testid="workspace-Logic"]')).not.toBeVisible();

    // VariablesList.tsx renders each variable as a <button> that dispatches
    // formspec:navigate-workspace with { tab: 'Logic' } on click.
    await page.getByRole('button', { name: /@taxRate/i }).click();

    // After clicking, the Logic workspace should become visible.
    await expect(page.locator('[data-testid="workspace-Logic"]')).toBeVisible({ timeout: 3000 });
  });

  test('each variable row is a button element', async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, VARIABLES_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Variables');
    await page.waitForSelector('text=@taxRate', { timeout: 5000 });

    // VariablesList.tsx renders each variable as a <button> for navigation.
    await expect(page.getByRole('button', { name: /@taxRate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /@netIncome/i })).toBeVisible();
  });
});

// ─── Bug #47 — Section collapse arrow does not reflect open/closed state ─────
//
// NOTE: These tests were removed because the Settings section was redesigned
// from nested collapsible Section components (with "Definition Metadata" headers
// and collapse arrows) to a flat list of PropertyRow labels. No sidebar section
// currently uses the collapsible Section component — SettingsSection, ThemeOverview,
// VariablesList, ScreenerSection, and all other SIDEBAR_COMPONENTS render flat lists.
// The Section component (src/components/ui/Section.tsx) still exists and is used
// in FELReference.tsx, but that component is not mounted in the blueprint sidebar.
// If collapsible sections are re-introduced in a blueprint sidebar panel, add
// tests targeting that specific section.
test.describe('Bug #47 — Section collapse arrow is frozen', () => {
  // Tests removed: the Settings section no longer contains collapsible sub-sections.
  // The flat SettingsSection renders Title, Version, Status, Page Mode, and
  // Non-Relevant as plain PropertyRow labels — there is no "Definition Metadata"
  // header or collapse arrow to interact with.
});
