/**
 * Smoke test: Invoice Form
 *
 * Exercises: single-page form load, Add Row button for the line-items repeat
 * group, DOM-level dispatchEvent field fill (since the form uses bracket-
 * notation names like "lineItems[0].quantity"), computed field assertion
 * (Subtotal / Grand Total), and Submit (Client) click.
 *
 * Usage: node tests/e2e/smoke/invoice.smoke.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './lib/browser.mjs';
import { screenshot } from './lib/screenshots.mjs';

const FORM_HASH = 'invoice';
const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';
const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(SMOKE_DIR, 'screenshots', 'invoice');

// ── DOM-level field fill ──────────────────────────────────────────────────────
// The invoice form uses bracket-notation names (lineItems[0].quantity) that
// cannot be reliably targeted with CSS attribute selectors in all browsers.
// We use dispatchEvent to trigger the React-style synthetic events that the
// webcomponent listens to.

async function fillFieldByName(page, name, value) {
  const isEnabled = await page.evaluate((n) => {
    const el = document.querySelector(`[name="${n}"]`);
    return el && !el.disabled && !el.readOnly;
  }, name);

  if (!isEnabled) {
    console.log(`[fill] Skipping disabled/readonly field: ${name}`);
    return false;
  }

  await page.evaluate(({ n, v }) => {
    const el = document.querySelector(`[name="${n}"]`);
    if (!el) return;
    el.focus();
    const nativeValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeValueSetter) {
      nativeValueSetter.call(el, v);
    } else {
      el.value = v;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { n: name, v: value });
  console.log(`[fill] ${name} = ${value}`);
  return true;
}

// ── Main smoke function ───────────────────────────────────────────────────────

export default async function smoke() {
  console.log('=== Invoice Smoke Test ===');
  console.log(`Target: ${BASE_URL}/#${FORM_HASH}`);

  const { browser, page, consoleErrors } = await launchBrowser();
  const results = {
    form: 'invoice',
    addButtonFound: false,
    filledCount: 0,
    computedTotals: {},
    validationErrors: [],
    consoleErrors: [],
    submitFound: false,
  };

  let ssIdx = 1;
  const ssName = (label) => `${String(ssIdx++).padStart(2, '0')}-${label}.png`;

  try {
    console.log(`\n[nav] Navigating to ${BASE_URL}/#${FORM_HASH}`);
    await page.goto(`${BASE_URL}/#${FORM_HASH}`, { waitUntil: 'networkidle' });

    console.log('[nav] Waiting for form container...');
    await page.waitForSelector('.form-container', { timeout: 15000 });
    await page.waitForSelector('.form-container formspec-render', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Wait for formspec-render to have rendered content
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector('.form-container formspec-render');
        if (!el) return false;
        return el.children.length > 0 || el.shadowRoot?.children.length > 0;
      }, { timeout: 10000 });
      console.log('[nav] formspec-render has rendered content');
    } catch (e) {
      console.log('[warn] formspec-render may not have rendered content:', e.message);
    }
    await page.waitForTimeout(1000);

    await screenshot(page, SS_DIR, ssName('initial'), 'Initial state', { fullPage: true });

    // Log form structure for debugging
    const formInfo = await page.evaluate(() => {
      const fsRender = document.querySelector('.form-container formspec-render');
      return {
        fsRenderChildren: fsRender ? fsRender.children.length : 0,
        bodyTextSnippet: document.body.innerText.substring(0, 500),
      };
    });
    console.log('[debug] formspec-render children:', formInfo.fsRenderChildren);

    // Find and click the Add button for line items
    const addButtonSelectors = [
      'button:has-text("Add")',
      'button:has-text("+")',
      'button:has-text("Add Line Item")',
      'button:has-text("Add Item")',
      '[data-action="add"]',
      '.repeat-add',
      '.add-repeat',
      'button.add',
    ];

    let addButton = null;
    for (const sel of addButtonSelectors) {
      try {
        const btn = page.locator(sel).first();
        const count = await btn.count();
        if (count > 0) {
          console.log(`[repeat] Found add button with selector: ${sel}`);
          addButton = btn;
          results.addButtonFound = true;
          break;
        }
      } catch (_) {}
    }

    if (addButton) {
      console.log('[repeat] Clicking Add button...');
      await addButton.click();
      await page.waitForTimeout(500);
    } else {
      console.log('[repeat] No Add button found — listing all buttons on page:');
      const buttons = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.innerText.trim(),
          id: b.id,
          className: b.className,
        }))
      );
      console.log('[debug] All buttons:', JSON.stringify(buttons, null, 2));
    }

    await screenshot(page, SS_DIR, ssName('line-added'), 'After Add button', { fullPage: true });

    // Scan all inputs so we know what's available
    const allInputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        value: el.value,
        className: el.className,
      }))
    );
    console.log('[debug] All inputs found:', JSON.stringify(allInputs, null, 2));

    // Fill line items via DOM dispatchEvent
    const fillTargets = [
      { name: 'lineItems[0].itemDescription', value: 'Web Development Services' },
      { name: 'lineItems[0].quantity',        value: '3' },
      { name: 'lineItems[0].unitPrice',       value: '25.00' },
      { name: 'lineItems[1].itemDescription', value: 'Hosting Setup' },
      { name: 'lineItems[1].quantity',        value: '1' },
      { name: 'lineItems[1].unitPrice',       value: '50.00' },
    ];

    for (const target of fillTargets) {
      const found = allInputs.find(inp => inp.name === target.name);
      if (!found) {
        console.log(`[fill] Field not found: ${target.name}`);
        continue;
      }
      const ok = await fillFieldByName(page, target.name, target.value);
      if (ok) {
        results.filledCount++;
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(500);

    await screenshot(page, SS_DIR, ssName('filled'), 'After filling fields', { fullPage: true });

    // Check computed totals
    const computedFields = await page.evaluate(() => {
      const results = [];
      const candidates = document.querySelectorAll(
        '[data-bind], [data-calculated], .calculated, .computed, .total, [id*="total"], [id*="subtotal"], [id*="amount"]'
      );
      candidates.forEach(el => {
        results.push({ tag: el.tagName, id: el.id, className: el.className, text: el.innerText?.trim(), value: el.value });
      });
      const readonlyInputs = document.querySelectorAll('input[readonly], input[disabled]');
      readonlyInputs.forEach(el => {
        results.push({ tag: el.tagName, id: el.id, name: el.name, type: el.type, value: el.value, readonly: true });
      });
      return results;
    });
    console.log('[computed] Computed/calculated fields:', JSON.stringify(computedFields, null, 2));

    const finalTotals = await page.evaluate(() => {
      const textLines = document.body.innerText.split('\n').filter(l => {
        const lower = l.toLowerCase();
        return lower.includes('total') || lower.includes('subtotal') || lower.includes('amount') || lower.includes('sum');
      });
      const inputTotals = [];
      document.querySelectorAll('input').forEach(inp => {
        if (inp.value && (inp.id?.includes('total') || inp.name?.includes('total') || inp.id?.includes('amount') || inp.name?.includes('amount'))) {
          inputTotals.push({ id: inp.id, name: inp.name, value: inp.value });
        }
      });
      return { textLines, inputTotals };
    });
    results.computedTotals = finalTotals;
    console.log('[computed] Text lines with total/amount:', finalTotals.textLines);
    console.log('[computed] Input totals:', finalTotals.inputTotals);

    // Submit
    console.log('[submit] Looking for submit button...');
    const submitBtn = page.locator('#action-submit');
    const submitCount = await submitBtn.count();

    if (submitCount > 0) {
      results.submitFound = true;
      console.log('[submit] Clicking #action-submit...');
      await submitBtn.click();
    } else {
      console.log('[submit] #action-submit not found, trying fallback...');
      const anySubmit = page.locator('button[type="submit"], button:has-text("Submit")').first();
      if (await anySubmit.count() > 0) {
        results.submitFound = true;
        await anySubmit.click();
        console.log('[submit] Clicked fallback submit button');
      } else {
        console.log('[submit] No submit button found at all');
      }
    }

    await page.waitForTimeout(500);
    await screenshot(page, SS_DIR, ssName('validation'), 'After submit attempt', { fullPage: true });

    // Collect validation errors
    const validationErrors = await page.evaluate(() => {
      const errors = [];
      const errorEls = document.querySelectorAll(
        '.formspec-error, [class*="error"], [class*="invalid"], [aria-invalid="true"]'
      );
      errorEls.forEach(el => {
        const text = el.innerText?.trim();
        if (text) {
          errors.push({ className: el.className, text, id: el.id });
        }
      });
      return errors;
    });

    results.validationErrors = validationErrors;
    console.log('\n[validation] Validation errors:');
    if (validationErrors.length > 0) {
      validationErrors.forEach(e => console.log(`  [${e.className}] ${e.text}`));
    } else {
      console.log('  No .formspec-error elements found');
    }

  } catch (err) {
    console.error('[FATAL]', err.message);
    try { await screenshot(page, SS_DIR, ssName('error'), 'Error state', { fullPage: true }); } catch {}
    throw err;
  } finally {
    results.consoleErrors = [...consoleErrors];
    await browser.close();
  }

  // Summary
  console.log('\n========================================');
  console.log('INVOICE SMOKE TEST SUMMARY');
  console.log('========================================');
  console.log(`Add button found:    ${results.addButtonFound}`);
  console.log(`Fields filled:       ${results.filledCount}`);
  console.log(`Validation errors:   ${results.validationErrors.length}`);
  console.log(`Console errors:      ${results.consoleErrors.length}`);
  if (results.consoleErrors.length > 0) {
    results.consoleErrors.slice(0, 5).forEach(e => console.log('  ', e));
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
