/**
 * Barrel re-export for all query modules.
 *
 * Every function here is a pure read: `(state: ProjectState, ...) => result`.
 */
export {
  fieldPaths,
  itemAt,
  responseSchemaRows,
  instanceNames,
  variableNames,
  optionSetUsage,
  searchItems,
  effectivePresentation,
  bindFor,
  componentFor,
  unboundItems,
  resolveToken,
  allDataTypes,
} from './field-queries.js';

export {
  parseFEL,
  felFunctionCatalog,
  availableReferences,
  allExpressions,
  expressionDependencies,
} from './expression-index.js';

export {
  fieldDependents,
  variableDependents,
  dependencyGraph,
} from './dependency-graph.js';

export { statistics } from './statistics.js';

export { diagnose } from './diagnostics.js';

export {
  diffFromBaseline,
  previewChangelog,
  flattenItems,
} from './versioning.js';

export {
  listRegistries,
  browseExtensions,
  resolveExtension,
} from './registry-queries.js';
