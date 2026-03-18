//! Formspec Linter — 7-pass static analysis and validation pipeline.

/// Formspec Linter — 7-pass static analysis pipeline.
///
/// Pass 1 (E100): Schema validation — JSON Schema conformance, document type detection
/// Pass 2 (E200): Tree — Item tree flattening, duplicate key detection
/// Pass 3 (E300/E301/E302/W300/E600): References — Bind/shape path validation,
///         optionSet resolution, extension resolution, wildcard path checks
/// Pass 4 (E400): Expressions — Parse all FEL slots in binds/shapes/screener
/// Pass 5 (E500): Dependencies — Dependency graph + DFS cycle detection
/// Pass 6 (W700): Theme — Token validation, reference integrity, page layout
/// Pass 7 (E800): Components — Component tree, type compatibility, bind uniqueness

mod passes;
mod types;

use serde_json::Value;

use formspec_core::{detect_document_type, DocumentType};

// Re-export public types
pub use types::{
    sort_diagnostics, LintDiagnostic, LintMode, LintOptions, LintResult, LintSeverity,
};

// ── Lint pipeline ───────────────────────────────────────────────

/// Run the full lint pipeline on a Formspec document with default options.
pub fn lint(doc: &Value) -> LintResult {
    lint_with_options(doc, &LintOptions::default())
}

