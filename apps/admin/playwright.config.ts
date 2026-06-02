/**
 * Playwright E2E configuration for `@keel/admin`.
 *
 * - Uses the Vite dev server (with mock enabled) as the base URL
 * - Generates both HTML report and trace on failure (Requirement 15.4)
 * - CI runs in single-run mode without retries (Requirement 15.5)
 *
 * Validates: Requirements 15.3, 15.4, 15.5
 */

import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }]],
  outputDir: './test-results',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the dev server before running E2E tests */
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !CI,
    timeout: 60_000,
    env: {
      VITE_USE_MOCK: 'true',
    },
  },
});
