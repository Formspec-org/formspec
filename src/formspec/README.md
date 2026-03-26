# formspec (Python)

`src/formspec/` — Python tooling backend. Uses the Rust/PyO3 runtime for FEL parsing, evaluation, and dependency extraction, plus Python-side lint orchestration, adapters, mapping helpers, changelog generation, and registry access.

**Entry point:** `src/formspec/` (namespace package; import from subpackages directly)
**No re-exports from `__init__.py`** — use `from formspec.fel import ...`, `from formspec.validator import ...`, etc.

---

## FEL — `src/formspec/fel/`

Rust-backed FEL runtime contract for Python. The legacy pure-Python parser/evaluator stack has been removed.

### Quick Start

```python
from formspec.fel import evaluate, parse, extract_dependencies, to_python

parsed = parse("$price * $quantity")  # syntax validation + opaque handle

result = evaluate("$price * $quantity", {"price": 10, "quantity": 3})
print(to_python(result.value))  # Decimal('30')
print(result.diagnostics)       # []

deps = extract_dependencies("sum($items[*].cost) + $base")
print(deps.fields)              # {'items.cost', 'base'}
print(deps.has_wildcard)        # True
```

### Public API (`fel/__init__.py`)

```python
evaluate(source: str, data: dict | None = None, *,
         instances: dict[str, dict] | None = None,
         mip_states: dict[str, object] | None = None,
         extensions: dict[str, object] | None = None,
         variables: dict[str, FelValue] | None = None) -> EvalResult

extract_dependencies(source: str) -> DependencySet
parse(source: str) -> ParsedExpression        # opaque handle; raises FelSyntaxError

default_fel_runtime() -> RustFelRuntime
builtin_function_catalog() -> list[dict[str, str]]
BUILTIN_NAMES: frozenset[str]
RESERVED_WORDS: frozenset[str]

FelNull, FelTrue, FelFalse
FelNumber(value: Decimal)
FelString(value: str)
FelBoolean(value: bool)
FelDate(value: date | datetime)
FelArray(elements: tuple)
FelMoney(amount: Decimal, currency: str)
FelObject(fields: dict)
FelValue

fel_bool(v) -> FelBoolean
from_python(val) -> FelValue
to_python(val: FelValue)
typeof(val: FelValue) -> str
is_null(val) -> bool

FelError, FelSyntaxError, FelDefinitionError, FelEvaluationError
Diagnostic(message: str, pos: SourcePos | None, severity: Severity)
SourcePos(offset: int, line: int, col: int)
Severity.ERROR, Severity.WARNING
```

### Runtime Contract

- `parse()` performs syntax validation and returns `ParsedExpression(source=...)`. Python does not receive a public AST anymore.
- `evaluate()` and `extract_dependencies()` call the mandatory `formspec_rust` PyO3 module.
- `builtin_function_catalog()` and `BUILTIN_NAMES` are exported from Rust metadata.
- Dynamic Python FEL extensions are no longer supported. `register_extension(...)` remains only to reject the removed contract explicitly.

### Type System (`fel/types.py`)

Every FEL value remains a frozen Python dataclass wrapper. `from_python()` and `to_python()` still convert between Python-native values and the public FEL value types, including `{amount, currency}` money objects.

### Dependency Extraction

```python
@dataclass
class DependencySet:
    fields: set[str]
    instance_refs: set[str]
    context_refs: set[str]
    mip_deps: set[str]
    has_self_ref: bool
    has_wildcard: bool
    uses_prev_next: bool
```

`extract_dependencies()` returns the Rust-generated static dependency set used by the validator and evaluator.

---

## Validator / Static Linter — `src/formspec/validator/`

### Quick Start

```python
# One-shot
from formspec.validator import lint
diagnostics = lint(document, mode="strict")

# Full linter instance
from formspec.validator import FormspecLinter, make_policy
linter = FormspecLinter(policy=make_policy("strict"))
diagnostics = linter.lint(doc, component_definition=def_doc)
```

### CLI

```bash
# Authoring mode (default), text output
python -m formspec.validator definition.json

# Strict CI mode, JSON output
python -m formspec.validator --mode strict --format json definition.json

# Schema-only validation
python -m formspec.validator --schema-only definition.json

# Skip FEL checks
python -m formspec.validator --no-fel definition.json

# Lint component document with definition cross-reference
python -m formspec.validator --definition def.json component.json

# GitHub Actions annotation format
python -m formspec.validator --format github definition.json
```

