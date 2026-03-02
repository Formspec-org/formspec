import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
    fs: {
      allow: [repoRoot],
    },
  },
  plugins: [
    // Theme stylesheets use repo-root-absolute paths (e.g. "/packages/...").
    // Vite only serves static files under its own root, so this middleware
    // resolves those paths against the repo root.
    {
      name: 'repo-root-static',
      configureServer(server) {
        const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/packages/') && !req.url?.startsWith('/examples/')) return next();
          const fsPath = path.join(repoRoot, req.url.split('?')[0]);
          const mime = MIME[path.extname(fsPath).toLowerCase()];
          if (!mime) return next();
          fs.readFile(fsPath, (err, data) => {
            if (err) return next();
            res.setHeader('Content-Type', mime);
            res.end(data);
          });
        });
      },
    },
  ],
});
