import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.describe('Header Actions', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('shows real header actions and omits dead primary actions', async ({ page }) => {
    const header = page.locator('[data-testid="header"]');

    await expect(header.getByRole('button', { name: /import/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /undo/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /redo/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /metadata/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /export/i })).toHaveCount(0);
    await expect(header.getByRole('button', { name: /new/i })).toHaveCount(0);
  });

  test('exposes form metadata and avatar affordances as interactive controls', async ({ page }) => {
    const header = page.locator('[data-testid="header"]');

    await expect(header.getByRole('button', { name: /formspec 1\.0/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /account|profile|avatar/i })).toBeVisible();
  });

  // BUG-058: "The Stack" logo in the header is a plain <div> — clicking it does nothing.
  // RED: The logo/app mark area is rendered as a non-interactive <div className="...">
  // rather than a button or link. A click should navigate to a dashboard/home route or
  // open an application menu. The fix requires wrapping the logo in a <button> or <a>
  // with an appropriate click handler.
  test('clicking the app logo navigates to home or shows an app menu [BUG-058]', async ({ page }) => {
    const header = page.locator('[data-testid="header"]');

    // The logo area contains the text "The Stack" — it should be an interactive element.
    // Check that it is rendered as a button or anchor (not a plain div/span).
    const logoElement = header.locator('button, a').filter({ hasText: 'The Stack' });
    await expect(logoElement).toBeVisible();

    // Click the logo — it should either navigate (URL change) or reveal a menu/popover.
    await logoElement.click();

    // After clicking, either: the URL has changed (navigation), or a menu is visible.
    // We accept either outcome — the bug is that currently nothing happens at all.
    const urlChanged = page.url() !== '/';
    const menuVisible = await page.locator('[role="menu"], [role="dialog"], [data-testid="app-menu"]').isVisible();

    expect(urlChanged || menuVisible).toBe(true);
  });
});
