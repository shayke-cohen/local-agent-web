import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    loader: 'jsx',
    include: ['src/**/*.js', 'src/**/*.jsx', 'tests/**/*.js', 'tests/**/*.jsx'],
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx', 'src/**/*.test.js'],
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/client/**', 'jsdom'],
      ['tests/vanilla/**', 'jsdom'],
    ],
    testTimeout: 15000,
    hookTimeout: 10000,
    pool: 'forks',
    setupFiles: ['./tests/setup.js'],
  },
});
