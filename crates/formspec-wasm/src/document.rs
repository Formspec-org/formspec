//! Document type detection, schema validation planning, and linting.

use formspec_core::{detect_document_type, json_pointer_to_jsonpath, schema_validation_plan};
use formspec_lint::{lint, lint_with_options, LintOptions};
use serde_json::Value;
use wasm_bindgen::prelude::*;

use crate::convert::lint_result_to_json;

// ── Schema Validation ───────────────────────────────────────────

/// Detect the document type of a Formspec JSON document.
/// Returns the document type string or null.
#[wasm_bindgen(js_name = "detectDocumentType")]
pub fn detect_doc_type(doc_json: &str) -> Result<JsValue, JsError> {
    let doc: Value =
        serde_json::from_str(doc_json).map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    match detect_document_type(&doc) {
        Some(dt) => Ok(JsValue::from_str(dt.schema_key())),
        None => Ok(JsValue::NULL),
    }
}

/// Convert a JSON Pointer string into a JSONPath string.
#[wasm_bindgen(js_name = "jsonPointerToJsonPath")]
pub fn json_pointer_to_jsonpath_wasm(pointer: &str) -> String {
    json_pointer_to_jsonpath(pointer)
}

/// Plan schema validation execution for a document.
///
/// Returns JSON:
/// - `{ documentType: null, mode: "unknown", error }` for unknown documents
/// - `{ documentType, mode: "document" }` for non-component docs
/// - `{ documentType: "component", mode: "component", componentTargets: [...] }`
#[wasm_bindgen(js_name = "planSchemaValidation")]
pub fn plan_schema_validation_wasm(
    doc_json: &str,
    document_type_override: Option<String>,
) -> Result<String, JsError> {
    let doc: Value =
        serde_json::from_str(doc_json).map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let override_type = document_type_override
        .as_deref()
        .and_then(formspec_core::DocumentType::from_schema_key);
    let plan = schema_validation_plan(&doc, override_type);
    let json = serde_json::json!({
        "documentType": plan.document_type,
        "mode": plan.mode,
        "componentTargets": plan.component_targets.iter().map(|target| serde_json::json!({
            "pointer": target.pointer,
            "component": target.component,
            "node": target.node,
        })).collect::<Vec<_>>(),
        "error": plan.error,
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Linting ─────────────────────────────────────────────────────

/// Lint a Formspec document (7-pass static analysis).
/// Returns JSON: { documentType, valid, diagnostics: [...] }
#[wasm_bindgen(js_name = "lintDocument")]
pub fn lint_document(doc_json: &str) -> Result<String, JsError> {
    let doc: Value =
        serde_json::from_str(doc_json).map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let result = lint(&doc);
    let json = lint_result_to_json(&result);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Lint with registry documents for extension resolution.
/// registries_json is a JSON array of registry documents.
#[wasm_bindgen(js_name = "lintDocumentWithRegistries")]
pub fn lint_document_with_registries(
    doc_json: &str,
    registries_json: &str,
) -> Result<String, JsError> {
    let doc: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid doc JSON: {e}")))?;
    let registries: Vec<Value> = serde_json::from_str(registries_json)
        .map_err(|e| JsError::new(&format!("invalid registries JSON: {e}")))?;

    let result = lint_with_options(
        &doc,
        &LintOptions {
            registry_documents: registries,
            ..Default::default()
        },
    );
    let json = lint_result_to_json(&result);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
