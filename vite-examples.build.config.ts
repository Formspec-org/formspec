import { defineConfig } from 'vite';

export default defineConfig({
  root: 'examples/grant-application',
  base: './',
  plugins: [
    {
      name: 'strip-importmap',
      transformIndexHtml(html: string) {
        // The importmap uses dev-server paths (/node_modules/, /packages/) that
        // don't exist in the production bundle. Strip it — Vite inlines everything.
        return html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/g, '');
      },
    },
  ],
  build: {
    outDir: '../../dist/grant-application',
    emptyOutDir: true,
    target: 'esnext',
  },
  preview: {
    port: 8081,
    host: '0.0.0.0',
    allowedHosts: ['ice-badger.exe.xyz'],
  },
});
