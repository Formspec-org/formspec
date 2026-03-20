//! Formspec core processing — FEL, paths, schemas, assembly, mappings, extensions.

/// Formspec core processing — FEL analysis, path utils, schema validation, assembler.
///
/// This crate depends on `fel-core` and provides the non-reactive processing layer
/// that replaces the TypeScript engine's pure-logic modules.
pub mod assembler;
pub mod changelog;
pub mod extension_analysis;
pub mod fel_analysis;
pub mod fel_rewrite_exact;
pub mod path_utils;
pub mod registry_client;
pub mod runtime_mapping;
pub mod schema_validator;

// Re-export key types
pub use assembler::{AssemblyError, AssemblyResult, MapResolver, RefResolver, assemble_definition};
pub use extension_analysis::{
    ExtensionErrorCode, ExtensionItem, ExtensionSeverity, ExtensionUsageIssue, MapRegistry,
    RegistryEntryInfo, RegistryEntryStatus, RegistryLookup, validate_extension_usage,
};
pub use fel_analysis::{
    FelAnalysis, FelRewriteTargets, NavigationTarget, RewriteOptions, analyze_fel,
    collect_fel_rewrite_targets, get_fel_dependencies, rewrite_fel_references,
};
pub use fel_rewrite_exact::{rewrite_fel_source_references, rewrite_message_template};
pub use path_utils::{
    ItemLocation, TreeItem, item_at_path, item_location_at_path, leaf_key, normalize_indexed_path,
    normalize_path_segment, parent_path, split_normalized_path,
};
pub use runtime_mapping::{
    CoerceType, MappingDiagnostic, MappingDirection, MappingDocument, MappingResult, MappingRule,
    TransformType, UnmappedStrategy, execute_mapping, execute_mapping_doc,
};
pub use schema_validator::{
    ComponentValidationTarget, DocumentType, JsonSchemaValidator, SchemaValidationError,
    SchemaValidationPlan, SchemaValidationResult, detect_document_type, json_pointer_to_jsonpath,
    schema_validation_plan, validate_document,
};
