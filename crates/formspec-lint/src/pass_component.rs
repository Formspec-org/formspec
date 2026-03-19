//! Pass 7: Component document semantic checks (E800-E807, W800-W804).
//!
//! Validates root layout, component references, type compatibility, bind resolution,
//! custom component cycles, and duplicate binds.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use crate::component_matrix::{classify_compatibility, is_input_component, requires_options_source, Compatibility};
use crate::types::LintDiagnostic;

const PASS: u8 = 7;

// ── Component classification ────────────────────────────────────

/// Components that may appear as the root of a component tree.
const LAYOUT_ROOTS: &[&str] = &[
    "Page", "Stack", "Grid", "Wizard", "Columns", "Tabs",
    "Accordion", "Panel", "Card", "Collapsible", "ConditionalGroup", "Modal",
];

/// Layout-only components that should not declare a bind.
const LAYOUT_NO_BIND: &[&str] = &["Page", "Stack", "Grid", "Wizard", "Spacer"];

/// Container components that should not declare a bind (except DataTable).
const CONTAINER_NO_BIND: &[&str] = &[
    "Card", "Collapsible", "ConditionalGroup", "Columns", "Tabs",
    "Accordion", "Panel", "Modal", "Popover",
];

/// All built-in component names.
const ALL_BUILTINS: &[&str] = &[
    "Page", "Stack", "Grid", "Wizard", "Spacer",
    "TextInput", "NumberInput", "DatePicker", "Select", "CheckboxGroup",
    "Toggle", "FileUpload", "Heading", "Text", "Divider",
    "Card", "Collapsible", "ConditionalGroup", "Columns", "Tabs",
    "Accordion", "RadioGroup", "MoneyInput", "Slider", "Rating",
    "Signature", "Alert", "Badge", "ProgressBar", "Summary",
    "ValidationSummary", "DataTable", "Panel", "Modal", "Popover",
    "SubmitButton",
];

fn is_builtin(name: &str) -> bool {
    ALL_BUILTINS.contains(&name)
}

fn should_not_bind(name: &str) -> bool {
    LAYOUT_NO_BIND.contains(&name) || CONTAINER_NO_BIND.contains(&name)
}

// ── Field lookup from definition ────────────────────────────────

struct FieldInfo {
    data_type: Option<String>,
    has_options: bool,
}

/// Build a map of field key → FieldInfo from a definition's item tree.
fn build_field_lookup(definition: &Value) -> HashMap<String, FieldInfo> {
    let mut lookup = HashMap::new();
    if let Some(items) = definition.get("items").and_then(|v| v.as_array()) {
        collect_fields(items, &mut lookup);
    }
    lookup
}

fn collect_fields(items: &[Value], lookup: &mut HashMap<String, FieldInfo>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            let data_type = item.get("dataType").and_then(|v| v.as_str()).map(String::from);
            let has_options = item.get("optionSet").is_some()
                || item.get("options").and_then(|v| v.as_array()).is_some_and(|a| !a.is_empty());
            lookup.insert(key.to_string(), FieldInfo { data_type, has_options });
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                collect_fields(children, lookup);
            }
        }
    }
}

// ── Custom component cycle detection ────────────────────────────

/// Collect component references used inside a custom component's tree.
fn collect_component_refs(node: &Value, custom_names: &HashSet<&str>, refs: &mut HashSet<String>) {
    let comp_type = node.get("componentType").and_then(|v| v.as_str()).unwrap_or("");
    if custom_names.contains(comp_type) {
        refs.insert(comp_type.to_string());
    }
    if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
        for child in children {
            collect_component_refs(child, custom_names, refs);
        }
    }
}

/// DFS cycle detection on the custom component reference graph.
fn detect_custom_cycles(
    node: &str,
    graph: &HashMap<&str, HashSet<String>>,
    visited: &mut HashSet<String>,
    in_stack: &mut HashSet<String>,
    cycles: &mut Vec<(String, String)>,
) {
    visited.insert(node.to_string());
    in_stack.insert(node.to_string());

    if let Some(deps) = graph.get(node) {
        for dep in deps {
            if !visited.contains(dep.as_str()) {
                detect_custom_cycles(dep, graph, visited, in_stack, cycles);
            } else if in_stack.contains(dep.as_str()) {
                cycles.push((node.to_string(), dep.clone()));
            }
        }
    }

    in_stack.remove(node);
}

