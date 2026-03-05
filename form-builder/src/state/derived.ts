/**
 * @module Studio derived signals and diagnostics.
 * Combines schema validation, FormEngine diagnostics, and variable dependency analysis.
 */
import { computed, untracked, type ReadonlySignal, type Signal } from '@preact/signals';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import type {
  FormspecBind,
  FormspecDefinition,
  FormspecItem,
  FormspecShape,
  ValidationResult
} from 'formspec-engine';
import { FormEngine, type FormEngineDiagnosticsSnapshot } from 'formspec-engine';
import definitionSchema from '../../../schemas/definition.schema.json';
import componentSchema from '../../../schemas/component.schema.json';
import themeSchema from '../../../schemas/theme.schema.json';
import mappingSchema from '../../../schemas/mapping.schema.json';
import { projectSignal, type ProjectState } from './project';
import { collectFieldPaths } from './wiring';

/** Normalized severity level used across diagnostics layers. */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** Navigation hint used by diagnostics UI to focus relevant editor state. */
export interface DiagnosticNavigation {
  selectionPath: string | null;
  inspectorSection?: string;
}

/** Normalized diagnostic entry emitted by structural and engine validators. */
export interface DiagnosticEntry {
  id: string;
  layer: 'ajv' | 'engine';
  severity: DiagnosticSeverity;
  source: string;
  path: string;
  message: string;
  code?: string;
  navigation?: DiagnosticNavigation;
}

/** Single AJV structural validation error entry. */
export interface StructuralError {
  path: string;
  message: string;
  navigation?: DiagnosticNavigation;
}

/** Structural validation result for one artifact document. */
export interface StructuralDocumentDiagnostics {
  valid: boolean;
  errors: StructuralError[];
}

/** Structural diagnostics grouped by Studio artifact. */
export interface StructuralDiagnostics {
  definition: StructuralDocumentDiagnostics;
  component: StructuralDocumentDiagnostics;
  theme: StructuralDocumentDiagnostics;
  mapping: StructuralDocumentDiagnostics;
}

/** Current FormEngine instance state used by diagnostics and preview. */
export interface EngineState {
  engine: FormEngine | null;
  error: string | null;
  snapshot: FormEngineDiagnosticsSnapshot | null;
}

/** Merged diagnostics payload consumed by the diagnostics panel. */
export interface CombinedDiagnostics {
  counts: Record<DiagnosticSeverity, number>;
  entries: DiagnosticEntry[];
  structural: StructuralDiagnostics;
  engine: EngineState;
}

/** Public derived signals computed from the project signal. */
export interface ProjectDerivedSignals {
  fieldPaths: ReadonlySignal<string[]>;
  variableDependencies: ReadonlySignal<VariableDependencyEntry[]>;
  structuralDiagnostics: ReadonlySignal<StructuralDiagnostics>;
  engineState: ReadonlySignal<EngineState>;
  diagnostics: ReadonlySignal<CombinedDiagnostics>;
}

/** One location that references a variable. */
export interface VariableDependencyUsage {
  id: string;
  kind: 'variable' | 'bind' | 'item' | 'shape';
  label: string;
  path: string | null;
  property: string;
}

/** Dependency graph node for a project variable. */
export interface VariableDependencyEntry {
  index: number;
  name: string;
  scope: string;
  expression: string;
  dependsOnFields: string[];
  dependsOnVariables: string[];
  usedBy: VariableDependencyUsage[];
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});

const validateDefinition = ajv.compile(definitionSchema as Record<string, unknown>);
const validateComponent = ajv.compile(componentSchema as Record<string, unknown>);
const validateTheme = ajv.compile(themeSchema as Record<string, unknown>);
const validateMapping = ajv.compile(mappingSchema as Record<string, unknown>);

/**
 * Builds all computed Studio signals from a project signal.
 * Re-computes structural + engine diagnostics whenever project artifacts change.
 */
