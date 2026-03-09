/**
 * Smoke test: Federal Grant Application
 *
 * Exercises: screener fill → dismiss, wizard traversal (up to 8+ pages),
 * engine setValue for all required fields, validation report on Review & Submit,
 * Submit (Client) tab switch, and console error capture (expects CORS errors
 * from priorYearData instance source).
 *
 * Usage: node tests/e2e/smoke/grant-application.smoke.mjs
 *        REFERENCES_URL=http://localhost:8082 node tests/e2e/smoke/run-all.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './lib/browser.mjs';
import { screenshot } from './lib/screenshots.mjs';
import { engineSetValue, getValidationReport } from './lib/engine-helpers.mjs';
import { clickNext, clickPrev, getCurrentPageHeading, getAllPages } from './lib/wizard-nav.mjs';
import { fillScreener } from './lib/screener.mjs';
import { getVisibleErrors } from './lib/errors.mjs';

const FORM_HASH = 'grant-application';
const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';
const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(SMOKE_DIR, 'screenshots', 'grant-application');

// ── Engine fill: set all required fields so wizard can reach the last page ───

async function fillFormViaEngine(page) {
  console.log('[fill] Setting required field values via engine API...');

  // Page 1: Applicant Info
  await engineSetValue(page, 'applicantInfo.orgName', 'Green Future Nonprofit Inc.');
  await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
  await engineSetValue(page, 'applicantInfo.orgType', 'nonprofit');
  await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
  await engineSetValue(page, 'applicantInfo.contactEmail', 'jane.smith@greenfuture.org');
  await engineSetValue(page, 'applicantInfo.contactPhone', '(202) 555-0100');
  await engineSetValue(page, 'applicantInfo.projectWebsite', 'https://greenfuture.org');
  console.log('  [engine] applicantInfo fields filled');

  // Page 2: Project Narrative
  await engineSetValue(page, 'projectNarrative.projectTitle', 'Community Health Initiative 2027');
  await engineSetValue(page, 'projectNarrative.abstract', 'This project aims to improve community health outcomes through targeted outreach and education programs across underserved neighborhoods. We will partner with local health clinics.');
  await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
  await engineSetValue(page, 'projectNarrative.endDate', '2028-12-31');
  await engineSetValue(page, 'projectNarrative.focusAreas', ['health', 'education']);
  console.log('  [engine] projectNarrative fields filled');

  // Page 3: Budget
  await engineSetValue(page, 'budget.requestedAmount', { amount: 150000, currency: 'USD' });
  await engineSetValue(page, 'budget.usesSubcontractors', false);
  console.log('  [engine] budget fields filled');

  // Page 4: Project Phases
  await engineSetValue(page, 'projectPhases.phaseName', 'Phase 1: Planning and Assessment');
  console.log('  [engine] projectPhases fields filled');

  await page.waitForTimeout(300);
}

// ── Main smoke function ───────────────────────────────────────────────────────

export default async function smoke() {
  console.log('=== Grant Application Smoke Test ===');
  console.log(`Target: ${BASE_URL}/#${FORM_HASH}`);

  const { browser, page, consoleErrors } = await launchBrowser();
  const results = {
    form: 'grant-application',
    pages: [],
    errors: [],
    consoleErrors: [],
    validationReport: null,
    submitFound: false,
  };

  let ssIdx = 1;
  const ssName = (label) => `${String(ssIdx++).padStart(2, '0')}-${label}.png`;

  try {
    // 1. Navigate
    console.log(`\n[nav] Navigating to ${BASE_URL}/#${FORM_HASH}`);
    await page.goto(`${BASE_URL}/#${FORM_HASH}`, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('li.active', { timeout: 8000 }).catch(() =>
      console.log('[warn] No active sidebar item found, continuing...')
    );

    await page.waitForSelector('.formspec-screener, .formspec-wizard-panel', {
      state: 'visible', timeout: 15000,
    });
    console.log('[nav] Form content loaded.');
    await screenshot(page, SS_DIR, ssName('initial'), 'Initial state (screener)');

    // 2. Fill and dismiss screener
    await fillScreener(page, { select: 'nonprofit', checkbox: false, text: '150000' });

    // 3. Log all wizard pages discovered
    const allWizardPages = await getAllPages(page);
    console.log('\n[info] Wizard pages discovered:');
    allWizardPages.forEach((p, i) =>
      console.log(`  [${i}] "${p.heading}" - hidden:${p.hidden} - inputs:${p.inputCount}`)
    );

    // 4. Screenshot page 1 and test empty-Next validation
    const page1Heading = await getCurrentPageHeading(page);
    results.pages.push(page1Heading);
    console.log(`\n[page 1] Heading: "${page1Heading}"`);
    await screenshot(page, SS_DIR, ssName('page1'), `Page 1 (${page1Heading})`);

    console.log('\n[test] Clicking Next without filling required fields...');
    await clickNext(page);
    await page.waitForTimeout(600);

    const headingAfterEmpty = await getCurrentPageHeading(page);
    const errorsAfterEmpty = await getVisibleErrors(page);
    await screenshot(page, SS_DIR, ssName('validation-empty'), `After empty Next (page: "${headingAfterEmpty}")`);

    if (errorsAfterEmpty.length > 0) {
      console.log('[validation] Validation errors triggered (good!):');
      errorsAfterEmpty.forEach(e => console.log('  -', e.slice(0, 100)));
      results.errors.push(...errorsAfterEmpty);
    } else if (headingAfterEmpty !== page1Heading) {
      console.log(`[validation] No errors shown — wizard advanced to "${headingAfterEmpty}" without validation.`);
      // Go back to page 1
      const backResult = await clickPrev(page);
      if (backResult === 'clicked') {
        console.log('[nav] Went back to page 1.');
      }
    } else {
      console.log('[validation] Stayed on same page — validation blocking (errors may use different selectors).');
    }

    // 5. Fill all required fields via engine
    await fillFormViaEngine(page);

    const vrAfterFill = await getValidationReport(page, 'submit');
    if (vrAfterFill) {
      console.log(`\n[validation] Post-fill: valid=${vrAfterFill.valid}, errors=${vrAfterFill.counts?.error || 0}, warnings=${vrAfterFill.counts?.warning || 0}`);
      results.validationReport = vrAfterFill;
    }

    await screenshot(page, SS_DIR, ssName('page1-filled'), 'Page 1 after filling fields');

    // 6. Navigate through all pages
    let onLastPage = false;
    for (let nav = 0; nav < 12; nav++) {
      const result = await clickNext(page);

      if (result === 'no-button') {
        console.log('[nav] Reached end (no Next button).');
        onLastPage = true;
        break;
      }

      if (result === 'disabled') {
        const currentErrors = await getVisibleErrors(page);
        console.log(`[nav] Next disabled. Visible errors: ${currentErrors.length}`);
        currentErrors.forEach(e => console.log('  error:', e.slice(0, 100)));
        results.errors.push(...currentErrors);

        const btnText = await page.locator('button.formspec-wizard-next').first().textContent().catch(() => '');
        if (btnText?.trim() === 'Finish') {
          console.log('[nav] On last page with Finish button disabled (validation errors prevent submit).');
          onLastPage = true;
        }
        break;
      }

      const heading = await getCurrentPageHeading(page);
      if (!results.pages.includes(heading)) results.pages.push(heading);
      console.log(`\n[page ${results.pages.length}] Heading: "${heading}"`);

      const pageErrors = await getVisibleErrors(page);
      if (pageErrors.length > 0) {
        console.log(`[validation] Errors visible on "${heading}":`);
        pageErrors.forEach(e => console.log('  -', e.slice(0, 100)));
        results.errors.push(...pageErrors);
      }

      await screenshot(page, SS_DIR, ssName(`page${results.pages.length}`), `Page ${results.pages.length} (${heading})`);

      const nextBtnText = await page.locator('button.formspec-wizard-next').first().textContent().catch(() => 'Next');
      if (nextBtnText?.trim() === 'Finish') {
        console.log('[nav] On last page (Finish button).');
        onLastPage = true;
        break;
      }
    }

    // 7. Submit (Client)
    console.log('\n[submit] Attempting Submit (Client)...');
    const submitBtn = page.locator('#action-submit, button:has-text("Submit (Client)")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      results.submitFound = true;
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, SS_DIR, ssName('after-submit'), 'After Submit (Client)');

      const clientPanel = page.locator('#client-response, #panel-client');
      if (await clientPanel.isVisible().catch(() => false)) {
        const validationPre = await page.locator('#client-validation-pre').textContent().catch(() => '');
        if (validationPre) {
          try {
            const vr = JSON.parse(validationPre);
            console.log(`[submit] Client submit validation: valid=${vr.valid}, errors=${vr.counts?.error || 0}, warnings=${vr.counts?.warning || 0}`);
          } catch {
            console.log('[submit] Could not parse validation report JSON');
          }
        }
      }
    } else {
      console.log('[submit] Submit (Client) button not found or not visible.');
    }

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
  console.log('GRANT APPLICATION SMOKE TEST SUMMARY');
  console.log('========================================');
  console.log(`Pages visited:             ${results.pages.length}`);
  console.log(`Pages: ${results.pages.join(' → ')}`);
  console.log(`On-screen errors detected: ${results.errors.length}`);
  if (results.errors.length > 0) {
    const unique = [...new Set(results.errors)];
    unique.slice(0, 10).forEach(e => console.log('  -', e.slice(0, 120)));
  }
  console.log(`Browser console errors:    ${results.consoleErrors.length}`);
  if (results.consoleErrors.length > 0) {
    const unique = [...new Set(results.consoleErrors)];
    unique.slice(0, 5).forEach(e => console.log('  -', e.slice(0, 150)));
  }
  console.log(`Screenshots saved to: ${SS_DIR}`);
  console.log('========================================\n');

  return results;
}

// Run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  smoke().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}
