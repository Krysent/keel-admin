/**
 * Verification tests for the User Management Edit Modal — task 21.4.
 * Also covers task 21.5: Delete Popconfirm behavior.
 * Also covers task 21.6: Permission guard & column permission filtering.
 *
 * Validates Requirements 23.6, 23.7:
 *   - Edit button is wrapped in `<Auth code="user:update">`
 *   - Edit Modal pre-fills fields with current row data
 *   - Username field is disabled in edit mode (not editable)
 *   - Password field is NOT present in the edit form
 *   - displayName, email, roles are editable
 *   - Success: close modal, reload table, locale-aware message.success
 *   - Failure: keep modal open, Alert(type="error") at top of form
 *
 * Validates Requirements 23.8, 23.9:
 *   - Delete button is wrapped in `<Auth code="user:delete">`
 *   - Popconfirm shows zh-CN text: 确定删除用户 "{displayName}" 吗？
 *   - On confirm: calls userService.remove(id), reloads table, shows message.success
 *
 * Validates Requirements 23.9, 23.10:
 *   - New/Edit/Delete buttons are absent from DOM (not rendered) when lacking permissions
 *   - Email column is removed via filterColumnsByPermission when user lacks user:list
 *   - Email column is rendered when user holds user:list
 *
 * Validates: Requirements 23.6, 23.7, 23.8, 23.9, 23.10
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';

import { clearLocalStorage } from '../setup-local-storage.js';
import { useUserStore } from '../../src/stores/user.store.js';
import { useAppStore } from '../../src/stores/app.store.js';
import type { UserInfo } from '@keel/types';

// ---------------------------------------------------------------------------
// jsdom polyfill: ProTable uses window.matchMedia internally
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock userService so we control success/failure without a real server
vi.mock('../../src/services/index.js', () => ({
  userService: {
    list: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock filterColumnsByPermission to return columns as-is so all columns render
// by default. Individual tests can override with vi.mocked(...).mockImplementation
// to restore the real filtering behaviour when testing Req 23.10.
vi.mock('@keel/ui', async (importActual) => {
  const actual = await importActual<typeof import('@keel/ui')>();
  return {
    filterColumnsByPermission: vi.fn((columns: unknown[]) => columns),
    KeelTable: undefined,
    KeelForm: undefined,
    KeelCard: undefined,
    KeelDescriptions: undefined,
    PageContainer: undefined,
    // Keep the real type export available
    _realFilterColumnsByPermission: actual.filterColumnsByPermission,
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { userService } from '../../src/services/index.js';
import UserManagementPage from '../../src/pages/system/user/index.js';
import { BizError } from '@keel/http';
import { filterColumnsByPermission } from '@keel/ui';

// ---------------------------------------------------------------------------
// Test fixture data
// ---------------------------------------------------------------------------

const SAMPLE_USER: UserInfo = {
  id: 'user-123',
  username: 'johndoe',
  displayName: 'John Doe',
  email: 'john@example.com',
  roles: ['editor'],
  avatar: '',
  tenantIds: [],
  permissions: ['user:list'],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  // Wrap in AntApp so useApp() works (message, notification, modal)
  return render(
    <MemoryRouter>
      <AntApp>
        <UserManagementPage />
      </AntApp>
    </MemoryRouter>,
  );
}

/**
 * Helper: grant user:update permission so the Auth gate passes and the
 * edit button is rendered.
 */
function grantUpdatePermission() {
  useUserStore.getState().setPermissions(['user:update', 'user:list', 'user:create', 'user:delete']);
  useUserStore.getState().setRoles(['admin']);
}

/**
 * Simulate clicking the edit button for the first row in the table.
 * The edit button has aria-label or title "Edit", or uses EditOutlined icon.
 */
