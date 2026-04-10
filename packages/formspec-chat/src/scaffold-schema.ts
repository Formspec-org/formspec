/**
 * @filedesc Derives scaffold schemas from the canonical definition.schema.json.
 *
 * Instead of hand-maintaining a parallel schema for structured output, this
 * module extracts the scaffold-relevant subset from the source of truth and
 * adapts it for each provider's constraints. When the definition schema
 * evolves (new dataTypes, new Item properties), the scaffold schema follows.
 *
 * The scaffold schema is intentionally a subset: it covers structure (items,
 * groups, fields, options) but omits behavior (binds, shapes, variables,
 * instances) and advanced features (migrations, optionSets, extensions).
 * Those are added during refinement via MCP tool calls.
 */

import type { FormDefinition } from '@formspec-org/types';

// ── Schema extraction ───────────────────────────────────────────────

/** Properties to extract from each Item conditional (if/then) block. */
const SCAFFOLD_ITEM_PROPS: Record<string, string[]> = {
  field: ['key', 'type', 'label', 'description', 'hint', 'dataType', 'options'],
  group: ['key', 'type', 'label', 'description', 'hint', 'children', 'repeatable'],
};

/** Properties to extract from OptionEntry. */
const SCAFFOLD_OPTION_PROPS = ['value', 'label'];

type Provider = 'openai' | 'gemini' | 'anthropic';

/**
 * Derive a scaffold-appropriate JSON Schema from the full definition schema.
 *
 * Reads property definitions (types, enums, descriptions) from the canonical
 * source but only includes the scaffold-relevant subset. The result is
 * adapted for the target provider's structured output constraints.
 */
export function deriveScaffoldSchema(
  definitionSchema: Record<string, unknown>,
  provider: Provider,
): Record<string, unknown> {
  const defs = (definitionSchema as any).$defs ?? {};
  const rootProps = (definitionSchema as any).properties ?? {};

  // Extract OptionEntry schema
  const optionEntryDef = defs.OptionEntry ?? {};
  const optionProps = pickProperties(optionEntryDef.properties ?? {}, SCAFFOLD_OPTION_PROPS);
  const optionSchema = buildObject(
    optionEntryDef.description ?? 'A selectable option for choice or multiChoice fields.',
    optionProps,
    SCAFFOLD_OPTION_PROPS,
    provider,
  );

  // Extract the dataType enum and description from Item's field conditional
  const itemDef = defs.Item ?? {};
  const fieldConditional = findConditional(itemDef, 'field');
  const groupConditional = findConditional(itemDef, 'group');
  const dataTypeDef = fieldConditional?.dataType ?? {};
  const dataTypeEnum: string[] = dataTypeDef.enum ?? [];

  // Build field schema (children of groups — always type: "field")
  const fieldSourceProps = {
    ...pickProperties(itemDef.properties ?? {}, SCAFFOLD_ITEM_PROPS.field),
    ...pickProperties(fieldConditional ?? {}, SCAFFOLD_ITEM_PROPS.field),
  };
  // Override dataType to include the enum
  if (dataTypeDef.type) {
    fieldSourceProps.dataType = { ...dataTypeDef };
  }
  // Override options to use the option schema (inline array only, not URI)
  fieldSourceProps.options = optionsProperty(optionSchema, provider);
  // Lock type to "field"
  fieldSourceProps.type = { ...(fieldSourceProps.type ?? {}), enum: ['field'] };

  const fieldRequired = provider === 'openai'
    ? SCAFFOLD_ITEM_PROPS.field
    : ['key', 'type', 'label', 'dataType'];
  const fieldSchema = buildObject(
    'A data-collecting form field. Must have a dataType. Include options only for choice/multiChoice.',
    fieldSourceProps,
    fieldRequired,
    provider,
  );

  // Build top-level item schema (can be field or group)
  const allItemPropNames = [...new Set([...SCAFFOLD_ITEM_PROPS.field, ...SCAFFOLD_ITEM_PROPS.group])];
  const itemSourceProps = {
    ...pickProperties(itemDef.properties ?? {}, allItemPropNames),
    ...pickProperties(fieldConditional ?? {}, allItemPropNames),
    ...pickProperties(groupConditional ?? {}, allItemPropNames),
  };
  // Override type to allow both
  itemSourceProps.type = { ...(itemSourceProps.type ?? {}), enum: ['field', 'group'] };
  // Override dataType
  if (dataTypeDef.type) {
    itemSourceProps.dataType = nullableProperty(dataTypeDef, provider,
      'Data type. Required for fields, omit/null for groups.');
  }
  // Override options (inline array only, nullable for groups)
  itemSourceProps.options = nullableProperty(
    optionsProperty(optionSchema, provider),
    provider,
    'Selectable options. Required for choice/multiChoice fields, omit/null for all others.',
  );
  // Override children — reference the field schema
  itemSourceProps.children = nullableProperty(
    {
      type: 'array',
      description: groupConditional?.children?.description
        ?? 'Child fields inside this group. Only valid when type is "group".',
      items: provider === 'openai' ? { $ref: '#/$defs/field' } : fieldSchema,
    },
    provider,
    'Child fields inside this group. Only set when type is "group", omit/null for fields.',
  );
  // Override repeatable
  if (itemSourceProps.repeatable) {
    itemSourceProps.repeatable = nullableProperty(
      itemSourceProps.repeatable,
      provider,
      'When true, this group represents a repeatable section. Only valid for groups.',
    );
  }

  const itemRequired = provider === 'openai' ? allItemPropNames : ['key', 'type', 'label'];
  const itemSchema = buildObject(
    itemDef.description
      ?? 'A form item: either a field (data-collecting) or a group (container for related fields).',
    itemSourceProps,
    itemRequired,
    provider,
  );

  // Build root scaffold schema
  const titleDef = rootProps.title ?? {};
  const itemsDef = rootProps.items ?? {};

  const rootProperties: Record<string, unknown> = {
    title: cleanProperty(titleDef),
    items: {
      type: 'array',
      description: itemsDef.description ?? 'Top-level form items.',
      items: provider === 'openai' ? { $ref: '#/$defs/item' } : itemSchema,
      ...(provider === 'gemini' ? { minItems: 1 } : {}),
    },
  };

  const root: Record<string, unknown> = {
    type: 'object',
    description: 'A Formspec form definition with a descriptive title and structured items.',
    properties: rootProperties,
    required: ['title', 'items'],
    ...(provider === 'openai' ? { additionalProperties: false } : {}),
  };

  // OpenAI supports $ref/$defs, so we factor out reusable schemas
  if (provider === 'openai') {
    (root as any).$defs = {
      option: optionSchema,
      field: fieldSchema,
      item: itemSchema,
    };
  }

  return root;
}

