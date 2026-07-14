/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import dsv from '@rollup/plugin-dsv';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  // Pin the tsconfig projects so the plugin does not crawl into stale
  // session worktrees under .claude/worktrees (their tsconfigs fail to parse).
  plugins: [react(), tsconfigPaths({ projects: ['tsconfig.json'] }), dsv()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup-tests.ts'],
    // Anchored to the project root (no `**/` prefix) so running vitest from
    // inside a session worktree still collects that worktree's own tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
