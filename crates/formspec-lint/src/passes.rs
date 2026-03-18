//! Individual lint pass implementations (passes 2-7).

/// Individual lint pass implementations.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use fel_core::parse;
use formspec_core::get_fel_dependencies;

use crate::types::*;

// ── Pass 2: Tree ────────────────────────────────────────────────

pub fn pass_2_tree(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    let items = doc.get("items").and_then(|v| v.as_array());
    if let Some(items) = items {
        let mut seen_keys = HashSet::new();
        check_duplicate_keys(items, &mut seen_keys, "$", diagnostics);
    }
}

fn check_duplicate_keys(
    items: &[Value],
    seen: &mut HashSet<String>,
    prefix: &str,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            let path = format!("{prefix}.items[key={key}]");
            if !seen.insert(key.to_string()) {
                diagnostics.push(LintDiagnostic {
                    code: "E201".to_string(),
                    pass: 2,
                    severity: LintSeverity::Error,
                    path,
                    message: format!("Duplicate item key: {key}"),
                });
            }
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                check_duplicate_keys(children, seen, &format!("{prefix}.{key}"), diagnostics);
            }
        }
    }
}

// ── Pass 3: References ──────────────────────────────────────────

/// Data types compatible with optionSets.
const OPTION_SET_COMPATIBLE_TYPES: &[&str] = &[
    "string", "integer", "decimal", "choice", "multiChoice",
];

pub fn pass_3_references(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    let items = doc.get("items").and_then(|v| v.as_array());
    let binds = doc.get("binds").and_then(|v| v.as_object());
    let shapes = doc.get("shapes").and_then(|v| v.as_array());

    // Collect all valid item keys
    let mut valid_keys = HashSet::new();
    if let Some(items) = items {
        collect_keys(items, &mut valid_keys);
    }

    // Collect repeatable groups
    let mut repeatable_groups = HashSet::new();
    if let Some(items) = items {
        collect_repeatable_groups(items, &mut repeatable_groups);
    }

    // Check bind paths reference valid items
    if let Some(binds) = binds {
        for (bind_key, _) in binds {
            validate_path_reference(
                bind_key,
                &format!("$.binds.{bind_key}"),
                "Bind",
                "E300",
                3,
                &valid_keys,
                &repeatable_groups,
                items,
                diagnostics,
            );
        }
    }

    // Check shape targets reference valid items (E301)
    if let Some(shapes) = shapes {
        for (i, shape) in shapes.iter().enumerate() {
            if let Some(target) = shape.get("target").and_then(|v| v.as_str()) {
                validate_path_reference(
                    target,
                    &format!("$.shapes[{i}].target"),
                    "Shape target",
                    "E301",
                    3,
                    &valid_keys,
                    &repeatable_groups,
                    items,
                    diagnostics,
                );
            }
        }
    }

    // Check optionSet references (E302 + W300)
    let option_sets = collect_option_sets(doc);
    if let Some(items) = items {
        check_option_set_references(items, &option_sets, "$", diagnostics);
    }
}

/// Validate a dotted path reference (bind key or shape target) against the item tree.
/// Handles plain keys, dotted paths, and wildcard paths (group[*].field).
fn validate_path_reference(
    path: &str,
    diagnostic_path: &str,
    label: &str,
    error_code: &str,
    pass: u8,
    valid_keys: &HashSet<String>,
    repeatable_groups: &HashSet<String>,
    items: Option<&Vec<Value>>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    if path.contains("[*]") {
        // Wildcard path: group[*].field
        validate_wildcard_path(path, diagnostic_path, label, error_code, pass, valid_keys, repeatable_groups, items, diagnostics);
    } else if path.contains('.') {
        // Dotted path: group.field
        let base_key = path.split('.').next().unwrap_or(path);
        if !valid_keys.contains(base_key) {
            diagnostics.push(LintDiagnostic {
                code: error_code.to_string(),
                pass,
                severity: LintSeverity::Error,
                path: diagnostic_path.to_string(),
                message: format!("{label} references unknown item: {path}"),
            });
        }
    } else {
        // Simple key
        if !valid_keys.contains(path) {
            diagnostics.push(LintDiagnostic {
                code: error_code.to_string(),
                pass,
                severity: LintSeverity::Error,
                path: diagnostic_path.to_string(),
                message: format!("{label} references unknown item: {path}"),
            });
        }
    }
}

