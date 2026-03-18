//! Formspec core processing — FEL, paths, schemas, assembly, mappings, extensions.

/// Formspec core processing — FEL analysis, path utils, schema validation, assembler.
///
/// This crate depends on `fel-core` and provides the non-reactive processing layer
/// that replaces the TypeScript engine's pure-logic modules.

pub mod assembler;
pub mod extension_analysis;
pub mod fel_analysis;
pub mod path_utils;
pub mod runtime_mapping;
pub mod schema_validator;

// Re-export key types
pub use assembler::{
    assemble_definition, AssemblyError, AssemblyResult, MapResolver, RefResolver,
};
pub use extension_analysis::{
    validate_extension_usage, ExtensionErrorCode, ExtensionItem, ExtensionSeverity,
    ExtensionUsageIssue, MapRegistry, RegistryEntryInfo, RegistryEntryStatus, RegistryLookup,
};
pub use fel_analysis::{
    analyze_fel, get_fel_dependencies, rewrite_fel_references, FelAnalysis, RewriteOptions,
};
pub use path_utils::{
    item_at_path, item_location_at_path, leaf_key, normalize_indexed_path,
    normalize_path_segment, parent_path, split_normalized_path, ItemLocation, TreeItem,
};
pub use runtime_mapping::{
    execute_mapping, CoerceType, MappingDiagnostic, MappingDirection, MappingResult,
    MappingRule, TransformType, UnmappedStrategy,
};
pub use schema_validator::{
    detect_document_type, json_pointer_to_jsonpath, validate_document, DocumentType,
    JsonSchemaValidator, SchemaValidationError, SchemaValidationResult,
};