export function createDerivedSignals(project: Signal<ProjectState> = projectSignal): ProjectDerivedSignals {
  const fieldPaths = computed(() => collectFieldPaths(project.value.definition.items));
  const variableDependencies = computed<VariableDependencyEntry[]>(() =>
    deriveVariableDependencies(project.value.definition)
  );

  const structuralDiagnostics = computed<StructuralDiagnostics>(() => {
    const state = project.value;

    return {
      definition: evaluateSchema(validateDefinition, state.definition, {
        document: 'definition',
        definition: state.definition
      }),
      component: evaluateSchema(validateComponent, state.component),
      theme: evaluateSchema(validateTheme, state.theme),
      mapping: evaluateSchema(validateMapping, state.mapping)
    };
  });

  const engineState = computed<EngineState>(() => {
    const definition = project.value.definition;
    return untracked(() => {
      try {
        const engine = new FormEngine(definition);
        return {
          engine,
          error: null,
          snapshot: engine.getDiagnosticsSnapshot({ mode: 'continuous' })
        };
      } catch (error) {
        return {
          engine: null,
          error: error instanceof Error ? error.message : String(error),
          snapshot: null
        };
      }
    });
  });

  const diagnostics = computed<CombinedDiagnostics>(() => {
    const structural = structuralDiagnostics.value;
    const engine = engineState.value;
    const definition = project.value.definition;

    const entries = sortDiagnostics([
      ...buildStructuralEntries(structural),
      ...buildEngineEntries(engine, definition)
    ]);
    const counts = summarizeCounts(entries);

    return {
      counts,
      entries,
      structural,
      engine
    };
  });

  return {
    fieldPaths,
    variableDependencies,
    structuralDiagnostics,
    engineState,
    diagnostics
  };
}

/** Shared singleton derived signal graph for the default project signal. */
export const derivedSignals = createDerivedSignals(projectSignal);

const ITEM_EXPRESSION_KEYS: Array<keyof FormspecItem> = [
  'relevant',
  'required',
  'calculate',
  'readonly',
  'constraint'
];
const BIND_EXPRESSION_KEYS: Array<keyof FormspecBind> = [
  'relevant',
  'required',
  'calculate',
  'readonly',
  'constraint'
];
const SHAPE_EXPRESSION_ARRAY_KEYS: Array<keyof FormspecShape> = ['and', 'or', 'xone'];
const VARIABLE_REFERENCE_EXCLUSIONS = new Set(['index', 'current', 'count', 'instance']);

interface ExpressionSource {
  id: string;
  kind: VariableDependencyUsage['kind'];
  label: string;
  path: string | null;
  property: string;
  expression: string;
}

interface ExpressionAnalysis {
  fieldRefs: string[];
  variableRefs: string[];
}

