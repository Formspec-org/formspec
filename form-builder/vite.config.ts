import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 8082,
    allowedHosts: true,
    fs: {
      allow: [repoRoot],
    },
  },
});
