/** @filedesc Loads and caches JSON Schema validators and raw schema text for MCP. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type DocumentType,
  type SchemaValidationError,
  type SchemaValidationResult,
  type SchemaValidator,
  lintDocument,
} from 'formspec-engine';

let validator: SchemaValidator | null = null;

/**
 * Loads schemas from disk and creates the validator singleton.
 * Call once at startup. Throws (fatal) if any schema file is missing.
 */
export function initSchemas(schemasDir: string): SchemaValidator {
  JSON.parse(readFileSync(resolve(schemasDir, 'definition.schema.json'), 'utf-8'));
  JSON.parse(readFileSync(resolve(schemasDir, 'component.schema.json'), 'utf-8'));
  JSON.parse(readFileSync(resolve(schemasDir, 'theme.schema.json'), 'utf-8'));

  validator = {
    validate(document: unknown, documentType?: DocumentType | null): SchemaValidationResult {
      const result = lintDocument(document);
      const errors: SchemaValidationError[] = (result.diagnostics ?? []).map((diagnostic: {
        path?: string;
        message?: string;
        code?: string;
      }) => ({
        path: diagnostic.path ?? '$',
        message: diagnostic.message ?? diagnostic.code ?? 'Schema validation failed',
      }));
      return {
        documentType: (documentType ?? result.documentType ?? null) as DocumentType | null,
        errors,
      };
    },
  };
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
