# Formspec Specification — Sections 4–6

> **Status:** Draft
>
> **Normative Language:** The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
> "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL"
> in this document are to be interpreted as described in
> [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

---

## 4. Definition Schema

### 4.1 Top-Level Structure

A Formspec Definition is a JSON object. Conforming implementations MUST
recognize the following top-level properties and MUST reject any Definition
that omits a REQUIRED property.

```json
{
  "$formspec": "1.0",
  "url": "https://example.gov/forms/annual-report",
  "version": "2025.1.0",
  "versionAlgorithm": "semver",
  "status": "active",
  "derivedFrom": "https://example.gov/forms/annual-report|2024.1.0",
  "title": "Annual Financial Report",
  "description": "...",
  "items": [],
  "binds": [],
  "shapes": [],
  "instances": {},
  "extensions": {}
}
```

The properties are defined as follows:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `$formspec` | string | **1..1** (REQUIRED) | Specification version this Definition conforms to. MUST be the string `"1.0"` for Definitions governed by this specification. Implementations MUST reject Definitions whose `$formspec` value they do not support. |
| `url` | string (URI) | **1..1** (REQUIRED) | Canonical identifier for this Definition. MUST be a syntactically valid URI as defined by [RFC 3986](https://www.ietf.org/rfc/rfc3986.txt). MUST be globally unique across all Formspec Definitions. The `url` does NOT change between versions of the same logical form — it identifies the *form*, not the *version*. |
| `version` | string | **1..1** (REQUIRED) | Business version of the Definition. The format and comparison semantics are determined by `versionAlgorithm`. Together with `url`, the pair (`url`, `version`) MUST be globally unique. |
| `versionAlgorithm` | string | **0..1** (OPTIONAL) | Algorithm that governs interpretation and ordering of `version` strings. MUST be one of: `"semver"`, `"date"`, `"integer"`, `"natural"`. Default: `"semver"`. See §6.2 for semantics. |
| `status` | string | **1..1** (REQUIRED) | Publication status. MUST be one of: `"draft"`, `"active"`, `"retired"`. Only Definitions with status `"active"` SHOULD be used when creating new Responses. See §6.3 for lifecycle rules. |
| `derivedFrom` | string (URI) | **0..1** (OPTIONAL) | Canonical URL of a parent Definition from which this Definition was derived. MAY be version-pinned using the `url|version` syntax (e.g., `"https://example.gov/forms/annual-report|2024.1.0"`). See §6.5 for semantics. |
| `title` | string | **1..1** (REQUIRED) | Human-readable name of the form. Implementations SHOULD display this to end users. |
| `description` | string | **0..1** (OPTIONAL) | Human-readable description. MAY contain Markdown formatting; implementations are NOT REQUIRED to render Markdown. |
| `items` | array of Item | **1..1** (REQUIRED) | The item tree. Contains the root-level Items that define the form's structure. The array MAY be empty for a skeleton Definition, but the property itself MUST be present. See §4.2. |
| `binds` | array of Bind | **0..1** (OPTIONAL) | Behavioral declarations that attach expressions to data nodes. See §4.3. |
| `shapes` | array of Shape | **0..1** (OPTIONAL) | Validation rule sets. See §5.2. |
| `instances` | object | **0..1** (OPTIONAL) | Named secondary data sources. Keys are instance names; values are Instance objects. See §4.4. |
| `variables` | array of Variable | **0..1** (OPTIONAL) | Named computed values with lexical scoping. See §4.5. |
| `extensions` | object | **0..1** (OPTIONAL) | Extension namespace. Keys MUST be URIs identifying the extension. Implementations that do not recognize an extension MUST ignore it. |

Implementations MUST preserve unrecognized top-level properties during
round-tripping but MUST NOT assign semantics to them.

### 4.2 Item Schema

An **Item** represents a single node in the form's structural tree. Every Item
MUST declare a `key` and a `type`. The `type` determines which additional
properties are applicable.

```json
{
  "key": "budget_section",
  "type": "group",
  "label": "Budget Information",
  "description": "Enter budget details for each line item",
  "labels": {
    "short": "Budget",
    "pdf": "Section III: Budget Information"
  },
  "children": []
}
```

#### 4.2.1 Common Item Properties

The following properties are recognized on all Item types:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `key` | string | **1..1** (REQUIRED) | Stable identifier for this Item. MUST be unique across the entire Definition (not merely among siblings). MUST match the regular expression `[a-zA-Z][a-zA-Z0-9_]*`. The `key` is used to join Definition Items to Response data nodes and MUST NOT change across versions of the same Definition if the semantic meaning is preserved. |
| `type` | string | **1..1** (REQUIRED) | Item type. MUST be one of: `"group"`, `"field"`, `"display"`. |
| `label` | string | **1..1** (REQUIRED) | Primary human-readable label. Implementations MUST display this label (or a `labels` alternative) when rendering the Item. |
| `description` | string | **0..1** (OPTIONAL) | Human-readable help text or description. Implementations SHOULD make this text available to users on demand (e.g., via tooltip or help icon). |
| `labels` | object | **0..1** (OPTIONAL) | Alternative display labels keyed by context name. Well-known context names include `"short"`, `"pdf"`, `"csv"`, and `"accessibility"`. Implementations MAY define additional context names. |

#### 4.2.2 Group Items

A **Group** Item is a structural container. It organizes child Items into
logical sections and MAY represent repeatable (one-to-many) data collections.

```json
{
  "key": "line_items",
  "type": "group",
  "label": "Line Items",
  "repeatable": true,
  "minRepeat": 1,
  "maxRepeat": 50,
  "children": []
}
```

Group-specific properties:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `children` | array of Item | **1..1** (REQUIRED) | Ordered list of child Items. MAY be empty. Defines the sub-tree rooted at this Group. |
| `repeatable` | boolean | **0..1** (OPTIONAL) | When `true`, this Group represents a one-to-many collection. Each repetition creates an independent copy of the Group's `children` in the Response data. Default: `false`. |
| `minRepeat` | integer | **0..1** (OPTIONAL) | Minimum number of repetitions. Applicable only when `repeatable` is `true`. MUST be a non-negative integer. Default: `0`. If `minRepeat` is greater than zero, the implementation MUST pre-populate that many empty repetitions when a new Response is created. |
| `maxRepeat` | integer | **0..1** (OPTIONAL) | Maximum number of repetitions. Applicable only when `repeatable` is `true`. MUST be a positive integer, or absent for unbounded. If present, MUST be greater than or equal to `minRepeat`. Implementations MUST prevent the user from adding repetitions beyond this limit. |

A non-repeatable Group (the default) is rendered as a single structural
section. Its `children` appear exactly once in the Response data.

#### 4.2.3 Field Items

A **Field** Item represents a single data-entry point. Each Field produces
exactly one value in the Response data (or one value per repetition if the
Field is inside a repeatable Group).

```json
{
  "key": "amount",
  "type": "field",
  "dataType": "decimal",
  "label": "Award Amount",
  "description": "Total federal award amount",
  "precision": 2,
  "prefix": "$",
  "children": []
}
```

Field-specific properties:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `dataType` | string | **1..1** (REQUIRED) | The value type of this Field. MUST be one of the core data types defined below. |
| `precision` | integer | **0..1** (OPTIONAL) | Number of decimal places. Applicable only when `dataType` is `"decimal"`. Implementations SHOULD round or constrain input to this precision. |
| `prefix` | string | **0..1** (OPTIONAL) | Display prefix rendered before the input (e.g., `"$"`). This is a presentation hint only; the prefix MUST NOT appear in the stored data value. |
| `suffix` | string | **0..1** (OPTIONAL) | Display suffix rendered after the input (e.g., `"%"`). This is a presentation hint only; the suffix MUST NOT appear in the stored data value. |
| `options` | array \| string (URI) | **0..1** (OPTIONAL) | Applicable when `dataType` is `"choice"` or `"multiChoice"`. If an array, each element MUST be an object with at least `value` (string, REQUIRED) and `label` (string, REQUIRED) properties. If a string, it MUST be a URI referencing an external option set. |
| `initialValue` | any | **0..1** (OPTIONAL) | Static initial value assigned when a new Response is created. The value MUST conform to the Field's `dataType`. Distinct from the Bind `default` property (see §4.3). |
| `children` | array of Item | **0..1** (OPTIONAL) | Child items. Fields MAY contain children to model dependent sub-questions. When present, the children are contextually tied to the Field's value. |

**Core Data Types:**

| Data Type | JSON Representation | Description |
|---|---|---|
| `"string"` | string | Short-form text. Single line. |
| `"text"` | string | Long-form text. May span multiple lines. |
| `"integer"` | number (integer) | Whole number without fractional component. |
| `"decimal"` | number | Number with optional fractional component. |
| `"boolean"` | boolean | `true` or `false`. |
| `"date"` | string | Calendar date in `YYYY-MM-DD` format ([ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html)). |
| `"dateTime"` | string | Date and time in ISO 8601 format (e.g., `"2025-01-15T10:30:00Z"`). |
| `"time"` | string | Time of day in `HH:MM:SS` format (ISO 8601). |
| `"uri"` | string | A syntactically valid URI per RFC 3986. |
| `"attachment"` | object | A file attachment. The object MUST contain `contentType` (string, MIME type) and `url` or `data` (Base64-encoded content). |
| `"choice"` | string | A single selection from a defined set of options. The stored value is the `value` property of the selected option. |
| `"multiChoice"` | array of string | Multiple selections from a defined set of options. Each element is the `value` property of a selected option. |

Implementations MAY support additional data types via the `extensions`
mechanism. Unrecognized data types MUST be treated as `"string"` for storage
and SHOULD produce a warning.

#### 4.2.4 Display Items

A **Display** Item is a read-only, non-data-producing element. It is used for
instructions, headings, and informational text. Display Items do NOT appear in
the Response data.

```json
{
  "key": "instructions",
  "type": "display",
  "label": "Complete all fields below. Required fields are marked with an asterisk."
}
```

Display-specific constraints:

- Display Items MUST NOT have `children`. If `children` is present, it MUST be
  an empty array.
- Display Items MUST NOT have a `dataType`.
- Binds referencing a Display Item's key MAY use only the `relevant` property.
  All other bind properties (`required`, `calculate`, `constraint`, `readonly`)
  are meaningless for Display Items and MUST be ignored.

### 4.3 Bind Schema

A **Bind** attaches behavioral expressions to one or more data nodes
identified by a path expression. Binds are the primary mechanism for declaring
dynamic behavior — calculated values, conditional relevance, input constraints,
and requiredness — without embedding logic in the item tree.

```json
{
  "path": "budget_section.line_items[*].amount",
  "required": "true",
  "readonly": "false",
  "relevant": "$budget_section.has_budget = true",
  "calculate": null,
  "constraint": "$ >= 0",
  "default": "0"
}
```

#### 4.3.1 Bind Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `path` | string | **1..1** (REQUIRED) | Path expression identifying the data node(s) this Bind targets. Uses dot notation for nesting and `[*]` for repeatable groups. The path determines the **evaluation context** for all expressions on this Bind. See §4.3.3 for path syntax. |
| `calculate` | string (FEL expression) | **0..1** (OPTIONAL) | Expression whose result replaces the node's value on each recalculation cycle. A node with a `calculate` Bind is implicitly `readonly` unless `readonly` is explicitly set to `"false"`. The expression is evaluated in the context of the node identified by `path`. |
| `relevant` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Relevance predicate. When the expression evaluates to `false`, the targeted node and all its descendants are **non-relevant**. Non-relevant nodes are excluded from submission (see §5.6) and their validation rules MUST NOT execute. |
| `required` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Requiredness predicate. When the expression evaluates to `true`, the targeted node MUST have a non-empty value for the Response to pass validation with respect to this node. A value is "empty" if it is `null`, an empty string `""`, or an empty array `[]`. |
| `readonly` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Read-only predicate. When `true`, the node SHOULD NOT be modified by direct user input. Implementations MUST still allow programmatic modification (e.g., via `calculate`). |
| `constraint` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Additional validity predicate evaluated after type checking and `required` checking. The token `$` within this expression is bound to the current value of the targeted node. The constraint passes when the expression evaluates to `true`. |
| `constraintMessage` | string | **0..1** (OPTIONAL) | Human-readable message to display when `constraint` evaluates to `false`. If absent, implementations SHOULD generate a generic failure message. |
| `default` | any | **0..1** (OPTIONAL) | Value to assign when a previously non-relevant node becomes relevant again. This is distinct from `initialValue` on the Item: `initialValue` is applied once at Response creation; `default` is applied on each relevance transition from non-relevant to relevant. |
| `disabledDisplay` | string | **0..1** (OPTIONAL) | Presentation hint for non-relevant items. MUST be one of `"hidden"` or `"protected"`. When `"hidden"`, non-relevant items are removed from the visual layout. When `"protected"`, non-relevant items remain visible but are rendered as disabled/greyed-out. Default: `"hidden"`. (Borrowed from FHIR R5 Questionnaire.) |

#### 4.3.2 Inheritance Rules

Bind properties interact across the item hierarchy as follows:

- **`relevant`:** Inherited via logical AND. If any ancestor of a node is
  non-relevant, the node is non-relevant regardless of its own `relevant`
  expression. Implementations MUST enforce this: a child cannot be relevant
  when its parent is not.

- **`readonly`:** Inherited via logical OR. If any ancestor of a node is
  read-only, the node is read-only regardless of its own `readonly`
  expression. Implementations MUST enforce this: a child cannot be editable
  when its parent is read-only.

- **`required`:** NOT inherited. A required parent does not make its children
  required, and a required child does not make its parent required. Each
  `required` declaration stands alone.

- **`calculate`:** NOT inherited. Calculations execute only on the specific
  node targeted by the Bind.

- **`constraint`:** NOT inherited. Constraints are evaluated only against the
  specific node targeted by the Bind.

#### 4.3.3 Path Syntax

Bind paths use dot-separated segments to navigate the item tree. The following
forms are defined:

| Pattern | Meaning | Example |
|---|---|---|
| `fieldKey` | A root-level field | `entity_name` |
| `groupKey.fieldKey` | A field nested inside a group | `budget_section.total_budget` |
| `groupKey[*].fieldKey` | A field inside each repetition of a repeatable group | `line_items[*].amount` |
| `groupKey[@index = N].fieldKey` | A field in a specific repetition (1-based index) | `line_items[@index = 1].amount` |
| `groupA.groupB[*].fieldKey` | Deep nesting across multiple groups | `budget_section.line_items[*].amount` |

The `[*]` wildcard MUST be used when a Bind applies uniformly to all
repetitions of a repeatable group. Index-based addressing (`[@index = N]`)
SHOULD be used only in exceptional circumstances (e.g., binding a calculation
to the first repetition only).

A path MUST resolve to at least one Item `key` in the Definition. If a path
does not resolve, implementations MUST report a Definition error.

### 4.4 Instance Schema

An **Instance** is a named secondary data source available to expressions
within the Definition. Instances provide cross-referencing capability — for
example, validating against prior-year data or populating option lists from
external registries.

Instances are declared as properties of the top-level `instances` object. The
property name serves as the instance's identifier.

```json
{
  "instances": {
    "priorYear": {
      "source": "https://api.example.gov/responses/2024/{{entityId}}",
      "static": false,
      "schema": {
        "total_expenditures": "decimal",
        "entity_name": "string"
      }
    },
    "stateCodes": {
      "source": "https://api.example.gov/reference/states",
      "static": true,
      "data": [
        {"code": "AL", "name": "Alabama"},
        {"code": "AK", "name": "Alaska"}
      ]
    }
  }
}
```

#### 4.4.1 Instance Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `source` | string (URI) | **0..1** (OPTIONAL) | URL from which to fetch the instance data at runtime. MAY contain `{{paramName}}` template variables that are resolved by the implementation at runtime. Template variable resolution is implementation-defined. |
| `static` | boolean | **0..1** (OPTIONAL) | If `true`, the instance data does not change during the lifetime of a single form session. Implementations MAY cache static instance data aggressively. Default: `false`. |
| `data` | any | **0..1** (OPTIONAL) | Inline instance data. If both `source` and `data` are present, `data` serves as the fallback when the `source` is unavailable. If only `data` is present, the instance is fully inline. |
| `schema` | object | **0..1** (OPTIONAL) | Type declarations for the instance's fields. Keys are field names; values are data type strings (using the same core data types defined in §4.2.3). Implementations SHOULD use the schema for type coercion and expression type-checking. |

At least one of `source` or `data` MUST be present. An Instance with neither
MUST be rejected as a Definition error.

#### 4.4.2 Referencing Instances in Expressions

Instance data is accessed in FEL expressions via the `@instance()` function:

```
@instance('priorYear').total_expenditures
@instance('stateCodes')[code = 'CA'].name
```

The argument to `@instance()` MUST be a string literal matching an instance
name declared in the `instances` object. References to undeclared instances
MUST produce an evaluation error.

When instance data is unavailable (e.g., a network fetch fails and no `data`
fallback exists), `@instance()` MUST return `null`. Expressions SHOULD be
authored defensively to handle `null` instance data.


### 4.5 Variables

**Variables** are named computed values with lexical scoping. They provide a
mechanism for defining intermediate calculations that can be referenced across
multiple Binds, Shapes, and other expressions without repetition. The design
is borrowed from FHIR SDC's `variable` extension.

Variables are declared in the top-level `variables` array.

```json
{
  "variables": [
    {
      "name": "totalBudget",
      "expression": "sum($line_items[*].amount)",
      "scope": "budget_section"
    },
    {
      "name": "priorYearTotal",
      "expression": "@instance('priorYear').total_expenditures",
      "scope": "#"
    }
  ]
}
```

#### 4.5.1 Variable Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `name` | string | **1..1** (REQUIRED) | Variable name. MUST match `[a-zA-Z][a-zA-Z0-9_]*`. Referenced in FEL expressions as `@name` (e.g., `@totalBudget`). MUST be unique within its scope. |
| `expression` | string (FEL expression) | **1..1** (REQUIRED) | The expression that computes this variable's value. Evaluated in the context of the scope item. |
| `scope` | string | **0..1** (OPTIONAL) | The Item `key` this variable is scoped to. The variable is visible to expressions evaluated on that Item and all of its descendants. The special value `"#"` denotes definition-wide scope (visible everywhere). Default: `"#"`. |

#### 4.5.2 Evaluation Semantics

Variables are **continuously recalculated**. Whenever any dependency of a
variable's expression changes, the variable's value MUST be recomputed before
any dependent expressions are evaluated. This is analogous to XForms
`calculate` and FHIR SDC `calculatedExpression`.

Variables MUST NOT form circular dependencies. If a circular dependency is
detected, implementations MUST report a Definition error and MUST NOT attempt
evaluation.

The evaluation order of variables MUST respect the dependency graph:
if variable A depends on variable B, then B MUST be evaluated before A.
Within the same dependency tier, evaluation order is implementation-defined.

For one-time initialization semantics (compute once at Response creation,
never recalculate), use `initialValue` on the Item rather than a variable.

---

## 5. Validation

### 5.1 Severity Levels

Formspec defines three severity levels for validation results, borrowed from
[SHACL](https://www.w3.org/TR/shacl/) with modified conformance semantics:

| Level | Code | Blocks Submission | Meaning |
|---|---|---|---|
| Error | `"error"` | **Yes** | The data is invalid and MUST be corrected before the Response can be submitted. |
| Warning | `"warning"` | **No** | Advisory. The data is accepted but flagged for attention. |
| Info | `"info"` | **No** | Informational. No user action is required. |

**Conformance Rule (VC-01):** A Response is **valid** if and only if zero
validation results with severity `"error"` exist. Warning-level and
info-level results do NOT affect validity. This differs from SHACL, where any
validation result of any severity indicates non-conformance.

Implementations MUST clearly distinguish severity levels in the user
interface. Error-level results SHOULD be presented with prominent visual
treatment (e.g., red borders, error icons). Warning-level results SHOULD be
visually distinct from errors (e.g., yellow/amber treatment).


### 5.2 Validation Shape Schema

A **Shape** is a named, composable validation rule set. Shapes provide
validation logic that operates at a higher level than individual Bind
constraints — cross-field checks, conditional rules, and composite
validations. The design is borrowed from SHACL's shape concept, adapted for
JSON data.

```json
{
  "shapes": [
    {
      "id": "budget_total_check",
      "target": "budget_section",
      "severity": "error",
      "message": "Line item amounts must sum to the total budget",
      "code": "BUDGET_SUM_MISMATCH",
      "constraint": "sum($line_items[*].amount) = $total_budget"
    }
  ]
}
```

#### 5.2.1 Shape Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `id` | string | **1..1** (REQUIRED) | Unique identifier for this Shape. MUST be unique across all Shapes in the Definition. MUST match `[a-zA-Z][a-zA-Z0-9_]*`. |
| `target` | string | **1..1** (REQUIRED) | Path expression identifying the data node(s) this Shape validates. Uses the same path syntax as Binds (§4.3.3). The special value `"#"` targets the entire Response root. |
| `severity` | string | **0..1** (OPTIONAL) | Severity of the validation result produced when this Shape fails. MUST be one of `"error"`, `"warning"`, `"info"`. Default: `"error"`. |
| `constraint` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Validity predicate. The expression evaluates to `true` when the data is valid and `false` when it is invalid. REQUIRED unless the Shape uses composition operators (`and`, `or`, `not`, `xone`). |
| `message` | string | **1..1** (REQUIRED) | Human-readable failure message displayed when the Shape's constraint evaluates to `false`. MAY contain `{{expression}}` interpolation sequences, where `expression` is a FEL expression evaluated in the Shape's target context. |
| `code` | string | **0..1** (OPTIONAL) | Machine-readable error code. Implementations SHOULD use these codes for programmatic error handling, localization lookups, and API responses. |
| `context` | object | **0..1** (OPTIONAL) | Additional context data included in the ValidationResult when the Shape fails. Keys are context field names; values are FEL expressions evaluated in the Shape's target context at the time of failure. |

#### 5.2.2 Composition Operators

Shapes MAY be composed from other Shapes using the following operators,
borrowed from SHACL's logical constraint components:

| Operator | Type | Semantics |
|---|---|---|
| `and` | array of string (Shape `id` references) | The Shape passes if and only if **all** referenced Shapes pass. |
| `or` | array of string (Shape `id` references) | The Shape passes if and only if **at least one** referenced Shape passes. |
| `not` | string (Shape `id` reference) | The Shape passes if and only if the referenced Shape **does NOT** pass. |
| `xone` | array of string (Shape `id` references) | The Shape passes if and only if **exactly one** referenced Shape passes. |

When a composition operator is present, the `constraint` property is OPTIONAL.
If both `constraint` and a composition operator are present, they are combined
with implicit AND: the Shape passes only if the `constraint` evaluates to
`true` AND the composition operator's condition is met.

Example — disjunctive composition:

```json
{
  "id": "contact_info_complete",
  "target": "#",
  "severity": "error",
  "message": "Provide either email or phone number",
  "or": ["has_email", "has_phone"]
}
```

Composition MAY be nested: a referenced Shape MAY itself use composition
operators. Implementations MUST detect circular references among Shapes and
report a Definition error.

### 5.3 Validation Result Schema

Each failed constraint — whether from a Bind `constraint`, a Bind `required`
check, a type check, or a Shape — produces a structured **ValidationResult**.
The schema is borrowed from SHACL's Validation Result vocabulary.

```json
{
  "path": "budget_section.total_budget",
  "severity": "error",
  "message": "Line item amounts must sum to the total budget",
  "code": "BUDGET_SUM_MISMATCH",
  "shapeId": "budget_total_check",
  "value": 50000,
  "context": {
    "expectedTotal": 75000,
    "actualTotal": 50000
  }
}
```

#### 5.3.1 ValidationResult Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `path` | string | **1..1** (REQUIRED) | The data path of the node that failed validation. Uses the same path syntax as Binds (§4.3.3). For repeat instances, the path MUST include the concrete index (e.g., `line_items[2].amount`), not the wildcard `[*]`. |
| `severity` | string | **1..1** (REQUIRED) | The severity level. MUST be one of `"error"`, `"warning"`, `"info"`. |
| `message` | string | **1..1** (REQUIRED) | Human-readable description of the failure. All `{{expression}}` interpolation sequences MUST be resolved before this value is surfaced. |
| `code` | string | **0..1** (OPTIONAL) | Machine-readable error code, propagated from the Shape or generated by the implementation for built-in checks. |
| `shapeId` | string | **0..1** (OPTIONAL) | The `id` of the Shape that produced this result, if applicable. MUST be absent for results produced by Bind constraints, type checks, or required checks. |
| `value` | any | **0..1** (OPTIONAL) | The actual value of the node at the time of validation failure. Implementations SHOULD include this for debugging purposes. For attachment fields, the value SHOULD be omitted or replaced with metadata (filename, size) to avoid excessive payload size. |
| `constraint` | string | **0..1** (OPTIONAL) | The constraint expression that failed, as authored in the Definition. Included for debugging and logging. Implementations MUST NOT display raw constraint expressions to end users. |
| `context` | object | **0..1** (OPTIONAL) | Additional context data, propagated from the Shape's `context` property. Keys are context field names; values are the evaluated results of the context expressions. |

Implementations MUST produce ValidationResults for all of the following
condition types:

1. **Type mismatch** — the value does not conform to the Field's `dataType`.
2. **Required violation** — a required node has an empty value.
3. **Bind constraint failure** — a Bind's `constraint` evaluates to `false`.
4. **Shape constraint failure** — a Shape's `constraint` or composition evaluates to invalid.
5. **Repeat cardinality violation** — a repeatable Group has fewer than `minRepeat` or more than `maxRepeat` repetitions.


### 5.4 Validation Report Schema

A **ValidationReport** aggregates all ValidationResults for a given Response
at a point in time.

```json
{
  "valid": true,
  "results": [],
  "counts": {
    "error": 0,
    "warning": 2,
    "info": 1
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### 5.4.1 ValidationReport Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `valid` | boolean | **1..1** (REQUIRED) | `true` if and only if the `results` array contains zero entries with severity `"error"`. Warning-level and info-level results do NOT affect this determination. |
| `results` | array of ValidationResult | **1..1** (REQUIRED) | All validation results, regardless of severity. The array MUST include results from Bind constraints, Shape constraints, type checks, required checks, repeat cardinality checks, and any external validation results (§5.7). |
| `counts` | object | **1..1** (REQUIRED) | Counts of results by severity level. MUST contain the keys `"error"`, `"warning"`, and `"info"`, each with an integer value ≥ 0. |
| `timestamp` | string (dateTime) | **1..1** (REQUIRED) | ISO 8601 date-time indicating when validation was performed. |

Implementations MUST ensure that `valid` is consistent with `counts.error`:
`valid` MUST be `true` when `counts.error` is `0` and `false` otherwise.


### 5.5 Validation Modes

Formspec defines three validation modes controlling when the validation
pipeline executes. Validation mode is a **runtime concern**, not part of the
Definition. Implementations MUST support all three modes and MUST support
switching between modes at runtime without data loss.

| Mode | Code | Behavior |
|---|---|---|
| Continuous | `"continuous"` | Validation executes on every value change. Results are immediately available after each edit. This is the RECOMMENDED default for interactive editing. |
| Deferred | `"deferred"` | Validation executes only on explicit request — for example, on save, submit, section navigation, or programmatic invocation. This mode allows saving incomplete or partially invalid data without user friction. |
| Disabled | `"disabled"` | Validation is skipped entirely. No ValidationResults are produced. This mode is intended for bulk import, data migration, and administrative override scenarios. |

**Critical Rule (VE-05):** Saving data MUST never be blocked by validation.
Regardless of the active validation mode, an implementation MUST allow the
user (or calling system) to persist the current state of the Response data.
Validation results are **advisory** until the point of submission. Only the
submission action requires `valid = true` (i.e., zero error-level results).

Implementations MAY offer a `"continuous-soft"` variant where validation runs
continuously but results are displayed only after the user has interacted with
(blurred) the relevant field. This is a presentation-layer concern and does
not constitute a distinct validation mode.


### 5.6 Non-Relevant Field Handling

When a node's `relevant` Bind expression evaluates to `false` (or when any
ancestor is non-relevant per the inheritance rules in §4.3.2), the following
rules apply:

1. **Validation suppression.** Validation rules targeting the non-relevant
   node MUST NOT execute. The node MUST NOT produce any ValidationResults.
   This includes Bind constraints, Shape constraints, required checks, and
   type checks.

2. **Submission exclusion.** The node's value SHOULD be excluded from the
   submitted Response instance. Definitions MAY opt out of this behavior by
   setting `excludeNonRelevant: false` at the Definition level, in which case
   non-relevant values are retained in the submitted data. The default
   behavior is exclusion.

3. **Required suppression.** A non-relevant node is never required, regardless
   of its `required` Bind. Implementations MUST NOT produce a required-
   violation ValidationResult for a non-relevant node.

4. **Calculation continuation.** A non-relevant node's `calculate` Bind
   MUST continue to evaluate. The computed value exists in the in-memory data
   model and MAY be referenced by other expressions. However, the value is
   excluded from the submitted instance per rule (2) unless opted out.

5. **Re-relevance.** When a previously non-relevant node becomes relevant
   again, its value is restored. If a `default` is declared on the node's
   Bind, the `default` value MUST be applied. If no `default` is declared,
   the node retains whatever value it had before becoming non-relevant.


### 5.7 External Validation Results

External systems — server-side APIs, third-party validators, business rule
engines — MAY inject validation results into the Formspec validation pipeline.
This enables validation logic that cannot be expressed in FEL (e.g., database
lookups, cross-system consistency checks).

```json
{
  "path": "entity.ein",
  "severity": "error",
  "message": "EIN not found in IRS database",
  "code": "EIN_NOT_FOUND",
  "source": "external",
  "sourceId": "irs-ein-lookup"
}
```

#### 5.7.1 External Result Requirements

External validation results conform to the ValidationResult schema (§5.3)
with the following additional properties and constraints:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `source` | string | **1..1** (REQUIRED) | MUST be the string `"external"`. This property distinguishes externally injected results from those derived from the Definition's Binds and Shapes. |
| `sourceId` | string | **0..1** (OPTIONAL) | Identifier of the external system that produced this result. Implementations SHOULD include this for audit and debugging purposes. |

#### 5.7.2 Merging Rules

- External results MUST be merged into the ValidationReport alongside
  Definition-derived results.
- External results with severity `"error"` MUST be included in the `valid`
  determination. An external error blocks submission, just as a
  Definition-derived error does.
- External results MUST be included in the `counts` aggregation.
- Implementations MUST support injecting external results at any time during
  the form session — not only at submission.
- When the same `path` + `code` combination is injected multiple times, the
  most recent result SHOULD replace the prior one (idempotent injection).
- Implementations SHOULD provide a mechanism to clear external results (e.g.,
  when the external system confirms the issue has been resolved).

---

## 6. Versioning & Evolution

### 6.1 Identity Model

A Definition is identified by its canonical `url`. The `url` represents the
logical form — it is stable across versions. All versions of the same logical
form share the same `url` and differ only in their `version` property.

The **fully qualified reference** to a specific Definition version uses the
pipe syntax:

```
url|version
```

For example:

```
https://example.gov/forms/annual-report|2025.1.0
```

When a reference omits the `|version` suffix, it refers to the logical form
without specifying a version. The resolution semantics of unversioned
references are context-dependent:

- In a Response's `definition` property, the version MUST be specified.
  Unversioned references are invalid in this context (§6.4).
- In `derivedFrom`, an unversioned reference indicates derivation from the
  logical form in general, without pinning to a specific version.
- In `$ref` composition, an unversioned reference SHOULD resolve to the
  latest `"active"` version at assembly time.


### 6.2 Version Algorithms

The `versionAlgorithm` property governs interpretation and ordering of
`version` strings. Conforming implementations MUST support all four
algorithms:

| Algorithm | Format | Comparison Semantics |
|---|---|---|
| `"semver"` | `MAJOR.MINOR.PATCH` | Per [Semantic Versioning 2.0.0](https://semver.org/). Pre-release labels and build metadata are supported (e.g., `1.0.0-rc.1`). |
| `"date"` | `YYYY.MM.DD` | Chronological comparison. Each segment is compared numerically: year, then month, then day. |
| `"integer"` | Integer string (e.g., `"42"`) | Numeric comparison. The version string MUST be parseable as a non-negative integer. |
| `"natural"` | Any string | No ordering is defined. Versions can only be compared for equality. Implementations MUST NOT assume any ordering when `versionAlgorithm` is `"natural"`. |

When `versionAlgorithm` is absent, implementations MUST default to
`"semver"`. A version string that does not conform to its declared algorithm
MUST be treated as a Definition error.


### 6.3 Status Lifecycle

Every Definition MUST declare a `status`. The permitted values and their
lifecycle transitions are:

```
  draft ────▶ active ────▶ retired
    ▲                        │
    └──────────────────────┘
    (new version, not same Definition)
```

- **`"draft"`** — The Definition is under development. It SHOULD NOT be used
  for production data collection. Implementations MAY restrict access to draft
  Definitions to authoring tools and preview environments.

- **`"active"`** — The Definition is in production. New Responses SHOULD
  reference active Definitions. Multiple versions of the same logical form
  MAY be active simultaneously (e.g., during a transition period).

- **`"retired"`** — The Definition is no longer in use for new data
  collection. Existing Responses that reference a retired Definition remain
  valid and MUST still be processable. New Responses SHOULD NOT reference
  retired Definitions. Implementations MAY enforce this as a hard constraint.

**Transition constraints:**

- A Definition MUST NOT transition backward: `active → draft` and
  `retired → active` are forbidden for the *same* Definition version.
- To revise a retired form, authors MUST create a new version with status
  `"draft"` and progress it through the lifecycle independently.
- The transition `draft → active` SHOULD be gated by a validation step
  confirming that the Definition is internally consistent (all paths resolve,
  no circular dependencies, all referenced Shapes exist, etc.).


### 6.4 Response Pinning

A Response MUST reference a specific Definition version using the fully
qualified `url|version` syntax:

```json
{
  "definition": "https://example.gov/forms/annual-report|2025.1.0",
  "data": {},
  "meta": {
    "created": "2025-01-15T10:00:00Z",
    "modified": "2025-01-15T14:30:00Z",
    "status": "in-progress"
  }
}
```

**Pinning Rule (VP-01):** A Response is always validated against the
Definition version it references, even if a newer version of the same logical
form exists. This guarantees that existing Responses are never retroactively
invalidated by Definition changes.

**Implication:** If a Definition author discovers a flaw in version `2025.1.0`
after Responses have been collected, they MUST publish a new version
(e.g., `2025.1.1`) and migrate Responses explicitly. They MUST NOT alter
version `2025.1.0` in place.

**Immutability Rule (VP-02):** Once a Definition version reaches `"active"`
status, its content MUST NOT be modified. Any change — however minor —
requires a new version. This ensures that the `url|version` pair is a stable,
immutable reference.


### 6.5 Variant Derivation

A Definition MAY declare `derivedFrom` to indicate it is a variant of another
Definition. Common derivation scenarios include:

- **Year-over-year updates** — `annual-report|2025.1.0` derived from
  `annual-report|2024.1.0`.
- **Long form / short form** — `annual-report-short|1.0.0` derived from
  `annual-report|2025.1.0`.
- **Domain-specific specialization** — `annual-report-healthcare|1.0.0`
  derived from `annual-report|2025.1.0`.

**Semantics:** `derivedFrom` is **informational only**. It does NOT imply
behavioral inheritance, structural inclusion, or any runtime linkage between
the parent and derived Definitions. The derived Definition is a fully
independent artifact.

`derivedFrom` enables the following tooling capabilities:

1. **Change analysis** — Tooling MAY compare the derived Definition to its
   parent to highlight structural and behavioral differences.
2. **Pre-population** — Implementations MAY use `derivedFrom` to identify
   Responses to the parent Definition that can serve as pre-population sources
   for the derived Definition, mapping data by matching `key` values.
3. **Lineage tracking** — Audit systems MAY use `derivedFrom` to construct
   the full derivation history of a Definition.


### 6.6 Modular Composition

Definitions MAY include items from other Definitions via the `$ref` property
on a Group Item. This enables reuse of common item sets (e.g., demographics,
address blocks, signature sections) across multiple Definitions.

```json
{
  "key": "demographics",
  "type": "group",
  "$ref": "https://example.gov/forms/common/demographics|1.0.0",
  "keyPrefix": "demo_"
}
```

#### 6.6.1 Composition Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `$ref` | string (URI) | **0..1** (OPTIONAL) | Canonical reference to another Definition, using the `url\|version` syntax. All root-level Items from the referenced Definition are included as children of this Group. |
| `keyPrefix` | string | **0..1** (OPTIONAL) | A string prepended to every `key` imported from the referenced Definition. This prevents key collisions when the same referenced Definition is included multiple times or when its keys conflict with the host Definition. The prefix MUST match `[a-zA-Z][a-zA-Z0-9_]*`. Borrowed from FHIR SDC's `linkIdPrefix` concept. |

#### 6.6.2 Assembly

**Assembly** is the process of resolving all `$ref` inclusions to produce a
self-contained Definition with no external references. Assembly SHOULD be
performed at **publish time** (when a Definition transitions from `"draft"` to
`"active"`). The output of assembly is a fully expanded Definition that can be
processed without access to the referenced Definitions.

Assembly rules:

1. All root-level Items from the referenced Definition MUST be inserted as
   children of the Group that declares the `$ref`.
2. If `keyPrefix` is specified, every `key` in the imported items (including
   deeply nested children) MUST be prefixed. Bind paths, Shape targets, and
   variable scopes referencing those keys MUST be updated accordingly.
3. Binds, Shapes, and Variables from the referenced Definition MUST be
   imported into the host Definition. Their paths and scopes MUST be
   rewritten to reflect the new position in the host item tree and any
   `keyPrefix` transformation.
4. If a key collision exists after prefix application, the assembler MUST
   report an error and abort.
5. `$ref` resolution MUST be recursive: if the referenced Definition itself
   contains `$ref` inclusions, those MUST be resolved as well.
6. Circular `$ref` chains MUST be detected and reported as a Definition
   error.

The assembled Definition SHOULD carry an `assembledFrom` metadata array
listing all referenced Definitions:

```json
{
  "assembledFrom": [
    {
      "url": "https://example.gov/forms/common/demographics",
      "version": "1.0.0",
      "keyPrefix": "demo_"
    }
  ]
}
```

This metadata is informational and MUST NOT affect runtime behavior.
