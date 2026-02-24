import { test, expect } from '@playwright/test';

function canonicalizeResponse(response: any): any {
  const clone = JSON.parse(JSON.stringify(response));
  delete clone.authored;
  if (Array.isArray(clone.validationResults)) {
    clone.validationResults.sort((a: any, b: any) => {
      const ap = `${a.path}|${a.code}|${a.severity}`;
      const bp = `${b.path}|${b.code}|${b.severity}`;
      return ap.localeCompare(bp);
    });
  }
  return clone;
}

async function readJsonPre(page: any, id: string): Promise<any> {
  const raw = await page.locator(`#${id}`).textContent();
  return JSON.parse(raw || '{}');
}

test.describe('Integration: Playground Demo Convergence', () => {
  test('should converge on deterministic response artifacts across /playground and /demo', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('http://127.0.0.1:8080/playground/?fixture=holistic-v1');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.click('#run-fixture-script-btn');
    await page.click('#refresh-artifacts-btn');

    const playgroundResponse = await readJsonPre(page, 'response-report');
    const playgroundValidation = await readJsonPre(page, 'validation-report');

    await page.click('#run-mapping-forward-btn');
    const mappingOutput = await readJsonPre(page, 'mapping-output');
    expect(mappingOutput.direction).toBe('forward');
    expect(mappingOutput.output.subject.name).toBe('Demo Operator');

    await page.click('#load-trace-btn');
    await page.click('#replay-step-btn');
    await page.click('#replay-step-btn');

    const replayLog = await readJsonPre(page, 'replay-log');
    expect(replayLog.cursor).toBe(2);
    expect(Array.isArray(replayLog.entries)).toBeTruthy();

    await page.goto('http://127.0.0.1:8080/demo/?fixture=holistic-v1');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.click('#run-fixture-script-btn');
    await page.click('#refresh-artifacts-btn');

    const demoResponse = await readJsonPre(page, 'response-report');
    const demoValidation = await readJsonPre(page, 'validation-report');

    expect(canonicalizeResponse(demoResponse)).toEqual(canonicalizeResponse(playgroundResponse));
    expect(demoValidation.counts).toEqual(playgroundValidation.counts);
    expect(playgroundResponse.data.grandTotal).toBe(500);
  });
});
