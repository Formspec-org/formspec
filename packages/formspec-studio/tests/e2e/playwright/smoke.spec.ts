import { test, expect } from '@playwright/test';

test.describe('Smoke — App Bootstrap', () => {
  test('loads the app and shows the shell chrome', async ({ page }) => {
    await page.goto('?skipOnboarding=1&studioMode=chat');
    await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });

    // App title in the header
    await expect(page.locator('[data-testid="header"]')).toContainText('The Stack');

    // Mode toggle instead of tabs
    const modes = ['chat', 'edit', 'design', 'preview'];
    for (const mode of modes) {
      await expect(page.locator(`[data-testid="mode-toggle-${mode}"]`)).toBeVisible();
    }

    // Explicit chat boot (waitForApp defaults to edit for authoring E2E)
    await expect(page.locator('[data-testid="mode-toggle-chat"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();

    // StatusBar is visible at the bottom
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();

    // Blueprint sidebar is NOT visible in chat mode (it's for edit/design)
    await expect(page.locator('[data-testid="blueprint"]')).not.toBeVisible();

    // Switch to edit mode
    await page.click('[data-testid="mode-toggle-edit"]');
    await expect(page.locator('[data-testid="blueprint"]')).toBeVisible();
  });
});
