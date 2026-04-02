import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  root: 'tests/e2e/fixtures',
  server: {
    port: 8080
  },
  build: {
    target: 'esnext',
    outDir: '../../../dist',
    emptyOutDir: true
  },
  plugins: [
    {
      name: 'serve-examples',
      configureServer(server) {
        const MIME: Record<string, string> = { '.json': 'application/json', '.csv': 'text/csv', '.xml': 'application/xml' };
        const repoRoot = path.resolve(__dirname);
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/examples/')) return next();
          const relPath = req.url.split('?')[0];
          const filePath = path.join(repoRoot, relPath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = MIME[ext] || 'application/octet-stream';
          fs.readFile(filePath, (err, data) => {
            if (err) return next();
            res.setHeader('Content-Type', mime);
            res.end(data);
          });
        });
      },
    },
    {
      name: 'serve-studio-dist',
      configureServer(server) {
        const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
        const studioDir = path.resolve(__dirname, 'packages/formspec-studio/dist');
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/studio')) return next();
          let relPath = req.url.replace(/^\/studio/, '').split('?')[0];

          if (!relPath || relPath === '/') relPath = '/index.html';
          const filePath = path.join(studioDir, relPath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = MIME[ext] || 'application/octet-stream';
          fs.readFile(filePath, (err, data) => {
            if (err) return next();
            res.setHeader('Content-Type', mime);
            res.end(data);
          });
        });
      },
    },
  ],
});
