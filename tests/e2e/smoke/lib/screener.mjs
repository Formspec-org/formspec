/**
 * Screener detection and fill helpers for smoke tests.
 *
 * A screener is the gating component rendered by `.formspec-screener` before
 * the main wizard is shown. Each form defines its own screener fields; callers
 * pass a `values` map describing what to fill.
 */

/**
 * Detect whether a screener is currently visible.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
export async function detectScreener(page) {
  const screener = page.locator('.formspec-screener');
  return screener.isVisible().catch(() => false);
}

/**
 * Fill a screener and click its Continue button.
 *
 * `values` is a plain object mapping field type/index to values. The supported
 * keys match the patterns found in the reference forms:
 *
 *   { select: 'nonprofit', checkbox: false, text: '150000' }
 *   { radio: 'preventive', number: '2' }
 *
 * After filling, clicks `.formspec-screener-continue` (or the first button
 * with text "Continue") and waits for `.formspec-wizard-panel` to appear.
 *
 * @param {import('playwright').Page} page
 * @param {object} values
 * @param {string} [values.select]    - Value for the first <select> in the screener
 * @param {boolean} [values.checkbox] - Desired checked state for the first checkbox
 * @param {string} [values.text]      - Value for the first text input
 * @param {string} [values.radio]     - Value attribute of the radio to check (or 'index:N')
 * @param {string} [values.number]    - Value for the first number input
 * @returns {Promise<boolean>} true if screener was found and Continue was clicked
 */
export async function fillScreener(page, values = {}) {
  const screener = page.locator('.formspec-screener');
  const isVisible = await screener.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('[screener] No screener visible.');
    return false;
  }

  console.log('[screener] Screener is visible. Filling...');

  if (values.select !== undefined) {
    const sel = screener.locator('select').first();
    if (await sel.count() > 0) {
      await sel.selectOption(values.select);
      console.log(`[screener] select = "${values.select}"`);
    }
  }

  if (values.checkbox !== undefined) {
    const cb = screener.locator('input[type="checkbox"]').first();
    if (await cb.isVisible().catch(() => false)) {
      const checked = await cb.isChecked();
      if (values.checkbox && !checked) await cb.check();
      if (!values.checkbox && checked) await cb.uncheck();
      console.log(`[screener] checkbox = ${values.checkbox}`);
    }
  }

  if (values.text !== undefined) {
    const inp = screener.locator('input[type="text"]').first();
    if (await inp.isVisible().catch(() => false)) {
      await inp.fill(values.text);
      console.log(`[screener] text = "${values.text}"`);
    }
  }

  if (values.number !== undefined) {
    const inp = screener.locator('input[type="number"]').first();
    if (await inp.count() > 0) {
      await inp.fill(values.number);
      console.log(`[screener] number = "${values.number}"`);
    } else {
      // Fallback: try plain text inputs
      const textInputs = screener.locator('input[type="text"], input:not([type])');
      const count = await textInputs.count();
      if (count > 0) {
        await textInputs.first().fill(values.number);
        console.log(`[screener] number (via text fallback) = "${values.number}"`);
      }
    }
  }

  if (values.radio !== undefined) {
    if (values.radio.startsWith('index:')) {
      const idx = parseInt(values.radio.slice(6), 10);
      const radios = screener.locator('input[type="radio"]');
      if (await radios.count() > idx) {
        await radios.nth(idx).check();
        console.log(`[screener] radio index ${idx} checked`);
      }
    } else {
      const radio = screener.locator(`input[type="radio"][value="${values.radio}"]`);
      if (await radio.count() > 0) {
        await radio.check();
        console.log(`[screener] radio value="${values.radio}" checked`);
      } else {
        // Fallback: check index 2 (third option = "preventive" in clinical intake)
        const radios = screener.locator('input[type="radio"]');
        if (await radios.count() >= 3) {
          await radios.nth(2).check();
          console.log(`[screener] radio fallback index 2 checked`);
        }
      }
    }
  }

  await page.waitForTimeout(300);

  // Click Continue
  const continueBtn = page
    .locator('.formspec-screener-continue, button:has-text("Continue")')
    .first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    console.log('[screener] Clicked Continue.');
  } else {
    console.log('[screener] No Continue button found.');
    return false;
  }

  await page.waitForSelector('.formspec-wizard-panel', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(400);
  return true;
}

/**
 * Dismiss a screener by clicking Continue without filling anything.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
export async function dismissScreener(page) {
  return fillScreener(page, {});
}
