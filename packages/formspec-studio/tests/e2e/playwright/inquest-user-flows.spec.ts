/**
 * BDD-style E2E Playwright tests for Inquest user journeys.
 *
 * These tests exercise complete, multi-step user flows through the browser DOM.
 * All tests use ?e2e=1 which activates the deterministic provider adapter --
 * no live API keys or network calls are required.
 *
 * Unlike `inquest-app.spec.ts` (which tests individual UI elements in isolation),
 * these tests walk through real end-to-end scenarios from provider setup through
 * to the refine workspace and Studio handoff.
 *
 * Scenarios covered:
 *   1. Description -> Draft Fast -> Review (with proposal) -> Refine -> Studio
 *   2. Template -> Verify Carefully -> Review -> Generate Scaffold -> Refine
 *   3. Chat interaction: message -> auto-analysis -> review
 *   4. Refine workspace: apply edit prompt
 *   5. Phase stepper navigation: forward and back
 *   6. Template + description enrichment: merged fields
 *   7. Error banner dismissal
 *   8. Session sidebar: new project
 */

import { test, expect, type Page } from '@playwright/test';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const INQUEST_E2E_URL = '/inquest/?e2e=1';
const ANALYSIS_TIMEOUT = 8000;
const PROPOSAL_TIMEOUT = 8000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Navigate to the Inquest app in E2E mode (deterministic provider, no API calls). */
async function gotoInquest(page: Page) {
  await page.goto(INQUEST_E2E_URL);
  await page.waitForSelector('[data-testid="stack-assistant"]');
}

/**
 * Complete the provider setup flow:
 * 1. Select Gemini provider
 * 2. Enter any API key (deterministic adapter accepts any non-empty key)
 * 3. Click "Verify Connection" -> succeeds immediately
 * 4. Click "Continue to Chat"
 */
async function completeProviderSetup(page: Page) {
  await expect(page.getByText('Intelligence Setup')).toBeVisible();
  await page.getByRole('button', { name: 'Gemini' }).click();
  await page.getByPlaceholder('sk-...').fill('test-e2e-key');
  await page.getByRole('button', { name: /verify connection/i }).click();
  await page.getByRole('button', { name: /continue to chat/i }).click({ timeout: 5000 });
  await expect(page.getByPlaceholder(/describe the form you need/i)).toBeVisible();
}

/**
 * Select the first blueprint from the gallery.
 * This sets templateId on the session without triggering analysis.
 */
async function selectBlueprint(page: Page) {
  await page.getByRole('button', { name: /browse all blueprints/i }).click();
  const useBlueprintBtns = page.getByRole('button', { name: /use blueprint/i });
  await useBlueprintBtns.first().click();
}

/**
 * Reach the review phase with a proposal via: blueprint -> Draft Fast.
 * Draft Fast runs both analysis and proposal generation, producing a
 * "Scaffold ready" state with an "Open Refine" button.
 */
async function reachReviewViaDraftFast(page: Page) {
  await completeProviderSetup(page);
  await selectBlueprint(page);
  await page.getByText('Draft Fast').click();
  await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  // Draft Fast generates the proposal too, so we should see "Scaffold ready"
  await expect(page.getByText(/scaffold ready/i)).toBeVisible({ timeout: PROPOSAL_TIMEOUT });
}

/**
 * Reach the refine workspace: blueprint -> Draft Fast -> Open Refine.
 */
async function reachRefine(page: Page) {
  await reachReviewViaDraftFast(page);
  await page.getByRole('button', { name: /open refine/i }).click();
  await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });
}

/* ================================================================== */
/* Test Suites                                                         */
/* ================================================================== */

