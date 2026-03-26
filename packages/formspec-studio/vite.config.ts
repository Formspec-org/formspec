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
      'formspec-studio-core': path.resolve(repoRoot, 'packages/formspec-studio-core/src/index.ts'),
      'formspec-core': path.resolve(repoRoot, 'packages/formspec-core/src/index.ts'),
      'formspec-types': path.resolve(repoRoot, 'packages/formspec-types/src/index.ts'),
      // Subpaths must precede the package root alias — otherwise `formspec-engine/foo` resolves as `index.ts/foo`.
      'formspec-engine/init-formspec-engine': path.resolve(
        repoRoot,
        'packages/formspec-engine/src/init-formspec-engine.ts',
      ),
      'formspec-engine/render': path.resolve(repoRoot, 'packages/formspec-engine/src/engine-render-entry.ts'),
      'formspec-engine/fel-runtime': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-runtime.ts'),
      'formspec-engine/fel-tools': path.resolve(repoRoot, 'packages/formspec-engine/src/fel/fel-api-tools.ts'),
      'formspec-engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
      'formspec-layout': path.resolve(repoRoot, 'packages/formspec-layout/src/index.ts'),
      'formspec-chat': path.resolve(repoRoot, 'packages/formspec-chat/src/index.ts'),
      // formspec-webcomponent: use workspace dep from node_modules so formspec-base.css?url resolves correctly
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
    exclude: ['formspec-webcomponent'],
  },
  server: {
    allowedHosts: true,
    fs: {
      allow: [repoRoot]
    }
  }
});
