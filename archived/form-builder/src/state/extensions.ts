/**
 * @module Studio extension registry helpers.
 * Validates registry documents and derives the effective extension catalog.
 */
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import registrySchema from '../../../schemas/registry.schema.json';
import type {
  ExtensionEntryCategory,
  ExtensionEntryStatus,
  ExtensionRegistryDocument,
  ExtensionRegistryEntry,
  LoadedExtensionRegistry
} from './project';

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});

const validateRegistry = ajv.compile(registrySchema as Record<string, unknown>);

const ENTRY_CATEGORIES: ExtensionEntryCategory[] = [
  'dataType',
  'function',
  'constraint',
  'property',
  'namespace'
];

/** Catalog projection for custom data types. */
export interface ExtensionCatalogDataType {
  name: string;
  label: string;
  version: string;
  status: ExtensionEntryStatus;
  description: string;
  baseType: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  registryId: string;
}

/** Catalog projection for custom FEL functions. */
export interface ExtensionCatalogFunction {
  name: string;
  felName: string;
  label: string;
  version: string;
  status: ExtensionEntryStatus;
  description: string;
  returns?: string;
  parameters: Array<{ name: string; type: string }>;
  signature: string;
  registryId: string;
}

/** Catalog projection for custom FEL constraints. */
export interface ExtensionCatalogConstraint {
  name: string;
  felName: string;
  label: string;
  version: string;
  status: ExtensionEntryStatus;
  description: string;
  parameters: Array<{ name: string; type: string }>;
  invocation: string;
  registryId: string;
}

/** Effective extension catalog surfaced to Studio pickers and autocomplete. */
export interface ExtensionCatalog {
  dataTypes: ExtensionCatalogDataType[];
  functions: ExtensionCatalogFunction[];
  constraints: ExtensionCatalogConstraint[];
}

/** Validates and parses a registry payload using the registry JSON schema. */
export function parseExtensionRegistryDocument(payload: unknown): ExtensionRegistryDocument {
  const missingRequired = findMissingRegistryFields(payload);
  if (missingRequired.length > 0) {
    throw new Error(missingRequired.join('; '));
  }

  const valid = validateRegistry(payload);
  if (!valid) {
    const messages = summarizeValidationErrors(validateRegistry.errors);
    throw new Error(messages.join('; '));
  }

  return payload as ExtensionRegistryDocument;
}

/** Creates a registry state entry with normalized source metadata and timestamp. */
export function createLoadedExtensionRegistry(
  payload: unknown,
  sourceType: LoadedExtensionRegistry['sourceType'],
  sourceLabel: string
): LoadedExtensionRegistry {
  const document = parseExtensionRegistryDocument(payload);

  return {
    id: buildRegistryId(sourceType, sourceLabel, document),
    sourceType,
    sourceLabel,
    loadedAt: new Date().toISOString(),
    document
  };
}

/** Builds a deterministic registry id from source metadata and publish date. */
export function buildRegistryId(
  sourceType: LoadedExtensionRegistry['sourceType'],
  sourceLabel: string,
  document: ExtensionRegistryDocument
): string {
  const normalizedLabel = sourceLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const published = typeof document.published === 'string' ? document.published : 'unknown';
  return `${sourceType}:${normalizedLabel || 'registry'}:${published}`;
}

/**
 * Merges registry entries into an effective catalog.
 * For each `{category,name}` pair, the highest semver entry wins.
 */
