import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineSetValue,
  engineValue,
} from '../helpers/grant-app';

test.describe('Grant App UX: Readonly field visual treatment', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('readonly fields should have a visual readonly class on the wrapper', async ({ page }) => {
    // Duration on the Project Narrative page is readonly when both dates are set.
    await goToPage(page, 'Project Narrative');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(100);

    // Duration field should now be readonly and have a visual class
    const durationField = page.locator('.formspec-field[data-name="projectNarrative.duration"]');
    await expect(durationField).toHaveClass(/formspec-field--readonly/);
  });

  test('readonly field input should appear visually distinct (background color)', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(100);

    const durationInput = page.locator('.formspec-field[data-name="projectNarrative.duration"] input');
    const bgColor = await durationInput.evaluate(el => getComputedStyle(el).backgroundColor);
    // Should NOT be white — should have a muted/gray background
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('computed readonly fields on other pages should use stronger readonly styling', async ({ page }) => {
    await goToPage(page, 'Budget');
    await page.waitForTimeout(100);

    const subtotalInput = page.locator('input.formspec-datatable-input[name="budget.lineItems[0].subtotal"]');
    await expect(subtotalInput).toBeDisabled();

    const styles = await subtotalInput.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderTopColor: computed.borderTopColor,
      };
    });

    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.borderTopColor).not.toBe('transparent');
  });

  test('readonly field labels should display a read-only badge', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(100);

    const durationLabel = page.locator('.formspec-field[data-name="projectNarrative.duration"] .formspec-label');
    const readonlyBadgeContent = await durationLabel.evaluate((label) =>
      getComputedStyle(label, '::after').content
    );
    expect(readonlyBadgeContent).toContain('Read only');
  });
});

test.describe('Grant App UX: Website field allows paths', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('website field should not have a .org suffix that restricts URLs', async ({ page }) => {
    // The website field should allow entering paths like "example.com/project"
    const suffix = page.locator('.formspec-field[data-name="applicantInfo.projectWebsite"] .formspec-suffix');
    await expect(suffix).toHaveCount(0);
  });

});

test.describe('Grant App UX: Contact detail labels', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('contact detail labels should not wrap to multiple lines', async ({ page }) => {
    // Check the label elements in the contact details grid
    const contactLabels = page.locator('.formspec-field[data-name="applicantInfo.contactName"] .formspec-label, .formspec-field[data-name="applicantInfo.contactEmail"] .formspec-label, .formspec-field[data-name="applicantInfo.contactPhone"] .formspec-label');

    const count = await contactLabels.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const label = contactLabels.nth(i);
      const whiteSpace = await label.evaluate(el => getComputedStyle(el).whiteSpace);
      expect(whiteSpace).toBe('nowrap');
    }
  });
});

test.describe('Grant App UX: Project Narrative tabs spacing', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('tab content should have spacing below top tabs before fields', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    await page.waitForTimeout(50);

    const topPadding = await page.locator(
      '.formspec-tabs:not([data-position]) .formspec-tab-panels, .formspec-tabs[data-position="top"] .formspec-tab-panels'
    ).first().evaluate((el) => getComputedStyle(el).paddingTop);

    expect(topPadding).not.toBe('0px');
  });
});

test.describe('Grant App UX: No negative prices or quantities', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('quantity input should clamp negative values to zero', async ({ page }) => {
    await goToPage(page, 'Budget');

    const quantityInput = page.locator('input.formspec-datatable-input[name="budget.lineItems[0].quantity"]');
    await quantityInput.fill('-5');
    await page.waitForTimeout(50);

    const value = await engineValue(page, 'budget.lineItems[0].quantity');
    expect(value).toBe(0);
    await expect(quantityInput).toHaveValue('0');
  });

  test('unitCost input should clamp negative values to zero', async ({ page }) => {
    await goToPage(page, 'Budget');

    const unitCostInput = page.locator('input.formspec-datatable-input[name="budget.lineItems[0].unitCost"]');
    await unitCostInput.fill('-100');
    await page.waitForTimeout(50);

    const value = await engineValue(page, 'budget.lineItems[0].unitCost');
    expect(value).toBe(0);
    await expect(unitCostInput).toHaveValue('0');
  });

});

test.describe('Grant App UX: No negative hourly rate in project phases', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('hourlyRate input should clamp negative values to zero', async ({ page }) => {
    await goToPage(page, 'Project Phases');

    const rateInput = page.locator('input.formspec-datatable-input[name="projectPhases[0].phaseTasks[0].hourlyRate"]');
    await rateInput.fill('-100');
    await page.waitForTimeout(50);

    const value = await engineValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate');
    expect(value).toMatchObject({ amount: 0, currency: 'USD' });
    await expect(rateInput).toHaveValue('0');
  });

});

