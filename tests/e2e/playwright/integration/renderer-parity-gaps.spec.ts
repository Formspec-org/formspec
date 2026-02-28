import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
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

  test('DatePicker.showTime field accepts datetime value', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    await engineSetValue(page, 'projectNarrative.submissionDeadline', '2026-12-31T23:59:00');
    await page.waitForTimeout(50);
    const val = await engineValue(page, 'projectNarrative.submissionDeadline');
    expect(val).toBe('2026-12-31T23:59:00');
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

  // ── Modal.trigger: "auto" with when ──────────────────────────────

  test('Modal with trigger:auto does not open when when-condition is false', async ({ page }) => {
    await goToPage(page, 'Subcontractors');
    await page.waitForTimeout(100);

    // usesSubcontractors is false by default, so the auto-modal should not be open
    const dialogOpen = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('dialog.formspec-modal');
      for (const d of dialogs) {
        if ((d as HTMLDialogElement).open) return true;
      }
      return false;
    });
    expect(dialogOpen).toBe(false);
  });

  test('Modal with trigger:auto opens when when-condition becomes true', async ({ page }) => {
    await goToPage(page, 'Subcontractors');
    await page.waitForTimeout(100);

    // Enable subcontractors to trigger the auto-modal
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(200);

    const dialogOpen = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('dialog.formspec-modal');
      for (const d of dialogs) {
        if ((d as HTMLDialogElement).open) return true;
      }
      return false;
    });
    expect(dialogOpen).toBe(true);

    // Verify it's the compliance notice
    const title = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('dialog.formspec-modal');
      for (const d of dialogs) {
        if ((d as HTMLDialogElement).open) {
          return d.querySelector('.formspec-modal-title')?.textContent;
        }
      }
      return null;
    });
    expect(title).toBe('Automatic Compliance Notice');
  });

  // ── Popover.triggerBind ──────────────────────────────────────────

  test('Popover triggerBind falls back to triggerLabel when field is empty', async ({ page }) => {
    await goToPage(page, 'Budget');
    await page.waitForTimeout(100);

    // The 4th popover has triggerBind; without a value, it shows the fallback triggerLabel
    const triggerText = await page.evaluate(() => {
      const popovers = document.querySelectorAll('.formspec-popover');
      // The triggerBind popover has placement=left
      for (const p of popovers) {
        const content = p.querySelector('.formspec-popover-content');
        if (content && (content as HTMLElement).dataset.placement === 'left') {
          return p.querySelector('.formspec-popover-trigger')?.textContent;
        }
      }
      return null;
    });
    expect(triggerText).toBe('Line Item Details');
  });

  test('Popover triggerBind shows field value as trigger text', async ({ page }) => {
    await goToPage(page, 'Budget');

    // Set a line item description that the Popover triggerBind reads
    await engineSetValue(page, 'budget.lineItems[0].description', 'Office supplies');
    await page.waitForTimeout(100);

    // The triggerBind popover (placement=left) should now show the field value
    const triggerText = await page.evaluate(() => {
      const popovers = document.querySelectorAll('.formspec-popover');
      for (const p of popovers) {
        const content = p.querySelector('.formspec-popover-content');
        if (content && (content as HTMLElement).dataset.placement === 'left') {
          return p.querySelector('.formspec-popover-trigger')?.textContent;
        }
      }
      return null;
    });
    expect(triggerText).toBe('Office supplies');
  });

  // ── Grid.columns as string ──────────────────────────────────────

  test('Grid with string columns sets CSS grid-template-columns', async ({ page }) => {
    await goToPage(page, 'Budget');

    // The budget summary Grid uses columns: "1fr 2fr 1fr"
    const gridStyle = await page.evaluate(() => {
      const grids = document.querySelectorAll('.formspec-grid');
      for (const g of grids) {
        const el = g as HTMLElement;
        if (el.style.gridTemplateColumns) return el.style.gridTemplateColumns;
      }
      return null;
    });
    expect(gridStyle).toBe('1fr 2fr 1fr');
  });

  test('Grid with numeric columns uses data-columns attribute', async ({ page }) => {
    await goToPage(page, 'Project Narrative');

    // Check that a numeric-column Grid uses the data-columns attribute
    const dataColumns = await page.evaluate(() => {
      const grids = document.querySelectorAll('.formspec-grid');
      for (const g of grids) {
        const el = g as HTMLElement;
        if (el.dataset.columns) return el.dataset.columns;
      }
      return null;
    });
    expect(dataColumns).toBeTruthy();
    expect(Number(dataColumns)).toBeGreaterThanOrEqual(1);
  });

  // ── Stack.direction: "horizontal" ────────────────────────────────

  test('Stack with direction horizontal applies horizontal class', async ({ page }) => {
    await goToPage(page, 'Applicant Info');

    const hasHorizontalStack = await page.evaluate(() => {
      return document.querySelector('.formspec-stack--horizontal') !== null;
    });
    expect(hasHorizontalStack).toBe(true);
  });

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
