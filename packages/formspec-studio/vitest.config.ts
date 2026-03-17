/** @filedesc Vitest configuration for the formspec-studio package (happy-dom, package aliases). */
import { defineConfig } from 'vitest/config';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      'formspec-chat': path.resolve(repoRoot, 'packages/formspec-chat/src/index.ts'),
      'formspec-studio-core': path.resolve(repoRoot, 'packages/formspec-studio-core/src/index.ts'),
      'formspec-engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
      'formspec-webcomponent': path.resolve(repoRoot, 'packages/formspec-webcomponent/dist/index.js'),
      'formspec-webcomponent/formspec-base.css': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-base.css'),
      'formspec-webcomponent/formspec-base.css?url': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-base.css')
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}']
  }
});
