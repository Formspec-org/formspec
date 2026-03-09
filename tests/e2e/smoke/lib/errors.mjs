/**
 * Error detection helpers for smoke tests.
 */

/**
 * Collect all visible, non-empty error messages from the standard set of
 * error selectors used across the reference forms.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>} Deduplicated list of visible error text strings
 */
export async function getVisibleErrors(page) {
  return page.evaluate(() => {
    const selectors = [
      '.formspec-error',
      '.formspec-field-error',
      '[role="alert"]',
      '.usa-error-message',
    ];
    const seen = new Set();
    const results = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const t = el.textContent.trim();
        if (t && !seen.has(t)) {
          seen.add(t);
          results.push(t);
        }
      }
    }
    return results;
  });
}

/**
 * Collect error elements using a broader set of selectors (including class-
 * substring and aria-invalid). Returns an object keyed by selector with count
 * and sample texts — useful for diagnosing which selectors match in a form.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, { count: number, texts: string[] }>>}
 */
export async function collectErrorElements(page) {
  return page.evaluate(() => {
    const selectors = [
      '.formspec-error',
      '.formspec-field-error',
      '.formspec-validation-error',
      '[class*="error"]',
      '[aria-invalid="true"]',
      '.invalid-feedback',
      '.error-message',
    ];
    const found = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const texts = [...els].map(el => el.textContent?.trim()).filter(Boolean);
        found[sel] = { count: els.length, texts: texts.slice(0, 5) };
      }
    }
    return found;
  });
}

/**
 * Collect visible text from `.formspec-error` elements using innerText
 * (with fallback to textContent). Includes empty-element debug info.
 *
 * @param {import('playwright').Page} page
 * @param {string} label - Label to include in console output
 * @returns {Promise<string[]>}
 */
export async function collectFormspecErrors(page, label) {
  const results = [];
  const errorEls = page.locator('.formspec-error');
  const count = await errorEls.count();
  for (let i = 0; i < count; i++) {
    const el = errorEls.nth(i);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    let txt = '';
    try { txt = await el.innerText({ timeout: 500 }); } catch (_) {}
    if (!txt.trim()) {
      try { txt = await el.textContent({ timeout: 500 }); } catch (_) {}
    }
    if (!txt.trim()) {
      try {
        txt = '[empty — html: ' + (await el.innerHTML({ timeout: 500 })).slice(0, 120) + ']';
      } catch (_) {}
    }
    if (txt.trim()) results.push(txt.trim());
  }
  if (count > 0) {
    console.log(`  ${label}: ${count} .formspec-error elements found, ${results.length} with visible text`);
    results.forEach((e, i) => console.log(`    [${i}]: ${e}`));
  }
  return results;
}
