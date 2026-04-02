import { defineConfig } from 'vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const basePath = process.env.FORMSPEC_BASE_PATH || '/';

/** Resolve monorepo packages to source for Vite bundling. */
function pkgSrc(name) {
  return path.resolve(repoRoot, 'packages', name, 'src');
}

export default defineConfig({
  base: basePath,
  build: { target: 'es2022' },
  resolve: {
    alias: [
      { find: '@formspec-org/engine/init-formspec-engine', replacement: `${pkgSrc('formspec-engine')}/init-formspec-engine.ts` },
      { find: '@formspec-org/engine/render', replacement: `${pkgSrc('formspec-engine')}/engine-render-entry.ts` },
      { find: '@formspec-org/engine/fel-runtime', replacement: `${pkgSrc('formspec-engine')}/fel/fel-api-runtime.ts` },
      { find: '@formspec-org/engine/fel-tools', replacement: `${pkgSrc('formspec-engine')}/fel/fel-api-tools.ts` },
      { find: '@formspec-org/engine', replacement: `${pkgSrc('formspec-engine')}/index.ts` },
      { find: '@formspec-org/layout/default-theme', replacement: `${pkgSrc('formspec-layout')}/default-theme.json` },
      { find: '@formspec-org/layout', replacement: `${pkgSrc('formspec-layout')}/index.ts` },
      { find: '@formspec-org/webcomponent/formspec-layout.css', replacement: `${pkgSrc('formspec-webcomponent')}/formspec-layout.css` },
      { find: '@formspec-org/webcomponent/formspec-default.css', replacement: `${pkgSrc('formspec-webcomponent')}/formspec-default.css` },
      { find: '@formspec-org/webcomponent', replacement: `${pkgSrc('formspec-webcomponent')}/index.ts` },
      { find: '@formspec-org/adapters', replacement: `${pkgSrc('formspec-adapters')}/index.ts` },
    ],
  },
  server: {
    allowedHosts: true,
    fs: { allow: [repoRoot] },
  },
});
