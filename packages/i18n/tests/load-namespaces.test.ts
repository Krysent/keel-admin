import { describe, expect, it, vi } from 'vitest';

import { createI18n } from '../src/index.js';

/**
 * Task 6.1 — namespace lazy-load verification (example-based).
 *
 * Validates: Requirement 8.2
 *   "WHEN 应用首屏加载 THEN 系统 SHALL 仅同步加载 `common` 命名空间，
 *    其它业务命名空间在进入对应路由前懒加载"
 *
 * The fixture installs a fake i18next backend whose `read` is a `vi.fn()`,
 * letting us assert *exactly* how many times each namespace was fetched.
 * That is the observable signal that lazy-loading works: a route change
 * into a new module triggers one fetch; re-entering does nothing; mixing
 * old and new namespaces in one call only fetches the new ones.
 */
describe('@keel/i18n — namespace lazy-load (Requirement 8.2)', () => {
  it('preloads only `common` synchronously during init', async () => {
    const reads = vi.fn(
      (
        _lng: string,
        _ns: string,
        cb: (err: unknown, data: Record<string, unknown>) => void,
      ) => {
        cb(null, { hello: 'world' });
      },
    );

    await createI18n({
      fallbackLng: 'en-US',
      supportedLngs: ['en-US', 'zh-CN'],
      backend: { read: reads },
    });

    // i18next walks the supportedLngs chain (`en-US` → `en` → fallback)
    // when seeding a namespace, so we assert by namespace name rather
    // than total call count to stay robust against that fan-out.
    const commonReads = reads.mock.calls.filter((c) => c[1] === 'common');
    expect(commonReads.length).toBeGreaterThanOrEqual(1);

    // No other namespace should have been touched at init time.
    const nonCommon = reads.mock.calls.filter((c) => c[1] !== 'common');
    expect(nonCommon).toEqual([]);
  });

  it('only fetches each business namespace once across repeated route entries', async () => {
    const reads = vi.fn(
      (
        _lng: string,
        _ns: string,
        cb: (err: unknown, data: Record<string, unknown>) => void,
      ) => {
        cb(null, {});
      },
    );

    const i18n = await createI18n({
      fallbackLng: 'en-US',
      supportedLngs: ['en-US'],
      backend: { read: reads },
    });

    const fetchesFor = (ns: string) =>
      reads.mock.calls.filter((c) => c[1] === ns).length;

    // Simulated route change: enter the `order` module for the first time.
    await i18n.loadNamespaces('order');
    expect(fetchesFor('order')).toBe(1);

    // Re-entering the same module must NOT trigger another fetch — both
    // the string and array forms should hit the idempotency cache.
    await i18n.loadNamespaces('order');
    await i18n.loadNamespaces(['order']);
    expect(fetchesFor('order')).toBe(1);

    // Entering a brand-new module triggers exactly one new fetch.
    await i18n.loadNamespaces('user');
    expect(fetchesFor('user')).toBe(1);
    // ...and `order` is still untouched.
    expect(fetchesFor('order')).toBe(1);

    // Mixed call — only the namespace we haven't seen yet (`audit`) should
    // hit the backend; `order` and `user` stay at one fetch each.
    await i18n.loadNamespaces(['order', 'user', 'audit']);
    expect(fetchesFor('audit')).toBe(1);
    expect(fetchesFor('order')).toBe(1);
    expect(fetchesFor('user')).toBe(1);
  });
});
