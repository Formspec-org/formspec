/**
 * Wizard navigation helpers for smoke tests.
 */

/**
 * Click the Next/Finish button on the current wizard page.
 *
 * @param {import('playwright').Page} page
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]  Pass force:true to click even when disabled
 * @returns {Promise<'clicked'|'disabled'|'no-button'>}
 */
export async function clickNext(page, opts = {}) {
  const { force = false } = opts;
  const nextBtn = page.locator('button.formspec-wizard-next').first();
  const isVisible = await nextBtn.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('[nav] No Next button visible.');
    return 'no-button';
  }
  const isEnabled = await nextBtn.isEnabled().catch(() => false);
  if (!isEnabled && !force) {
    const text = await nextBtn.textContent().catch(() => 'Next');
    console.log(`[nav] Next/Finish button ("${text?.trim()}") is disabled.`);
    return 'disabled';
  }
  await nextBtn.click({ force });
  await page.waitForTimeout(400);
  return 'clicked';
}

/**
 * Click the Previous button on the current wizard page.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<'clicked'|'no-button'>}
 */
export async function clickPrev(page) {
  const prevBtn = page.locator('button.formspec-wizard-prev').first();
  const isVisible = await prevBtn.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('[nav] No Prev button visible.');
    return 'no-button';
  }
  await prevBtn.click();
  await page.waitForTimeout(400);
  return 'clicked';
}

/**
 * Get the heading text from the active (visible) wizard panel.
 * Falls back to any visible h2 in the form area.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
export async function getCurrentPageHeading(page) {
  const heading = await page.evaluate(() => {
    const activePanel = document.querySelector('.formspec-wizard-panel:not(.formspec-hidden)');
    if (activePanel) {
      const h2 = activePanel.querySelector('h2');
      if (h2) return h2.textContent.trim();
    }
    const h2s = document.querySelectorAll('.form-container h2');
    for (const h of h2s) {
      const cs = window.getComputedStyle(h);
      if (cs.display !== 'none' && cs.visibility !== 'hidden') {
        return h.textContent.trim();
      }
    }
    return '(unknown)';
  });
  return heading || '(unknown)';
}

/**
 * Return metadata about all wizard panels in the DOM.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ heading: string, hidden: boolean, inputCount: number }>>}
 */
export async function getAllPages(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.formspec-wizard-panel')).map(panel => ({
      heading: panel.querySelector('h2')?.textContent?.trim() || '?',
      hidden: panel.classList.contains('formspec-hidden'),
      inputCount: panel.querySelectorAll('input, textarea, select').length,
    }));
  });
}
