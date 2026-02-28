# formspec (Python)

`src/formspec/` — Python reference implementation and tooling backend. Implements: FEL (Formspec Expression Language) parse/evaluate/dependency-extract pipeline, a multi-pass static linter, bidirectional format adapters (JSON/XML/CSV), a Mapping DSL engine, changelog generation, and an extension registry client.

**Entry point:** `src/formspec/` (namespace package; import from subpackages directly)
**No re-exports from `__init__.py`** — use `from formspec.fel import ...`, `from formspec.validator import ...`, etc.

---

## FEL — `src/formspec/fel/`

Complete parse-evaluate pipeline for Formspec Expression Language.

### Quick Start

```python
from formspec.fel import evaluate, parse, extract_dependencies

# Parse and evaluate
result = evaluate("$price * $quantity", {"price": 10, "quantity": 3})
print(result.value)       # FelNumber(Decimal('30'))
print(result.diagnostics) # []

# Dependency extraction
deps = extract_dependencies("sum($items[*].cost) + $base")
print(deps.fields)        # {'items.cost', 'base'}
print(deps.has_wildcard)  # True
```

### Public API (`fel/__init__.py`)

```python
# Top-level convenience
evaluate(source: str, data: dict | None = None, *,
         instances: dict[str, dict] | None = None,
         mip_states: dict[str, MipState] | None = None,
         extensions: dict[str, FuncDef] | None = None) -> EvalResult

extract_dependencies(source: str) -> DependencySet  # parse + walk in one call

# Core classes
parse(source: str) -> Expr       # Raises FelSyntaxError
Evaluator(env: Environment, functions: dict | None = None)
Environment(data=None, instances=None, mip_states=None)

# Function registry
build_default_registry() -> dict[str, FuncDef]
register_extension(registry, name, impl, min_args, max_args=None) -> None
BUILTIN_NAMES: frozenset[str]

# Type wrappers
FelNull, FelTrue, FelFalse           # Singletons
FelNumber(value: Decimal)
FelString(value: str)
FelBoolean(value: bool)
FelDate(value: date | datetime)
FelArray(elements: tuple)
FelMoney(amount: Decimal, currency: str)
FelObject(fields: dict)
FelValue                              # Union type alias

fel_bool(v) -> FelBoolean
from_python(val) -> FelValue          # Auto-detects {amount, currency} dicts as money
to_python(val: FelValue)              # → JSON-serializable Python natives
typeof(val: FelValue) -> str
is_null(val) -> bool

# Errors
FelError, FelSyntaxError, FelDefinitionError, FelEvaluationError
Diagnostic(message: str, pos: SourcePos | None, severity: Severity)
SourcePos(offset: int, line: int, col: int)
Severity.ERROR, Severity.WARNING
```

### Type System (`fel/types.py`)