/** Builds variable dependency metadata used by the Variables inspector panel. */
export function deriveVariableDependencies(definition: FormspecDefinition): VariableDependencyEntry[] {
  const variables = definition.variables ?? [];
  const variableIndexesByName = new Map<string, number[]>();
  for (let variableIndex = 0; variableIndex < variables.length; variableIndex += 1) {
    const variableName = variables[variableIndex]?.name;
    if (!variableName) {
      continue;
    }
    const indexes = variableIndexesByName.get(variableName) ?? [];
    indexes.push(variableIndex);
    variableIndexesByName.set(variableName, indexes);
  }

  const sourceEntries = collectExpressionSources(definition);

  const fieldDepsByIndex = new Map<number, Set<string>>();
  const variableDepsByIndex = new Map<number, Set<string>>();
  const usedByByIndex = new Map<number, Map<string, VariableDependencyUsage>>();

  for (let variableIndex = 0; variableIndex < variables.length; variableIndex += 1) {
    fieldDepsByIndex.set(variableIndex, new Set());
    variableDepsByIndex.set(variableIndex, new Set());
    usedByByIndex.set(variableIndex, new Map());
  }

  for (let variableIndex = 0; variableIndex < variables.length; variableIndex += 1) {
    const variable = variables[variableIndex];
    const analysis = analyzeExpressionReferences(variable.expression);
    const fieldDeps = fieldDepsByIndex.get(variableIndex);
    const variableDeps = variableDepsByIndex.get(variableIndex);
    if (fieldDeps) {
      for (const dependencyPath of analysis.fieldRefs) {
        fieldDeps.add(dependencyPath);
      }
    }
    if (variableDeps) {
      for (const dependencyName of analysis.variableRefs) {
        const matchingIndexes = variableIndexesByName.get(dependencyName) ?? [];
        for (const matchingIndex of matchingIndexes) {
          if (matchingIndex === variableIndex) {
            continue;
          }
          const matchingVariable = variables[matchingIndex];
          if (matchingVariable?.name) {
            variableDeps.add(matchingVariable.name);
          }
        }
      }
    }
  }

  for (const source of sourceEntries) {
    const analysis = analyzeExpressionReferences(source.expression);
    for (const variableName of analysis.variableRefs) {
      const matchingIndexes = variableIndexesByName.get(variableName) ?? [];
      if (!matchingIndexes.length) {
        continue;
      }

      for (const variableIndex of matchingIndexes) {
        const usedBy = usedByByIndex.get(variableIndex);
        if (!usedBy || usedBy.has(source.id)) {
          continue;
        }

        usedBy.set(source.id, {
          id: source.id,
          kind: source.kind,
          label: formatUsageLabel(source),
          path: source.path,
          property: source.property
        });
      }
    }
  }

  return variables.map((variable, variableIndex) => ({
    index: variableIndex,
    name: variable.name,
    scope: variable.scope ?? '#',
    expression: variable.expression,
    dependsOnFields: toSortedList(fieldDepsByIndex.get(variableIndex)),
    dependsOnVariables: toSortedList(variableDepsByIndex.get(variableIndex)),
    usedBy: [...(usedByByIndex.get(variableIndex)?.values() ?? [])].sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }));
}

function collectExpressionSources(definition: FormspecDefinition): ExpressionSource[] {
  const sources: ExpressionSource[] = [];

  const variables = definition.variables ?? [];
  for (let variableIndex = 0; variableIndex < variables.length; variableIndex += 1) {
    const variable = variables[variableIndex];
    if (typeof variable.expression !== 'string') {
      continue;
    }

    sources.push({
      id: `variable:${variableIndex}:expression`,
      kind: 'variable',
      label: variable.name || `Variable ${variableIndex + 1}`,
      path: variable.scope ?? '#',
      property: 'expression',
      expression: variable.expression
    });
  }

  const binds = definition.binds ?? [];
  for (let bindIndex = 0; bindIndex < binds.length; bindIndex += 1) {
    const bind = binds[bindIndex];
    for (const key of BIND_EXPRESSION_KEYS) {
      const expression = bind[key];
      if (typeof expression !== 'string') {
        continue;
      }

      sources.push({
        id: `bind:${bindIndex}:${String(key)}`,
        kind: 'bind',
        label: bind.path,
        path: bind.path,
        property: String(key),
        expression
      });
    }

    if (typeof bind.constraintMessage === 'string') {
      const messageExpressions = extractTemplateExpressions(bind.constraintMessage);
      for (let index = 0; index < messageExpressions.length; index += 1) {
        sources.push({
          id: `bind:${bindIndex}:constraintMessage:${index}`,
          kind: 'bind',
          label: bind.path,
          path: bind.path,
          property: 'constraintMessage',
          expression: messageExpressions[index]
        });
      }
    }
  }

  collectItemExpressionSources(definition.items, null, sources);

  const shapes = definition.shapes ?? [];
  for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex += 1) {
    const shape = shapes[shapeIndex];

    const directExpressions: Array<[keyof FormspecShape, string | undefined]> = [
      ['constraint', shape.constraint],
      ['activeWhen', shape.activeWhen],
      ['not', shape.not]
    ];

    for (const [key, expression] of directExpressions) {
      if (typeof expression !== 'string') {
        continue;
      }
      sources.push({
        id: `shape:${shapeIndex}:${String(key)}`,
        kind: 'shape',
        label: shape.id,
        path: shape.target === '#' ? null : shape.target,
        property: String(key),
        expression
      });
    }

    for (const key of SHAPE_EXPRESSION_ARRAY_KEYS) {
      const expressions = shape[key];
      if (!Array.isArray(expressions)) {
        continue;
      }
      for (let expressionIndex = 0; expressionIndex < expressions.length; expressionIndex += 1) {
        const expression = expressions[expressionIndex];
        if (typeof expression !== 'string') {
          continue;
        }
        sources.push({
          id: `shape:${shapeIndex}:${String(key)}:${expressionIndex}`,
          kind: 'shape',
          label: shape.id,
          path: shape.target === '#' ? null : shape.target,
          property: String(key),
          expression
        });
      }
    }

    if (shape.context) {
      for (const [contextKey, expression] of Object.entries(shape.context)) {
        sources.push({
          id: `shape:${shapeIndex}:context:${contextKey}`,
          kind: 'shape',
          label: shape.id,
          path: shape.target === '#' ? null : shape.target,
          property: `context.${contextKey}`,
          expression
        });
      }
    }

    if (typeof shape.message === 'string') {
      const messageExpressions = extractTemplateExpressions(shape.message);
      for (let index = 0; index < messageExpressions.length; index += 1) {
        sources.push({
          id: `shape:${shapeIndex}:message:${index}`,
          kind: 'shape',
          label: shape.id,
          path: shape.target === '#' ? null : shape.target,
          property: 'message',
          expression: messageExpressions[index]
        });
      }
    }
  }

  return sources;
}

