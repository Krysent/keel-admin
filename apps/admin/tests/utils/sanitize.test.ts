/**
 * Unit tests for the DOMPurify sanitise utility.
 *
 * Validates: Requirement 18.2 — rich text rendered in the application MUST
 * be sanitised to remove XSS vectors.
 */

import { describe, expect, it } from 'vitest';
import { sanitize, createSanitizedMarkup } from '../../src/utils/sanitize';

describe('sanitize()', () => {
  it('passes through safe HTML unchanged', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(sanitize(html)).toBe(html);
  });

  it('strips inline script tags', () => {
    const dirty = '<p>hello</p><script>alert("xss")</script>';
    expect(sanitize(dirty)).toBe('<p>hello</p>');
  });

  it('strips event handlers', () => {
    const dirty = '<img src="x" onerror="alert(1)" />';
    const result = sanitize(dirty);
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: protocol in href', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const result = sanitize(dirty);
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe formatting tags', () => {
    const html = '<ul><li><em>item</em></li></ul>';
    expect(sanitize(html)).toBe(html);
  });

  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });
});

describe('createSanitizedMarkup()', () => {
  it('returns an object with __html key containing sanitised content', () => {
    const dirty = '<p>safe</p><script>bad</script>';
    const result = createSanitizedMarkup(dirty);
    expect(result).toEqual({ __html: '<p>safe</p>' });
  });
});
