//! Definition assembly (`$ref` resolution) for `wasm_bindgen`.

use formspec_core::{assemble_definition, MapResolver};
use serde_json::Value;
use wasm_bindgen::prelude::*;

// ── Assembly ────────────────────────────────────────────────────

/// Assemble a definition by resolving $ref inclusions.
/// fragments_json is a JSON object mapping URI → fragment definition.
/// Returns JSON: { definition, warnings, errors }
#[wasm_bindgen(js_name = "assembleDefinition")]
pub fn assemble_definition_wasm(
    definition_json: &str,
    fragments_json: &str,
) -> Result<String, JsError> {
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| JsError::new(&format!("invalid definition JSON: {e}")))?;
    let fragments: Value = serde_json::from_str(fragments_json)
        .map_err(|e| JsError::new(&format!("invalid fragments JSON: {e}")))?;

    let mut resolver = MapResolver::new();
    if let Some(obj) = fragments.as_object() {
        for (uri, fragment) in obj {
            resolver.add(uri, fragment.clone());
        }
    }

    let result = assemble_definition(&definition, &resolver);
    let json = serde_json::json!({
        "definition": result.definition,
        "warnings": result.warnings,
        "errors": result.errors.iter().map(|e| e.to_string()).collect::<Vec<_>>(),
        "assembledFrom": result.assembled_from.iter().map(|entry| {
            serde_json::json!({
                "url": entry.url,
                "version": entry.version,
                "keyPrefix": entry.key_prefix,
                "fragment": entry.fragment,
            })
        }).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
