/** @filedesc Remote options: engine fetches and exposes option lists for choice fields with remoteOptions config */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

const originalFetch = globalThis.fetch;

test('should fetch and expose remote options for bound choice fields', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ([
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta' },
    ]),
  });

  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/remote-options',
    version: '1.0.0',
    title: 'Remote Options',
    items: [
      { key: 'status', type: 'field', dataType: 'choice', label: 'Status' },
    ],
    binds: [
      { path: 'status', remoteOptions: 'https://api.example.org/options/status' },
    ],
  });

  await engine.waitForRemoteOptions();
  assert.deepEqual(engine.getOptions('status'), [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta' },
  ]);
  assert.deepEqual(engine.getOptionsState('status'), { loading: false, error: null });
});

test('should preserve fallback options and expose error state when remote options fetch fails', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/remote-options-failure',
    version: '1.0.0',
    title: 'Remote Options Failure',
    items: [
      {
        key: 'status',
        type: 'field',
        dataType: 'choice',
        label: 'Status',
        options: [{ value: 'fallback', label: 'Fallback' }],
      },
    ],
    binds: [
      { path: 'status', remoteOptions: 'https://api.example.org/options/status' },
    ],
  });

  await engine.waitForRemoteOptions();
  assert.deepEqual(engine.getOptions('status'), [{ value: 'fallback', label: 'Fallback' }]);
  assert.equal(engine.getOptionsState('status').loading, false);
  assert.match(engine.getOptionsState('status').error || '', /network down/);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
