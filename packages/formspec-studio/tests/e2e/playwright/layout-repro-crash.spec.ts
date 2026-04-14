import { test, expect } from '@playwright/test';
import {
  importDefinition,
  switchTab,
  waitForApp,
} from './helpers';

const REPRO_DEF = {
  $formspec: '1.0',
  url: 'urn:repro-crash',
  version: '1.0.0',
  items: [
    { key: 'field1', type: 'field', dataType: 'string', label: 'Field 1' },
    { key: 'field2', type: 'field', dataType: 'string', label: 'Field 2' },
  ],
};

test('REGRESSION: Moving item back from nested container to root via context menu', async ({ page }) => {
  await waitForApp(page);
  await importDefinition(page, REPRO_DEF);
  await switchTab(page, 'Layout');

  // 1. Wrap Field 1 in a Stack
  const field1 = page.locator('[data-testid="layout-field-field1"]');
  await expect(field1).toBeVisible();
  await field1.click({ button: 'right' });
  await page.click('[data-testid="layout-ctx-wrapInStack"]');

  // Verify it's wrapped
  const stack = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' });
  await expect(stack).toBeVisible();

  // 2. Move Field 1 "Down" twice (once moves to bottom of stack, second moves out of stack to root)
  // Actually, Move Down on the last item in a stack should pop it out.
  
  // Right-click field1 inside stack
  await field1.click({ button: 'right' });
  await page.click('[data-testid="layout-ctx-moveComponentNodeDown"]');
  
  // Right-click again to move out
  await field1.click({ button: 'right' });
  await page.click('[data-testid="layout-ctx-moveComponentNodeDown"]');

  // If it crashes, the next assertion or action will fail or page will reload.
  // We expect it to be visible at the root level now.
  await expect(field1).toBeVisible();
  
  // Verify it is no longer in the stack
  await expect(stack.locator('[data-testid="layout-field-field1"]')).toHaveCount(0);
});