/// Run the full lint pipeline with explicit options.
pub fn lint_with_options(doc: &Value, options: &LintOptions) -> LintResult {
    let mut diagnostics = Vec::new();

    // Detect document type
    let doc_type = detect_document_type(doc);

    // Pass 1: Schema validation (detection)
    if doc_type.is_none() {
        diagnostics.push(LintDiagnostic {
            code: "E100".to_string(),
            pass: 1,
            severity: LintSeverity::Error,
            path: "$".to_string(),
            message: "Cannot determine document type".to_string(),
        });
        return LintResult {
            document_type: None,
            diagnostics,
            valid: false,
        };
    }

    let doc_type = doc_type.unwrap();

    // Only run definition-specific passes on definitions
    if doc_type == DocumentType::Definition {
        // Pass 2: Tree
        passes::pass_2_tree(doc, &mut diagnostics);

        // Pass gating: stop if structural errors exist from pass 2
        let has_structural_errors = diagnostics.iter().any(|d| d.severity == LintSeverity::Error);
        if has_structural_errors {
            // Sort and filter before returning
            sort_diagnostics(&mut diagnostics);
            diagnostics.retain(|d| !d.suppressed_in(options.mode));
            return LintResult {
                document_type: Some(doc_type),
                diagnostics,
                valid: false,
            };
        }

        // Pass 3: References (includes E300, E301, E302, W300, E600)
        passes::pass_3_references(doc, &mut diagnostics);
        passes::pass_3b_extensions(doc, &options.registry_documents, &mut diagnostics);

        // Pass 4: Expressions
        passes::pass_4_expressions(doc, &mut diagnostics);

        // Pass 5: Dependencies
        passes::pass_5_dependencies(doc, &mut diagnostics);
    }

    if doc_type == DocumentType::Theme {
        passes::pass_6_theme(doc, &mut diagnostics);
    }

    if doc_type == DocumentType::Component {
        passes::pass_7_components(doc, &mut diagnostics);
    }

    // Sort diagnostics: pass ASC, severity (error > warning > info), path ASC
    sort_diagnostics(&mut diagnostics);

    // Apply lint mode filtering
    diagnostics.retain(|d| !d.suppressed_in(options.mode));

    let valid = diagnostics.iter().all(|d| d.severity != LintSeverity::Error);

    LintResult {
        document_type: Some(doc_type),
        diagnostics,
        valid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── Existing tests (preserved) ──────────────────────────────

    #[test]
    fn test_lint_valid_definition() {
        let def = json!({
            "$formspec": "1.0",
            "title": "Test",
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });
        let result = lint(&def);
        assert!(result.valid);
        assert_eq!(result.document_type, Some(DocumentType::Definition));
    }

    #[test]
    fn test_lint_unknown_document() {
        let doc = json!({ "random": "data" });
        let result = lint(&doc);
        assert!(!result.valid);
        assert!(result.diagnostics.iter().any(|d| d.code == "E100"));
    }

    #[test]
    fn test_lint_duplicate_keys() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name" },
                { "key": "name" }
            ]
        });
        let result = lint(&def);
        assert!(result.diagnostics.iter().any(|d| d.code == "E201"));
    }

    #[test]
    fn test_lint_invalid_bind_reference() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }],
            "binds": {
                "nonexistent": { "required": "true" }
            }
        });
        let result = lint(&def);
        assert!(result.diagnostics.iter().any(|d| d.code == "E300"));
    }

    #[test]
    fn test_lint_fel_parse_error() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }],
            "binds": {
                "name": { "calculate": "1 + + 2" }
            }
        });
        let result = lint(&def);
        assert!(result.diagnostics.iter().any(|d| d.code == "E400"));
    }

    #[test]
    fn test_lint_dependency_cycle() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "a" },
                { "key": "b" }
            ],
            "binds": {
                "a": { "calculate": "$b + 1" },
                "b": { "calculate": "$a + 1" }
            }
        });
        let result = lint(&def);
        assert!(result.diagnostics.iter().any(|d| d.code == "E500"));
    }

    #[test]
    fn test_lint_theme_token_reference() {
        let theme = json!({
            "$formspecTheme": "1.0",
            "tokens": { "primary": "#000" },
            "selectors": [
                {
                    "match": "*",
                    "properties": {
                        "color": "$token.primary",
                        "bg": "$token.missing"
                    }
                }
            ]
        });
        let result = lint(&theme);
        assert_eq!(result.document_type, Some(DocumentType::Theme));
        // Should warn about missing token
        assert!(result.diagnostics.iter().any(|d| d.code == "W700"));
        // Should not warn about existing token
        assert_eq!(result.diagnostics.len(), 1);
    }

    #[test]
    fn test_lint_component_missing_type() {
        let comp = json!({
            "$formspecComponent": "1.0",
            "tree": { "children": [] }
        });
        let result = lint(&comp);
        assert!(result.diagnostics.iter().any(|d| d.code == "E800"));
    }

    #[test]
    fn test_lint_component_duplicate_bind() {
        let comp = json!({
            "$formspecComponent": "1.0",
            "tree": {
                "componentType": "Stack",
                "children": [
                    { "componentType": "TextInput", "bind": "name" },
                    { "componentType": "TextInput", "bind": "name" }
                ]
            }
        });
        let result = lint(&comp);
        assert!(result.diagnostics.iter().any(|d| d.code == "W804"));
    }

    // ── New tests ───────────────────────────────────────────────

    #[test]
    fn test_e302_option_set_not_found() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "color", "dataType": "choice", "optionSet": "colors" }
            ],
            "optionSets": {
                "sizes": { "options": [{ "value": "S" }, { "value": "M" }] }
            }
        });
        let result = lint(&def);
        let e302 = result.diagnostics.iter().filter(|d| d.code == "E302").collect::<Vec<_>>();
        assert_eq!(e302.len(), 1, "Expected exactly one E302 diagnostic");
        assert!(e302[0].message.contains("colors"), "Message should mention 'colors'");
        assert!(!result.valid, "Should be invalid due to E302 error");
    }

    #[test]
    fn test_e302_option_set_found_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "color", "dataType": "choice", "optionSet": "colors" }
            ],
            "optionSets": {
                "colors": { "options": [{ "value": "red" }, { "value": "blue" }] }
            }
        });
        let result = lint(&def);
        let e302 = result.diagnostics.iter().filter(|d| d.code == "E302").count();
        assert_eq!(e302, 0, "No E302 when optionSet exists");
    }

    #[test]
    fn test_w300_incompatible_data_type_for_option_set() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "field1", "dataType": "boolean", "optionSet": "yesno" }
            ],
            "optionSets": {
                "yesno": { "options": [{ "value": "yes" }, { "value": "no" }] }
            }
        });
        let result = lint(&def);
        let w300 = result.diagnostics.iter().filter(|d| d.code == "W300").collect::<Vec<_>>();
        assert_eq!(w300.len(), 1, "Expected one W300 warning");
        assert!(w300[0].message.contains("boolean"), "Should mention the incompatible type");
    }

    #[test]
    fn test_w300_compatible_types_no_warning() {
        for data_type in &["string", "integer", "decimal", "choice", "multiChoice"] {
            let def = json!({
                "$formspec": "1.0",
                "items": [
                    { "key": "field1", "dataType": data_type, "optionSet": "opts" }
                ],
                "optionSets": {
                    "opts": { "options": [{ "value": "a" }] }
                }
            });
            let result = lint(&def);
            let w300 = result.diagnostics.iter().filter(|d| d.code == "W300").count();
            assert_eq!(w300, 0, "dataType '{data_type}' should not trigger W300");
        }
    }

    #[test]
    fn test_e301_shape_target_validation() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "shapes": [
                {
                    "target": "missing_field",
                    "constraint": "$name != ''"
                }
            ]
        });
        let result = lint(&def);
        let e301 = result.diagnostics.iter().filter(|d| d.code == "E301").collect::<Vec<_>>();
        assert_eq!(e301.len(), 1, "Expected one E301 diagnostic");
        assert!(e301[0].message.contains("missing_field"));
    }

    #[test]
    fn test_e301_valid_shape_target_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "shapes": [
                {
                    "target": "name",
                    "constraint": "$name != ''"
                }
            ]
        });
        let result = lint(&def);
        let e301 = result.diagnostics.iter().filter(|d| d.code == "E301").count();
        assert_eq!(e301, 0, "Valid shape target should not emit E301");
    }

    #[test]
    fn test_wildcard_path_in_binds() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "lines",
                    "repeat": { "min": 1, "max": 10 },
                    "children": [
                        { "key": "amount", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "lines[*].amount": { "required": "true" }
            }
        });
        let result = lint(&def);
        // Wildcard path on repeatable group with valid child — should pass
        let e300 = result.diagnostics.iter().filter(|d| d.code == "E300").count();
        assert_eq!(e300, 0, "Valid wildcard path should not produce E300");
    }

    #[test]
    fn test_wildcard_path_non_repeatable_group() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "personal",
                    "children": [
                        { "key": "name", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "personal[*].name": { "required": "true" }
            }
        });
        let result = lint(&def);
        let e300 = result.diagnostics.iter().filter(|d| d.code == "E300").collect::<Vec<_>>();
        assert_eq!(e300.len(), 1, "Wildcard on non-repeatable group should produce E300");
        assert!(e300[0].message.contains("non-repeatable"));
    }

    #[test]
    fn test_wildcard_path_unknown_child() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "lines",
                    "repeat": { "min": 1 },
                    "children": [
                        { "key": "amount", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "lines[*].nonexistent": { "required": "true" }
            }
        });
        let result = lint(&def);
        let e300 = result.diagnostics.iter().filter(|d| d.code == "E300").collect::<Vec<_>>();
        assert_eq!(e300.len(), 1, "Wildcard with unknown child should produce E300");
        assert!(e300[0].message.contains("nonexistent"));
    }

    #[test]
    fn test_screener_expression_validation() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "screener": {
                "routes": [
                    { "condition": "$age >= 18", "target": "adult" },
                    { "condition": "invalid ++ expr", "target": "error" }
                ]
            }
        });
        let result = lint(&def);
        let e400 = result.diagnostics.iter()
            .filter(|d| d.code == "E400" && d.path.contains("screener"))
            .collect::<Vec<_>>();
        assert_eq!(e400.len(), 1, "Expected one E400 for invalid screener expression");
        assert!(e400[0].path.contains("routes[1]"));
    }

    #[test]
    fn test_screener_valid_expression_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "screener": {
                "routes": [
                    { "condition": "$age >= 18", "target": "adult" }
                ]
            }
        });
        let result = lint(&def);
        let screener_errors = result.diagnostics.iter()
            .filter(|d| d.path.contains("screener"))
            .count();
        assert_eq!(screener_errors, 0, "Valid screener expressions should not produce errors");
    }

    #[test]
    fn test_diagnostic_sorting() {
        // Create a document that produces diagnostics from multiple passes
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name", "dataType": "string" },
                { "key": "color", "dataType": "boolean", "optionSet": "missing_set" }
            ],
            "binds": {
                "name": { "calculate": "invalid ++" }
            }
        });
        let result = lint(&def);
        assert!(result.diagnostics.len() >= 2, "Should have multiple diagnostics");

        // Verify sorting: pass numbers are non-decreasing
        for window in result.diagnostics.windows(2) {
            let a = &window[0];
            let b = &window[1];
            assert!(
                a.pass < b.pass
                    || (a.pass == b.pass && a.severity <= b.severity)
                    || (a.pass == b.pass && a.severity == b.severity && a.path <= b.path),
                "Diagnostics not sorted: ({}, {:?}, {}) should come before ({}, {:?}, {})",
                a.pass, a.severity, a.path,
                b.pass, b.severity, b.path,
            );
        }
    }

    #[test]
    fn test_pass_gating_on_structural_errors() {
        // Duplicate keys = E201 (pass 2 structural error)
        // Should NOT run pass 3+ checks
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name" },
                { "key": "name" }
            ],
            "binds": {
                "nonexistent": { "required": "true" },
                "name": { "calculate": "invalid ++" }
            }
        });
        let result = lint(&def);

        // Pass 2 error should be present
        assert!(result.diagnostics.iter().any(|d| d.code == "E201"),
            "E201 should be present");

        // Pass 3 (E300) and pass 4 (E400) should NOT be present because of pass gating
        let pass3_plus = result.diagnostics.iter()
            .filter(|d| d.pass >= 3)
            .count();
        assert_eq!(pass3_plus, 0,
            "No diagnostics from pass 3+ should exist when pass 2 has structural errors");
    }

    #[test]
    fn test_lint_mode_authoring_suppresses_w300() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "field1", "dataType": "boolean", "optionSet": "opts" }
            ],
            "optionSets": {
                "opts": { "options": [{ "value": "yes" }] }
            }
        });

        // Runtime mode: W300 present
        let runtime_result = lint_with_options(&def, &LintOptions {
            mode: LintMode::Runtime,
            ..Default::default()
        });
        let w300_runtime = runtime_result.diagnostics.iter().filter(|d| d.code == "W300").count();
        assert_eq!(w300_runtime, 1, "Runtime mode should emit W300");

        // Authoring mode: W300 suppressed
        let authoring_result = lint_with_options(&def, &LintOptions {
            mode: LintMode::Authoring,
            ..Default::default()
        });
        let w300_authoring = authoring_result.diagnostics.iter().filter(|d| d.code == "W300").count();
        assert_eq!(w300_authoring, 0, "Authoring mode should suppress W300");
    }

    #[test]
    fn test_e600_extension_resolution() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "email",
                    "dataType": "string",
                    "extensions": {
                        "x-formspec-url": true,
                        "x-unknown-ext": true
                    }
                }
            ]
        });
        let registry = json!({
            "entries": [
                { "name": "x-formspec-url", "status": "active" }
            ]
        });
        let result = lint_with_options(&def, &LintOptions {
            registry_documents: vec![registry],
            ..Default::default()
        });

        let e600 = result.diagnostics.iter().filter(|d| d.code == "E600").collect::<Vec<_>>();
        assert_eq!(e600.len(), 1, "Expected one E600 for unresolved extension");
        assert!(e600[0].message.contains("x-unknown-ext"));
    }

    #[test]
    fn test_e600_no_registry_no_check() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "email",
                    "dataType": "string",
                    "extensions": {
                        "x-formspec-url": true
                    }
                }
            ]
        });
        // Without registry documents, E600 checks are skipped
        let result = lint(&def);
        let e600 = result.diagnostics.iter().filter(|d| d.code == "E600").count();
        assert_eq!(e600, 0, "No E600 when no registry documents provided");
    }

    #[test]
    fn test_e600_disabled_extension_not_checked() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "field",
                    "dataType": "string",
                    "extensions": {
                        "x-unknown": false
                    }
                }
            ]
        });
        let registry = json!({
            "entries": []
        });
        let result = lint_with_options(&def, &LintOptions {
            registry_documents: vec![registry],
            ..Default::default()
        });

        let e600 = result.diagnostics.iter().filter(|d| d.code == "E600").count();
        assert_eq!(e600, 0, "Disabled extensions (false) should not be checked");
    }

    #[test]
    fn test_e600_multiple_registries() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                {
                    "key": "field",
                    "dataType": "string",
                    "extensions": {
                        "x-ext-a": true,
                        "x-ext-b": true,
                        "x-ext-c": true
                    }
                }
            ]
        });
        let registry1 = json!({
            "entries": [{ "name": "x-ext-a", "status": "active" }]
        });
        let registry2 = json!({
            "entries": [{ "name": "x-ext-b", "status": "active" }]
        });
        let result = lint_with_options(&def, &LintOptions {
            registry_documents: vec![registry1, registry2],
            ..Default::default()
        });

        let e600 = result.diagnostics.iter().filter(|d| d.code == "E600").collect::<Vec<_>>();
        assert_eq!(e600.len(), 1, "Only x-ext-c should be unresolved");
        assert!(e600[0].message.contains("x-ext-c"));
    }
}
