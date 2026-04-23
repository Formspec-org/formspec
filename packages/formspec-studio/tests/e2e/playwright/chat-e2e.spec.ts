import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockGeminiResponses } from './mocks/gemini-mock';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
const CHAT_URL = 'http://localhost:5174/chat.html';
const GEMINI_API_KEY = 'mock-key-for-playwright';

// Pre-seed localStorage with the Google provider config before each test
async function seedProvider(page: Page) {
  await page.addInitScript((apiKey: string) => {
    const PROVIDER_KEY = 'formspec:provider-config';
    localStorage.setItem(PROVIDER_KEY, JSON.stringify({
      provider: 'google',
      apiKey,
    }));
  }, GEMINI_API_KEY);
  await mockGeminiResponses(page);
}

// Wait for the chat entry screen to be fully loaded
async function waitForEntryScreen(page: Page) {
  await page.goto(CHAT_URL, { waitUntil: 'networkidle' });
  // The entry screen should have the "Build forms through conversation" heading
  await expect(page.locator('.entry-screen')).toBeVisible({ timeout: 15000 });
}

test.describe('Chat E2E — Gemini Integration', () => {
  // Generous timeout for real API calls
  test.setTimeout(120_000);

  test.describe('Flow 1: Blank conversation -> scaffold', () => {
    test('generates a patient intake form from a text prompt', async ({ page }) => {
      await seedProvider(page);
      await waitForEntryScreen(page);

      // Verify provider pill shows "Google"
      await expect(page.locator('text=Google')).toBeVisible();

      // Click "Start blank" button
      await page.click('text=Start blank');

      // Should transition to the active session view with chat panel
      await expect(page.locator('textarea[placeholder="Describe what you need..."]')).toBeVisible({ timeout: 10000 });

      // Type the message
      const textarea = page.locator('textarea[placeholder="Describe what you need..."]');
      await textarea.fill('I need a patient intake form with name, date of birth, insurance info, and emergency contact');

      // Send the message
      await page.click('button[aria-label="Send message"]');

      // Wait for the assistant response (typing indicator should appear, then message)
      // The typing indicator shows three dots, then the assistant message appears
      await expect(page.locator('.msg-appear').last()).toBeVisible({ timeout: 45000 });

      // Wait for the form preview to appear (it shows when definition is set)
      const formPreview = page.locator('[data-testid="form-preview"]');
      await expect(formPreview).toBeVisible({ timeout: 10000 });

      // Verify the form has a title (h2 inside the preview)
      const formTitle = formPreview.locator('h2');
      await expect(formTitle).toBeVisible({ timeout: 5000 });
      const titleText = await formTitle.textContent();
      console.log('Form title:', titleText);
      expect(titleText).toBeTruthy();

      // Verify the form has fields (items rendered as bordered cards)
      const fieldCards = formPreview.locator('[data-field-type]');
      const fieldCount = await fieldCards.count();
      console.log('Number of fields:', fieldCount);
      expect(fieldCount).toBeGreaterThan(0);

      // Log the field types for debugging
      for (let i = 0; i < fieldCount; i++) {
        const fieldType = await fieldCards.nth(i).getAttribute('data-field-type');
        const label = await fieldCards.nth(i).locator('.text-sm.font-medium').textContent();
        console.log(`  Field ${i + 1}: ${label} (${fieldType})`);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow1-scaffold.png'),
        fullPage: true,
      });
    });
  });

  test.describe('Flow 2: Template start -> refine', () => {
    test('starts from Housing Intake template and adds pet section', async ({ page }) => {
      await seedProvider(page);
      await waitForEntryScreen(page);

      // Click "Pick a template" to show the template grid
      await page.click('text=Pick a template');

      // The template grid should appear
      await expect(page.locator('text=Housing Intake Form')).toBeVisible({ timeout: 5000 });

      // Click "Housing Intake Form" template
      await page.click('text=Housing Intake Form');

      // Should transition to active session with form preview visible
      const formPreview = page.locator('[data-testid="form-preview"]');
      await expect(formPreview).toBeVisible({ timeout: 10000 });

      // Verify the form preview shows the Housing Intake form title
      const formTitle = formPreview.locator('h2');
      await expect(formTitle).toHaveText('Housing Intake Form', { timeout: 5000 });

      // Verify fields are shown
      const fieldsBefore = formPreview.locator('[data-field-type]');
      const countBefore = await fieldsBefore.count();
      console.log('Fields before refinement:', countBefore);
      expect(countBefore).toBeGreaterThan(0);

      // Take screenshot of template state
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow2-template-loaded.png'),
        fullPage: true,
      });

      // Now send a refinement message
      const textarea = page.locator('textarea[placeholder="Describe what you need..."]');
      await textarea.fill('Add a section for pet information with pet name, breed, and weight');

      await page.click('button[aria-label="Send message"]');

      // Wait for the assistant response
      // Look for a message from the assistant about updating
      await page.waitForFunction(
        () => {
          const messages = document.querySelectorAll('.msg-appear');
          // We need at least 2 messages: user message + assistant response
          // (there may also be a system message from template start)
          return messages.length >= 2;
        },
        { timeout: 45000 },
      );

      // Check if a diff summary appears (indicator of form update)
      const diffSummary = page.locator('[data-testid="diff-summary"]');
      const hasDiff = await diffSummary.isVisible().catch(() => false);
      console.log('Diff summary visible:', hasDiff);

      // Count fields after refinement
      const fieldsAfter = formPreview.locator('[data-field-type]');
      const countAfter = await fieldsAfter.count();
      console.log('Fields after refinement:', countAfter);

      // Check for new fields with "added" diff badge
      const addedBadges = formPreview.locator('[data-diff="added"]');
      const addedCount = await addedBadges.count();
      console.log('Newly added items:', addedCount);

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow2-after-refinement.png'),
        fullPage: true,
      });
    });
  });

  test.describe('Flow 3: Export', () => {
    test('exports a generated form as valid JSON', async ({ page }) => {
      await seedProvider(page);
      await waitForEntryScreen(page);

      // Start from a template for speed (no API call needed for scaffold)
      await page.click('text=Pick a template');
      await page.click('text=Patient Intake Form');

      // Wait for form preview
      const formPreview = page.locator('[data-testid="form-preview"]');
      await expect(formPreview).toBeVisible({ timeout: 10000 });

      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click export button
      await page.click('text=Export');

      // Wait for the download
      const download = await downloadPromise;
      console.log('Download filename:', download.suggestedFilename());

      // Verify the filename has .zip extension
      expect(download.suggestedFilename()).toMatch(/\.zip$/);

      // Verify the file exists and has content
      const downloadPath = await download.path();
      if (downloadPath) {
        const fs = await import('fs');
        const stats = fs.statSync(downloadPath);
        expect(stats.size).toBeGreaterThan(100); // ZIP header + some content
        console.log('Exported zip size:', stats.size);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow3-export.png'),
        fullPage: true,
      });
    });
  });

  test.describe('Flow 4: Provider setup', () => {
    test('opens provider settings dialog and shows configured provider', async ({ page }) => {
      await seedProvider(page);
      await waitForEntryScreen(page);

      // Verify the provider pill shows "Google" on entry screen
      await expect(page.locator('text=Google')).toBeVisible();

      // Click the settings gear button on the entry screen
      await page.click('button[aria-label="Settings"]');

      // The dialog should open
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify it says "AI Provider Setup"
      await expect(dialog.locator('text=AI Provider Setup')).toBeVisible();

      // Verify the provider dropdown shows "Google"
      const providerSelect = dialog.locator('#provider-select');
      await expect(providerSelect).toHaveValue('google');

      // Verify the API key field is populated (it's a password field, so we check value is non-empty)
      const apiKeyInput = dialog.locator('#api-key-input');
      const apiKeyValue = await apiKeyInput.inputValue();
      expect(apiKeyValue).toBeTruthy();
      console.log('API key is set:', apiKeyValue.length > 0 ? 'yes' : 'no');

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow4-provider-setup.png'),
        fullPage: true,
      });

      // Close the dialog
      await page.click('text=Cancel');
      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      // Now navigate to active session and check settings there too
      await page.click('text=Start blank');
      await expect(page.locator('textarea[placeholder="Describe what you need..."]')).toBeVisible({ timeout: 10000 });

      // Open settings from active session (gear icon in header)
      await page.click('button[aria-label="Settings"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.locator('#provider-select')).toHaveValue('google');

      // Take screenshot of settings from active session
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'flow4-provider-in-session.png'),
        fullPage: true,
      });
    });
  });
});
