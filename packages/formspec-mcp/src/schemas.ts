/** @filedesc Loads and caches JSON Schema validators and raw schema text for MCP. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchemaValidator, type SchemaValidator } from 'formspec-engine';

let validator: SchemaValidator | null = null;

/**
 * Loads schemas from disk and creates the validator singleton.
 * Call once at startup. Throws (fatal) if any schema file is missing.
 */
export function initSchemas(schemasDir: string): SchemaValidator {
  const definition = JSON.parse(readFileSync(resolve(schemasDir, 'definition.schema.json'), 'utf-8'));
  const component = JSON.parse(readFileSync(resolve(schemasDir, 'component.schema.json'), 'utf-8'));
  const theme = JSON.parse(readFileSync(resolve(schemasDir, 'theme.schema.json'), 'utf-8'));

  validator = createSchemaValidator({ definition, component, theme });
  return validator;
}

export function getValidator(): SchemaValidator {
  if (!validator) throw new Error('Schemas not initialized — call initSchemas() at startup');
  return validator;
}

/** Raw schema text for MCP resource responses */
let schemaTexts: Record<string, string> = {};

export function initSchemaTexts(schemasDir: string): void {
  schemaTexts = {
    definition: readFileSync(resolve(schemasDir, 'definition.schema.json'), 'utf-8'),
    component: readFileSync(resolve(schemasDir, 'component.schema.json'), 'utf-8'),
    theme: readFileSync(resolve(schemasDir, 'theme.schema.json'), 'utf-8'),
  };
}

export function getSchemaText(name: 'definition' | 'component' | 'theme'): string {
  return schemaTexts[name] ?? '';
}
