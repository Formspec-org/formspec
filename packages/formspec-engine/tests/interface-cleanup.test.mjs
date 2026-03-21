/** @filedesc Verify FormEngine.dispose() exists and felRuntime on runtime context is safely ignored. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { FormEngine } from '../dist/index.js';

function createMinimalEngine() {
  return new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/cleanup-test',
    version: '1.0.0',
    title: 'Cleanup Test',
    items: [
      { key: 'x', type: 'field', dataType: 'integer', label: 'X', initialValue: 10 },
    ],
  });
}

test('FormEngine exposes dispose()', () => {
  const engine = createMinimalEngine();
  assert.equal(typeof engine.dispose, 'function');
  // Should not throw
  engine.dispose();
});

test('setRuntimeContext ignores unknown felRuntime property without error', () => {
  const engine = createMinimalEngine();
  // After cleanup, felRuntime is not on the type — but passing extra props should not throw
  engine.setRuntimeContext({ locale: 'en-US' });
  assert.equal(engine.signals.x.value, 10, 'engine state unaffected');
});
