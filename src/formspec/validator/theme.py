"""Theme-specific semantic linting."""

from __future__ import annotations

import re
from collections.abc import Iterator

from .diagnostic import LintDiagnostic

_TOKEN_REF_RE = re.compile(r"\$token\.([A-Za-z0-9_.-]+)")
_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_RGB_HSL_RE = re.compile(r"^(?:rgb|rgba|hsl|hsla)\([^\)]*\)$")
_CSS_LENGTH_RE = re.compile(r"^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|rem|em|vw|vh|%|ch|ex|cm|mm|in|pt|pc))$")
_UNITLESS_NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def lint_theme_semantics(document: dict) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []

    tokens = document.get("tokens")
    token_map = tokens if isinstance(tokens, dict) else {}

    diagnostics.extend(_validate_token_values(token_map))
    diagnostics.extend(_validate_token_references(document, token_map))

    return diagnostics


def _validate_token_values(tokens: dict[str, object]) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []

    for token_name, token_value in tokens.items():
        path = _token_path(token_name)

        if _is_color_token(token_name):
            if not isinstance(token_value, str) or not _is_color_value(token_value):
                diagnostics.append(
                    LintDiagnostic(
                        severity="warning",
                        code="W700",
                        message=f"Token '{token_name}' must be a valid color value",
                        path=path,
                        category="theme",
                    )
                )
            continue

        if _is_spacing_or_size_token(token_name):
            if not _is_css_length(token_value):
                diagnostics.append(
                    LintDiagnostic(
                        severity="warning",
                        code="W701",
                        message=(
                            f"Token '{token_name}' must be a CSS length (e.g. 8px, 1rem, 50%)"
                        ),
                        path=path,
                        category="theme",
                    )
                )
            continue

        if _is_font_weight_token(token_name):
            if not _is_valid_font_weight(token_value):
                diagnostics.append(
                    LintDiagnostic(
                        severity="warning",
                        code="W702",
                        message=f"Token '{token_name}' must be a valid font weight",
                        path=path,
                        category="theme",
                    )
                )
            continue

        if _is_line_height_token(token_name):
            if not _is_unitless_line_height(token_value):
                diagnostics.append(
                    LintDiagnostic(
                        severity="warning",
                        code="W703",
                        message=f"Token '{token_name}' must use a unitless line-height value",
                        path=path,
                        category="theme",
                    )
                )

    return diagnostics


def _validate_token_references(
    document: dict,
    tokens: dict[str, object],
) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []
    token_names = set(tokens.keys())

    defaults = document.get("defaults")
    if isinstance(defaults, dict):
        diagnostics.extend(_check_block_for_missing_tokens(defaults, "$.defaults", token_names))

    selectors = document.get("selectors")
    if isinstance(selectors, list):
        for index, selector in enumerate(selectors):
            if not isinstance(selector, dict):
                continue
            apply_block = selector.get("apply")
            if isinstance(apply_block, dict):
                diagnostics.extend(
                    _check_block_for_missing_tokens(
                        apply_block,
                        f"$.selectors[{index}].apply",
                        token_names,
                    )
                )

    items = document.get("items")
    if isinstance(items, dict):
        for key, block in items.items():
            if isinstance(block, dict):
                diagnostics.extend(
                    _check_block_for_missing_tokens(
                        block,
                        f"$.items[{key!r}]",
                        token_names,
                    )
                )

    return diagnostics


def _check_block_for_missing_tokens(
    block: dict,
    base_path: str,
    token_names: set[str],
) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []
    for path, value in _iter_values(block, base_path):
        if not isinstance(value, str):
            continue
        for token_ref in _extract_token_refs(value):
            if token_ref not in token_names:
                diagnostics.append(
                    LintDiagnostic(
                        severity="warning",
                        code="W704",
                        message=f"Token reference '$token.{token_ref}' is not defined",
                        path=path,
                        category="theme",
                    )
                )
    return diagnostics


def _iter_values(value: object, path: str) -> Iterator[tuple[str, object]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}[{key!r}]"
            yield from _iter_values(child, child_path)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from _iter_values(child, f"{path}[{i}]")
    else:
        yield path, value


def _extract_token_refs(text: str) -> list[str]:
    return _TOKEN_REF_RE.findall(text)


def _token_path(token_name: str) -> str:
    return f"$.tokens[{token_name!r}]"


def _is_color_token(name: str) -> bool:
    lowered = name.lower()
    return lowered.startswith("color") or ".color" in lowered


def _is_spacing_or_size_token(name: str) -> bool:
    lowered = name.lower()
    return lowered.startswith(("spacing", "size", "sizing")) or any(
        part in lowered for part in (".spacing", ".size", ".sizing")
    )


def _is_font_weight_token(name: str) -> bool:
    lowered = name.lower()
    return "fontweight" in lowered or lowered.endswith(".weight")


def _is_line_height_token(name: str) -> bool:
    lowered = name.lower()
    return "lineheight" in lowered or lowered.endswith(".line-height")


def _is_color_value(value: str) -> bool:
    return bool(_HEX_COLOR_RE.fullmatch(value) or _RGB_HSL_RE.fullmatch(value))


def _is_css_length(value: object) -> bool:
    if isinstance(value, (int, float)):
        return value == 0
    if not isinstance(value, str):
        return False
    return bool(_CSS_LENGTH_RE.fullmatch(value.strip()))


def _is_valid_font_weight(value: object) -> bool:
    if isinstance(value, int):
        return value in {100, 200, 300, 400, 500, 600, 700, 800, 900}
    if not isinstance(value, str):
        return False

    lowered = value.lower().strip()
    if lowered in {"normal", "bold"}:
        return True
    if lowered.isdigit():
        number = int(lowered)
        return number in {100, 200, 300, 400, 500, 600, 700, 800, 900}
    return False


def _is_unitless_line_height(value: object) -> bool:
    if isinstance(value, (int, float)):
        return value > 0
    if not isinstance(value, str):
        return False
    return bool(_UNITLESS_NUMBER_RE.fullmatch(value.strip()))
