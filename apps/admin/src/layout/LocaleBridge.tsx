/**
 * `LocaleBridge` — keeps i18next's active language in sync with
 * `appStore.locale`.
 *
 * The pattern here is "the store is the single source of truth for
 * locale; everything else subscribes". The Header writes
 * `appStore.locale` when the user picks a language, and this bridge
 * forwards the change to i18next. AntD locale lives in `ThemeBridge`
 * (also reading from the same store) so a single `setLocale` call
 * fans out to both layers in the same React render.
 *
 * Why a separate component instead of inlining the effect into
 * BasicLayout: keeping the i18next coupling here means BasicLayout
 * stays oblivious to react-i18next, and the bridge can be skipped /
 * swapped if we later move to a different i18n library.
 *
 * Implements Requirement 7.4 (language switch updates menu /
 * breadcrumb / tabs without page reload) and 8.3 (changeLanguage
 * triggers the i18next swap that Sider/Tabs/Breadcrumb subscribe to
 * via `useTranslation`).
 */

import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../stores/app.store';

export interface LocaleBridgeProps {
  children: ReactNode;
}

export function LocaleBridge({ children }: LocaleBridgeProps): JSX.Element {
  const locale = useAppStore((s) => s.locale);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language === locale) return;
    // Fire-and-forget. i18next emits a `languageChanged` event before
    // the promise resolves, which `useTranslation` already subscribes
    // to internally — so by the time React reaches the next paint the
    // tree has already re-rendered with translated strings.
    void i18n.changeLanguage(locale);
  }, [locale, i18n]);

  return <>{children}</>;
}
