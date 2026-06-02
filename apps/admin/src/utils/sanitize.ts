/**
 * Rich-text sanitisation utility powered by DOMPurify.
 *
 * Every component that renders user-supplied or backend-provided HTML
 * MUST pass the content through `sanitize()` before rendering.
 * This is enforced at the lint level by banning raw `dangerouslySetInnerHTML`
 * — the only sanctioned path is through this helper.
 *
 * Validates: Requirement 18.2
 */

import DOMPurify from 'dompurify';

/**
 * Sanitise an HTML string, removing potential XSS vectors while preserving
 * safe formatting markup (bold, italic, links, lists, etc.).
 *
 * @param dirty - The raw HTML string to clean.
 * @returns A sanitised HTML string safe for rendering.
 */
export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty);
}

/**
 * Sanitise and return a `__html` object suitable for React's
 * `dangerouslySetInnerHTML`. Use this in the rare cases where you
 * need to render sanitised rich text inside a React element.
 *
 * @example
 * ```tsx
 * import { createSanitizedMarkup } from '@/utils/sanitize';
 * <div dangerouslySetInnerHTML={createSanitizedMarkup(htmlFromApi)} />
 * ```
 */
export function createSanitizedMarkup(dirty: string): { __html: string } {
  return { __html: sanitize(dirty) };
}
