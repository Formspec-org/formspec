import { describe, expect, it } from 'vitest';
import {
  buildExtensionCatalog,
  buildRegistryId,
  createLoadedExtensionRegistry,
  parseExtensionRegistryDocument
} from '../extensions';

describe('extension catalog helpers', () => {
  it('builds catalog entries with latest compatible versions and FEL metadata', () => {
    const oldRegistry = {
      id: 'inline:legacy:2026-01-01T00:00:00Z',
      sourceType: 'inline' as const,
      sourceLabel: 'legacy',
      loadedAt: '2026-01-01T00:00:00Z',
      document: {
        $formspecRegistry: '1.0',
        publisher: {
          name: 'Acme',
          url: 'https://acme.example'
        },
        published: '2026-01-01T00:00:00Z',
        entries: [
          {
            name: 'x-acme-id',
            category: 'dataType' as const,
            version: '1.0.0',
            status: 'stable' as const,
            description: 'Legacy identifier type.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            },
            baseType: 'string',
            metadata: {
              displayName: 'Acme ID'
            }
          },
          {
            name: 'x-acme-risk-score',
            category: 'function' as const,
            version: '1.0.0',
            status: 'stable' as const,
            description: 'Legacy risk score.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            },
            parameters: [{ name: 'amount', type: 'number' }],
            returns: 'number'
          },
          {
            name: 'x-acme-legacy',
            category: 'constraint' as const,
            version: '1.0.0',
            status: 'retired' as const,
            description: 'Retired legacy constraint.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            }
          }
        ]
      }
    };

    const latestRegistry = {
      id: 'inline:latest:2026-02-01T00:00:00Z',
      sourceType: 'inline' as const,
      sourceLabel: 'latest',
      loadedAt: '2026-02-01T00:00:00Z',
      document: {
        $formspecRegistry: '1.0',
        publisher: {
          name: 'Acme',
          url: 'https://acme.example'
        },
        published: '2026-02-01T00:00:00Z',
        entries: [
          {
            name: 'x-acme-id',
            category: 'dataType' as const,
            version: '1.1.0',
            status: 'stable' as const,
            description: 'Current identifier type.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            },
            baseType: 'string',
            metadata: {
              displayName: 'Acme Customer ID'
            }
          },
          {
            name: 'x-acme-risk-score',
            category: 'function' as const,
            version: '1.2.0',
            status: 'stable' as const,
            description: 'Current risk score.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            },
            parameters: [
              { name: 'amount', type: 'number' },
              { name: 'region', type: 'string' }
            ],
            returns: 'number'
          },
          {
            name: 'x-acme-unique',
            category: 'constraint' as const,
            version: '2.0.0',
            status: 'stable' as const,
            description: 'Ensures uniqueness.',
            compatibility: {
              formspecVersion: '>=1.0.0 <2.0.0'
            },
            parameters: [{ name: 'scope', type: 'string' }]
          }
        ]
      }
    };

    const catalog = buildExtensionCatalog([oldRegistry, latestRegistry]);

    expect(catalog.dataTypes).toEqual([
      expect.objectContaining({
        name: 'x-acme-id',
        version: '1.1.0',
        label: 'Acme Customer ID',
        registryId: 'inline:latest:2026-02-01T00:00:00Z'
      })
    ]);
    expect(catalog.functions).toEqual([
      expect.objectContaining({
        name: 'x-acme-risk-score',
        version: '1.2.0',
        felName: 'x_acme_risk_score',
        signature: 'x_acme_risk_score(number, string) -> number'
      })
    ]);
    expect(catalog.constraints).toEqual([
      expect.objectContaining({
        name: 'x-acme-unique',
        felName: 'x_acme_unique',
        invocation: 'x_acme_unique($)'
      })
    ]);
  });

  it('validates registry payloads and reports schema errors', () => {
    expect(() => parseExtensionRegistryDocument({})).toThrowError(/\$formspecRegistry|publisher|published|entries/);
  });

  it('creates loaded registries with normalized ids', () => {
    const payload = {
      $formspecRegistry: '1.0',
      publisher: {
        name: 'Acme',
        url: 'https://acme.example'
      },
      published: '2026-03-01T00:00:00Z',
      entries: []
    };

    const loaded = createLoadedExtensionRegistry(payload, 'url', 'HTTP://Example.Org/Acme Registry.JSON');
    expect(loaded.id).toBe('url:http-example-org-acme-registry-json:2026-03-01T00:00:00Z');
    expect(loaded.sourceLabel).toBe('HTTP://Example.Org/Acme Registry.JSON');
    expect(typeof loaded.loadedAt).toBe('string');

    expect(buildRegistryId('file', '   ', loaded.document)).toBe('file:registry:2026-03-01T00:00:00Z');
  });
});
