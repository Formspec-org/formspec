import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  base: '/studio/',
  plugins: [preact()],
  resolve: {
    alias: {
      'formspec-engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
      'formspec-layout': path.resolve(repoRoot, 'packages/formspec-layout/src/index.ts'),
      'formspec-webcomponent': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/index.ts')
    }
  },
  server: {
    allowedHosts: true,
    fs: {
      allow: [repoRoot]
    }
  }
});
