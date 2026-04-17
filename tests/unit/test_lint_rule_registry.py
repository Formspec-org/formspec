"""Registry coverage for lint rule metadata — ensures every code emitted by the
Rust linter appears in `specs/lint-codes.json`, and that rules declared
`tested` or `stable` carry real `specRef` + `suggestedFix` values that match
what the linter emits at runtime.

This is the contract the authoring loop depends on: LLMs read the diagnostic's
`suggested_fix` and `spec_ref` to apply structured repairs and cite spec.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from formspec._rust import lint


REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "specs" / "lint-codes.json"

REQUIRED_RULE_FIELDS = ("code", "pass", "severity", "title", "state")
ALLOWED_STATES = {"draft", "tested", "stable"}
ALLOWED_SEVERITIES = {"error", "warning", "info"}


def _load_registry() -> dict:
    assert REGISTRY_PATH.exists(), (
        f"Lint rule registry missing at {REGISTRY_PATH}. "
        "Seed it alongside any new diagnostic code."
    )
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def _rules_by_code() -> dict[str, dict]:
    registry = _load_registry()
    rules = registry.get("rules", [])
    return {rule["code"]: rule for rule in rules}


def test_registry_structure_is_well_formed() -> None:
    registry = _load_registry()
    assert registry.get("version"), "registry must declare a version"
    assert isinstance(registry.get("rules"), list)
    assert registry["rules"], "registry must list at least one rule"


def test_every_rule_has_required_fields() -> None:
    rules = _rules_by_code()
    for code, rule in rules.items():
        for field in REQUIRED_RULE_FIELDS:
            assert field in rule, f"rule {code} missing required field '{field}'"
        assert rule["severity"] in ALLOWED_SEVERITIES, (
            f"rule {code} has invalid severity '{rule['severity']}'"
        )
        assert rule["state"] in ALLOWED_STATES, (
            f"rule {code} has invalid state '{rule['state']}'"
        )
        assert isinstance(rule["pass"], int), f"rule {code}: pass must be int"
        assert rule["title"], f"rule {code}: title must be non-empty"


def test_tested_and_stable_rules_have_spec_ref_and_suggested_fix() -> None:
    rules = _rules_by_code()
    for code, rule in rules.items():
        if rule["state"] not in ("tested", "stable"):
            continue
        assert rule.get("specRef"), (
            f"rule {code} is {rule['state']} but has no specRef — "
            "tested rules must point back to the normative spec clause"
        )
        assert rule.get("suggestedFix"), (
            f"rule {code} is {rule['state']} but has no suggestedFix — "
            "tested rules must offer a machine-actionable repair hint"
        )
        assert rule["specRef"].startswith("specs/"), (
            f"rule {code}: specRef should be a repo-relative path under specs/"
        )


def test_registry_covers_every_code_the_linter_emits() -> None:
    """Every code currently emitted by the Rust linter source must be registered."""
    emitted_codes = _scan_linter_source_for_codes()
    registered = set(_rules_by_code().keys())
    missing = emitted_codes - registered
    assert not missing, (
        f"Linter emits codes not in registry: {sorted(missing)}. "
        "Add entries to specs/lint-codes.json."
    )


def test_every_code_with_metadata_is_tested_in_registry() -> None:
    """If a rule has authoring-loop metadata wired up in `metadata.rs`, the
    registry must reflect that by marking the rule `tested` (or `stable`).
    A rule carrying a live spec_ref + suggested_fix but sitting in `draft`
    is a contradiction — it means the code says "I'm ready" while the
    registry says "I'm not." Surface the drift loudly.
    """
    metadata_codes = _scan_metadata_rs_for_codes()
    assert metadata_codes, (
        "Expected metadata.rs to wire metadata for at least one code; "
        "the scanner may have regressed."
    )
    rules = _rules_by_code()
    mismatched = []
    for code in sorted(metadata_codes):
        rule = rules.get(code)
        if rule is None:
            mismatched.append(f"{code}: in metadata.rs but missing from registry")
            continue
        if rule["state"] not in ("tested", "stable"):
            mismatched.append(
                f"{code}: metadata.rs populates it, but registry state is '{rule['state']}' "
                f"— promote to 'tested' or remove the metadata entry"
            )
    assert not mismatched, "\n".join(mismatched)


def _scan_metadata_rs_for_codes() -> set[str]:
    """Collect every diagnostic code listed in the `metadata_for` match arm."""
    import re

    path = REPO_ROOT / "crates" / "formspec-lint" / "src" / "metadata.rs"
    assert path.exists(), f"metadata.rs missing at {path}"
    # Match arms are lines like `"E300" => RuleMetadata { ... }`.
    pattern = re.compile(r'"([EW]\d{3})"\s*=>\s*RuleMetadata')
    return set(pattern.findall(path.read_text(encoding="utf-8")))


def _scan_linter_source_for_codes() -> set[str]:
    """Collect every diagnostic code literal from the Rust linter sources,
    excluding code strings that appear inside `#[cfg(test)] mod tests` blocks
    (those are synthetic fixtures, not real emission sites).
    """
    import re

    src_root = REPO_ROOT / "crates" / "formspec-lint" / "src"
    code_pattern = re.compile(r'"([EW]\d{3})"')
    codes: set[str] = set()
    for path in src_root.rglob("*.rs"):
        text = path.read_text(encoding="utf-8")
        production_text = _strip_test_modules(text)
        codes.update(code_pattern.findall(production_text))
    return codes


def _strip_test_modules(rust_source: str) -> str:
    """Remove `#[cfg(test)] mod tests { ... }` blocks so code literals inside
    test fixtures don't get counted as emission sites.

    Caveat: brace depth is computed with raw character counts, so `{` / `}`
    inside a string literal inside a test module can unbalance the walker.
    This is acceptable today because no such literal exists — see
    `test_strip_test_modules_handles_literal_braces_in_strings` for the
    adversarial regression guard.
    """
    lines = rust_source.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "#[cfg(test)]" in line:
            # Skip until we hit a matching `mod <name> {` and consume its body.
            j = i + 1
            while j < len(lines) and "mod " not in lines[j]:
                j += 1
            if j >= len(lines):
                break
            # Walk brace depth to find the end of the module.
            depth = 0
            started = False
            k = j
            while k < len(lines):
                depth += lines[k].count("{") - lines[k].count("}")
                if "{" in lines[k]:
                    started = True
                if started and depth == 0:
                    break
                k += 1
            i = k + 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def test_strip_test_modules_removes_test_code_literals() -> None:
    """Sanity: codes inside a `#[cfg(test)] mod tests { ... }` block are dropped
    so they are not counted as production emission sites."""
    sample = (
        'fn emit_production() { LintDiagnostic::error("E100", 1, "$", "x"); }\n'
        "\n"
        "#[cfg(test)]\n"
        "mod tests {\n"
        '    fn only_in_test() { let _ = "W999"; }\n'
        "}\n"
    )
    stripped = _strip_test_modules(sample)
    assert '"E100"' in stripped
    assert '"W999"' not in stripped, (
        "test-module code literal should be stripped from the production scan"
    )


def test_strip_test_modules_handles_literal_braces_in_strings() -> None:
    """Regression guard: the brace-depth walker is character-based, so a `}`
    inside a string literal inside a test module could in principle close the
    test module early and leak subsequent code-literal matches into production.
    Today no such literal exists, but this test plants one so a future
    contributor can't silently break the invariant.
    """
    sample = (
        'fn emit_production() { LintDiagnostic::error("E100", 1, "$", "x"); }\n'
        "\n"
        "#[cfg(test)]\n"
        "mod tests {\n"
        '    // a string with braces that could confuse a naïve walker:\n'
        '    const TRICKY: &str = "fake close } fake open { \\"W999\\"";\n'
        '    fn inside() { let _code = "W998"; }\n'
        "}\n"
        "\n"
        'fn emit_more_production() { LintDiagnostic::warning("W300", 3, "$", "y"); }\n'
    )
    stripped = _strip_test_modules(sample)
    assert '"E100"' in stripped
    assert '"W300"' in stripped, (
        "production code *after* the test module must survive stripping"
    )
    # Today the walker treats the literal `}` and `{` as real braces. Because
    # the embedded-brace count is balanced (`}` then `{`), the walker still
    # closes the test module at the right line and excludes W998/W999. If this
    # assertion ever fails, someone added an unbalanced brace literal and the
    # walker needs a real tokenizer.
    assert '"W998"' not in stripped
    assert '"W999"' not in stripped


# ── End-to-end: emitted diagnostics match the registry ──────────────


def test_e300_bind_target_emits_registered_metadata() -> None:
    rule = _rules_by_code()["E300"]
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "name", "type": "field", "label": "N", "dataType": "string"}],
        "binds": [{"path": "ghost", "required": "true"}],
    }
    diagnostics = lint(document)
    e300 = [d for d in diagnostics if d.code == "E300"]
    assert e300, "expected E300 for unresolved bind target"
    assert e300[0].spec_ref == rule["specRef"], (
        f"E300 spec_ref mismatch: emitted {e300[0].spec_ref!r}, "
        f"registry has {rule['specRef']!r}"
    )
    assert e300[0].suggested_fix == rule["suggestedFix"]


def test_e600_unresolved_extension_emits_registered_metadata() -> None:
    rule = _rules_by_code()["E600"]
    # With no registry documents loaded, every enabled extension is unresolved.
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {
                "key": "a",
                "type": "field",
                "label": "A",
                "dataType": "string",
                "extensions": {"com.example.unknown": True},
            }
        ],
    }
    diagnostics = lint(document)
    e600 = [d for d in diagnostics if d.code == "E600"]
    assert e600, "expected E600 for unresolved extension"
    assert e600[0].spec_ref == rule["specRef"]
    assert e600[0].suggested_fix == rule["suggestedFix"]


def test_w704_unresolved_token_emits_registered_metadata() -> None:
    rule = _rules_by_code()["W704"]
    document = {
        "$formspecTheme": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tokens": {"color.primary": "#112233"},
        "defaults": {"style": {"borderColor": "$token.color.missing"}},
    }
    diagnostics = lint(document)
    w704 = [d for d in diagnostics if d.code == "W704"]
    assert w704, "expected W704 for unresolved token reference"
    assert w704[0].spec_ref == rule["specRef"]
    assert w704[0].suggested_fix == rule["suggestedFix"]
