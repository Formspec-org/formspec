import { describe, it, expect, beforeAll } from 'vitest';
import { RawProject } from '@formspec-org/core';
import { initFormspecEngine, initFormspecEngineTools, analyzeFEL } from '@formspec-org/engine';

describe('Variable reference analysis', () => {
  beforeAll(async () => {
    await initFormspecEngine();
    await initFormspecEngineTools();
  });

  it('analyzes $x + 1', () => {
    const analysis = analyzeFEL('$x + 1');
    console.log('References:', analysis.references);
    console.log('Variables:', analysis.variables);
  });
});
