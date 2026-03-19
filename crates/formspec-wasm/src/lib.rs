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
    let expr = parse(expression).map_err(|e| JsError::new(&e.to_string()))?;

    let fields: HashMap<String, FelValue> = if fields_json.is_empty() || fields_json == "{}" {
        HashMap::new()
    } else {
        let json_val: Value = serde_json::from_str(fields_json)
            .map_err(|e| JsError::new(&format!("invalid fields JSON: {e}")))?;
        json_to_field_map(&json_val)
    };

    let env = MapEnvironment::with_fields(fields);
    let result = evaluate(&expr, &env);

    let json = fel_to_json(&result.value);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
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
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| JsError::new(&format!("invalid definition JSON: {e}")))?;
    let data_val: Value = serde_json::from_str(data_json)
        .map_err(|e| JsError::new(&format!("invalid data JSON: {e}")))?;

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
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
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
    let rules_val: Value = serde_json::from_str(rules_json)
        .map_err(|e| JsError::new(&format!("invalid rules JSON: {e}")))?;
    let source: Value = serde_json::from_str(source_json)
        .map_err(|e| JsError::new(&format!("invalid source JSON: {e}")))?;
    let dir = match direction {
        "forward" => formspec_core::MappingDirection::Forward,
        "reverse" => formspec_core::MappingDirection::Reverse,
        _ => return Err(JsError::new(&format!("invalid direction: {direction}"))),
    };

    let rules = parse_mapping_rules(&rules_val)?;
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
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
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
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let registry = Registry::from_json(&val)
        .map_err(|e| JsError::new(&e.to_string()))?;

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
            serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
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
    let old_def: Value = serde_json::from_str(old_def_json)
        .map_err(|e| JsError::new(&format!("invalid old definition JSON: {e}")))?;
    let new_def: Value = serde_json::from_str(new_def_json)
        .map_err(|e| JsError::new(&format!("invalid new definition JSON: {e}")))?;

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
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
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

    let doc = parse_mapping_document(&doc_val)?;
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

fn parse_mapping_rules(val: &Value) -> Result<Vec<formspec_core::MappingRule>, JsError> {
    let arr = val.as_array().ok_or_else(|| JsError::new("rules must be an array"))?;
    let mut rules = Vec::new();
    for rule_val in arr {
        let obj = rule_val.as_object().ok_or_else(|| JsError::new("rule must be an object"))?;
        let transform = match obj.get("transform").and_then(|v| v.as_str()).unwrap_or("preserve") {
            "preserve" => formspec_core::TransformType::Preserve,
            "drop" => formspec_core::TransformType::Drop,
            "constant" => formspec_core::TransformType::Constant(
                obj.get("value").cloned().unwrap_or(Value::Null),
            ),
            "coerce" => {
                let target = obj.get("coerce").and_then(|v| v.as_str()).unwrap_or("string");
                formspec_core::TransformType::Coerce(match target {
                    "number" => formspec_core::CoerceType::Number,
                    "integer" => formspec_core::CoerceType::Integer,
                    "boolean" => formspec_core::CoerceType::Boolean,
                    "date" => formspec_core::CoerceType::Date,
                    "datetime" => formspec_core::CoerceType::DateTime,
                    _ => formspec_core::CoerceType::String,
                })
            }
            "expression" => formspec_core::TransformType::Expression(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            "valueMap" => {
                let entries = obj.get("valueMap").and_then(|v| v.as_object());
                let forward: Vec<(Value, Value)> = entries.map(|m| {
                    m.iter().map(|(k, v)| (Value::String(k.clone()), v.clone())).collect()
                }).unwrap_or_default();
                formspec_core::TransformType::ValueMap {
                    forward,
                    unmapped: match obj.get("unmapped").and_then(|v| v.as_str()) {
                        Some("error") => formspec_core::UnmappedStrategy::Error,
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
            other => return Err(JsError::new(&format!("unknown transform type: {other}"))),
        };

        rules.push(formspec_core::MappingRule {
            source_path: obj.get("sourcePath").and_then(|v| v.as_str()).map(String::from),
            target_path: obj.get("targetPath").and_then(|v| v.as_str()).unwrap_or("").to_string(),
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

fn parse_mapping_document(val: &Value) -> Result<MappingDocument, JsError> {
    let obj = val.as_object().ok_or_else(|| JsError::new("mapping document must be an object"))?;
    let rules_val = obj.get("rules").cloned().unwrap_or(Value::Array(vec![]));
    let rules = parse_mapping_rules(&rules_val)?;
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
