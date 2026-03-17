/** @filedesc Playwright config for formspec-studio chat E2E tests (real API calls, serial). */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'chat-e2e.spec.ts',
  fullyParallel: false, // Run serially — these are real API calls
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'VITE_GEMINI_DEV_KEY=AIzaSyCYAy6PIZw664oLQg4CM8DOf86x15TYD1s npx vite --port 5174',
    url: 'http://localhost:5174/chat.html',
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 30000,
  },
});
