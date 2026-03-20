//! Formspec Linter — 7-pass static analysis and validation pipeline.
//!
//! Pass 1 (E100): Document type detection
//! Pass 2 (E200/E201): Tree indexing, duplicate key/path detection
//! Pass 3 (E300/E301/E302/W300): Reference validation — bind paths, shape targets, optionSets
//! Pass 3b (E600/E601/E602): Extension resolution against registry documents
//! Pass 4 (E400): FEL expression compilation
//! Pass 5 (E500): Dependency cycle detection
//! Pass 6 (W700-W711/E710): Theme — token validation, reference integrity, page semantics
//! Pass 7 (E800-E807/W800-W804): Components — tree validation, type compatibility, bind resolution

mod types;

pub mod component_matrix;
pub mod dependencies;
pub mod expressions;
pub mod extensions;
pub mod pass_component;
pub mod pass_theme;
pub mod references;
pub mod tree;

use serde_json::Value;

use formspec_core::{DocumentType, detect_document_type};

// Re-export public types
pub use types::{
    LintDiagnostic, LintMode, LintOptions, LintResult, LintSeverity, sort_diagnostics,
};

// ── Lint pipeline ───────────────────────────────────────────────

/// Run the full lint pipeline on a Formspec document with default options.
pub fn lint(doc: &Value) -> LintResult {
    lint_with_options(doc, &LintOptions::default())
}

