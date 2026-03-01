import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  goToPage,
  engineSetValue,
  engineValue,
  engineVariable,
  addRepeatInstance,
} from '../helpers/grant-app';

test.describe('Grant Application: Project Phases UI Completeness', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  test('should allow entering task data through UI and compute phaseTotal', async ({ page }) => {
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

    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 10);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 100, currency: 'USD' });
    await page.waitForTimeout(100);

    const phaseTotal = await engineValue(page, 'projectPhases[0].phaseTotal');
    expect(phaseTotal).toMatchObject({ amount: 1000, currency: 'USD' });

    const phaseTotalText = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(phaseTotalText).toContainText('$1,000.00');
  });

  test('should update phaseTotal when task data is entered via engine', async ({ page }) => {
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

    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 8);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 150, currency: 'USD' });
    await page.waitForTimeout(100);

    const phaseTotal = await engineValue(page, 'projectPhases[0].phaseTotal');
    expect(phaseTotal).toMatchObject({ amount: 1200, currency: 'USD' });

    const panel = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(panel).toContainText('$1,200.00');
  });

  test('should display non-zero projectPhasesTotal in the Phases Summary card', async ({ page }) => {
    await addRepeatInstance(page, 'projectPhases[0].phaseTasks');
    await engineSetValue(page, 'projectPhases[0].phaseName', 'Design Phase');
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hours', 20);
    await engineSetValue(page, 'projectPhases[0].phaseTasks[0].hourlyRate', { amount: 75, currency: 'USD' });
    await page.waitForTimeout(100);

    const total = await engineVariable(page, 'projectPhasesTotal');
    expect(total).toMatchObject({ amount: 1500, currency: 'USD' });

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

    const summaryCard = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    await expect(summaryCard).toContainText('$1,500.00');
  });
});
