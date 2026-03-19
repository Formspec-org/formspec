//! Schema validation with document type detection and validation dispatch.

/// Schema validation for Formspec artifacts — document type detection and validation dispatch.
///
/// Uses dependency inversion: the actual JSON Schema validation is provided by the host
/// via `JsonSchemaValidator` trait. This crate provides document type detection, path
/// translation, and the component tree walking strategy.
use serde_json::Value;

// ── Document types ──────────────────────────────────────────────

/// All recognized Formspec document types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DocumentType {
    Definition,
    Theme,
    Mapping,
    Component,
    Response,
    ValidationReport,
    Registry,
    Changelog,
}

impl DocumentType {
    /// Schema key for this document type (used as discriminator).
    pub fn schema_key(&self) -> &'static str {
        match self {
            DocumentType::Definition => "definition",
            DocumentType::Theme => "theme",
            DocumentType::Mapping => "mapping",
            DocumentType::Component => "component",
            DocumentType::Response => "response",
            DocumentType::ValidationReport => "validationReport",
            DocumentType::Registry => "registry",
            DocumentType::Changelog => "changelog",
        }
    }
}

// ── Validation types ────────────────────────────────────────────

/// A schema validation error with path and message.
#[derive(Debug, Clone)]
pub struct SchemaValidationError {
    /// JSONPath to the invalid element (e.g., "$.items[0].key").
    pub path: String,
    /// Human-readable error message.
    pub message: String,
}

/// Result of schema validation.
#[derive(Debug, Clone)]
pub struct SchemaValidationResult {
    /// Detected document type (None if detection failed).
    pub document_type: Option<DocumentType>,
    /// Validation errors.
    pub errors: Vec<SchemaValidationError>,
}

// ── Document type detection ─────────────────────────────────────

/// Marker fields that identify document types.
/// Only includes markers that actually exist in the schemas.
const MARKER_FIELDS: &[(&str, DocumentType)] = &[
    ("$formspec", DocumentType::Definition),
    ("$formspecTheme", DocumentType::Theme),
    ("$formspecComponent", DocumentType::Component),
    ("$formspecRegistry", DocumentType::Registry),
];

/// Detect the document type from a JSON value by examining marker fields.
pub fn detect_document_type(doc: &Value) -> Option<DocumentType> {
    let obj = doc.as_object()?;

    // Check explicit marker fields first
    for &(field, doc_type) in MARKER_FIELDS {
        if obj.contains_key(field) {
            return Some(doc_type);
        }
    }

    // Fallback: heuristic detection by required-field combinations unique to each schema.
    if obj.contains_key("items") && obj.contains_key("title") {
        return Some(DocumentType::Definition);
    }
    if obj.contains_key("tokens") || obj.contains_key("selectors") {
        return Some(DocumentType::Theme);
    }
    if obj.contains_key("tree") && obj.contains_key("componentType") {
        return Some(DocumentType::Component);
    }
    if obj.contains_key("entries") && obj.contains_key("extensions") {
        return Some(DocumentType::Registry);
    }
    // Response: required fields include data + status + authored
    if obj.contains_key("data") && obj.contains_key("status") && obj.contains_key("authored") {
        return Some(DocumentType::Response);
    }
    // ValidationReport: required fields include valid + results + counts
    if obj.contains_key("valid") && obj.contains_key("results") && obj.contains_key("counts") {
        return Some(DocumentType::ValidationReport);
    }
    // Mapping: required fields include rules + targetSchema
    if obj.contains_key("rules") && obj.contains_key("targetSchema") {
        return Some(DocumentType::Mapping);
    }
    // Changelog: required fields include semverImpact + changes
    if obj.contains_key("semverImpact") && obj.contains_key("changes") {
        return Some(DocumentType::Changelog);
    }

    None
}

// ── JSON Schema validator trait (dependency inversion) ───────────

/// Trait for JSON Schema validation — implemented by the host/binding layer.
///
/// This allows the WASM layer to use AJV and the PyO3 layer to use jsonschema-rs
/// without coupling `formspec-core` to either.
pub trait JsonSchemaValidator {
    /// Validate a document against the schema for the given document type.
    /// Returns a list of validation errors (empty = valid).
    fn validate(&self, doc: &Value, doc_type: DocumentType) -> Vec<SchemaValidationError>;
}

// ── High-level validation ───────────────────────────────────────

/// Validate a Formspec document, auto-detecting its type and running schema validation.
pub fn validate_document(
    doc: &Value,
    validator: &dyn JsonSchemaValidator,
) -> SchemaValidationResult {
    let doc_type = detect_document_type(doc);

    match doc_type {
        None => SchemaValidationResult {
            document_type: None,
            errors: vec![SchemaValidationError {
                path: "$".to_string(),
                message: "Cannot determine document type: no recognized marker field found".to_string(),
            }],
        },
        Some(dt) => {
            let errors = validator.validate(doc, dt);
            SchemaValidationResult {
                document_type: Some(dt),
                errors,
            }
        }
    }
}