function collectItemExpressionSources(
  items: FormspecItem[],
  parentPath: string | null,
  sources: ExpressionSource[]
): void {
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;

    for (const key of ITEM_EXPRESSION_KEYS) {
      const expression = item[key];
      if (typeof expression !== 'string') {
        continue;
      }

      sources.push({
        id: `item:${path}:${String(key)}`,
        kind: 'item',
        label: path,
        path,
        property: String(key),
        expression
      });
    }

    if (typeof item.message === 'string') {
      const messageExpressions = extractTemplateExpressions(item.message);
      for (let expressionIndex = 0; expressionIndex < messageExpressions.length; expressionIndex += 1) {
        sources.push({
          id: `item:${path}:message:${expressionIndex}`,
          kind: 'item',
          label: path,
          path,
          property: 'message',
          expression: messageExpressions[expressionIndex]
        });
      }
    }

    if (item.children?.length) {
      collectItemExpressionSources(item.children, path, sources);
    }
  }
}

function analyzeExpressionReferences(expression: string): ExpressionAnalysis {
  const source = stripStringLiterals(expression);
  const fieldRefs = new Set<string>();
  const variableRefs = new Set<string>();

  const fieldPattern = /\$([A-Za-z_][A-Za-z0-9_]*(?:\[(?:\d+|\*)\])?(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[(?:\d+|\*)\])?)*)/g;
  for (const match of source.matchAll(fieldPattern)) {
    const path = (match[1] ?? '').trim();
    if (path) {
      fieldRefs.add(path);
    }
  }

  const atVariablePattern = /@([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
  for (const match of source.matchAll(atVariablePattern)) {
    const name = (match[1] ?? '').trim();
    if (name && !VARIABLE_REFERENCE_EXCLUSIONS.has(name)) {
      variableRefs.add(name);
    }
  }

  const hashVariablePattern = /#:\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const match of source.matchAll(hashVariablePattern)) {
    const name = (match[1] ?? '').trim();
    if (name) {
      variableRefs.add(name);
    }
  }

  return {
    fieldRefs: [...fieldRefs].sort((left, right) => left.localeCompare(right)),
    variableRefs: [...variableRefs].sort((left, right) => left.localeCompare(right))
  };
}

function stripStringLiterals(value: string): string {
  return value.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, ' ');
}

function extractTemplateExpressions(template: string): string[] {
  const expressions: string[] = [];
  const pattern = /\{\{(.*?)\}\}/g;
  for (const match of template.matchAll(pattern)) {
    const expression = (match[1] ?? '').trim();
    if (expression) {
      expressions.push(expression);
    }
  }
  return expressions;
}

