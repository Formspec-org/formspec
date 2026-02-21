import { defineConfig } from 'vite';

export default defineConfig({
  root: 'tests/e2e/fixtures',
  server: {
    port: 8080
  },
  build: {
    outDir: '../../../dist',
    emptyOutDir: true
  }
});