Exit code: `1` if errors, `0` if clean, `2` for input file issues.

### Diagnostic Type

```python
@dataclass(frozen=True, slots=True)
class LintDiagnostic:
    severity: Literal["error", "warning", "info"]
    code: str
    message: str
    path: str        # JSON-path-like location (e.g., "$.items[0].binds[1]")
    category: Literal["schema", "reference", "expression", "dependency", "tree", "theme", "component"]
    detail: str | None = None
```

### Lint Modes

- **`authoring`** — passes diagnostics through unchanged; lenient for interactive editing.
- **`strict`** — escalates specific warnings to errors for CI: `W800` (unresolved bind refs), `W802` (compatibility fallback), `W803` (duplicate editable bindings), `W804` (summary/datatable bind issues).

### Pipeline Passes

1. **Schema validation** (always) — `jsonschema` `Draft202012Validator` against the appropriate schema. 10 supported document types: `definition`, `response`, `validation_report`, `validation_result`, `mapping`, `registry`, `theme`, `component`, `changelog`, `fel_functions`.
2. **Document type detection** — sentinel keys: `$formspec` → definition, `$formspecTheme` → theme, `$formspecComponent` → component, `$formspecRegistry` → registry; structural key sets detect `validation_result` (`path`, `severity`, `constraintKind`, `message`) and `fel_functions` (`version`, `functions`).
3. **Structural error gate** — structural schema errors halt further passes.
4. **For `definition` documents:**
   - Tree indexing (item key/path index, duplicate detection)
   - Reference integrity (bind paths, shape targets, optionSet refs)
   - FEL expression compilation (parse all FEL in binds/shapes/screener)
   - Dependency analysis (graph, cycle detection)
5. **For `theme` documents:** Token value validation
6. **For `component` documents:** Component semantic checks

### Diagnostic Code Reference

| Code | Severity | Category | Description |
|---|---|---|---|
| E100 | error | schema | Unknown document type |
| E101 | error | schema | JSON Schema validation error |
| E200 | error | tree | Duplicate item key |
| E201 | error | tree | Duplicate item path |
| E300 | error | reference | Bind path does not resolve |
| E301 | error | reference | Shape target does not resolve |
| E302 | error | reference | Undefined optionSet |
| W300 | warning | reference | dataType incompatible with optionSet |
| E400 | error | expression | Invalid FEL syntax |
| E500 | error | dependency | Dependency cycle |
| W700 | warning | theme | Invalid color token |
| W701 | warning | theme | Invalid spacing/size token |
| W702 | warning | theme | Invalid font weight token |
| W703 | warning | theme | Unitless line-height expected |
| W704 | warning | theme | Undefined token reference |
| E800 | error | component | Root must be layout component |
| E801 | error | component | Undefined custom component |
| E802 | error | component | Incompatible component/dataType |
| W802 | warning | component | Fallback compatibility only |
| E803 | error | component | Missing options source |
| E804 | error | component | Richtext requires string field |
| E806 | error | component | Missing custom component params |
| E807 | error | component | Custom component cycle |
| W800 | warning | component | Unresolved bind path |
| W801 | warning | component | Layout/container should not bind |
| W803 | warning | component | Duplicate editable binding |
| W804 | warning | component | Summary/DataTable bind unresolved |

### Component Compatibility Matrix (`validator/component_matrix.py`)

Maps 14 input components to their allowed dataTypes in strict and authoring modes:
TextInput, NumberInput, DatePicker, Select, CheckboxGroup, Toggle, FileUpload, RadioGroup, MoneyInput, Slider, Rating, Signature.

```python
def classify_compatibility(component_name: str, data_type: str) -> CompatibilityStatus
def requires_options_source(component_name: str) -> bool
```

---

## Adapters — `src/formspec/adapters/`

Bidirectional format adapters. Each implements:

```python
class Adapter(ABC):
    @abstractmethod
    def serialize(self, value: JsonValue) -> bytes
    @abstractmethod
    def deserialize(self, data: bytes) -> JsonValue

def get_adapter(format: str, config: dict | None = None, target_schema: dict | None = None) -> Adapter
def register_adapter(prefix: str, adapter_class: type) -> None  # prefix must start with 'x-'
```