// ── Tree walker state ───────────────────────────────────────────

struct WalkState<'a> {
    custom_names: HashSet<&'a str>,
    custom_defs: Option<&'a serde_json::Map<String, Value>>,
    field_lookup: Option<HashMap<String, FieldInfo>>,
    all_binds: HashSet<String>,
    editable_binds: HashSet<String>,
    diags: Vec<LintDiagnostic>,
}

impl<'a> WalkState<'a> {
    fn walk_node(&mut self, node: &Value, path: &str) {
        let comp_type = match node.get("componentType").and_then(|v| v.as_str()) {
            Some(ct) => ct,
            None => return,
        };

        // E801: Unknown component
        if !is_builtin(comp_type) && !self.custom_names.contains(comp_type) {
            self.diags.push(LintDiagnostic::error(
                "E801", PASS, path,
                format!("Unknown component type: '{comp_type}'"),
            ));
        }

        // E805: Wizard children must all be Page
        if comp_type == "Wizard" {
            if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
                for (i, child) in children.iter().enumerate() {
                    let child_type = child.get("componentType").and_then(|v| v.as_str()).unwrap_or("");
                    if child_type != "Page" {
                        self.diags.push(LintDiagnostic::error(
                            "E805", PASS,
                            format!("{path}.children[{i}]"),
                            format!("Wizard children must be Page components, found '{child_type}'"),
                        ));
                    }
                }
            }
        }

