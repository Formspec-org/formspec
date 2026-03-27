/** @filedesc Vitest globalSetup — ensures formspec-rust is installed once before any test file runs. */
import { ensureCurrentFormspecRust, resolvePython } from './python.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setup(): void {
  const python = resolvePython();
  const rootDir = path.resolve(__dirname, '../../..');
  ensureCurrentFormspecRust(python, rootDir);
}
