import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  goToPage,
} from '../helpers/grant-app';

test.describe('Phase 3F: Renderer/Engine Parity Gaps', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── DatePicker.showTime ──────────────────────────────────────────

  test('DatePicker with showTime renders datetime-local input for dateTime field', async ({ page }) => {
    await goToPage(page, 'Project Narrative');

    // submissionDeadline is a dateTime field with showTime: true in component.json
    const input = page.locator('[data-name="projectNarrative.submissionDeadline"] input');
    const inputType = await input.getAttribute('type');
    expect(inputType).toBe('datetime-local');
  });

  // ── ProgressBar.bind ─────────────────────────────────────────────

  test('ProgressBar with bind reactively updates from field signal', async ({ page }) => {
    await goToPage(page, 'Project Narrative');

    // Set selfAssessment (bound to ProgressBar with max=5)
    await engineSetValue(page, 'projectNarrative.selfAssessment', 3);
    await page.waitForTimeout(50);

    const progressValue = await page.evaluate(() => {
      const progress = document.querySelector('.formspec-progress-bar progress') as HTMLProgressElement | null;
      return progress?.value;
    });
    expect(progressValue).toBe(3);
  });

  test('ProgressBar label is applied as aria-label', async ({ page }) => {
    await goToPage(page, 'Project Narrative');

    const ariaLabel = await page.evaluate(() => {
      const progress = document.querySelector('.formspec-progress-bar progress') as HTMLProgressElement | null;
      return progress?.getAttribute('aria-label');
    });
    expect(ariaLabel).toBe('Proposal confidence');
  });

  test('ProgressBar showPercent displays percentage text', async ({ page }) => {
    await goToPage(page, 'Project Narrative');

    await engineSetValue(page, 'projectNarrative.selfAssessment', 4);
    await page.waitForTimeout(50);

    const percentText = await page.evaluate(() => {
      const span = document.querySelector('.formspec-progress-bar .formspec-progress-percent');
      return span?.textContent;
    });
    expect(percentText).toBe('80%');  // 4/5 = 80%
  });

  // ── Compliance Alert (replaces former auto-triggered modal) ──────

  test('Compliance alert is not visible when usesSubcontractors is false', async ({ page }) => {
    await goToPage(page, 'Subcontractors');
    await page.waitForTimeout(100);

    // usesSubcontractors is false by default, so the conditional group (and alert) should be hidden
    const alertVisible = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.formspec-alert--info');
      for (const a of alerts) {
        if (a.textContent?.includes('Compliance reminder') && a.offsetParent !== null) return true;
      }
      return false;
    });
    expect(alertVisible).toBe(false);
  });

  test('Compliance alert appears when usesSubcontractors becomes true', async ({ page }) => {
    await goToPage(page, 'Subcontractors');
    await page.waitForTimeout(100);

    // Enable subcontractors to show the compliance alert
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(200);

    const panel = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(panel.locator('.formspec-alert--info', { hasText: 'Compliance reminder' })).toBeVisible();
  });

  // ── Stack.direction: "horizontal" (CSS-dependent) ────────────────

  test('Stack horizontal renders as flex-direction row', async ({ page }) => {
    await goToPage(page, 'Applicant Info');

    const flexDir = await page.evaluate(() => {
      const el = document.querySelector('.formspec-stack--horizontal');
      if (!el) return null;
      return window.getComputedStyle(el).flexDirection;
    });
    expect(flexDir).toBe('row');
  });
});
