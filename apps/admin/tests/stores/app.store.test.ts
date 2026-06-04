/**
 * Smoke tests for `appStore`.
 *
 * Key contracts:
 *   - Requirement 6.6: persist *only* collapsed / theme / locale.
 *     `tabs` must NOT appear in the persisted JSON.
 *   - Requirement 7.3: `affix:true` tabs are protected from `removeTab`.
 *   - `addTab` deduplicates by `key` to avoid duplicate strip entries.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore, INITIAL_APP_STATE } from '../../src/stores/app.store.ts';
import { clearLocalStorage, getInstalledStorage } from '../setup-local-storage.ts';

import type { TabItem } from '@keel/types';

const TAB_HOME: TabItem = { key: '/home', title: 'Home', path: '/home', affix: true };
const TAB_USER: TabItem = { key: '/system/user', title: 'Users', path: '/system/user' };

beforeEach(() => {
  clearLocalStorage();
  useAppStore.getState().reset();
});

describe('appStore — settings', () => {
  it('has the documented defaults (collapsed=false, light, zh-CN)', () => {
    const s = useAppStore.getState();
    expect(s.collapsed).toBe(INITIAL_APP_STATE.collapsed);
    expect(s.theme).toBe(INITIAL_APP_STATE.theme);
    expect(s.locale).toBe(INITIAL_APP_STATE.locale);
  });

  it('toggleCollapsed flips the flag', () => {
    useAppStore.getState().toggleCollapsed();
    expect(useAppStore.getState().collapsed).toBe(true);
    useAppStore.getState().toggleCollapsed();
    expect(useAppStore.getState().collapsed).toBe(false);
  });

  it('setTheme / setLocale update the slice', () => {
    useAppStore.getState().setTheme('dark');
    useAppStore.getState().setLocale('en-US');
    const s = useAppStore.getState();
    expect(s.theme).toBe('dark');
    expect(s.locale).toBe('en-US');
  });
});

describe('appStore — tabs', () => {
  it('addTab appends new tabs', () => {
    useAppStore.getState().addTab(TAB_HOME);
    useAppStore.getState().addTab(TAB_USER);
    expect(useAppStore.getState().tabs).toEqual([TAB_HOME, TAB_USER]);
  });

  it('addTab deduplicates by key', () => {
    useAppStore.getState().addTab(TAB_HOME);
    useAppStore.getState().addTab(TAB_HOME);
    expect(useAppStore.getState().tabs).toHaveLength(1);
  });

  it('removeTab keeps affixed tabs (Requirement 7.3)', () => {
    const api = useAppStore.getState();
    api.addTab(TAB_HOME);
    api.addTab(TAB_USER);
    api.removeTab(TAB_HOME.key);
    const tabs = useAppStore.getState().tabs;
    expect(tabs.find((t) => t.key === TAB_HOME.key)).toBeDefined();
  });

  it('removeTab drops non-affixed tabs', () => {
    const api = useAppStore.getState();
    api.addTab(TAB_HOME);
    api.addTab(TAB_USER);
    api.removeTab(TAB_USER.key);
    const tabs = useAppStore.getState().tabs;
    expect(tabs.find((t) => t.key === TAB_USER.key)).toBeUndefined();
  });

  it('reset clears tabs back to []', () => {
    useAppStore.getState().addTab(TAB_USER);
    useAppStore.getState().reset();
    expect(useAppStore.getState().tabs).toEqual([]);
  });
});

describe('appStore — persistence policy (Requirement 6.6)', () => {
  it('persisted blob excludes tabs', async () => {
    // Trigger a write through *every* setter so persist definitely flushed.
    useAppStore.getState().setCollapsed(true);
    useAppStore.getState().setTheme('dark');
    useAppStore.getState().setLocale('en-US');
    useAppStore.getState().addTab(TAB_USER);

    // Allow the persist middleware microtask to flush.
    await Promise.resolve();

    const raw = getInstalledStorage().getItem('keel-app');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version?: number;
    };
    // The persist middleware wraps state under `state`. We verify the
    // expected keys are present and `tabs` is not.
    expect(parsed.state).toHaveProperty('collapsed', true);
    expect(parsed.state).toHaveProperty('theme', 'dark');
    expect(parsed.state).toHaveProperty('locale', 'en-US');
    expect(parsed.state).not.toHaveProperty('tabs');
  });
});
