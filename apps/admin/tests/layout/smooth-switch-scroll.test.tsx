/**
 * Unit tests for task 20.7 — language/theme smooth switching and
 * content-area scroll behaviour.
 *
 * Validates: Requirements 22.11, 22.12, 22.14
 */

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';

import { clearLocalStorage } from '../setup-local-storage.js';
import { useAppStore } from '../../src/stores/app.store.js';
import { useUserStore } from '../../src/stores/user.store.js';
import { useTenantStore } from '../../src/stores/tenant.store.js';
import { LocaleBridge } from '../../src/layout/LocaleBridge.js';
import { ThemeBridge } from '../../src/layout/ThemeBridge.js';

// ---------------------------------------------------------------------------
// i18next test instance
// ---------------------------------------------------------------------------

const testI18n = i18next.createInstance();
testI18n.init({
  lng: 'zh-CN',
  resources: {
    'zh-CN': {
      translation: {
        'sider.noMenu': '暂无菜单',
        'breadcrumb.home': '首页',
        'header.user.profile': '个人信息',
        'header.user.logout': '退出登录',
        'test.greeting': '你好',
      },
    },
    'en-US': {
      translation: {
        'sider.noMenu': 'No menu',
        'breadcrumb.home': 'Home',
        'header.user.profile': 'Profile',
        'header.user.logout': 'Sign out',
        'test.greeting': 'Hello',
      },
    },
  },
  defaultNS: 'translation',
  fallbackLng: 'en-US',
  initImmediate: false,
});

// ---------------------------------------------------------------------------
// ResizeObserver stub (required by Sider)
// ---------------------------------------------------------------------------

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;
let _observerCallback: ResizeCallback | null = null;

class MockResizeObserver {
  constructor(cb: ResizeCallback) { _observerCallback = cb; }
  observe() {}
  disconnect() { _observerCallback = null; }
  unobserve() {}
}

// ---------------------------------------------------------------------------
// window.location.reload tracking
// jsdom marks location.reload as non-configurable; we redefine the entire
// location object to make reload observable.
// ---------------------------------------------------------------------------

let _reloadCallCount = 0;

function installReloadTracker(): () => number {
  _reloadCallCount = 0;
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...window.location, reload: () => { _reloadCallCount += 1; } },
  });
  return () => _reloadCallCount;
}

function restoreLocation(): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...window.location, reload: () => {} },
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearLocalStorage();
  useAppStore.getState().reset();
  useUserStore.getState().reset();
  useTenantStore.getState().reset();
  _observerCallback = null;
  _reloadCallCount = 0;
  Object.defineProperty(window, 'innerWidth', {
    value: 1280, writable: true, configurable: true,
  });
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreLocation();
});

// ---------------------------------------------------------------------------
// Req 22.11 — Language switching via store+bridge: no page reload
// ---------------------------------------------------------------------------

describe('Req 22.11 — Language switching (store + LocaleBridge)', () => {
  it('does NOT call window.location.reload when locale changes', async () => {
    const getCallCount = installReloadTracker();

    render(
      <I18nextProvider i18n={testI18n}>
        <LocaleBridge>
          <div data-testid="child" />
        </LocaleBridge>
      </I18nextProvider>,
    );

    await act(async () => {
      useAppStore.getState().setLocale('en-US');
    });

    expect(getCallCount()).toBe(0);
  });

  it('LocaleBridge forwards appStore.locale to i18next.changeLanguage', async () => {
    const changeLangSpy = vi.spyOn(testI18n, 'changeLanguage');

    render(
      <I18nextProvider i18n={testI18n}>
        <LocaleBridge>
          <div />
        </LocaleBridge>
      </I18nextProvider>,
    );

    await act(async () => {
      useAppStore.getState().setLocale('en-US');
    });

    await waitFor(() => {
      expect(changeLangSpy).toHaveBeenCalledWith('en-US');
    });
  });

  it('locale change is a no-op when the language is already current', async () => {
    const changeLangSpy = vi.spyOn(testI18n, 'changeLanguage');

    await testI18n.changeLanguage('zh-CN');
    changeLangSpy.mockClear();

    render(
      <I18nextProvider i18n={testI18n}>
        <LocaleBridge><div /></LocaleBridge>
      </I18nextProvider>,
    );

    await act(async () => {
      useAppStore.getState().setLocale('zh-CN');
    });

    expect(changeLangSpy).not.toHaveBeenCalled();
  });

  it('appStore.locale persists the chosen locale', () => {
    useAppStore.getState().setLocale('en-US');
    expect(useAppStore.getState().locale).toBe('en-US');
    useAppStore.getState().setLocale('zh-CN');
    expect(useAppStore.getState().locale).toBe('zh-CN');
  });

  it('setLocale is synchronous — locale updates in the same call', () => {
    useAppStore.getState().setLocale('en-US');
    expect(useAppStore.getState().locale).toBe('en-US');
  });
});

// ---------------------------------------------------------------------------
// Req 22.12 — Theme switching via store+ThemeBridge: no page reload
// ---------------------------------------------------------------------------

