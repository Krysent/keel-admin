import { defineConfig } from 'vitest/config';

/**
 * `@keel/types` is types-only, but we still wire vitest so the package can
 * host compile-time / type-level smoke tests (e.g. expectTypeOf assertions)
 * via the shared `pnpm test` task.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    reporters: ['default'],
    watch: false,
  },
});
