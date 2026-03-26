import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const pkg = (name: string) => path.resolve(repoRoot, 'packages', name, 'src');

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            // formspec-engine subpath exports
            { find: 'formspec-engine/init-formspec-engine', replacement: `${pkg('formspec-engine')}/init-formspec-engine.ts` },
            { find: 'formspec-engine/render', replacement: `${pkg('formspec-engine')}/engine-render-entry.ts` },
            { find: 'formspec-engine/fel-runtime', replacement: `${pkg('formspec-engine')}/fel/fel-api-runtime.ts` },
            { find: 'formspec-engine/fel-tools', replacement: `${pkg('formspec-engine')}/fel/fel-api-tools.ts` },
            { find: 'formspec-engine', replacement: `${pkg('formspec-engine')}/index.ts` },
            // formspec-layout
            { find: 'formspec-layout', replacement: `${pkg('formspec-layout')}/index.ts` },
            // formspec-react
            { find: 'formspec-react/hooks', replacement: `${pkg('formspec-react')}/hooks.ts` },
            { find: 'formspec-react', replacement: `${pkg('formspec-react')}/index.ts` },
        ],
    },
    server: {
        port: 5200,
        host: '127.0.0.1',
        allowedHosts: true,
        fs: { allow: [repoRoot] },
    },
});
