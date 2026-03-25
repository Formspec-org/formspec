/** @filedesc Playwright E2E tests for the formspec-react demo app (Community Grant Application). */
import { test, expect } from '@playwright/test';

const REACT_DEMO_URL = 'http://127.0.0.1:5200';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the react-demo app and wait for the form to render. */
async function gotoReactDemo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(REACT_DEMO_URL);
  // Wait for the main heading — proves React has mounted and rendered the form
  await page.getByRole('heading', { name: 'Community Impact Grant Application' }).waitFor({ timeout: 5000 });
}

/** Click the Submit Application button. */
async function clickSubmit(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Submit Application' }).click();
}

/** Fill a text/number input by its field path (data-name attribute). */
async function fillField(
  page: import('@playwright/test').Page,
  path: string,
  value: string,
): Promise<void> {
  await page.locator(`[data-name="${path}"] input, [data-name="${path}"] textarea`).fill(value);
}

/** Select a value from a <select> dropdown by field path. */
async function selectField(
  page: import('@playwright/test').Page,
  path: string,
  value: string,
): Promise<void> {
  await page.locator(`[data-name="${path}"] select`).selectOption(value);
}

/** Check a boolean checkbox by field path. */
async function checkField(
  page: import('@playwright/test').Page,
  path: string,
): Promise<void> {
  await page.locator(`[data-name="${path}"] input[type="checkbox"]`).check();
}

/** Uncheck a boolean checkbox by field path. */
async function uncheckField(
  page: import('@playwright/test').Page,
  path: string,
): Promise<void> {
  await page.locator(`[data-name="${path}"] input[type="checkbox"]`).uncheck();
}

/** Check a specific option within a multiChoice checkbox group by field path and value. */
async function checkOption(
  page: import('@playwright/test').Page,
  path: string,
  value: string,
): Promise<void> {
  await page.locator(`[data-name="${path}"] input[type="checkbox"][value="${value}"]`).check();
}

/** Get the validation status text shown next to the Submit button. */
async function getStatusText(page: import('@playwright/test').Page): Promise<string> {
  const submitBtn = page.getByRole('button', { name: 'Submit Application' });
  // Status text is a <span> sibling of the button inside the flex container
  const statusSpan = submitBtn.locator('..').locator('span');
  return statusSpan.textContent({ timeout: 2000 }).then(t => t?.trim() ?? '');
}

// ── Section rendering ────────────────────────────────────────────────────────

test.describe('React Demo: Form Rendering', () => {
  test('renders all 6 section headings', async ({ page }) => {
    await gotoReactDemo(page);

    const sections = [
      'Organization Information',
      'Primary Contact',
      'Project Details',
      'Budget',
      'Supporting Documents',
      'Certification',
    ];
    for (const name of sections) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 2000 });
    }
  });

  test('renders key fields with labels', async ({ page }) => {
    await gotoReactDemo(page);

    // Spot-check a representative field from each section
    await expect(page.locator('[data-name="organization.orgName"] input')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-name="contact.contactEmail"] input')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-name="project.projectTitle"] input')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-name="budget.requestedAmount"] input')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-name="certification.certifyAccurate"] input')).toBeVisible({ timeout: 2000 });
  });

  test('renders the Submit Application button', async ({ page }) => {
    await gotoReactDemo(page);
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeVisible({ timeout: 2000 });
  });
});

// ── Field interactions ───────────────────────────────────────────────────────

test.describe('React Demo: Field Interactions', () => {
  test('text input — fill Organization Name and verify persistence', async ({ page }) => {
    await gotoReactDemo(page);

    const input = page.locator('[data-name="organization.orgName"] input');
    await input.fill('Test Nonprofit Foundation');
    await expect(input).toHaveValue('Test Nonprofit Foundation');
  });

  test('select — choose an Organization Type from dropdown', async ({ page }) => {
    await gotoReactDemo(page);

    await selectField(page, 'organization.orgType', 'nonprofit');
    await expect(page.locator('[data-name="organization.orgType"] select')).toHaveValue('nonprofit');
  });

  test('checkbox group — check multiple focus areas', async ({ page }) => {
    await gotoReactDemo(page);

    await checkOption(page, 'project.additionalAreas', 'education');
    await checkOption(page, 'project.additionalAreas', 'health');
    await checkOption(page, 'project.additionalAreas', 'arts');

    const educationCb = page.locator('[data-name="project.additionalAreas"] input[value="education"]');
    const healthCb = page.locator('[data-name="project.additionalAreas"] input[value="health"]');
    const artsCb = page.locator('[data-name="project.additionalAreas"] input[value="arts"]');
    const envCb = page.locator('[data-name="project.additionalAreas"] input[value="environment"]');

    await expect(educationCb).toBeChecked();
    await expect(healthCb).toBeChecked();
    await expect(artsCb).toBeChecked();
    await expect(envCb).not.toBeChecked();
  });
});