        // E806: Custom component missing required params
        if self.custom_names.contains(comp_type) {
            if let Some(custom_defs) = self.custom_defs {
                if let Some(def) = custom_defs.get(comp_type) {
                    if let Some(params) = def.get("params").and_then(|v| v.as_array()) {
                        for param_val in params {
                            if let Some(param_name) = param_val.as_str() {
                                if node.get(param_name).is_none() {
                                    self.diags.push(LintDiagnostic::error(
                                        "E806", PASS, path,
                                        format!("Custom component '{comp_type}' missing required param '{param_name}'"),
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Bind checks
        if let Some(bind) = node.get("bind").and_then(|v| v.as_str()) {
            // W801: Layout/container shouldn't bind
            if should_not_bind(comp_type) {
                self.diags.push(LintDiagnostic::warning(
                    "W801", PASS, path,
                    format!("Layout/container component '{comp_type}' should not declare a bind"),
                ));
            }

            // W804: Duplicate bind in tree (any component)
            if !self.all_binds.insert(bind.to_string()) {
                self.diags.push(LintDiagnostic::warning(
                    "W804", PASS, path,
                    format!("Duplicate bind in component tree: {bind}"),
                ));
            }

            // Cross-artifact checks for input components
            if is_input_component(comp_type) {
                if let Some(ref field_lookup) = self.field_lookup {
                    match field_lookup.get(bind) {
                        None => {
                            // W800: Bind doesn't resolve
                            self.diags.push(LintDiagnostic::warning(
                                "W800", PASS, path,
                                format!("Component bind '{bind}' does not resolve to a field in the definition"),
                            ));
                        }
                        Some(field_info) => {
                            // E802/W802: Type compatibility
                            if let Some(ref dt) = field_info.data_type {
                                match classify_compatibility(comp_type, dt) {
                                    Compatibility::Incompatible => {
                                        self.diags.push(LintDiagnostic::error(
                                            "E802", PASS, path,
                                            format!("Component '{comp_type}' is incompatible with field dataType '{dt}'"),
                                        ));
                                    }
                                    Compatibility::CompatibleWithWarning => {
                                        self.diags.push(LintDiagnostic::warning(
                                            "W802", PASS, path,
                                            format!("Component '{comp_type}' is only loosely compatible with field dataType '{dt}'"),
                                        ));
                                    }
                                    _ => {}
                                }
                            }

                            // E803: Requires options but field has none
                            if requires_options_source(comp_type) && !field_info.has_options {
                                self.diags.push(LintDiagnostic::error(
                                    "E803", PASS, path,
                                    format!("Component '{comp_type}' requires an optionSet or options, but field '{bind}' has neither"),
                                ));
                            }

                            // E804: richtext TextInput must bind to string
                            if comp_type == "TextInput" {
                                let is_richtext = node.get("inputMode")
                                    .and_then(|v| v.as_str())
                                    .is_some_and(|m| m == "richtext");
                                if is_richtext {
                                    let is_string = field_info.data_type.as_deref()
                                        .is_some_and(|dt| dt == "string" || dt == "text");
                                    if !is_string {
                                        self.diags.push(LintDiagnostic::error(
                                            "E804", PASS, path,
                                            format!(
                                                "TextInput with inputMode 'richtext' must bind to a string field, found '{}'",
                                                field_info.data_type.as_deref().unwrap_or("unknown")
                                            ),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }

                // W803: Multiple editable inputs bind same field
                if !self.editable_binds.insert(bind.to_string()) {
                    self.diags.push(LintDiagnostic::warning(
                        "W803", PASS, path,
                        format!("Multiple editable inputs bind to the same field: '{bind}'"),
                    ));
                }
            }
        }

        // Recurse into children
        if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
            for (i, child) in children.iter().enumerate() {
                self.walk_node(child, &format!("{path}.children[{i}]"));
            }
        }
    }
}

// ── Main entry point ────────────────────────────────────────────

/// Validate a component document and return all diagnostics.
/// When `definition` is provided, cross-artifact checks (W800, E802-E803) are enabled.
pub fn lint_component(component: &Value, definition: Option<&Value>) -> Vec<LintDiagnostic> {
    let tree = match component.get("tree") {
        Some(t) => t,
        None => return Vec::new(),
    };

    let custom_defs = component.get("components").and_then(|v| v.as_object());
    let custom_names: HashSet<&str> = custom_defs
        .map(|m| m.keys().map(|k| k.as_str()).collect())
        .unwrap_or_default();

    let mut diags = Vec::new();

    // E800: Root must be a layout type
    let root_type = tree.get("componentType").and_then(|v| v.as_str()).unwrap_or("");
    if root_type.is_empty() || !LAYOUT_ROOTS.contains(&root_type) {
        diags.push(LintDiagnostic::error(
            "E800", PASS, "$.tree",
            format!(
                "Root component must be a layout type ({}), found '{root_type}'",
                LAYOUT_ROOTS.join(", ")
            ),
        ));
    }

    // E807: Custom component reference cycles
    if let Some(defs) = custom_defs {
        let mut graph: HashMap<&str, HashSet<String>> = HashMap::new();
        for (name, def) in defs {
            let mut refs = HashSet::new();
            if let Some(sub_tree) = def.get("tree") {
                collect_component_refs(sub_tree, &custom_names, &mut refs);
            }
            graph.insert(name.as_str(), refs);
        }

        let mut visited = HashSet::new();
        let mut in_stack = HashSet::new();
        let mut cycles = Vec::new();
        for &name in graph.keys() {
            if !visited.contains(name) {
                detect_custom_cycles(name, &graph, &mut visited, &mut in_stack, &mut cycles);
            }
        }
        for (from, to) in cycles {
            diags.push(LintDiagnostic::error(
                "E807", PASS,
                format!("$.components.{from}"),
                format!("Custom component reference cycle: '{from}' -> '{to}'"),
            ));
        }
    }

    // Walk the tree
    let field_lookup = definition.map(build_field_lookup);

    let mut state = WalkState {
        custom_names,
        custom_defs,
        field_lookup,
        all_binds: HashSet::new(),
        editable_binds: HashSet::new(),
        diags,
    };

    state.walk_node(tree, "$.tree");

    state.diags
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn with_code<'a>(diags: &'a [LintDiagnostic], code: &str) -> Vec<&'a LintDiagnostic> {
        diags.iter().filter(|d| d.code == code).collect()
    }

    // 1. Empty component — no diagnostics
    #[test]
    fn empty_component_no_diagnostics() {
        let comp = json!({});
        let diags = lint_component(&comp, None);
        assert!(diags.is_empty());
    }

    // 2. Layout root (Stack) — no E800
    #[test]
    fn layout_root_no_e800() {
        let comp = json!({
            "tree": { "componentType": "Stack", "children": [] }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "E800").is_empty());
    }

    #[test]
    fn all_layout_roots_accepted() {
        for root in LAYOUT_ROOTS {
            let comp = json!({
                "tree": { "componentType": root, "children": [] }
            });
            let diags = lint_component(&comp, None);
            assert!(
                with_code(&diags, "E800").is_empty(),
                "{root} should be accepted as a layout root"
            );
        }
    }

    // 3. Non-layout root (TextInput) — E800
    #[test]
    fn non_layout_root_emits_e800() {
        let comp = json!({
            "tree": { "componentType": "TextInput", "bind": "name" }
        });
        let diags = lint_component(&comp, None);
        let e800 = with_code(&diags, "E800");
        assert_eq!(e800.len(), 1);
        assert!(e800[0].message.contains("TextInput"));
    }

    #[test]
    fn missing_component_type_emits_e800() {
        let comp = json!({
            "tree": { "children": [] }
        });
        let diags = lint_component(&comp, None);
        assert_eq!(with_code(&diags, "E800").len(), 1);
    }

    // 4. Unknown component — E801
    #[test]
    fn unknown_component_emits_e801() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "FancyWidget", "bind": "x" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let e801 = with_code(&diags, "E801");
        assert_eq!(e801.len(), 1);
        assert!(e801[0].message.contains("FancyWidget"));
    }

    #[test]
    fn custom_component_not_flagged_as_unknown() {
        let comp = json!({
            "components": {
                "AddressBlock": {
                    "tree": { "componentType": "Stack", "children": [] },
                    "params": ["label"]
                }
            },
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "AddressBlock", "label": "Home" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "E801").is_empty());
    }

    // 5. Wizard non-Page children — E805
    #[test]
    fn wizard_non_page_children_emits_e805() {
        let comp = json!({
            "tree": {
                "componentType": "Wizard",
                "children": [
                    { "componentType": "Page", "title": "Step 1" },
                    { "componentType": "Stack", "children": [] },
                    { "componentType": "Page", "title": "Step 3" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let e805 = with_code(&diags, "E805");
        assert_eq!(e805.len(), 1);
        assert!(e805[0].message.contains("Stack"));
        assert!(e805[0].path.contains("children[1]"));
    }

    #[test]
    fn wizard_all_pages_no_e805() {
        let comp = json!({
            "tree": {
                "componentType": "Wizard",
                "children": [
                    { "componentType": "Page", "title": "Step 1" },
                    { "componentType": "Page", "title": "Step 2" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "E805").is_empty());
    }

    // 6. Custom component missing params — E806
    #[test]
    fn custom_component_missing_params_emits_e806() {
        let comp = json!({
            "components": {
                "LabeledField": {
                    "tree": { "componentType": "Stack", "children": [] },
                    "params": ["field", "label"]
                }
            },
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "LabeledField", "field": "name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let e806 = with_code(&diags, "E806");
        assert_eq!(e806.len(), 1);
        assert!(e806[0].message.contains("label"));
    }

    #[test]
    fn custom_component_all_params_no_e806() {
        let comp = json!({
            "components": {
                "LabeledField": {
                    "tree": { "componentType": "Stack", "children": [] },
                    "params": ["field", "label"]
                }
            },
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "LabeledField", "field": "name", "label": "Name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "E806").is_empty());
    }

    // 7. Custom component cycle — E807
    #[test]
    fn custom_component_self_reference_emits_e807() {
        let comp = json!({
            "components": {
                "Recursive": {
                    "tree": {
                        "componentType": "Stack",
                        "children": [
                            { "componentType": "Recursive" }
                        ]
                    }
                }
            },
            "tree": { "componentType": "Stack", "children": [] }
        });
        let diags = lint_component(&comp, None);
        let e807 = with_code(&diags, "E807");
        assert_eq!(e807.len(), 1);
        assert!(e807[0].message.contains("Recursive"));
    }

    #[test]
    fn custom_component_mutual_cycle_emits_e807() {
        let comp = json!({
            "components": {
                "Alpha": {
                    "tree": {
                        "componentType": "Stack",
                        "children": [{ "componentType": "Beta" }]
                    }
                },
                "Beta": {
                    "tree": {
                        "componentType": "Stack",
                        "children": [{ "componentType": "Alpha" }]
                    }
                }
            },
            "tree": { "componentType": "Stack", "children": [] }
        });
        let diags = lint_component(&comp, None);
        let e807 = with_code(&diags, "E807");
        assert!(!e807.is_empty(), "Mutual cycle should emit E807");
    }

    #[test]
    fn custom_component_no_cycle_no_e807() {
        let comp = json!({
            "components": {
                "Wrapper": {
                    "tree": {
                        "componentType": "Stack",
                        "children": [{ "componentType": "TextInput", "bind": "x" }]
                    }
                }
            },
            "tree": { "componentType": "Stack", "children": [] }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "E807").is_empty());
    }

    // 8. Duplicate bind in tree — W804
    #[test]
    fn duplicate_bind_emits_w804() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "name" },
                    { "componentType": "TextInput", "bind": "name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let w804 = with_code(&diags, "W804");
        assert_eq!(w804.len(), 1);
        assert!(w804[0].message.contains("name"));
    }

    #[test]
    fn unique_binds_no_w804() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "first_name" },
                    { "componentType": "TextInput", "bind": "last_name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "W804").is_empty());
    }

    // 9. Layout component with bind — W801
    #[test]
    fn layout_with_bind_emits_w801() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "bind": "oops",
                "children": []
            }
        });
        let diags = lint_component(&comp, None);
        let w801 = with_code(&diags, "W801");
        assert_eq!(w801.len(), 1);
        assert!(w801[0].message.contains("Stack"));
    }

    #[test]
    fn container_with_bind_emits_w801() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Card", "bind": "oops", "children": [] }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let w801 = with_code(&diags, "W801");
        assert_eq!(w801.len(), 1);
        assert!(w801[0].message.contains("Card"));
    }

    #[test]
    fn data_table_bind_no_w801() {
        // DataTable is a special container that CAN bind
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "DataTable", "bind": "items" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "W801").is_empty());
    }

    // 10. With definition: bind resolves, compatible — no warnings
    #[test]
    fn compatible_bind_no_warnings() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "name" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint_component(&comp, Some(&def));
        assert!(with_code(&diags, "W800").is_empty());
        assert!(with_code(&diags, "E802").is_empty());
        assert!(with_code(&diags, "W802").is_empty());
    }

    // 11. With definition: bind doesn't resolve — W800
    #[test]
    fn unresolved_bind_emits_w800() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "ghost" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint_component(&comp, Some(&def));
        let w800 = with_code(&diags, "W800");
        assert_eq!(w800.len(), 1);
        assert!(w800[0].message.contains("ghost"));
    }

    // 12. With definition: incompatible type — E802
    #[test]
    fn incompatible_type_emits_e802() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Toggle", "bind": "name" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint_component(&comp, Some(&def));
        let e802 = with_code(&diags, "E802");
        assert_eq!(e802.len(), 1);
        assert!(e802[0].message.contains("Toggle"));
        assert!(e802[0].message.contains("string"));
    }

    #[test]
    fn compatible_with_warning_emits_w802() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "age" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "age", "dataType": "integer" }]
        });
        let diags = lint_component(&comp, Some(&def));
        let w802 = with_code(&diags, "W802");
        assert_eq!(w802.len(), 1);
        assert!(w802[0].message.contains("TextInput"));
        assert!(w802[0].message.contains("integer"));
    }

    // 13. Without definition: skip resolution checks
    #[test]
    fn no_definition_skips_resolution_checks() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Toggle", "bind": "ghost" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "W800").is_empty());
        assert!(with_code(&diags, "E802").is_empty());
        assert!(with_code(&diags, "E803").is_empty());
    }

    // E803: Requires options but field has none
    #[test]
    fn select_without_options_emits_e803() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Select", "bind": "color" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "color", "dataType": "choice" }]
        });
        let diags = lint_component(&comp, Some(&def));
        let e803 = with_code(&diags, "E803");
        assert_eq!(e803.len(), 1);
        assert!(e803[0].message.contains("Select"));
    }

    #[test]
    fn select_with_option_set_no_e803() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Select", "bind": "color" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "color", "dataType": "choice", "optionSet": "colors" }],
            "optionSets": { "colors": { "options": [{ "value": "red" }] } }
        });
        let diags = lint_component(&comp, Some(&def));
        assert!(with_code(&diags, "E803").is_empty());
    }

    #[test]
    fn select_with_inline_options_no_e803() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Select", "bind": "color" }
                ]
            }
        });
        let def = json!({
            "items": [{
                "key": "color", "dataType": "choice",
                "options": [{ "value": "red", "label": "Red" }]
            }]
        });
        let diags = lint_component(&comp, Some(&def));
        assert!(with_code(&diags, "E803").is_empty());
    }

    // E804: richtext TextInput must bind string
    #[test]
    fn richtext_non_string_emits_e804() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "count", "inputMode": "richtext" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "count", "dataType": "integer" }]
        });
        let diags = lint_component(&comp, Some(&def));
        let e804 = with_code(&diags, "E804");
        assert_eq!(e804.len(), 1);
        assert!(e804[0].message.contains("richtext"));
        assert!(e804[0].message.contains("integer"));
    }

    #[test]
    fn richtext_string_no_e804() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "bio", "inputMode": "richtext" }
                ]
            }
        });
        let def = json!({
            "items": [{ "key": "bio", "dataType": "string" }]
        });
        let diags = lint_component(&comp, Some(&def));
        assert!(with_code(&diags, "E804").is_empty());
    }

    // W803: Multiple editable inputs bind same field
    #[test]
    fn multiple_editable_inputs_same_bind_emits_w803() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "name" },
                    { "componentType": "NumberInput", "bind": "name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        let w803 = with_code(&diags, "W803");
        assert_eq!(w803.len(), 1);
        assert!(w803[0].message.contains("name"));
    }

    #[test]
    fn display_and_input_same_bind_no_w803() {
        // Heading is a display component, not input — only the input triggers W803
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "Heading", "bind": "name" },
                    { "componentType": "TextInput", "bind": "name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(with_code(&diags, "W803").is_empty());
    }

    // All diagnostics use pass 7
    #[test]
    fn all_diagnostics_are_pass_7() {
        let comp = json!({
            "tree": {
                "componentType": "TextInput",
                "bind": "x",
                "children": [
                    { "componentType": "FancyWidget" },
                    { "componentType": "TextInput", "bind": "x" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert!(!diags.is_empty());
        for d in &diags {
            assert_eq!(d.pass, PASS, "Diagnostic {} should be pass {}", d.code, PASS);
        }
    }

    // Nested tree walking
    #[test]
    fn deeply_nested_bind_tracked() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    {
                        "componentType": "Card",
                        "children": [
                            { "componentType": "TextInput", "bind": "name" }
                        ]
                    },
                    { "componentType": "TextInput", "bind": "name" }
                ]
            }
        });
        let diags = lint_component(&comp, None);
        assert_eq!(with_code(&diags, "W804").len(), 1);
    }

    // Field lookup finds nested definition items
    #[test]
    fn field_lookup_finds_nested_items() {
        let comp = json!({
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "amount" }
                ]
            }
        });
        let def = json!({
            "items": [{
                "key": "lines",
                "children": [{ "key": "amount", "dataType": "string" }]
            }]
        });
        let diags = lint_component(&comp, Some(&def));
        assert!(with_code(&diags, "W800").is_empty(), "Nested field 'amount' should resolve");
    }
}
