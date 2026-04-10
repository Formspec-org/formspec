import { describe, it, expect } from 'vitest';
import { deriveScaffoldSchema, scaffoldOutputToDefinition } from '../src/scaffold-schema.js';
import definitionSchema from '../src/definition-schema.json';

// ── deriveScaffoldSchema ────────────────────────────────────────────

describe('deriveScaffoldSchema', () => {
  describe('common across providers', () => {
    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: root has title and items',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        expect(schema.type).toBe('object');
        expect(schema.required).toContain('title');
        expect(schema.required).toContain('items');
        expect(schema.properties.title.type).toBe('string');
        expect(schema.properties.items.type).toBe('array');
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: title description comes from the definition schema',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const originalDesc = (definitionSchema as any).properties.title.description;
        expect(schema.properties.title.description).toBe(originalDesc);
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: dataType enum matches the canonical definition schema',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        // Find the dataType property — location varies by provider
        const item = resolveItemSchema(schema, provider);
        const dataType = unwrapNullable(item.properties.dataType);
        expect(dataType.enum).toEqual(expect.arrayContaining([
          'string', 'text', 'integer', 'decimal', 'boolean',
          'date', 'dateTime', 'time', 'uri', 'attachment',
          'choice', 'multiChoice', 'money',
        ]));
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: item type enum is [field, group]',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const item = resolveItemSchema(schema, provider);
        expect(item.properties.type.enum).toEqual(['field', 'group']);
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: option schema has value and label',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const option = resolveOptionSchema(schema, provider);
        expect(option.properties.value).toBeDefined();
        expect(option.properties.label).toBeDefined();
        expect(option.required).toContain('value');
        expect(option.required).toContain('label');
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: strips x-lm metadata',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const json = JSON.stringify(schema);
        expect(json).not.toContain('x-lm');
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: strips format, pattern, minLength',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const json = JSON.stringify(schema);
        expect(json).not.toContain('"format"');
        expect(json).not.toContain('"pattern"');
        expect(json).not.toContain('"minLength"');
      },
    );

    it.each(['openai', 'gemini', 'anthropic'] as const)(
      '%s: omits binds, shapes, variables, instances',
      (provider) => {
        const schema = deriveScaffoldSchema(definitionSchema, provider) as any;
        const json = JSON.stringify(schema);
        expect(json).not.toContain('"binds"');
        expect(json).not.toContain('"shapes"');
        expect(json).not.toContain('"variables"');
        expect(json).not.toContain('"instances"');
      },
    );
  });

  describe('openai-specific', () => {
    it('has additionalProperties: false on every object', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'openai') as any;
      assertAllObjectsHaveAdditionalPropertiesFalse(schema);
    });

    it('uses $ref/$defs for item, field, option', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'openai') as any;
      expect(schema.$defs).toBeDefined();
      expect(schema.$defs.item).toBeDefined();
      expect(schema.$defs.field).toBeDefined();
      expect(schema.$defs.option).toBeDefined();
    });

    it('all properties are in required (nullable via anyOf)', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'openai') as any;
      const item = schema.$defs.item;
      const props = Object.keys(item.properties);
      for (const prop of props) {
        expect(item.required).toContain(prop);
      }
    });

    it('nullable properties use anyOf with null', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'openai') as any;
      const item = schema.$defs.item;
      // dataType should be nullable (groups don't have it)
      const dt = item.properties.dataType;
      expect(dt.anyOf).toBeDefined();
      expect(dt.anyOf.some((s: any) => s.type === 'null')).toBe(true);
    });
  });

  describe('gemini-specific', () => {
    it('does not use $ref/$defs', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'gemini') as any;
      const json = JSON.stringify(schema);
      expect(json).not.toContain('$ref');
      expect(json).not.toContain('$defs');
    });

    it('items array has minItems: 1', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'gemini') as any;
      expect(schema.properties.items.minItems).toBe(1);
    });

    it('does not have additionalProperties on objects', () => {
      const schema = deriveScaffoldSchema(definitionSchema, 'gemini') as any;
      expect(schema.additionalProperties).toBeUndefined();
    });
  });
});

// ── scaffoldOutputToDefinition ──────────────────────────────────────

