import path from 'path';
import { fileURLToPath } from 'url';
import viteConfig from './vite.config';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const baseResolve = (viteConfig as { resolve?: { alias?: Record<string, string> } }).resolve;
const baseAlias = baseResolve?.alias ?? {};
const ajvShim = path.resolve(configDir, 'src/test-support/ajv-shim.ts');

export default {
  ...viteConfig,
  root: configDir,
  resolve: {
    ...baseResolve,
    alias: [
      ...Object.entries(baseAlias).map(([find, replacement]) => ({ find, replacement })),
      { find: /^ajv(\/.*)?$/, replacement: ajvShim }
    ]
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-support/test-setup.ts']
  }
};
