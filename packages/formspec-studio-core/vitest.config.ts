/** @filedesc Vitest configuration for the formspec-studio-core package. */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@formspec-org/engine/fel-runtime': path.resolve(__dirname, '../formspec-engine/src/fel/fel-api-runtime.ts'),
      '@formspec-org/engine/fel-tools': path.resolve(__dirname, '../formspec-engine/src/fel/fel-api-tools.ts'),
      '@formspec-org/engine/init-formspec-engine': path.resolve(
        __dirname,
        '../formspec-engine/src/init-formspec-engine.ts',
      ),
      '@formspec-org/engine/render': path.resolve(__dirname, '../formspec-engine/src/engine-render-entry.ts'),
      '@formspec-org/engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
      '@formspec-org/core': path.resolve(__dirname, '../formspec-core/src/index.ts'),
      '@formspec-org/webcomponent/default-theme': path.resolve(__dirname, '../formspec-webcomponent/src/default-theme.json'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
