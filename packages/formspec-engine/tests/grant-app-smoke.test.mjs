/** @filedesc Grant-app smoke test: engine loads the grant-app fixture and basic setValue/getValue round-trips */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrantEngine, engineValue } from './helpers/grant-app.mjs';

test('should load grant-app fixture and read back a set value', () => {
  const engine = createGrantEngine();
  engine.setValue('applicantInfo.orgName', 'Acme Org');
  assert.equal(engineValue(engine, 'applicantInfo.orgName'), 'Acme Org');
});
