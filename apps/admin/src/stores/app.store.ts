/**
 * `appStore` — UI shell state: sider collapsed flag, theme mode, locale,
 * and the multi-tab strip.
 *
 * Persistence policy from Requirement 6.6 is *strict*: only `collapsed`,
 * `theme`, and `locale` survive a reload. `tabs` is session-only — the
 * BasicLayout rebuilds it from route navigation events on mount so a
 * persisted-but-stale tab pointing to a permission-revoked route can't
 * leak into the new session.
 *
 * Tabs are deduplicated by `key` and `affix:true` tabs cannot be removed
 * (Requirement 7.3).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LocaleCode, TabItem, ThemeMode } from '@keel/types';

export interface AppState {
  collapsed: boolean;
  theme: ThemeMode;
  locale: LocaleCode;
  /** Open tabs. NOT persisted (Req 6.6). */
  tabs: TabItem[];
}

export interface AppActions {
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: LocaleCode) => void;
  /** Append a tab; no-op when a tab with the same `key` already exists. */
  addTab: (tab: TabItem) => void;
  /** Remove a tab by key. Affixed tabs (`affix: true`) are protected. */
  removeTab: (key: string) => void;
  /** Replace the whole tab list (used by router-driven reconcilers). */
  setTabs: (tabs: TabItem[]) => void;
  /** Restore initial values. Idempotent — see Requirement 6.3 / task 9.2. */
  reset: () => void;
}

export type AppStore = AppState & AppActions;

/**
 * Initial state. Defaults match design.md:
 *   - `collapsed: false`  → sider open by default
 *   - `theme: 'light'`    → iOS light palette is the primary skin
 *   - `locale: 'zh-CN'`   → primary locale; detector overrides when present
 *   - `tabs: []`          → fresh strip on every session
 */
export const INITIAL_APP_STATE: Readonly<AppState> = Object.freeze({
  collapsed: false,
  theme: 'light' as ThemeMode,
  locale: 'zh-CN' as LocaleCode,
  tabs: [] as TabItem[],
});

function freshInitial(): AppState {
  return {
    collapsed: false,
    theme: 'light',
    locale: 'zh-CN',
    tabs: [],
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...freshInitial(),
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      addTab: (tab) =>
        set((s) => (s.tabs.some((t) => t.key === tab.key) ? s : { tabs: [...s.tabs, tab] })),
      removeTab: (key) =>
        set((s) => ({
          tabs: s.tabs.filter((t) => (t.key === key ? Boolean(t.affix) : true)),
        })),
      setTabs: (tabs) => set({ tabs }),
      reset: () => set(freshInitial()),
    }),
    {
      name: 'keel-app',
      storage: createJSONStorage(() => localStorage),
      // Requirement 6.6: persist *only* collapsed / theme / locale.
      // `tabs` is intentionally omitted; the layout rebuilds it from
      // route events at mount time so revoked routes can't leak in.
      partialize: (state) => ({
        collapsed: state.collapsed,
        theme: state.theme,
        locale: state.locale,
      }),
    },
  ),
);