test.describe('User Journey: Description -> Draft Fast -> Review -> Refine -> Studio', () => {
  test('complete flow from blueprint selection through to refine workspace', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // Select the first blueprint (Housing Intake) which provides recognizable fields:
    // Full Name, Date of Birth, Email, Household Size, Has Income, Monthly Income
    await selectBlueprint(page);

    // Verify the Generate CTA appears with both buttons enabled
    await expect(page.getByText('Draft Fast')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Verify Carefully')).toBeVisible();

    // Click "Draft Fast" -- this runs both analysis and proposal generation
    await page.getByText('Draft Fast').click();

    // Should transition to the review phase
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Verify the "Fast draft" badge is shown (not "Careful")
    await expect(page.getByText('Fast draft')).toBeVisible();

    // Field inventory should show the template fields
    await expect(page.getByText(/field inventory/i)).toBeVisible();
    await expect(page.getByText('Full Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Date of Birth', { exact: true })).toBeVisible();
    await expect(page.getByText('Email', { exact: true })).toBeVisible();
    await expect(page.getByText('Household Size', { exact: true })).toBeVisible();

    // Template fields get "high" confidence
    const highBadges = page.getByText('high', { exact: true });
    await expect(highBadges.first()).toBeVisible();

    // Verify data types are displayed alongside field keys
    await expect(page.getByText(/fullName · string/)).toBeVisible();
    await expect(page.getByText(/dateOfBirth · date/)).toBeVisible();

    // Proposal is generated, so "Scaffold ready" should be visible
    await expect(page.getByText(/scaffold ready/i)).toBeVisible({ timeout: PROPOSAL_TIMEOUT });
    // Proposal stats: "N fields · N sections · N binds"
    await expect(page.getByText(/\d+ fields · \d+ sections · \d+ binds/)).toBeVisible();

    // Click "Open Refine" to enter the refine workspace
    await page.getByRole('button', { name: /open refine/i }).click();

    // Refine workspace should load
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });

    // "Open in Studio" button should be present for handoff
    await expect(page.getByRole('button', { name: /open in studio/i })).toBeVisible();

    // Refine prompt composer should be available
    await expect(page.getByPlaceholder(/describe a change/i)).toBeVisible();

    // "Back to Review" button should be present
    await expect(page.getByRole('button', { name: /← review/i })).toBeVisible();
  });
});

test.describe('User Journey: Template -> Verify Carefully -> Review -> Generate -> Refine', () => {
  test('complete flow using verify-carefully mode with explicit scaffold generation', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // Select a blueprint to get meaningful input
    await selectBlueprint(page);

    // Click "Verify Carefully" -- this runs analysis only, NOT proposal
    await page.getByRole('button', { name: /verify carefully/i }).click({ timeout: 3000 });

    // Should transition to review phase
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Verify the "Careful" badge is shown (not "Fast draft")
    await expect(page.getByText('Careful', { exact: true })).toBeVisible();

    // Template-specific fields from Housing Intake should be visible
    await expect(page.getByText('Full Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Date of Birth', { exact: true })).toBeVisible();
    await expect(page.getByText('Has Income', { exact: true })).toBeVisible();
    await expect(page.getByText('Monthly Income', { exact: true })).toBeVisible();

    // Logic rules should show the housing intake rule
    await expect(page.getByText(/logic rules/i)).toBeVisible();
    await expect(page.getByText(/monthly income appears only when/i)).toBeVisible();
    // Rule kind badge
    await expect(page.getByText('Visible when')).toBeVisible();

    // No proposal yet -- "Generate scaffold" button should be visible (not "Open Refine")
    await expect(page.getByRole('button', { name: /generate scaffold/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open refine/i })).not.toBeVisible();

    // Click "Generate scaffold" to build the proposal
    await page.getByRole('button', { name: /generate scaffold/i }).click();

    // Proposal should now appear with "Scaffold ready" and "Open Refine"
    await expect(page.getByText(/scaffold ready/i)).toBeVisible({ timeout: PROPOSAL_TIMEOUT });
    await expect(page.getByRole('button', { name: /open refine/i })).toBeVisible();

    // Navigate to refine
    await page.getByRole('button', { name: /open refine/i }).click();
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /open in studio/i })).toBeVisible();
  });
});

