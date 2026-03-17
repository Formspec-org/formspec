/** @filedesc Vitest configuration for the formspec-chat package. */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'formspec-engine': path.resolve(__dirname, '../formspec-engine/src/index.ts'),
      'formspec-core': path.resolve(__dirname, '../formspec-core/src/index.ts'),
      'formspec-studio-core': path.resolve(__dirname, '../formspec-studio-core/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
