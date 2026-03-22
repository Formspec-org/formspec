/** @filedesc Cross-runtime fuzz runner: compares FEL evaluation results between TS and Python. */
import fs from 'node:fs';
import { FormEngine, initFormspecEngine } from '../../../packages/formspec-engine/dist/index.js';

function normalizeNumber(value) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return String(value);
  if (Object.is(value, -0)) return 0;
  if (Number.isInteger(value)) return value;
  return Number(value.toPrecision(12));
}

function normalizeJson(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return normalizeNumber(value);
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = normalizeJson(value[key]);
    }
    return out;
  }
  if (value === undefined) return null;
  return value;
}

function runFelCase(caseDoc) {
  const fields = Array.isArray(caseDoc.fields) ? caseDoc.fields : [];
  const fieldDefs = fields.length > 0 ? fields : [{ key: 'dummy', dataType: 'integer', value: 0 }];
  const definition = {
    $formspec: '1.0',
    url: `https://example.org/forms/fuzz/fel/${caseDoc.id}`,
    version: '1.0.0',
    status: 'active',
    title: 'Fuzz FEL',
    items: fieldDefs.map((field) => ({
      key: field.key,
      type: 'field',
      dataType: field.dataType || 'string',
      label: field.key,
    })),
  };

  const engine = new FormEngine(definition);
  for (const field of fields) {
    engine.setValue(field.key, field.value);
  }

  const fn = engine.compileExpression(caseDoc.expression, '');
  return normalizeJson(fn());
}

async function main() {
  await initFormspecEngine();

  const raw = fs.readFileSync(0, 'utf8');
  const payload = raw.trim().length > 0 ? JSON.parse(raw) : {};
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  const results = [];

  for (const caseDoc of cases) {
    try {
      results.push({
        id: caseDoc.id,
        ok: true,
        value: runFelCase(caseDoc),
      });
    } catch (error) {
      results.push({
        id: caseDoc.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  process.stdout.write(`${JSON.stringify({ results })}\n`);
}

main().catch((e) => { process.stderr.write(String(e) + '\n'); process.exit(1); });