// ── Output normalization ────────────────────────────────────────────

/**
 * Convert scaffold output (from any provider) into a FormDefinition.
 * Strips nulls from OpenAI strict mode, adds envelope fields.
 */
export function scaffoldOutputToDefinition(
  output: { title: string; items: unknown[] },
): FormDefinition {
  return {
    $formspec: '1.0',
    url: `urn:formspec:chat:${Date.now()}`,
    version: '0.1.0',
    status: 'draft',
    title: output.title,
    items: stripNulls(output.items as any[]),
  } as FormDefinition;
}

/**
 * Remove null values and empty arrays that strict-mode providers
 * force into output. A field with `options: []` or `children: null`
 * should not carry those properties in the final definition.
 */
function stripNulls(items: any[]): any[] {
  return items.map(item => {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (val == null) continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (key === 'children' && Array.isArray(val)) {
        clean.children = stripNulls(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  });
}

// ── Internal helpers ────────────────────────────────────────────────

/** Pick named properties from a schema's properties object. */
function pickProperties(
  properties: Record<string, unknown>,
  names: string[],
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const name of names) {
    if (name in properties && properties[name] !== true) {
      result[name] = structuredClone(properties[name]);
    } else if (name in properties && properties[name] === true) {
      // `true` in allOf/then means "inherited from base" — skip, we get it from base
    }
  }
  return result;
}

/** Find the conditional (allOf > if/then) block for a given type value. */
function findConditional(
  itemDef: Record<string, unknown>,
  typeValue: string,
): Record<string, any> | null {
  const allOf = (itemDef.allOf ?? []) as any[];
  for (const cond of allOf) {
    const constVal = cond?.if?.properties?.type?.const;
    if (constVal === typeValue && cond.then?.properties) {
      return cond.then.properties;
    }
  }
  return null;
}

/**
 * Strip non-structural metadata from a property definition.
 * Removes x-lm, examples, format, pattern, minLength — things that are
 * irrelevant or unsupported in structured output schemas.
 */
function cleanProperty(prop: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...prop };
  delete clean['x-lm'];
  delete clean.examples;
  delete clean.format;
  delete clean.pattern;
  delete clean.minLength;
  delete clean.maxLength;
  delete clean.minimum;
  delete clean.maximum;
  delete clean.minItems;
  delete clean.maxItems;
  delete clean.propertyNames;
  return clean;
}

/** Build an object schema, adapted for the target provider. */
function buildObject(
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  provider: Provider,
): Record<string, unknown> {
  const cleanProps: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(properties)) {
    cleanProps[key] = cleanProperty(val as Record<string, unknown>);
  }

  const obj: Record<string, unknown> = {
    type: 'object',
    description,
    properties: cleanProps,
    required,
  };

  if (provider === 'openai') {
    obj.additionalProperties = false;
  }

  return obj;
}

/**
 * Wrap a property to be nullable for providers that require all props in required.
 * OpenAI: anyOf [original, {type: "null"}]. Others: return as-is.
 */
function nullableProperty(
  prop: Record<string, unknown>,
  provider: Provider,
  description?: string,
): Record<string, unknown> {
  const cleaned = cleanProperty(prop);
  if (provider !== 'openai') return cleaned;

  return {
    anyOf: [cleaned, { type: 'null' }],
    ...(description ? { description } : {}),
  };
}

/**
 * Build the options property. The canonical schema uses oneOf [array, uri-string]
 * but for scaffolding we only need the inline array form — URI option sets
 * are a refinement-time concern.
 */
function optionsProperty(
  optionSchema: Record<string, unknown>,
  provider: Provider,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: 'array',
    description: 'Selectable options. Required for choice/multiChoice fields.',
    items: provider === 'openai' ? { $ref: '#/$defs/option' } : optionSchema,
  };
  if (provider === 'gemini') {
    base.minItems = 2;
  }
  return base;
}
