#!/usr/bin/env python3
"""Formspec benchmark runner.

Commands:
    python3 benchmarks/run_benchmark.py list
    python3 benchmarks/run_benchmark.py score <task_id> <candidate_dir>

The benchmark measures whether an LLM (or a human) can translate a
natural-language requirement into a Formspec artifact set that passes the
Python validator. Each task ships a `requirement.md` (the prompt) and a
`reference/` directory (the known-good answer). The runner invokes the
validator as a subprocess and reports a score.

Scoring (deliberately simple, easy to change later):
    - validates cleanly -> 1.0
    - otherwise          -> max(0, 1 - totalErrors / 10)

Only stdlib imports — keep this file boring and portable.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

BENCHMARKS_DIR = Path(__file__).resolve().parent
REPO_ROOT = BENCHMARKS_DIR.parent
TASKS_DIR = BENCHMARKS_DIR / "tasks"
DEFAULT_REGISTRY = REPO_ROOT / "registries" / "formspec-common.registry.json"
MAX_DIAGNOSTICS_RETURNED = 10
ERROR_SATURATION = 10  # errors at which score bottoms out at 0.0

# Import the canonical pass title directly so a rename in validate.py breaks
# this runner at import time (loud failure) rather than silently scoring every
# candidate as 0.0.
sys.path.insert(0, str(REPO_ROOT / "src"))
from formspec.validate import DEFINITION_LINTING_TITLE  # noqa: E402


def iter_task_ids() -> list[str]:
    if not TASKS_DIR.is_dir():
        return []
    return sorted(p.name for p in TASKS_DIR.iterdir() if p.is_dir())


def load_task_summary(task_id: str) -> dict:
    """Return requirement summary + meta for listing purposes."""
    task_dir = TASKS_DIR / task_id
    requirement = (task_dir / "requirement.md").read_text().strip()
    summary = next(
        (line.strip() for line in requirement.splitlines() if line.strip()),
        "(no requirement prose)",
    )
    meta_path = task_dir / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.is_file() else {}
    return {
        "id": task_id,
        "difficulty": meta.get("difficulty", "?"),
        "summary": summary,
        "feature_tags": meta.get("feature_tags", []),
    }


def run_validator(candidate_dir: Path, registry: Path) -> dict:
    """Invoke the Formspec validator CLI and return the parsed JSON report."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "formspec.validate",
            str(candidate_dir),
            "--registry",
            str(registry),
            "--json",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if not result.stdout:
        raise RuntimeError(
            f"validator produced no stdout (exit={result.returncode}): {result.stderr.strip()}"
        )
    return json.loads(result.stdout)


def collect_top_diagnostics(report: dict, limit: int) -> list[dict]:
    """Flatten diagnostics across all passes, preserving order, cap at `limit`."""
    top: list[dict] = []
    for pass_result in report.get("passes", []):
        for item in pass_result.get("items", []):
            for diag in item.get("diagnostics", []):
                if diag.get("severity") == "error":
                    top.append({"pass": pass_result.get("title"), **diag})
                    if len(top) >= limit:
                        return top
            for runtime in item.get("runtimeResults", []):
                if runtime.get("severity") == "error":
                    top.append({"pass": pass_result.get("title"), **runtime})
                    if len(top) >= limit:
                        return top
    return top


def score_from_errors(total_errors: int) -> float:
    if total_errors <= 0:
        return 1.0
    return max(0.0, 1.0 - total_errors / ERROR_SATURATION)


def score_task(task_id: str, candidate_dir: Path, registry: Path) -> dict:
    if task_id not in iter_task_ids():
        raise SystemExit(f"unknown task id: {task_id!r}. Known: {iter_task_ids()}")
    if not candidate_dir.is_dir():
        raise SystemExit(f"candidate dir does not exist: {candidate_dir}")

    report = run_validator(candidate_dir, registry)
    total_errors = int(report.get("totalErrors", 0))
    # The validator's "Definition linting" pass is marked `empty` when no definition
    # document was discovered. A candidate with no definition cannot meaningfully
    # "validate clean" — treat it as a full failure so empty dirs don't score 1.0.
    definition_pass = next(
        (p for p in report.get("passes", []) if p.get("title") == DEFINITION_LINTING_TITLE),
        None,
    )
    has_definition = bool(definition_pass and not definition_pass.get("empty", True))
    validates = has_definition and bool(report.get("valid", False)) and total_errors == 0
    return {
        "taskId": task_id,
        "validates": validates,
        "totalErrors": total_errors,
        "hasDefinition": has_definition,
        "diagnostics": collect_top_diagnostics(report, MAX_DIAGNOSTICS_RETURNED),
        "score": 1.0 if validates else (0.0 if not has_definition else score_from_errors(total_errors)),
    }


def cmd_list(_args: argparse.Namespace) -> int:
    ids = iter_task_ids()
    if not ids:
        print("(no tasks registered in benchmarks/tasks/)", file=sys.stderr)
        return 1
    for task_id in ids:
        info = load_task_summary(task_id)
        print(f"{info['id']}  [{info['difficulty']}]  {info['summary']}")
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    result = score_task(args.task_id, Path(args.candidate_dir).resolve(), args.registry)
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_benchmark",
        description="Run the Formspec requirement-to-form benchmark.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="List all benchmark tasks.")
    list_parser.set_defaults(func=cmd_list)

    score_parser = subparsers.add_parser(
        "score", help="Score a candidate directory against a task's reference."
    )
    score_parser.add_argument("task_id")
    score_parser.add_argument("candidate_dir")
    score_parser.add_argument(
        "--registry",
        type=Path,
        default=DEFAULT_REGISTRY,
        help=f"Registry JSON path (default: {DEFAULT_REGISTRY})",
    )
    score_parser.set_defaults(func=cmd_score)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
