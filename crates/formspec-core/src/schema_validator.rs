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
const MARKER_FIELDS: &[(&str, DocumentType)] = &[
    ("$formspec", DocumentType::Definition),
    ("$formspecTheme", DocumentType::Theme),
    ("$formspecMapping", DocumentType::Mapping),
    ("$formspecComponent", DocumentType::Component),
    ("$formspecResponse", DocumentType::Response),
    ("$formspecValidationReport", DocumentType::ValidationReport),
    ("$formspecRegistry", DocumentType::Registry),
    ("$formspecChangelog", DocumentType::Changelog),
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

    // Fallback: heuristic detection by key patterns
    if obj.contains_key("items") && obj.contains_key("title") {
        return Some(DocumentType::Definition);
    }
    if obj.contains_key("tokens") || obj.contains_key("selectors") {
        return Some(DocumentType::Theme);
    }
    if obj.contains_key("rules") && obj.contains_key("adapter") {
        return Some(DocumentType::Mapping);
    }
    if obj.contains_key("tree") && obj.contains_key("componentType") {
        return Some(DocumentType::Component);
    }
    if obj.contains_key("entries") && obj.contains_key("extensions") {
        return Some(DocumentType::Registry);
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
        let doc = json!({ "$formspecMapping": "1.0", "rules": [], "adapter": "json" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Mapping));
    }

    #[test]
    fn test_detect_component() {
        let doc = json!({ "$formspecComponent": "1.0", "tree": {}, "componentType": "Stack" });
        assert_eq!(detect_document_type(&doc), Some(DocumentType::Component));
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
}
