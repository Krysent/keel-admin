/**
 * E2E: User Management CRUD full flow.
 *
 * Tests the complete Create → Read → Update → Delete cycle on the
 * user management page under mock mode.
 *
 * Validates: Requirements 15.3, 20.3, 20.4
 */

import { test, expect } from '@playwright/test';

test.describe('User Management CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await page.getByRole('textbox', { name: /username/i }).fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // Navigate to user management
    await page.goto('/system/user');
    await page.waitForLoadState('networkidle');
  });

  test('should display user list with table', async ({ page }) => {
    // Table should be visible with user data
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // Should show at least one user row
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test('should search users by keyword', async ({ page }) => {
    // Fill in the search input
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('admin');

    // Click search button
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForTimeout(1000);

    // Table should still be visible with filtered results
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should create a new user', async ({ page }) => {
    // Click "New User" button
    const createBtn = page.getByRole('button', { name: /new user/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Modal should appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/create user/i)).toBeVisible();

    // Fill in the form
    await modal.getByLabel(/username/i).fill('newuser');
    await modal.getByLabel(/display name/i).fill('New Test User');
    await modal.getByLabel(/email/i).fill('newuser@example.com');
    await modal.getByLabel(/password/i).fill('Password123!');

    // Submit
    await modal.getByRole('button', { name: /ok/i }).click();

    // Modal should close and success message should appear
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing user', async ({ page }) => {
    // Wait for table data
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click the edit button on the first row
    const editBtn = page.locator('[aria-label="Edit"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
    } else {
      // Fallback: look for edit icon button
      const editIcon = page.locator('button').filter({ has: page.locator('[class*="anticon-edit"]') }).first();
      await editIcon.click();
    }

    // Modal should appear in edit mode
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/edit user/i)).toBeVisible();

    // Update display name
    const displayNameInput = modal.getByLabel(/display name/i);
    await displayNameInput.clear();
    await displayNameInput.fill('Updated User Name');

    // Submit
    await modal.getByRole('button', { name: /ok/i }).click();

    // Modal should close and success message should appear
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a user with confirmation', async ({ page }) => {
    // Wait for table data
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click the delete button on the first row
    const deleteBtn = page.locator('[aria-label="Delete"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    } else {
      // Fallback: look for delete icon button
      const deleteIcon = page.locator('button').filter({ has: page.locator('[class*="anticon-delete"]') }).first();
      await deleteIcon.click();
    }

    // Confirmation popover should appear
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });

    // Confirm deletion
    await page.getByRole('button', { name: /delete/i }).last().click();

    // Success message should appear
    await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should support pagination', async ({ page }) => {
    // Table should show pagination
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // Look for pagination element
    const pagination = page.locator('.ant-pagination');
    if (await pagination.isVisible()) {
      // Should show total count
      await expect(page.getByText(/total/i)).toBeVisible();
    }
  });
});