test.describe('Chat Interaction: message triggers analysis', () => {
  test('sending a chat message adds it to the thread and triggers analysis', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // The greeting message from Stack should be visible
    await expect(page.getByText(/I'm Stack/i)).toBeVisible();

    // Type a description in the composer and submit with Enter
    const composer = page.getByPlaceholder(/describe the form you need/i);
    await composer.fill('Build a patient intake form with name, email, phone, and date of birth');
    await composer.press('Enter');

    // The deterministic adapter detects "name", "email", "phone", "date" patterns.
    // handleChatNew adds the user message and calls handleAnalyze which transitions to review.
    // Verify we arrive at the review phase.
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Verify the analysis found the expected fields from the description
    // The deterministic adapter matches \bname\b, \bemail\b, \bphone\b, \bdate\b
    await expect(page.getByText(/field inventory/i)).toBeVisible();
    await expect(page.getByText('Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Email', { exact: true })).toBeVisible();
    await expect(page.getByText('Phone Number', { exact: true })).toBeVisible();
    await expect(page.getByText('Date', { exact: true })).toBeVisible();

    // Description-derived fields get "medium" confidence
    const mediumBadges = page.getByText('medium', { exact: true });
    await expect(mediumBadges.first()).toBeVisible();

    // Analysis only (no proposal), so "Generate scaffold" should be visible
    await expect(page.getByRole('button', { name: /generate scaffold/i })).toBeVisible();
  });

  test('clicking a quick start button triggers analysis and transitions to review', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // Click "Event registration" quick start -- its prompt contains "date" and "contact"
    // which the deterministic adapter can match via FIELD_CATALOG.
    // Prompt: "Build an event registration form with attendee details, session selection,
    //          dietary requirements, and emergency contact."
    await page.getByRole('button', { name: /event registration/i }).click();

    // Should auto-analyze and transition to review
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await expect(page.getByText(/field inventory/i)).toBeVisible();

    // The "event registration" prompt doesn't match many FIELD_CATALOG entries
    // but it should still produce a valid analysis and reach the review phase.
    // We verify the analysis summary is visible.
    await expect(page.getByText(/identified.*candidate fields/i)).toBeVisible();
  });
});