describe('scaffoldOutputToDefinition', () => {
  it('wraps scaffold output with FormDefinition envelope', () => {
    const output = {
      title: 'Test Form',
      items: [{ key: 'name', type: 'field', label: 'Name', dataType: 'string' }],
    };
    const def = scaffoldOutputToDefinition(output);
    expect(def.$formspec).toBe('1.0');
    expect(def.status).toBe('draft');
    expect(def.title).toBe('Test Form');
    expect(def.items).toHaveLength(1);
  });

  it('strips null values from items (OpenAI strict mode output)', () => {
    const output = {
      title: 'Test',
      items: [
        { key: 'name', type: 'field', label: 'Name', dataType: 'string', options: null, children: null },
        {
          key: 'address', type: 'group', label: 'Address', dataType: null, options: null,
          children: [
            { key: 'street', type: 'field', label: 'Street', dataType: 'string', options: null },
          ],
        },
      ],
    };
    const def = scaffoldOutputToDefinition(output);
    const nameItem = def.items[0] as any;
    expect(nameItem).not.toHaveProperty('options');
    expect(nameItem).not.toHaveProperty('children');
    expect(nameItem).not.toHaveProperty('dataType', null);

    const groupItem = def.items[1] as any;
    expect(groupItem).not.toHaveProperty('dataType');
    expect(groupItem).not.toHaveProperty('options');
    expect(groupItem.children).toHaveLength(1);
    expect(groupItem.children[0]).not.toHaveProperty('options');
  });

  it('strips empty arrays from items (OpenAI returns options: [] for non-choice fields)', () => {
    const output = {
      title: 'Test',
      items: [
        { key: 'name', type: 'field', label: 'Name', dataType: 'string', options: [] },
        {
          key: 'info', type: 'group', label: 'Info', dataType: null, options: [],
          children: [
            { key: 'age', type: 'field', label: 'Age', dataType: 'integer', options: [] },
          ],
        },
      ],
    };
    const def = scaffoldOutputToDefinition(output);
    expect(def.items[0]).not.toHaveProperty('options');
    expect(def.items[1]).not.toHaveProperty('options');
    expect((def.items[1] as any).children[0]).not.toHaveProperty('options');
  });

  it('preserves non-null values', () => {
    const output = {
      title: 'Choices',
      items: [{
        key: 'color', type: 'field', label: 'Color', dataType: 'choice',
        options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
      }],
    };
    const def = scaffoldOutputToDefinition(output);
    const item = def.items[0] as any;
    expect(item.options).toHaveLength(2);
    expect(item.options[0].value).toBe('red');
  });
});

// ── Test helpers ────────────────────────────────────────────────────

function resolveItemSchema(schema: any, provider: string): any {
  if (provider === 'openai') return schema.$defs.item;
  return schema.properties.items.items;
}

function resolveOptionSchema(schema: any, provider: string): any {
  if (provider === 'openai') return schema.$defs.option;
  // For Gemini/Anthropic, options are inlined in the item schema
  const item = resolveItemSchema(schema, provider);
  const options = unwrapNullable(item.properties.options);
  return options.items;
}

function unwrapNullable(prop: any): any {
  if (prop?.anyOf) {
    return prop.anyOf.find((s: any) => s.type !== 'null') ?? prop;
  }
  return prop;
}

function assertAllObjectsHaveAdditionalPropertiesFalse(schema: any, path = 'root'): void {
  if (typeof schema !== 'object' || schema === null) return;

  if (schema.type === 'object' && schema.properties) {
    expect(schema.additionalProperties, `${path} missing additionalProperties: false`).toBe(false);
    for (const [key, val] of Object.entries(schema.properties)) {
      assertAllObjectsHaveAdditionalPropertiesFalse(val, `${path}.${key}`);
    }
  }

  if (schema.items) {
    assertAllObjectsHaveAdditionalPropertiesFalse(schema.items, `${path}.items`);
  }

  if (schema.anyOf) {
    for (const [i, val] of (schema.anyOf as any[]).entries()) {
      assertAllObjectsHaveAdditionalPropertiesFalse(val, `${path}.anyOf[${i}]`);
    }
  }

  if (schema.$defs) {
    for (const [key, val] of Object.entries(schema.$defs)) {
      assertAllObjectsHaveAdditionalPropertiesFalse(val, `$defs.${key}`);
    }
  }
}
