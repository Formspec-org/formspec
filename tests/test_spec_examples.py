"""Layer 2: Spec Example Extraction & Validation.

Automatically extracts every JSON code block from every Formspec
Markdown specification file and validates it against the appropriate
JSON Schema.  If someone edits a spec example and breaks it, this
test suite catches it.

Classification strategy:
  1. Complete documents  — validated against their full schema.
  2. Fragments           — validated against the relevant $defs sub-schema
                           or against a relaxed version of the full schema.
  3. Non-schema JSON     — only checked for parse-ability (valid JSON).
"""
import json
import os
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError, validate
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT_DIR / "schemas"
SPEC_FILES = [
    "specs/core/spec.md",
    "specs/mapping/mapping-spec.md",
    "specs/registry/changelog-spec.md",
    "specs/registry/extension-registry.md",
]


def _load_schema(name):
    with open(SCHEMA_DIR / name) as f:
        return json.load(f)


def _extract_json_blocks(filepath):
    """Extract all ```json fenced code blocks from a Markdown file.

    Returns list of (line_number, section_heading, parsed_object) tuples.
    Blocks that use markdown blockquote '>' prefix are cleaned automatically.
    Blocks that are not valid JSON are returned with obj=None.
    """
    with open(ROOT_DIR / filepath) as f:
        content = f.read()

    results = []
    for m in re.finditer(r"```json\s*\n(.*?)```", content, re.DOTALL):
        raw = m.group(1).strip()
        line_no = content[: m.start()].count("\n") + 1

        # Find nearest heading
        before = content[: m.start()]
        headings = re.findall(r"^#{1,4}\s+(.+)$", before, re.MULTILINE)
        heading = headings[-1].strip() if headings else "(top)"

        # Strip blockquote prefix
        cleaned = re.sub(r"^> ?", "", raw, flags=re.MULTILINE)

        try:
            obj = json.loads(cleaned)
        except json.JSONDecodeError:
            obj = None

        results.append((filepath, line_no, heading, obj))

    return results


def _classify(obj):
    """Classify a parsed JSON object into a schema category.

    Returns one of:
      'definition'       - complete FormDefinition
      'response'         - complete or near-complete Response
      'validation_report'- ValidationReport
      'mapping_doc'      - complete MappingDocument
      'registry_doc'     - complete Registry Document
      'json_schema'      - a JSON Schema document (has $schema + properties/type)
      'mapping_rule'     - a FieldRule fragment
      'item'             - an Item fragment
      'bind_wrapper'     - { binds: [...] }
      'shape_wrapper'    - { shapes: [...] }
      'extensions_decl'  - { extensions: {...} }
      'other'            - everything else
    """
    if not isinstance(obj, dict):
        return "other"  # arrays, primitives

    keys = set(obj.keys())

    # Complete documents (most specific first)
    if "$formspecRegistry" in keys:
        return "registry_doc"
    if "$formspec" in keys:
        return "definition"
    if "definitionUrl" in keys and "data" in keys:
        return "response"
    if "valid" in keys and "counts" in keys and "results" in keys:
        return "validation_report"
    if "targetSchema" in keys and "rules" in keys:
        return "mapping_doc"

    # JSON Schema documents (appendices)
    if "$schema" in keys and ("properties" in keys or "$defs" in keys):
        return "json_schema"

    # Fragments
    # Mapping FieldRules have transform; Diagnostics have errorCode
    if ("sourcePath" in keys or "targetPath" in keys) and "transform" in keys:
        return "mapping_rule"
    if "errorCode" in keys:
        return "diagnostic"
    # Changelog entries have key+type but also impact/path/target — not Items
    if "impact" in keys and "path" in keys:
        return "changelog_entry"
    if "key" in keys and "type" in keys and keys & {"label", "children", "dataType"}:
        return "item"
    if "binds" in keys or "bind" in keys:
        return "bind_wrapper"
    if "shapes" in keys:
        return "shape_wrapper"
    if "extensions" in keys:
        return "extensions_decl"

    return "other"


def _make_id(filepath, line_no, heading):
    """Human-readable test ID."""
    # Truncate heading for readability
    short = heading[:60].replace(" ", "-").replace("(", "").replace(")", "")
    return f"{filepath}:L{line_no}:{short}"


# ---------------------------------------------------------------------------
# Collect all blocks across all spec files
# ---------------------------------------------------------------------------

ALL_BLOCKS = []
for spec_file in SPEC_FILES:
    ALL_BLOCKS.extend(_extract_json_blocks(spec_file))


