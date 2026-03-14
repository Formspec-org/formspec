/**
 * Shared helpers for Inquest E2E Playwright tests.
 *
 * All tests use ?e2e=1 which activates the deterministic provider adapter —
 * no live API keys or network calls are required.
 */

import { expect, type Page } from '@playwright/test';

/* ── Constants ──────────────────────────────────── */

export const INQUEST_E2E_URL = '/inquest/?e2e=1';
export const ANALYSIS_TIMEOUT = 8000;
export const PROPOSAL_TIMEOUT = 8000;

/* ── Navigation ─────────────────────────────────── */

/** Navigate to the Inquest app in E2E mode (deterministic provider, no API calls). */
export async function gotoInquest(page: Page) {
  await page.goto(INQUEST_E2E_URL);
  await page.waitForSelector('[data-testid="stack-assistant"]');
}

/* ── Provider Setup ─────────────────────────────── */

/**
 * Complete the provider setup flow:
 * 1. Select Gemini provider (session gets providerId)
 * 2. Enter any API key (deterministic adapter accepts any non-empty key)
 * 3. Click "Verify Connection" → succeeds immediately
 * 4. Click "Continue to Chat"
 */
export async function completeProviderSetup(page: Page) {
  await expect(page.getByText('Intelligence Setup')).toBeVisible();
  await page.getByRole('button', { name: 'Gemini' }).click();
  await page.getByPlaceholder('sk-...').fill('test-e2e-key');
  await page.getByRole('button', { name: /verify connection/i }).click();
  await page.getByRole('button', { name: /continue to chat/i }).click({ timeout: 5000 });
  await expect(page.getByPlaceholder(/describe the form you need/i)).toBeVisible();
}

/* ── Blueprint / Template ───────────────────────── */

/**
 * Select the first blueprint from the gallery.
 * This sets templateId on the session without triggering analysis.
 */
export async function selectBlueprint(page: Page) {
  await page.getByRole('button', { name: /browse all blueprints/i }).click();
  const useBlueprintBtns = page.getByRole('button', { name: /use blueprint/i });
  await useBlueprintBtns.first().click();
}

/**
 * Select a specific blueprint by index (0-based) from the gallery.
 */
export async function selectBlueprintByIndex(page: Page, index: number) {
  await page.getByRole('button', { name: /browse all blueprints/i }).click();
  const useBlueprintBtns = page.getByRole('button', { name: /use blueprint/i });
  await useBlueprintBtns.nth(index).click();
}

/**
 * Complete provider setup AND save credentials to browser.
 * This ensures credentials survive page reload.
 */
export async function completeProviderSetupWithSave(page: Page) {
  await expect(page.getByText('Intelligence Setup')).toBeVisible();
  await page.getByRole('button', { name: 'Gemini' }).click();
  await page.getByPlaceholder('sk-...').fill('test-e2e-key');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /verify connection/i }).click();
  await page.getByRole('button', { name: /continue to chat/i }).click({ timeout: 5000 });
  await expect(page.getByPlaceholder(/describe the form you need/i)).toBeVisible();
}

/* ── Phase Navigation ───────────────────────────── */

/**
 * Reach the review phase via: blueprint selection → Draft Fast.
 * Draft Fast runs both analysis and proposal generation, producing a
 * "Scaffold ready" state with an "Open Refine" button.
 */
export async function reachReviewViaDraftFast(page: Page) {
  await completeProviderSetup(page);
  await selectBlueprint(page);
  await page.getByText('Draft Fast').click();
  await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  await expect(page.getByText(/scaffold ready/i)).toBeVisible({ timeout: PROPOSAL_TIMEOUT });
}

/**
 * Reach the refine workspace: blueprint → Draft Fast → Open Refine.
 */
export async function reachRefine(page: Page) {
  await reachReviewViaDraftFast(page);
  await page.getByRole('button', { name: /open refine/i }).click();
  await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });
}
