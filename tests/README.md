# Formspec Conformance Test Suite

Machine-readable test suite validating JSON documents against the Formspec
family of JSON Schemas (draft 2020-12).

## Layout

- `tests/unit/schema/` — schema conformance and schema/spec contract tests
- `tests/unit/runtime/` — Python runtime package tests (`formspec.*`)
- `tests/unit/support/` — shared builders + schema fixtures
- `tests/e2e/` — browser/integration suites
- `packages/formspec-engine/tests/` — JavaScript engine unit tests (Node test runner)

## Coverage

| Schema | Test File | Tests |
|---|---|---|
| `definition.schema.json` | `unit/schema/definition/test_definition_schema.py` | 139 |
| `response.schema.json` + `validationReport.schema.json` | `unit/schema/response/test_response_schema.py` | 61 |
| `mapping.schema.json` | `unit/schema/mapping/test_mapping_schema.py` | 91 |
| Mapping adapter `$defs` contracts | `unit/schema/contracts/test_mapping_adapter_schema_contracts.py` | 6 |
| `registry.schema.json` | `unit/schema/registry/test_registry_schema.py` | 72 |
| All spec examples (Layer 2) | `unit/schema/contracts/test_spec_examples.py` | 153 |
| Property-based / generative (Layer 3) | `unit/schema/contracts/test_property_based.py` | 50 |
| Cross-spec contract (Layer 5) | `unit/schema/contracts/test_cross_spec_contracts.py` | 149 |
| FEL parser (Layer 6) | `unit/runtime/fel/test_fel_parser.py` | 102 |
| FEL evaluator (Layer 6) | `unit/runtime/fel/test_fel_evaluator.py` | 68 |
| FEL functions (Layer 6) | `unit/runtime/fel/test_fel_functions.py` | 76 |
| FEL API & conformance (Layer 6) | `unit/runtime/fel/test_fel_api.py` | 40 |
| **Total** | | **1007** |

## Test Layers

### Layer 1: Schema Conformance (363 tests)
Hand-written positive/negative test cases. One assertion per constraint.

### Layer 2: Spec Example Extraction (153 tests)
Automatically extracts every ` ```json ` block from every `.md` spec file,
classifies it (complete document, fragment, non-schema), and validates
against the appropriate schema. If someone edits a spec example and breaks
it, CI catches it.

Classification categories:
- **Complete documents** — validated against full schema (definition, response, mapping, registry)
- **Fragments** — validated against `$defs` sub-schemas (Item, Shape, FieldRule)
- **Near-complete** — patched with missing optional fields then validated (§7 responses missing `authored`)
- **Non-schema** — checked for JSON parseability only (adapter configs, diagnostics, data samples)

## Test Categories

Layer 1 test files cover:

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

### Layer 3: Property-Based / Generative Testing (50 tests)
Uses Hypothesis to generate random valid documents for all 5 schemas,
verify they pass validation, then apply targeted mutations (delete required
fields, inject bad enum values, add extra properties, empty arrays, break
extension key patterns) and verify the schema rejects them.

Four test classes:
- **TestGeneratorsProduceValid** — 10 generators × 100 random examples each
- **TestMutationsDetected** — 14 mutation × schema combinations × 50 examples
- **TestConditionalInteractions** — 20 targeted tests for if/then + oneOf + anyOf combinatorics
- **TestExtensionKeyEnforcement** — 6 tests for `propertyNames` vs `patternProperties` mechanisms

### Layer 5: Cross-Spec Contract Tests (149 tests)
Verifies normative spec prose matches actual JSON schema structure.
Pure schema introspection — no document generation, no validation calls.

15 test classes covering:
- **Cross-schema consistency** — draft uniformity, `$id` presence, `additionalProperties: false` on all top-level objects, cross-file `$ref` integrity (validationReport → response), extension mechanism divergence (propertyNames vs patternProperties)
- **Closed-world property sets** — every `additionalProperties: false` object asserts its exact set of declared properties, catching property additions/removals
- **Required arrays** — exact match against spec-declared required fields
- **Enum values** — exact match for every enum in every schema
- **Pattern constraints** — key, name, id regex patterns
- **Format constraints** — uri, date, date-time, uri-template
- **Default values** — every spec-declared default matches schema
- **Conditional structure** — if/then branches navigated by scanning `if` conditions (not positional index), verifying required fields in `then` clauses

### Layer 6: FEL Implementation Tests (286 tests)
End-to-end tests for the FEL Python reference implementation (`fel/` package).

Four test files:
- **unit/runtime/fel/test_fel_parser.py** (102) — scannerless parser: literals, field refs, context refs,
  operators, precedence, membership, ternary, if-then-else, let bindings, function calls,
  postfix access, arrays, objects, comments, edge cases, reserved words, conformance
- **unit/runtime/fel/test_fel_evaluator.py** (68) — evaluator: arithmetic, comparison, equality, logical
  operators, null propagation (§3.8), string concatenation, membership, ternary,
  if-then-else, let bindings, field refs, element-wise arrays (§3.9), postfix access
- **unit/runtime/fel/test_fel_functions.py** (76) — all 55 built-in functions: aggregates (sum/count/avg/
  min/max), string (length/contains/startsWith/endsWith/substring/replace/upper/lower/
  trim/matches/format), numeric (round/floor/ceil/abs/power), date (year/month/day/
  dateDiff/dateAdd/hours/minutes/seconds/time/timeDiff), logical (if/coalesce/empty/
  present), type-checking (isNumber/isString/isNull/typeOf), cast (number/string/
  boolean/date), money (money/moneyAmount/moneyCurrency/moneyAdd)
- **unit/runtime/fel/test_fel_api.py** (40) — public API, dependency extraction, extension registration,
  grammar conformance (§7 all 7 points), semantic conformance, spec examples

## Prerequisites

```bash
pip install pytest jsonschema
```

## Running

```bash
# From the repository root:
python3 -m pytest tests/ -v

# JavaScript engine unit tests:
npm run test:unit

# Playwright E2E:
npm run test:e2e
npm run test:e2e:integration
npm run test:e2e:components
npm run test:e2e:smoke

# Single schema:
python3 -m pytest tests/unit/schema/definition/test_definition_schema.py -v

# Ownership-group runs:
python3 -m pytest tests/unit/schema/ -v
python3 -m pytest tests/unit/runtime/fel/ -v

# Marker-based runs:
python3 -m pytest tests/ -m schema -v
python3 -m pytest tests/ -m "runtime and fel" -v

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