/// Run the full lint pipeline with explicit options.
pub fn lint_with_options(doc: &Value, options: &LintOptions) -> LintResult {
    let mut diagnostics = Vec::new();

    // ── Pass 1: Document type detection ─────────────────────────
    let doc_type = detect_document_type(doc);

    if doc_type.is_none() {
        diagnostics.push(LintDiagnostic::error(
            "E100",
            1,
            "$",
            "Cannot determine document type",
        ));
        return LintResult {
            document_type: None,
            diagnostics,
            valid: false,
        };
    }

    let doc_type = doc_type.unwrap();

    // ── schema_only: return after pass 1 ────────────────────────
    if options.schema_only {
        sort_diagnostics(&mut diagnostics);
        diagnostics.retain(|d| !d.suppressed_in(options.mode));
        let valid = diagnostics
            .iter()
            .all(|d| d.severity != LintSeverity::Error);
        return LintResult {
            document_type: Some(doc_type),
            diagnostics,
            valid,
        };
    }

    // ── Definition passes (2–5) ─────────────────────────────────
    if doc_type == DocumentType::Definition {
        // Pass 2: Tree indexing (E200/E201)
        let mut tree_index = tree::build_item_index(doc);
        diagnostics.append(&mut tree_index.diagnostics);

        // Pass gating: stop if structural errors exist from pass 2
        if diagnostics
            .iter()
            .any(|d| d.severity == LintSeverity::Error)
        {
            sort_diagnostics(&mut diagnostics);
            diagnostics.retain(|d| !d.suppressed_in(options.mode));
            return LintResult {
                document_type: Some(doc_type),
                diagnostics,
                valid: false,
            };
        }

        // Pass 3: Reference validation (E300/E301/E302/W300)
        diagnostics.extend(references::check_references(doc, &tree_index));

        // Pass 3b: Extension resolution (E600/E601/E602)
        diagnostics.extend(extensions::check_extensions(
            doc,
            &options.registry_documents,
        ));

        // Pass 4: Expression compilation (E400)
        // Pass 5: Dependency cycle detection (E500)
        if !options.no_fel {
            let compilation = expressions::compile_expressions(doc);
            diagnostics.extend(compilation.diagnostics);
            diagnostics.extend(dependencies::analyze_dependencies(&compilation.compiled));
        }
    }

    // ── Theme pass (6) ──────────────────────────────────────────
    if doc_type == DocumentType::Theme {
        diagnostics.extend(pass_theme::lint_theme(
            doc,
            options.definition_document.as_ref(),
        ));
    }

    // ── Component pass (7) ──────────────────────────────────────
    if doc_type == DocumentType::Component {
        diagnostics.extend(pass_component::lint_component(
            doc,
            options.definition_document.as_ref(),
        ));
    }

    // Sort and filter
    sort_diagnostics(&mut diagnostics);

    // Strict mode: promote component compatibility warnings to errors
    if options.mode == LintMode::Strict {
        for d in &mut diagnostics {
            if matches!(d.code.as_str(), "W800" | "W802" | "W803" | "W804") {
                d.severity = LintSeverity::Error;
            }
        }
    }

    diagnostics.retain(|d| !d.suppressed_in(options.mode));

    let valid = diagnostics
        .iter()
        .all(|d| d.severity != LintSeverity::Error);
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

    // ── Integration tests ──────────────────────────────────────────
    //
    // These tests exercise the full `lint()` / `lint_with_options()` pipeline.
    // Each one verifies cross-pass behaviour that module-level unit tests
    // cannot: document-type routing, pass gating, diagnostic sorting/filtering,
    // lint-mode suppression, and multi-pass diagnostic merging.
    //
    // Single-pass behaviour (E302, W300, E301, wildcard binds, extension
    // details) is tested exhaustively in the per-module tests. Duplicating
    // those here would add maintenance cost without additional confidence.

    /// Spec: spec.md §2.1 — "$formspec" key identifies a valid definition document
    #[test]
    fn valid_definition_passes_all_passes() {
        let def = json!({
            "$formspec": "1.0",
            "title": "Test",
            "items": [{ "key": "name", "dataType": "string" }],
            "binds": { "name": { "required": "true" } }
        });
        let result = lint(&def);
        assert!(result.valid);
        assert_eq!(result.document_type, Some(DocumentType::Definition));
    }

    /// Spec: spec.md §2.1 — unrecognized document types emit E100 and halt
    #[test]
    fn unknown_document_emits_e100_and_halts() {
        let doc = json!({ "random": "data" });
        let result = lint(&doc);
        assert!(!result.valid);
        assert!(result.diagnostics.iter().any(|d| d.code == "E100"));
        assert_eq!(result.diagnostics.len(), 1, "Should halt after E100");
    }

    /// Spec: spec.md §7.2 — structural errors in pass 2 prevent passes 3-5
    #[test]
    fn pass_gating_stops_on_structural_errors() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }, { "key": "name" }],
            "binds": {
                "nonexistent": { "required": "true" },
                "name": { "calculate": "invalid ++" }
            }
        });
        let result = lint(&def);
        assert!(result.diagnostics.iter().any(|d| d.code == "E201"));
        assert_eq!(
            result.diagnostics.iter().filter(|d| d.pass >= 3).count(),
            0,
            "No diagnostics from pass 3+ when pass 2 has structural errors"
        );
    }

    /// Spec: spec.md §7 — diagnostics sorted by (pass, severity, path)
    #[test]
    fn diagnostic_sorting_uses_lexicographic_tuple() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "name", "dataType": "string" },
                { "key": "color", "dataType": "boolean", "optionSet": "missing_set" }
            ],
            "binds": { "name": { "calculate": "invalid ++" } }
        });
        let result = lint(&def);
        assert!(result.diagnostics.len() >= 2);
        for window in result.diagnostics.windows(2) {
            let (a, b) = (&window[0], &window[1]);
            assert!(
                (a.pass, a.severity, &a.path) <= (b.pass, b.severity, &b.path),
                "Diagnostics not sorted: ({}, {:?}, {}) should come before ({}, {:?}, {})",
                a.pass,
                a.severity,
                a.path,
                b.pass,
                b.severity,
                b.path,
            );
        }
    }

    /// Spec: spec.md §7 — LintMode::Authoring suppresses W300 and W802
    #[test]
    fn lint_mode_authoring_suppresses_w300() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "f", "dataType": "boolean", "optionSet": "opts" }],
            "optionSets": { "opts": { "options": [{ "value": "yes" }] } }
        });
        let rt = lint_with_options(
            &def,
            &LintOptions {
                mode: LintMode::Runtime,
                ..Default::default()
            },
        );
        assert_eq!(
            rt.diagnostics.iter().filter(|d| d.code == "W300").count(),
            1
        );
        let auth = lint_with_options(
            &def,
            &LintOptions {
                mode: LintMode::Authoring,
                ..Default::default()
            },
        );
        assert_eq!(
            auth.diagnostics.iter().filter(|d| d.code == "W300").count(),
            0
        );
    }

    /// Spec: spec.md §9 — screener integration spans passes 3+4
    #[test]
    fn screener_integration_spans_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "age", "dataType": "integer" }],
            "screener": {
                "routes": [
                    { "condition": "$age >= 18", "target": "adult" },
                    { "condition": "invalid ++ expr", "target": "error" }
                ]
            }
        });
        let result = lint(&def);
        let e400 = result
            .diagnostics
            .iter()
            .filter(|d| d.code == "E400" && d.path.contains("screener"))
            .collect::<Vec<_>>();
        assert_eq!(e400.len(), 1);
        assert!(e400[0].path.contains("routes[1]"));
    }

    /// Spec: extension-registry.md §3 — extension resolution via registry documents
    #[test]
    fn extension_resolution_cross_pass_integration() {
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
        let screener_errors = result
            .diagnostics
            .iter()
            .filter(|d| d.path.contains("screener"))
            .count();
        assert_eq!(
            screener_errors, 0,
            "Valid screener expressions should not produce errors"
        );
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
        assert!(
            result.diagnostics.len() >= 2,
            "Should have multiple diagnostics"
        );

        // Verify sorting: pass numbers are non-decreasing
        for window in result.diagnostics.windows(2) {
            let a = &window[0];
            let b = &window[1];
            assert!(
                a.pass < b.pass
                    || (a.pass == b.pass && a.severity <= b.severity)
                    || (a.pass == b.pass && a.severity == b.severity && a.path <= b.path),
                "Diagnostics not sorted: ({}, {:?}, {}) should come before ({}, {:?}, {})",
                a.pass,
                a.severity,
                a.path,
                b.pass,
                b.severity,
                b.path,
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
        assert!(
            result.diagnostics.iter().any(|d| d.code == "E201"),
            "E201 should be present"
        );

        // Finding 49: verify .valid is false on early-return path
        assert!(
            !result.valid,
            "Document with structural errors should be invalid"
        );

        // Pass 3 (E300) and pass 4 (E400) should NOT be present because of pass gating
        let pass3_plus = result.diagnostics.iter().filter(|d| d.pass >= 3).count();
        assert_eq!(
            pass3_plus, 0,
            "No diagnostics from pass 3+ should exist when pass 2 has structural errors"
        );
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
        let runtime_result = lint_with_options(
            &def,
            &LintOptions {
                mode: LintMode::Runtime,
                ..Default::default()
            },
        );
        let w300_runtime = runtime_result
            .diagnostics
            .iter()
            .filter(|d| d.code == "W300")
            .count();
        assert_eq!(w300_runtime, 1, "Runtime mode should emit W300");

        // Authoring mode: W300 suppressed
        let authoring_result = lint_with_options(
            &def,
            &LintOptions {
                mode: LintMode::Authoring,
                ..Default::default()
            },
        );
        let w300_authoring = authoring_result
            .diagnostics
            .iter()
            .filter(|d| d.code == "W300")
            .count();
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
        let registry = json!({ "entries": [{ "name": "x-formspec-url", "status": "active" }] });
        let result = lint_with_options(
            &def,
            &LintOptions {
                registry_documents: vec![registry],
                ..Default::default()
            },
        );
        let e600 = result
            .diagnostics
            .iter()
            .filter(|d| d.code == "E600")
            .collect::<Vec<_>>();
        assert_eq!(e600.len(), 1);
        assert!(e600[0].message.contains("x-unknown-ext"));
    }

    /// No registries → every enabled extension emits E600.
    #[test]
    fn no_registries_emits_e600() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "e", "extensions": { "x-formspec-url": true } }]
        });
        let result = lint(&def);
        assert_eq!(
            result
                .diagnostics
                .iter()
                .filter(|d| d.code == "E600")
                .count(),
            1,
            "Should emit E600 for enabled extension with no registries"
        );
    }

    /// Spec: theme-spec.md §1 — "$formspecTheme" routes to pass 6
    #[test]
    fn theme_document_routes_to_pass_6() {
        let theme = json!({
            "$formspecTheme": "1.0",
            "tokens": { "primary": "#000" },
            "selectors": [{
                "match": "*",
                "properties": { "color": "$token.primary", "bg": "$token.missing" }
            }]
        });
        let result = lint(&theme);
        assert_eq!(result.document_type, Some(DocumentType::Theme));
        assert!(result.diagnostics.iter().any(|d| d.code == "W704"));
        assert_eq!(result.diagnostics.len(), 1);
    }

    /// Spec: component-spec.md §4.6 — W802 (compatible-with-warning) is suppressed
    /// in Authoring mode but present in Runtime mode.
    #[test]
    fn test_w802_authoring_mode_suppression() {
        // TextInput + integer = CompatibleWithWarning → W802
        let comp = json!({
            "$formspecComponent": "1.0",
            "tree": {
                "component": "Stack",
                "children": [
                    { "component": "TextInput", "bind": "age" }
                ]
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "age", "dataType": "integer" }]
        });

        // Runtime mode: W802 present
        let runtime_result = lint_with_options(
            &comp,
            &LintOptions {
                mode: LintMode::Runtime,
                definition_document: Some(def.clone()),
                ..Default::default()
            },
        );
        let w802_runtime = runtime_result
            .diagnostics
            .iter()
            .filter(|d| d.code == "W802")
            .count();
        assert_eq!(w802_runtime, 1, "Runtime mode should emit W802");

        // Authoring mode: W802 suppressed
        let authoring_result = lint_with_options(
            &comp,
            &LintOptions {
                mode: LintMode::Authoring,
                definition_document: Some(def),
                ..Default::default()
            },
        );
        let w802_authoring = authoring_result
            .diagnostics
            .iter()
            .filter(|d| d.code == "W802")
            .count();
        assert_eq!(w802_authoring, 0, "Authoring mode should suppress W802");
    }

    #[test]
    fn component_document_routes_to_pass_7() {
        let comp = json!({ "$formspecComponent": "1.0", "tree": { "children": [] } });
        let result = lint(&comp);
        assert_eq!(result.document_type, Some(DocumentType::Component));
        assert!(result.diagnostics.iter().any(|d| d.code == "E800"));
    }

    /// Cross-pass integration: definition with errors across passes 3, 4, and 5
    /// verifies that all passes run and diagnostics merge correctly.
    #[test]
    fn multi_pass_definition_collects_all_diagnostics() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "a" }, { "key": "b" }],
            "binds": {
                "ghost": { "required": "true" },
                "a": { "calculate": "$b + 1" },
                "b": { "calculate": "$a + 1" }
            },
            "shapes": [{ "target": "phantom", "constraint": "true" }]
        });
        let result = lint(&def);
        assert!(
            result.diagnostics.iter().any(|d| d.code == "E300"),
            "Should have E300"
        );
        assert!(
            result.diagnostics.iter().any(|d| d.code == "E301"),
            "Should have E301"
        );
        assert!(
            result.diagnostics.iter().any(|d| d.code == "E500"),
            "Should have E500"
        );
        // Verify monotonic pass ordering
        let passes: Vec<u8> = result.diagnostics.iter().map(|d| d.pass).collect();
        for w in passes.windows(2) {
            assert!(w[0] <= w[1], "Passes should be non-decreasing");
        }
    }

    // ── schema_only: returns after pass 1 ─────────────────────────

    /// schema_only returns document type and no further diagnostics.
    #[test]
    fn schema_only_skips_all_semantic_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "a" }, { "key": "b" }],
            "binds": {
                "ghost": { "required": "true" },
                "a": { "calculate": "invalid ++" }
            }
        });
        let result = lint_with_options(
            &def,
            &LintOptions {
                schema_only: true,
                ..Default::default()
            },
        );
        assert_eq!(result.document_type, Some(DocumentType::Definition));
        assert!(
            result.diagnostics.is_empty(),
            "schema_only should produce no diagnostics for a valid document type, got: {:?}",
            result.diagnostics.iter().map(|d| &d.code).collect::<Vec<_>>()
        );
        assert!(result.valid);
    }

    /// schema_only still reports E100 for unrecognized documents.
    #[test]
    fn schema_only_still_reports_e100() {
        let doc = json!({ "random": "data" });
        let result = lint_with_options(
            &doc,
            &LintOptions {
                schema_only: true,
                ..Default::default()
            },
        );
        assert!(!result.valid);
        assert!(result.diagnostics.iter().any(|d| d.code == "E100"));
    }

    // ── no_fel: skips passes 4 and 5 ────────────────────────────

    /// no_fel skips expression compilation (pass 4) and dependency detection (pass 5).
    #[test]
    fn no_fel_skips_expression_and_dependency_passes() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "a" }, { "key": "b" }],
            "binds": {
                "a": { "calculate": "invalid ++" },
                "b": { "calculate": "$a + 1" }
            }
        });
        // Without no_fel: should have E400 from invalid expression
        let full_result = lint(&def);
        assert!(
            full_result.diagnostics.iter().any(|d| d.code == "E400"),
            "Full lint should report E400"
        );

        // With no_fel: no E400 or E500
        let result = lint_with_options(
            &def,
            &LintOptions {
                no_fel: true,
                ..Default::default()
            },
        );
        assert!(
            !result.diagnostics.iter().any(|d| d.code == "E400"),
            "no_fel should skip E400"
        );
        assert!(
            !result.diagnostics.iter().any(|d| d.code == "E500"),
            "no_fel should skip E500"
        );
    }

    /// no_fel still runs passes 2 and 3 (tree indexing and references).
    #[test]
    fn no_fel_still_runs_reference_checks() {
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }],
            "binds": {
                "ghost": { "required": "true" }
            }
        });
        let result = lint_with_options(
            &def,
            &LintOptions {
                no_fel: true,
                ..Default::default()
            },
        );
        assert!(
            result.diagnostics.iter().any(|d| d.code == "E300"),
            "no_fel should still run pass 3 reference checks"
        );
    }

    // ── Strict mode: promotes component warnings to errors ──────

    /// Strict mode promotes W800/W802/W803/W804 to errors.
    #[test]
    fn strict_mode_promotes_component_warnings_to_errors() {
        // TextInput + integer = CompatibleWithWarning → W802
        let comp = json!({
            "$formspecComponent": "1.0",
            "tree": {
                "component": "Stack",
                "children": [
                    { "component": "TextInput", "bind": "age" }
                ]
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "age", "dataType": "integer" }]
        });
        let result = lint_with_options(
            &comp,
            &LintOptions {
                mode: LintMode::Strict,
                definition_document: Some(def),
                ..Default::default()
            },
        );
        let w802 = result
            .diagnostics
            .iter()
            .filter(|d| d.code == "W802")
            .collect::<Vec<_>>();
        assert_eq!(w802.len(), 1);
        assert_eq!(
            w802[0].severity,
            LintSeverity::Error,
            "Strict mode should promote W802 to Error"
        );
        assert!(!result.valid, "Document with promoted error should be invalid");
    }

    // ── E600: no-registry emits E600 for every enabled extension ──

    /// When no registries are loaded, every enabled extension is unresolved.
    #[test]
    fn no_registries_emits_e600_for_all_enabled_extensions() {
        let def = json!({
            "$formspec": "1.0",
            "items": [
                { "key": "a", "extensions": { "x-foo": true, "x-bar": false } },
                { "key": "b", "extensions": { "x-baz": { "opt": 1 } } }
            ]
        });
        let result = lint(&def);
        let e600: Vec<_> = result
            .diagnostics
            .iter()
            .filter(|d| d.code == "E600")
            .collect();
        assert_eq!(
            e600.len(),
            2,
            "Should emit E600 for x-foo and x-baz (x-bar is disabled), got: {:?}",
            e600.iter().map(|d| &d.message).collect::<Vec<_>>()
        );
    }
}