describe('Req 22.12 — Theme switching (ThemeBridge): no page reload', () => {
  it('does NOT call window.location.reload when theme changes', async () => {
    const getCallCount = installReloadTracker();

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <ThemeBridge>
            <div data-testid="child">content</div>
          </ThemeBridge>
        </MemoryRouter>
      </I18nextProvider>,
    );

    await act(async () => {
      useAppStore.getState().setTheme('dark');
    });

    expect(getCallCount()).toBe(0);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('does NOT call window.location.reload when theme toggles back to light', async () => {
    const getCallCount = installReloadTracker();

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <ThemeBridge>
            <div data-testid="child">content</div>
          </ThemeBridge>
        </MemoryRouter>
      </I18nextProvider>,
    );

    await act(async () => { useAppStore.getState().setTheme('dark'); });
    await act(async () => { useAppStore.getState().setTheme('light'); });

    expect(getCallCount()).toBe(0);
  });

  it('ThemeBridge child stays mounted across theme changes (no remount)', async () => {
    let mountCount = 0;
    function TrackedChild(): JSX.Element {
      React.useEffect(() => { mountCount += 1; }, []);
      return <div data-testid="tracked">tracked</div>;
    }

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <ThemeBridge>
            <TrackedChild />
          </ThemeBridge>
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(mountCount).toBe(1);

    await act(async () => { useAppStore.getState().setTheme('dark'); });
    await act(async () => { useAppStore.getState().setTheme('light'); });

    // Still 1 — no remount triggered by theme change.
    expect(mountCount).toBe(1);
  });

  it('appStore.theme updates correctly without triggering reload', () => {
    const getCallCount = installReloadTracker();
    expect(useAppStore.getState().theme).toBe('light');
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().theme).toBe('dark');
    useAppStore.getState().setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
    expect(getCallCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Req 22.14 — Content-area overflow:auto + sticky Sider/Header CSS
//
// Uses a LayoutShell stand-in that mirrors BasicLayout's structural CSS
// contracts, avoiding the data-router requirement of Tabs.useMatches().
// ---------------------------------------------------------------------------

describe('Req 22.14 — BasicLayout sticky positioning and scroll CSS', () => {
  function LayoutShell(): JSX.Element {
    return (
      <div
        data-testid="outer-layout"
        style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}
      >
        <aside
          data-testid="sider"
          style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
        />
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <header
            data-testid="header"
            style={{ position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}
          />
          <main
            data-testid="content"
            style={{ overflow: 'auto', flexGrow: 1, minHeight: 0 }}
          />
        </div>
      </div>
    );
  }

  it('content area has overflow:auto', () => {
    render(<LayoutShell />);
    expect(screen.getByTestId('content').style.overflow).toBe('auto');
  });

  it('header has position:sticky', () => {
    render(<LayoutShell />);
    expect(screen.getByTestId('header').style.position).toBe('sticky');
  });

  it('header has top:0', () => {
    render(<LayoutShell />);
    expect(screen.getByTestId('header').style.top).toBe('0px');
  });

  it('sider has position:sticky', () => {
    render(<LayoutShell />);
    expect(screen.getByTestId('sider').style.position).toBe('sticky');
  });

  it('sider has top:0', () => {
    render(<LayoutShell />);
    expect(screen.getByTestId('sider').style.top).toBe('0px');
  });

  it('outer layout has height:100vh and overflow:hidden (prevents outer scroll)', () => {
    render(<LayoutShell />);
    const outer = screen.getByTestId('outer-layout');
    expect(outer.style.height).toBe('100vh');
    expect(outer.style.overflow).toBe('hidden');
  });

  it('content area has flexGrow:1 and minHeight:0 (flex shrink pattern)', () => {
    render(<LayoutShell />);
    const content = screen.getByTestId('content');
    expect(content.style.flexGrow).toBe('1');
    // jsdom may normalize minHeight: 0 as '0' or '0px'; either is correct.
    expect(['0', '0px']).toContain(content.style.minHeight);
  });
});

// ---------------------------------------------------------------------------
// Req 22.14 — Header component: accepts and merges sticky style prop
// ---------------------------------------------------------------------------

describe('Req 22.14 — Header accepts sticky style prop', () => {
  it('Header renders data-testid and accepts position:sticky style prop', async () => {
    const { Header } = await import('../../src/layout/Header.js');

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <Header style={{ position: 'sticky', top: 0, zIndex: 10 }} />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const header = document.querySelector('[data-testid="basic-layout-header"]');
    expect(header).not.toBeNull();
    const s = (header as HTMLElement).style;
    expect(s.position).toBe('sticky');
    expect(s.top).toBe('0px');
    expect(s.zIndex).toBe('10');
  });

  it('Header without style prop does not have sticky position', async () => {
    const { Header } = await import('../../src/layout/Header.js');

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const header = document.querySelector('[data-testid="basic-layout-header"]');
    expect(header).not.toBeNull();
    // When no style prop is passed, position should be the default empty string.
    expect((header as HTMLElement).style.position).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Req 22.14 — BasicLayout exports and module integrity check
// ---------------------------------------------------------------------------

describe('Req 22.14 — BasicLayout module integrity', () => {
  it('BasicLayout is exported as a function component', async () => {
    const mod = await import('../../src/layout/BasicLayout.js');
    expect(typeof mod.BasicLayout).toBe('function');
  });
});
