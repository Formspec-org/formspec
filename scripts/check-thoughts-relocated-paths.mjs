#!/usr/bin/env node
/** @filedesc Fails CI if repo cites pre-archive thoughts paths (strings moved under thoughts/archive/). */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FORBIDDEN_SUBSTRINGS = [
  'thoughts/adr/0002-presentation-layer-approach-',
  'thoughts/adr/0003-presentation-layer-approach-',
  'thoughts/adr/0004-presentation-layer-approach-',
  'thoughts/adr/0021-holistic-kitchen-sink-e2e-conformance-plan',
  'thoughts/adr/0022-component-playground-strategy',
  'thoughts/adr/0033-core-semantics-conformance-matrix',
  'thoughts/adr/0039-marketing-site-rebuild',
  'thoughts/adr/0040-launch-blog-posts',
  'thoughts/plans/2026-03-04-webcomponent-reorg-design',
  'thoughts/plans/2026-03-04-unified-component-tree-editor-design',
  'thoughts/plans/2026-03-14-seamless-page-mgmt-prompt',
  'thoughts/plans/2026-03-17-rust-backend-transition',
  'thoughts/plans/2026-03-21-wasm-parity-rewrite',
  'thoughts/plans/2026-03-24-pages-tab-rewrite',
  'thoughts/specs/2026-03-25-assistive-chat-agent',
  'thoughts/specs/2026-04-10-formspec-integration-gaps',
  'thoughts/specs/2026-04-11-wos-s15-formspec-coprocessor-proposal',
];

const TEXT_EXT = /\.(md|mjs|cjs|js|ts|tsx|json|yaml|yml)$/i;

function trackedFiles() {
  const out = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function shouldScan(relPath) {
  if (relPath.startsWith('trellis/')) return false;
  if (relPath.startsWith('thoughts/archive/')) return false;
  if (relPath === 'scripts/check-thoughts-relocated-paths.mjs') return false;
  if (!TEXT_EXT.test(relPath)) return false;
  return true;
}

let errors = 0;
for (const rel of trackedFiles()) {
  if (!shouldScan(rel)) continue;
  let body;
  try {
    body = readFileSync(join(root, rel), 'utf8');
  } catch {
    continue;
  }
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    if (body.includes(sub)) {
      console.error(`check-thoughts-relocated-paths: forbidden substring in ${rel}`);
      console.error(`  use thoughts/archive/... instead of: ${sub}`);
      errors += 1;
    }
  }
}

if (errors > 0) {
  console.error(`\ncheck-thoughts-relocated-paths: ${errors} violation(s).`);
  process.exit(1);
}

console.log('check-thoughts-relocated-paths: OK');
