//! Authoring-loop metadata for lint diagnostics — maps each rule code to the
//! normative spec clause that motivates it and a machine-actionable repair hint.
//!
//! LLM authors consume `suggested_fix` to apply structured repairs and `spec_ref`
//! to cite the clause that constrains the fix. The canonical registry lives in
//! `specs/lint-codes.json`; this module keeps the in-source values in sync so
//! every emitted diagnostic carries the same authoring-loop hints the registry
//! advertises.

use crate::types::LintDiagnostic;

/// Metadata attached to a diagnostic: pointer to the normative spec clause and
/// a short, imperative repair hint.
#[derive(Debug, Clone, Copy)]
pub(crate) struct RuleMetadata {
    /// Repo-relative path + anchor that motivates this rule.
    pub spec_ref: &'static str,
    /// Imperative, under ~100 chars — what the author (or LLM) should do.
    pub suggested_fix: &'static str,
}

/// Look up the authoring-loop metadata for a diagnostic code.
///
/// Returns `None` for codes that do not yet have tested metadata — those
/// diagnostics are emitted without hints until they graduate into the
/// `tested` tier of the rule registry.
pub(crate) fn metadata_for(code: &str) -> Option<RuleMetadata> {
    Some(match code {
        "E101" => RuleMetadata {
            spec_ref: "specs/core/spec.md#4-definition-schema",
            suggested_fix:
                "align the document with schemas/*.schema.json — fix the flagged property or value",
        },
        "E300" => RuleMetadata {
            spec_ref: "specs/core/spec.md#433-path-syntax",
            suggested_fix: "change bind target to match an item key, or add the missing item to `items`",
        },
        "E500" => RuleMetadata {
            spec_ref: "specs/core/spec.md#362-topological-ordering",
            suggested_fix: "break the dependency cycle — remove one bind's reference to the other",
        },
        "E600" => RuleMetadata {
            spec_ref: "specs/core/spec.md#85-extension-namespaces",
            suggested_fix: "declare the extension in a loaded registry, or remove the extension key",
        },
        "W300" => RuleMetadata {
            spec_ref: "specs/core/spec.md#46-option-sets",
            suggested_fix:
                "change dataType to one of string/integer/decimal/choice/multiChoice, or drop the optionSet",
        },
        "W704" => RuleMetadata {
            spec_ref: "specs/theme/theme-spec.md#34-token-resolution",
            suggested_fix: "define the token in your theme's tokens map, or use an existing token",
        },
        "W800" => RuleMetadata {
            spec_ref: "specs/component/component-spec.md#42-bind-resolution-rules",
            suggested_fix: "point bind at an existing field key, or add that field to the definition",
        },
        "W802" => RuleMetadata {
            spec_ref: "specs/component/component-spec.md#46-binddatatype-compatibility-matrix",
            suggested_fix: "pick a component whose dataType matrix includes this field's type",
        },
        _ => return None,
    })
}

/// Attach rule metadata to a diagnostic if the code has registered metadata.
///
/// Call sites stay terse: `with_metadata(LintDiagnostic::error(...))`. Codes
/// without tested metadata pass through unchanged.
pub(crate) fn with_metadata(diag: LintDiagnostic) -> LintDiagnostic {
    match metadata_for(&diag.code) {
        Some(meta) => diag
            .with_suggested_fix(meta.suggested_fix)
            .with_spec_ref(meta.spec_ref),
        None => diag,
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::missing_docs_in_private_items)]
    use super::*;

    #[test]
    fn tested_codes_have_metadata() {
        for code in ["E101", "E300", "E500", "E600", "W300", "W704", "W800", "W802"] {
            let meta = metadata_for(code).unwrap_or_else(|| panic!("missing metadata for {code}"));
            assert!(!meta.spec_ref.is_empty(), "{code} spec_ref empty");
            assert!(meta.spec_ref.starts_with("specs/"), "{code} spec_ref not repo-relative");
            assert!(!meta.suggested_fix.is_empty(), "{code} suggested_fix empty");
            assert!(
                meta.suggested_fix.len() < 120,
                "{code} suggested_fix > 120 chars: {}",
                meta.suggested_fix.len()
            );
        }
    }

    #[test]
    fn with_metadata_decorates_known_codes() {
        let d = with_metadata(LintDiagnostic::error("E300", 3, "$", "bad"));
        assert!(d.suggested_fix.is_some());
        assert!(d.spec_ref.is_some());
    }

    #[test]
    fn with_metadata_passes_unknown_codes_through() {
        let d = with_metadata(LintDiagnostic::error("E999", 1, "$", "unknown"));
        assert!(d.suggested_fix.is_none());
        assert!(d.spec_ref.is_none());
    }
}
