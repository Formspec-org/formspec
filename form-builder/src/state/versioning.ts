/**
 * @module Studio versioning helpers.
 * Computes changelogs from definition diffs and derives semantic version bumps.
 */
import Ajv2020 from 'ajv/dist/2020';
import type { FormspecBind, FormspecDefinition, FormspecItem, FormspecShape } from 'formspec-engine';
import changelogSchema from '../../../schemas/changelog.schema.json';

/** Change action type captured in changelog entries. */
export type ChangelogChangeType = 'added' | 'removed' | 'modified' | 'moved' | 'renamed';
/** Artifact target kind affected by a changelog entry. */
export type ChangelogTarget = 'item' | 'bind' | 'shape' | 'optionSet' | 'dataSource' | 'screener' | 'migration' | 'metadata';
/** Compatibility impact classification for a change entry. */
export type ChangelogImpact = 'breaking' | 'compatible' | 'cosmetic';
/** Supported semantic version bump classes. */
export type SemverImpact = 'major' | 'minor' | 'patch';

/** One normalized changelog diff entry. */
export interface ChangelogChange {
  type: ChangelogChangeType;
  target: ChangelogTarget;
  path: string;
  impact: ChangelogImpact;
  key?: string;
  description?: string;
  before?: unknown;
  after?: unknown;
  migrationHint?: string;
}

/** Changelog document produced by Studio publish flow. */
export interface FormspecChangelogDocument {
  $schema?: string;
  definitionUrl: string;
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  semverImpact: SemverImpact;
  summary?: string;
  changes: ChangelogChange[];
}

/** Optional metadata for generated changelog documents. */
export interface GenerateChangelogOptions {
  generatedAt?: string;
  summary?: string;
}

/** Schema validation result for a generated changelog document. */
export interface ChangelogValidationResult {
  valid: boolean;
  errors: string[];
}

interface FlattenedItem {
  key: string;
  path: string;
  item: FormspecItem;
}

const METADATA_KEYS = [
  'title',
  'url',
  'version',
  'status',
  '$formspec',
  'description',
  'formPresentation'
] as const;
const ITEM_COSMETIC_KEYS = new Set(['label', 'hint', 'description', 'help', 'presentation', 'appearance']);
const BIND_COSMETIC_KEYS = new Set(['constraintMessage', 'extensions', 'x-ui']);
const SHAPE_COSMETIC_KEYS = new Set(['message', 'severity', 'code', 'context']);

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});
const validateChangelog = ajv.compile(changelogSchema as Record<string, unknown>);

/**
 * Generates a changelog by diffing two definitions.
 * Emits item/bind/shape/metadata changes plus computed semver impact.
 */
export function generateDefinitionChangelog(
  oldDefinition: FormspecDefinition,
  newDefinition: FormspecDefinition,
  definitionUrl: string,
  options: GenerateChangelogOptions = {}
): FormspecChangelogDocument {
  const changes: ChangelogChange[] = [];

  diffItems(oldDefinition.items ?? [], newDefinition.items ?? [], changes);
  diffKeyedList<FormspecBind>(oldDefinition.binds ?? [], newDefinition.binds ?? [], {
    target: 'bind',
    prefix: '',
    keyField: 'path',
    classifyAdd: classifyBindAdd,
    classifyRemove: classifyBindRemove,
    classifyModify: classifyBindModify
  }, changes);
  diffKeyedList<FormspecShape>(oldDefinition.shapes ?? [], newDefinition.shapes ?? [], {
    target: 'shape',
    prefix: 'shapes',
    keyField: 'id',
    classifyAdd: () => 'compatible',
    classifyRemove: () => 'compatible',
    classifyModify: classifyShapeModify
  }, changes);

  diffDictionarySection(
    toRecord((oldDefinition as Record<string, unknown>).optionSets),
    toRecord((newDefinition as Record<string, unknown>).optionSets),
    {
      target: 'optionSet',
      prefix: 'optionSets',
      classifyModified: classifyOptionSetModify
    },
    changes
  );
  diffDictionarySection(
    toRecord((oldDefinition as Record<string, unknown>).instances),
    toRecord((newDefinition as Record<string, unknown>).instances),
    {
      target: 'dataSource',
      prefix: 'instances',
      classifyModified: () => 'compatible'
    },
    changes
  );
  diffScreener(oldDefinition, newDefinition, changes);
  diffMigrations(oldDefinition, newDefinition, changes);
  diffMetadata(oldDefinition, newDefinition, changes);

  const sortedChanges = sortChanges(changes);
  const document: FormspecChangelogDocument = {
    $schema: 'https://formspec.org/schemas/changelog/v1',
    definitionUrl,
    fromVersion: normalizeVersionString(oldDefinition.version) ?? '0.0.0',
    toVersion: normalizeVersionString(newDefinition.version) ?? '0.0.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    semverImpact: computeSemverImpact(sortedChanges),
    changes: sortedChanges
  };
  const summary = normalizeSummary(options.summary);
  if (summary) {
    document.summary = summary;
  }
  return document;
}

