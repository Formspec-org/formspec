//! Definition assembly (`$ref` resolution) for `wasm_bindgen`.

use formspec_core::{JsonWireStyle, MapResolver, assemble_definition, assembly_result_to_json_value};
use serde_json::Value;
use wasm_bindgen::prelude::*;

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
    resolver.merge_from_json_object(&fragments);

    let result = assemble_definition(&definition, &resolver);
    let json = assembly_result_to_json_value(&result, JsonWireStyle::JsCamel);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
