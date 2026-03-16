import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleData } from '../src/tools/data.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── choices ──────────────────────────────────────────────────────

describe('handleData — choices', () => {
  it('defines a reusable choice list', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleData(registry, projectId, {
      resource: 'choices',
      action: 'add',
      name: 'colors',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('colors');
  });

  it('rejects non-add actions on choices', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleData(registry, projectId, {
      resource: 'choices',
      action: 'update',
      name: 'colors',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('COMMAND_FAILED');
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleData(registry, projectId, {
      resource: 'choices',
      action: 'add',
      name: 'x',
      options: [{ value: 'a', label: 'A' }],
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── variable ─────────────────────────────────────────────────────

describe('handleData — variable', () => {
  it('adds a computed variable', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('price', 'Price', 'decimal');
    project.addField('qty', 'Qty', 'integer');

    const result = handleData(registry, projectId, {
      resource: 'variable',
      action: 'add',
      name: 'total',
      expression: '$price * $qty',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('total');
  });

  it('updates a variable expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('a', 'A', 'number');
    project.addVariable('myvar', '$a + 1');

    const result = handleData(registry, projectId, {
      resource: 'variable',
      action: 'update',
      name: 'myvar',
      expression: '$a + 2',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('myvar');
  });

  it('removes a variable', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addVariable('myvar', '42');

    const result = handleData(registry, projectId, {
      resource: 'variable',
      action: 'remove',
      name: 'myvar',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('myvar');
  });
});

// ── instance ─────────────────────────────────────────────────────

describe('handleData — instance', () => {
  it('adds an external data instance', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleData(registry, projectId, {
      resource: 'instance',
      action: 'add',
      name: 'countries',
      props: {
        source: 'https://api.example.com/countries',
        static: true,
        description: 'Country list',
      },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('countries');
  });

  it('updates an instance', () => {
    const { registry, projectId } = registryWithProject();
    handleData(registry, projectId, {
      resource: 'instance',
      action: 'add',
      name: 'countries',
      props: { source: 'https://api.example.com/countries' },
    });

    const result = handleData(registry, projectId, {
      resource: 'instance',
      action: 'update',
      name: 'countries',
      changes: { description: 'Updated country list' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('countries');
  });

  it('removes an instance', () => {
    const { registry, projectId } = registryWithProject();
    handleData(registry, projectId, {
      resource: 'instance',
      action: 'add',
      name: 'countries',
      props: { source: 'https://api.example.com/countries' },
    });

    const result = handleData(registry, projectId, {
      resource: 'instance',
      action: 'remove',
      name: 'countries',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('countries');
  });

  it('renames an instance', () => {
    const { registry, projectId } = registryWithProject();
    handleData(registry, projectId, {
      resource: 'instance',
      action: 'add',
      name: 'old_name',
      props: { source: 'https://api.example.com/data' },
    });

    const result = handleData(registry, projectId, {
      resource: 'instance',
      action: 'rename',
      name: 'old_name',
      new_name: 'new_name',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('new_name');
  });
});
