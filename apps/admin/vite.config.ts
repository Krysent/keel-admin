/**
 * Vite configuration for `@keel/admin`.
 *
 * Integrates vite-plugin-mock conditionally based on VITE_USE_MOCK env var.
 * Mock is disabled in production builds (Requirement 11.2).
 *
 * Validates: Requirements 11.1, 11.2, 12.1
 */

import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { viteMockServe } from 'vite-plugin-mock';

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
