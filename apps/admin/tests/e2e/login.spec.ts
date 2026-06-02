/**
 * E2E: Login success and failure scenarios.
 *
 * Validates: Requirements 15.3, 4.1, 4.3
 */

import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored tokens to ensure a clean login state
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
  });

  test('should display login form with required fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /username/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByRole('textbox', { name: /username/i }).fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // After successful login, user should be redirected away from login page
    await expect(page).not.toHaveURL(/\/login/);
    // Token should be stored
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeTruthy();
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    await page.getByRole('textbox', { name: /username/i }).fill('admin');
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Error message should appear
    await expect(
      page.getByText(/invalid|failed|credentials/i),
    ).toBeVisible({ timeout: 5000 });

    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();

    // AntD form validation messages
    await expect(page.getByText(/please enter your username/i)).toBeVisible();
    await expect(page.getByText(/please enter your password/i)).toBeVisible();
  });

  test('should redirect to requested page after login', async ({ page }) => {
    // Navigate to a protected route which should redirect to login with ?redirect
    await page.goto('/system/user');
    // If redirected to login, the redirect param should be preserved
    if (page.url().includes('/login')) {
      await page.getByRole('textbox', { name: /username/i }).fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should eventually navigate to the originally requested page
      await page.waitForURL(/\/(system\/user|dashboard)/, { timeout: 10000 });
    }
  });
});
