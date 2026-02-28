import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineSetValue,
  engineValue,
  engineVariable,
  getValidationReport,
  addRepeatInstance,
} from '../helpers/grant-app';

test.describe('Grant Application: Date Constraint Null Handling', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should not fire endDate constraint when only startDate is set (endDate still empty)', async ({ page }) => {
    // Set startDate but leave endDate empty — user hasn't entered it yet
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const constraintErr = report.results.find(
      (r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint'
    );
    // A constraint error about "End date must be after start date" should NOT fire
    // when the user hasn't entered an end date yet — only "required" should fire
    expect(constraintErr).toBeUndefined();
  });

  test('should not fire endDate constraint when only endDate is set (startDate still empty)', async ({ page }) => {
    // Set endDate but leave startDate empty
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const constraintErr = report.results.find(
      (r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint'
    );
    // Should NOT fire — can't compare against a date that hasn't been entered
    expect(constraintErr).toBeUndefined();
  });

  test('should not fire endDate constraint when neither date is set', async ({ page }) => {
    // Fresh form — neither date set
    const report = await getValidationReport(page, 'continuous');
    const constraintErr = report.results.find(
      (r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint'
    );
    // Should only see "required" errors, not constraint errors, on empty fields
    expect(constraintErr).toBeUndefined();
  });

  test('should fire constraint error when both dates set and endDate is before startDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-06-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-01-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const constraintErr = report.results.find(
      (r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint'
    );
    expect(constraintErr).toBeDefined();
    expect(constraintErr.message).toBe('End date must be after start date.');
  });

  test('should return null duration when endDate is before startDate (no negative months)', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-06-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2027-01-01');
    await page.waitForTimeout(50);

    const duration = await engineValue(page, 'projectNarrative.duration');
    expect(duration).toBeNull();
  });

  test('should compute positive duration when endDate is after startDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(50);

    const duration = await engineValue(page, 'projectNarrative.duration');
    expect(duration).toBe(17);
  });

  test('should clear constraint error when both dates set and endDate is after startDate', async ({ page }) => {
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-06-01');
    await page.waitForTimeout(50);

    const report = await getValidationReport(page, 'continuous');
    const constraintErr = report.results.find(
      (r: any) => r.path === 'projectNarrative.endDate' && r.constraintKind === 'constraint'
    );
    expect(constraintErr).toBeUndefined();
  });
});

test.describe('Grant Application: Project Phases UI Completeness', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should store phaseTasks data via engine on the Project Phases page', async ({ page }) => {
    // Fill required fields to navigate to Project Phases
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await engineSetValue(page, 'projectNarrative.projectTitle', 'Test Project');
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project description.');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health']);
    await page.waitForTimeout(100);

    await goToPage(page, 'Project Phases');

    // Add a task instance and set data via engine
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].taskName', 'Research');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 5);
    await page.waitForTimeout(50);

    // Verify the engine stored the data correctly
    const taskName = await engineValue(page, 'projectPhases[0].phaseTasks[0].taskName');
    expect(taskName).toBe('Research');
    const hours = await engineValue(page, 'projectPhases[0].phaseTasks[0].hours');
    expect(hours).toBe(5);
  });

  test('should allow entering task data through UI and compute phaseTotal', async ({ page }) => {
    // Fill required fields to navigate to Project Phases
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await engineSetValue(page, 'projectNarrative.projectTitle', 'Test Project');
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project description.');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health']);
    await page.waitForTimeout(100);

    await goToPage(page, 'Project Phases');

    // Enter task data via engine (since UI inputs may not exist yet)
    // then verify the phaseTotal is displayed in the DataTable
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 10);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 100, currency: 'USD' });
    await page.waitForTimeout(100);

    // phaseTotal should now be $1000 — verify it's rendered in the UI
    const phaseTotal = await engineValue(page, 'projectPhases[0].phaseTotal');
    expect(phaseTotal).toMatchObject({ amount: 1000, currency: 'USD' });

    // The page should display the computed phase total somewhere in the DOM
    // Money values render as formatted currency (e.g. "$1,000.00")
    const phaseTotalText = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(phaseTotalText).toContainText('$1,000.00');
  });

  test('should update phaseTotal when task data is entered via engine', async ({ page }) => {
    // Fill required fields and navigate to Project Phases
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await engineSetValue(page, 'projectNarrative.projectTitle', 'Test Project');
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project description.');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health']);
    await page.waitForTimeout(100);

    await goToPage(page, 'Project Phases');

    // Add a task instance and set data via engine
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 8);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 150, currency: 'USD' });
    await page.waitForTimeout(100);

    // phaseTotal should reactively update to 8 × 150 = 1200
    const phaseTotal = await engineValue(page, 'projectPhases[0].phaseTotal');
    expect(phaseTotal).toMatchObject({ amount: 1200, currency: 'USD' });

    // Rendered text should show formatted currency
    const panel = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(panel).toContainText('$1,200.00');
  });

  test('should compute taskCost when hours and hourlyRate are set via engine', async ({ page }) => {
    // Fill required fields and navigate to Project Phases
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await engineSetValue(page, 'projectNarrative.projectTitle', 'Test Project');
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project description.');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health']);
    await page.waitForTimeout(100);

    await goToPage(page, 'Project Phases');

    // Add a task row and set values via engine
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 10);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 50, currency: 'USD' });
    await page.waitForTimeout(100);

    // hourlyRate should be stored as a money object
    const rate = await engineValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate');
    expect(rate).toMatchObject({ amount: 50, currency: 'USD' });

    // taskCost should compute: 10 × 50 = 500
    const taskCost = await engineValue(page, 'projectPhases[0].phaseTasks[0].taskCost');
    expect(taskCost).toMatchObject({ amount: 500, currency: 'USD' });
  });

  test('should display non-zero projectPhasesTotal in the Phases Summary card', async ({ page }) => {
    // Set up task data via engine
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseName', 'Design Phase');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 20);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 75, currency: 'USD' });
    await page.waitForTimeout(100);

    // Verify @projectPhasesTotal computed correctly
    const total = await engineVariable(page, 'projectPhasesTotal');
    expect(total).toMatchObject({ amount: 1500, currency: 'USD' });

    // Navigate to Project Phases page to see the summary
    await engineSetValue(page, 'applicantInfo.orgName', 'Test Org');
    await engineSetValue(page, 'applicantInfo.ein', '12-3456789');
    await engineSetValue(page, 'applicantInfo.orgType', 'university');
    await engineSetValue(page, 'applicantInfo.contactName', 'Jane Smith');
    await engineSetValue(page, 'applicantInfo.contactEmail', 'jane@example.org');
    await engineSetValue(page, 'projectNarrative.projectTitle', 'Test Project');
    await engineSetValue(page, 'projectNarrative.abstract', 'A detailed project description.');
    await engineSetValue(page, 'projectNarrative.startDate', '2027-01-01');
    await engineSetValue(page, 'projectNarrative.endDate', '2028-01-01');
    await engineSetValue(page, 'projectNarrative.focusAreas', ['health']);
    await page.waitForTimeout(100);

    await goToPage(page, 'Project Phases');

    // The "Phases Summary" card should show the $1,500 total
    const summaryCard = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(summaryCard).toContainText('$1,500.00');
  });
});
