import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const GRANT_DIR = path.join(ROOT, 'examples/grant-application');

export function loadGrantArtifacts() {
  return {
    definition: JSON.parse(fs.readFileSync(path.join(GRANT_DIR, 'definition.json'), 'utf8')),
    component:  JSON.parse(fs.readFileSync(path.join(GRANT_DIR, 'component.json'),  'utf8')),
    theme:      JSON.parse(fs.readFileSync(path.join(GRANT_DIR, 'theme.json'),       'utf8')),
  };
}

export async function mountGrantApplication(page: Page): Promise<void> {
  const { definition, component, theme } = loadGrantArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm }) => {
    const el: any = document.querySelector('formspec-render');
    el.definition        = def;
    el.skipScreener();   // Skip screener so tests go directly to the main form
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

/** Get a global variable value from engine. */
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

/** Read the engine's structureVersion signal value. */
export async function structureVersion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().structureVersion.value;
  });
}

/** Programmatically add a repeat instance via engine. Returns new count. */
export async function addRepeatInstance(page: Page, itemName: string): Promise<number> {
  return page.evaluate((name) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().addRepeatInstance(name);
  }, itemName);
}

/** Get the engine's raw instance data for a named instance. */
export async function getInstanceData(page: Page, instanceName: string): Promise<any> {
  return page.evaluate((name) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().instanceData?.[name];
  }, instanceName);
}

/** Set a value on a writable instance via engine. */
export async function setInstanceValue(page: Page, name: string, path: string | undefined, value: any): Promise<void> {
  await page.evaluate(({ n, p, v }) => {
    const el: any = document.querySelector('formspec-render');
    el.getEngine().setInstanceValue(n, p, v);
  }, { n: name, p: path, v: value });
}

/** Get the engine's instanceVersion signal value. */
export async function instanceVersion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().instanceVersion.value;
  });
}
