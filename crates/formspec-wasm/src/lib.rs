//! WASM bindings for Formspec — exposes FEL, linting, evaluation, assembly, mapping to TS.

/// WASM bindings for Formspec — thin layer exposing all Rust crates to TypeScript.
///
/// All functions accept/return JSON strings for complex types.
/// The binding layer handles type conversion only — no business logic here.
use wasm_bindgen::prelude::*;

use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde_json::Value;
use std::collections::HashMap;

use fel_core::{
    evaluate, extract_dependencies, parse, print_expr, Dependencies, FelValue, MapEnvironment,
    FormspecEnvironment, MipState,
};
use formspec_core::{
    analyze_fel, assemble_definition, detect_document_type, execute_mapping, execute_mapping_doc,
    get_fel_dependencies, normalize_indexed_path, MapResolver, MappingDocument,
};
use formspec_core::changelog;
use formspec_core::registry_client::{self, Registry};
use formspec_eval::evaluate_definition;
use formspec_lint::{lint, lint_with_options, LintOptions};

// ── FEL Evaluation ──────────────────────────────────────────────

/// Parse and evaluate a FEL expression with optional field values (JSON object).
/// Returns the result as a JSON string.
#[wasm_bindgen(js_name = "evalFEL")]
pub fn eval_fel(expression: &str, fields_json: &str) -> Result<String, JsError> {
    eval_fel_inner(expression, fields_json).map_err(|e| JsError::new(&e))
}

