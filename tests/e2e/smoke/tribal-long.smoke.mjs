/**
 * Smoke test: Tribal Long (Annual Expenditure Report – Long Form)
 *
 * Exercises: wizard traversal (5+ pages), broad error selector scan
 * (class-substring + aria-invalid), disabled Finish detection, sidebar
 * fallback click if hash navigation fails, Submit (Client) click.
 *
 * Usage: node tests/e2e/smoke/tribal-long.smoke.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './lib/browser.mjs';
import { screenshot } from './lib/screenshots.mjs';
import { collectErrorElements } from './lib/errors.mjs';

const FORM_HASH = 'tribal-long';
const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';
const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(SMOKE_DIR, 'screenshots', 'tribal-long');

export default async function smoke() {
  console.log('=== Tribal Long Smoke Test ===');
  console.log(`Target: ${BASE_URL}/#${FORM_HASH}`);

  const { browser, page, consoleErrors } = await launchBrowser();
  const results = {
    form: 'tribal-long',
    pages: [],
    errors: {},
    consoleErrors: [],
    submitFound: false,
  };

  let ssIdx = 1;
  const ssName = (label) => `${String(ssIdx++).padStart(2, '0')}-${label}.png`;

  try {
    console.log(`\n[nav] Navigating to ${BASE_URL}/#${FORM_HASH}`);
    await page.goto(`${BASE_URL}/#${FORM_HASH}`, { waitUntil: 'networkidle' });

    console.log('[nav] Waiting for form to load...');
    await page.waitForSelector('.form-container', { timeout: 15000 }).catch(() =>
      console.log('[warn] .form-container not found')
    );

    // Sidebar fallback if hash navigation doesn't activate the correct form
    const sidebarLink = page.locator('[href="#tribal-long"], [data-form="tribal-long"]').first();
    if (await sidebarLink.isVisible().catch(() => false)) {
      console.log('[nav] Clicking sidebar link for tribal-long...');
      await sidebarLink.click();
      await page.waitForTimeout(1000);
    }

    // Wait for wizard panel or formspec-render
    const formLoaded = await Promise.race([
      page.waitForSelector('.formspec-wizard-panel', { timeout: 10000 }).then(() => 'wizard-panel'),
      page.waitForSelector('formspec-render', { timeout: 10000 }).then(() => 'formspec-render'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
    ]);
    console.log('[nav] Form load signal:', formLoaded);
    await page.waitForTimeout(1500);

    // Screenshot 1: initial state
    const pageTitle1 = await page.locator(
      '.formspec-wizard-panel h1, .formspec-wizard-panel h2, .formspec-page-title, .formspec-wizard-panel .formspec-group-label'
    ).first().textContent().catch(() => '');
    console.log('[nav] Initial page title:', pageTitle1.trim());

    const panelCount = await page.locator('.formspec-wizard-panel').count();
    console.log(`[nav] Visible wizard panels: ${panelCount}`);

    await screenshot(page, SS_DIR, ssName('initial'), 'Initial state');

    results.pages.push(pageTitle1.trim() || 'Page 1 (initial)');

    // Click Next (or force if disabled) to trigger validation
    const enabledNext = page.locator('.formspec-wizard-next:not([disabled])').first();
    const nextVisible = await enabledNext.isVisible().catch(() => false);

    if (nextVisible) {
      console.log('[test] Clicking Next (without filling fields) to trigger validation...');
      await enabledNext.click();
      await page.waitForTimeout(800);
    } else {
      const anyNext = page.locator('.formspec-wizard-next').first();
      if (await anyNext.isVisible().catch(() => false)) {
        console.log('[test] Next button is disabled — trying force click to trigger validation...');
        await anyNext.click({ force: true }).catch(() => {});
        await page.waitForTimeout(800);
      }
    }

    await screenshot(page, SS_DIR, ssName('validation'), 'Validation state');

    // Collect broader error summary
    const validationSummary = await collectErrorElements(page);
    results.errors = validationSummary;
    console.log('[validation] Validation elements found:', JSON.stringify(validationSummary, null, 2));

    // Navigate through all pages
    let pageNum = 3;
    let totalPages = 1;
    let stuckCount = 0;
    const MAX_STUCK = 3;

    while (pageNum <= 40) {
      const enabledNextBtn = page.locator('.formspec-wizard-next:not([disabled])');
      const isEnabledNextVisible = await enabledNextBtn.first().isVisible().catch(() => false);

      const submitBtn = page.locator('#action-submit').first();
      const isSubmitVisible = await submitBtn.isVisible().catch(() => false);

      const anyNext = page.locator('.formspec-wizard-next').first();
      const anyNextVisible = await anyNext.isVisible().catch(() => false);
      const anyNextDisabled = anyNextVisible
        ? await anyNext.getAttribute('disabled').catch(() => null)
        : null;
      const anyNextText = anyNextVisible ? await anyNext.textContent().catch(() => '') : '';

      console.log(`\n[nav] Loop ${pageNum}: enabledNext=${isEnabledNextVisible}, submit=${isSubmitVisible}, anyNextText="${anyNextText.trim()}", disabled=${anyNextDisabled !== null}`);

      if (!anyNextVisible && !isSubmitVisible) {
        console.log('[nav] No navigation buttons found, stopping.');
        break;
      }

      // If submit is visible, screenshot + click it
      if (isSubmitVisible && !isEnabledNextVisible) {
        const currentTitle = await page.locator(
          '.formspec-wizard-panel h1, .formspec-wizard-panel h2, .formspec-group-label'
        ).first().textContent().catch(() => '');
        console.log(`[nav] Last page title: "${currentTitle.trim()}"`);

        results.pages.push(`Last page (before submit): ${currentTitle.trim()}`);
        await screenshot(page, SS_DIR, ssName('last-page'), `Last page: ${currentTitle.trim()}`);

        console.log('[submit] Clicking Submit...');
        results.submitFound = true;
        await submitBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, SS_DIR, ssName('after-submit'), 'After submit');
        results.pages.push('After submit');
        pageNum += 2;
        break;
      }

      // If disabled Finish, stop navigation
      if (anyNextVisible && anyNextDisabled !== null && !isSubmitVisible) {
        const currentTitle = await page.locator(
          '.formspec-wizard-panel h1, .formspec-wizard-panel h2, .formspec-group-label'
        ).first().textContent().catch(() => '');
        console.log(`[nav] Last page (disabled Finish): "${currentTitle.trim()}"`);

        results.pages.push(`Last page (Finish disabled): ${currentTitle.trim()}`);
        await screenshot(page, SS_DIR, ssName('last-page'), `Last page (Finish disabled): ${currentTitle.trim()}`);
        pageNum++;
        break;
      }

      // Click enabled Next
      if (isEnabledNextVisible) {
        const currentTitle = await page.locator(
          '.formspec-wizard-panel h1, .formspec-wizard-panel h2, .formspec-group-label'
        ).first().textContent().catch(() => '');
        console.log(`[nav] Page ${pageNum - 1} title: "${currentTitle.trim()}"`);

        await enabledNextBtn.first().click();
        await page.waitForTimeout(600);

        results.pages.push(currentTitle.trim() || `Page ${pageNum - 1}`);
        await screenshot(page, SS_DIR, ssName(`page${pageNum - 1}`), `Page ${pageNum - 1}`);

        pageNum++;
        totalPages++;
        stuckCount = 0;
      } else {
        stuckCount++;
        if (stuckCount >= MAX_STUCK) {
          console.log(`[nav] Stuck for ${stuckCount} iterations, giving up.`);
          break;
        }
        await page.waitForTimeout(500);
      }
    }

    // Final screenshot
    await screenshot(page, SS_DIR, ssName('final'), 'Final state');

  } catch (err) {
    console.error('[FATAL]', err.message);
    try { await screenshot(page, SS_DIR, ssName('error'), 'Error state'); } catch {}
    throw err;
  } finally {
    results.consoleErrors = [...consoleErrors];
    await browser.close();
  }

  // Summary
  console.log('\n========================================');
  console.log('TRIBAL LONG SMOKE TEST SUMMARY');
  console.log('========================================');
  console.log(`Total pages visited: ${results.pages.length}`);
  results.pages.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  console.log('\nValidation elements breakdown:');
  for (const [sel, info] of Object.entries(results.errors)) {
    console.log(`  ${sel}: ${info.count} elements`);
    if (info.texts?.length > 0) {
      info.texts.forEach(t => console.log(`    - "${t}"`));
    }
  }
  console.log(`\nBrowser console errors (${results.consoleErrors.length}):`);
  if (results.consoleErrors.length === 0) {
    console.log('  (none)');
  } else {
    results.consoleErrors.forEach(e => console.log(' ', e));
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