### JsonAdapter

Config: `pretty` (bool), `sortKeys` (bool), `nullHandling` (`"include"` | `"omit"`). `nullHandling="omit"` recursively strips `None`-valued keys.

### XmlAdapter

Config: `declaration` (bool, default true), `indent` (int, default 2), `cdata` (list of paths to wrap in CDATA).

`@`-prefixed keys become XML attributes; lists become repeated sibling elements; dicts become nested elements. Deserialization auto-detects repeated siblings as arrays. Supports namespace registration.

### CsvAdapter

Config: `delimiter` (str, default `,`), `quote` (str, default `"`), `header` (bool, default true), `encoding` (str, default `"utf-8"`), `lineEnding` (`"crlf"` | `"lf"`, default `"crlf"`).

Accepts a list of flat dicts, a single flat dict, or a dict with one list-valued key (repeat group expansion — scalars duplicate across rows). RFC 4180 compliant.

---

## Mapping Engine — `src/formspec/mapping/`

```python
from formspec.mapping import MappingEngine

engine = MappingEngine(mapping_doc)
target = engine.forward(response_data)   # Response → Target format
source = engine.reverse(target_data)    # Target → Response format
```

### Mapping Document Shape

- `rules`: list of `MappingRule` (sorted by `priority` descending)
- `defaults`: `Record<string, any>` applied to forward output
- `autoMap`: bool — copy unmentioned source fields
- `direction`: str
- `targetSchema`: dict

### Rule Structure

```python
{
  "sourcePath": "a.b.c",    # dot-notation with bracket indices
  "targetPath": "x.y.z",
  "transform": "preserve",  # preserve | valueMap | coerce | constant | drop | expression | ...
  "condition": "source.field = value",  # or != variant
  "priority": 10,
  "reversePriority": 5,
  "reverse": { ... }        # Partial rule override for reverse direction
}
```

### Array Descriptor Modes

- `whole` — treat entire array as single value
- `each` — apply transform per element
- `indexed` — map by positional index

### Transform Types

| Transform | Description |
|---|---|
| `preserve` | Copy unchanged; supports `default` |
| `drop` | Discard value |
| `expression` | Evaluate FEL expression |
| `coerce` | Type conversion: `string`, `number`, `integer`, `boolean`, `date`, `array`, `object` |
| `valueMap` | Lookup table; `unmapped` handling: `error` / `passthrough` / `drop` / `default` |
| `flatten` | Nested object → flat string |
| `nest` | Flat string → nested object |
| `constant` | FEL expression ignoring source |
| `concat` | FEL expression for concatenation |
| `split` | FEL expression for splitting |

Condition guards evaluate FEL with `$source` and `$target` in the environment. `valueMap` auto-inverts for reverse if no explicit reverse mapping.

---

## Changelog Generation — `src/formspec/changelog.py`

```python
from formspec.changelog import generate_changelog

changelog = generate_changelog(old_def: dict, new_def: dict, definition_url: str) -> dict
```

Compares two definition documents and produces a changelog conforming to `changelog.schema.json`.

**Diff targets:** items (by `key`), binds (by `path`), shapes (by `name`), optionSets, dataSources, screener, migrations, metadata keys.

**Impact classification:**
- Items: added → compatible, removed → breaking, type change → breaking, label-only → cosmetic
- Binds: added with required → breaking, removed → breaking, added/removed required → breaking/compatible
- Shapes: added → compatible, removed → compatible (loosens constraints)
- optionSets/dataSources: added → compatible, removed → breaking

**Semver impact:** `major` if any breaking, `minor` if any compatible, `patch` otherwise.

**Output:** `{ definitionUrl, fromVersion, toVersion, generatedAt, semverImpact, changes: [{ type, target, path, impact, key?, before?, after?, description?, migrationHint? }] }`

---

## Definition Evaluator — `src/formspec/evaluator.py`

Server-side form processor. Runs four phases per submission: rebuild (init) → recalculate → revalidate → apply non-relevant behavior (NRB).

```python
from formspec.evaluator import DefinitionEvaluator, ProcessingResult

ev = DefinitionEvaluator(definition)
result = ev.process(submitted_data)   # ProcessingResult
results = ev.validate(submitted_data) # list[dict] convenience
```

