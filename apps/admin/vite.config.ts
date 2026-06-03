/**
 * Vite configuration for `@keel/admin`.
 *
 * Integrates vite-plugin-mock conditionally based on VITE_USE_MOCK env var.
 * Mock is disabled in production builds (Requirement 11.2).
 *
 * Validates: Requirements 11.1, 11.2, 12.1, 23.12
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteMockServe } from 'vite-plugin-mock';

/**
 * Vite plugin that verifies @ant-design/pro-components is installed before
 * the build starts. If the package cannot be resolved, the build is interrupted
 * with an actionable error message.
 *
 * Validates: Requirement 23.12
 */
function checkProComponents(): Plugin {
  return {
    name: 'keel:check-pro-components',
    buildStart() {
      const require = createRequire(import.meta.url);
      try {
        require.resolve('@ant-design/pro-components');
      } catch {
        const message =
          '@ant-design/pro-components not found. Install it with: ' +
          'pnpm add @ant-design/pro-components --filter @keel/admin';
        console.error(`\n[keel:check-pro-components] ERROR: ${message}\n`);
        throw new Error(message);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMock = env.VITE_USE_MOCK === 'true';
  const isProduction = mode === 'production';

  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [
      // Check that @ant-design/pro-components is installed before building
      checkProComponents(),
      react(),
      // Mock plugin: enabled only when VITE_USE_MOCK=true AND not production build
      viteMockServe({
        mockPath: 'mock',
        enable: useMock && !isProduction,
        logger: true,
      }),
    ],
    server: {
      port: 3000,
      open: true,
    },
    build: {
      // Production builds never include mock code (Requirement 11.2)
      rollupOptions: {
        external: isProduction ? [] : undefined,
      },
    },
  };
});
