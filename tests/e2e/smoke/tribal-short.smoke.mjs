/**
 * Smoke test: Tribal Short (Annual Expenditure Report – Short Form)
 *
 * Exercises: wizard traversal (3 pages), force-click on disabled Finish,
 * empty `.formspec-error` container detection via innerText/textContent
 * fallback, Submit (Client) click, and validation report output.
 *
 * Usage: node tests/e2e/smoke/tribal-short.smoke.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './lib/browser.mjs';
import { screenshot } from './lib/screenshots.mjs';
import { clickNext } from './lib/wizard-nav.mjs';
import { collectFormspecErrors } from './lib/errors.mjs';

const FORM_HASH = 'tribal-short';
const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';
const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(SMOKE_DIR, 'screenshots', 'tribal-short');

export default async function smoke() {
  console.log('=== Tribal Short Smoke Test ===');
  console.log(`Target: ${BASE_URL}/#${FORM_HASH}`);

  const { browser, page, consoleErrors } = await launchBrowser();
  const results = {
    form: 'tribal-short',
    pages: [],
    errors: [],
    consoleErrors: [],
    submitFound: false,
  };

  let ssIdx = 1;
  const ssName = (label) => `${String(ssIdx++).padStart(2, '0')}-${label}.png`;

  try {
    console.log(`\n[nav] Navigating to ${BASE_URL}/#${FORM_HASH}`);
    await page.goto(`${BASE_URL}/#${FORM_HASH}`, { waitUntil: 'networkidle' });

    console.log('[nav] Waiting for form to render...');
    await page.waitForSelector('.form-container', { timeout: 15000 }).catch(e =>
      console.log('[warn] Timeout waiting for .form-container:', e.message)
    );
    await page.waitForSelector('.formspec-wizard-panel, formspec-render, .formspec-field', {
      timeout: 15000,
    }).catch(e => console.log('[warn] Timeout waiting for form elements:', e.message));
    await page.waitForTimeout(1000);

    await screenshot(page, SS_DIR, ssName('initial'), 'Initial state');

    // Click Next WITHOUT filling any fields (force-click to test validation feedback)
    const nextBtnInitial = page.locator('.formspec-wizard-next').first();
    const hasNext = await nextBtnInitial.isVisible().catch(() => false);

    if (hasNext) {
      console.log('[test] Clicking Next without filling fields (force)...');
      await nextBtnInitial.click({ force: true });
      await page.waitForTimeout(600);

      await screenshot(page, SS_DIR, ssName('validation'), 'Validation state');

      const errs = await collectFormspecErrors(page, 'After blank Next click');
      results.errors.push(...errs);
    } else {
      console.log('[nav] No Next button visible on initial page.');
      await screenshot(page, SS_DIR, ssName('validation'), 'Validation state (no next)');
    }

    // Walk through all pages
    let totalPages = 1;
    results.pages.push('Page 1 (initial)');

    while (true) {
      const nextLocator = page.locator('.formspec-wizard-next').first();
      const exists = await nextLocator.count() > 0;
      if (!exists) break;

      const isVisible = await nextLocator.isVisible().catch(() => false);
      if (!isVisible) break;

      const isDisabled = await nextLocator.isDisabled().catch(() => false);
      const btnText = await nextLocator.textContent().catch(() => '');
      const isFinish = btnText?.toLowerCase().includes('finish');

      console.log(`[nav] Page ${totalPages}: Next="${btnText?.trim()}", disabled=${isDisabled}`);

      if (isDisabled && isFinish) {
        console.log('  Next/Finish is disabled — taking screenshot and stopping navigation.');
        await screenshot(page, SS_DIR, ssName(`page${totalPages + 1}-disabled`), `Page ${totalPages + 1} (disabled finish)`);
        const errs = await collectFormspecErrors(page, `Page ${totalPages + 1} (disabled finish)`);
        results.errors.push(...errs);
        break;
      }

      if (isDisabled) {
        console.log('  Button is disabled — stopping.');
        break;
      }

      console.log(`  Clicking Next/Finish to go to page ${totalPages + 1}...`);
      await nextLocator.click();
      await page.waitForTimeout(700);

      totalPages++;
      const pageLabel = `Page ${totalPages}`;
      results.pages.push(pageLabel);
      await screenshot(page, SS_DIR, ssName(`page${totalPages}`), pageLabel);

      const errs = await collectFormspecErrors(page, pageLabel);
      results.errors.push(...errs);

      if (isFinish) {
        console.log('  Reached Finish page, stopping navigation loop.');
        break;
      }

      if (totalPages > 20) {
        console.warn('[nav] Reached page limit of 20, stopping.');
        break;
      }
    }

    // Try Submit button
    const submitBtn = page.locator('#action-submit').first();
    const submitVisible = await submitBtn.isVisible().catch(() => false);
    if (submitVisible) {
      results.submitFound = true;
      console.log('[submit] Submit button (#action-submit) found — clicking...');
      await submitBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, SS_DIR, ssName('submitted'), 'Post-submit');
      const errs = await collectFormspecErrors(page, 'Post-submit');
      results.errors.push(...errs);
    } else {
      console.log('[submit] No #action-submit button visible on final page.');
    }

  } catch (err) {
    console.error('[FATAL]', err.message);
    try { await screenshot(page, SS_DIR, `${String(ssIdx).padStart(2, '0')}-error.png`, 'Error state'); } catch {}
    throw err;
  } finally {
    results.consoleErrors = [...consoleErrors];
    await browser.close();
  }

  // Summary
  const uniqueErrors = [...new Set(results.errors)];
  console.log('\n========================================');
  console.log('TRIBAL SHORT SMOKE TEST SUMMARY');
  console.log('========================================');
  console.log(`Total pages visited:  ${results.pages.length}`);
  console.log(`Unique error messages: ${uniqueErrors.length}`);
  if (uniqueErrors.length > 0) {
    uniqueErrors.forEach(e => console.log('  -', e));
  } else {
    console.log('  (none with extractable text)');
  }
  console.log(`Browser console errors: ${results.consoleErrors.length}`);
  if (results.consoleErrors.length > 0) {
    results.consoleErrors.slice(0, 10).forEach(e => console.log('  ', e));
  }
  console.log(`Screenshots saved to: ${SS_DIR}`);
  console.log('========================================\n');

  return results;
}

// Run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  smoke().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