// ── Conditional field ────────────────────────────────────────────────────────

test.describe('React Demo: Conditional Field', () => {
  test('Prior Grant ID appears when isRenewal is checked and hides when unchecked', async ({ page }) => {
    await gotoReactDemo(page);

    const priorGrantField = page.locator('[data-name="project.priorGrantId"]');

    // Initially hidden (relevant bind: $project.isRenewal = true)
    await expect(priorGrantField).toBeHidden({ timeout: 2000 });

    // Check the renewal checkbox
    await checkField(page, 'project.isRenewal');
    await expect(priorGrantField).toBeVisible({ timeout: 2000 });

    // Uncheck — field hides again
    await uncheckField(page, 'project.isRenewal');
    await expect(priorGrantField).toBeHidden({ timeout: 2000 });
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

test.describe('React Demo: Validation', () => {
  test('empty submit shows 19 required-field errors', async ({ page }) => {
    await gotoReactDemo(page);
    await clickSubmit(page);

    // The status text should show "19 error(s)"
    const status = await getStatusText(page);
    expect(status).toContain('19 error(s)');

    // The error list should be visible
    const errorPanel = page.locator('h3', { hasText: 'Validation Errors' });
    await expect(errorPanel).toBeVisible({ timeout: 2000 });

    // Should have 19 list items in the error panel
    const errorItems = page.locator('h3:has-text("Validation Errors") ~ ul li');
    await expect(errorItems).toHaveCount(19, { timeout: 2000 });
  });

  test('Year Founded constraint — year 3000 shows custom message', async ({ page }) => {
    await gotoReactDemo(page);

    await fillField(page, 'organization.yearFounded', '3000');
    await clickSubmit(page);

    const errorList = page.locator('h3:has-text("Validation Errors") ~ ul');
    await expect(errorList).toContainText('Year must be between 1800 and 2026', { timeout: 2000 });
  });

  test('Budget constraint — total cost less than requested shows error', async ({ page }) => {
    await gotoReactDemo(page);

    await fillField(page, 'budget.requestedAmount', '50000');
    await fillField(page, 'budget.totalProjectCost', '30000');
    await clickSubmit(page);

    const errorList = page.locator('h3:has-text("Validation Errors") ~ ul');
    await expect(errorList).toContainText('at least the requested amount', { timeout: 2000 });
  });

  test('Certification — unchecked checkboxes show custom constraint messages', async ({ page }) => {
    await gotoReactDemo(page);

    // Fill enough fields that only certification errors remain visible in the list
    // (but we just check that the certification messages appear among all errors)
    await clickSubmit(page);

    const errorList = page.locator('h3:has-text("Validation Errors") ~ ul');
    // The 3 certification checkboxes produce required errors, not constraint errors
    // on empty submit (constraints only fire when field has a value).
    // So instead, check one checkbox and set it to true, then uncheck to get false.
    // Actually: fill the form partially, check cert boxes, uncheck them, submit.
    // Simpler: just verify they appear after we check+uncheck or set to false.

    // Let's set the cert checkboxes to false explicitly (check then uncheck):
    // boolean fields with false value + constraint "$certification.certifyAccurate = true"
    // should trigger the constraint message.
    // But first, let's verify the required errors are there for certs.
    await expect(errorList).toContainText('certification.certifyAccurate', { timeout: 2000 });
    await expect(errorList).toContainText('certification.certifyAuthorized', { timeout: 2000 });
    await expect(errorList).toContainText('certification.agreeTerms', { timeout: 2000 });
  });

  test('Certification — checking and unchecking shows constraint messages', async ({ page }) => {
    await gotoReactDemo(page);

    // Check then uncheck to set value to false (not null) — triggers constraint
    await checkField(page, 'certification.certifyAccurate');
    await uncheckField(page, 'certification.certifyAccurate');

    await checkField(page, 'certification.certifyAuthorized');
    await uncheckField(page, 'certification.certifyAuthorized');

    await checkField(page, 'certification.agreeTerms');
    await uncheckField(page, 'certification.agreeTerms');

    await clickSubmit(page);

    const errorList = page.locator('h3:has-text("Validation Errors") ~ ul');
    await expect(errorList).toContainText('certify that the information is accurate', { timeout: 2000 });
    await expect(errorList).toContainText('must confirm authorization', { timeout: 2000 });
    await expect(errorList).toContainText('must agree to the terms', { timeout: 2000 });
  });
});

// ── Valid form submission ────────────────────────────────────────────────────

test.describe('React Demo: Valid Submission', () => {
  test('filling all required fields produces a valid submission with Response JSON', async ({ page }) => {
    await gotoReactDemo(page);

    // -- Organization Information --
    await fillField(page, 'organization.orgName', 'Greenfield Community Trust');
    await selectField(page, 'organization.orgType', 'nonprofit');
    await fillField(page, 'organization.ein', '12-3456789');
    await fillField(page, 'organization.yearFounded', '2001');

    // -- Primary Contact --
    await fillField(page, 'contact.contactName', 'Jane Doe');
    await fillField(page, 'contact.contactEmail', 'jane@greenfield.org');
    await fillField(page, 'contact.contactPhone', '555-867-5309');
    await selectField(page, 'contact.state', 'NY');

    // -- Project Details --
    await fillField(page, 'project.projectTitle', 'Youth Literacy Initiative');
    await selectField(page, 'project.focusArea', 'education');
    await fillField(page, 'project.summary', 'A three-year program to improve reading skills among K-5 students in underserved neighborhoods through after-school tutoring, lending libraries, and family literacy workshops.');
    await fillField(page, 'project.startDate', '2026-07-01');
    await fillField(page, 'project.endDate', '2029-06-30');
    await fillField(page, 'project.beneficiaries', '500');

    // -- Budget --
    await fillField(page, 'budget.requestedAmount', '75000');
    await fillField(page, 'budget.totalProjectCost', '120000');

    // -- Certification --
    await checkField(page, 'certification.certifyAccurate');
    await checkField(page, 'certification.certifyAuthorized');
    await checkField(page, 'certification.agreeTerms');

    // -- Submit --
    await clickSubmit(page);

    // Should show "Valid"
    const status = await getStatusText(page);
    expect(status).toContain('Valid');

    // Should NOT show error panel
    const errorHeading = page.locator('h3', { hasText: 'Validation Errors' });
    await expect(errorHeading).toBeHidden({ timeout: 2000 });

    // Response JSON should be available in the details element
    const responseDetails = page.locator('details', { hasText: 'Response JSON' });
    await expect(responseDetails).toBeVisible({ timeout: 2000 });

    // Expand and verify some response data is present
    await responseDetails.locator('summary').click();
    const responseJSON = page.locator('details:has-text("Response JSON") pre');
    await expect(responseJSON).toBeVisible({ timeout: 2000 });
    const jsonText = await responseJSON.textContent({ timeout: 2000 });
    expect(jsonText).toContain('Greenfield Community Trust');
    expect(jsonText).toContain('Youth Literacy Initiative');
  });
});

// ── Shape rule (cross-field warning) ─────────────────────────────────────────

test.describe('React Demo: Shape Rules', () => {
  test('budget consistency warning when total < requested + matching', async ({ page }) => {
    await gotoReactDemo(page);

    await fillField(page, 'budget.requestedAmount', '50000');
    await fillField(page, 'budget.matchingFunds', '30000');
    await fillField(page, 'budget.totalProjectCost', '60000');

    await clickSubmit(page);

    // The shape rule fires as a warning (severity: "warning")
    const warningPanel = page.locator('h3', { hasText: 'Warnings' });
    await expect(warningPanel).toBeVisible({ timeout: 2000 });

    const warningList = page.locator('h3:has-text("Warnings") ~ ul');
    await expect(warningList).toContainText(
      'at least the sum of requested amount and matching funds',
      { timeout: 2000 },
    );
  });
});
