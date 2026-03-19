/** @filedesc Generates integration-css.ts from compiled USWDS Sass output. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const cssPath = resolve(root, 'dist/uswds-formspec.css');
const tsPath = resolve(root, 'src/uswds/integration-css.ts');

const css = readFileSync(cssPath, 'utf-8').trim();

const output = `\
/** @filedesc USWDS integration CSS — GENERATED, DO NOT EDIT. Regenerate with \`npm run build:css && npm run build:integration-css\`. */

// Generated from src/uswds/uswds-formspec.scss — see ADR 0048.
// This file is overwritten by scripts/generate-integration-css.mjs.
export const integrationCSS = ${JSON.stringify(css)};
`;

writeFileSync(tsPath, output, 'utf-8');
console.log(`Generated ${tsPath} (${css.length} bytes of CSS)`);
