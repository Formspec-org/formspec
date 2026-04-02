/** @filedesc Public API barrel for the Formspec engine package (WASM-backed evaluation). */

import type {
    FormBind,
    FormDefinition,
    FormInstance,
    FormItem,
    FormShape,
    FormVariable,
    OptionEntry,
    ValidationReport as FormspecValidationReport,
    ValidationResult as FormspecValidationResult,
} from '@formspec-org/types';

export type {
    AssemblyProvenance,
    AssemblyResult,
    ComponentDocument,
    ComponentObject,
    DefinitionResolver,
    DocumentType,
    EngineNowInput,
    EngineReplayApplyResult,
    EngineReplayEvent,
    EngineReplayResult,
    ExtensionUsageIssue,
    FELAnalysis,
    FELAnalysisError,
    FELBuiltinFunctionCatalogEntry,
    FELRewriteOptions,
    FormEngineDiagnosticsSnapshot,
    FormProgress,
    FormEngineRuntimeContext,
    IFormEngine,
    IRuntimeMappingEngine,
    MappingDiagnostic,
    MappingDirection,
    PinnedResponseReference,
    RegistryEntry,
    RemoteOptionsState,
    RewriteMap,
    RuntimeMappingResult,
    SchemaValidationError,
    SchemaValidationResult,
    SchemaValidator,
    SchemaValidatorSchemas,
} from './interfaces.js';

export type FormspecItem = FormItem;
export type FormspecBind = FormBind & { remoteOptions?: string };
export type FormspecShape = FormShape;
export type FormspecVariable = FormVariable;
export type FormspecInstance = FormInstance;
export type FormspecDefinition = FormDefinition;
export type FormspecOption = OptionEntry;
export type ValidationResult = FormspecValidationResult;
export type ValidationReport = FormspecValidationReport;

export type { EngineReactiveRuntime, EngineSignal, ReadonlyEngineSignal } from './reactivity/types.js';
export { preactReactiveRuntime } from './reactivity/preact-runtime.js';

export {
    initFormspecEngine,
    initFormspecEngine as initEngine,
    initFormspecEngineTools,
    isFormspecEngineInitialized,
    isFormspecEngineToolsInitialized,
} from './init-formspec-engine.js';

export {
    normalizeIndexedPath,
    itemAtPath,
    tokenizeFEL,
    analyzeFEL,
    normalizePathSegment,
    splitNormalizedPath,
    itemLocationAtPath,
    rewriteFELReferences,
    rewriteMessageTemplate,
    lintDocument,
    parseRegistry,
    findRegistryEntry,
    validateLifecycleTransition,
    wellKnownRegistryUrl,
    generateChangelog,
    printFEL,
    evaluateDefinition,
    getBuiltinFELFunctionCatalog,
    getFELDependencies,
    isValidFELIdentifier,
    sanitizeFELIdentifier,
    validateExtensionUsage,
    createSchemaValidator,
    rewriteFEL,
} from './fel/fel-api.js';

export type { TreeItemLike, ItemLocation } from './fel/fel-api.js';

export { createMappingEngine, RuntimeMappingEngine } from './mapping/RuntimeMappingEngine.js';

/** FEL eval for tooling (WASM); returns a JSON-compatible value. */
export { wasmEvalFEL as evalFEL } from './wasm-bridge-runtime.js';

/** Lint with extension registries (WASM). */
export { wasmLintDocumentWithRegistries as lintDocumentWithRegistries } from './wasm-bridge-tools.js';

/** Evaluate a standalone Screener Document (WASM); returns a DeterminationRecord. */
export { wasmEvaluateScreenerDocument } from './wasm-bridge-runtime.js';

export { buildValidationReportEnvelope } from './engine/response-assembly.js';
export { toValidationResults } from './engine/helpers.js';
export type { EvalValidation } from './diff.js';

export { assembleDefinition, assembleDefinitionSync } from './assembly/assembleDefinition.js';

export {
    isNumericType, isDateType, isChoiceType, isTextType, isBinaryType, isBooleanType,
    isMoneyType, isUriType,
} from './taxonomy.js';

export { interpolateMessage } from './interpolate-message.js';
export type { InterpolateResult, InterpolationWarning } from './interpolate-message.js';

export { LocaleStore } from './locale.js';
export type { LocaleDocument, LookupResult } from './locale.js';

export { createFieldViewModel } from './field-view-model.js';
export type { FieldViewModel, FieldViewModelDeps, ResolvedValidationResult, ResolvedOption } from './field-view-model.js';

export { optionMatchesComboboxQuery } from './combobox-option-filter.js';
export type { ComboboxOptionSearchShape } from './combobox-option-filter.js';

export { createFormViewModel } from './form-view-model.js';
export type { FormViewModel, FormViewModelDeps } from './form-view-model.js';

export { FormEngine } from './engine/FormEngine.js';
export { createFormEngine } from './engine/init.js';

export type { FormspecEnginePackage } from './package-interface.js';