// ── Path translation utilities ──────────────────────────────────

/// Convert a JSON Pointer (e.g., "/items/0/key") to a JSONPath (e.g., "$.items[0].key").
pub fn json_pointer_to_jsonpath(pointer: &str) -> String {
    if pointer.is_empty() {
        return "$".to_string();
    }

    let mut result = String::from("$");
    for part in pointer.split('/').skip(1) {
        if let Ok(idx) = part.parse::<usize>() {
            result.push_str(&format!("[{idx}]"));
        } else {
            result.push('.');
            result.push_str(part);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_detect_definition() {
        let doc = json!({ "$formspec": "1.0", "items": [], "title": "Test" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Definition));
    }

    #[test]
    fn test_detect_theme() {
        let doc = json!({ "$formspecTheme": "1.0", "tokens": {} });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Theme));
    }

    #[test]
    fn test_detect_mapping() {
        let doc = json!({ "rules": [], "targetSchema": "urn:example", "definitionRef": "https://example.org/forms/x", "definitionVersion": "1.0.0", "version": "1.0.0" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Mapping));
    }

    #[test]
    fn test_detect_component() {
        let doc = json!({ "$formspecComponent": "1.0", "tree": {}, "componentType": "Stack" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Component));
    }

    #[test]
    fn test_detect_response() {
        let doc = json!({
            "definitionUrl": "https://example.org/forms/x",
            "definitionVersion": "1.0.0",
            "status": "in-progress",
            "data": {},
            "authored": "2025-01-01T00:00:00Z"
        });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Response));
    }

    #[test]
    fn test_detect_validation_report() {
        let doc = json!({
            "valid": true,
            "results": [],
            "counts": { "error": 0, "warning": 0, "info": 0 },
            "timestamp": "2025-01-01T00:00:00Z"
        });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::ValidationReport));
    }

    #[test]
    fn test_detect_changelog() {
        let doc = json!({
            "definitionUrl": "https://example.org/forms/x",
            "fromVersion": "1.0.0",
            "toVersion": "2.0.0",
            "semverImpact": "breaking",
            "changes": []
        });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Changelog));
    }

    #[test]
    fn test_detect_unknown() {
        let doc = json!({ "random": "data" });
        assert_eq!(detect_document_type(&doc), None);
    }

    #[test]
    fn test_detect_heuristic_definition() {
        // No marker field but has items + title
        let doc = json!({ "items": [], "title": "Heuristic" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Definition));
    }

    #[test]
    fn test_json_pointer_to_jsonpath() {
        assert_eq!(json_pointer_to_jsonpath(""), "$");
        assert_eq!(json_pointer_to_jsonpath("/items/0/key"), "$.items[0].key");
        assert_eq!(json_pointer_to_jsonpath("/items/0/children/1"), "$.items[0].children[1]");
        assert_eq!(json_pointer_to_jsonpath("/title"), "$.title");
    }

    #[test]
    fn test_validate_unknown_document() {
        struct NoopValidator;
        impl JsonSchemaValidator for NoopValidator {
            fn validate(&self, _doc: &Value, _dt: DocumentType) -> Vec<SchemaValidationError> {
                vec![]
            }
        }

        let doc = json!({ "random": "data" });
        let result = validate_document(&doc, &NoopValidator);
        assert!(result.document_type.is_none());
        assert_eq!(result.errors.len(), 1);
        assert!(result.errors[0].message.contains("Cannot determine document type"));
    }

    #[test]
    fn test_validate_valid_document() {
        struct AlwaysValid;
        impl JsonSchemaValidator for AlwaysValid {
            fn validate(&self, _doc: &Value, _dt: DocumentType) -> Vec<SchemaValidationError> {
                vec![]
            }
        }

        let doc = json!({ "$formspec": "1.0", "items": [], "title": "Test" });
        let result = validate_document(&doc, &AlwaysValid);
        assert_eq!(result.document_type, Some(DocumentType::Definition));
        assert!(result.errors.is_empty());
    }

    // ── Marker overrides heuristic — schema_validator ────────────

    /// Spec: schema spec — "Marker field ($formspec) overrides heuristic detection"
    #[test]
    fn marker_overrides_heuristic_ambiguity() {
        // Doc has both the definition marker AND theme heuristic fields
        let doc = json!({
            "$formspec": "1.0",
            "items": [],
            "title": "Test",
            "tokens": {},
            "selectors": []
        });
        // Marker should win
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Definition));
    }

    /// Spec: schema spec — "Marker field ($formspecTheme) overrides heuristic for theme"
    #[test]
    fn theme_marker_overrides_other_heuristics() {
        let doc = json!({
            "$formspecTheme": "1.0",
            "tokens": {},
            // Also has items + title (definition heuristic), but marker wins
            "items": [],
            "title": "Test"
        });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Theme));
    }

    // ── Registry heuristic detection ─────────────────────────────

    /// Spec: schema spec — "Registry detected by heuristic: entries + extensions"
    #[test]
    fn detect_registry_by_heuristic() {
        let doc = json!({
            "entries": [],
            "extensions": {}
        });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Registry));
    }

    // ── Non-object input ─────────────────────────────────────────

    /// Spec: schema spec — "Non-object input returns None from detect_document_type"
    #[test]
    fn detect_non_object_returns_none() {
        assert_eq!(detect_document_type(&json!("string")), None);
        assert_eq!(detect_document_type(&json!(42)), None);
        assert_eq!(detect_document_type(&json!(null)), None);
        assert_eq!(detect_document_type(&json!(true)), None);
        assert_eq!(detect_document_type(&json!([1, 2, 3])), None);
    }

    // ── Heuristic theme via tokens only ──────────────────────────

    /// Spec: schema spec — "Theme heuristic via 'tokens' field alone"
    #[test]
    fn detect_theme_by_tokens_heuristic() {
        let doc = json!({ "tokens": { "color-primary": "#000" } });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Theme));
    }

    /// Spec: schema spec — "Theme heuristic via 'selectors' field alone"
    #[test]
    fn detect_theme_by_selectors_heuristic() {
        let doc = json!({ "selectors": [{ "match": "field" }] });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Theme));
    }

    // ── Component heuristic ──────────────────────────────────────

    /// Spec: schema spec — "Component heuristic requires both 'tree' and 'componentType'"
    #[test]
    fn detect_component_heuristic_needs_both() {
        // Only tree — not enough
        assert_eq!(detect_document_type(&json!({ "tree": {} })), None);
        // Only componentType — not enough
        assert_eq!(detect_document_type(&json!({ "componentType": "Stack" })), None);
        // Both — detected
        assert_eq!(
            detect_document_type(&json!({ "tree": {}, "componentType": "Stack" })),
            Some(DocumentType::Component)
        );
    }

    // ── DocumentType::schema_key coverage ────────────────────────

    /// Spec: schema spec — "All document types have correct schema_key values"
    #[test]
    fn schema_key_values() {
        assert_eq!(DocumentType::Definition.schema_key(), "definition");
        assert_eq!(DocumentType::Theme.schema_key(), "theme");
        assert_eq!(DocumentType::Mapping.schema_key(), "mapping");
        assert_eq!(DocumentType::Component.schema_key(), "component");
        assert_eq!(DocumentType::Response.schema_key(), "response");
        assert_eq!(DocumentType::ValidationReport.schema_key(), "validationReport");
        assert_eq!(DocumentType::Registry.schema_key(), "registry");
        assert_eq!(DocumentType::Changelog.schema_key(), "changelog");
    /// Spec: schemas/definition.schema.json — validate_document with a mock
    /// validator that returns actual SchemaValidationError instances, verifying
    /// that detected type is passed through and errors are propagated.
    #[test]
    fn test_validate_document_with_errors() {
        struct ErrorValidator;
        impl JsonSchemaValidator for ErrorValidator {
            fn validate(&self, _doc: &Value, dt: DocumentType) -> Vec<SchemaValidationError> {
                vec![
                    SchemaValidationError {
                        path: "$.items[0].key".to_string(),
                        message: format!("required property missing in {}", dt.schema_key()),
                    },
                    SchemaValidationError {
                        path: "$.title".to_string(),
                        message: "must be a string".to_string(),
                    },
                ]
            }
        }

        let doc = json!({ "$formspec": "1.0", "items": [{}], "title": 42 });
        let result = validate_document(&doc, &ErrorValidator);
        assert_eq!(result.document_type, Some(DocumentType::Definition));
        assert_eq!(result.errors.len(), 2);
        assert_eq!(result.errors[0].path, "$.items[0].key");
        assert!(result.errors[0].message.contains("definition"));
        assert_eq!(result.errors[1].path, "$.title");
        assert_eq!(result.errors[1].message, "must be a string");
    }

    /// Spec: core/spec.md §5.3 (RFC 6901) — JSON Pointer segment `01` is an opaque
    /// string per RFC 6901, not array index 1. `json_pointer_to_jsonpath` currently
    /// treats any numeric segment as an array index. This test documents that
    /// leading-zero segments like `/items/01/key` are treated as array indices.
    #[test]
    fn json_pointer_leading_zero_treated_as_index() {
        // `01` parses as usize 1, so it becomes [1] in JSONPath.
        // This documents the current behavior — RFC 6901 says `01` is opaque,
        // but practical JSON Pointer usage in schemas treats it as an index.
        let result = json_pointer_to_jsonpath("/items/01/key");
        assert_eq!(result, "$.items[1].key");
    }
}