/** Validates a generated changelog against the changelog schema. */
export function validateGeneratedChangelog(document: FormspecChangelogDocument): ChangelogValidationResult {
  const valid = validateChangelog(document);
  if (valid) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: (validateChangelog.errors ?? []).map((entry) => {
      const path = entry.instancePath || '/';
      const message = entry.message ?? 'Schema validation error';
      return `${path} ${message}`;
    })
  };
}

/** Applies a major/minor/patch bump to a semver string. */
export function bumpSemverVersion(version: string, impact: SemverImpact): string {
  const parsed = parseSemver(version);
  const currentMajor = parsed?.major ?? 1;
  const currentMinor = parsed?.minor ?? 0;
  const currentPatch = parsed?.patch ?? 0;

  if (impact === 'major') {
    return `${currentMajor + 1}.0.0`;
  }
  if (impact === 'minor') {
    return `${currentMajor}.${currentMinor + 1}.0`;
  }
  return `${currentMajor}.${currentMinor}.${currentPatch + 1}`;
}

function diffItems(oldItems: FormspecItem[], newItems: FormspecItem[], changes: ChangelogChange[]): void {
  const oldFlattened = flattenItems(oldItems);
  const newFlattened = flattenItems(newItems);
  const oldByKey = new Map(oldFlattened.map((entry) => [entry.key, entry]));
  const newByKey = new Map(newFlattened.map((entry) => [entry.key, entry]));

  const oldKeys = new Set(oldByKey.keys());
  const newKeys = new Set(newByKey.keys());
  const sharedKeys = [...oldKeys].filter((key) => newKeys.has(key)).sort();

  for (const key of sharedKeys) {
    const oldEntry = oldByKey.get(key);
    const newEntry = newByKey.get(key);
    if (!oldEntry || !newEntry) {
      continue;
    }

    if (oldEntry.path !== newEntry.path) {
      changes.push({
        type: 'moved',
        target: 'item',
        path: `items.${newEntry.path}`,
        key,
        impact: 'compatible',
        before: { path: `items.${oldEntry.path}` },
        after: { path: `items.${newEntry.path}` }
      });
    }

    if (!deepEqual(oldEntry.item, newEntry.item)) {
      changes.push({
        type: 'modified',
        target: 'item',
        path: `items.${newEntry.path}`,
        key,
        impact: classifyItemModify(oldEntry.item, newEntry.item),
        before: oldEntry.item,
        after: newEntry.item
      });
    }
  }

  const addedKeys = [...newKeys].filter((key) => !oldKeys.has(key)).sort();
  const removedKeys = [...oldKeys].filter((key) => !newKeys.has(key)).sort();
  const unmatchedAdded = new Set(addedKeys);
  const unmatchedRemoved = new Set(removedKeys);

  for (const removedKey of removedKeys) {
    const removedEntry = oldByKey.get(removedKey);
    if (!removedEntry || !unmatchedRemoved.has(removedKey)) {
      continue;
    }

    const matchingAddedKey = [...unmatchedAdded].find((addedKey) => {
      const addedEntry = newByKey.get(addedKey);
      if (!addedEntry) {
        return false;
      }
      return isRenameCandidate(removedEntry.item, addedEntry.item);
    });

    if (!matchingAddedKey) {
      continue;
    }

    const addedEntry = newByKey.get(matchingAddedKey);
    if (!addedEntry) {
      continue;
    }

    changes.push({
      type: 'renamed',
      target: 'item',
      path: `items.${removedEntry.path}`,
      impact: 'breaking',
      key: removedKey,
      before: {
        key: removedKey,
        path: `items.${removedEntry.path}`
      },
      after: {
        key: matchingAddedKey,
        path: `items.${addedEntry.path}`
      }
    });

    unmatchedRemoved.delete(removedKey);
    unmatchedAdded.delete(matchingAddedKey);
  }

  for (const key of [...unmatchedAdded].sort()) {
    const entry = newByKey.get(key);
    if (!entry) {
      continue;
    }
    changes.push({
      type: 'added',
      target: 'item',
      path: `items.${entry.path}`,
      key,
      impact: 'compatible',
      after: entry.item
    });
  }

  for (const key of [...unmatchedRemoved].sort()) {
    const entry = oldByKey.get(key);
    if (!entry) {
      continue;
    }
    changes.push({
      type: 'removed',
      target: 'item',
      path: `items.${entry.path}`,
      key,
      impact: 'breaking',
      before: entry.item
    });
  }
}

