import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const repoRoot = path.resolve(__dirname, '../..');

const backendPort = process.env.FORMSPEC_BACKEND_PORT || '8000';

export default defineConfig({
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
    fs: {
      allow: [repoRoot],
    },
  },
  plugins: [
    {
      name: 'repo-root-static',
      configureServer(server) {
        const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/packages/') && !req.url?.startsWith('/examples/') && !req.url?.startsWith('/registries/')) return next();
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
