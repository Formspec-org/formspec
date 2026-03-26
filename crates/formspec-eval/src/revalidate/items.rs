//! Bind-level validation: required, type, constraint, cardinality, extension constraints.
#![allow(clippy::missing_docs_in_private_items)]

use std::collections::HashMap;

use fancy_regex::Regex;
use formspec_core::registry_client::version_satisfies;
use serde_json::Value;

use fel_core::{FormspecEnvironment, evaluate, parse};

use crate::convert::resolve_value_by_path;
use crate::fel_json::json_to_runtime_fel;
use crate::rebuild::detect_repeat_count;
use crate::types::{
    ExtensionConstraint, ItemInfo, ValidationResult, resolve_qualified_repeat_refs,
};

use crate::value_predicate::{is_empty_for_required_bind, value_skips_optional_bind_checks};

use super::env::{bind_sibling_aliases, restore_sibling_aliases};
use super::expr::constraint_passes;

pub(super) fn validate_items(
    items: &[ItemInfo],
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    repeat_counts: Option<&HashMap<String, u64>>,
    results: &mut Vec<ValidationResult>,
) {
    for item in items {
        // Skip non-relevant items (validation suppressed per S5.6)
        if !item.relevant {
            continue;
        }

        // 9d: resolve value by walking nested objects for dotted paths
        let val = resolve_value_by_path(values, &item.path);

        // Required check
        if item.required && is_empty_for_required_bind(&val) {
            results.push(ValidationResult {
                path: item.path.clone(),
                severity: "error".to_string(),
                constraint_kind: "required".to_string(),
                code: "REQUIRED".to_string(),
                message: "Required".to_string(),
                constraint: None,
                source: "bind".to_string(),
                shape_id: None,
                context: None,
            });
        }

        // Type mismatch check (only for scalar values, not arrays/objects)
        if !val.is_null()
            && !val.is_array()
            && !val.is_object()
            && let Some(ref dt) = item.data_type
        {
            let mismatch = match dt.as_str() {
                "string" => !val.is_string(),
                "integer" => {
                    !(val.is_i64()
                        || val.is_u64()
                        || val.is_f64() && {
                            let f = val.as_f64().unwrap();
                            f.fract() == 0.0
                        })
                }
                "number" | "decimal" => !val.is_number(),
                "boolean" => !val.is_boolean(),
                _ => false,
            };
            if mismatch {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "type".to_string(),
                    code: "TYPE_MISMATCH".to_string(),
                    message: format!("Invalid {dt}"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        // Constraint check — skip for empty values (§3.8.1).
        // "A constraint that cannot be evaluated due to null inputs is not considered
        // violated."  The `required` bind, not `constraint`, enforces non-emptiness.
        if !value_skips_optional_bind_checks(&val)
            && let Some(ref expr) = item.constraint
        {
            let normalized_expr = resolve_qualified_repeat_refs(expr, &item.path);
            let saved_aliases = bind_sibling_aliases(env, values, &item.path);
            // Temporarily bind bare $ to this field's value
            let prev_dollar = env.data.remove("");
            env.data.insert(String::new(), json_to_runtime_fel(&val));

            if let Ok(parsed) = parse(&normalized_expr) {
                let result = evaluate(&parsed, env);
                if !constraint_passes(&result) {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "constraint".to_string(),
                        code: "CONSTRAINT_FAILED".to_string(),
                        message: item
                            .constraint_message
                            .clone()
                            .unwrap_or_else(|| format!("Constraint failed: {expr}")),
                        constraint: Some(expr.clone()),
                        source: "bind".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }

            // Restore previous bare $ binding
            env.data.remove("");
            if let Some(prev) = prev_dollar {
                env.data.insert(String::new(), prev);
            }
            restore_sibling_aliases(env, saved_aliases);
        }

        // Extension constraint enforcement
        validate_extension_constraints(item, &val, ext_by_name, formspec_version, results);

        // Cardinality check for repeatable groups
        if item.repeatable {
            let count = repeat_counts
                .and_then(|m| m.get(&item.path).copied())
                .map(|n| n as usize)
                .unwrap_or_else(|| detect_repeat_count(&item.path, values));
            if let Some(min) = item.repeat_min
                && (count as u64) < min
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MIN_REPEAT".to_string(),
                    message: format!("Minimum {min} entries required"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            if let Some(max) = item.repeat_max
                && (count as u64) > max
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MAX_REPEAT".to_string(),
                    message: format!("Maximum {max} entries allowed"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        validate_items(
            &item.children,
            env,
            values,
            ext_by_name,
            formspec_version,
            repeat_counts,
            results,
        );
    }
}

/// Check extension constraints (pattern, maxLength, min/max, status, compatibility) for a field.
fn validate_extension_constraints(
    item: &ItemInfo,
    val: &Value,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    results: &mut Vec<ValidationResult>,
) {
    for ext_name in &item.extensions {
        let Some(constraint) = ext_by_name.get(ext_name.as_str()) else {
            // Extension not found in any loaded registry
            results.push(ValidationResult {
                path: item.path.clone(),
                severity: "error".to_string(),
                constraint_kind: "extension".to_string(),
                code: "UNRESOLVED_EXTENSION".to_string(),
                message: format!(
                    "Unresolved extension '{ext_name}': no matching registry entry loaded"
                ),
                constraint: None,
                source: "extension".to_string(),
                shape_id: None,
                context: None,
            });
            continue;
        };

        // Status enforcement (§7.4)
        match constraint.status.as_str() {
            "retired" => {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_RETIRED".to_string(),
                    message: format!("Extension '{ext_name}' is retired"),
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            "deprecated" => {
                let message = match &constraint.deprecation_notice {
                    Some(notice) => notice.clone(),
                    None => format!("Extension '{ext_name}' is deprecated"),
                };
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "info".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_DEPRECATED".to_string(),
                    message,
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            _ => {} // stable, draft — no status warnings
        }

        // Compatibility check (§7.3)
        if let Some(ref compat_range) = constraint.compatibility_version {
            if !version_satisfies(formspec_version, compat_range) {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_COMPATIBILITY_MISMATCH".to_string(),
                    message: format!(
                        "Extension '{ext_name}' requires formspec version {compat_range}"
                    ),
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        // Skip value constraints if the value is null/empty (§3.8.1)
        if value_skips_optional_bind_checks(val) {
            continue;
        }

        let label = constraint
            .display_name
            .as_deref()
            .unwrap_or(ext_name.as_str());

        // Pattern constraint (string values only)
        if let Some(ref pattern) = constraint.pattern {
            if let Some(s) = val.as_str() {
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(s).unwrap_or(false) {
                        results.push(ValidationResult {
                            path: item.path.clone(),
                            severity: "error".to_string(),
                            constraint_kind: "extension".to_string(),
                            code: "PATTERN_MISMATCH".to_string(),
                            message: format!("Must be a valid {label}"),
                            constraint: None,
                            source: "extension".to_string(),
                            shape_id: None,
                            context: None,
                        });
                    }
                }
            }
        }

        // MaxLength constraint (string values only)
        if let Some(max_len) = constraint.max_length {
            if let Some(s) = val.as_str() {
                if s.len() as u64 > max_len {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "MAX_LENGTH_EXCEEDED".to_string(),
                        message: format!("{label} must be at most {max_len} characters"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }

        // Minimum constraint (numeric values)
        if let Some(min) = constraint.minimum {
            if let Some(n) = val.as_f64() {
                if n < min {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_UNDERFLOW".to_string(),
                        message: format!("{label} must be at least {min}"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }

        // Maximum constraint (numeric values)
        if let Some(max) = constraint.maximum {
            if let Some(n) = val.as_f64() {
                if n > max {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_OVERFLOW".to_string(),
                        message: format!("{label} must be at most {max}"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }
    }
}
