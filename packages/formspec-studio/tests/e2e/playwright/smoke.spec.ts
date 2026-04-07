import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.describe('Smoke — App Bootstrap', () => {
  test('loads the app and shows the shell chrome', async ({ page }) => {
    await waitForApp(page);

    // App title in the header
    await expect(page.locator('[data-testid="header"]')).toContainText('The Stack');

    // Workspace tabs (theme authoring lives under Layout — Layout / Theme mode toggle)
    const tabs = ['Editor', 'Layout', 'Mapping', 'Preview'];
    for (const tab of tabs) {
      await expect(page.locator(`[data-testid="tab-${tab}"]`)).toBeVisible();
    }

    // Default tab is Editor
    await expect(page.locator('[data-testid="tab-Editor"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();

    // StatusBar is visible at the bottom
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();

    // Blueprint sidebar is visible
    await expect(page.locator('[data-testid="blueprint"]')).toBeVisible();
  });
});