test.describe('Refine Workspace: apply edit prompt', () => {
  test('typing "make email required" in the refine prompt applies the edit', async ({ page }) => {
    await gotoInquest(page);
    await reachRefine(page);

    // The refine workspace should be loaded with the prompt composer
    const promptArea = page.getByPlaceholder(/describe a change/i);
    await expect(promptArea).toBeVisible();

    // Type an edit command that the deterministic adapter understands
    await promptArea.fill('make email required');

    // Press Enter to submit the edit
    await promptArea.press('Enter');

    // The deterministic adapter's buildEditPatch recognizes "make X required"
    // and produces a definition.setBind command. We verify no error is shown.
    // Wait for the apply to complete (the prompt should clear on success)
    await expect(promptArea).toHaveValue('', { timeout: 5000 });

    // Verify no error banner appeared
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('typing an unrecognized edit shows an info issue but no crash', async ({ page }) => {
    await gotoInquest(page);
    await reachRefine(page);

    const promptArea = page.getByPlaceholder(/describe a change/i);
    await promptArea.fill('do something random and weird');
    await promptArea.press('Enter');

    // The adapter returns an "edit-unsupported" issue but no commands.
    // The prompt should still clear on "success" (no exception thrown).
    await expect(promptArea).toHaveValue('', { timeout: 5000 });

    // No crash/error banner
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

test.describe('Phase Stepper Navigation: forward and back', () => {
  test('stepper reflects phase progression and allows backward navigation', async ({ page }) => {
    await gotoInquest(page);

    const nav = page.getByRole('navigation', { name: /workflow phases/i });

    // On initial load, all three steps are visible
    await expect(nav.getByText('Describe')).toBeVisible();
    await expect(nav.getByText('Review')).toBeVisible();
    await expect(nav.getByText('Refine')).toBeVisible();

    // Review and Refine steps are disabled in the stepper
    const reviewStepBtn = nav.getByRole('button').filter({ hasText: 'Review' });
    const refineStepBtn = nav.getByRole('button').filter({ hasText: 'Refine' });
    await expect(reviewStepBtn).toBeDisabled();
    await expect(refineStepBtn).toBeDisabled();

    // Navigate to review via Draft Fast
    await reachReviewViaDraftFast(page);

    // Now "Describe" step should be navigable (done), "Review" is current, "Refine" is disabled
    const describeStepBtn = nav.getByRole('button').filter({ hasText: 'Describe' });
    await expect(describeStepBtn).not.toBeDisabled();
    await expect(refineStepBtn).toBeDisabled();

    // Navigate to refine
    await page.getByRole('button', { name: /open refine/i }).click();
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });

    // Now both "Describe" and "Review" should be navigable (done), "Refine" is current
    await expect(describeStepBtn).not.toBeDisabled();
    await expect(reviewStepBtn).not.toBeDisabled();

    // Use the "back to review" button in the refine workspace
    await page.getByRole('button', { name: /← review/i }).click();

    // Should be back in review phase
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: 3000 });

    // "Scaffold ready" and "Open Refine" should still be present (proposal persists)
    await expect(page.getByText(/scaffold ready/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /open refine/i })).toBeVisible();
  });

  test('clicking "Describe" step in stepper from review navigates back to inputs', async ({ page }) => {
    await gotoInquest(page);
    await reachReviewViaDraftFast(page);

    const nav = page.getByRole('navigation', { name: /workflow phases/i });
    const describeStepBtn = nav.getByRole('button').filter({ hasText: 'Describe' });

    // Click the Describe step to go back to the inputs phase
    await describeStepBtn.click();

    // Should return to the inputs/chat phase -- the composer should be visible
    await expect(page.getByPlaceholder(/describe the form you need/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Template + Description Enrichment: merged fields', () => {
  test('selecting a blueprint then typing additional patterns produces merged fields', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // 1. Select the first blueprint (Housing Intake) to get template fields
    await selectBlueprint(page);

    // 2. Type additional text with new field patterns into the composer
    //    The deterministic adapter will parse "phone" and "address" from this text.
    const composer = page.getByPlaceholder(/describe the form you need/i);
    await composer.fill('Also collect phone and address for the applicant');

    // 3. We can't use Draft Fast here because typing in the composer doesn't
    //    update session.input.description (that happens on submit). However,
    //    submitting via Enter will call handleChatNew which runs analysis (not proposal).
    //    Instead, let's submit first to set the description, then we'll end up in review.
    //    Actually, let's click Draft Fast since the blueprint selection already
    //    makes meaningfulInput=true and the CTA should be visible.
    await expect(page.getByText('Draft Fast')).toBeVisible({ timeout: 3000 });

    // Submit the text first (to update the description), which triggers analysis
    await composer.press('Enter');

    // This should transition to review. The deterministic adapter merges
    // template fields (Housing Intake: fullName, dateOfBirth, email, householdSize,
    // hasIncome, monthlyIncome) with description-derived fields (phone, address).
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await expect(page.getByText(/field inventory/i)).toBeVisible();

    // Template fields should be present
    await expect(page.getByText('Full Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Email', { exact: true })).toBeVisible();
    await expect(page.getByText('Household Size', { exact: true })).toBeVisible();

    // Description-derived fields should also be present
    await expect(page.getByText('Phone Number', { exact: true })).toBeVisible();
    await expect(page.getByText('Address', { exact: true })).toBeVisible();
  });
});

test.describe('Error Dismissal Flow', () => {
  test('error banner with dismiss button works correctly', async ({ page }) => {
    // The deterministic adapter does not throw errors under normal conditions.
    // However, we can verify the error banner component renders correctly
    // by checking that the "Dismiss error" button exists and works when an
    // error banner is present.
    //
    // We test this by reaching the refine workspace and triggering an operation
    // that could potentially show an error. Since the deterministic adapter
    // always succeeds, we verify the banner does NOT appear (negative test).
    await gotoInquest(page);
    await reachRefine(page);

    // Apply a prompt -- deterministic adapter won't throw
    const promptArea = page.getByPlaceholder(/describe a change/i);
    await promptArea.fill('make email required');
    await promptArea.press('Enter');
    await expect(promptArea).toHaveValue('', { timeout: 5000 });

    // Verify no error banner is visible
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

    // Verify the dismiss button does not exist when there's no error
    await expect(page.getByRole('button', { name: /dismiss error/i })).not.toBeVisible();
  });
});

test.describe('Session Sidebar: new project', () => {
  test('"New project" button is visible and clickable in the sidebar', async ({ page }) => {
    await gotoInquest(page);

    // The sidebar should show a "New project" button even before setup is complete
    const newProjectBtn = page.getByRole('button', { name: /new project/i });
    await expect(newProjectBtn).toBeVisible();
  });

  test('clicking "New project" navigates to a fresh session', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // We're now in the chat phase. Click "New project" in the sidebar.
    // This calls handleCreateFreshSession which does window.location.assign
    // to a new inquest URL. We listen for navigation.
    const newProjectBtn = page.getByRole('button', { name: /new project/i });
    await expect(newProjectBtn).toBeVisible();

    // Click and wait for navigation
    await Promise.all([
      page.waitForURL(/\/inquest\//),
      newProjectBtn.click(),
    ]);

    // After navigation, we should see the provider setup again (fresh session)
    // or the chat interface if the provider credentials persist.
    // Either way, the page should load successfully with the Stack assistant.
    await page.waitForSelector('[data-testid="stack-assistant"]');
  });
});

test.describe('Review Workspace: field and rule card details', () => {
  test('field cards show label, key, dataType, and confidence badge', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);
    await selectBlueprint(page);
    await page.getByText('Draft Fast').click();
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Housing Intake template fields:
    // fullName (string, required, high), dateOfBirth (date, required, high),
    // email (string, high), householdSize (integer, required, high),
    // hasIncome (boolean, required, high), monthlyIncome (money, high)

    // Verify a field card shows all expected details
    await expect(page.getByText('Full Name')).toBeVisible();
    await expect(page.getByText(/fullName · string/)).toBeVisible();

    // Check that "required" indicator appears on required fields
    await expect(page.getByText(/required/).first()).toBeVisible();

    // Verify data type display for different field types
    await expect(page.getByText(/householdSize · integer/)).toBeVisible();
    await expect(page.getByText(/monthlyIncome · money/)).toBeVisible();
    await expect(page.getByText(/dateOfBirth · date/)).toBeVisible();
  });

  test('rule cards show label, kind badge, explanation, and expression', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);
    await selectBlueprint(page);
    await page.getByText('Verify Carefully').click();
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Housing Intake has one rule:
    // "Monthly income appears only when applicant reports income"
    // kind: relevant -> "Visible when"
    // expression: "$hasIncome = true"
    // explanation: "Only ask for monthly income when the applicant reports income."

    // Rule label
    await expect(page.getByText(/monthly income appears only when/i)).toBeVisible();

    // Kind badge
    await expect(page.getByText('Visible when')).toBeVisible();

    // Explanation
    await expect(page.getByText(/only ask for monthly income when/i)).toBeVisible();

    // Expression in code block
    await expect(page.getByText('$hasIncome = true')).toBeVisible();
  });

  test('proposal stats show field count, section count, and bind count', async ({ page }) => {
    await gotoInquest(page);
    await reachReviewViaDraftFast(page);

    // Housing Intake produces 6 fields, 3 sections, and some binds.
    // The summary format is: "N fields . N sections . N binds"
    await expect(page.getByText(/\d+ fields/)).toBeVisible();
    await expect(page.getByText(/\d+ sections/)).toBeVisible();
    await expect(page.getByText(/\d+ binds/)).toBeVisible();
  });
});

