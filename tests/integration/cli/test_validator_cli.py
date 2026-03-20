"""Tests for the formspec.validate CLI (directory-based validator).

The old formspec.validator.__main__ single-file CLI has been replaced by
formspec.validate which auto-discovers and validates all Formspec JSON
artifacts in a directory.
"""
from __future__ import annotations

import json
from pathlib import Path

from formspec.validate import main


def test_cli_valid_directory_returns_zero(tmp_path) -> None:
    """A directory with a valid definition should return exit code 0."""
    form_file = tmp_path / "definition.json"
    form_file.write_text(
        json.dumps(
            {
                "$formspec": "1.0",
                "url": "https://example.com/forms/x",
                "version": "1.0.0",
                "status": "draft",
                "title": "X",
                "items": [
                    {"key": "a", "type": "field", "label": "A", "dataType": "integer"}
                ],
            }
        )
    )

    code = main([str(tmp_path)])
    assert code == 0


def test_cli_nonexistent_directory_returns_2(tmp_path) -> None:
    """A nonexistent directory should return exit code 2."""
    code = main([str(tmp_path / "nonexistent")])
    assert code == 2


def test_cli_empty_directory_returns_zero(tmp_path) -> None:
    """An empty directory (no artifacts) should return exit code 0."""
    code = main([str(tmp_path)])
    assert code == 0


def test_cli_invalid_json_file_is_skipped(tmp_path) -> None:
    """Files that aren't valid JSON should be skipped (not crash)."""
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("{not-json")

    code = main([str(tmp_path)])
    # Should not crash; bad JSON files are silently skipped
    assert code in (0, 1)  # may be 0 (no artifacts found) or 1 (report error)
