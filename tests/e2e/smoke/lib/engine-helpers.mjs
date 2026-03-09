/**
 * Helpers for interacting with the FormEngine via page.evaluate.
 * These mirror the patterns used in tmp-smoke-tests and the Playwright test helpers.
 */

/**
 * Set a field value via the engine API.
 *
 * @param {import('playwright').Page} page
 * @param {string} fieldPath  - e.g. "applicantInfo.orgName" or "lineItems[0].quantity"
 * @param {*} value
 * @returns {Promise<boolean>} true if engine was found and setValue called
 */
export async function engineSetValue(page, fieldPath, value) {
  return page.evaluate(({ p, v }) => {
    const el = document.querySelector('formspec-render');
    if (!el || !el.getEngine) return false;
    el.getEngine().setValue(p, v);
    return true;
  }, { p: fieldPath, v: value });
}

/**
 * Get a field value from the engine.
 *
 * @param {import('playwright').Page} page
 * @param {string} fieldPath
 * @returns {Promise<*>}
 */
export async function engineValue(page, fieldPath) {
  return page.evaluate((p) => {
    const el = document.querySelector('formspec-render');
    if (!el || !el.getEngine) return undefined;
    return el.getEngine().getValue(p);
  }, fieldPath);
}

/**
 * Get the engine's validation report.
 *
 * @param {import('playwright').Page} page
 * @param {'submit'|'change'|'blur'} [mode='submit']
 * @returns {Promise<object|null>}
 */
export async function getValidationReport(page, mode = 'submit') {
  return page.evaluate((m) => {
    const el = document.querySelector('formspec-render');
    if (!el || !el.getEngine) return null;
    return el.getEngine().getValidationReport({ mode: m });
  }, mode);
}
