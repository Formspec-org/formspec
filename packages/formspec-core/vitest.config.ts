/** @filedesc Vitest configuration for the formspec-core package. */
import { defineConfig } from 'vitest/config';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  resolve: {
    alias: {
      'formspec-engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
