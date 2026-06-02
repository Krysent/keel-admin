import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    reporters: ['default'],
    // PBT runs can be a bit slow on cold machines; give them headroom.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    watch: false,
  },
});
