import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pkg = (name: string) => path.resolve(repoRoot, 'packages', name, 'src');

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|tsx)'],
    addons: [],
    staticDirs: [
        { from: '../node_modules/@uswds/uswds/dist/img', to: '/img' },
    ],
    framework: {
        name: '@storybook/react-vite',
        options: {},
    },
    viteFinal: async (config) => {
        config.resolve = config.resolve || {};
        config.resolve.alias = [
            ...(Array.isArray(config.resolve.alias) ? config.resolve.alias : []),
            // Engine subpath exports — specific before general
            { find: '@formspec-org/engine/init-formspec-engine', replacement: `${pkg('formspec-engine')}/init-formspec-engine.ts` },
            { find: '@formspec-org/engine/render', replacement: `${pkg('formspec-engine')}/engine-render-entry.ts` },
            { find: '@formspec-org/engine/fel-runtime', replacement: `${pkg('formspec-engine')}/fel/fel-api-runtime.ts` },
            { find: '@formspec-org/engine/fel-tools', replacement: `${pkg('formspec-engine')}/fel/fel-api-tools.ts` },
            { find: '@formspec-org/engine', replacement: `${pkg('formspec-engine')}/index.ts` },
            // Layout
            { find: '@formspec-org/layout', replacement: `${pkg('formspec-layout')}/index.ts` },
            // React — subpath before base
            { find: '@formspec-org/react/hooks', replacement: `${pkg('formspec-react')}/hooks.ts` },
            { find: '@formspec-org/react', replacement: `${pkg('formspec-react')}/index.ts` },
            // Webcomponent — CSS subpaths before base
            { find: '@formspec-org/webcomponent/formspec-default.css', replacement: `${pkg('formspec-webcomponent')}/formspec-default.css` },
            { find: '@formspec-org/webcomponent/formspec-layout.css', replacement: `${pkg('formspec-webcomponent')}/formspec-layout.css` },
            { find: '@formspec-org/webcomponent', replacement: `${pkg('formspec-webcomponent')}/index.ts` },
            // Adapters
            { find: '@formspec-org/adapters', replacement: `${pkg('formspec-adapters')}/index.ts` },
        ];

        // Allow importing from anywhere in the monorepo
        config.server = config.server || {};
        config.server.fs = config.server.fs || {};
        config.server.fs.allow = [repoRoot];

        // React 19 CJS interop — ensure default import works in ESM
        config.optimizeDeps = config.optimizeDeps || {};
        config.optimizeDeps.include = [
            ...(config.optimizeDeps.include || []),
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
        ];

        return config;
    },
};

export default config;