test.describe('Grant App UX: Subcontractor toggle does not break navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('auto-triggered modal should not block page interaction with a backdrop', async ({ page }) => {
    // When usesSubcontractors is toggled on, a Modal with trigger=auto opens.
    // The modal uses dialog.showModal() which creates a backdrop blocking all clicks.
    // This should NOT happen — auto modals should not block the rest of the form.
    await goToPage(page, 'Budget');
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(200);

    // The Next button should be clickable without needing to close a modal first
    const nextBtn = page.locator('button.formspec-wizard-next').first();
    await expect(nextBtn).toBeEnabled();

    // The key assertion: clicking Next should work without being blocked by a dialog backdrop
    await nextBtn.click({ timeout: 5000 });
    await page.waitForTimeout(100);

    const heading = await page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first().textContent();
    expect(heading?.trim()).toBe('Project Phases');
  });

  test('next/previous buttons should work after toggling usesSubcontractors via UI click', async ({ page }) => {
    await goToPage(page, 'Budget');
    await page.waitForTimeout(100);

    // Find the usesSubcontractors toggle and click it
    const toggle = page.locator('.formspec-toggle input[type="checkbox"]').last();
    await toggle.click();
    await page.waitForTimeout(200);

    // The Next button should be clickable
    const nextBtn = page.locator('button.formspec-wizard-next').first();
    await expect(nextBtn).toBeEnabled();
    await expect(nextBtn).toBeVisible();

    // Click should work — navigate to Project Phases
    await nextBtn.click({ timeout: 5000 });
    await page.waitForTimeout(100);

    const heading = await page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first().textContent();
    expect(heading?.trim()).toBe('Project Phases');
  });
});

test.describe('Grant App UX: Popup anchoring near triggers', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('popover should open adjacent to its trigger button', async ({ page }) => {
    await goToPage(page, 'Budget');
    const trigger = page.locator('.formspec-popover-trigger', { hasText: 'Budget Checklist' });
    await trigger.click();
    await page.waitForTimeout(100);

    const geometry = await page.evaluate(() => {
      const triggerEl = Array.from(document.querySelectorAll('.formspec-popover-trigger'))
        .find((el) => el.textContent?.trim() === 'Budget Checklist') as HTMLElement | undefined;
      const popoverEl = document.querySelector('.formspec-popover-content[data-placement="top"]:popover-open') as HTMLElement | null;
      if (!triggerEl || !popoverEl) return null;
      const triggerRect = triggerEl.getBoundingClientRect();
      const popRect = popoverEl.getBoundingClientRect();
      return {
        triggerTop: triggerRect.top,
        triggerCenterX: triggerRect.left + (triggerRect.width / 2),
        popBottom: popRect.bottom,
        popCenterX: popRect.left + (popRect.width / 2),
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.popBottom).toBeLessThanOrEqual(geometry!.triggerTop + 12);
    expect(Math.abs(geometry!.popCenterX - geometry!.triggerCenterX)).toBeLessThanOrEqual(220);
  });

  test('modal should open near its trigger button', async ({ page }) => {
    await goToPage(page, 'Subcontractors');
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(150);

    const trigger = page.locator('.formspec-modal-trigger', { hasText: 'View Certification Requirements' });
    await trigger.click();
    await page.waitForTimeout(100);

    const geometry = await page.evaluate(() => {
      const triggerEl = Array.from(document.querySelectorAll('.formspec-modal-trigger'))
        .find((el) => el.textContent?.trim() === 'View Certification Requirements') as HTMLElement | undefined;
      const dialogEl = Array.from(document.querySelectorAll('dialog.formspec-modal[open]'))
        .find((el) => el.querySelector('.formspec-modal-title')?.textContent?.trim() === 'Subcontractor Certification Requirements') as HTMLElement | undefined;
      if (!triggerEl || !dialogEl) return null;
      const triggerRect = triggerEl.getBoundingClientRect();
      const dialogRect = dialogEl.getBoundingClientRect();
      return {
        triggerBottom: triggerRect.bottom,
        triggerCenterX: triggerRect.left + (triggerRect.width / 2),
        dialogTop: dialogRect.top,
        dialogCenterX: dialogRect.left + (dialogRect.width / 2),
      };
    });

    expect(geometry).not.toBeNull();
    expect(Math.abs(geometry!.dialogTop - geometry!.triggerBottom)).toBeLessThanOrEqual(220);
    expect(Math.abs(geometry!.dialogCenterX - geometry!.triggerCenterX)).toBeLessThanOrEqual(240);
  });
});