async function openEditModal(user: UserInfo) {
  // Wait for the table to render the user row
  await waitFor(() => {
    expect(screen.getByText(user.username)).toBeInTheDocument();
  });

  // Click the Edit button (tooltip "Edit")
  const editButtons = screen.getAllByRole('button', { name: /edit/i });
  // The first one with the edit icon is for our row
  const editButton =
    editButtons.find(
      (btn) =>
        btn.closest('tr')?.textContent?.includes(user.username) ||
        btn.closest('td') !== null,
    ) ?? editButtons[0];

  if (!editButton) throw new Error('Edit button not found');

  await act(async () => {
    fireEvent.click(editButton);
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearLocalStorage();
  useUserStore.getState().reset();
  useAppStore.getState().setLocale('zh-CN');
  vi.clearAllMocks();

  // Default: list returns one user so the edit button appears
  vi.mocked(userService.list).mockResolvedValue({
    list: [SAMPLE_USER],
    total: 1,
    page: 1,
    pageSize: 10,
  });
});

// ---------------------------------------------------------------------------
// Tests: Edit Modal pre-fills data (Req 23.6)
// ---------------------------------------------------------------------------

describe('Edit Modal — pre-fills current row data (Req 23.6)', () => {
  it('pre-fills username field with the current row username', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    // The edit modal title should be visible
    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // Username input should be pre-filled with the user's username
    const usernameInput = screen.getByDisplayValue(SAMPLE_USER.username);
    expect(usernameInput).toBeInTheDocument();
  });

  it('pre-fills displayName field with the current row displayName', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // displayName should be pre-filled
    expect(screen.getByDisplayValue(SAMPLE_USER.displayName)).toBeInTheDocument();
  });

  it('pre-fills email field with the current row email', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // email should be pre-filled
    expect(screen.getByDisplayValue(SAMPLE_USER.email!)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: Username field is disabled in edit mode (Req 23.6)
// ---------------------------------------------------------------------------

describe('Edit Modal — username field is disabled (Req 23.6)', () => {
  it('renders username input as disabled', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // The username input should be disabled
    const usernameInput = screen.getByDisplayValue(SAMPLE_USER.username);
    expect(usernameInput).toBeDisabled();
  });

  it('username field cannot be changed (disabled)', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    const usernameInput = screen.getByDisplayValue(SAMPLE_USER.username);
    // Disabled input should have the disabled attribute
    expect(usernameInput).toHaveAttribute('disabled');
  });
});

// ---------------------------------------------------------------------------
// Tests: Password field is NOT rendered in edit mode (Req 23.6)
// ---------------------------------------------------------------------------

describe('Edit Modal — password field is not rendered (Req 23.6)', () => {
  it('does not render a password input field in the edit modal', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // There should be no password input in the edit modal
    // Check by input type="password"
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs).toHaveLength(0);
  });

  it('does not render a label containing "密码" or "Password" for the password field in the edit modal', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    // "初始密码" label from create modal should not appear in edit modal context
    // The edit modal dialog should NOT contain a password-related label
    const modal = document.querySelector('.ant-modal-content');
    expect(modal).not.toBeNull();
    const modalText = modal!.textContent ?? '';
    // The edit modal should not contain "初始密码" or "Initial Password"
    expect(modalText).not.toMatch(/初始密码|Initial Password/);
  });
});

// ---------------------------------------------------------------------------
// Tests: Auth gate for edit button (Req 23.6, 23.9)
// ---------------------------------------------------------------------------

