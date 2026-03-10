import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const REPORT_DIR = path.join(ROOT, 'examples/grant-report');

export function loadTribalShortArtifacts() {
  return {
    definition: JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal-short.definition.json'), 'utf8')),
    component:  JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal-short.component.json'),  'utf8')),
    theme:      JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal.theme.json'),             'utf8')),
  };
}

export function loadTribalLongArtifacts() {
  return {
    definition: JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal-long.definition.json'), 'utf8')),
    component:  JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal-long.component.json'),  'utf8')),
    theme:      JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'tribal.theme.json'),            'utf8')),
  };
}

export async function mountTribalShort(page: Page): Promise<void> {
  const { definition, component, theme } = loadTribalShortArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm }) => {
    const el: any = document.querySelector('formspec-render');
    el.definition        = def;
    el.componentDocument = comp;
    el.themeDocument     = thm;
  }, { def: definition, comp: component, thm: theme });
  await page.waitForTimeout(200);
}

export async function mountTribalLong(page: Page): Promise<void> {
  const { definition, component, theme } = loadTribalLongArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm }) => {
    const el: any = document.querySelector('formspec-render');
    el.definition        = def;
    el.componentDocument = comp;
    el.themeDocument     = thm;
  }, { def: definition, comp: component, thm: theme });
  await page.waitForTimeout(200);
}

/** Navigate wizard to a named page (by visible h2 text). */
export async function goToPage(page: Page, title: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const heading = await page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first().textContent().catch(() => '');
    if (heading?.trim() === title) return;
    const nextBtn = page.locator('button.formspec-wizard-next').first();
    await nextBtn.click();
    await page.waitForTimeout(100);
  }
  throw new Error(`Could not navigate to wizard page "${title}"`);
}

/** Get raw field signal value from engine. */
export async function engineValue(page: Page, fieldPath: string): Promise<any> {
  return page.evaluate((p) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().signals[p]?.value;
  }, fieldPath);
}

/** Set a field value via engine (bypasses UI). */
export async function engineSetValue(page: Page, fieldPath: string, value: any): Promise<void> {
  await page.evaluate(({ p, v }) => {
    const el: any = document.querySelector('formspec-render');
    el.getEngine().setValue(p, v);
  }, { p: fieldPath, v: value });
}

/** Check if a field is relevant. */
export async function isRelevant(page: Page, fieldPath: string): Promise<boolean> {
  return page.evaluate((p) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().relevantSignals[p]?.value ?? true;
  }, fieldPath);
}

/** Get the full validation report. */
export async function getValidationReport(
  page: Page,
  mode: 'continuous' | 'submit' | 'demand' = 'continuous'
) {
  return page.evaluate((m) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().getValidationReport({ mode: m });
  }, mode);
}

/** Get the full response object. */
export async function getResponse(page: Page, mode: 'continuous' | 'submit' = 'submit') {
  return page.evaluate((m) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().getResponse({ mode: m });
  }, mode);
}
