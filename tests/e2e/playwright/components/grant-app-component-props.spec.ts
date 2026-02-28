import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineSetValue,
  engineValue,
  addRepeatInstance,
} from '../helpers/grant-app';

test.describe('Components: Grant App Component Props', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should update engine value when RadioGroup orgType option is selected', async ({ page }) => {
    // Page 1 has the RadioGroup for applicantInfo.orgType
    const radios = page.locator('input[type="radio"][name="applicantInfo.orgType"]');
    await expect(radios).toHaveCount(4); // nonprofit, university, government, forprofit

    // Click "university" option
    await radios.filter({ hasText: '' }).nth(1).click();
    await page.waitForTimeout(50);

    const value = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().signals['applicantInfo.orgType']?.value;
    });
    // university is index 1 in the orgTypes optionSet
    expect(['nonprofit', 'university', 'government', 'forprofit']).toContain(value);
  });

  test('should navigate from page 1 to page 2 via Wizard Next and back via Previous', async ({ page }) => {
    // Page 1 should be visible
    const panels = page.locator('.formspec-wizard-panel');
    await expect(panels.nth(0)).toBeVisible();

    // Click Next → go to page 2 (Project Narrative)
    await page.locator('button.formspec-wizard-next').first().click();
    await page.waitForTimeout(150);

    const heading = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(heading).toHaveText('Project Narrative');

    // Click Previous → back to page 1 (Applicant Info)
    await page.locator('button.formspec-wizard-prev').first().click();
    await page.waitForTimeout(150);

    const heading1 = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(heading1).toHaveText('Applicant Info');
  });

  test('should toggle budget.usesSubcontractors on and off via engine', async ({ page }) => {
    // Navigate to Budget page
    await goToPage(page, 'Budget');

    // Set to true
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(50);

    let val = await engineValue(page, 'budget.usesSubcontractors');
    expect(val).toBe(true);

    // Set to false
    await engineSetValue(page, 'budget.usesSubcontractors', false);
    await page.waitForTimeout(50);

    val = await engineValue(page, 'budget.usesSubcontractors');
    expect(val).toBe(false);
  });

  test('should set projectNarrative.focusAreas to multiple values and reflect in engine', async ({ page }) => {
    // Navigate to Project Narrative page
    await goToPage(page, 'Project Narrative');

    await engineSetValue(page, 'projectNarrative.focusAreas', ['health', 'education']);
    await page.waitForTimeout(100);

    const val = await engineValue(page, 'projectNarrative.focusAreas');
    expect(val).toContain('health');
    expect(val).toContain('education');
  });

  test('should increase DataTable row count when a line item is added on Budget page', async ({ page }) => {
    await goToPage(page, 'Budget');

    // Initial count is 1 (minRepeat: 1)
    const initialCount = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().repeats['budget.lineItems']?.value;
    });
    expect(initialCount).toBe(1);

    // Add a row via the DataTable add button
    const addBtn = page.locator('.formspec-datatable-add').first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await page.waitForTimeout(100);

    const newCount = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().repeats['budget.lineItems']?.value;
    });
    expect(newCount).toBe(2);
  });

  test('should compute subtotal=200 when quantity=2 and unitCost=100 on lineItems[0]', async ({ page }) => {
    await goToPage(page, 'Budget');

    await engineSetValue(page, 'budget.lineItems[0].quantity', 2);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 100);
    await page.waitForTimeout(100);

    const subtotal = await engineValue(page, 'budget.lineItems[0].subtotal');
    expect(subtotal).toBe(200);
  });

  test('should render grant app main Stack with children visible on page 1', async ({ page }) => {
    // The grant app uses Stack components on each page — verify the first one has children
    const stack = page.locator('.formspec-stack').first();
    await expect(stack).toBeVisible();

    // Stack should contain child elements
    const children = stack.locator(':scope > *');
    const count = await children.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should resolve orgType optionSet label in Summary on Review & Submit page', async ({ page }) => {
    // Set orgType to 'nonprofit' before navigating
    await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
    await page.waitForTimeout(50);

    // Navigate to Review & Submit page
    await goToPage(page, 'Review & Submit');

    // Expand the Applicant Information collapsible
    const collapsible = page.locator('.formspec-collapsible').filter({ hasText: 'Applicant Information' }).first();
    await collapsible.click();
    await page.waitForTimeout(100);

    // The Summary should show the label "Nonprofit Organization" not the raw value "nonprofit"
    const summary = collapsible.locator('.formspec-summary');
    await expect(summary).toContainText('Nonprofit Organization');
    await expect(summary).not.toContainText('"nonprofit"');
  });

  test('should render RadioGroup with horizontal orientation using flex-direction row', async ({ page }) => {
    // Page 1 has orgType RadioGroup with orientation: "horizontal"
    const radioGroup = page.locator('.formspec-radio-group[data-orientation="horizontal"]');
    await expect(radioGroup).toHaveCount(1);
    // Verify CSS flex-direction is row (horizontal layout)
    const direction = await radioGroup.evaluate(el => getComputedStyle(el).flexDirection);
    expect(direction).toBe('row');
  });

  test('should render Rating stars using unicode star character, not text "star"', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    const stars = page.locator('.formspec-rating-star');
    await expect(stars).toHaveCount(5);
    // Each star should contain the ★ character, not the word "star"
    const firstStarText = await stars.first().textContent();
    expect(firstStarText).toBe('★');
  });

  test('should show fallback text when ConditionalGroup condition is false', async ({ page }) => {
    // Subcontractors page — usesSubcontractors defaults to false
    await goToPage(page, 'Subcontractors');
    // The fallback text should be visible
    const fallback = page.locator('.formspec-conditional-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('subcontractor');
  });

  test('should constrain Signature canvas width to container with max-width CSS', async ({ page }) => {
    await goToPage(page, 'Review & Submit');
    const canvas = page.locator('.formspec-signature-canvas');
    await expect(canvas).toBeVisible();
    // Canvas should not exceed its container width
    const { canvasWidth, containerWidth } = await canvas.evaluate(el => ({
      canvasWidth: el.getBoundingClientRect().width,
      containerWidth: (el.parentElement?.getBoundingClientRect().width || 9999),
    }));
    expect(canvasWidth).toBeLessThanOrEqual(containerWidth);
    // Canvas should have a reasonable height (not giant)
    const height = await canvas.evaluate(el => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(200);
  });

  test('should render Accordion with meaningful label from component labels prop', async ({ page }) => {
    await goToPage(page, 'Project Phases');
    // Accordion should NOT show generic "Section 1"
    const accordion = page.locator('.formspec-accordion-item summary');
    await expect(accordion.first()).toBeVisible();
    const text = await accordion.first().textContent();
    expect(text).not.toContain('Section 1');
  });

  test('should render Tab buttons with tab-like styling (border-bottom or background)', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    const activeTab = page.locator('.formspec-tab--active');
    await expect(activeTab).toHaveCount(1);
    // Active tab should have distinguishing visual style
    const bg = await activeTab.evaluate(el => getComputedStyle(el).borderBottom);
    // Should have SOME border-bottom styling (not "0px none")
    expect(bg).not.toContain('0px');
  });

  test('should render Badge with background color styling', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    const badge = page.locator('.formspec-badge').first();
    await expect(badge).toBeVisible();
    // Badge should have a visible background (not transparent/white)
    const bg = await badge.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('should render both FileUpload components with drag-drop zones on Review page', async ({ page }) => {
    await goToPage(page, 'Review & Submit');
    const dropZones = page.locator('.formspec-drop-zone');
    // Both narrativeDoc and budgetJustification should have drop zones
    await expect(dropZones).toHaveCount(2);
  });
});