/// Validate a wildcard path like `group[*].field`.
/// Checks: (1) group exists and is repeatable, (2) field is a child of that group.
fn validate_wildcard_path(
    path: &str,
    diagnostic_path: &str,
    label: &str,
    error_code: &str,
    pass: u8,
    valid_keys: &HashSet<String>,
    repeatable_groups: &HashSet<String>,
    items: Option<&Vec<Value>>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    // Parse: "group[*].field" → group_key="group", remainder="field"
    let parts: Vec<&str> = path.splitn(2, "[*]").collect();
    if parts.len() != 2 {
        return;
    }

    let group_key = parts[0];
    let remainder = parts[1].trim_start_matches('.');

    // Check group exists
    if !valid_keys.contains(group_key) {
        diagnostics.push(LintDiagnostic {
            code: error_code.to_string(),
            pass,
            severity: LintSeverity::Error,
            path: diagnostic_path.to_string(),
            message: format!("{label} references unknown group: {group_key}"),
        });
        return;
    }

    // Check group is repeatable
    if !repeatable_groups.contains(group_key) {
        diagnostics.push(LintDiagnostic {
            code: error_code.to_string(),
            pass,
            severity: LintSeverity::Error,
            path: diagnostic_path.to_string(),
            message: format!("{label} uses wildcard on non-repeatable group: {group_key}"),
        });
        return;
    }

    // Check remainder resolves within the group's children
    if !remainder.is_empty() {
        if let Some(items) = items {
            let group_children = collect_group_children(items, group_key);
            let remainder_base = remainder.split('.').next().unwrap_or(remainder);
            if !group_children.contains(remainder_base) {
                diagnostics.push(LintDiagnostic {
                    code: error_code.to_string(),
                    pass,
                    severity: LintSeverity::Error,
                    path: diagnostic_path.to_string(),
                    message: format!(
                        "{label} wildcard remainder '{remainder}' not found in group '{group_key}'"
                    ),
                });
            }
        }
    }
}

/// Check optionSet references on items (E302) and dataType compatibility (W300).
fn check_option_set_references(
    items: &[Value],
    option_sets: &HashSet<String>,
    prefix: &str,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            let path = format!("{prefix}.items[key={key}]");

            // E302: optionSet reference not found
            if let Some(option_set_ref) = item.get("optionSet").and_then(|v| v.as_str()) {
                if !option_sets.contains(option_set_ref) {
                    diagnostics.push(LintDiagnostic {
                        code: "E302".to_string(),
                        pass: 3,
                        severity: LintSeverity::Error,
                        path: format!("{path}.optionSet"),
                        message: format!(
                            "optionSet references undefined set: {option_set_ref}"
                        ),
                    });
                }

                // W300: dataType compatibility check
                if let Some(data_type) = item.get("dataType").and_then(|v| v.as_str()) {
                    if !OPTION_SET_COMPATIBLE_TYPES.contains(&data_type) {
                        diagnostics.push(LintDiagnostic {
                            code: "W300".to_string(),
                            pass: 3,
                            severity: LintSeverity::Warning,
                            path: format!("{path}.dataType"),
                            message: format!(
                                "dataType '{data_type}' is not compatible with optionSet (expected one of: {})",
                                OPTION_SET_COMPATIBLE_TYPES.join(", ")
                            ),
                        });
                    }
                }
            }

            // Recurse into children
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                check_option_set_references(children, option_sets, &format!("{prefix}.{key}"), diagnostics);
            }
        }
    }
}

// ── Pass 3b: Extension resolution (E600) ────────────────────────

