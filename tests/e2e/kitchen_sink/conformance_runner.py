#!/usr/bin/env python3
"""Kitchen-sink conformance runner for ADR-0021.

This runner covers static/schema + runtime-tooling phases:
- Phase 0: schema contract validation
- Phase 1: semantic/lint validation + negative fixtures
- Phase 5: mapping forward/reverse checks
- Phase 6: extension registry checks
- Phase 7: changelog/migration impact checks

Browser/runtime interaction phases (2/3/4) are covered by Playwright/browser suites.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from formspec.changelog import generate_changelog
from formspec.mapping import MappingEngine
from formspec.registry import Registry, validate_lifecycle_transition
from formspec.validator.linter import FormspecLinter
from formspec.validator.policy import LintPolicy
from formspec.validator.schema import SchemaValidator


ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = ROOT / "tests" / "e2e" / "fixtures" / "kitchen-sink-holistic"


@dataclass
class CheckResult:
    check_id: str
    phase: str
    matrix_sections: list[str]
    ks_ids: list[str]
    status: str  # pass | fail | skip
    detail: str
    evidence: dict[str, Any] | None = None


class Runner:
    def __init__(self) -> None:
        self.schema_validator = SchemaValidator()
        self.linter = FormspecLinter(policy=LintPolicy(mode="strict"))
        self.checks: list[CheckResult] = []

    def add(
        self,
        *,
        check_id: str,
        phase: str,
        matrix_sections: list[str],
        ks_ids: list[str],
        status: str,
        detail: str,
        evidence: dict[str, Any] | None = None,
    ) -> None:
        self.checks.append(
            CheckResult(
                check_id=check_id,
                phase=phase,
                matrix_sections=matrix_sections,
                ks_ids=ks_ids,
                status=status,
                detail=detail,
                evidence=evidence,
            )
        )

    def load_fixture(self, name: str) -> dict[str, Any]:
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def phase_0_schema_validation(self) -> None:
        fixtures: list[tuple[str, str]] = [
            ("definition.v1.json", "definition"),
            ("definition.v2.json", "definition"),
            ("theme.json", "theme"),
            ("component.json", "component"),
            ("mapping.json", "mapping"),
            ("registry.json", "registry"),
            ("changelog.json", "changelog"),
        ]

        for fixture_name, doc_type in fixtures:
            doc = self.load_fixture(fixture_name)
            result = self.schema_validator.validate(doc, document_type=doc_type)
            if result.errors:
                self.add(
                    check_id=f"P0-{doc_type.upper()}-SCHEMA",
                    phase="phase_0",
                    matrix_sections=["1", "2", "3", "5", "6", "7", "8", "9"],
                    ks_ids=["KS-066"],
                    status="fail",
                    detail=f"{fixture_name} failed schema validation",
                    evidence={"diagnostics": [d.message for d in result.diagnostics[:10]]},
                )
            else:
                self.add(
                    check_id=f"P0-{doc_type.upper()}-SCHEMA",
                    phase="phase_0",
                    matrix_sections=["1", "2", "3", "5", "6", "7", "8", "9"],
                    ks_ids=["KS-066"],
                    status="pass",
                    detail=f"{fixture_name} is schema-valid",
                )

    def phase_1_lint_and_negative(self) -> None:
        definition = self.load_fixture("definition.v1.json")
        theme = self.load_fixture("theme.json")
        component = self.load_fixture("component.json")

        # Positive lint checks
        for label, doc, kwargs in [
            ("definition", definition, {}),
            ("theme", theme, {}),
            ("component", component, {"component_definition": definition}),
        ]:
            diagnostics = self.linter.lint(doc, **kwargs)
            errors = [d for d in diagnostics if d.severity == "error"]
            tolerated_codes: set[str] = set()
            if label == "component":
                # Accepted strict-mode trade-offs from the feature matrix.
                tolerated_codes = {"W800", "W802"}
            blocking_errors = [d for d in errors if d.code not in tolerated_codes]

            if errors and not blocking_errors:
                self.add(
                    check_id=f"P1-{label.upper()}-LINT",
                    phase="phase_1",
                    matrix_sections=["1.9", "10"],
                    ks_ids=["KS-066"],
                    status="pass",
                    detail=f"{label} lint passed with accepted strict-mode trade-off diagnostics",
                    evidence={"tolerated_codes": [d.code for d in errors]},
                )
            elif blocking_errors:
                self.add(
                    check_id=f"P1-{label.upper()}-LINT",
                    phase="phase_1",
                    matrix_sections=["1.9", "10"],
                    ks_ids=["KS-066"],
                    status="fail",
                    detail=f"{label} lint produced strict-mode errors",
                    evidence={"codes": [d.code for d in blocking_errors[:10]]},
                )
            else:
                self.add(
                    check_id=f"P1-{label.upper()}-LINT",
                    phase="phase_1",
                    matrix_sections=["1.9", "10"],
                    ks_ids=["KS-066"],
                    status="pass",
                    detail=f"{label} lint passed in strict mode",
                )

        # Negative fixtures from ADR section 13.3
        circular_def = {
            "$formspec": "1.0",
            "url": "https://example.org/forms/negative-cycle",
            "version": "1.0.0",
            "status": "draft",
            "title": "Cycle",
            "items": [
                {"key": "a", "type": "field", "label": "A", "dataType": "decimal"},
                {"key": "b", "type": "field", "label": "B", "dataType": "decimal"},
            ],
            "binds": [
                {"path": "a", "calculate": "b + 1"},
                {"path": "b", "calculate": "a + 1"},
            ],
        }
        circular_diags = self.linter.lint(circular_def)
        has_cycle = any(d.code == "E500" for d in circular_diags)
        self.add(
            check_id="P1-NEG-CYCLE",
            phase="phase_1",
            matrix_sections=["1.9", "10"],
            ks_ids=["KS-069"],
            status="pass" if has_cycle else "fail",
            detail="Cycle detection negative fixture",
            evidence={"codes": [d.code for d in circular_diags]},
        )

        unresolved_refs_def = {
            "$formspec": "1.0",
            "url": "https://example.org/forms/negative-refs",
            "version": "1.0.0",
            "status": "draft",
            "title": "Refs",
            "items": [{"key": "x", "type": "field", "label": "X", "dataType": "string"}],
            "binds": [{"path": "missing", "required": "true"}],
            "shapes": [{"id": "s1", "target": "missing", "message": "bad", "constraint": "true"}],
        }
        unresolved_diags = self.linter.lint(unresolved_refs_def)
        has_ref_error = any(d.code in {"E300", "E301"} for d in unresolved_diags)
        self.add(
            check_id="P1-NEG-UNRESOLVED-REF",
            phase="phase_1",
            matrix_sections=["1.5", "1.6", "10"],
            ks_ids=["KS-066"],
            status="pass" if has_ref_error else "fail",
            detail="Unresolved bind/shape target negative fixture",
            evidence={"codes": [d.code for d in unresolved_diags]},
        )

        bad_component = {
            "$formspecComponent": "1.0",
            "version": "1.0.0",
            "targetDefinition": {"url": definition["url"]},
            "tree": {"component": "TextInput", "bind": "fullName"},
        }
        bad_component_diags = self.linter.lint(bad_component, component_definition=definition)
        has_component_error = any(d.code == "E800" for d in bad_component_diags)
        self.add(
            check_id="P1-NEG-COMPONENT-ROOT",
            phase="phase_1",
            matrix_sections=["6.2", "10"],
            ks_ids=["KS-066"],
            status="pass" if has_component_error else "fail",
            detail="Component root category negative fixture",
            evidence={"codes": [d.code for d in bad_component_diags]},
        )

        # Invalid structural contracts (mapping/registry/changelog)
        invalid_mapping = {"version": "1.0.0", "rules": []}
        invalid_registry = {"$formspecRegistry": "1.0", "entries": []}
        invalid_changelog = {
            "definitionUrl": definition["url"],
            "fromVersion": "1.0.0",
            "toVersion": "2.0.0",
            "semverImpact": "major",
            "changes": [{"type": "added", "target": "item", "path": "items.x"}],
        }
        negatives = [
            ("mapping", invalid_mapping),
            ("registry", invalid_registry),
            ("changelog", invalid_changelog),
        ]
        for doc_type, doc in negatives:
            result = self.schema_validator.validate(doc, document_type=doc_type)
            self.add(
                check_id=f"P1-NEG-{doc_type.upper()}-STRUCTURE",
                phase="phase_1",
                matrix_sections=["7", "8", "9", "10"],
                ks_ids=["KS-066"],
                status="pass" if result.errors else "fail",
                detail=f"Invalid {doc_type} structural contract fixture",
                evidence={"error_count": len(result.errors)},
            )

    def phase_5_mapping(self) -> None:
        mapping_doc = self.load_fixture("mapping.json")
        engine = MappingEngine(mapping_doc)

        response_data = {
            "fullName": "Shelley Agent",
            "profileMode": "advanced",
            "budget": 500,
            "tags": ["new", "priority"],
            "lineItems": [
                {"lineName": "Laptop", "lineQty": 2, "linePrice": 100, "lineSubtotal": 200},
                {"lineName": "Monitor", "lineQty": 1, "linePrice": 50, "lineSubtotal": 50},
            ],
            "vipEnabled": True,
            "vipCode": "VIP-9",
            "hiddenMirror": "hidden",
        }

        forward = engine.forward(response_data)
        checks = [
            ("subject.name", forward.get("subject", {}).get("name") == "Shelley Agent"),
            ("subject.mode", forward.get("subject", {}).get("mode") == "ADV"),
            ("finance.budget", float(forward.get("finance", {}).get("budget", 0)) == 500.0),
            ("subject.vip", forward.get("subject", {}).get("vip") == "VIP-9"),
            ("drop.hiddenMirror", "hiddenMirror" not in json.dumps(forward)),
        ]

        failed = [name for name, ok in checks if not ok]
        self.add(
            check_id="P5-MAPPING-FORWARD",
            phase="phase_5",
            matrix_sections=["7"],
            ks_ids=["KS-052", "KS-056"],
            status="pass" if not failed else "fail",
            detail="Forward mapping execution",
            evidence={"failed_checks": failed, "forward": forward},
        )

        reverse_input = {
            "subject": {"name": "Shelley Agent", "mode": "ADV", "vip": "VIP-9"},
            "finance": {"budget": 500},
            "items": response_data["lineItems"],
            "meta": {"version": "1"},
        }
        reverse = engine.reverse(reverse_input)
        reverse_ok = reverse.get("fullName") == "Shelley Agent" and reverse.get("profileMode") == "advanced"
        self.add(
            check_id="P5-MAPPING-REVERSE",
            phase="phase_5",
            matrix_sections=["7"],
            ks_ids=["KS-054", "KS-055"],
            status="pass" if reverse_ok else "fail",
            detail="Reverse mapping execution",
            evidence={"reverse": reverse},
        )

    def phase_6_registry(self) -> None:
        registry_doc = self.load_fixture("registry.json")
        registry = Registry(registry_doc)
        errors = registry.validate()

        self.add(
            check_id="P6-REGISTRY-VALIDATE",
            phase="phase_6",
            matrix_sections=["8"],
            ks_ids=["KS-057", "KS-058"],
            status="pass" if not errors else "fail",
            detail="Registry semantic validation",
            evidence={"errors": errors},
        )

        # Additional lifecycle checks not representable in JSON Schema
        lifecycle_ok = (
            validate_lifecycle_transition("draft", "stable")
            and validate_lifecycle_transition("stable", "deprecated")
            and not validate_lifecycle_transition("retired", "stable")
        )
        self.add(
            check_id="P6-REGISTRY-LIFECYCLE",
            phase="phase_6",
            matrix_sections=["8"],
            ks_ids=["KS-058"],
            status="pass" if lifecycle_ok else "fail",
            detail="Registry lifecycle transition checks",
        )

        # Enforce uniqueness of (name, version) pair as compensating check.
        pairs = [(e["name"], e["version"]) for e in registry_doc["entries"]]
        unique_pairs = len(set(pairs)) == len(pairs)
        self.add(
            check_id="P6-REGISTRY-UNIQUE-PAIR",
            phase="phase_6",
            matrix_sections=["8"],
            ks_ids=["KS-059"],
            status="pass" if unique_pairs else "fail",
            detail="Registry (name, version) uniqueness check",
        )

    def phase_7_changelog(self) -> None:
        definition_v1 = self.load_fixture("definition.v1.json")
        definition_v2 = self.load_fixture("definition.v2.json")
        declared_changelog = self.load_fixture("changelog.json")

        # Validate declared changelog fixture
        declared_validation = self.schema_validator.validate(declared_changelog, document_type="changelog")
        self.add(
            check_id="P7-CHANGELOG-SCHEMA",
            phase="phase_7",
            matrix_sections=["9"],
            ks_ids=["KS-060"],
            status="pass" if not declared_validation.errors else "fail",
            detail="Declared changelog schema validation",
            evidence={"error_count": len(declared_validation.errors)},
        )

        generated = generate_changelog(definition_v1, definition_v2, definition_v1["url"])
        generated_validation = self.schema_validator.validate(generated, document_type="changelog")
        self.add(
            check_id="P7-CHANGELOG-GENERATED-SCHEMA",
            phase="phase_7",
            matrix_sections=["9"],
            ks_ids=["KS-060", "KS-061"],
            status="pass" if not generated_validation.errors else "fail",
            detail="Generated changelog schema validation",
            evidence={"error_count": len(generated_validation.errors)},
        )

        def expected_semver(changes: list[dict[str, Any]]) -> str:
            if any(c.get("impact") == "breaking" for c in changes):
                return "major"
            if any(c.get("impact") == "compatible" for c in changes):
                return "minor"
            return "patch"

        declared_ok = declared_changelog.get("semverImpact") == expected_semver(declared_changelog.get("changes", []))
        generated_ok = generated.get("semverImpact") == expected_semver(generated.get("changes", []))

        self.add(
            check_id="P7-CHANGELOG-IMPACT-CONSISTENCY",
            phase="phase_7",
            matrix_sections=["9"],
            ks_ids=["KS-060"],
            status="pass" if (declared_ok and generated_ok) else "fail",
            detail="Changelog semverImpact consistency",
            evidence={
                "declared": declared_changelog.get("semverImpact"),
                "declared_expected": expected_semver(declared_changelog.get("changes", [])),
                "generated": generated.get("semverImpact"),
                "generated_expected": expected_semver(generated.get("changes", [])),
            },
        )

    def run(self) -> dict[str, Any]:
        self.phase_0_schema_validation()
        self.phase_1_lint_and_negative()
        self.phase_5_mapping()
        self.phase_6_registry()
        self.phase_7_changelog()

        by_status = {"pass": 0, "fail": 0, "skip": 0}
        for check in self.checks:
            by_status[check.status] = by_status.get(check.status, 0) + 1

        return {
            "generatedAt": datetime.now(UTC).isoformat(),
            "runner": "python-kitchen-sink-conformance",
            "fixtures": str(FIXTURE_DIR.relative_to(ROOT)),
            "summary": {
                "total": len(self.checks),
                "pass": by_status.get("pass", 0),
                "fail": by_status.get("fail", 0),
                "skip": by_status.get("skip", 0),
            },
            "checks": [asdict(check) for check in self.checks],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ADR-0021 kitchen-sink conformance phases (python-side).")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/formspec-kitchen-sink-python-report.json"),
        help="Output report path (default: /tmp/formspec-kitchen-sink-python-report.json)",
    )
    args = parser.parse_args()

    runner = Runner()
    report = runner.run()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], indent=2))
    print(f"report: {args.output}")

    return 1 if report["summary"]["fail"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