interface KeyedListDiffOptions<T extends Record<string, unknown>> {
  target: ChangelogTarget;
  prefix: string;
  keyField: keyof T;
  classifyAdd: (item: T) => ChangelogImpact;
  classifyRemove: (item: T) => ChangelogImpact;
  classifyModify: (oldItem: T, newItem: T) => ChangelogImpact;
}

function diffKeyedList<T extends Record<string, unknown>>(
  oldItems: T[],
  newItems: T[],
  options: KeyedListDiffOptions<T>,
  changes: ChangelogChange[]
): void {
  const oldMap = new Map<string, T>();
  const newMap = new Map<string, T>();

  for (const entry of oldItems) {
    const key = resolveKey(entry[options.keyField]);
    if (!key) {
      continue;
    }
    oldMap.set(key, entry);
  }
  for (const entry of newItems) {
    const key = resolveKey(entry[options.keyField]);
    if (!key) {
      continue;
    }
    newMap.set(key, entry);
  }

  const oldKeys = new Set(oldMap.keys());
  const newKeys = new Set(newMap.keys());
  const addedKeys = [...newKeys].filter((key) => !oldKeys.has(key)).sort();
  const removedKeys = [...oldKeys].filter((key) => !newKeys.has(key)).sort();
  const sharedKeys = [...oldKeys].filter((key) => newKeys.has(key)).sort();

  for (const key of addedKeys) {
    const entry = newMap.get(key);
    if (!entry) {
      continue;
    }
    changes.push({
      type: 'added',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: options.classifyAdd(entry),
      after: entry
    });
  }

  for (const key of removedKeys) {
    const entry = oldMap.get(key);
    if (!entry) {
      continue;
    }
    changes.push({
      type: 'removed',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: options.classifyRemove(entry),
      before: entry
    });
  }

  for (const key of sharedKeys) {
    const oldEntry = oldMap.get(key);
    const newEntry = newMap.get(key);
    if (!oldEntry || !newEntry || deepEqual(oldEntry, newEntry)) {
      continue;
    }

    changes.push({
      type: 'modified',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: options.classifyModify(oldEntry, newEntry),
      before: oldEntry,
      after: newEntry
    });
  }
}

interface DictionaryDiffOptions {
  target: ChangelogTarget;
  prefix: string;
  classifyModified: (oldValue: unknown, newValue: unknown) => ChangelogImpact;
}

function diffDictionarySection(
  oldDictionary: Record<string, unknown>,
  newDictionary: Record<string, unknown>,
  options: DictionaryDiffOptions,
  changes: ChangelogChange[]
): void {
  const oldKeys = new Set(Object.keys(oldDictionary));
  const newKeys = new Set(Object.keys(newDictionary));
  const addedKeys = [...newKeys].filter((key) => !oldKeys.has(key)).sort();
  const removedKeys = [...oldKeys].filter((key) => !newKeys.has(key)).sort();
  const sharedKeys = [...oldKeys].filter((key) => newKeys.has(key)).sort();

  for (const key of addedKeys) {
    changes.push({
      type: 'added',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: 'compatible',
      after: newDictionary[key]
    });
  }

  for (const key of removedKeys) {
    changes.push({
      type: 'removed',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: 'breaking',
      before: oldDictionary[key]
    });
  }

  for (const key of sharedKeys) {
    if (deepEqual(oldDictionary[key], newDictionary[key])) {
      continue;
    }
    changes.push({
      type: 'modified',
      target: options.target,
      path: joinChangePath(options.prefix, key),
      impact: options.classifyModified(oldDictionary[key], newDictionary[key]),
      before: oldDictionary[key],
      after: newDictionary[key]
    });
  }
}

