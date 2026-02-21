import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const fixturePath = path.resolve(__dirname, '../fixtures/complex-scenarios.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.describe('Formspec Complex Scenarios', () => {
  test('nested repeatable groups and complex calculations', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    await page.evaluate((data) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = data;
    }, fixture);

    // Scenario 1: Nested Invoice
    // Phase 1, Task 1
    await page.fill('input[name="invoice.phases[0].tasks[0].hours"]', '10');
    await page.fill('input[name="invoice.phases[0].tasks[0].rate"]', '50');
    await expect(page.locator('input[name="invoice.phases[0].tasks[0].taskTotal"]')).toHaveValue('500');
    await expect(page.locator('input[name="invoice.phases[0].phaseSubtotal"]')).toHaveValue('500');
    await expect(page.locator('input[name="invoice.invoiceTotal"]')).toHaveValue('500');
    await expect(page.locator('input[name="invoice.taxRate"]')).toHaveValue('10');
    await expect(page.locator('input[name="invoice.finalAmount"]')).toHaveValue('550');

    // Add Task 2 to Phase 1
    await page.click('button:has-text("Add Tasks in Phase")');
    await page.fill('input[name="invoice.phases[0].tasks[1].hours"]', '5');
    await page.fill('input[name="invoice.phases[0].tasks[1].rate"]', '100');
    await expect(page.locator('input[name="invoice.phases[0].phaseSubtotal"]')).toHaveValue('1000');
    await expect(page.locator('input[name="invoice.invoiceTotal"]')).toHaveValue('1000');
    
    // Add Phase 2, Task 1
    await page.click('button:has-text("Add Project Phases")');
    // Note: The second "Add Tasks in Phase" button belongs to the second phase
    const addTasksBtns = page.locator('button:has-text("Add Tasks in Phase")');
    await addTasksBtns.nth(1).click();
    await page.fill('input[name="invoice.phases[1].tasks[0].hours"]', '2');
    await page.fill('input[name="invoice.phases[1].tasks[0].rate"]', '300');
    
    await expect(page.locator('input[name="invoice.phases[1].phaseSubtotal"]')).toHaveValue('600');
    await expect(page.locator('input[name="invoice.invoiceTotal"]')).toHaveValue('1600');
    
    // Check dynamic tax rate shift
    await expect(page.locator('input[name="invoice.taxRate"]')).toHaveValue('15');
    await expect(page.locator('input[name="invoice.finalAmount"]')).toHaveValue('1840'); // 1600 * 1.15

    // Scenario 2: Travel Itinerary Sequence
    await page.fill('input[name="itinerary[0].arrival"]', '2025-06-01');
    await page.fill('input[name="itinerary[0].departure"]', '2025-06-05');
    await expect(page.locator('input[name="itinerary[0].stayDuration"]')).toHaveValue('4');
    await expect(page.locator('input[name="itinerary[0].travelConflict"]')).toHaveValue('First Stop');

    await page.click('button:has-text("Add Travel Itinerary")');
    await page.fill('input[name="itinerary[1].arrival"]', '2025-06-04'); // Overlap!
    await expect(page.locator('input[name="itinerary[1].travelConflict"]')).toHaveValue('CONFLICT');
    
    await page.fill('input[name="itinerary[1].arrival"]', '2025-06-06'); // OK
    await expect(page.locator('input[name="itinerary[1].travelConflict"]')).toHaveValue('OK');
  });
});
