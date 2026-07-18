import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 *
 * Runs against local API (port 3000) and Next.js web (port 3001).
 * Assumes both are already running (`pnpm dev` in api and web packages).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start local servers before running tests */
  webServer: [
    {
      command: 'cd ../api && npx tsx src/server.ts',
      port: 3000,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx next dev --port 3001',
      port: 3001,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
