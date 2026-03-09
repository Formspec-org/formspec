/**
 * Entry point: run all 5 reference-app smoke tests in parallel.
 *
 * Usage:
 *   node tests/e2e/smoke/run-all.mjs
 *   REFERENCES_URL=http://localhost:8082 node tests/e2e/smoke/run-all.mjs
 *
 * Exits non-zero if any test rejects (fatal error).
 * Individual tests that return results but detected console errors do NOT
 * cause a non-zero exit — they surface those in the summary table.
 */
import grantApp from './grant-application.smoke.mjs';
import tribalShort from './tribal-short.smoke.mjs';
import tribalLong from './tribal-long.smoke.mjs';
import invoice from './invoice.smoke.mjs';
import clinical from './clinical-intake.smoke.mjs';

const BASE_URL = process.env.REFERENCES_URL || 'http://localhost:8082';

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║       Reference App Smoke Tests — All Forms          ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`Target: ${BASE_URL}`);
console.log(`Running 5 smoke tests in parallel...\n`);

const start = Date.now();

const results = await Promise.allSettled([
  grantApp(),
  tribalShort(),
  tribalLong(),
  invoice(),
  clinical(),
]);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// ── Summary table ─────────────────────────────────────────────────────────────

const names = [
  'grant-application',
  'tribal-short',
  'tribal-long',
  'invoice',
  'clinical-intake',
];

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                   SMOKE TEST SUMMARY                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

let anyFailed = false;

results.forEach((result, i) => {
  const name = names[i];
  if (result.status === 'rejected') {
    anyFailed = true;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${result.reason?.message || result.reason}`);
  } else {
    const r = result.value;
    const consoleErrCount = r.consoleErrors?.length ?? 0;
    const screenErrCount = Array.isArray(r.errors)
      ? r.errors.length
      : (r.validationErrors?.length ?? 0);
    const pageCount = Array.isArray(r.pages)
      ? r.pages.length
      : (r.pagesVisited?.length ?? r.totalPages ?? '?');

    const status = 'PASS ';
    console.log(`  ${status} ${name}`);
    console.log(`        pages=${pageCount}  console-errors=${consoleErrCount}  screen-errors=${screenErrCount}`);
  }
  console.log('');
});

console.log(`Total time: ${elapsed}s`);
console.log('');

if (anyFailed) {
  console.error('One or more smoke tests FAILED (fatal error).');
  process.exit(1);
} else {
  console.log('All smoke tests completed (check console-errors above for known issues).');
}
