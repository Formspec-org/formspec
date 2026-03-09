"""Theme document semantic checks (W700-W711, E710).

W700-W703: token value validation by naming convention.
W704: $token.X reference integrity.
W705: items keys → definition item paths (cross-artifact).
W706: page region keys → definition item paths (cross-artifact).
W707: targetDefinition.url vs definition URL (cross-artifact).
E710: duplicate page IDs (single-document).
W711: responsive breakpoint keys vs declared breakpoints (single-document).
"""

from __future__ import annotations

import re
from collections.abc import Iterator

from .diagnostic import LintDiagnostic

_TOKEN_REF_RE = re.compile(r"\$token\.([A-Za-z0-9_.-]+)")
_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_RGB_HSL_RE = re.compile(r"^(?:rgb|rgba|hsl|hsla)\([^\)]*\)$")
_CSS_LENGTH_RE = re.compile(r"^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|rem|em|vw|vh|%|ch|ex|cm|mm|in|pt|pc))$")
_UNITLESS_NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def lint_theme_semantics(
    document: dict,
    definition_doc: dict | None = None,
) -> list[LintDiagnostic]:
    """Entry point: validate tokens (W700-W704), cross-artifact refs (W705-W707), and page semantics (E710, W711)."""
    diagnostics: list[LintDiagnostic] = []

    tokens = document.get("tokens")
    token_map = tokens if isinstance(tokens, dict) else {}

    diagnostics.extend(_validate_token_values(token_map))
    diagnostics.extend(_validate_token_references(document, token_map))

    item_paths = _build_item_paths(definition_doc) if isinstance(definition_doc, dict) else None

    if item_paths is not None:
        diagnostics.extend(_validate_item_keys(document, item_paths))
        diagnostics.extend(_validate_target_url(document, definition_doc))  # type: ignore[arg-type]

    diagnostics.extend(_validate_page_semantics(document, item_paths))

    return diagnostics


def _validate_token_values(tokens: dict[str, object]) -> list[LintDiagnostic]:
    """Check each token value against its name-implied type: color (W700), spacing (W701), weight (W702), line-height (W703)."""
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
    """Scan defaults, selectors, and items blocks for $token.X refs that don't exist in $.tokens (W704)."""
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
    """Recursively scan a style block for unresolved $token.X references."""
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
    """Recursively yield (json_path, leaf_value) pairs from nested dicts/lists."""
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


# ── Cross-artifact helpers (W705-W707) ───────────────────────────────────


def _build_item_paths(definition_doc: dict | None) -> set[str]:
    """Walk definition items to collect all full dotted paths and top-level keys."""
    if not isinstance(definition_doc, dict):
        return set()

    paths: set[str] = set()

    def walk(items: object, chain: tuple[str, ...]) -> None:
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            if not isinstance(key, str):
                continue
            full = ".".join((*chain, key))
            paths.add(full)
            paths.add(key)
            walk(item.get("children"), (*chain, key))

    walk(definition_doc.get("items"), ())
    return paths


def _validate_item_keys(
    document: dict, item_paths: set[str]
) -> list[LintDiagnostic]:
    """W705: items keys that don't match any definition item path."""
    items = document.get("items")
    if not isinstance(items, dict):
        return []

    diagnostics: list[LintDiagnostic] = []
    for key in items:
        if key not in item_paths:
            diagnostics.append(
                LintDiagnostic(
                    severity="warning",
                    code="W705",
                    message=f"Theme items key '{key}' does not match any definition item path",
                    path=f"$.items[{key!r}]",
                    category="theme",
                )
            )
    return diagnostics


def _validate_target_url(
    document: dict, definition_doc: dict
) -> list[LintDiagnostic]:
    """W707: targetDefinition.url doesn't match the paired definition's URL."""
    target = document.get("targetDefinition")
    if not isinstance(target, dict):
        return []

    theme_url = target.get("url")
    if not isinstance(theme_url, str):
        return []

    def_url = definition_doc.get("url", "")
    if theme_url == def_url:
        return []

    return [
        LintDiagnostic(
            severity="warning",
            code="W707",
            message=(
                f"Theme targetDefinition.url '{theme_url}' does not match "
                f"definition URL '{def_url}'"
            ),
            path="$.targetDefinition.url",
            category="theme",
        )
    ]


# ── Page semantics (W706, E710, W711) ────────────────────────────────────


def _validate_page_semantics(
    document: dict, item_paths: set[str] | None
) -> list[LintDiagnostic]:
    """E710: duplicate page IDs. W706: region keys vs definition. W711: responsive keys vs breakpoints."""
    pages = document.get("pages")
    if not isinstance(pages, list):
        return []

    diagnostics: list[LintDiagnostic] = []
    breakpoint_names = set()
    bp = document.get("breakpoints")
    if isinstance(bp, dict):
        breakpoint_names = set(bp.keys())

    seen_ids: dict[str, int] = {}
    for page_idx, page in enumerate(pages):
        if not isinstance(page, dict):
            continue

        # E710: duplicate page IDs
        page_id = page.get("id")
        if isinstance(page_id, str):
            if page_id in seen_ids:
                diagnostics.append(
                    LintDiagnostic(
                        severity="error",
                        code="E710",
                        message=f"Duplicate page id '{page_id}' (first at pages[{seen_ids[page_id]}])",
                        path=f"$.pages[{page_idx}].id",
                        category="theme",
                    )
                )
            else:
                seen_ids[page_id] = page_idx

        regions = page.get("regions")
        if not isinstance(regions, list):
            continue

        for region_idx, region in enumerate(regions):
            if not isinstance(region, dict):
                continue

            # W706: region key vs definition paths
            region_key = region.get("key")
            if isinstance(region_key, str) and item_paths is not None:
                if region_key not in item_paths:
                    diagnostics.append(
                        LintDiagnostic(
                            severity="warning",
                            code="W706",
                            message=(
                                f"Page region key '{region_key}' does not match "
                                "any definition item path"
                            ),
                            path=f"$.pages[{page_idx}].regions[{region_idx}].key",
                            category="theme",
                        )
                    )

            # W711: responsive keys vs breakpoints
            responsive = region.get("responsive")
            if isinstance(responsive, dict) and breakpoint_names:
                for bp_key in responsive:
                    if bp_key not in breakpoint_names:
                        diagnostics.append(
                            LintDiagnostic(
                                severity="warning",
                                code="W711",
                                message=(
                                    f"Responsive key '{bp_key}' is not defined in breakpoints"
                                ),
                                path=f"$.pages[{page_idx}].regions[{region_idx}].responsive[{bp_key!r}]",
                                category="theme",
                            )
                        )

    return diagnostics