function formatUsageLabel(source: ExpressionSource): string {
  if (source.kind === 'variable') {
    return `Variable ${source.label} (${source.property})`;
  }

  if (source.kind === 'shape') {
    return `Shape ${source.label} (${source.property})`;
  }

  if (source.kind === 'bind') {
    return `${source.label} bind (${source.property})`;
  }

  return `${source.label} item (${source.property})`;
}

function toSortedList(values: Set<string> | undefined): string[] {
  if (!values || values.size === 0) {
    return [];
  }
  return [...values].sort((left, right) => left.localeCompare(right));
}

function evaluateSchema(
  validate: ((payload: unknown) => boolean) & { errors?: ErrorObject[] | null },
  payload: unknown,
  context?: {
    document: 'definition';
    definition: FormspecDefinition;
  }
): StructuralDocumentDiagnostics {
  const valid = validate(payload);
  return {
    valid,
    errors: summarizeAjvErrors(validate.errors, context)
  };
}

function summarizeAjvErrors(
  errors: ErrorObject[] | null | undefined,
  context?: {
    document: 'definition';
    definition: FormspecDefinition;
  }
): StructuralError[] {
  if (!errors?.length) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || '/';
    const navigation = context?.document === 'definition'
      ? resolveDefinitionNavigation(context.definition, path)
      : undefined;

    return {
      path,
      message: error.message ?? 'Schema validation error',
      navigation
    };
  });
}

function buildStructuralEntries(structural: StructuralDiagnostics): DiagnosticEntry[] {
  return [
    ...mapStructuralDocumentEntries('definition', 'Definition schema', structural.definition.errors),
    ...mapStructuralDocumentEntries('component', 'Component schema', structural.component.errors),
    ...mapStructuralDocumentEntries('theme', 'Theme schema', structural.theme.errors),
    ...mapStructuralDocumentEntries('mapping', 'Mapping schema', structural.mapping.errors)
  ];
}

function mapStructuralDocumentEntries(
  key: 'definition' | 'component' | 'theme' | 'mapping',
  source: string,
  errors: StructuralError[]
): DiagnosticEntry[] {
  return errors.map((error, index) => ({
    id: `ajv:${key}:${index}`,
    layer: 'ajv',
    severity: 'error',
    source,
    path: error.path,
    message: error.message,
    navigation: error.navigation
  }));
}

function buildEngineEntries(engine: EngineState, definition: FormspecDefinition): DiagnosticEntry[] {
  const entries: DiagnosticEntry[] = [];

  const results = engine.snapshot?.validation.results ?? [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    entries.push({
      id: `engine:validation:${index}`,
      layer: 'engine',
      severity: result.severity,
      source: result.source === 'shape' ? 'Shape rule' : 'Bind rule',
      path: result.path || '#',
      message: result.message,
      code: result.code,
      navigation: resolveEngineNavigation(result, definition)
    });
  }

  if (engine.error) {
    entries.push({
      id: 'engine:bootstrap',
      layer: 'engine',
      severity: 'error',
      source: 'Engine runtime',
      path: '#',
      message: engine.error
    });
  }

  return entries;
}

function sortDiagnostics(entries: DiagnosticEntry[]): DiagnosticEntry[] {
  const severityRank: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2
  };

  return [...entries].sort((left, right) => {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }
    if (left.layer !== right.layer) {
      return left.layer.localeCompare(right.layer);
    }
    return left.source.localeCompare(right.source);
  });
}

function summarizeCounts(entries: DiagnosticEntry[]): Record<DiagnosticSeverity, number> {
  const counts: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0
  };

  for (const entry of entries) {
    counts[entry.severity] += 1;
  }

  return counts;
}

function resolveDefinitionNavigation(definition: FormspecDefinition, pointer: string): DiagnosticNavigation | undefined {
  const selectionPath = resolveDefinitionPathFromPointer(definition, pointer);
  if (!selectionPath) {
    return undefined;
  }

  return {
    selectionPath
  };
}

