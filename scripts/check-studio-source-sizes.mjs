/** @filedesc Advisory: list Studio TS/TSX sources over a line-count threshold (default 1000). */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const THRESHOLD = parseInt(process.env.STUDIO_FILE_LINE_WARN ?? '1000', 10);

// Studio source moved to sibling formspec-studio repo on 2026-05-04. The size
// advisory now scans the sibling repo when it's checked out under formspec-stack.
const SCAN_ROOTS = [
  join(ROOT, '../formspec-studio/packages/formspec-studio/src'),
  join(ROOT, '../formspec-studio/packages/formspec-studio-core/src'),
];

const EXT = new Set(['.ts', '.tsx']);

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function walk(dir, acc) {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (EXT.has(ent.name.slice(ent.name.lastIndexOf('.')))) acc.push(p);
  }
}

const files = [];
for (const r of SCAN_ROOTS) walk(r, files);

const over = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  if (lines > THRESHOLD) over.push({ file, lines });
}

over.sort((a, b) => b.lines - a.lines);

if (over.length === 0) {
  console.log(`check-studio-source-sizes: no files over ${THRESHOLD} lines.`);
  process.exit(0);
}

console.warn(`check-studio-source-sizes: ${over.length} file(s) over ${THRESHOLD} lines (advisory):`);
for (const { file, lines } of over) {
  console.warn(`  ${lines}\t${relative(ROOT, file)}`);
}
process.exit(0);
