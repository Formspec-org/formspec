//! Formspec core processing — FEL, paths, schemas, assembly, mappings, extensions.

/// Formspec core processing — FEL analysis, path utils, schema validation, assembler.
///
/// This crate depends on `fel-core` and provides the non-reactive processing layer
/// that replaces the TypeScript engine's pure-logic modules.
pub mod assembler;
pub mod changelog;
pub mod component_tree;
pub mod definition_items;
pub mod extension_analysis;
pub mod fel_analysis;
pub mod fel_rewrite_exact;
pub mod json_artifacts;
pub mod json_util;
pub mod path_utils;
pub mod registry_client;
pub mod runtime_mapping;
pub mod schema_validator;
pub mod wire_keys;

// Re-export key types
pub use assembler::{
    AssemblyError, AssemblyProvenance, AssemblyResult, MapResolver, RefResolver,
    assemble_definition, assembly_result_to_json_value,
};
pub use extension_analysis::{
    ExtensionErrorCode, ExtensionItem, ExtensionSeverity, ExtensionUsageIssue, JsonDefinitionItem,
    MapRegistry, RegistryEntryInfo, RegistryEntryStatus, RegistryLookup,
    json_definition_items_tree_from_value, map_registry_from_extension_entry_map,
    validate_extension_usage,
};
pub use fel_analysis::{
    FelAnalysis, FelRewriteTargets, NavigationTarget, RewriteOptions, analyze_fel,
    collect_fel_rewrite_targets, fel_analysis_to_json_value, fel_rewrite_targets_to_json_value,
    get_fel_dependencies, rewrite_fel_references, rewrite_options_from_camel_case_json,
};
pub use json_artifacts::{
    JsonWireStyle, changelog_to_json_value, extension_usage_issues_to_json_value,
};
pub use fel_rewrite_exact::{rewrite_fel_source_references, rewrite_message_template};
pub use json_util::json_object_to_string_map;
pub use path_utils::{
    ItemLocation, TreeItem, definition_item_location_to_json_value, item_at_path,
    item_location_at_path, json_definition_item_at_path, json_definition_item_location_at_path,
    leaf_key, normalize_indexed_path, normalize_path_segment, parent_path, split_normalized_path,
};
pub use runtime_mapping::{
    ArrayDescriptor, ArrayMode, CoerceType, MappingDiagnostic, MappingDirection, MappingDocument,
    MappingErrorCode, MappingResult, MappingRule, ReverseOverride, TransformType, UnmappedStrategy,
    execute_mapping, execute_mapping_doc, mapping_direction_wire, mapping_result_to_json_value,
    parse_coerce_type, parse_mapping_direction_field, parse_mapping_direction_wire,
    parse_mapping_document_from_value, parse_mapping_rules_from_value,
};
pub use schema_validator::{
    ComponentValidationTarget, DocumentType, JsonSchemaValidator, SchemaValidationError,
    SchemaValidationPlan, SchemaValidationResult, detect_document_type, json_pointer_to_jsonpath,
    schema_validation_plan, validate_document,
};
pub use component_tree::visit_component_subtree;
pub use definition_items::{
    visit_definition_items_from_document, visit_definition_items_json, DefinitionItemVisitCtx,
};