function resolveDefinitionPathFromPointer(definition: FormspecDefinition, pointer: string): string | null {
  const segments = toPointerSegments(pointer);
  if (!segments.length) {
    return null;
  }

  if (segments[0] === 'items') {
    return resolveItemPathFromSegments(definition.items, segments.slice(1));
  }

  if (segments[0] === 'binds') {
    const bindIndex = toPointerIndex(segments[1]);
    if (bindIndex === null) {
      return null;
    }
    const bindPath = definition.binds?.[bindIndex]?.path;
    return typeof bindPath === 'string' ? normalizeSelectionPath(bindPath) : null;
  }

  if (segments[0] === 'shapes') {
    const shapeIndex = toPointerIndex(segments[1]);
    if (shapeIndex === null) {
      return null;
    }
    const target = definition.shapes?.[shapeIndex]?.target;
    if (!target || target === '#') {
      return null;
    }
    return normalizeSelectionPath(target);
  }

  if (segments[0] === 'variables') {
    const variableIndex = toPointerIndex(segments[1]);
    if (variableIndex === null) {
      return null;
    }
    const scope = definition.variables?.[variableIndex]?.scope;
    if (!scope || scope === '#') {
      return null;
    }
    return normalizeSelectionPath(scope);
  }

  return null;
}

function resolveItemPathFromSegments(items: FormspecItem[], segments: string[]): string | null {
  if (!segments.length) {
    return null;
  }

  const selectionSegments: string[] = [];
  let cursor = 0;
  let currentItems = items;

  while (cursor < segments.length) {
    const itemIndex = toPointerIndex(segments[cursor]);
    if (itemIndex === null || itemIndex < 0 || itemIndex >= currentItems.length) {
      break;
    }

    const item = currentItems[itemIndex];
    selectionSegments.push(item.key);
    cursor += 1;

    if (segments[cursor] !== 'children') {
      break;
    }

    cursor += 1;
    currentItems = item.children ?? [];
  }

  return selectionSegments.length > 0 ? selectionSegments.join('.') : null;
}

function toPointerSegments(pointer: string): string[] {
  if (!pointer || pointer === '/') {
    return [];
  }

  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .filter((segment) => segment.length > 0);
}

function toPointerIndex(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

function resolveEngineNavigation(
  result: ValidationResult,
  definition: FormspecDefinition
): DiagnosticNavigation | undefined {
  const normalizedPath = normalizeSelectionPath(result.path);
  if (!normalizedPath || normalizedPath === '#') {
    if (result.source === 'shape' || result.constraintKind === 'shape') {
      return {
        selectionPath: null,
        inspectorSection: 'form:rules'
      };
    }
    return undefined;
  }

  if (!hasItemAtPath(definition.items, normalizedPath)) {
    return undefined;
  }

  return {
    selectionPath: normalizedPath,
    inspectorSection: mapInspectorSectionForValidation(result)
  };
}

function mapInspectorSectionForValidation(result: ValidationResult): string | undefined {
  if (result.source === 'shape' || result.constraintKind === 'shape') {
    return 'form:rules';
  }

  if (result.constraintKind === 'constraint') {
    return 'field:validation';
  }

  if (result.constraintKind === 'required' || result.constraintKind === 'type' || result.constraintKind === 'cardinality') {
    return 'field:basics';
  }

  if (result.constraintKind === 'external') {
    return 'field:logic';
  }

  return undefined;
}

function hasItemAtPath(items: FormspecItem[], path: string): boolean {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) {
    return false;
  }

  let currentItems = items;
  for (let index = 0; index < segments.length; index += 1) {
    const item = currentItems.find((candidate) => candidate.key === segments[index]);
    if (!item) {
      return false;
    }
    if (index === segments.length - 1) {
      return true;
    }
    currentItems = item.children ?? [];
  }

  return false;
}

function normalizeSelectionPath(path: string | undefined): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\[\d+\]/g, '').trim();
  return normalized.length > 0 ? normalized : null;
}
