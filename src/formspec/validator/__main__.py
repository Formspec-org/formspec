"""CLI entry point for the Formspec linter."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .diagnostic import LintDiagnostic
from .linter import FormspecLinter
from .policy import make_policy

_SEVERITY_RANK = {"info": 0, "warning": 1, "error": 2}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="formspec-lint",
        description="Lint Formspec JSON documents",
    )
    parser.add_argument("files", nargs="+", help="JSON file(s) to lint")
    parser.add_argument(
        "--format",
        choices=["text", "json", "github"],
        default="text",
        help="Output format",
    )
    parser.add_argument(
        "--severity",
        choices=["error", "warning", "info"],
        default="info",
        help="Minimum severity to report",
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Only run schema validation",
    )
    parser.add_argument(
        "--no-fel",
        action="store_true",
        help="Skip FEL compilation and dependency checks",
    )
    parser.add_argument(
        "--mode",
        choices=["authoring", "strict"],
        default="authoring",
        help="Lint policy mode",
    )
    parser.add_argument(
        "--definition",
        help="Optional Formspec definition JSON file used for component bind/compatibility checks",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    linter = FormspecLinter(policy=make_policy(args.mode))
    component_definition = None

    if args.definition:
        definition_path = Path(args.definition)
        if not definition_path.exists():
            print(f"{args.definition}: file not found", file=sys.stderr)
            return 2
        try:
            loaded = json.loads(definition_path.read_text())
        except json.JSONDecodeError as exc:
            print(f"{args.definition}: invalid JSON ({exc})", file=sys.stderr)
            return 2
        if not isinstance(loaded, dict):
            print(f"{args.definition}: JSON root must be an object", file=sys.stderr)
            return 2
        component_definition = loaded

    output_rows: list[dict] = []
    had_errors = False

    for file_name in args.files:
        path = Path(file_name)
        if not path.exists():
            print(f"{file_name}: file not found", file=sys.stderr)
            return 2

        try:
            document = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            print(f"{file_name}: invalid JSON ({exc})", file=sys.stderr)
            return 2

        diagnostics = linter.lint(
            document,
            schema_only=args.schema_only,
            no_fel=args.no_fel,
            component_definition=component_definition,
        )
        filtered = [
            diag
            for diag in diagnostics
            if _SEVERITY_RANK[diag.severity] >= _SEVERITY_RANK[args.severity]
        ]

        counts = {
            "error": sum(1 for diag in diagnostics if diag.severity == "error"),
            "warning": sum(1 for diag in diagnostics if diag.severity == "warning"),
            "info": sum(1 for diag in diagnostics if diag.severity == "info"),
        }

        if counts["error"] > 0:
            had_errors = True

        output_rows.append(
            {
                "file": file_name,
                "mode": args.mode,
                "diagnostics": filtered,
                "counts": counts,
            }
        )

    _print_output(args.format, output_rows)
    return 1 if had_errors else 0


def _print_output(output_format: str, rows: list[dict]) -> None:
    if output_format == "json":
        json_rows = []
        for row in rows:
            json_rows.append(
                {
                    "file": row["file"],
                    "mode": row["mode"],
                    "diagnostics": [_diag_to_json(d) for d in row["diagnostics"]],
                    "counts": row["counts"],
                }
            )
        if len(json_rows) == 1:
            print(json.dumps(json_rows[0], indent=2))
        else:
            print(json.dumps(json_rows, indent=2))
        return

    if output_format == "github":
        for row in rows:
            file_name = row["file"]
            for diag in row["diagnostics"]:
                print(
                    f"::{diag.severity} file={file_name}::{diag.code} {diag.message} ({diag.path})"
                )
        return

    for row in rows:
        file_name = row["file"]
        diagnostics = row["diagnostics"]
        if not diagnostics:
            print(f"{file_name}: no diagnostics")
            continue
        for diag in diagnostics:
            print(f"{file_name}:{diag.path}: {diag.severity} {diag.code} {diag.message}")


def _diag_to_json(diag: LintDiagnostic) -> dict:
    payload = {
        "severity": diag.severity,
        "code": diag.code,
        "message": diag.message,
        "path": diag.path,
        "category": diag.category,
    }
    if diag.detail:
        payload["detail"] = diag.detail
    return payload


if __name__ == "__main__":
    raise SystemExit(main())
