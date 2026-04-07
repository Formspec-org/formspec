import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Storybook lives on :6006 — run via `npm run test:storybook:dom` (playwright.storybook.config.ts). */
  testIgnore: ['**/storybook/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run test:serve',
      port: 8080,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run --workspace=formspec-references dev',
      port: 8082,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix examples/react-demo',
      port: 5200,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