function diffScreener(oldDefinition: FormspecDefinition, newDefinition: FormspecDefinition, changes: ChangelogChange[]): void {
  const oldScreener = oldDefinition.screener;
  const newScreener = newDefinition.screener;
  if (deepEqual(oldScreener, newScreener)) {
    return;
  }

  if (!oldScreener && newScreener) {
    changes.push({
      type: 'added',
      target: 'screener',
      path: 'screener',
      impact: 'compatible',
      after: newScreener
    });
    return;
  }

  if (oldScreener && !newScreener) {
    changes.push({
      type: 'removed',
      target: 'screener',
      path: 'screener',
      impact: 'breaking',
      before: oldScreener
    });
    return;
  }

  changes.push({
    type: 'modified',
    target: 'screener',
    path: 'screener',
    impact: 'compatible',
    before: oldScreener,
    after: newScreener
  });
}

function diffMigrations(oldDefinition: FormspecDefinition, newDefinition: FormspecDefinition, changes: ChangelogChange[]): void {
  const oldMigrations = oldDefinition.migrations ?? [];
  const newMigrations = newDefinition.migrations ?? [];
  if (deepEqual(oldMigrations, newMigrations)) {
    return;
  }

  if (oldMigrations.length === 0 && newMigrations.length > 0) {
    changes.push({
      type: 'added',
      target: 'migration',
      path: 'migrations',
      impact: 'compatible',
      after: newMigrations
    });
    return;
  }

  if (oldMigrations.length > 0 && newMigrations.length === 0) {
    changes.push({
      type: 'removed',
      target: 'migration',
      path: 'migrations',
      impact: 'compatible',
      before: oldMigrations
    });
    return;
  }

  changes.push({
    type: 'modified',
    target: 'migration',
    path: 'migrations',
    impact: 'cosmetic',
    before: oldMigrations,
    after: newMigrations
  });
}

function diffMetadata(oldDefinition: FormspecDefinition, newDefinition: FormspecDefinition, changes: ChangelogChange[]): void {
  const oldRecord = oldDefinition as Record<string, unknown>;
  const newRecord = newDefinition as Record<string, unknown>;

  for (const key of METADATA_KEYS) {
    const oldValue = oldRecord[key];
    const newValue = newRecord[key];
    if (deepEqual(oldValue, newValue)) {
      continue;
    }

    if (oldValue === undefined) {
      changes.push({
        type: 'added',
        target: 'metadata',
        path: key,
        impact: 'cosmetic',
        after: newValue
      });
      continue;
    }

    if (newValue === undefined) {
      changes.push({
        type: 'removed',
        target: 'metadata',
        path: key,
        impact: 'cosmetic',
        before: oldValue
      });
      continue;
    }

    changes.push({
      type: 'modified',
      target: 'metadata',
      path: key,
      impact: 'cosmetic',
      before: oldValue,
      after: newValue
    });
  }
}

function flattenItems(items: FormspecItem[], parentPath: string | null = null, output: FlattenedItem[] = []): FlattenedItem[] {
  for (const item of items) {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    output.push({
      key: item.key,
      path,
      item
    });
    if (item.type === 'group' && item.children?.length) {
      flattenItems(item.children, path, output);
    }
  }
  return output;
}

function classifyItemModify(oldItem: FormspecItem, newItem: FormspecItem): ChangelogImpact {
  if (oldItem.type !== newItem.type) {
    return 'breaking';
  }
  if (oldItem.type === 'field' && newItem.type === 'field' && oldItem.dataType !== newItem.dataType) {
    return 'breaking';
  }
  if (!isRequiredValue(oldItem.required) && isRequiredValue(newItem.required)) {
    return 'breaking';
  }
  if (hasOptionValueRemoval(oldItem, newItem)) {
    return 'breaking';
  }

  const changedKeys = getChangedKeys(oldItem as Record<string, unknown>, newItem as Record<string, unknown>);
  if (changedKeys.length > 0 && changedKeys.every((key) => ITEM_COSMETIC_KEYS.has(key))) {
    return 'cosmetic';
  }
  return 'compatible';
}

function classifyBindAdd(bind: FormspecBind): ChangelogImpact {
  return isRequiredValue(bind.required) ? 'breaking' : 'compatible';
}

function classifyBindRemove(): ChangelogImpact {
  return 'breaking';
}

