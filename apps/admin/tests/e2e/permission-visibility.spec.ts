/**
 * E2E: Button-level permission visibility.
 *
 * Verifies that UI elements wrapped in `<Auth code="..." />` are visible
 * when the user holds the required permission, and hidden otherwise.
 *
 * Uses route interception to simulate different permission sets.
 *
 * Validates: Requirements 15.3, 4.4, 3.4
 */

import { test, expect } from '@playwright/test';

/**
 * Helper: login and set up the page with a given set of permissions.
 */
async function loginWithPermissions(
  page: import('@playwright/test').Page,
  permissions: string[],
) {
  // Intercept permissions endpoint to return custom set
  await page.route('**/api/user/permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: permissions, message: 'ok' }),
    });
  });

  // Intercept profile to include the custom permissions
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        data: {
          id: '1',
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          avatar: '',
          tenantIds: ['tenant-1'],
          permissions,
          roles: ['admin'],
        },
        message: 'ok',
      }),
    });
  });

  // Login
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username/i }).fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe('Button-level Permission Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('admin user should see all CRUD buttons (create, edit, delete)', async ({ page }) => {
    await loginWithPermissions(page, [
      'user:list',
      'user:create',
      'user:update',
      'user:delete',
      'order:list',
      'tenant:switch',
    ]);

    await page.goto('/system/user');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // "New User" button should be visible (requires user:create)
    await expect(page.getByRole('button', { name: /new user/i })).toBeVisible({ timeout: 5000 });

    // Edit buttons should be visible in table rows (requires user:update)
    const editButtons = page.locator('[aria-label="Edit"], button:has([class*="anticon-edit"])');
    if (await page.getByRole('table').isVisible()) {
      const count = await editButtons.count();
      expect(count).toBeGreaterThan(0);
    }

    // Delete buttons should be visible (requires user:delete)
    const deleteButtons = page.locator('[aria-label="Delete"], button:has([class*="anticon-delete"])');
    if (await page.getByRole('table').isVisible()) {
      const count = await deleteButtons.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('viewer user should not see create/edit/delete buttons', async ({ page }) => {
    // Viewer only has list permission
    await loginWithPermissions(page, ['user:list', 'order:list']);

    await page.goto('/system/user');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // "New User" button should NOT be visible (no user:create)
    await expect(page.getByRole('button', { name: /new user/i })).not.toBeVisible({ timeout: 3000 });

    // Edit and delete buttons should NOT be visible
    const editButtons = page.locator('[aria-label="Edit"], button:has([class*="anticon-edit"])');
    await expect(editButtons).toHaveCount(0, { timeout: 3000 });

    const deleteButtons = page.locator('[aria-label="Delete"], button:has([class*="anticon-delete"])');
    await expect(deleteButtons).toHaveCount(0, { timeout: 3000 });
  });

  test('user with partial permissions should see only allowed buttons', async ({ page }) => {
    // User can create and list, but not update or delete
    await loginWithPermissions(page, ['user:list', 'user:create']);

    await page.goto('/system/user');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // "New User" should be visible (has user:create)
    await expect(page.getByRole('button', { name: /new user/i })).toBeVisible({ timeout: 5000 });

    // Edit buttons should NOT be visible (no user:update)
    const editButtons = page.locator('[aria-label="Edit"], button:has([class*="anticon-edit"])');
    await expect(editButtons).toHaveCount(0, { timeout: 3000 });

    // Delete buttons should NOT be visible (no user:delete)
    const deleteButtons = page.locator('[aria-label="Delete"], button:has([class*="anticon-delete"])');
    await expect(deleteButtons).toHaveCount(0, { timeout: 3000 });
  });
});