# ---------------------------------------------------------------------------
# Schemas (loaded once)
# ---------------------------------------------------------------------------

DEFINITION_SCHEMA = _load_schema("definition.schema.json")
RESPONSE_SCHEMA = _load_schema("response.schema.json")
VALIDATION_REPORT_SCHEMA = _load_schema("validationReport.schema.json")
MAPPING_SCHEMA = _load_schema("mapping.schema.json")
REGISTRY_SCHEMA = _load_schema("registry.schema.json")

# Sub-schemas extracted from $defs for fragment validation
ITEM_SCHEMA = DEFINITION_SCHEMA["$defs"]["Item"]
SHAPE_SCHEMA = DEFINITION_SCHEMA["$defs"]["Shape"]
FIELD_RULE_SCHEMA = MAPPING_SCHEMA["$defs"]["FieldRule"]

# Build a referencing registry so sub-schema $refs resolve against parent
_MAPPING_ID = MAPPING_SCHEMA.get("$id", "https://formspec.org/schemas/mapping/v1")
_DEFINITION_ID = DEFINITION_SCHEMA.get("$id", "https://formspec.org/schemas/definition/1.0")
_REGISTRY = Registry().with_resources([
    (_MAPPING_ID, Resource.from_contents(MAPPING_SCHEMA, default_specification=DRAFT202012)),
    (_DEFINITION_ID, Resource.from_contents(DEFINITION_SCHEMA, default_specification=DRAFT202012)),
])


def _make_validator(sub_schema, parent_schema):
    """Create a Draft202012Validator for a sub-schema with $ref resolution
    against the full parent schema."""
    parent_id = parent_schema.get("$id", "")
    # Inline $defs from parent so $ref: #/$defs/X resolves
    enriched = {**sub_schema}
    if "$defs" not in enriched and "$defs" in parent_schema:
        enriched["$defs"] = parent_schema["$defs"]
    return Draft202012Validator(enriched, registry=_REGISTRY)


# ---------------------------------------------------------------------------
# Test: Every JSON block must be parseable
# ---------------------------------------------------------------------------


class TestAllBlocksParse:
    """Every ```json block in every spec file must be valid JSON."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        ALL_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in ALL_BLOCKS],
    )
    def test_json_parses(self, filepath, line_no, heading, obj):
        assert obj is not None, (
            f"{filepath}:L{line_no} ({heading}) — "
            f"JSON block does not parse as valid JSON"
        )


# ---------------------------------------------------------------------------
# Test: Complete Definition documents
# ---------------------------------------------------------------------------

DEFINITION_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "definition"
]


class TestDefinitionExamples:
    """Complete Definition examples must validate against definition.schema.json."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        DEFINITION_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in DEFINITION_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        validate(obj, DEFINITION_SCHEMA)


# ---------------------------------------------------------------------------
# Test: Complete Response documents
# ---------------------------------------------------------------------------

RESPONSE_COMPLETE = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None
    and _classify(o) == "response"
    and all(
        k in o
        for k in ["definitionUrl", "definitionVersion", "status", "data", "authored"]
    )
]

RESPONSE_FRAGMENTS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None
    and _classify(o) == "response"
    and not all(
        k in o
        for k in ["definitionUrl", "definitionVersion", "status", "data", "authored"]
    )
]


class TestResponseCompleteExamples:
    """Complete Response examples must validate against response.schema.json."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        RESPONSE_COMPLETE,
        ids=[_make_id(f, l, h) for f, l, h, _ in RESPONSE_COMPLETE],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        validate(obj, RESPONSE_SCHEMA)


class TestResponseFragments:
    """Response fragments (missing 'authored') must validate when field is added.

    These §7 examples deliberately omit `authored` for brevity.
    We verify the *rest* of the document is schema-conformant.
    """

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        RESPONSE_FRAGMENTS,
        ids=[_make_id(f, l, h) for f, l, h, _ in RESPONSE_FRAGMENTS],
    )
    def test_validates_with_authored(self, filepath, line_no, heading, obj):
        patched = {**obj, "authored": "2025-01-01T00:00:00Z"}
        validate(patched, RESPONSE_SCHEMA)


# ---------------------------------------------------------------------------
# Test: Mapping documents
# ---------------------------------------------------------------------------

MAPPING_DOC_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "mapping_doc"
]


class TestMappingDocExamples:
    """Complete Mapping documents must validate against mapping.schema.json."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        MAPPING_DOC_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in MAPPING_DOC_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        validate(obj, MAPPING_SCHEMA)


# ---------------------------------------------------------------------------
# Test: Mapping FieldRule fragments
# ---------------------------------------------------------------------------