pub fn pass_3b_extensions(doc: &Value, registry_documents: &[Value], diagnostics: &mut Vec<LintDiagnostic>) {
    if registry_documents.is_empty() {
        return;
    }

    // Build set of known extension names from all registry documents
    let mut known_extensions = HashSet::new();
    for reg_doc in registry_documents {
        if let Some(entries) = reg_doc.get("entries").and_then(|v| v.as_array()) {
            for entry in entries {
                if let Some(name) = entry.get("name").and_then(|v| v.as_str()) {
                    known_extensions.insert(name.to_string());
                }
            }
        }
    }

    // Walk items looking for extension declarations
    if let Some(items) = doc.get("items").and_then(|v| v.as_array()) {
        check_item_extensions(items, &known_extensions, "$", diagnostics);
    }
}

fn check_item_extensions(
    items: &[Value],
    known_extensions: &HashSet<String>,
    prefix: &str,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            let path = format!("{prefix}.items[key={key}]");

            if let Some(extensions) = item.get("extensions").and_then(|v| v.as_object()) {
                for (ext_name, ext_value) in extensions {
                    // Only check enabled extensions (value is true)
                    let is_enabled = ext_value.as_bool().unwrap_or(false)
                        || ext_value.is_object(); // extension config objects count as enabled
                    if is_enabled && !known_extensions.contains(ext_name.as_str()) {
                        diagnostics.push(LintDiagnostic {
                            code: "E600".to_string(),
                            pass: 3,
                            severity: LintSeverity::Error,
                            path: format!("{path}.extensions.{ext_name}"),
                            message: format!("Unresolved extension: {ext_name}"),
                        });
                    }
                }
            }

            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                check_item_extensions(children, known_extensions, &format!("{prefix}.{key}"), diagnostics);
            }
        }
    }
}

// ── Pass 4: Expressions ─────────────────────────────────────────

pub fn pass_4_expressions(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    let binds = doc.get("binds").and_then(|v| v.as_object());

    if let Some(binds) = binds {
        for (bind_key, bind_val) in binds {
            if let Some(obj) = bind_val.as_object() {
                for &slot in &["calculate", "relevant", "required", "readonly", "constraint"] {
                    if let Some(expr) = obj.get(slot).and_then(|v| v.as_str()) {
                        if let Err(e) = parse(expr) {
                            diagnostics.push(LintDiagnostic {
                                code: "E400".to_string(),
                                pass: 4,
                                severity: LintSeverity::Error,
                                path: format!("$.binds.{bind_key}.{slot}"),
                                message: format!("FEL parse error: {e}"),
                            });
                        }
                    }
                }
            }
        }
    }

    // Check shape expressions
    if let Some(shapes) = doc.get("shapes").and_then(|v| v.as_array()) {
        for (i, shape) in shapes.iter().enumerate() {
            for &slot in &["constraint", "activeWhen"] {
                if let Some(expr) = shape.get(slot).and_then(|v| v.as_str()) {
                    if let Err(e) = parse(expr) {
                        diagnostics.push(LintDiagnostic {
                            code: "E400".to_string(),
                            pass: 4,
                            severity: LintSeverity::Error,
                            path: format!("$.shapes[{i}].{slot}"),
                            message: format!("FEL parse error: {e}"),
                        });
                    }
                }
            }
        }
    }

    // Check screener route expressions
    if let Some(screener) = doc.get("screener").and_then(|v| v.as_object()) {
        if let Some(routes) = screener.get("routes").and_then(|v| v.as_array()) {
            for (i, route) in routes.iter().enumerate() {
                if let Some(condition) = route.get("condition").and_then(|v| v.as_str()) {
                    if let Err(e) = parse(condition) {
                        diagnostics.push(LintDiagnostic {
                            code: "E400".to_string(),
                            pass: 4,
                            severity: LintSeverity::Error,
                            path: format!("$.screener.routes[{i}].condition"),
                            message: format!("FEL parse error in screener route: {e}"),
                        });
                    }
                }
            }
        }
    }
}

// ── Pass 5: Dependencies ────────────────────────────────────────

