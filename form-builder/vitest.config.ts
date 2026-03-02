import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
