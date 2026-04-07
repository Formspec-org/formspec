import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  base: '/studio/',
  appType: 'mpa',
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': '{}',
  },
  resolve: {
    alias: {
      'react': path.resolve(repoRoot, 'node_modules/react'),
      'react-dom': path.resolve(repoRoot, 'node_modules/react-dom'),
      '@formspec-org/studio-core': path.resolve(repoRoot, 'packages/formspec-studio-core/src/index.ts'),
      '@formspec-org/core': path.resolve(repoRoot, 'packages/formspec-core/src/index.ts'),
      '@formspec-org/types': path.resolve(repoRoot, 'packages/formspec-types/src/index.ts'),
      // Subpaths must precede the package root alias — otherwise `@formspec-org/engine/foo` resolves as `index.ts/foo`.
      '@formspec-org/engine/init-formspec-engine': path.resolve(
        repoRoot,
        'packages/formspec-engine/src/init-formspec-engine.ts',
      ),
      '@formspec-org/engine/render': path.resolve(repoRoot, 'packages/formspec-engine/src/engine-render-entry.ts'),
      '@formspec-org/engine/fel-runtime': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-runtime.ts'),
      '@formspec-org/engine/fel-tools': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-tools.ts'),
      '@formspec-org/engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
      '@formspec-org/layout/token-registry': path.resolve(repoRoot, 'packages/formspec-layout/src/token-registry.json'),
      '@formspec-org/layout': path.resolve(repoRoot, 'packages/formspec-layout/src/index.ts'),
      '@formspec-org/chat': path.resolve(repoRoot, 'packages/formspec-chat/src/index.ts'),
      '@formspec-org/mcp/dispatch': path.resolve(repoRoot, 'packages/formspec-mcp/src/dispatch.ts'),
      '@formspec-org/mcp/registry': path.resolve(repoRoot, 'packages/formspec-mcp/src/registry.ts'),
      '@formspec-org/mcp/server': path.resolve(repoRoot, 'packages/formspec-mcp/src/create-server.ts'),
    },
    dedupe: ['react', 'react-dom']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        chat: path.resolve(__dirname, 'chat.html'),
        'changeset-review-harness': path.resolve(__dirname, 'changeset-review-harness.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@formspec-org/webcomponent'],
  },
  server: {
    allowedHosts: true,
    fs: {
      allow: [repoRoot]
    }
  }
});
