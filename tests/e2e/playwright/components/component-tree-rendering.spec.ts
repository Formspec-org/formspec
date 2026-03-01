// ADR-0023 Exception (E2E-KEEP tests only): Tests use the real grant application
// for realistic rendering context and genuine DOM/engine interaction.
import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  goToPage,
} from '../helpers/grant-app';

test.describe('Components: Component Tree Rendering', () => {
  test('should render bound TextInput components on the grant application first wizard page', async ({ page }) => {
    await mountGrantApplication(page);

    // Wizard renders the active page title as an h2 heading
    const heading = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Applicant Info');

    // Bound TextInputs are visible on page 1 without any navigation
    await expect(page.locator('input[name="applicantInfo.orgName"]')).toBeVisible();
    await expect(page.locator('input[name="applicantInfo.ein"]')).toBeVisible();
  });

  test('should show and hide ConditionalGroup content when its when-expression changes', async ({ page }) => {
    await mountGrantApplication(page);

    // The Subcontractors page has ConditionalGroup with when: "$budget.usesSubcontractors"
    await goToPage(page, 'Subcontractors');

    // Default: usesSubcontractors is null/false — conditional content is hidden
    const activePanel = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    const wrapper = activePanel.locator('.formspec-when').first();
    await expect(wrapper).toHaveClass(/formspec-hidden/);

    // Enable subcontractors via engine
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(50);

    // Content should now be visible
    await expect(wrapper).not.toHaveClass(/formspec-hidden/);
  });
});
