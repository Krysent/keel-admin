/**
 * E2E: Token expiry auto-refresh.
 *
 * Simulates token expiry by intercepting API responses with 401 and
 * verifying the app transparently refreshes the token and retries.
 *
 * Validates: Requirements 15.3, 5.2, 5.3, 17.2
 */

import { test, expect } from '@playwright/test';

test.describe('Token Auto-Refresh', () => {
  test.beforeEach(async ({ page }) => {
    // Login first to get a valid session
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await page.getByRole('textbox', { name: /username/i }).fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Wait for navigation away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should refresh token transparently when API returns 401', async ({ page }) => {
    let refreshCalled = false;
    let retryAttempted = false;

    // Intercept API requests to simulate a 401 followed by token refresh
    await page.route('**/api/users*', async (route, request) => {
      if (!retryAttempted) {
        // First request: simulate 401 (token expired)
        retryAttempted = true;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 40100, data: null, message: 'Token expired' }),
        });
      } else {
        // Retry after refresh: let it pass through
        await route.continue();
      }
    });

    await page.route('**/api/auth/refresh', async (route) => {
      refreshCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: {
            accessToken: 'refreshed-token-' + Date.now(),
            refreshToken: 'refreshed-refresh-' + Date.now(),
            expiresAt: Date.now() + 7200000,
          },
          message: 'ok',
        }),
      });
    });

    // Navigate to a page that triggers API calls
    await page.goto('/system/user');
    await page.waitForTimeout(3000);

    // The refresh endpoint should have been called
    expect(refreshCalled).toBe(true);
  });

  test('should redirect to login when refresh token is also expired', async ({ page }) => {
    // Intercept all API requests to return 401
    await page.route('**/api/**', async (route, request) => {
      const url = request.url();
      if (url.includes('/auth/refresh')) {
        // Refresh also fails
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 40100, data: null, message: 'Refresh token expired' }),
        });
      } else if (url.includes('/auth/login') || url.includes('/auth/logout')) {
        await route.continue();
      } else {
        // All other API calls fail with 401
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 40100, data: null, message: 'Token expired' }),
        });
      }
    });

    // Navigate to a protected page
    await page.goto('/system/user');

    // Should eventually redirect back to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