function classifyBindModify(oldBind: FormspecBind, newBind: FormspecBind): ChangelogImpact {
  if (!isRequiredValue(oldBind.required) && isRequiredValue(newBind.required)) {
    return 'breaking';
  }
  if (isRequiredValue(oldBind.required) && !isRequiredValue(newBind.required)) {
    return 'compatible';
  }

  const changedKeys = getChangedKeys(oldBind as Record<string, unknown>, newBind as Record<string, unknown>);
  if (changedKeys.length > 0 && changedKeys.every((key) => BIND_COSMETIC_KEYS.has(key))) {
    return 'cosmetic';
  }
  if (changedKeys.length === 0) {
    return 'cosmetic';
  }
  return 'compatible';
}

function classifyShapeModify(oldShape: FormspecShape, newShape: FormspecShape): ChangelogImpact {
  const changedKeys = getChangedKeys(oldShape as Record<string, unknown>, newShape as Record<string, unknown>);
  if (changedKeys.length > 0 && changedKeys.every((key) => SHAPE_COSMETIC_KEYS.has(key))) {
    return 'cosmetic';
  }
  return 'compatible';
}

function classifyOptionSetModify(oldValue: unknown, newValue: unknown): ChangelogImpact {
  if (!Array.isArray(oldValue) || !Array.isArray(newValue)) {
    return 'compatible';
  }

  const oldSet = new Set(oldValue.map(resolveOptionIdentity));
  const newSet = new Set(newValue.map(resolveOptionIdentity));
  for (const optionValue of oldSet) {
    if (!newSet.has(optionValue)) {
      return 'breaking';
    }
  }
  for (const optionValue of newSet) {
    if (!oldSet.has(optionValue)) {
      return 'compatible';
    }
  }

  return deepEqual(oldValue, newValue) ? 'compatible' : 'cosmetic';
}

function hasOptionValueRemoval(oldItem: FormspecItem, newItem: FormspecItem): boolean {
  if (
    oldItem.type !== 'field' ||
    newItem.type !== 'field' ||
    !Array.isArray(oldItem.options) ||
    !Array.isArray(newItem.options)
  ) {
    return false;
  }

  const oldSet = new Set(oldItem.options.map(resolveOptionIdentity));
  const newSet = new Set(newItem.options.map(resolveOptionIdentity));
  for (const value of oldSet) {
    if (!newSet.has(value)) {
      return true;
    }
  }
  return false;
}

function resolveOptionIdentity(option: unknown): string {
  if (typeof option === 'string') {
    return option;
  }
  if (option && typeof option === 'object' && !Array.isArray(option)) {
    const value = (option as Record<string, unknown>).value;
    if (value !== undefined) {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(option);
}

function isRenameCandidate(oldItem: FormspecItem, newItem: FormspecItem): boolean {
  if (oldItem.type !== newItem.type) {
    return false;
  }

  if (oldItem.type === 'field' && newItem.type === 'field' && oldItem.dataType !== newItem.dataType) {
    return false;
  }

  const oldFingerprint = itemFingerprint(oldItem);
  const newFingerprint = itemFingerprint(newItem);
  return deepEqual(oldFingerprint, newFingerprint);
}

function itemFingerprint(item: FormspecItem): Record<string, unknown> {
  const fingerprint = structuredClone(item) as Record<string, unknown>;
  delete fingerprint.key;
  delete fingerprint.label;
  delete fingerprint.hint;
  delete fingerprint.description;
  return fingerprint;
}

function sortChanges(changes: ChangelogChange[]): ChangelogChange[] {
  return [...changes].sort((left, right) => {
    const byTarget = left.target.localeCompare(right.target);
    if (byTarget !== 0) {
      return byTarget;
    }
    const byPath = left.path.localeCompare(right.path);
    if (byPath !== 0) {
      return byPath;
    }
    return left.type.localeCompare(right.type);
  });
}

function computeSemverImpact(changes: ChangelogChange[]): SemverImpact {
  if (changes.some((change) => change.impact === 'breaking')) {
    return 'major';
  }
  if (changes.some((change) => change.impact === 'compatible')) {
    return 'minor';
  }
  return 'patch';
}

function getChangedKeys(oldObject: Record<string, unknown>, newObject: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(oldObject), ...Object.keys(newObject)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!deepEqual(oldObject[key], newObject[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function isRequiredValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'null') {
    return false;
  }
  return true;
}

function resolveKey(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function joinChangePath(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeVersionString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSummary(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
