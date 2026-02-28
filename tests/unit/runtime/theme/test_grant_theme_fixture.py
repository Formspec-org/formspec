from __future__ import annotations

import json
from pathlib import Path

from formspec.validator.schema import SchemaValidator


THEME_WEB_PATH = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
    / "theme.json"
)
THEME_PDF_PATH = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
    / "theme-pdf.json"
)

EXPECTED_BREAKPOINTS = {
    "sm": 480,
    "md": 768,
    "lg": 1024,
    "xl": 1280,
}


def _load_theme(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_grant_pdf_theme_is_schema_valid() -> None:
    validator = SchemaValidator()
    pdf_result = validator.validate(_load_theme(THEME_PDF_PATH), document_type="theme")

    assert pdf_result.errors == []


def test_grant_theme_exercises_page_region_breakpoint_coverage() -> None:
    theme = _load_theme(THEME_WEB_PATH)

    breakpoints = theme["breakpoints"]
    assert breakpoints == EXPECTED_BREAKPOINTS

    pages = theme["pages"]
    assert len(pages) >= 2
    assert all(
        {"id", "title", "description", "regions"}.issubset(page.keys())
        for page in pages[:2]
    )

    regions = [
        region
        for page in pages
        for region in page["regions"]
    ]
    assert len(regions) >= 4
    assert all("key" in region for region in regions)

    spans = [region["span"] for region in regions if "span" in region]
    starts = [region["start"] for region in regions if "start" in region]
    assert spans and all(1 <= span <= 12 for span in spans)
    assert starts and all(1 <= start <= 12 for start in starts)

    first_page = pages[0]
    assert first_page["regions"][0]["span"] + first_page["regions"][1]["span"] == 12
    assert first_page["regions"][0]["start"] == 1
    assert first_page["regions"][1]["start"] == 9

    responsive_breakpoint_names = {
        breakpoint
        for region in regions
        for breakpoint in region.get("responsive", {})
    }
    assert responsive_breakpoint_names
    assert responsive_breakpoint_names.issubset(set(breakpoints))

    responsive_overrides = [
        override
        for region in regions
        for override in region.get("responsive", {}).values()
    ]
    assert responsive_overrides
    assert any("span" in override for override in responsive_overrides)
    assert any("start" in override for override in responsive_overrides)
    assert any("hidden" in override for override in responsive_overrides)


def test_grant_pdf_theme_exercises_platform_specific_tokens_and_selectors() -> None:
    web_theme = _load_theme(THEME_WEB_PATH)
    pdf_theme = _load_theme(THEME_PDF_PATH)

    assert web_theme["platform"] == "web"
    assert pdf_theme["platform"] == "pdf"
    assert pdf_theme["targetDefinition"]["url"] == web_theme["targetDefinition"]["url"]

    assert pdf_theme.get("stylesheets") is None
    assert pdf_theme["tokens"] != web_theme["tokens"]
    assert "pdf.page.margin" in pdf_theme["tokens"]

    selectors = pdf_theme["selectors"]
    assert selectors
    selector_widgets = {
        selector["apply"].get("widget")
        for selector in selectors
        if isinstance(selector.get("apply"), dict)
    }
    interactive_widgets = {
        "textInput",
        "textarea",
        "numberInput",
        "checkbox",
        "datePicker",
        "dropdown",
        "checkboxGroup",
        "fileUpload",
        "moneyInput",
        "slider",
        "stepper",
        "rating",
        "toggle",
        "yesNo",
        "radio",
        "autocomplete",
        "segmented",
        "likert",
        "multiSelect",
        "richText",
        "password",
        "color",
        "urlInput",
        "dateInput",
        "dateTimePicker",
        "dateTimeInput",
        "timePicker",
        "timeInput",
        "camera",
        "signature",
    }
    assert selector_widgets.isdisjoint(interactive_widgets)
