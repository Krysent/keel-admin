/**
 * Locale codes supported by the template (Requirement 8 series).
 *
 * Kept as a string literal union so business code can fail fast at the type
 * level when a new locale is introduced. Adding a locale is a deliberate
 * operation: extend this union *and* add the matching language pack under
 * `@keel/i18n` + the business app's `locales/` directory.
 */
export type LocaleCode = 'zh-CN' | 'en-US';

/**
 * Theme mode used by `appStore.theme` (Requirement 9.5).
 */
export type ThemeMode = 'light' | 'dark';
