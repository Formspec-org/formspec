/** @filedesc Remote options must trigger re-evaluation so validation runs against resolved options. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

const originalFetch = globalThis.fetch;

test('validation report changes after remote options resolve', async () => {
  // Track how many times _evaluate is called
  let evaluateCallCount = 0;
  const OriginalFormEngine = FormEngine;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ([
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta' },
    ]),
  });

  try {
    const engine = new FormEngine({
      $formspec: '1.0',
      url: 'http://example.org/remote-reeval',
      version: '1.0.0',
      title: 'Remote Re-eval',
      items: [
        { key: 'status', type: 'field', dataType: 'choice', label: 'Status' },
      ],
      binds: [
        { path: 'status', remoteOptions: 'https://api.example.org/options/status' },
      ],
    });

    // Patch _evaluate to count calls
    const originalEvaluate = engine._evaluate.bind(engine);
    engine._evaluate = function (...args) {
      evaluateCallCount++;
      return originalEvaluate(...args);
    };

    const countBefore = evaluateCallCount;

    // Wait for remote options to resolve
    await engine.waitForRemoteOptions();

    // _evaluate() should have been called at least once after options resolved
    assert.ok(
      evaluateCallCount > countBefore,
      `_evaluate() must be called after remote options resolve (calls before: ${countBefore}, after: ${evaluateCallCount})`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
