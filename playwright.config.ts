import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
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
  ],
});
