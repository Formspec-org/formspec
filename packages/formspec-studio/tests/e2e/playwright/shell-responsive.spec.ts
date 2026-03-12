import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition } from './helpers';

test.describe('Shell responsive chrome', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('does not overflow horizontally at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test('keeps critical header and status text at or above 11px', async ({ page }) => {
    const fontSizes = await page.evaluate(() => {
      const headerMeta = Array.from(document.querySelectorAll('[data-testid="header"] *'))
        .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
        .filter(Boolean);
      const statusMeta = Array.from(document.querySelectorAll('[data-testid="status-bar"] *'))
        .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
        .filter(Boolean);
      return [...headerMeta, ...statusMeta];
    });

    expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(11);
  });

  // BUG-067: Status bar URL is rendered as plain text in a <div>, not as a clickable <a> link.
  // RED: StatusBar renders `def.url` inside a plain <div className="truncate ml-4 ...">
  // element. For a URN/URL value it should be rendered as an <a href="..."> so that it is
  // keyboard-accessible and can be activated. The fix requires changing the <div> to an
  // <a> element with a meaningful href attribute.
  test('status bar URL is rendered as an anchor element with an href [BUG-067]', async ({ page }) => {
    // Seed a definition with a known URL value so we can query for it
    await seedDefinition(page, {
      $formspec: '1.0',
      url: 'urn:test:status-bar-url',
      items: [],
    });

    const statusBar = page.locator('[data-testid="status-bar"]');
    await expect(statusBar).toBeVisible();

    // The URL text should be visible somewhere in the status bar
    await expect(statusBar).toContainText('urn:test:status-bar-url');

    // The URL must be rendered inside an <a> element (not a plain <div> or <span>).
    // This is the bug: currently it is a plain <div>.
    const urlLink = statusBar.locator('a').filter({ hasText: 'urn:test:status-bar-url' });
    await expect(urlLink).toBeVisible();

    // The <a> element must have an href attribute so it is actually navigable.
    const href = await urlLink.getAttribute('href');
    expect(href).toBeTruthy();
  });
});
