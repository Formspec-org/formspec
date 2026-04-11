#!/usr/bin/env node
/** @filedesc Fails CI if repo cites legacy thoughts paths for files that only exist under thoughts/archive/. */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TEXT_EXT = /\.(md|mjs|cjs|js|ts|tsx|json|yaml|yml)$/i;

/** @returns {string[]} legacy path strings like thoughts/adr/foo.md */
function legacyPathsFromArchive() {
  const out = [];
  const triples = [
    ['thoughts/archive/adr', 'thoughts/adr'],
    ['thoughts/archive/plans', 'thoughts/plans'],
    ['thoughts/archive/specs', 'thoughts/specs'],
  ];
  for (const [archiveDir, legacyPrefix] of triples) {
    const abs = join(root, archiveDir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.md')) continue;
      out.push(`${legacyPrefix}/${name}`);
    }
  }
  return out;
}

function trackedFiles() {
  const buf = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' });
  return buf.split('\0').filter(Boolean);
}

function shouldScan(relPath) {
  if (relPath.startsWith('trellis/')) return false;
  if (relPath.startsWith('thoughts/archive/')) return false;
  if (relPath === 'scripts/check-thoughts-relocated-paths.mjs') return false;
  if (!TEXT_EXT.test(relPath)) return false;
  return true;
}

const forbidden = legacyPathsFromArchive();
let errors = 0;

for (const rel of trackedFiles()) {
  if (!shouldScan(rel)) continue;
  let body;
  try {
    body = readFileSync(join(root, rel), 'utf8');
  } catch {
    continue;
  }
  for (const legacy of forbidden) {
    if (body.includes(legacy)) {
      console.error(`check-thoughts-relocated-paths: legacy path in ${rel}`);
      console.error(`  replace "${legacy}" with "${legacy.replace(/^thoughts\//, 'thoughts/archive/')}"`);
      errors += 1;
    }
  }
}

if (errors > 0) {
  console.error(`\ncheck-thoughts-relocated-paths: ${errors} violation(s).`);
  process.exit(1);
}

console.log(`check-thoughts-relocated-paths: OK (${forbidden.length} archived markdown paths guarded)`);
