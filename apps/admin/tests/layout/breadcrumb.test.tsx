/**
 * Unit tests for the `Breadcrumb` component — task 20.4.
 *
 * Tests cover Requirement 22.4:
 *   - WHEN route path changes THEN Breadcrumb updates within 200ms
 *     (synchronously on re-render) with the ancestor chain from
 *     `userStore.menus`, root node is "首页" / "Home".
 *   - Format: "首页 / 一级菜单 / 二级菜单"
 *   - IF current route is NOT in the menu tree THEN only shows homepage
 *     node.
 *
 * Validates: Requirements 22.4
 */

import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { Breadcrumb } from '../../src/layout/Breadcrumb.ts';
import { useUserStore } from '../../src/stores/user.store.ts';
import { clearLocalStorage } from '../setup-local-storage.ts';

import type { MenuNode } from '@keel/types';

// ---------------------------------------------------------------------------
// i18next test instance
// ---------------------------------------------------------------------------

const testI18n = i18next.createInstance();
testI18n.init({
  lng: 'zh-CN',
  resources: {
    'zh-CN': {
      translation: {
        'breadcrumb.home': '首页',
        'menu.dashboard': '仪表盘',
        'menu.system': '系统管理',
        'menu.user': '用户管理',
        'menu.role': '角色管理',
      },
    },
    'en-US': {
      translation: {
        'breadcrumb.home': 'Home',
        'menu.dashboard': 'Dashboard',
        'menu.system': 'System',
        'menu.user': 'Users',
        'menu.role': 'Roles',
      },
    },
  },
  defaultNS: 'translation',
  fallbackLng: 'en-US',
  initImmediate: false,
});

// ---------------------------------------------------------------------------
// Menu tree fixture
// ---------------------------------------------------------------------------

const MENUS: MenuNode[] = [
  {
    id: '1',
    title: 'menu.dashboard',
    path: '/dashboard',
  },
  {
    id: '2',
    title: 'menu.system',
    path: '/system',
    children: [
      { id: '2-1', title: 'menu.user', path: '/system/user' },
      { id: '2-2', title: 'menu.role', path: '/system/role', hidden: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderBreadcrumb(pathname: string) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[pathname]}>
        <Breadcrumb />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearLocalStorage();
  useUserStore.getState().reset();
  useUserStore.getState().setMenus(MENUS);
  // Ensure we're in zh-CN for most tests
  testI18n.changeLanguage('zh-CN');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Breadcrumb — root node is always 首页/Home (Req 22.4)', () => {
  it('always renders the home node as the first item in zh-CN', () => {
    renderBreadcrumb('/dashboard');
    expect(screen.getByText('首页')).toBeInTheDocument();
  });

  it('always renders the home node as the first item in en-US', async () => {
    await testI18n.changeLanguage('en-US');
    renderBreadcrumb('/dashboard');
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('home node links to "/"', () => {
    renderBreadcrumb('/dashboard');
    const homeLink = screen.getByText('首页').closest('a');
    expect(homeLink).not.toBeNull();
    expect(homeLink?.getAttribute('href')).toBe('/');
  });
});

describe('Breadcrumb — ancestor chain format "一级菜单 / 二级菜单" (Req 22.4)', () => {
  it('renders top-level route: "首页 / 仪表盘"', () => {
    renderBreadcrumb('/dashboard');
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });

  it('renders nested route: "首页 / 系统管理 / 用户管理"', () => {
    renderBreadcrumb('/system/user');
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('系统管理')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
  });

  it('renders ancestor chain in correct order (home first)', () => {
    renderBreadcrumb('/system/user');
    // All three segments must be present in the document
    const homeEl = screen.getByText('首页');
    const sysEl = screen.getByText('系统管理');
    const userEl = screen.getByText('用户管理');

    // Verify document order: 首页 comes before 系统管理, which comes before 用户管理
    expect(homeEl.compareDocumentPosition(sysEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sysEl.compareDocumentPosition(userEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('traverses hidden-flag nodes in the chain (hidden route is still in tree)', () => {
    renderBreadcrumb('/system/role');
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('系统管理')).toBeInTheDocument();
    expect(screen.getByText('角色管理')).toBeInTheDocument();
  });
});

describe('Breadcrumb — route not in menu tree → only homepage (Req 22.4)', () => {
  it('shows only the home node when pathname is unknown', () => {
    renderBreadcrumb('/not-in-menus');
    expect(screen.getByText('首页')).toBeInTheDocument();
    // None of the menu labels should appear
    expect(screen.queryByText('仪表盘')).toBeNull();
    expect(screen.queryByText('系统管理')).toBeNull();
  });

  it('shows only the home node for /exception/403', () => {
    renderBreadcrumb('/exception/403');
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.queryByText('仪表盘')).toBeNull();
  });

  it('shows only the home node when menus are empty', () => {
    useUserStore.getState().setMenus([]);
    renderBreadcrumb('/dashboard');
    expect(screen.getByText('首页')).toBeInTheDocument();
    // No menu label rendered
    expect(screen.queryByText('仪表盘')).toBeNull();
  });
});

describe('Breadcrumb — updates on route path change (Req 22.4)', () => {
  it('renders different crumbs for different pathnames', () => {
    // First render at /dashboard
    const { unmount: unmount1 } = renderBreadcrumb('/dashboard');
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.queryByText('用户管理')).toBeNull();
    unmount1();

    // Second render at /system/user
    const { unmount: unmount2 } = renderBreadcrumb('/system/user');
    expect(screen.queryByText('仪表盘')).toBeNull();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    unmount2();
  });

  it('reflects menu store changes immediately on re-render', () => {
    // Start with empty menus — only home shown
    useUserStore.getState().setMenus([]);
    const { rerender, unmount } = renderBreadcrumb('/dashboard');
    expect(screen.queryByText('仪表盘')).toBeNull();

    // Set menus and re-render same pathname
    useUserStore.getState().setMenus(MENUS);
    rerender(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Breadcrumb />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    unmount();
  });
});