fn eval_fel_inner(expression: &str, fields_json: &str) -> Result<String, String> {
    let expr = parse(expression).map_err(|e| e.to_string())?;

    let fields: HashMap<String, FelValue> = if fields_json.is_empty() || fields_json == "{}" {
        HashMap::new()
    } else {
        let json_val: Value = serde_json::from_str(fields_json)
            .map_err(|e| format!("invalid fields JSON: {e}"))?;
        json_to_field_map(&json_val)
    };

    let env = MapEnvironment::with_fields(fields);
    let result = evaluate(&expr, &env);

    let json = fel_to_json(&result.value);
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Evaluate a FEL expression with full FormspecEnvironment context.
/// `context_json` is a JSON object: { fields, variables?, mipStates?, repeatContext? }
#[wasm_bindgen(js_name = "evalFELWithContext")]
pub fn eval_fel_with_context(expression: &str, context_json: &str) -> Result<String, JsError> {
    eval_fel_with_context_inner(expression, context_json).map_err(|e| JsError::new(&e))
}

fn eval_fel_with_context_inner(expression: &str, context_json: &str) -> Result<String, String> {
    let expr = parse(expression).map_err(|e| e.to_string())?;

    let ctx: Value = serde_json::from_str(context_json)
        .map_err(|e| format!("invalid context JSON: {e}"))?;
    let ctx_obj = ctx.as_object().ok_or("context must be a JSON object")?;

    let mut env = FormspecEnvironment::new();

    // Fields: { path: value }
    if let Some(fields) = ctx_obj.get("fields") {
        if let Some(obj) = fields.as_object() {
            for (k, v) in obj {
                env.set_field(k, json_to_fel(v));
            }
        }
    }

    // Variables: { name: value }
    if let Some(vars) = ctx_obj.get("variables") {
        if let Some(obj) = vars.as_object() {
            for (k, v) in obj {
                env.set_variable(k, json_to_fel(v));
            }
        }
    }

    // MIP states: { path: { valid, relevant, readonly, required } }
    if let Some(mips) = ctx_obj.get("mipStates") {
        if let Some(obj) = mips.as_object() {
            for (k, v) in obj {
                if let Some(mip_obj) = v.as_object() {
                    env.set_mip(k, MipState {
                        valid: mip_obj.get("valid").and_then(|v| v.as_bool()).unwrap_or(true),
                        relevant: mip_obj.get("relevant").and_then(|v| v.as_bool()).unwrap_or(true),
                        readonly: mip_obj.get("readonly").and_then(|v| v.as_bool()).unwrap_or(false),
                        required: mip_obj.get("required").and_then(|v| v.as_bool()).unwrap_or(false),
                    });
                }
            }
        }
    }

    // Repeat context: { current, index, count, collection? }
    if let Some(repeat) = ctx_obj.get("repeatContext") {
        if let Some(obj) = repeat.as_object() {
            let current = obj.get("current").map(json_to_fel).unwrap_or(FelValue::Null);
            let index = obj.get("index").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
            let count = obj.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            let collection = obj.get("collection")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().map(json_to_fel).collect())
                .unwrap_or_default();
            env.push_repeat(current, index, count, collection);
        }
    }

    // Instances: { name: value }
    if let Some(instances) = ctx_obj.get("instances") {
        if let Some(obj) = instances.as_object() {
            for (k, v) in obj {
                env.set_instance(k, json_to_fel(v));
            }
        }
    }

    let result = evaluate(&expr, &env);
    let json = fel_to_json(&result.value);
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Parse a FEL expression and return whether it's valid.
#[wasm_bindgen(js_name = "parseFEL")]
pub fn parse_fel(expression: &str) -> bool {
    parse(expression).is_ok()
}

/// Print a FEL expression AST back to normalized source string.
/// Useful for round-tripping after AST transformations.
#[wasm_bindgen(js_name = "printFEL")]
pub fn print_fel(expression: &str) -> Result<String, JsError> {
    let expr = parse(expression).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(print_expr(&expr))
}

/// Extract field dependencies from a FEL expression.
/// Returns a JSON array of field path strings.
#[wasm_bindgen(js_name = "getFELDependencies")]
pub fn get_fel_deps(expression: &str) -> Result<String, JsError> {
    let deps = get_fel_dependencies(expression);
    let arr: Vec<&str> = deps.iter().map(|s| s.as_str()).collect();
    serde_json::to_string(&arr).map_err(|e| JsError::new(&e.to_string()))
}

/// Extract full dependency info from a FEL expression.
/// Returns a JSON object with dependency details.
#[wasm_bindgen(js_name = "extractDependencies")]
pub fn extract_deps(expression: &str) -> Result<String, JsError> {
    let expr = parse(expression).map_err(|e| JsError::new(&e.to_string()))?;
    let deps = extract_dependencies(&expr);
    let json = deps_to_json(&deps);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── FEL Analysis ────────────────────────────────────────────────

/// Analyze a FEL expression and return structural info.
/// Returns JSON: { valid, errors, references, variables, functions }
#[wasm_bindgen(js_name = "analyzeFEL")]
pub fn analyze_fel_wasm(expression: &str) -> Result<String, JsError> {
    let result = analyze_fel(expression);
    let json = serde_json::json!({
        "valid": result.valid,
        "errors": result.errors.iter().map(|e| &e.message).collect::<Vec<_>>(),
        "references": result.references.iter().collect::<Vec<_>>(),
        "variables": result.variables.iter().collect::<Vec<_>>(),
        "functions": result.functions.iter().collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Path Utils ──────────────────────────────────────────────────

/// Normalize a dotted path by stripping repeat indices.
#[wasm_bindgen(js_name = "normalizeIndexedPath")]
pub fn normalize_path(path: &str) -> String {
    normalize_indexed_path(path)
}

// ── Schema Validation ───────────────────────────────────────────

/// Detect the document type of a Formspec JSON document.
/// Returns the document type string or null.
#[wasm_bindgen(js_name = "detectDocumentType")]
pub fn detect_doc_type(doc_json: &str) -> Result<JsValue, JsError> {
    let doc: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    match detect_document_type(&doc) {
        Some(dt) => Ok(JsValue::from_str(dt.schema_key())),
        None => Ok(JsValue::NULL),
    }
}

// ── Linting ─────────────────────────────────────────────────────

/// Lint a Formspec document (7-pass static analysis).
/// Returns JSON: { documentType, valid, diagnostics: [...] }
#[wasm_bindgen(js_name = "lintDocument")]
pub fn lint_document(doc_json: &str) -> Result<String, JsError> {
    let doc: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let result = lint(&doc);
    let json = lint_result_to_json(&result);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Lint with registry documents for extension resolution.
/// registries_json is a JSON array of registry documents.
#[wasm_bindgen(js_name = "lintDocumentWithRegistries")]
pub fn lint_document_with_registries(doc_json: &str, registries_json: &str) -> Result<String, JsError> {
    let doc: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid doc JSON: {e}")))?;
    let registries: Vec<Value> = serde_json::from_str(registries_json)
        .map_err(|e| JsError::new(&format!("invalid registries JSON: {e}")))?;

    let result = lint_with_options(&doc, &LintOptions {
        registry_documents: registries,
        ..Default::default()
    });
    let json = lint_result_to_json(&result);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Definition Evaluation ───────────────────────────────────────

/// Evaluate a Formspec definition against provided data (4-phase batch processor).
/// Returns JSON: { values, validations, nonRelevant, variables }
#[wasm_bindgen(js_name = "evaluateDefinition")]
pub fn evaluate_definition_wasm(definition_json: &str, data_json: &str) -> Result<String, JsError> {
    evaluate_definition_inner(definition_json, data_json).map_err(|e| JsError::new(&e))
}

fn evaluate_definition_inner(definition_json: &str, data_json: &str) -> Result<String, String> {
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| format!("invalid definition JSON: {e}"))?;
    let data_val: Value = serde_json::from_str(data_json)
        .map_err(|e| format!("invalid data JSON: {e}"))?;

    let data: HashMap<String, Value> = data_val
        .as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    let result = evaluate_definition(&definition, &data);

    let json = serde_json::json!({
        "values": result.values,
        "validations": result.validations.iter().map(|v| serde_json::json!({
            "path": v.path,
            "severity": v.severity,
            "kind": v.kind,
            "message": v.message,
        })).collect::<Vec<_>>(),
        "nonRelevant": result.non_relevant,
        "variables": result.variables,
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

// ── Assembly ────────────────────────────────────────────────────

/// Assemble a definition by resolving $ref inclusions.
/// fragments_json is a JSON object mapping URI → fragment definition.
/// Returns JSON: { definition, warnings, errors }
#[wasm_bindgen(js_name = "assembleDefinition")]
pub fn assemble_definition_wasm(definition_json: &str, fragments_json: &str) -> Result<String, JsError> {
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
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Runtime Mapping ─────────────────────────────────────────────

/// Execute a mapping transform (forward or reverse).
/// Returns JSON: { direction, output, rulesApplied, diagnostics }
#[wasm_bindgen(js_name = "executeMapping")]
pub fn execute_mapping_wasm(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, JsError> {
    execute_mapping_inner(rules_json, source_json, direction).map_err(|e| JsError::new(&e))
}

fn execute_mapping_inner(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, String> {
    let rules_val: Value = serde_json::from_str(rules_json)
        .map_err(|e| format!("invalid rules JSON: {e}"))?;
    let source: Value = serde_json::from_str(source_json)
        .map_err(|e| format!("invalid source JSON: {e}"))?;
    let dir = match direction {
        "forward" => formspec_core::MappingDirection::Forward,
        "reverse" => formspec_core::MappingDirection::Reverse,
        _ => return Err(format!("invalid direction: {direction}")),
    };

    let rules = parse_mapping_rules_inner(&rules_val)?;
    let result = execute_mapping(&rules, &source, dir);

    let json = serde_json::json!({
        "direction": direction,
        "output": result.output,
        "rulesApplied": result.rules_applied,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "ruleIndex": d.rule_index,
            "sourcePath": d.source_path,
            "targetPath": d.target_path,
            "message": d.message,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

// ── Registry Client ─────────────────────────────────────────────

/// Parse a registry JSON document, validate it, return summary JSON.
/// Returns: { publisher, published, entryCount, validationIssues }
#[wasm_bindgen(js_name = "parseRegistry")]
pub fn parse_registry(registry_json: &str) -> Result<String, JsError> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let registry = Registry::from_json(&val)
        .map_err(|e| JsError::new(&e.to_string()))?;
    let issues = registry.validate();
    let entry_count = val.get("entries").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
    let json = serde_json::json!({
        "publisher": {
            "name": registry.publisher.name,
            "url": registry.publisher.url,
            "contact": registry.publisher.contact,
        },
        "published": registry.published,
        "entryCount": entry_count,
        "validationIssues": issues,
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Find the highest-version registry entry matching name + version constraint.
/// Returns entry JSON or "null" if not found.
#[wasm_bindgen(js_name = "findRegistryEntry")]
pub fn find_registry_entry(registry_json: &str, name: &str, version_constraint: &str) -> Result<String, JsError> {
    find_registry_entry_inner(registry_json, name, version_constraint).map_err(|e| JsError::new(&e))
}

fn find_registry_entry_inner(registry_json: &str, name: &str, version_constraint: &str) -> Result<String, String> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| format!("invalid JSON: {e}"))?;
    let registry = Registry::from_json(&val)
        .map_err(|e| e.to_string())?;

    let constraint = if version_constraint.is_empty() { None } else { Some(version_constraint) };
    let entry = registry.find_one(name, constraint);

    match entry {
        Some(e) => {
            let json = serde_json::json!({
                "name": e.name,
                "category": category_to_str(e.category),
                "version": e.version,
                "status": status_to_str(e.status),
                "description": e.description,
                "deprecationNotice": e.deprecation_notice,
                "baseType": e.base_type,
                "parameters": e.parameters.as_ref().map(|params| {
                    params.iter().map(|p| serde_json::json!({
                        "name": p.name,
                        "type": p.param_type,
                        "description": p.description,
                    })).collect::<Vec<_>>()
                }),
                "returns": e.returns,
            });
            serde_json::to_string(&json).map_err(|e| e.to_string())
        }
        None => Ok("null".to_string()),
    }
}

/// Check whether a lifecycle transition is valid per the registry spec.
#[wasm_bindgen(js_name = "validateLifecycleTransition")]
pub fn validate_lifecycle_transition_wasm(from: &str, to: &str) -> bool {
    let from_status = match parse_status_str(from) {
        Some(s) => s,
        None => return false,
    };
    let to_status = match parse_status_str(to) {
        Some(s) => s,
        None => return false,
    };
    registry_client::validate_lifecycle_transition(from_status, to_status)
}

/// Construct the well-known registry URL for a base URL.
#[wasm_bindgen(js_name = "wellKnownRegistryUrl")]
pub fn well_known_registry_url(base_url: &str) -> String {
    registry_client::well_known_url(base_url)
}

// ── Changelog ───────────────────────────────────────────────────

/// Diff two Formspec definition versions and produce a structured changelog.
/// Returns JSON with camelCase keys.
#[wasm_bindgen(js_name = "generateChangelog")]
pub fn generate_changelog_wasm(old_def_json: &str, new_def_json: &str, definition_url: &str) -> Result<String, JsError> {
    generate_changelog_inner(old_def_json, new_def_json, definition_url).map_err(|e| JsError::new(&e))
}

fn generate_changelog_inner(old_def_json: &str, new_def_json: &str, definition_url: &str) -> Result<String, String> {
    let old_def: Value = serde_json::from_str(old_def_json)
        .map_err(|e| format!("invalid old definition JSON: {e}"))?;
    let new_def: Value = serde_json::from_str(new_def_json)
        .map_err(|e| format!("invalid new definition JSON: {e}"))?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);

    let json = serde_json::json!({
        "definitionUrl": result.definition_url,
        "fromVersion": result.from_version,
        "toVersion": result.to_version,
        "semverImpact": match result.semver_impact {
            changelog::SemverImpact::Patch => "patch",
            changelog::SemverImpact::Minor => "minor",
            changelog::SemverImpact::Major => "major",
        },
        "changes": result.changes.iter().map(|c| serde_json::json!({
            "type": match c.change_type {
                changelog::ChangeType::Added => "added",
                changelog::ChangeType::Removed => "removed",
                changelog::ChangeType::Modified => "modified",
            },
            "target": match c.target {
                changelog::ChangeTarget::Item => "item",
                changelog::ChangeTarget::Bind => "bind",
                changelog::ChangeTarget::Shape => "shape",
                changelog::ChangeTarget::OptionSet => "optionSet",
                changelog::ChangeTarget::DataSource => "dataSource",
                changelog::ChangeTarget::Screener => "screener",
                changelog::ChangeTarget::Migration => "migration",
                changelog::ChangeTarget::Metadata => "metadata",
            },
            "path": c.path,
            "impact": match c.impact {
                changelog::ChangeImpact::Cosmetic => "cosmetic",
                changelog::ChangeImpact::Compatible => "compatible",
                changelog::ChangeImpact::Breaking => "breaking",
            },
            "key": c.key,
            "description": c.description,
            "before": c.before,
            "after": c.after,
            "migrationHint": c.migration_hint,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

// ── Mapping Document ────────────────────────────────────────────

/// Execute a full mapping document (rules + defaults + autoMap).
/// Returns JSON: { direction, output, rulesApplied, diagnostics }
#[wasm_bindgen(js_name = "executeMappingDoc")]
pub fn execute_mapping_doc_wasm(doc_json: &str, source_json: &str, direction: &str) -> Result<String, JsError> {
    let doc_val: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid mapping document JSON: {e}")))?;
    let source: Value = serde_json::from_str(source_json)
        .map_err(|e| JsError::new(&format!("invalid source JSON: {e}")))?;
    let dir = match direction {
        "forward" => formspec_core::MappingDirection::Forward,
        "reverse" => formspec_core::MappingDirection::Reverse,
        _ => return Err(JsError::new(&format!("invalid direction: {direction}"))),
    };

    let doc = parse_mapping_document_inner(&doc_val).map_err(|e| JsError::new(&e))?;
    let result = execute_mapping_doc(&doc, &source, dir);

    let json = serde_json::json!({
        "direction": direction,
        "output": result.output,
        "rulesApplied": result.rules_applied,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "ruleIndex": d.rule_index,
            "sourcePath": d.source_path,
            "targetPath": d.target_path,
            "message": d.message,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Helpers ─────────────────────────────────────────────────────

fn json_to_field_map(val: &Value) -> HashMap<String, FelValue> {
    let mut map = HashMap::new();
    if let Some(obj) = val.as_object() {
        for (k, v) in obj {
            map.insert(k.clone(), json_to_fel(v));
        }
    }
    map
}

fn json_to_fel(val: &Value) -> FelValue {
    match val {
        Value::Null => FelValue::Null,
        Value::Bool(b) => FelValue::Boolean(*b),
        Value::Number(n) => {
            if let Some(d) = Decimal::from_f64(n.as_f64().unwrap_or(0.0)) {
                FelValue::Number(d)
            } else {
                FelValue::Null
            }
        }
        Value::String(s) => FelValue::String(s.clone()),
        Value::Array(arr) => FelValue::Array(arr.iter().map(json_to_fel).collect()),
        Value::Object(map) => FelValue::Object(
            map.iter().map(|(k, v)| (k.clone(), json_to_fel(v))).collect(),
        ),
    }
}

fn fel_to_json(val: &FelValue) -> Value {
    match val {
        FelValue::Null => Value::Null,
        FelValue::Boolean(b) => Value::Bool(*b),
        FelValue::Number(n) => {
            if n.fract().is_zero() {
                if let Some(i) = n.to_i64() {
                    return Value::Number(serde_json::Number::from(i));
                }
            }
            n.to_f64()
                .and_then(serde_json::Number::from_f64)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        FelValue::String(s) => Value::String(s.clone()),
        FelValue::Date(d) => Value::String(d.format_iso()),
        FelValue::Array(arr) => Value::Array(arr.iter().map(fel_to_json).collect()),
        FelValue::Object(entries) => {
            let map: serde_json::Map<String, Value> = entries.iter()
                .map(|(k, v)| (k.clone(), fel_to_json(v)))
                .collect();
            Value::Object(map)
        }
        FelValue::Money(m) => {
            let mut map = serde_json::Map::new();
            map.insert("amount".to_string(), fel_to_json(&FelValue::Number(m.amount)));
            map.insert("currency".to_string(), Value::String(m.currency.clone()));
            Value::Object(map)
        }
    }
}

fn deps_to_json(deps: &Dependencies) -> Value {
    serde_json::json!({
        "fields": deps.fields.iter().collect::<Vec<_>>(),
        "contextRefs": deps.context_refs.iter().collect::<Vec<_>>(),
        "instanceRefs": deps.instance_refs.iter().collect::<Vec<_>>(),
        "mipDeps": deps.mip_deps.iter().collect::<Vec<_>>(),
        "hasSelfRef": deps.has_self_ref,
        "hasWildcard": deps.has_wildcard,
        "usesPrevNext": deps.uses_prev_next,
    })
}

fn lint_result_to_json(result: &formspec_lint::LintResult) -> Value {
    serde_json::json!({
        "documentType": result.document_type.map(|dt| dt.schema_key().to_string()),
        "valid": result.valid,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "code": d.code,
            "pass": d.pass,
            "severity": match d.severity {
                formspec_lint::LintSeverity::Error => "error",
                formspec_lint::LintSeverity::Warning => "warning",
                formspec_lint::LintSeverity::Info => "info",
            },
            "path": d.path,
            "message": d.message,
        })).collect::<Vec<_>>(),
    })
}

/// Parse the `coerce` field from a mapping rule JSON object.
///
/// Accepts two forms per the mapping spec:
/// - String shorthand: `"coerce": "number"` — returns the matching CoerceType
/// - Object form: `"coerce": { "from": "date", "to": "string" }` — returns the `to` type.
///   Note: the `from` field is currently ignored (used for validation, not dispatch).
///
/// Returns `None` for unrecognized type strings or invalid shapes.
fn parse_coerce_type(val: &Value) -> Option<formspec_core::CoerceType> {
    match val {
        Value::String(s) => match s.as_str() {
            "string" => Some(formspec_core::CoerceType::String),
            "number" => Some(formspec_core::CoerceType::Number),
            "integer" => Some(formspec_core::CoerceType::Integer),
            "boolean" => Some(formspec_core::CoerceType::Boolean),
            "date" => Some(formspec_core::CoerceType::Date),
            "datetime" => Some(formspec_core::CoerceType::DateTime),
            _ => None,
        },
        Value::Object(obj) => {
            let to = obj.get("to").and_then(|v| v.as_str())?;
            match to {
                "string" => Some(formspec_core::CoerceType::String),
                "number" => Some(formspec_core::CoerceType::Number),
                "integer" => Some(formspec_core::CoerceType::Integer),
                "boolean" => Some(formspec_core::CoerceType::Boolean),
                "date" => Some(formspec_core::CoerceType::Date),
                "datetime" => Some(formspec_core::CoerceType::DateTime),
                _ => None,
            }
        }
        _ => None,
    }
}

fn parse_mapping_rules_inner(val: &Value) -> Result<Vec<formspec_core::MappingRule>, String> {
    let arr = val.as_array().ok_or_else(|| "rules must be an array".to_string())?;
    let mut rules = Vec::new();
    for rule_val in arr {
        let obj = rule_val.as_object().ok_or_else(|| "rule must be an object".to_string())?;
        let transform = match obj.get("transform").and_then(|v| v.as_str()).unwrap_or("preserve") {
            "preserve" => formspec_core::TransformType::Preserve,
            "drop" => formspec_core::TransformType::Drop,
            "constant" => formspec_core::TransformType::Constant(
                obj.get("value").cloned().unwrap_or(Value::Null),
            ),
            "coerce" => {
                let coerce_val = obj.get("coerce").cloned().unwrap_or(Value::String("string".into()));
                let coerce_type = parse_coerce_type(&coerce_val)
                    .unwrap_or(formspec_core::CoerceType::String);
                formspec_core::TransformType::Coerce(coerce_type)
            }
            "valueMap" => {
                let entries = obj.get("valueMap").and_then(|v| v.as_object());
                let forward: Vec<(Value, Value)> = entries.map(|m| {
                    m.iter().map(|(k, v)| (Value::String(k.clone()), v.clone())).collect()
                }).unwrap_or_default();
                formspec_core::TransformType::ValueMap {
                    forward,
                    unmapped: match obj.get("unmapped").and_then(|v| v.as_str()) {
                        Some("error") => formspec_core::UnmappedStrategy::Error,
                        Some("drop") => formspec_core::UnmappedStrategy::Drop,
                        Some("default") => formspec_core::UnmappedStrategy::Default,
                        _ => formspec_core::UnmappedStrategy::PassThrough,
                    },
                }
            }
            "flatten" => formspec_core::TransformType::Flatten {
                separator: obj.get("separator").and_then(|v| v.as_str()).unwrap_or(".").to_string(),
            },
            "nest" => formspec_core::TransformType::Nest {
                separator: obj.get("separator").and_then(|v| v.as_str()).unwrap_or(".").to_string(),
            },
            "concat" => formspec_core::TransformType::Concat(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            "split" => formspec_core::TransformType::Split(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            other => return Err(format!("unknown transform type: {other}")),
        };

        // At least one of sourcePath or targetPath MUST be present (mapping.schema.json FieldRule.anyOf)
        let source_path = obj.get("sourcePath").and_then(|v| v.as_str()).map(String::from);
        let target_path = obj.get("targetPath").and_then(|v| v.as_str()).map(String::from);
        if source_path.is_none() && target_path.is_none() {
            return Err(format!("rule[{rule_val}]: at least one of 'sourcePath' or 'targetPath' must be present"));
        }

        rules.push(formspec_core::MappingRule {
            source_path,
            target_path: target_path.unwrap_or_default(),
            transform,
            condition: obj.get("condition").and_then(|v| v.as_str()).map(String::from),
            priority: obj.get("priority").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            reverse_priority: obj.get("reversePriority").and_then(|v| v.as_i64()).map(|n| n as i32),
            default: obj.get("default").cloned(),
            bidirectional: obj.get("bidirectional").and_then(|v| v.as_bool()).unwrap_or(true),
        });
    }
    Ok(rules)
}

fn parse_mapping_document_inner(val: &Value) -> Result<MappingDocument, String> {
    let obj = val.as_object().ok_or_else(|| "mapping document must be an object".to_string())?;
    let rules_val = obj.get("rules").cloned().unwrap_or(Value::Array(vec![]));
    let rules = parse_mapping_rules_inner(&rules_val)?;
    let defaults = obj.get("defaults").and_then(|v| v.as_object()).cloned();
    let auto_map = obj.get("autoMap").and_then(|v| v.as_bool()).unwrap_or(false);
    Ok(MappingDocument {
        rules,
        defaults,
        auto_map,
    })
}

fn parse_status_str(s: &str) -> Option<formspec_core::RegistryEntryStatus> {
    match s {
        "draft" => Some(formspec_core::RegistryEntryStatus::Draft),
        "stable" | "active" => Some(formspec_core::RegistryEntryStatus::Active),
        "deprecated" => Some(formspec_core::RegistryEntryStatus::Deprecated),
        "retired" => Some(formspec_core::RegistryEntryStatus::Retired),
        _ => None,
    }
}

fn status_to_str(s: formspec_core::RegistryEntryStatus) -> &'static str {
    match s {
        formspec_core::RegistryEntryStatus::Draft => "draft",
        formspec_core::RegistryEntryStatus::Active => "stable",
        formspec_core::RegistryEntryStatus::Deprecated => "deprecated",
        formspec_core::RegistryEntryStatus::Retired => "retired",
    }
}

fn category_to_str(c: registry_client::ExtensionCategory) -> &'static str {
    match c {
        registry_client::ExtensionCategory::DataType => "dataType",
        registry_client::ExtensionCategory::Function => "function",
        registry_client::ExtensionCategory::Constraint => "constraint",
        registry_client::ExtensionCategory::Property => "property",
        registry_client::ExtensionCategory::Namespace => "namespace",
    }
}

// ── Tests ───────────────────────────────────────────────────────
//
// TODO(Finding 76): Add wasm-bindgen-test integration tests for FFI boundary
// verification (UTF-8 handling, JsValue::NULL propagation, JsError round-trip).
// These require a WASM runtime (browser or wasm-interpreter) and are out of scope
// for native `cargo test`.

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── Helpers ─────────────────────────────────────────────────

    fn minimal_definition() -> Value {
        json!({
            "title": "Test",
            "items": [
                { "key": "name", "label": "Name", "dataType": "string" }
            ]
        })
    }

    fn minimal_registry() -> String {
        json!({
            "publisher": { "name": "Test Org", "url": "https://example.com" },
            "published": "2026-01-01",
            "entries": [
                {
                    "name": "x-test-url",
                    "category": "dataType",
                    "version": "1.0.0",
                    "status": "active",
                    "description": "URL validation extension",
                    "baseType": "string"
                }
            ]
        }).to_string()
    }

    // ── Finding 67+68: eval_fel_inner ───────────────────────────

    /// Spec: specs/core/spec.md §3.2 — FEL evaluation returns JSON-serialized result.
    #[test]
    fn eval_fel_inner_arithmetic() {
        let result = eval_fel_inner("1 + 2", "{}").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!(3));
    }

    /// Spec: specs/core/spec.md §3.2 — FEL field references resolve against injected fields.
    #[test]
    fn eval_fel_inner_with_field_injection() {
        let fields = json!({"age": 25}).to_string();
        let result = eval_fel_inner("$age + 5", &fields).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!(30));
    }

    /// Spec: specs/core/spec.md §3.2 — String concatenation via & operator.
    #[test]
    fn eval_fel_inner_string_concat() {
        let fields = json!({"first": "Jane", "last": "Doe"}).to_string();
        let result = eval_fel_inner("$first & ' ' & $last", &fields).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!("Jane Doe"));
    }

    /// Spec: specs/core/spec.md §3.2 — Invalid FEL expression returns parse error.
    #[test]
    fn eval_fel_inner_parse_error() {
        let result = eval_fel_inner("1 +", "{}");
        assert!(result.is_err());
    }

    /// Spec: specs/core/spec.md §3.2 — Invalid fields JSON returns error.
    #[test]
    fn eval_fel_inner_invalid_fields_json() {
        let result = eval_fel_inner("1 + 2", "not json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid fields JSON"));
    }

    /// Spec: specs/core/spec.md §3.2 — Empty fields string treated as empty map.
    #[test]
    fn eval_fel_inner_empty_fields() {
        let result = eval_fel_inner("42", "").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!(42));
    }

    // ── Finding 68: evaluate_definition_inner output shape ──────

    /// Spec: specs/core/spec.md §5.4 — ValidationReport output shape contract.
    /// The result must contain keys: values, validations, nonRelevant, variables.
    #[test]
    fn evaluate_definition_inner_output_shape() {
        let def = minimal_definition().to_string();
        let data = json!({"name": "Alice"}).to_string();
        let result = evaluate_definition_inner(&def, &data).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();

        // Top-level keys
        assert!(val.get("values").is_some(), "missing 'values' key");
        assert!(val.get("validations").is_some(), "missing 'validations' key");
        assert!(val.get("nonRelevant").is_some(), "missing 'nonRelevant' key");
        assert!(val.get("variables").is_some(), "missing 'variables' key");

        // values is an object
        assert!(val["values"].is_object());
        // validations is an array
        assert!(val["validations"].is_array());
        // nonRelevant is an array
        assert!(val["nonRelevant"].is_array());
        // variables is an object
        assert!(val["variables"].is_object());
    }

    /// Spec: specs/core/spec.md §5.4 — Each validation has path, severity, kind, message.
    #[test]
    fn evaluate_definition_inner_validation_shape() {
        // Definition with a required field, no data → validation error
        let def = json!({
            "title": "Test",
            "items": [
                { "key": "name", "label": "Name", "dataType": "string" }
            ],
            "bind": {
                "name": { "required": true }
            }
        }).to_string();
        let data = json!({}).to_string();
        let result = evaluate_definition_inner(&def, &data).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();

        let validations = val["validations"].as_array().unwrap();
        // With a required field and no data, expect at least one validation
        if !validations.is_empty() {
            let v = &validations[0];
            assert!(v.get("path").is_some(), "validation missing 'path'");
            assert!(v.get("severity").is_some(), "validation missing 'severity'");
            assert!(v.get("kind").is_some(), "validation missing 'kind'");
            assert!(v.get("message").is_some(), "validation missing 'message'");

            // Severity and kind are strings
            assert!(v["severity"].is_string());
            assert!(v["kind"].is_string());
            assert!(v["message"].is_string());
        }
    }

    /// Spec: specs/core/spec.md §5.4 — Invalid definition JSON returns error.
    #[test]
    fn evaluate_definition_inner_invalid_json() {
        let result = evaluate_definition_inner("not json", "{}");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid definition JSON"));
    }

    // ── Finding 69: generate_changelog_inner output shape ───────

    /// Spec: specs/registry/changelog-spec.md §2 — Changelog output shape.
    /// Must contain: definitionUrl, fromVersion, toVersion, semverImpact, changes[].
    #[test]
    fn generate_changelog_inner_output_shape() {
        let old_def = json!({
            "title": "Form v1",
            "version": "1.0.0",
            "items": [
                { "key": "name", "label": "Name", "dataType": "string" }
            ]
        }).to_string();
        let new_def = json!({
            "title": "Form v2",
            "version": "2.0.0",
            "items": [
                { "key": "name", "label": "Full Name", "dataType": "string" },
                { "key": "email", "label": "Email", "dataType": "string" }
            ]
        }).to_string();

        let result = generate_changelog_inner(&old_def, &new_def, "https://example.com/form").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();

        assert_eq!(val["definitionUrl"], "https://example.com/form");
        assert!(val.get("fromVersion").is_some(), "missing 'fromVersion'");
        assert!(val.get("toVersion").is_some(), "missing 'toVersion'");
        assert!(val.get("semverImpact").is_some(), "missing 'semverImpact'");

        let impact = val["semverImpact"].as_str().unwrap();
        assert!(
            ["patch", "minor", "major"].contains(&impact),
            "semverImpact must be patch/minor/major, got: {impact}"
        );

        assert!(val.get("changes").is_some(), "missing 'changes'");
        assert!(val["changes"].is_array());
    }

    /// Spec: specs/registry/changelog-spec.md §2 — Each change has type, target, path, impact.
    #[test]
    fn generate_changelog_inner_change_shape() {
        let old_def = json!({
            "title": "Form v1",
            "version": "1.0.0",
            "items": [
                { "key": "name", "label": "Name", "dataType": "string" }
            ]
        }).to_string();
        let new_def = json!({
            "title": "Form v2",
            "version": "2.0.0",
            "items": [
                { "key": "name", "label": "Name", "dataType": "string" },
                { "key": "email", "label": "Email", "dataType": "string" }
            ]
        }).to_string();

        let result = generate_changelog_inner(&old_def, &new_def, "https://example.com/form").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        let changes = val["changes"].as_array().unwrap();

        if !changes.is_empty() {
            let c = &changes[0];
            assert!(c.get("type").is_some(), "change missing 'type'");
            assert!(c.get("target").is_some(), "change missing 'target'");
            assert!(c.get("path").is_some(), "change missing 'path'");
            assert!(c.get("impact").is_some(), "change missing 'impact'");

            let change_type = c["type"].as_str().unwrap();
            assert!(
                ["added", "removed", "modified"].contains(&change_type),
                "type must be added/removed/modified, got: {change_type}"
            );

            let target = c["target"].as_str().unwrap();
            let valid_targets = ["item", "bind", "shape", "optionSet", "dataSource", "screener", "migration", "metadata"];
            assert!(
                valid_targets.contains(&target),
                "unexpected target: {target}"
            );

            let impact = c["impact"].as_str().unwrap();
            assert!(
                ["cosmetic", "compatible", "breaking"].contains(&impact),
                "impact must be cosmetic/compatible/breaking, got: {impact}"
            );
        }
    }

    /// Spec: specs/registry/changelog-spec.md §2 — Invalid old definition JSON returns error.
    #[test]
    fn generate_changelog_inner_invalid_json() {
        let result = generate_changelog_inner("not json", "{}", "url");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid old definition JSON"));
    }

    // ── Finding 70: find_registry_entry_inner output shape ──────

    /// Spec: specs/registry/extension-registry.md §3 — Entry output has name, category, version, status, description.
    #[test]
    fn find_registry_entry_inner_output_shape() {
        let registry = minimal_registry();
        let result = find_registry_entry_inner(&registry, "x-test-url", "").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();

        assert_eq!(val["name"], "x-test-url");
        assert_eq!(val["category"], "dataType");
        assert!(val["version"].is_string(), "version must be a string");
        assert!(val["status"].is_string(), "status must be a string");
        assert!(val["description"].is_string(), "description must be a string");
    }

    /// Spec: specs/registry/extension-registry.md §3 — Not found returns "null" string.
    #[test]
    fn find_registry_entry_inner_not_found() {
        let registry = minimal_registry();
        let result = find_registry_entry_inner(&registry, "x-nonexistent", "").unwrap();
        assert_eq!(result, "null");
    }

    /// Spec: specs/registry/extension-registry.md §3 — Invalid JSON returns error.
    #[test]
    fn find_registry_entry_inner_invalid_json() {
        let result = find_registry_entry_inner("not json", "x-test", "");
        assert!(result.is_err());
    }

    // ── Finding 67: execute_mapping_inner ────────────────────────

    /// Spec: specs/mapping/mapping-spec.md §3 — Mapping execution returns direction, output, rulesApplied, diagnostics.
    #[test]
    fn execute_mapping_inner_output_shape() {
        let rules = json!([
            {
                "sourcePath": "firstName",
                "targetPath": "first_name",
                "transform": "preserve"
            }
        ]).to_string();
        let source = json!({"firstName": "Jane"}).to_string();

        let result = execute_mapping_inner(&rules, &source, "forward").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();

        assert_eq!(val["direction"], "forward");
        assert!(val.get("output").is_some(), "missing 'output'");
        assert!(val.get("rulesApplied").is_some(), "missing 'rulesApplied'");
        assert!(val.get("diagnostics").is_some(), "missing 'diagnostics'");
        assert!(val["diagnostics"].is_array());
        assert_eq!(val["output"]["first_name"], "Jane");
    }

    /// Spec: specs/mapping/mapping-spec.md §3 — Invalid direction returns error.
    #[test]
    fn execute_mapping_inner_invalid_direction() {
        let result = execute_mapping_inner("[]", "{}", "sideways");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid direction"));
    }

    // ── Finding 71: parse_coerce_type ────────────────────────────

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — String shorthand: known types resolve.
    #[test]
    fn parse_coerce_type_string_known() {
        assert!(matches!(parse_coerce_type(&json!("string")), Some(formspec_core::CoerceType::String)));
        assert!(matches!(parse_coerce_type(&json!("number")), Some(formspec_core::CoerceType::Number)));
        assert!(matches!(parse_coerce_type(&json!("integer")), Some(formspec_core::CoerceType::Integer)));
        assert!(matches!(parse_coerce_type(&json!("boolean")), Some(formspec_core::CoerceType::Boolean)));
        assert!(matches!(parse_coerce_type(&json!("date")), Some(formspec_core::CoerceType::Date)));
        assert!(matches!(parse_coerce_type(&json!("datetime")), Some(formspec_core::CoerceType::DateTime)));
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — Unknown string shorthand returns None.
    #[test]
    fn parse_coerce_type_string_unknown() {
        assert!(parse_coerce_type(&json!("uuid")).is_none());
        assert!(parse_coerce_type(&json!("money")).is_none());
        assert!(parse_coerce_type(&json!("")).is_none());
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2, schemas/mapping.schema.json $defs/Coerce
    /// Object form with valid `to` field resolves.
    #[test]
    fn parse_coerce_type_object_valid() {
        let val = json!({"from": "date", "to": "string"});
        assert!(matches!(parse_coerce_type(&val), Some(formspec_core::CoerceType::String)));

        let val = json!({"from": "string", "to": "number"});
        assert!(matches!(parse_coerce_type(&val), Some(formspec_core::CoerceType::Number)));
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — Object form missing `to` returns None.
    #[test]
    fn parse_coerce_type_object_missing_to() {
        let val = json!({"from": "date"});
        assert!(parse_coerce_type(&val).is_none());
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — Object form with unknown `to` returns None.
    #[test]
    fn parse_coerce_type_object_unknown_to() {
        let val = json!({"from": "string", "to": "uuid"});
        assert!(parse_coerce_type(&val).is_none());
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — Non-string non-object input returns None.
    #[test]
    fn parse_coerce_type_non_string_non_object() {
        assert!(parse_coerce_type(&json!(42)).is_none());
        assert!(parse_coerce_type(&json!(true)).is_none());
        assert!(parse_coerce_type(&json!(null)).is_none());
        assert!(parse_coerce_type(&json!([1, 2])).is_none());
    }

    /// Spec: specs/mapping/mapping-spec.md §3.3.2 — Object form: `from` is ignored for dispatch.
    /// The `from` field is used for validation (which pairs are valid), not for coerce dispatch.
    /// Two objects with same `to` but different `from` produce the same CoerceType.
    #[test]
    fn parse_coerce_type_object_from_ignored() {
        let a = json!({"from": "date", "to": "string"});
        let b = json!({"from": "number", "to": "string"});
        // Both resolve to String regardless of `from`
        assert!(matches!(parse_coerce_type(&a), Some(formspec_core::CoerceType::String)));
        assert!(matches!(parse_coerce_type(&b), Some(formspec_core::CoerceType::String)));
    }

    // ── Finding 73: parse_mapping_document_inner error path ─────

    /// Spec: specs/mapping/mapping-spec.md §2 — Non-object mapping document returns error.
    #[test]
    fn parse_mapping_document_inner_rejects_non_object() {
        let result = parse_mapping_document_inner(&json!("not an object"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must be an object"));
    }

    /// Spec: specs/mapping/mapping-spec.md §2 — Array input returns error.
    #[test]
    fn parse_mapping_document_inner_rejects_array() {
        let result = parse_mapping_document_inner(&json!([1, 2, 3]));
        assert!(result.is_err());
    }

    /// Spec: specs/mapping/mapping-spec.md §2 — Valid document parses successfully.
    #[test]
    fn parse_mapping_document_inner_valid() {
        let doc = json!({
            "rules": [
                { "sourcePath": "a", "targetPath": "b" }
            ],
            "autoMap": true
        });
        let result = parse_mapping_document_inner(&doc).unwrap();
        assert_eq!(result.rules.len(), 1);
        assert!(result.auto_map);
    }

    // ── Finding 73: parse_mapping_rules_inner error path ────────

    /// Spec: specs/mapping/mapping-spec.md §3 — Non-array rules input returns error.
    #[test]
    fn parse_mapping_rules_inner_rejects_non_array() {
        let result = parse_mapping_rules_inner(&json!("not an array"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("rules must be an array"));
    }

    /// Spec: specs/mapping/mapping-spec.md §3 — Unknown transform type returns error.
    #[test]
    fn parse_mapping_rules_inner_unknown_transform() {
        let rules = json!([{"transform": "teleport", "targetPath": "x"}]);
        let result = parse_mapping_rules_inner(&rules);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown transform type: teleport"));
    }

    // ── Finding 74: fel_to_json Decimal::MAX ────────────────────

    /// Spec: FEL runtime values — Decimal::MAX exceeds i64 range but fits in f64.
    /// The value falls through the i64 path and is serialized as an f64 JSON number.
    /// The null branch of fel_to_json is unreachable for valid Decimal values because
    /// Decimal cannot represent NaN or Infinity.
    #[test]
    fn fel_to_json_decimal_max_produces_number() {
        let val = FelValue::Number(Decimal::MAX);
        let json = fel_to_json(&val);
        // Decimal::MAX has zero fract, so to_i64() is tried first — but fails (too large).
        // Then to_f64() succeeds (7.9e28), and from_f64() accepts it (finite).
        assert!(json.is_number(), "Decimal::MAX should produce a JSON number, not null");
        // Verify the approximate value is correct (precision loss is expected)
        let f = json.as_f64().unwrap();
        assert!(f > 7.9e28 && f < 8.0e28, "unexpected magnitude: {f}");
    }

    // ── Finding 75: json_to_fel/fel_to_json large integer ───────

    /// Spec: FEL runtime values — large integers beyond i64 range lose precision in f64 roundtrip.
    /// Decimal preserves exact values but JSON serialization via f64 truncates to 53-bit mantissa.
    /// For Decimal::MAX specifically, the f64 value is too large to convert back to Decimal
    /// (Decimal::from_f64 returns None), so the roundtrip is lossy and unrecoverable.
    #[test]
    fn json_fel_roundtrip_large_integer_precision_loss() {
        let d = Decimal::MAX;
        let json = fel_to_json(&FelValue::Number(d));
        let f64_val = json.as_f64().unwrap();

        // The f64 value is finite but outside the Decimal representable range
        assert!(f64_val.is_finite(), "Decimal::MAX as f64 should be finite");
        assert!(f64_val > 7.9e28, "magnitude should be ~7.9e28");

        // Roundtrip back to Decimal fails — the f64 is outside Decimal's 96-bit range
        let roundtripped = Decimal::from_f64(f64_val);
        assert!(
            roundtripped.is_none(),
            "Decimal::MAX f64 representation exceeds Decimal range on roundtrip"
        );
    }

    // ── Finding 77: eval_fel_inner field injection edge cases ────

    /// Spec: specs/core/spec.md §3.2 — Whitespace-only fields JSON is invalid JSON.
    #[test]
    fn eval_fel_inner_whitespace_only_fields() {
        // Whitespace-only string is not valid JSON, should error
        let result = eval_fel_inner("1 + 1", " ");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid fields JSON"));
    }

    /// Spec: specs/core/spec.md §3.2 — "null" as fields string is valid JSON null.
    /// A JSON null is not an object, so json_to_field_map returns an empty map.
    #[test]
    fn eval_fel_inner_null_fields_string() {
        let result = eval_fel_inner("42", "null").unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!(42));
    }

    /// Spec: specs/core/spec.md §3.8.3 — Non-ASCII field names and values.
    #[test]
    fn eval_fel_inner_non_ascii_field_values() {
        let fields = json!({"greeting": "Bonjour"}).to_string();
        let result = eval_fel_inner("$greeting", &fields).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!("Bonjour"));
    }

    /// Spec: specs/core/spec.md §3.8.3 — Unicode field values (CJK, emoji).
    #[test]
    fn eval_fel_inner_unicode_field_values() {
        let fields = json!({"name": "\u{4F60}\u{597D}\u{4E16}\u{754C}"}).to_string();
        let result = eval_fel_inner("$name", &fields).unwrap();
        let val: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val, json!("\u{4F60}\u{597D}\u{4E16}\u{754C}"));
    }

    // ── Conversion helpers: json_to_fel and fel_to_json ─────────

    /// Verify null roundtrip.
    #[test]
    fn json_to_fel_null() {
        let val = json_to_fel(&json!(null));
        assert!(matches!(val, FelValue::Null));
        assert_eq!(fel_to_json(&val), json!(null));
    }

    /// Verify boolean roundtrip.
    #[test]
    fn json_to_fel_boolean() {
        assert!(matches!(json_to_fel(&json!(true)), FelValue::Boolean(true)));
        assert!(matches!(json_to_fel(&json!(false)), FelValue::Boolean(false)));
    }

    /// Verify integer roundtrip.
    #[test]
    fn json_to_fel_integer_roundtrip() {
        let val = json_to_fel(&json!(42));
        let back = fel_to_json(&val);
        assert_eq!(back, json!(42));
    }

    /// Verify string roundtrip.
    #[test]
    fn json_to_fel_string() {
        let val = json_to_fel(&json!("hello"));
        assert!(matches!(val, FelValue::String(ref s) if s == "hello"));
        assert_eq!(fel_to_json(&val), json!("hello"));
    }

    /// Verify array roundtrip.
    #[test]
    fn json_to_fel_array() {
        let val = json_to_fel(&json!([1, "two", null]));
        let back = fel_to_json(&val);
        assert_eq!(back, json!([1, "two", null]));
    }

    /// Verify object roundtrip.
    #[test]
    fn json_to_fel_object() {
        let val = json_to_fel(&json!({"a": 1, "b": "two"}));
        let back = fel_to_json(&val);
        assert_eq!(back["a"], json!(1));
        assert_eq!(back["b"], json!("two"));
    }
}
