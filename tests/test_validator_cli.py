from __future__ import annotations

import json

from formspec.validator.__main__ import main


def test_cli_json_output_and_exit_code(tmp_path, capsys) -> None:
    form_file = tmp_path / "form.json"
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

    code = main([str(form_file), "--format", "json"])
    captured = capsys.readouterr()

    assert code == 0
    payload = json.loads(captured.out)
    assert payload["file"] == str(form_file)
    assert payload["mode"] == "authoring"
    assert payload["counts"]["error"] == 0


def test_cli_invalid_json_returns_2(tmp_path) -> None:
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("{not-json")

    code = main([str(bad_file)])

    assert code == 2


def test_cli_strict_mode_escalates_warnings(tmp_path) -> None:
    component_file = tmp_path / "component.json"
    component_file.write_text(
        json.dumps(
            {
                "$formspecComponent": "1.0",
                "version": "1.0.0",
                "targetDefinition": {"url": "https://example.com/forms/x"},
                "tree": {
                    "component": "Stack",
                    "children": [{"component": "TextInput", "bind": "missing"}],
                },
            }
        )
    )

    authoring_code = main([str(component_file), "--mode", "authoring"])
    strict_code = main([str(component_file), "--mode", "strict"])

    assert authoring_code == 0
    assert strict_code == 1


def test_cli_definition_file_enables_component_compatibility_checks(tmp_path) -> None:
    component_file = tmp_path / "component.json"
    component_file.write_text(
        json.dumps(
            {
                "$formspecComponent": "1.0",
                "version": "1.0.0",
                "targetDefinition": {"url": "https://example.com/forms/x"},
                "tree": {
                    "component": "Stack",
                    "children": [{"component": "TextInput", "bind": "a"}],
                },
            }
        )
    )
    definition_file = tmp_path / "definition.json"
    definition_file.write_text(
        json.dumps(
            {
                "$formspec": "1.0",
                "url": "https://example.com/forms/x",
                "version": "1.0.0",
                "status": "draft",
                "title": "X",
                "items": [
                    {"key": "a", "type": "field", "label": "A", "dataType": "integer"},
                ],
            }
        )
    )

    authoring_code = main(
        [str(component_file), "--definition", str(definition_file), "--mode", "authoring"]
    )
    strict_code = main(
        [str(component_file), "--definition", str(definition_file), "--mode", "strict"]
    )

    assert authoring_code == 0
    assert strict_code == 1
