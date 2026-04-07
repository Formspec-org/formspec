import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const pkg = (name: string) => path.resolve(repoRoot, 'packages', name, 'src');

const basePath = process.env.FORMSPEC_BASE_PATH || '/';

export default defineConfig({
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            // @formspec-org/engine subpath exports
            { find: '@formspec-org/engine/init-formspec-engine', replacement: `${pkg('formspec-engine')}/init-formspec-engine.ts` },
            { find: '@formspec-org/engine/render', replacement: `${pkg('formspec-engine')}/engine-render-entry.ts` },
            { find: '@formspec-org/engine/fel-runtime', replacement: `${pkg('formspec-engine')}/fel/fel-api-runtime.ts` },
            { find: '@formspec-org/engine/fel-tools', replacement: `${pkg('formspec-engine')}/fel/fel-api-tools.ts` },
            { find: '@formspec-org/engine', replacement: `${pkg('formspec-engine')}/index.ts` },
            { find: '@formspec-org/layout', replacement: `${pkg('formspec-layout')}/index.ts` },
            // @formspec-org/react
            { find: '@formspec-org/react/hooks', replacement: `${pkg('formspec-react')}/hooks.ts` },
            { find: '@formspec-org/react', replacement: `${pkg('formspec-react')}/index.ts` },
        ],
    },
    server: {
        port: 5200,
        host: '127.0.0.1',
        allowedHosts: true,
        fs: { allow: [repoRoot] },
    },
});
