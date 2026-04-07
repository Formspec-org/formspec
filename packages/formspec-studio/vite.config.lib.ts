// Library build config — produces dist/formspec-studio.js + .css
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const packagesRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { 'process.env': JSON.stringify({}) },
  resolve: {
    // Only alias packages WITHOUT subpath exports.
    // @formspec-org/engine and @formspec-org/core have subpath exports (e.g. @formspec-org/engine/render)
    // and must resolve through node_modules → dist/ (built by npm run build).
    alias: {
      '@formspec-org/studio-core': path.resolve(packagesRoot, 'formspec-studio-core/src/index.ts'),
      '@formspec-org/types': path.resolve(packagesRoot, 'formspec-types/src/index.ts'),
      '@formspec-org/layout/default-theme': path.resolve(packagesRoot, 'formspec-layout/src/default-theme.json'),
      '@formspec-org/layout/token-registry': path.resolve(packagesRoot, 'formspec-layout/src/token-registry.json'),
      '@formspec-org/layout': path.resolve(packagesRoot, 'formspec-layout/src/index.ts'),
      '@formspec-org/chat': path.resolve(packagesRoot, 'formspec-chat/src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib.ts'),
      name: 'FormspecStudio',
      formats: ['es'],
      fileName: 'formspec-studio',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'node:fs', 'node:url'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});
