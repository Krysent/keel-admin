/**
 * `ThemeBridge` — wraps children in an AntD `<ConfigProvider />` whose
 * `theme` prop tracks `appStore.theme` so toggling theme is a runtime
 * config swap rather than a page reload (Requirement 9.5 / 7.5).
 *
 * Both `themeConfig` and `darkThemeConfig` from `@keel/theme` ship with
 * `cssVar: true`, so AntD writes design tokens as CSS variables under
 * `:root` and the swap turns into a single style recomputation. The
 * tree below us doesn't unmount — confirmed by AntD's own ConfigProvider
 * source (the `theme` prop is passed through React context, not used
 * as a key).
 *
 * Locale is also wired here because the AntD `ConfigProvider.locale`
 * has to flip in the same render as the i18next language change to
 * keep AntD's own components (DatePicker, Pagination, etc.) in step
 * with the rest of the UI (Requirement 8.3).
 */

import { themeConfig, darkThemeConfig } from '@keel/theme';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useMemo, type ReactNode } from 'react';

import { useAppStore } from '../stores/app.store';

import type { Locale } from 'antd/es/locale';

/**
 * Map our `LocaleCode` union to AntD's locale bundles.
 *
 * Adding a new locale: extend `LocaleCode` in `@keel/types/locale.ts`,
 * import the matching `antd/locale/<lng>` bundle here, and add the
 * mapping. The compiler will flag any missing branch.
 */
const ANTD_LOCALES: Record<'zh-CN' | 'en-US', Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export interface ThemeBridgeProps {
  children: ReactNode;
}

export function ThemeBridge({ children }: ThemeBridgeProps): JSX.Element {
  const theme = useAppStore((s) => s.theme);
  const locale = useAppStore((s) => s.locale);

  // Memoize so ConfigProvider doesn't see a fresh object on every
  // re-render of the layout — it's stable identity that lets AntD's
  // internal `useMemo` short-circuit work.
  const config = useMemo(() => (theme === 'dark' ? darkThemeConfig : themeConfig), [theme]);

  // Mirror the active theme onto a `data-theme` attribute on <html> so
  // plain CSS (index.less) can target dark mode for surfaces AntD tokens
  // alone don't cover — e.g. the indigo sider gradient in the UI spec.
  // This runs as a layout effect-equivalent before paint so there's no
  // light → dark flash on first render.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider theme={config} locale={ANTD_LOCALES[locale]}>
      {children}
    </ConfigProvider>
  );
}
