/**
 * @module formspec-studio-core
 *
 * Document-agnostic semantic authoring API for Formspec.
 * Project composes IProjectCore (from formspec-core) and exposes
 * 51 behavior-driven helper methods for form authoring.
 *
 * Consumers import types from THIS package — never from formspec-core.
 */

// ── Project ─────────────────────────────────────────────────────────
export { Project, createProject, buildBundleFromDefinition } from './project.js';

// ── ProposalManager (changeset lifecycle) ────────────────────────────
export { ProposalManager } from './proposal-manager.js';
export type {
  Changeset,
  ChangeEntry,
  ChangesetStatus,
  DependencyGroup,
  ReplayFailure,
  MergeResult,
} from './proposal-manager.js';

// ── Studio-core types (own vocabulary) ──────────────────────────────
export type {
  // Schema-derived types (from formspec-types)
  FormItem,
  FormBind,
  FormShape,
  FormVariable,
  FormInstance,
  FormOption,
  FormDefinition,
  ComponentDocument,
  ThemeDocument,
  MappingDocument,
  // Operational types (studio-core's own)
  ProjectBundle,
  ProjectSnapshot,
  ProjectStatistics,
  Diagnostic,
  Diagnostics,
  LogEntry,
  ChangeListener,
  CreateProjectOptions,
} from './types.js';

// ── Helper types ────────────────────────────────────────────────────
export { HelperError } from './helper-types.js';
export type {
  HelperResult,
  HelperWarning,
  FieldProps,
  ContentProps,
  GroupProps,
  RepeatProps,
  BranchPath,
  LayoutArrangement,
  PlacementOptions,
  LayoutAddItemSpec,
  FlowProps,
  ValidationOptions,
  InstanceProps,
  ChoiceOption,
  ItemChanges,
  MetadataChanges,
  WidgetInfo,
  FELValidationResult,
  FELSuggestion,
} from './helper-types.js';

export {
  parseCommaSeparatedKeywords,
  formatCommaSeparatedKeywords,
} from './choice-option-keywords.js';

// ── Field type aliases ──────────────────────────────────────────────
export { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';
export type { ResolvedFieldType } from './field-type-aliases.js';

// ── FEL & dependency query types (re-exported from formspec-core) ────
export type {
  FELParseContext, FELParseResult, FELReferenceSet, FELFunctionEntry,
  FieldDependents, ItemFilter, ItemSearchResult,
} from '@formspec-org/core';

// ── Shape display utilities (re-exported from formspec-core for consumers) ──
export { describeShapeConstraint } from '@formspec-org/core';

// ── Theme utilities (re-exported from formspec-core for consumers) ───
export { resolveThemeCascade } from '@formspec-org/core';
export type { ResolvedProperty } from '@formspec-org/core';

// ── Page resolution utilities ───────────────────────────────────────
export { resolvePageStructure } from '@formspec-org/core';
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic } from '@formspec-org/core';
export { resolveLayoutPageStructure } from './page-structure.js';
export type { PageView, PageItemView, PlaceableItem, PageStructureView, PageStructureViewInput } from './page-structure.js';

// ── Evaluation helpers ──────────────────────────────────────────────
export { previewForm, validateResponse } from './evaluation-helpers.js';

// ── Mapping preview serialization ──────────────────────────────────
export { serializeMappedData } from './mapping-serialization.js';
export type { AdapterOptions } from './mapping-serialization.js';
export { generateDefinitionSampleData, sampleFieldValue } from './mapping-sample-data.js';
export type { MappingSampleOptions } from './mapping-sample-data.js';

// ── Layout context operations ──────────────────────────────────────
export {
  buildLayoutContextMenuItems,
  executeLayoutAction,
} from './layout-context-operations.js';
export type {
  LayoutContextMenuItem,
  LayoutContextMenuState,
} from './layout-context-operations.js';

// ── Keyboard shortcut policy ───────────────────────────────────────
export { handleKeyboardShortcut } from './keyboard.js';
export type { ShortcutHandlers } from './keyboard.js';