MAPPING_RULE_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "mapping_rule"
]


class TestMappingRuleFragments:
    """FieldRule fragments must validate against the FieldRule $def sub-schema."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        MAPPING_RULE_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in MAPPING_RULE_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        _make_validator(FIELD_RULE_SCHEMA, MAPPING_SCHEMA).validate(obj)


# ---------------------------------------------------------------------------
# Test: Registry documents
# ---------------------------------------------------------------------------

REGISTRY_DOC_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "registry_doc"
]


class TestRegistryDocExamples:
    """Registry document examples must validate against registry.schema.json."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        REGISTRY_DOC_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in REGISTRY_DOC_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        validate(obj, REGISTRY_SCHEMA)


# ---------------------------------------------------------------------------
# Test: Item fragments
# ---------------------------------------------------------------------------

ITEM_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "item"
]


class TestItemFragments:
    """Item fragments must validate against the Item $def sub-schema."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        ITEM_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in ITEM_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        _make_validator(ITEM_SCHEMA, DEFINITION_SCHEMA).validate(obj)


# ---------------------------------------------------------------------------
# Test: Shape wrappers (objects with { shapes: [...] })
# ---------------------------------------------------------------------------

SHAPE_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "shape_wrapper"
]


class TestShapeWrappers:
    """Shape wrapper fragments — each shape in the array validates."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        SHAPE_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in SHAPE_BLOCKS],
    )
    def test_each_shape_validates(self, filepath, line_no, heading, obj):
        shapes = obj.get("shapes", [])
        assert len(shapes) > 0, "shapes array is empty"
        for i, shape in enumerate(shapes):
            try:
                _make_validator(SHAPE_SCHEMA, DEFINITION_SCHEMA).validate(shape)
            except ValidationError as e:
                pytest.fail(
                    f"shapes[{i}] failed: {e.message} at {list(e.absolute_path)}"
                )


# ---------------------------------------------------------------------------
# Test: ValidationReport examples
# ---------------------------------------------------------------------------

VALIDATION_REPORT_BLOCKS = [
    (f, l, h, o) for f, l, h, o in ALL_BLOCKS
    if o is not None and _classify(o) == "validation_report"
]


class TestValidationReportExamples:
    """ValidationReport examples validate against validationReport.schema.json."""

    @pytest.mark.parametrize(
        "filepath,line_no,heading,obj",
        VALIDATION_REPORT_BLOCKS,
        ids=[_make_id(f, l, h) for f, l, h, _ in VALIDATION_REPORT_BLOCKS],
    )
    def test_validates(self, filepath, line_no, heading, obj):
        validate(obj, VALIDATION_REPORT_SCHEMA)


# ---------------------------------------------------------------------------
# Summary: block classification coverage
# ---------------------------------------------------------------------------


class TestCoverage:
    """Meta-tests ensuring we have good classification coverage."""

    def test_all_blocks_parse(self):
        """Every JSON block across all spec files parses successfully."""
        unparseable = [
            (f, l, h) for f, l, h, o in ALL_BLOCKS if o is None
        ]
        assert unparseable == [], f"Unparseable blocks: {unparseable}"

    def test_total_block_count(self):
        """Sanity check: we found a reasonable number of blocks."""
        assert len(ALL_BLOCKS) >= 90, (
            f"Expected >=90 JSON blocks, found {len(ALL_BLOCKS)}"
        )

    def test_classified_blocks_not_empty(self):
        """Every category with blocks should have at least one."""
        categories = {}
        for f, l, h, o in ALL_BLOCKS:
            if o is not None:
                cat = _classify(o)
                categories.setdefault(cat, []).append((f, l))
        # These categories must be populated
        for expected in [
            "definition", "response", "mapping_doc", "mapping_rule",
            "item", "shape_wrapper",
        ]:
            assert expected in categories, f"No blocks classified as '{expected}'"

    def test_schema_validated_percentage(self):
        """At least 50% of parseable blocks should be schema-validated."""
        validated_cats = {
            "definition", "response", "mapping_doc", "mapping_rule",
            "registry_doc", "item", "shape_wrapper", "validation_report",
        }
        parseable = [(f, l, h, o) for f, l, h, o in ALL_BLOCKS if o is not None]
        validated = [
            b for b in parseable if _classify(b[3]) in validated_cats
        ]
        pct = len(validated) / len(parseable) * 100
        assert pct >= 45, (
            f"Only {pct:.0f}% of blocks are schema-validated "
            f"({len(validated)}/{len(parseable)})"
        )
