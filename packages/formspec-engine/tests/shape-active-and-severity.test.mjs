/** @filedesc Shape active and severity: shapes only fire when activeWhen is true and emit correct severity levels */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should evaluate shapes only when activeWhen is true', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/shape-active',
    version: '1.0.0',
    title: 'Shape Active',
    items: [
      { key: 'enabled', type: 'field', dataType: 'boolean', label: 'Enabled', initialValue: false },
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount', initialValue: 150 }
    ],
    shapes: [
      {
        id: 'warnWhenEnabled',
        target: '#',
        severity: 'warning',
        activeWhen: 'enabled == true',
        constraint: 'amount <= 100',
        message: 'Amount exceeds warning threshold'
      }
    ]
  });

  assert.deepEqual(engine.evaluateShape('warnWhenEnabled'), []);

  engine.setValue('enabled', true);
  const results = engine.evaluateShape('warnWhenEnabled');

  assert.equal(results.length, 1);
  assert.equal(results[0].severity, 'warning');
});

test('should keep report valid when only warning and info shapes fail', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/shape-severity',
    version: '1.0.0',
    title: 'Shape Severity',
    items: [
      { key: 'enabled', type: 'field', dataType: 'boolean', label: 'Enabled', initialValue: true },
      { key: 'amount', type: 'field', dataType: 'integer', label: 'Amount', initialValue: 150 }
    ],
    shapes: [
      {
        id: 'warnShape',
        target: '#',
        severity: 'warning',
        activeWhen: 'enabled == true',
        constraint: 'amount <= 100',
        message: 'Warning threshold exceeded'
      },
      {
        id: 'infoShape',
        target: '#',
        severity: 'info',
        activeWhen: 'enabled == true',
        constraint: 'amount <= 50',
        message: 'Info threshold exceeded'
      }
    ]
  });

  const report = engine.getValidationReport();

  assert.equal(report.valid, true);
  assert.equal(report.counts.error, 0);
  assert.equal(report.counts.warning, 1);
  assert.equal(report.counts.info, 1);
  assert.equal(report.results.length, 2);
});
