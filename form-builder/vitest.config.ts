import path from 'path';
import { fileURLToPath } from 'url';
import viteConfig from './vite.config';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const baseResolve = (viteConfig as { resolve?: { alias?: Record<string, string> } }).resolve;
const baseAlias = baseResolve?.alias ?? {};

export default {
  ...viteConfig,
  root: configDir,
  resolve: {
    ...baseResolve,
    alias: {
      ...baseAlias,
      ajv: path.resolve(configDir, 'src/test-support/ajv-shim.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
};