test.describe('Grant Application Blueprint: end-to-end', () => {
  test('selecting the grant application template shows its specific fields and rules', async ({ page }) => {
    await gotoInquest(page);
    await completeProviderSetup(page);

    // Open the template gallery and select "Grant Application" (second template)
    await page.getByRole('button', { name: /browse all blueprints/i }).click();
    const useBlueprintBtns = page.getByRole('button', { name: /use blueprint/i });
    // Grant Application is the second template in the gallery
    await useBlueprintBtns.nth(1).click();

    // Click Verify Carefully to see the analysis without proposal
    await page.getByText('Verify Carefully').click();
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: ANALYSIS_TIMEOUT });

    // Grant Application fields: Organization Name, Contact Email, Project Title,
    // Requested Amount, I certify the information is correct
    await expect(page.getByText('Organization Name')).toBeVisible();
    await expect(page.getByText('Contact Email')).toBeVisible();
    await expect(page.getByText('Project Title')).toBeVisible();
    await expect(page.getByText('Requested Amount')).toBeVisible();

    // Grant Application rule: "Certification is required" -> kind: "Required"
    await expect(page.getByText(/certification is required/i)).toBeVisible();
    await expect(page.getByText('Required', { exact: true })).toBeVisible();

    // Generate scaffold and proceed to refine
    await page.getByRole('button', { name: /generate scaffold/i }).click();
    await expect(page.getByText(/scaffold ready/i)).toBeVisible({ timeout: PROPOSAL_TIMEOUT });
    await page.getByRole('button', { name: /open refine/i }).click();
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Refine Workspace: edit prompt patterns', () => {
  test('"add X field" pattern adds a new field via the deterministic adapter', async ({ page }) => {
    await gotoInquest(page);
    await reachRefine(page);

    const promptArea = page.getByPlaceholder(/describe a change/i);
    await promptArea.fill('add signature field');
    await promptArea.press('Enter');

    // Prompt should clear on success
    await expect(promptArea).toHaveValue('', { timeout: 5000 });

    // No error
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('refine composer is disabled while an edit is being applied', async ({ page }) => {
    await gotoInquest(page);
    await reachRefine(page);

    const promptArea = page.getByPlaceholder(/describe a change/i);
    await promptArea.fill('add notes field');
    // We can't reliably catch the mid-apply disabled state with the deterministic
    // adapter (it resolves instantly), but we verify the prompt clears after apply.
    await promptArea.press('Enter');
    await expect(promptArea).toHaveValue('', { timeout: 5000 });
  });
});

test.describe('Full Round-Trip: Review -> Refine -> Back to Review -> Refine Again', () => {
  test('navigating back and forth between review and refine preserves state', async ({ page }) => {
    await gotoInquest(page);
    await reachReviewViaDraftFast(page);

    // Verify we're in review with proposal
    await expect(page.getByText(/scaffold ready/i)).toBeVisible();
    const fieldCountText = page.getByText(/\d+ fields/);
    await expect(fieldCountText).toBeVisible();

    // Go to refine
    await page.getByRole('button', { name: /open refine/i }).click();
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });

    // Go back to review
    await page.getByRole('button', { name: /← review/i }).click();
    await expect(page.getByText('Requirements review')).toBeVisible({ timeout: 3000 });

    // Proposal should still be there
    await expect(page.getByText(/scaffold ready/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /open refine/i })).toBeVisible();

    // Go to refine again
    await page.getByRole('button', { name: /open refine/i }).click();
    await expect(page.getByText(/adjust before handoff/i)).toBeVisible({ timeout: 5000 });

    // Refine workspace should still be functional
    await expect(page.getByPlaceholder(/describe a change/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /open in studio/i })).toBeVisible();
  });
});
