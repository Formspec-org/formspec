import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const INTAKE_DIR = path.join(ROOT, 'examples/clinical-intake');
const REGISTRIES_DIR = path.join(ROOT, 'registries');

export function loadClinicalIntakeArtifacts() {
  return {
    definition: JSON.parse(fs.readFileSync(path.join(INTAKE_DIR, 'intake.definition.json'), 'utf8')),
    component:  JSON.parse(fs.readFileSync(path.join(INTAKE_DIR, 'intake.component.json'),  'utf8')),
    theme:      JSON.parse(fs.readFileSync(path.join(INTAKE_DIR, 'intake.theme.json'),       'utf8')),
    registry:   JSON.parse(fs.readFileSync(path.join(REGISTRIES_DIR, 'formspec-common.registry.json'), 'utf8')),
  };
}

/**
 * Mount the clinical intake form WITHOUT skipping the screener.
 * The screener must be completed before the main wizard appears.
 */
export async function mountClinicalIntakeWithScreener(page: Page): Promise<void> {
  const { definition, component, theme, registry } = loadClinicalIntakeArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm, reg }) => {
    const el: any = document.querySelector('formspec-render');
    el.registryDocuments = reg;
    el.definition        = def;
    el.componentDocument = comp;
    el.themeDocument     = thm;
  }, { def: definition, comp: component, thm: theme, reg: registry });
  await page.waitForTimeout(200);
}

/**
 * Mount the clinical intake form and skip the screener so tests go directly
 * to the main wizard.
 */
export async function mountClinicalIntake(page: Page): Promise<void> {
  const { definition, component, theme, registry } = loadClinicalIntakeArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm, reg }) => {
    const el: any = document.querySelector('formspec-render');
    el.registryDocuments = reg;
    el.definition        = def;
    el.skipScreener();
    el.componentDocument = comp;
    el.themeDocument     = thm;
  }, { def: definition, comp: component, thm: theme, reg: registry });
  await page.waitForTimeout(200);
}

/**
 * Complete the screener with the given chief complaint and pain level, then
 * click Continue. The standard intake route (catch-all) is triggered when
 * complaint is not 'emergency' and pain < 8.
 */
export async function completeScreener(
  page: Page,
  chiefComplaint: string,
  painLevel: number
): Promise<void> {
  await page.locator('[data-name="sChiefComplaint"] select').selectOption(chiefComplaint);
  await page.locator('[data-name="sPainLevel"] input[type="number"]').fill(String(painLevel));
  await page.locator('.formspec-screener-continue').click();
  await page.waitForTimeout(300);
}

/** Navigate wizard to a named page (by visible h2 text). */
export async function goToPage(page: Page, title: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const heading = await page
      .locator('.formspec-wizard-panel:not(.formspec-hidden) h2')
      .first()
      .textContent()
      .catch(() => '');
    if (heading?.trim() === title) return;
    const nextBtn = page.locator('button.formspec-wizard-next').first();
    await nextBtn.click();
    await page.waitForTimeout(100);
  }
  throw new Error(`Could not navigate to wizard page "${title}"`);
}

/** Get raw field signal value from the engine. */
export async function engineValue(page: Page, fieldPath: string): Promise<any> {
  return page.evaluate((p) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().signals[p]?.value;
  }, fieldPath);
}

/** Get a global variable value from the engine. */
export async function engineVariable(page: Page, name: string): Promise<any> {
  return page.evaluate((n) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().variableSignals[`#:${n}`]?.value;
  }, name);
}

/** Set a field value via engine (bypasses UI). */
export async function engineSetValue(page: Page, fieldPath: string, value: any): Promise<void> {
  await page.evaluate(({ p, v }) => {
    const el: any = document.querySelector('formspec-render');
    el.getEngine().setValue(p, v);
  }, { p: fieldPath, v: value });
}

/** Programmatically add a repeat instance via engine. Returns new count. */
export async function addRepeatInstance(page: Page, itemName: string): Promise<number> {
  return page.evaluate((name) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().addRepeatInstance(name);
  }, itemName);
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
