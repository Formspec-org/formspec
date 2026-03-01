import { readFileSync } from 'node:fs';
import { FormEngine } from '../../dist/index.js';

const definition = JSON.parse(
  readFileSync(new URL('../fixtures/grant-app-definition.json', import.meta.url), 'utf8')
);

export function createGrantEngine() {
  const engine = new FormEngine(definition);
  if (typeof engine.skipScreener === 'function') {
    engine.skipScreener();
  }
  return engine;
}

export function engineValue(engine, path) {
  return engine.signals[path]?.value;
}

export function engineVariable(engine, name) {
  return engine.variableSignals[`#:${name}`]?.value;
}

export function getValidationReport(engine, mode) {
  return engine.getValidationReport({ mode });
}

export function getResponse(engine) {
  return engine.getResponse();
}

export function addRepeatInstance(engine, name) {
  return engine.addRepeatInstance(name);
}

export function removeRepeatInstance(engine, name, index) {
  return engine.removeRepeatInstance(name, index);
}