export function buildExtensionCatalog(registries: LoadedExtensionRegistry[]): ExtensionCatalog {
  const effectiveEntries = new Map<string, { entry: ExtensionRegistryEntry; registryId: string }>();

  for (const registry of registries) {
    for (const entry of registry.document.entries ?? []) {
      if (!isSupportedCategory(entry.category)) {
        continue;
      }

      const key = `${entry.category}:${entry.name}`;
      const existing = effectiveEntries.get(key);
      if (!existing || compareSemver(entry.version, existing.entry.version) >= 0) {
        effectiveEntries.set(key, { entry, registryId: registry.id });
      }
    }
  }

  const dataTypes: ExtensionCatalogDataType[] = [];
  const functions: ExtensionCatalogFunction[] = [];
  const constraints: ExtensionCatalogConstraint[] = [];

  for (const value of effectiveEntries.values()) {
    const { entry, registryId } = value;
    if (entry.status === 'retired') {
      continue;
    }

    if (entry.category === 'dataType' && typeof entry.baseType === 'string') {
      dataTypes.push({
        name: entry.name,
        label: resolveEntryLabel(entry),
        version: entry.version,
        status: entry.status,
        description: entry.description,
        baseType: entry.baseType,
        constraints: entry.constraints,
        metadata: entry.metadata,
        registryId
      });
      continue;
    }

    if (entry.category === 'function') {
      const felName = toFelIdentifier(entry.name);
      const parameters = (entry.parameters ?? []).map((parameter) => ({
        name: parameter.name,
        type: parameter.type
      }));
      const signature = buildFunctionSignature(felName, parameters, entry.returns);
      functions.push({
        name: entry.name,
        felName,
        label: resolveEntryLabel(entry),
        version: entry.version,
        status: entry.status,
        description: entry.description,
        returns: entry.returns,
        parameters,
        signature,
        registryId
      });
      continue;
    }

    if (entry.category === 'constraint') {
      const felName = toFelIdentifier(entry.name);
      const parameters = (entry.parameters ?? []).map((parameter) => ({
        name: parameter.name,
        type: parameter.type
      }));
      constraints.push({
        name: entry.name,
        felName,
        label: resolveEntryLabel(entry),
        version: entry.version,
        status: entry.status,
        description: entry.description,
        parameters,
        invocation: buildConstraintInvocation(felName, parameters),
        registryId
      });
    }
  }

  return {
    dataTypes: dataTypes.sort(sortByLabelThenVersion),
    functions: functions.sort(sortByLabelThenVersion),
    constraints: constraints.sort(sortByLabelThenVersion)
  };
}

/** Resolves the display label for an extension entry. */
export function resolveEntryLabel(entry: Pick<ExtensionRegistryEntry, 'name' | 'metadata'>): string {
  const metadata = entry.metadata;
  if (metadata && typeof metadata.displayName === 'string' && metadata.displayName.trim().length > 0) {
    return metadata.displayName.trim();
  }

  const stripped = entry.name.replace(/^x-/, '');
  return stripped
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function summarizeValidationErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) {
    return ['Registry payload failed schema validation'];
  }

  return errors.slice(0, 8).map((error) => {
    const path = error.instancePath || '/';
    const message = error.message ?? 'Invalid value';
    return `${path}: ${message}`;
  });
}

function findMissingRegistryFields(payload: unknown): string[] {
  if (!isRecord(payload)) {
    return ['/: registry payload must be an object'];
  }

  const missing: string[] = [];
  for (const property of ['$formspecRegistry', 'publisher', 'published', 'entries']) {
    if (!(property in payload)) {
      missing.push(`/: must have required property '${property}'`);
    }
  }
  return missing;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedCategory(value: unknown): value is ExtensionEntryCategory {
  return typeof value === 'string' && ENTRY_CATEGORIES.includes(value as ExtensionEntryCategory);
}

function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return [0, 0, 0];
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);

  for (let index = 0; index < leftParsed.length; index += 1) {
    if (leftParsed[index] > rightParsed[index]) {
      return 1;
    }
    if (leftParsed[index] < rightParsed[index]) {
      return -1;
    }
  }

  return 0;
}

function sortByLabelThenVersion<T extends { label: string; version: string }>(left: T, right: T): number {
  const byLabel = left.label.localeCompare(right.label);
  if (byLabel !== 0) {
    return byLabel;
  }

  return compareSemver(right.version, left.version);
}

function buildFunctionSignature(
  name: string,
  parameters: Array<{ name: string; type: string }>,
  returns: string | undefined
): string {
  const args = parameters.map((parameter) => parameter.type || parameter.name).join(', ');
  const output = returns ? ` -> ${returns}` : '';
  return `${name}(${args})${output}`;
}

function buildConstraintInvocation(name: string, parameters: Array<{ name: string; type: string }>): string {
  if (!parameters.length) {
    return `${name}($)`;
  }

  const args = parameters.map((parameter, index) => {
    if (index === 0) {
      return '$';
    }
    return parameter.name;
  });
  return `${name}(${args.join(', ')})`;
}

function toFelIdentifier(name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (!sanitized.length) {
    return 'x_extension';
  }

  if (/^[A-Za-z_]/.test(sanitized)) {
    return sanitized;
  }

  return `_${sanitized}`;
}
