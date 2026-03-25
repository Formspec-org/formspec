/** @filedesc Vitest configuration for the formspec-chat package. */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Subpaths before `formspec-engine` so Vite does not treat them as package subpaths on the main alias.
      'formspec-engine/fel-runtime': path.resolve(__dirname, '../formspec-engine/src/fel/fel-api-runtime.ts'),
      'formspec-engine/fel-tools': path.resolve(__dirname, '../formspec-engine/src/fel/fel-api-tools.ts'),
      'formspec-engine/init-formspec-engine': path.resolve(
        __dirname,
        '../formspec-engine/src/init-formspec-engine.ts',
      ),
      'formspec-engine/render': path.resolve(__dirname, '../formspec-engine/src/engine-render-entry.ts'),
      'formspec-engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
      'formspec-core': path.resolve(__dirname, '../formspec-core/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
