import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const matrixPath = path.join(repoRoot, 'tests', 'conformance', 'core-semantics-matrix.json');

function loadMatrix() {
  return JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
}

test('core semantics matrix scaffold is readable from engine tests', () => {
  const matrix = loadMatrix();
  assert.equal(matrix.scope, 'core-semantics');
  assert.ok(Array.isArray(matrix.cases));
  assert.ok(matrix.cases.length >= 8);
});

test('core semantics matrix entries reference real repo files', () => {
  const matrix = loadMatrix();
  const allowedStatuses = new Set(['planned', 'partial', 'implemented']);
  const seenIds = new Set();

  for (const entry of matrix.cases) {
    assert.ok(!seenIds.has(entry.id), `duplicate case id: ${entry.id}`);
    seenIds.add(entry.id);
    assert.ok(['p0', 'p1', 'p2'].includes(entry.priority), `bad priority for ${entry.id}`);
    assert.ok(Array.isArray(entry.specRefs) && entry.specRefs.length > 0, `missing spec refs for ${entry.id}`);

    for (const fixturePath of entry.fixtures) {
      assert.ok(fs.existsSync(path.join(repoRoot, fixturePath)), `missing fixture: ${fixturePath}`);
    }

    for (const runtime of ['python', 'engine']) {
      assert.ok(allowedStatuses.has(entry[runtime].status), `bad ${runtime} status for ${entry.id}`);
      for (const testPath of entry[runtime].tests) {
        assert.ok(fs.existsSync(path.join(repoRoot, testPath)), `missing test path: ${testPath}`);
      }
    }
  }
});

test('core semantics matrix preserves the current engine parity agenda', () => {
  const matrix = loadMatrix();
  const currentRuntimeP0 = new Set([
    'shape-repeat-targets',
    'shape-row-scope',
    'nonrelevant-suppression',
    'nrb-vs-excluded-value',
    'shape-timing-submit',
  ]);

  for (const entry of matrix.cases.filter((item) => currentRuntimeP0.has(item.id))) {
    assert.equal(entry.engine.status, 'implemented', `current engine p0 gap remains for ${entry.id}`);
  }

  const plannedBacklog = matrix.cases
    .filter((entry) => entry.engine.status !== 'implemented')
    .map((entry) => entry.id);

  assert.deepEqual(plannedBacklog, [
    'data-source-load-before-rebuild',
    'modular-ref-assembly-rewrite',
    'version-migration-semantics',
  ]);
});