All FEL values are **frozen dataclasses** for immutability and hashability. Numeric values use `decimal.Decimal` with 34-digit precision and `ROUND_HALF_EVEN` (banker's rounding).

`from_python` auto-detects: `None` → `FelNull`, `bool` → `FelBoolean`, `int`/`float`/`Decimal` → `FelNumber`, `str` → `FelString`, `list`/`tuple` → `FelArray`, `dict` with `{amount, currency}` keys → `FelMoney`, other `dict` → `FelObject`.

### Parser (`fel/parser.py`)

Scannerless recursive-descent parser operating directly on the source string. Implements the normative PEG grammar.

```python
parse(source: str) -> Expr  # Raises FelSyntaxError
```

**Operator precedence** (lowest → highest):
1. `let x = ... in ...`
2. `if ... then ... else ...`
3. Ternary `? :`
4. `or`
5. `and`
6. `=` / `!=`
7. `<` / `>` / `<=` / `>=`
8. `in` / `not in`
9. `??` (null coalesce)
10. `+` / `-` / `&` (string concatenation)
11. `*` / `/` / `%`
12. Unary `not` / `-`
13. Postfix `.field` / `[n]` / `[*]`
14. Atoms (literals, field refs, context refs, function calls, parens)

`if(...)` is parsed as `FunctionCall('if', ...)`. `if ... then ... else` is the keyword form. The `in` keyword is disambiguated from membership `in` using a parallel no-in grammar branch. `??` distinguished from `?` by lookahead.

**Reserved words:** `true false null and or not in if then else let`

### AST Nodes (`fel/ast_nodes.py`)

All nodes are frozen dataclasses with a `pos: SourcePos` field.

**Path segments:** `DotSegment(name)`, `IndexSegment(index: int)` (1-based), `WildcardSegment()`

**Expression nodes:**

| Node | Represents |
|---|---|
| `NumberLiteral(value: Decimal)` | `42`, `3.14` |
| `StringLiteral(value: str)` | `'hello'`, `"world"` |
| `BooleanLiteral(value: bool)` | `true`, `false` |
| `NullLiteral` | `null` |
| `DateLiteral(value: date\|datetime)` | `@2024-01-15`, `@2024-01-15T10:30:00Z` |
| `ArrayLiteral(elements: tuple)` | `[a, b, c]` |
| `ObjectLiteral(entries: tuple[tuple[str, Expr], ...])` | `{key: val}` |
| `FieldRef(segments: tuple[PathSegment, ...])` | `$field.sub[1]`; bare `$` = empty segments |
| `ContextRef(name: str, arg: str\|None, tail: tuple[str, ...])` | `@current`, `@instance('x').a.b` |
| `UnaryOp(op: str, operand)` | `not x`, `-x` |
| `BinaryOp(op: str, left, right)` | `+`, `-`, `*`, `/`, `%`, `&`, `=`, `!=`, `<`, `>`, `<=`, `>=`, `??`, `and`, `or` |
| `TernaryOp(condition, then_expr, else_expr)` | `a ? b : c` |
| `IfThenElse(condition, then_expr, else_expr)` | `if a then b else c` |
| `LetBinding(name: str, value, body)` | `let x = ... in ...` |
| `FunctionCall(name: str, args: tuple)` | `sum($items)` |
| `MembershipOp(value, container, negated: bool)` | `x in arr`, `x not in arr` |
| `PostfixAccess(expr, segments: tuple)` | `expr.field`, `expr[n]` |

### Evaluator (`fel/evaluator.py`)

Tree-walking evaluator.

```python
@dataclass
class EvalResult:
    value: FelValue
    diagnostics: list[Diagnostic]

class Evaluator:
    def __init__(self, env: Environment, functions: dict | None = None)
    def evaluate(self, node) -> FelValue
```

**Key evaluation rules:**
- **Null propagation:** Most operators return `FelNull` when either operand is null. Exceptions: equality (`null = null` → true, `null = x` → false), `??` (null coalesce), `and`/`or` (short-circuit).
- **Element-wise array operations:** Binary operators broadcast scalars across arrays; two equal-length arrays apply element-wise.
- **Decimal arithmetic:** 34-digit precision. Division by zero → `FelNull` + diagnostic (non-fatal).
- **1-based array indexing** in `[n]` access.
- **Wildcard access** (`[*]`) maps remaining path across all array elements.
- **Non-fatal diagnostics:** Errors during evaluation recorded as `Diagnostic` objects; evaluation continues.
- **Let-binding scoping:** Push/pop scope stack on `Environment`.

### Environment (`fel/environment.py`)

```python
@dataclass
class RepeatContext:
    current: FelValue   # Current row object
    index: int          # 1-based
    count: int
    parent: FelValue
    collection: list    # All rows

@dataclass
class MipState:
    valid: bool = True
    relevant: bool = True
    readonly: bool = False
    required: bool = False

class Environment:
    def __init__(self, data=None, instances=None, mip_states=None)
    def push_scope(self, bindings: dict[str, FelValue]) -> None
    def pop_scope(self) -> None
    def lookup_let_binding(self, name: str) -> FelValue | None
    def resolve_field(self, path: list[str]) -> FelValue
    def resolve_context(self, name: str, arg: str | None, tail: list[str]) -> FelValue
```

**Field resolution for `$field`:** let-bindings (innermost first) → instance data.
**Bare `$` resolution:** scope stack → `repeat_context.current` → entire data dict.
**Context refs:** `@current`, `@index`, `@count`, `@instance('name')`, `@source`, `@target`.

### Standard Library Functions (`fel/functions.py`)

50+ functions. `FuncDef(name, impl, min_args, max_args, propagate_null=True, special_form=False)`.

Special forms receive the evaluator + AST nodes instead of pre-evaluated values (used for `if()`, `countWhere()`, MIP functions, repeat navigation).

| Category | Functions |
|---|---|
| **Aggregates** | `sum(arr)`, `count(arr)`, `avg(arr)`, `min(arr)`, `max(arr)`, `countWhere(arr, predicate)` [special form — rebinds `$` per element] |
| **String** | `length`, `contains`, `startsWith`, `endsWith`, `substring(s,start,len?)`, `replace`, `upper`, `lower`, `trim`, `matches(s,regex)`, `format(template,...args)` |
| **Numeric** | `round(n,precision?)`, `floor`, `ceil`, `abs`, `power(base,exp)` |
| **Date** | `today()`, `now()`, `year`, `month`, `day`, `hours`, `minutes`, `seconds`, `time(h,m,s)`, `timeDiff(t1,t2)`, `dateDiff(d1,d2,unit)`, `dateAdd(d,n,unit)` |
| **Logical** | `if(cond,then,else)` [special form], `coalesce(...args)`, `empty(val)`, `present(val)`, `selected(arr,val)` |
| **Type-check** | `isNumber`, `isString`, `isDate`, `isNull`, `typeOf` |
| **Cast** | `number`, `string`, `boolean`, `date` |
| **Money** | `money(amount,currency)`, `moneyAmount`, `moneyCurrency`, `moneyAdd`, `moneySum` |
| **MIP-state** | `valid($field)`, `relevant($field)`, `readonly($field)`, `required($field)` [special forms — look up MipState] |
| **Repeat nav** | `prev()`, `next()`, `parent()` [special forms — operate on RepeatContext] |

`register_extension(registry, name, impl, min_args, max_args)` — validates name against `x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*` pattern and no collision with builtins. Extensions are always null-propagating, never special forms.

### Dependency Extraction (`fel/dependencies.py`)

```python
@dataclass
class DependencySet:
    fields: set[str]           # e.g. {'firstName', 'address.city'}
    instance_refs: set[str]    # e.g. {'priorYear'}
    context_refs: set[str]     # e.g. {'@current', '@index'}
    mip_deps: set[str]         # e.g. {'ein'} from valid($ein)
    has_self_ref: bool          # bare $
    has_wildcard: bool          # $repeat[*].field
    uses_prev_next: bool        # prev() or next()

def extract_dependencies(node) -> DependencySet
```

Correctly skips let-bound variables (tracked in `let_vars: set[str]`). `countWhere` skips bare `$` in the predicate (element-bound).

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

- **`authoring`** — passes diagnostics through unchanged. Lenient for interactive editing.
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
| E805 | error | component | Wizard children must be Page |
| E806 | error | component | Missing custom component params |
| E807 | error | component | Custom component cycle |
| W800 | warning | component | Unresolved bind path |
| W801 | warning | component | Layout/container should not bind |
| W803 | warning | component | Duplicate editable binding |
| W804 | warning | component | Summary/DataTable bind unresolved |

### Component Compatibility Matrix (`validator/component_matrix.py`)

14 input components mapped to their strict and authoring-mode allowed dataTypes:
TextInput, NumberInput, DatePicker, Select, CheckboxGroup, Toggle, FileUpload, RadioGroup, MoneyInput, Slider, Rating, Signature.

```python
def classify_compatibility(component_name: str, data_type: str) -> CompatibilityStatus
def requires_options_source(component_name: str) -> bool
```

---

## Adapters — `src/formspec/adapters/`

Bidirectional serialization/deserialization. All adapters implement:

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

Conventions: keys starting with `@` → XML attributes, lists → repeated sibling elements, dicts → nested elements. Deserialization auto-detects repeated siblings as arrays. Supports namespace registration.

### CsvAdapter

Config: `delimiter` (str, default `,`), `quote` (str, default `"`), `header` (bool, default true), `encoding` (str, default `"utf-8"`), `lineEnding` (`"crlf"` | `"lf"`, default `"crlf"`).

Serialization accepts: list of flat dicts, single flat dict, or dict with one list-valued key (repeat group expansion — scalars duplicated across rows). RFC 4180 compliant.

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

**Lifecycle transitions:** draft/stable/deprecated → any except retired→anything. `retired` is terminal.

**`Registry.find`** supports semver constraints (e.g., `">=1.0.0 <2.0.0"`), sorts by version descending.

**`Registry.validate`** checks: extension name pattern (`x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*`), deprecated entries have notices, dataType entries have `baseType`, function entries have `parameters` and `returns`.

`WELL_KNOWN_PATH = '/.well-known/formspec-extensions'`

---

## Architectural Patterns

- **Frozen dataclasses everywhere** — AST nodes, diagnostics, FEL values, type wrappers are all frozen/immutable for safe sharing and hashability.
- **Singleton pattern** — `FelNull`, `FelTrue`, `FelFalse`, `_DROP_SENTINEL` use singletons for identity comparison.
- **Special-form functions** — Functions needing access to unevaluated AST (e.g., `if()`, `countWhere()`, MIP functions, repeat navigation) receive evaluator + AST nodes rather than pre-evaluated arguments.
- **`propagate_null` flag** on `FuncDef` — enables automatic null propagation before function invocation. Aggregates, type-checkers, and casts set `propagate_null=False` for custom null handling.
- **Multi-pass linter** — Schema validation gates semantic analysis. Structural errors halt further passes. Each pass is a separate module with clean inputs/outputs.
- **Policy-driven severity** — authoring/strict split is a post-pass transform on diagnostics; individual check modules are mode-agnostic.
- **Adapter abstraction** — `Adapter` ABC with `serialize/deserialize` cleanly decouples the mapping engine from wire formats. Custom adapters use `x-` prefix convention.
- **Environment scoping** — let-bindings and `countWhere` element bindings use a push/pop scope stack for lexical scoping without mutation.
