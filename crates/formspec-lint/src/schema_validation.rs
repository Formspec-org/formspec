//! @filedesc Pass 1b: JSON Schema validation — validates documents against embedded schemas (E101).

use std::sync::OnceLock;

use formspec_core::{DocumentType, json_pointer_to_jsonpath};
use jsonschema::{Resource, Validator};
use serde_json::Value;

use crate::types::LintDiagnostic;

// ── Embedded schemas ─────────────────────────────────────────────

const DEFINITION_SCHEMA: &str = include_str!("../../../schemas/definition.schema.json");
const COMPONENT_SCHEMA: &str = include_str!("../../../schemas/component.schema.json");
const THEME_SCHEMA: &str = include_str!("../../../schemas/theme.schema.json");
const RESPONSE_SCHEMA: &str = include_str!("../../../schemas/response.schema.json");
const MAPPING_SCHEMA: &str = include_str!("../../../schemas/mapping.schema.json");
const CHANGELOG_SCHEMA: &str = include_str!("../../../schemas/changelog.schema.json");
const REGISTRY_SCHEMA: &str = include_str!("../../../schemas/registry.schema.json");
const VALIDATION_REPORT_SCHEMA: &str =
    include_str!("../../../schemas/validationReport.schema.json");
const VALIDATION_RESULT_SCHEMA: &str =
    include_str!("../../../schemas/validationResult.schema.json");

// ── Schema text + $id pairs for cross-file $ref resolution ───────

/// All schemas that may be referenced by `$ref` from other schemas.
/// Each entry: (schema JSON text, $id URI from the schema).
const CROSS_REF_SCHEMAS: &[(&str, &str)] = &[
    (
        VALIDATION_RESULT_SCHEMA,
        "https://formspec.org/schemas/validationResult/1.0",
    ),
    (
        COMPONENT_SCHEMA,
        "https://formspec.org/schemas/component/1.0",
    ),
];

// ── Compiled validators (lazily initialized) ─────────────────────

struct SchemaSet {
    definition: Validator,
    component: Validator,
    theme: Validator,
    response: Validator,
    mapping: Validator,
    changelog: Validator,
    registry: Validator,
    validation_report: Validator,
    validation_result: Validator,
}

fn schema_set() -> &'static SchemaSet {
    static SET: OnceLock<SchemaSet> = OnceLock::new();
    SET.get_or_init(|| SchemaSet {
        definition: build_validator(DEFINITION_SCHEMA),
        component: build_validator(COMPONENT_SCHEMA),
        theme: build_validator(THEME_SCHEMA),
        response: build_validator(RESPONSE_SCHEMA),
        mapping: build_validator(MAPPING_SCHEMA),
        changelog: build_validator(CHANGELOG_SCHEMA),
        registry: build_validator(REGISTRY_SCHEMA),
        validation_report: build_validator(VALIDATION_REPORT_SCHEMA),
        validation_result: build_validator(VALIDATION_RESULT_SCHEMA),
    })
}

fn build_validator(schema_text: &str) -> Validator {
    let schema: Value = serde_json::from_str(schema_text).expect("embedded schema is valid JSON");

    let mut opts = jsonschema::options();
    // Register all cross-referenced schemas so $ref resolution works.
    for &(ref_text, ref_id) in CROSS_REF_SCHEMAS {
        let ref_val: Value =
            serde_json::from_str(ref_text).expect("cross-ref schema is valid JSON");
        let resource = Resource::from_contents(ref_val);
        opts = opts.with_resource(ref_id, resource);
    }
    opts.build(&schema).expect("embedded schema compiles")
}

// ── Public API ───────────────────────────────────────────────────

