"""Canonical component/dataType compatibility matrix."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CompatibilityStatus = Literal[
    "compatible",
    "compatible_with_warning",
    "incompatible",
    "not_applicable",
]

_ALL_FIELD_TYPES = frozenset(
    {
        "string",
        "text",
        "integer",
        "decimal",
        "boolean",
        "date",
        "dateTime",
        "time",
        "uri",
        "attachment",
        "choice",
        "multiChoice",
        "money",
    }
)


@dataclass(frozen=True, slots=True)
class CompatibilityRule:
    strict_allowed: frozenset[str]
    authoring_allowed: frozenset[str]
    requires_options_source: bool = False


# Authoring mode permits deterministic fallbacks for some disputed mappings.
COMPATIBILITY_RULES: dict[str, CompatibilityRule] = {
    "TextInput": CompatibilityRule(
        strict_allowed=frozenset({"string"}),
        authoring_allowed=_ALL_FIELD_TYPES,
    ),
    "NumberInput": CompatibilityRule(
        strict_allowed=frozenset({"integer", "decimal"}),
        authoring_allowed=frozenset({"integer", "decimal", "money"}),
    ),
    "DatePicker": CompatibilityRule(
        strict_allowed=frozenset({"date", "dateTime", "time"}),
        authoring_allowed=frozenset({"date", "dateTime", "time"}),
    ),
    "Select": CompatibilityRule(
        strict_allowed=frozenset({"choice"}),
        authoring_allowed=frozenset({"choice"}),
        requires_options_source=True,
    ),
    "CheckboxGroup": CompatibilityRule(
        strict_allowed=frozenset({"multiChoice"}),
        authoring_allowed=frozenset({"multiChoice"}),
        requires_options_source=True,
    ),
    "Toggle": CompatibilityRule(
        strict_allowed=frozenset({"boolean"}),
        authoring_allowed=frozenset({"boolean"}),
    ),
    "FileUpload": CompatibilityRule(
        strict_allowed=frozenset({"attachment"}),
        authoring_allowed=frozenset({"attachment"}),
    ),
    "RadioGroup": CompatibilityRule(
        strict_allowed=frozenset({"choice"}),
        authoring_allowed=frozenset({"choice"}),
        requires_options_source=True,
    ),
    "MoneyInput": CompatibilityRule(
        strict_allowed=frozenset({"integer", "decimal", "money"}),
        authoring_allowed=frozenset({"integer", "decimal", "money"}),
    ),
    "Slider": CompatibilityRule(
        strict_allowed=frozenset({"integer", "decimal"}),
        authoring_allowed=frozenset({"integer", "decimal"}),
    ),
    "Rating": CompatibilityRule(
        strict_allowed=frozenset({"integer"}),
        authoring_allowed=frozenset({"integer", "decimal"}),
    ),
    "Signature": CompatibilityRule(
        strict_allowed=frozenset({"attachment"}),
        authoring_allowed=frozenset({"attachment"}),
    ),
}

INPUT_COMPONENTS = frozenset(COMPATIBILITY_RULES.keys())


def classify_compatibility(component_name: str, data_type: str) -> CompatibilityStatus:
    """Classify compatibility independent of lint mode."""
    rule = COMPATIBILITY_RULES.get(component_name)
    if rule is None:
        return "not_applicable"

    if data_type in rule.strict_allowed:
        return "compatible"
    if data_type in rule.authoring_allowed:
        return "compatible_with_warning"
    return "incompatible"


def requires_options_source(component_name: str) -> bool:
    rule = COMPATIBILITY_RULES.get(component_name)
    return bool(rule and rule.requires_options_source)