// ── Editor tree helpers ────────────────────────────────────────────
export {
  buildAdvisories,
  buildDefinitionAdvisoryIssues,
  buildCategorySummaries,
  buildExpressionDiagnostics,
  buildMissingPropertyActions,
  buildRowSummaries,
  buildStatusPills,
  summarizeExpression,
} from './editor-tree-helpers.js';
export type {
  Advisory,
  AdvisoryAction,
  AdvisoryActionKey,
  AdvisorySeverity,
  BuildStatusPillsOptions,
  CategorySummaries,
  DefinitionAdvisoryIssue,
  ExpressionDiagnostic,
  MissingPropertyAction,
  RowStatusPill,
  RowSummaryEntry,
} from './editor-tree-helpers.js';

// ── FEL editor helpers ─────────────────────────────────────────────
export {
  buildFELHighlightTokens,
  filterFELFieldOptions,
  filterFELFunctionOptions,
  getFELAutocompleteTrigger,
  getFELFunctionAutocompleteTrigger,
  getFELInstanceNameAutocompleteTrigger,
  getInstanceFieldOptions,
  getInstanceNameOptions,
  validateFEL,
} from './fel-editor-utils.js';
export type {
  FELAutocompleteTrigger,
  FELEditorFieldOption,
  FELEditorFunctionOption,
  FELHighlightToken,
} from './fel-editor-utils.js';

// ── Shared authoring helpers ───────────────────────────────────────
export {
  bindsFor,
  flatItems,
  buildBindKeyMap,
  buildDefLookup,
  compatibleWidgets,
  computeUnassignedItems,
  componentForWidgetHint,
  countDefinitionFields,
  dataTypeInfo,
  findComponentNodeById,
  findComponentNodeByRef,
  resolveLayoutSelectionNodeRef,
  flattenComponentTree,
  isCircularComponentMove,
  getFieldTypeCatalog,
  humanizeFEL,
  isLayoutId,
  LAYOUT_CONTAINER_COMPONENTS,
  nodeIdFromLayoutId,
  nodeRefFor,
  normalizeBindEntries,
  normalizeBindsView,
  pruneDescendants,
  propertyHelp,
  sanitizeIdentifier,
  shapesFor,
  sortForBatchDelete,
  buildBatchMoveCommands,
  widgetHintForComponent,
} from './authoring-helpers.js';
export type {
  DataTypeDisplay,
  DefLookupEntry,
  FlatEntry,
  FieldTypeCatalogEntry,
  FlatItem,
  NormalizedBindEntry,
  UnassignedItem,
} from './authoring-helpers.js';

// ── Layout spatial + theme helpers ────────────────────────────────
export {
  componentTreeForLayout,
  hasTier3Content,
  setColumnSpan,
  setRowSpan,
  setPadding,
  setStyleProperty,
  removeStyleProperty,
  getPropertySources,
  getEditableThemeProperties,
  setThemeOverride,
  clearThemeOverride,
} from './layout-helpers.js';
export type {
  CompNode,
  ContainerLayoutProps,
  DataTableColumnSpec,
  EditableThemeProperty,
  NodeRef,
  PropertySource,
} from './layout-helpers.js';

// ── Layout UI business logic helpers (extracted from Studio UI) ──────
export {
  resolveLayoutInsertTarget,
  getItemOverrides,
  addStyleOverride,
  validateTokenName,
  applyBreakpointPresets,
  summarizeSelectorRule,
  getTokensByGroup,
  getGroupedTokens,
  getSortedBreakpoints,
  getEditablePropertiesForNode,
  parseTokenRegistry,
  getTokenRegistryEntry,
  getEnrichedTokensByGroup,
  getEnrichedGroupedTokens,
} from './layout-ui-helpers.js';
export type {
  Token,
  Breakpoint,
  LayoutInsertTarget,
  TokenType,
  TokenRegistryEntry,
  TokenRegistryCategory,
  TokenRegistryMap,
  EnrichedToken,
} from './layout-ui-helpers.js';

export { platformTokenRegistry } from './token-registry.js';

// ── Preview document normalization ─────────────────────────────────
export {
  normalizeComponentDoc,
  normalizeDefinitionDoc,
  normalizeThemeDoc,
} from './preview-documents.js';