/// Validate a document against its JSON Schema, returning E101 diagnostics.
pub fn validate_schema(doc: &Value, doc_type: DocumentType) -> Vec<LintDiagnostic> {
    let set = schema_set();

    let validator = match doc_type {
        DocumentType::Definition => &set.definition,
        DocumentType::Component => &set.component,
        DocumentType::Theme => &set.theme,
        DocumentType::Response => &set.response,
        DocumentType::Mapping => &set.mapping,
        DocumentType::Changelog => &set.changelog,
        DocumentType::Registry => &set.registry,
        DocumentType::ValidationReport => &set.validation_report,
        DocumentType::ValidationResult => &set.validation_result,
        // No schema for FelFunctions in the lint pipeline
        DocumentType::FelFunctions => return Vec::new(),
    };

    validator
        .iter_errors(doc)
        .map(|err| {
            let pointer = err.instance_path().as_str();
            let path = json_pointer_to_jsonpath(pointer);
            LintDiagnostic::error("E101", 1, path, err.to_string())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LintSeverity;
    use serde_json::json;

    #[test]
    fn detects_invalid_enum_value() {
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/x",
            "version": "1.0.0",
            "status": "draft",
            "title": "X",
            "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "blob"}]
        });
        let diags = validate_schema(&def, DocumentType::Definition);
        assert!(
            diags.iter().any(|d| d.code == "E101"),
            "Should emit E101 for invalid dataType, got: {:?}",
            diags
                .iter()
                .map(|d| (&d.code, &d.path, &d.message))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn valid_definition_produces_no_e101() {
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/x",
            "version": "1.0.0",
            "status": "draft",
            "title": "X",
            "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "string"}]
        });
        let diags = validate_schema(&def, DocumentType::Definition);
        assert!(
            diags.is_empty(),
            "Valid definition should produce no E101, got: {:?}",
            diags
                .iter()
                .map(|d| (&d.code, &d.path, &d.message))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn e101_path_uses_jsonpath() {
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/x",
            "version": "1.0.0",
            "status": "draft",
            "title": "X",
            "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "blob"}]
        });
        let diags = validate_schema(&def, DocumentType::Definition);
        // All paths should start with "$"
        for d in &diags {
            assert!(
                d.path.starts_with('$'),
                "Path should be JSONPath: {}",
                d.path
            );
        }
    }

    #[test]
    fn fel_functions_returns_empty() {
        let doc = json!({"version": "1.0", "functions": []});
        let diags = validate_schema(&doc, DocumentType::FelFunctions);
        assert!(diags.is_empty());
    }

    #[test]
    fn detects_missing_required_field() {
        // Missing "title" which is required
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/x",
            "version": "1.0.0",
            "status": "draft",
            "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "string"}]
        });
        let diags = validate_schema(&def, DocumentType::Definition);
        assert!(
            diags
                .iter()
                .any(|d| d.code == "E101" && d.message.contains("title")),
            "Should report missing 'title', got: {:?}",
            diags
                .iter()
                .map(|d| (&d.code, &d.message))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn valid_theme_produces_no_e101() {
        let theme = json!({
            "$formspecTheme": "1.0",
            "version": "1.0.0",
            "targetDefinition": { "url": "https://example.com/forms/x" }
        });
        let diags = validate_schema(&theme, DocumentType::Theme);
        assert!(
            diags.is_empty(),
            "Valid theme should produce no E101, got: {:?}",
            diags
                .iter()
                .map(|d| (&d.code, &d.message))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn valid_component_produces_no_e101() {
        let comp = json!({
            "$formspecComponent": "1.0",
            "version": "1.0.0",
            "targetDefinition": { "url": "https://example.com/forms/x" },
            "tree": {
                "component": "Stack",
                "children": [
                    { "component": "TextInput", "bind": "name" }
                ]
            }
        });
        let diags = validate_schema(&comp, DocumentType::Component);
        assert!(
            diags.is_empty(),
            "Valid component should produce no E101, got: {:?}",
            diags
                .iter()
                .map(|d| (&d.code, &d.message))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn all_diagnostics_are_pass_1_e101() {
        let def = json!({
            "$formspec": "1.0",
            "items": []
        });
        let diags = validate_schema(&def, DocumentType::Definition);
        for d in &diags {
            assert_eq!(d.code, "E101");
            assert_eq!(d.pass, 1);
            assert_eq!(d.severity, LintSeverity::Error);
        }
    }
}
