import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

export default defineConfig({
    plugins: [preact()],
    resolve: {
        // Longer package subpaths before `@formspec-org/engine` / `@formspec-org/webcomponent` so Vite 8
        // (Rolldown) does not resolve `@formspec-org/engine/init-formspec-engine` via the base alias.
        alias: {
            '@formspec-org/engine/init-formspec-engine': path.resolve(
                repoRoot,
                'packages/formspec-engine/src/init-formspec-engine.ts',
            ),
            '@formspec-org/engine/render': path.resolve(repoRoot, 'packages/formspec-engine/src/engine-render-entry.ts'),
            '@formspec-org/engine': path.resolve(repoRoot, 'packages/formspec-engine/src/index.ts'),
            '@formspec-org/webcomponent/formspec-default.css': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-default.css'),
            '@formspec-org/webcomponent/formspec-layout.css': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/formspec-layout.css'),
            '@formspec-org/webcomponent': path.resolve(repoRoot, 'packages/formspec-webcomponent/src/index.ts'),
        },
    },
    server: {
        allowedHosts: true,
        fs: {
            allow: [repoRoot],
        },
    },
});