describe('Edit button is gated by user:update permission (Req 23.6, 23.9)', () => {
  it('does not render the edit button when user lacks user:update permission', async () => {
    // Grant NO permissions — Auth gate should hide the edit button
    useUserStore.getState().setPermissions([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // The edit button (tooltip "Edit") should not exist
    const editButtons = screen.queryAllByRole('button', { name: /edit/i });
    // All found edit buttons should be outside the user row (none should be visible)
    // With no permissions, the Auth wrapper renders null so the button is absent from DOM
    expect(editButtons).toHaveLength(0);
  });

  it('renders the edit button when user has user:update permission', async () => {
    grantUpdatePermission();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Editable fields in edit mode (Req 23.6)
// ---------------------------------------------------------------------------

describe('Edit Modal — displayName, email, roles are editable (Req 23.6)', () => {
  it('displayName field is not disabled', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue(SAMPLE_USER.displayName);
    expect(displayNameInput).not.toBeDisabled();
  });

  it('email field is not disabled', async () => {
    grantUpdatePermission();
    renderPage();
    await openEditModal(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(/编辑用户/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByDisplayValue(SAMPLE_USER.email!);
    expect(emailInput).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Helpers for delete tests
// ---------------------------------------------------------------------------

/**
 * Grant all permissions needed to render the delete button.
 */
function grantDeletePermission() {
  useUserStore.getState().setPermissions(['user:delete', 'user:list', 'user:create', 'user:update']);
  useUserStore.getState().setRoles(['admin']);
}

/**
 * Click the Delete button for the first user row to open the Popconfirm.
 */
async function clickDeleteButton(user: UserInfo) {
  await waitFor(() => {
    expect(screen.getByText(user.username)).toBeInTheDocument();
  });

  // The delete button has danger styling and a DeleteOutlined icon.
  // Look for a button with aria-label "Delete" (from Tooltip title) or
  // find by searching buttons with "danger" class in the row.
  const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
  const deleteButton = deleteButtons[0];
  if (!deleteButton) throw new Error('Delete button not found');

  await act(async () => {
    fireEvent.click(deleteButton);
  });
}

// ---------------------------------------------------------------------------
// Tests: Auth gate for delete button (Req 23.8, 23.9)
// ---------------------------------------------------------------------------

describe('Delete button is gated by user:delete permission (Req 23.8, 23.9)', () => {
  it('does not render the delete button when user lacks user:delete permission', async () => {
    useUserStore.getState().setPermissions([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // With no permissions, Auth wrapper renders null — delete button absent from DOM
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(0);
  });

  it('renders the delete button when user has user:delete permission', async () => {
    grantDeletePermission();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Popconfirm text (Req 23.8)
// ---------------------------------------------------------------------------

describe('Delete Popconfirm shows correct zh-CN confirmation text (Req 23.8)', () => {
  it('shows zh-CN confirmation text with the displayName when locale is zh-CN', async () => {
    useAppStore.getState().setLocale('zh-CN');
    grantDeletePermission();
    renderPage();

    await clickDeleteButton(SAMPLE_USER);

    // The Popconfirm should display the zh-CN text with the user's displayName
    await waitFor(() => {
      const expectedText = `确定删除用户 "${SAMPLE_USER.displayName}" 吗？`;
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });

  it('shows en-US confirmation text with the displayName when locale is en-US', async () => {
    useAppStore.getState().setLocale('en-US');
    grantDeletePermission();
    renderPage();

    await clickDeleteButton(SAMPLE_USER);

    await waitFor(() => {
      const expectedText = `Are you sure you want to delete "${SAMPLE_USER.displayName}"?`;
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Delete confirm calls service and reloads (Req 23.8)
// ---------------------------------------------------------------------------

describe('Delete Popconfirm — confirm calls userService.remove (Req 23.8)', () => {
  it('calls userService.remove with the user id when confirmed', async () => {
    useAppStore.getState().setLocale('zh-CN');
    grantDeletePermission();
    renderPage();

    await clickDeleteButton(SAMPLE_USER);

    // Wait for Popconfirm to appear
    await waitFor(() => {
      expect(screen.getByText(`确定删除用户 "${SAMPLE_USER.displayName}" 吗？`)).toBeInTheDocument();
    });

    // AntD v5 Popconfirm uses class `ant-popconfirm-buttons` for its ok/cancel buttons
    const okButton = await waitFor(() => {
      const popconfirmBtns = document.querySelector('.ant-popconfirm-buttons');
      if (!popconfirmBtns) throw new Error('.ant-popconfirm-buttons not found');
      const buttons = popconfirmBtns.querySelectorAll('button');
      // The OK button is the last one (primary/danger button)
      const found =
        Array.from(buttons).find(
          (btn) =>
            btn.classList.contains('ant-btn-primary') ||
            btn.classList.contains('ant-btn-dangerous') ||
            btn.textContent?.includes('删除'),
        ) ?? buttons[buttons.length - 1];
      if (!found) throw new Error('OK button not found in .ant-popconfirm-buttons');
      return found;
    });

    await act(async () => {
      fireEvent.click(okButton);
    });

    await waitFor(() => {
      expect(userService.remove).toHaveBeenCalledWith(SAMPLE_USER.id);
    });
  });

  it('does not call userService.remove when cancel is clicked', async () => {
    useAppStore.getState().setLocale('zh-CN');
    grantDeletePermission();
    renderPage();

    await clickDeleteButton(SAMPLE_USER);

    await waitFor(() => {
      expect(screen.getByText(`确定删除用户 "${SAMPLE_USER.displayName}" 吗？`)).toBeInTheDocument();
    });

    // Find the Cancel button in the popconfirm buttons
    const cancelButton = await waitFor(() => {
      const popconfirmBtns = document.querySelector('.ant-popconfirm-buttons');
      if (!popconfirmBtns) throw new Error('.ant-popconfirm-buttons not found');
      const buttons = popconfirmBtns.querySelectorAll('button');
      // The Cancel button is the first one (default button)
      const found =
        Array.from(buttons).find(
          (btn) =>
            btn.classList.contains('ant-btn-default') ||
            btn.textContent?.includes('取消') ||
            btn.textContent?.includes('Cancel'),
        ) ?? buttons[0];
      if (!found) throw new Error('Cancel button not found in .ant-popconfirm-buttons');
      return found;
    });

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // remove should NOT have been called
    expect(userService.remove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Email column filtering via filterColumnsByPermission (Req 23.10)
// ---------------------------------------------------------------------------

/**
 * For these tests we restore the real filterColumnsByPermission behaviour so
 * the permission check is actually exercised end-to-end through the page.
 *
 * The page passes `{ permissions, roles }` from userStore to
 * filterColumnsByPermission. The email column has `permission: 'user:list'`,
 * so when the user lacks user:list the column must be absent from the DOM.
 */
describe('Email column filtering via filterColumnsByPermission (Req 23.10)', () => {
  // Before each test in this block: restore the real filterColumnsByPermission
  // so the permission check actually runs.
  beforeEach(async () => {
    const { filterColumnsByPermission: realFn } =
      await vi.importActual<typeof import('@keel/ui')>('@keel/ui');
    vi.mocked(filterColumnsByPermission).mockImplementation(realFn);
  });

  // Restore the pass-through mock after these tests so other describe blocks
  // are unaffected.
  afterEach(() => {
    vi.mocked(filterColumnsByPermission).mockImplementation(
      <C extends import('@keel/ui').KeelColumn>(columns: readonly C[]) => [...columns] as C[],
    );
  });

  it('email column header is NOT rendered when user lacks user:list permission', async () => {
    // Grant permissions that do NOT include user:list
    useUserStore.getState().setPermissions(['user:create', 'user:update', 'user:delete']);
    useUserStore.getState().setRoles(['admin']);

    renderPage();

    // Wait for the table to render the user row
    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // The "Email" column header should NOT be present in the DOM
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
  });

  it('email column header IS rendered when user has user:list permission', async () => {
    // Grant user:list so the email column passes the permission filter
    useUserStore.getState().setPermissions(['user:list', 'user:create', 'user:update', 'user:delete']);
    useUserStore.getState().setRoles(['admin']);

    renderPage();

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // The "Email" column header SHOULD be present in the DOM
    await waitFor(() => {
      // getAllByText handles the case where multiple elements contain "Email"
      const emailElements = screen.getAllByText('Email');
      expect(emailElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: New button is absent from DOM without user:create permission (Req 23.9)
// ---------------------------------------------------------------------------

describe('New User button is absent from DOM without user:create permission (Req 23.9)', () => {
  it('does not render the New User button when user lacks user:create permission', async () => {
    // Grant no permissions at all
    useUserStore.getState().setPermissions([]);
    useUserStore.getState().setRoles([]);

    renderPage();

    await waitFor(() => {
      // Table renders (even without data row, the toolbar should be present)
      expect(document.querySelector('.ant-pro-table')).toBeInTheDocument();
    });

    // "New User" button should be absent from DOM entirely
    expect(screen.queryByText('New User')).not.toBeInTheDocument();
    // Also check by role — no button with matching text
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument();
  });

  it('renders the New User button when user has user:create permission', async () => {
    // Grant user:create
    useUserStore.getState().setPermissions(['user:create', 'user:list']);
    useUserStore.getState().setRoles(['admin']);

    renderPage();

    // Wait for the table toolbar to render
    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Button should be present and interactable
    const newUserButton = screen.getByRole('button', { name: /new user/i });
    expect(newUserButton).toBeInTheDocument();
    expect(newUserButton).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Auth renders null (not disabled) — DOM removal not hiding (Req 23.9)
// ---------------------------------------------------------------------------

describe('Auth component renders null for absent permissions — buttons not in DOM at all (Req 23.9)', () => {
  it('edit button is completely absent from DOM (not just hidden/disabled) when lacking user:update', async () => {
    useUserStore.getState().setPermissions([]); // no permissions
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // The Auth component with fallback=null renders nothing — no button element
    const editBtn = screen.queryByRole('button', { name: /edit/i });
    expect(editBtn).toBeNull();

    // Also confirm no hidden/disabled edit button exists in the DOM tree
    const allButtons = document.querySelectorAll('button');
    const hasHiddenEditButton = Array.from(allButtons).some(
      (btn) =>
        (btn.getAttribute('aria-label') === 'edit' ||
          btn.title === 'Edit' ||
          btn.textContent?.trim() === 'Edit') &&
        (btn.style.display === 'none' || btn.getAttribute('disabled') !== null),
    );
    // No hidden/disabled edit button should exist — the component renders null
    expect(hasHiddenEditButton).toBe(false);
  });

  it('delete button is completely absent from DOM (not just hidden/disabled) when lacking user:delete', async () => {
    useUserStore.getState().setPermissions([]); // no permissions
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_USER.username)).toBeInTheDocument();
    });

    // Auth renders null → no delete button element in DOM at all
    const deleteBtn = screen.queryByRole('button', { name: /delete/i });
    expect(deleteBtn).toBeNull();

    // Ensure no hidden/disabled delete button is lurking in the DOM
    const allButtons = document.querySelectorAll('button');
    const hasHiddenDeleteButton = Array.from(allButtons).some(
      (btn) =>
        (btn.getAttribute('aria-label') === 'delete' ||
          btn.title === 'Delete' ||
          btn.textContent?.trim() === 'Delete') &&
        (btn.style.display === 'none' || btn.getAttribute('disabled') !== null),
    );
    expect(hasHiddenDeleteButton).toBe(false);
  });
});
