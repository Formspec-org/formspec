#!/usr/bin/env node
/** @filedesc Fails CI if repo cites legacy thoughts paths for files that only exist under thoughts/archive/. */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TEXT_EXT = /\.(md|mjs|cjs|js|ts|tsx|json|yaml|yml)$/i;

/** Recursive file paths relative to absDir (POSIX-style segments). */
function walkRelFiles(absDir, baseRel = '') {
  const paths = [];
  if (!existsSync(absDir)) return paths;
  for (const name of readdirSync(absDir)) {
    const full = join(absDir, name);
    const rel = baseRel ? `${baseRel}/${name}` : name;
    if (statSync(full).isDirectory()) {
      paths.push(...walkRelFiles(full, rel));
    } else {
      paths.push(rel);
    }
  }
  return paths;
}

/** @returns {string[]} legacy path strings for files that exist only under thoughts/archive/. */
function legacyPathsFromArchive() {
  const out = new Set();
  const flatPairs = [
    ['thoughts/archive/adr', 'thoughts/adr'],
    ['thoughts/archive/plans', 'thoughts/plans'],
    ['thoughts/archive/specs', 'thoughts/specs'],
    ['thoughts/archive/reviews', 'thoughts/reviews'],
  ];
  for (const [archiveDir, legacyPrefix] of flatPairs) {
    const abs = join(root, archiveDir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.md')) continue;
      const legacy = `${legacyPrefix}/${name}`;
      if (existsSync(join(root, legacy))) continue;
      out.add(legacy);
    }
  }
  const studioAbs = join(root, 'thoughts/archive/studio');
  for (const rel of walkRelFiles(studioAbs)) {
    const legacy = `thoughts/studio/${rel}`;
    if (existsSync(join(root, legacy))) continue;
    out.add(legacy);
  }
  return [...out];
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

console.log(`check-thoughts-relocated-paths: OK (${forbidden.length} archived paths guarded)`);
