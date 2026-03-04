import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
    base: './',
    plugins: [preact()],
    server: {
        port: 8083,
        allowedHosts: true,
        fs: {
            allow: [repoRoot],
        },
    },
});
