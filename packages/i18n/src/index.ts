/**
 * Public surface of `@keel/i18n`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API stays curated.
 *
 * Task 6.1 — `createI18n` factory (the namespace lazy-load contract).
 * Task 6   — will add `I18nProvider`, `useT`, language-switch helpers on
 *            top of the same factory exported here.
 */

export { createI18n, DEFAULT_DETECTION_ORDER } from './create-i18n.ts';

export type { CreateI18nOptions, I18nBackend, KeelI18n } from './types.ts';
