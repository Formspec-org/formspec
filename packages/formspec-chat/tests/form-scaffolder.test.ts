import { describe, it, expect } from 'vitest';
import { diff } from '../src/form-scaffolder.js';
import type { FormDefinition } from 'formspec-types';

describe('diff', () => {
  const baseDef: FormDefinition = {
    $formspec: '1.0',
    url: 'urn:test:form',
    version: '0.1.0',
    status: 'draft',
    title: 'Test Form',
    items: [
      { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
      { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
    ],
    binds: [
      { path: 'name', required:  'true' },
    ],
  } as FormDefinition;

    it('detects added items', () => {
      const newDef: FormDefinition = {
        ...baseDef,
        items: [
          ...baseDef.items,
          { key: 'phone', type: 'field', label: 'Phone', dataType: 'string' } as any,
        ],
      };

      const changes = diff(baseDef, newDef);
      expect(changes.added).toContain('phone');
      expect(changes.removed).toEqual([]);
    });

    it('detects removed items', () => {
      const newDef: FormDefinition = {
        ...baseDef,
        items: [baseDef.items[0]],
      };

      const changes = diff(baseDef, newDef);
      expect(changes.removed).toContain('email');
      expect(changes.added).toEqual([]);
    });

    it('detects modified items (label changed)', () => {
      const newDef: FormDefinition = {
        ...baseDef,
        items: [
          { key: 'name', type: 'field', label: 'Full Name', dataType: 'string' } as any,
          baseDef.items[1],
        ],
      };

      const changes = diff(baseDef, newDef);
      expect(changes.modified).toContain('name');
    });

    it('returns empty diff for identical definitions', () => {
      const changes = diff(baseDef, baseDef);
      expect(changes.added).toEqual([]);
      expect(changes.removed).toEqual([]);
      expect(changes.modified).toEqual([]);
    });

    it('handles nested group children', () => {
      const oldDef: FormDefinition = {
        ...baseDef,
        items: [
          {
            key: 'addr', type: 'group', label: 'Address',
            children: [
              { key: 'street', type: 'field', label: 'Street', dataType: 'string' },
            ],
          } as any,
        ],
      };
      const newDef: FormDefinition = {
        ...baseDef,
        items: [
          {
            key: 'addr', type: 'group', label: 'Address',
            children: [
              { key: 'street', type: 'field', label: 'Street', dataType: 'string' },
              { key: 'city', type: 'field', label: 'City', dataType: 'string' },
            ],
          } as any,
        ],
      };

      const changes = diff(oldDef, newDef);
      expect(changes.added).toContain('city');
    });

    it('handles empty items arrays', () => {
      const emptyDef: FormDefinition = { ...baseDef, items: [] };
      const changes = diff(emptyDef, baseDef);
      expect(changes.added).toContain('name');
      expect(changes.added).toContain('email');
    });

    it('detects dataType changes as modifications', () => {
      const newDef: FormDefinition = {
        ...baseDef,
        items: [
          { key: 'name', type: 'field', label: 'Name', dataType: 'text' } as any,
          baseDef.items[1],
        ],
      };
      const changes = diff(baseDef, newDef);
      expect(changes.modified).toContain('name');
    });
});
