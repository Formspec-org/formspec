/**
 * Smoke test: Clinical Intake
 *
 * Exercises: screener fill (select radio + number input), Continue → wizard
 * transition, page traversal, pre-submit screenshot, structured summary JSON
 * output, and console error capture (expects FEL let...in parse errors and
 * date("") errors from known issues A1/A2).
 *
 * Usage: node tests/e2e/smoke/clinical-intake.smoke.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import { launchBrowser } from './lib/browser.mjs';
import { screenshot } from './lib/screenshots.mjs';
import { fillScreener } from './lib/screener.mjs';

const FORM_HASH = 'clinical-intake';
const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';
const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(SMOKE_DIR, 'screenshots', 'clinical-intake');

export default async function smoke() {
  console.log('=== Clinical Intake Smoke Test ===');
  console.log(`Target: ${BASE_URL}/#${FORM_HASH}`);

  const { browser, page, consoleErrors } = await launchBrowser();

  const summary = {
    form: 'clinical-intake',
    totalPages: 0,
    screenerFound: false,
    screenerFields: [],
    validationErrors: [],
    consoleErrors: [],
    pagesVisited: [],
    submitFound: false,
    submitClicked: false,
  };

  let ssIdx = 1;
  const ssName = (label) => `${String(ssIdx++).padStart(2, '0')}-${label}.png`;

  try {
    console.log(`\n[nav] Navigating to ${BASE_URL}/#${FORM_HASH}`);
    await page.goto(`${BASE_URL}/#${FORM_HASH}`);

    // Wait for .form-container; try sidebar click as fallback
    try {
      await page.waitForSelector('.form-container', { timeout: 10000 });
      console.log('[nav] .form-container appeared');
    } catch (e) {
      console.error('[nav] Timed out waiting for .form-container — trying sidebar click');
      await page.click('[data-id="clinical-intake"]').catch(() => {});
      await page.waitForSelector('.form-container', { timeout: 10000 });
    }

    await page.waitForTimeout(1500);
    await screenshot(page, SS_DIR, ssName('initial'), 'Initial state', { fullPage: true });

    // Detect and fill screener
    const screenerVisible = await page.isVisible('.formspec-screener');
    summary.screenerFound = screenerVisible;
    console.log('[screener] Screener visible:', screenerVisible);

    if (screenerVisible) {
      await screenshot(page, SS_DIR, ssName('screener'), 'Screener visible', { fullPage: true });

      // Inspect screener fields
      const screenerFieldLabels = await page.$$eval(
        '.formspec-screener .formspec-label, .formspec-screener label',
        (els) => els.map(el => el.textContent?.trim()).filter(Boolean)
      );
      summary.screenerFields = screenerFieldLabels;
      console.log('[screener] Screener fields found:', screenerFieldLabels);

      // Fill: chief complaint = "preventive", pain level = "2"
      // fillScreener handles the radio/number fill pattern
      await fillScreener(page, { radio: 'preventive', number: '2' });

      await screenshot(page, SS_DIR, ssName('screener-filled'), 'Screener filled', { fullPage: true });
    }

    await screenshot(page, SS_DIR, ssName('form'), 'Main form after screener', { fullPage: true });

    // Wizard navigation
    const hasWizard = await page.isVisible('.formspec-wizard-next');
    console.log('[nav] Wizard next button visible:', hasWizard);

    let pageIndex = 1;
    summary.pagesVisited.push('Page 1 (initial)');

    if (hasWizard) {
      // Click Next WITHOUT filling any fields to test validation behavior
      const nextBtn = await page.$('.formspec-wizard-next');
      if (nextBtn) {
        const isDisabled = await nextBtn.isDisabled();
        console.log('[nav] Next button disabled:', isDisabled);
        if (!isDisabled) {
          await nextBtn.click();
          console.log('[nav] Clicked Next (empty fields — testing validation)');
          await page.waitForTimeout(600);
        }
      }

      await screenshot(page, SS_DIR, ssName('validation'), 'Validation state', { fullPage: true });

      // Collect validation errors
      const errorEls = await page.$$eval(
        '.formspec-error',
        els => els
          .filter(el => el.textContent?.trim())
          .map(el => el.textContent?.trim())
      );
      summary.validationErrors = errorEls;
      if (errorEls.length > 0) {
        console.log('[validation] Validation errors visible:', errorEls);
      } else {
        console.log('[validation] No validation errors visible after clicking Next empty');
      }

      // Navigate through all pages
      let maxPages = 20;
      let continueNav = true;

      while (continueNav && maxPages-- > 0) {
        const nextButton = await page.$('.formspec-wizard-next');
        if (!nextButton) {
          console.log('[nav] No Next button found — likely on last page');
          break;
        }

        const isDisabled = await nextButton.isDisabled();
        if (isDisabled) {
          console.log('[nav] Next button is disabled on page', pageIndex);
          break;
        }

        const pageTitle = await page.$eval(
          '.formspec-page h2, .formspec-page-title',
          el => el?.textContent?.trim()
        ).catch(() => `Page ${pageIndex + 1}`);

        await nextButton.click();
        await page.waitForTimeout(600);

        pageIndex++;
        summary.totalPages++;
        summary.pagesVisited.push(pageTitle || `Page ${pageIndex}`);
        console.log(`[nav] Navigated to page ${pageIndex}: "${pageTitle}"`);

        await screenshot(page, SS_DIR, ssName(`page${pageIndex}`), `Page ${pageIndex}: ${pageTitle}`, { fullPage: true });

        const submitVisible = await page.isVisible('#action-submit, .formspec-submit, button[id="action-submit"]');
        if (submitVisible) {
          console.log('[nav] Submit button area visible');
        }

        const nextAfter = await page.$('.formspec-wizard-next');
        if (!nextAfter) {
          console.log('[nav] No more Next button — reached last page');
          continueNav = false;
        }
      }

      summary.totalPages = summary.pagesVisited.length;
    } else {
      console.log('[nav] No wizard detected — form may be single page');
      summary.totalPages = 1;
      summary.pagesVisited.push('Single page form');
    }

    // Submit (Client)
    const submitBtn = await page.$('#action-submit');
    if (submitBtn) {
      summary.submitFound = true;
      const isBtnDisabled = await submitBtn.isDisabled();
      console.log('[submit] Submit (Client) button found, disabled:', isBtnDisabled);

      await screenshot(page, SS_DIR, ssName('pre-submit'), 'Pre-submit', { fullPage: true });

      await submitBtn.click();
      console.log('[submit] Clicked Submit (Client)');
      summary.submitClicked = true;
      await page.waitForTimeout(1000);

      await screenshot(page, SS_DIR, ssName('final-submit'), 'Final submit', { fullPage: true });
    } else {
      console.log('[submit] No #action-submit button found in DOM');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await screenshot(page, SS_DIR, ssName('bottom'), 'Bottom of page', { fullPage: true });
    }

  } catch (err) {
    console.error('[FATAL]', err.message);
    try { await screenshot(page, SS_DIR, ssName('error'), 'Error state', { fullPage: true }); } catch {}
    throw err;
  } finally {
    summary.consoleErrors = [...consoleErrors];
    await browser.close();
  }

  // Save summary JSON to screenshots dir
  const summaryPath = path.join(SS_DIR, 'summary.json');
  try {
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('[summary] Saved to', summaryPath);
  } catch (_) {}

  // Print summary
  console.log('\n========================================');
  console.log('CLINICAL INTAKE SMOKE TEST SUMMARY');
  console.log('========================================');
  console.log(`Total pages visited: ${summary.totalPages}`);
  console.log(`Pages: ${summary.pagesVisited.join(', ')}`);
  console.log(`Screener found:      ${summary.screenerFound}`);
  if (summary.screenerFields.length) {
    console.log(`Screener fields:     ${summary.screenerFields.join(', ')}`);
  }
  console.log(`Validation errors after empty Next: ${summary.validationErrors.length > 0 ? summary.validationErrors : 'none'}`);
  console.log(`Submit button found: ${summary.submitFound}`);
  console.log(`Submit clicked:      ${summary.submitClicked}`);
  if (summary.consoleErrors.length > 0) {
    console.log(`\nConsole ERRORS: ${summary.consoleErrors.length}`);
    summary.consoleErrors.forEach(e => console.log('  ERROR:', e));
  } else {
    console.log('Console errors: none');
  }
  console.log(`Screenshots saved to: ${SS_DIR}`);
  console.log('========================================\n');

  return summary;
}

// Run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  smoke().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
