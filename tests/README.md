# Formspec Conformance Test Suite

Machine-readable test suite validating JSON documents against the Formspec
family of JSON Schemas (draft 2020-12).

## Coverage

| Schema | Test File | Tests |
|---|---|---|
| `definition.schema.json` | `test_definition_schema.py` | 139 |
| `response.schema.json` + `validationReport.schema.json` | `test_response_schema.py` | 61 |
| `mapping.schema.json` | `test_mapping_schema.py` | 91 |
| `registry.schema.json` | `test_registry_schema.py` | 72 |
| **Total** | | **363** |

## Test Categories

Each test file covers:

- **Positive validation** — minimal and full valid documents
- **Required fields** — each required property missing individually
- **Enum constraints** — valid values accepted, invalid values rejected
- **Pattern constraints** — key/name/id regex enforcement
- **Format constraints** — URI, date, date-time, uri-template
- **additionalProperties** — unknown properties rejected at every level
- **if/then conditionals** — type-discriminated Item dispatch, transform-dependent FieldRule requirements, XML rootElement, category-specific registry entry fields
- **oneOf/anyOf discrimination** — Shape rules, Instance source/data, OptionSet options/source, coerce object/string, valueMap full/flat
- **Recursive structures** — nested Item children
- **Extensions** — `x-` prefix enforcement via `propertyNames` pattern

## Prerequisites

```bash
pip install pytest jsonschema
```

## Running

```bash
# From the repository root:
python3 -m pytest tests/ -v

# Single schema:
python3 -m pytest tests/test_definition_schema.py -v

# With coverage (if pytest-cov installed):
python3 -m pytest tests/ --cov=. --cov-report=term
```

## Adding Tests

Follow the existing pattern:
1. Use `@pytest.fixture` or conftest fixtures to load schemas
2. Use `jsonschema.validate` with `Draft202012Validator` for positive tests
3. Use `pytest.raises(ValidationError)` for negative tests
4. Use `@pytest.mark.parametrize` for enum/pattern value lists
5. One test = one assertion about one schema constraint