pub fn pass_5_dependencies(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    let binds = doc.get("binds").and_then(|v| v.as_object());
    if binds.is_none() {
        return;
    }
    let binds = binds.unwrap();

    // Build dependency graph: key -> set of keys it depends on
    let mut graph: HashMap<String, HashSet<String>> = HashMap::new();

    for (bind_key, bind_val) in binds {
        let mut deps = HashSet::new();
        if let Some(obj) = bind_val.as_object() {
            for &slot in &["calculate", "relevant", "required", "readonly", "constraint"] {
                if let Some(expr) = obj.get(slot).and_then(|v| v.as_str()) {
                    for dep in get_fel_dependencies(expr) {
                        let base_key = dep.split('.').next().unwrap_or(&dep);
                        deps.insert(base_key.to_string());
                    }
                }
            }
        }
        graph.insert(bind_key.clone(), deps);
    }

    // DFS cycle detection
    let mut visited = HashSet::new();
    let mut in_stack = HashSet::new();

    for key in graph.keys() {
        if !visited.contains(key) {
            detect_cycle(key, &graph, &mut visited, &mut in_stack, diagnostics);
        }
    }
}

fn detect_cycle(
    node: &str,
    graph: &HashMap<String, HashSet<String>>,
    visited: &mut HashSet<String>,
    in_stack: &mut HashSet<String>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    visited.insert(node.to_string());
    in_stack.insert(node.to_string());

    if let Some(deps) = graph.get(node) {
        for dep in deps {
            if !visited.contains(dep.as_str()) {
                if graph.contains_key(dep.as_str()) {
                    detect_cycle(dep, graph, visited, in_stack, diagnostics);
                }
            } else if in_stack.contains(dep.as_str()) {
                diagnostics.push(LintDiagnostic {
                    code: "E500".to_string(),
                    pass: 5,
                    severity: LintSeverity::Error,
                    path: format!("$.binds.{node}"),
                    message: format!("Dependency cycle detected: {node} → {dep}"),
                });
            }
        }
    }

    in_stack.remove(node);
}

// ── Pass 6: Theme ───────────────────────────────────────────────

pub fn pass_6_theme(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    if let Some(selectors) = doc.get("selectors").and_then(|v| v.as_array()) {
        let tokens = doc.get("tokens").and_then(|v| v.as_object());
        for (i, selector) in selectors.iter().enumerate() {
            if let Some(props) = selector.get("properties").and_then(|v| v.as_object()) {
                for (prop, value) in props {
                    if let Some(token_ref) = value.as_str() {
                        if token_ref.starts_with("$token.") {
                            let token_name = &token_ref[7..];
                            let has_token = tokens.is_some_and(|t| t.contains_key(token_name));
                            if !has_token {
                                diagnostics.push(LintDiagnostic {
                                    code: "W700".to_string(),
                                    pass: 6,
                                    severity: LintSeverity::Warning,
                                    path: format!("$.selectors[{i}].properties.{prop}"),
                                    message: format!("Token reference not found: {token_ref}"),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Pass 7: Components ──────────────────────────────────────────

pub fn pass_7_components(doc: &Value, diagnostics: &mut Vec<LintDiagnostic>) {
    if let Some(tree) = doc.get("tree").and_then(|v| v.as_object()) {
        if !tree.contains_key("componentType") {
            diagnostics.push(LintDiagnostic {
                code: "E800".to_string(),
                pass: 7,
                severity: LintSeverity::Error,
                path: "$.tree".to_string(),
                message: "Component tree root missing componentType".to_string(),
            });
        }
        if let Some(children) = tree.get("children").and_then(|v| v.as_array()) {
            let mut seen_binds = HashSet::new();
            check_bind_uniqueness(children, &mut seen_binds, "$.tree", diagnostics);
        }
    }
}

fn check_bind_uniqueness(
    nodes: &[Value],
    seen: &mut HashSet<String>,
    prefix: &str,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for (i, node) in nodes.iter().enumerate() {
        let path = format!("{prefix}.children[{i}]");
        if let Some(bind) = node.get("bind").and_then(|v| v.as_str()) {
            if !seen.insert(bind.to_string()) {
                diagnostics.push(LintDiagnostic {
                    code: "W804".to_string(),
                    pass: 7,
                    severity: LintSeverity::Warning,
                    path,
                    message: format!("Duplicate bind in component tree: {bind}"),
                });
            }
        }
        if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
            check_bind_uniqueness(children, seen, &format!("{prefix}.children[{i}]"), diagnostics);
        }
    }
}
