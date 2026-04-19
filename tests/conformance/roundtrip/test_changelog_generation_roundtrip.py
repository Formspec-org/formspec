"""Round-trip conformance: generated changelog → detect_document_type → lint.

Regression coverage for E100 ("Cannot determine document type") on
`generate_changelog` output. The generator previously emitted the body
fields (`definitionUrl` / `fromVersion` / …) without the
`$formspecChangelog` envelope marker the linter's pass-1 detection keys
off, so `_pass_changelog_generation` in `validate.py` tripped E100 on
every generated changelog.

See: thoughts/plans/2026-04-17-changelog-generation-fails-doctype-detection.md
"""

from __future__ import annotations

from formspec._rust import detect_document_type, generate_changelog, lint


def _def(version: str, *items: dict) -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.org/form",
        "version": version,
        "title": "Round-trip Form",
        "items": list(items),
    }


class TestChangelogEnvelopeMarker:
    def test_generated_changelog_has_formspec_changelog_marker(self):
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "name", "type": "field", "dataType": "string", "label": "Name"
        })
        cl = generate_changelog(old, new, "https://example.org/form")
        assert cl.get("$formspecChangelog") == "1.0", (
            "generate_changelog must emit the $formspecChangelog envelope marker"
        )


class TestDetectDocumentTypeRoundTrip:
    def test_detect_document_type_classifies_generated_changelog(self):
        old = _def("1.0.0")
        new = _def("2.0.0")  # version-only change → cosmetic/patch
        cl = generate_changelog(old, new, "https://example.org/form")
        assert detect_document_type(cl) == "changelog", (
            "generated changelog must be detectable as 'changelog' "
            "(otherwise lint() pass-1 emits E100)"
        )


class TestLintRoundTrip:
    def test_camel_output_lints_cleanly_without_any_translation(self):
        """With `wire_style="camel"`, generator output matches the wire schema
        directly — no Python-side translation needed, no E100 or E101 fires.
        """
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "name", "type": "field", "dataType": "string", "label": "Name"
        })
        cl = generate_changelog(old, new, "https://example.org/form", wire_style="camel")
        diags = lint(cl)
        errors = [d for d in diags if d.severity == "error"]
        assert errors == [], (
            "camel-style generated changelog should validate cleanly, got: "
            f"{[(d.code, d.message) for d in errors]}"
        )

    def test_camel_output_has_camelcase_keys(self):
        """Pin the wire contract: camel style emits the exact keys the schema
        requires (no snake_case leaking through)."""
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "name", "type": "field", "dataType": "string", "label": "Name"
        })
        cl = generate_changelog(old, new, "https://example.org/form", wire_style="camel")
        assert "definitionUrl" in cl
        assert "fromVersion" in cl
        assert "toVersion" in cl
        assert "semverImpact" in cl
        assert "definition_url" not in cl
        assert "from_version" not in cl
        for change in cl["changes"]:
            assert "type" in change  # camel change keys
            assert "change_type" not in change

    def test_camel_output_omits_migration_hint_when_absent(self):
        """Absence-not-null: on an Added item (never carries migrationHint),
        the key must be absent from the change object. Schema declares
        migrationHint as `type: "string"` with no null permitted under
        `additionalProperties: false`, so null-present would fail lint."""
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "x", "type": "field", "dataType": "string", "label": "X"
        })
        cl = generate_changelog(old, new, "https://example.org/form", wire_style="camel")
        added = next(c for c in cl["changes"] if c.get("type") == "added")
        assert "migrationHint" not in added, (
            f"added change must not emit migrationHint, got: {added}"
        )

    def test_snake_style_is_still_the_default_for_backwards_compat(self):
        """Callers that do not pass `wire_style` keep getting snake_case."""
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "name", "type": "field", "dataType": "string", "label": "Name"
        })
        cl = generate_changelog(old, new, "https://example.org/form")
        assert "definition_url" in cl
        assert "from_version" in cl
        assert "semver_impact" in cl
        for change in cl["changes"]:
            assert "change_type" in change

    def test_lint_does_not_emit_e100_on_generated_changelog_snake(self):
        """Regression: snake output still passes document-type detection
        (via the `$formspecChangelog` envelope marker, which is casing-
        agnostic). E101 may fire on snake keys under `additionalProperties:
        false`, but E100 must not.
        """
        old = _def("1.0.0")
        new = _def("1.1.0", {
            "key": "x", "type": "field", "dataType": "string", "label": "X"
        })
        cl = generate_changelog(old, new, "https://example.org/form")
        diags = lint(cl)
        e100 = [d for d in diags if d.code == "E100"]
        assert e100 == [], (
            f"E100 fired on generated changelog: {[d.message for d in e100]}"
        )

    def test_rejects_unknown_wire_style(self):
        """The binding raises on invalid wire_style values — no silent
        fallback to snake."""
        import pytest
        old = _def("1.0.0")
        new = _def("1.1.0")
        with pytest.raises(ValueError, match="unknown wire_style"):
            generate_changelog(old, new, "u", wire_style="kebab")
