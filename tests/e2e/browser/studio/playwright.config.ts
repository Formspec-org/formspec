import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium'
    }
  ],
  webServer: {
    command: 'npm run test:serve',
    port: 8080,
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true
  }
});
