import { describe, expect, it, beforeAll } from 'vitest';
import { ensureEngine, createEngine, makeOntology, makeReferences } from './helpers.js';
import { createAssistProvider } from '../src/index.js';

describe('Context resolution', () => {
  beforeAll(async () => {
    await ensureEngine();
  });

  it('resolves field, ancestor, and form-level references with audience filtering', () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      references: makeReferences(),
      ontology: makeOntology(),
      registerWebMCP: false,
    });

    const agentHelp = provider.getFieldHelp('organization.ein', 'agent');
    expect(agentHelp.references.documentation?.map((entry) => entry.title)).toContain('EIN Instructions');
    expect(agentHelp.references.regulation?.map((entry) => entry.title)).toContain('Uniform Guidance');
    expect(agentHelp.references.context?.map((entry) => entry.title)).toContain('Organization context');
    expect(agentHelp.references.example).toBeUndefined();
    expect(agentHelp.concept?.concept).toBe('https://www.irs.gov/terms/employer-identification-number');

    const humanHelp = provider.getFieldHelp('organization.ein', 'human');
    expect(humanHelp.references.example?.map((entry) => entry.title)).toContain('Example EIN');
    expect(humanHelp.references.context).toBeUndefined();
  });

  it('rejects mismatched and structurally invalid sidecars', () => {
    expect(() =>
      createAssistProvider({
        engine: createEngine(),
        references: {
          ...makeReferences(),
          targetDefinition: { url: 'https://example.org/forms/other' },
        },
        registerWebMCP: false,
      }),
    ).toThrow(/target definition/i);

    expect(() =>
      createAssistProvider({
        engine: createEngine(),
        references: {
          ...makeReferences(),
          references: [
            {
              target: 'organization.ein',
              $ref: '#/referenceDefs/doesNotExist',
            },
          ],
        },
        registerWebMCP: false,
      }),
    ).toThrow(/unknown reference definition/i);
  });

  it('accepts common semver-compatible sidecar version expressions', () => {
    expect(() =>
      createAssistProvider({
        engine: createEngine(),
        references: {
          ...makeReferences(),
          targetDefinition: {
            url: 'https://example.org/forms/grant',
            compatibleVersions: '>=1.0.0 <2.0.0',
          },
        },
        registerWebMCP: false,
      }),
    ).not.toThrow();

    expect(() =>
      createAssistProvider({
        engine: createEngine(),
        ontology: {
          ...makeOntology(),
          targetDefinition: {
            url: 'https://example.org/forms/grant',
            compatibleVersions: '1.x',
          },
        },
        registerWebMCP: false,
      }),
    ).not.toThrow();
  });

  it('returns NOT_FOUND for unknown field help paths', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      references: makeReferences(),
      ontology: makeOntology(),
      registerWebMCP: false,
    });

    const result = await provider.invokeTool('formspec.field.help', { path: 'organization.missing' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      code: 'NOT_FOUND',
      path: 'organization.missing',
    });
  });

  it('always includes inherited ancestor and form-level references', () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      references: makeReferences(),
      ontology: makeOntology(),
      registerWebMCP: false,
    });

    const help = provider.getFieldHelp('organization.ein', 'agent');
    expect(help.references.documentation?.map((entry) => entry.title)).toContain('EIN Instructions');
    expect(help.references.regulation?.map((entry) => entry.title)).toContain('Uniform Guidance');
    expect(help.references.context?.map((entry) => entry.title)).toContain('Organization context');
  });
});