### ProcessingResult

```python
@dataclass
class ProcessingResult:
    valid: bool
    results: list[dict]         # Validation results
    data: dict                  # Processed response data
    variables: dict[str, FelValue]
    counts: dict[str, int]      # Repeat group instance counts
```

Instantiate `DefinitionEvaluator` once per definition; call `process()` for each submission. Accepts optional `registries: list[Registry]` for extension constraint validation. Also provides `evaluate_screener(answers)` for pre-form screening logic.

---

## Extension Registry — `src/formspec/registry.py`

```python
from formspec.registry import Registry, validate_lifecycle_transition

reg = Registry(registry_doc)
entry = reg.find_one("x-my-component", version=">=1.0.0", status="stable")
entries = reg.find("x-comp", version=">=1.0.0 <2.0.0", category="component")
entries = reg.list_by_category("component")
errors = reg.validate()  # Returns list of error strings
valid = validate_lifecycle_transition("draft", "stable")  # True
```

**`RegistryEntry` fields:** `name`, `category`, `version`, `status`, `description`, `compatibility`, `publisher`, `spec_url`, `schema_url`, `license`, `deprecation_notice`, `base_type`, `parameters`, `returns`, `members`.

**Valid statuses:** `draft`, `stable`, `deprecated`, `retired`.

**Lifecycle transitions:** draft, stable, or deprecated can transition to any other status. `retired` is terminal.

**`Registry.find`** supports semver constraints (e.g., `">=1.0.0 <2.0.0"`), sorts by version descending.

**`Registry.validate`** checks: extension name pattern (`x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*`), deprecated entries have notices, dataType entries have `baseType`, function entries have `parameters` and `returns`.

`WELL_KNOWN_PATH = '/.well-known/formspec-extensions'`

---

## Artifact Validator — `src/formspec/validate.py`

Auto-discovers and validates all Formspec JSON artifacts in a directory. Runs 10 passes that exercise the full toolchain: linting, schema validation, runtime evaluation, mapping, changelog generation, registry checks, and FEL expression parsing.

### CLI

```bash
python3 -m formspec.validate path/to/artifacts/
python3 -m formspec.validate path/to/artifacts/ --registry common.registry.json
python3 -m formspec.validate path/to/artifacts/ --title "My Project"
```

### Library API

```python
from formspec.validate import discover_artifacts, validate_all, print_report

artifacts = discover_artifacts(Path("my-project/"))
report = validate_all(artifacts)
sys.exit(print_report(report))  # 0 = success, >0 = error count
```

### Validation Passes

1. Definition linting
2. Sidecar linting
3. Theme linting
4. Component linting
5. Response schema validation
6. Runtime evaluation (via `DefinitionEvaluator`)
7. Mapping forward transform
8. Changelog generation
9. Registry validation
10. FEL expression parsing

Each pass returns a `PassResult` with per-item success/failure and diagnostics. `print_report()` renders colored terminal output.

---

## Architectural Patterns

- **Frozen dataclasses everywhere** — AST nodes, diagnostics, FEL values, and type wrappers freeze for safe sharing and hashability.
- **Singletons** — `FelNull`, `FelTrue`, `FelFalse`, `_DROP_SENTINEL` enable identity comparison.
- **Special-form functions** — Functions that need unevaluated AST (e.g., `if()`, `countWhere()`, MIP functions, repeat navigation) receive the evaluator and AST nodes rather than pre-evaluated arguments.
- **`propagate_null` flag** on `FuncDef` — triggers automatic null propagation before invocation. Aggregates, type-checkers, and casts set `propagate_null=False` for custom null handling.
- **Multi-pass linter** — Schema validation gates semantic analysis; structural errors halt further passes. Each pass lives in a separate module with defined inputs and outputs.
- **Policy-driven severity** — The authoring/strict split transforms diagnostics after each pass; check modules themselves stay mode-agnostic.
- **Adapter abstraction** — The `Adapter` ABC (`serialize`/`deserialize`) decouples the mapping engine from wire formats. Custom adapters use the `x-` prefix.
- **Environment scoping** — Let-bindings and `countWhere` element bindings use a push/pop scope stack for lexical scoping without mutation.
