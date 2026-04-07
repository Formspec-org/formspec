/** @filedesc Vitest configuration for the formspec-studio package (happy-dom, package aliases). */
import { defineConfig } from 'vitest/config';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@formspec-org/chat': path.resolve(repoRoot, 'packages/formspec-chat/src/index.ts'),
      '@formspec-org/studio-core': path.resolve(repoRoot, 'packages/formspec-studio-core/src/index.ts'),
      '@formspec-org/engine/init-formspec-engine': path.resolve(
        repoRoot,
        'packages/formspec-engine/src/init-formspec-engine.ts',
      ),
      '@formspec-org/engine/render': path.resolve(repoRoot, 'packages/formspec-engine/src/engine-render-entry.ts'),
      '@formspec-org/engine/fel-runtime': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-runtime.ts'),
      '@formspec-org/engine/fel-tools': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-tools.ts'),
      '@formspec-org/engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
      // Subpaths must precede the package root alias
      '@formspec-org/webcomponent/formspec-layout.css': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-layout.css'),
      '@formspec-org/webcomponent/formspec-layout.css?url': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-layout.css'),
      '@formspec-org/webcomponent/formspec-default.css': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-default.css'),
      '@formspec-org/webcomponent/formspec-default.css?url': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-default.css'),
      '@formspec-org/webcomponent': path.resolve(repoRoot, 'packages/formspec-webcomponent/dist/index.js')
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}']
  }
});
