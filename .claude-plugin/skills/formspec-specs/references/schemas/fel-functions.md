# FEL Functions Schema Reference Map

> schemas/fel-functions.schema.json -- 994 lines -- FEL standard library function catalog

## Overview

This schema defines the normative catalog of all built-in functions in FEL (Formspec Expression Language) v1.0. It serves as the authoritative reference for function signatures, parameter types, return types, null handling, and behavioral semantics. Both the TypeScript implementation (`packages/formspec-engine/src/fel/`) and the Python implementation (`src/formspec/fel/`) must conform to the signatures and semantics defined here. The schema is self-contained -- it includes both the structural definitions (`$defs`) and the actual function data (`functions` array) in the same document.

## Top-Level Structure

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$formspecFelFunctions` | `string`, const `"1.0"` | **Yes** | FEL function catalog specification version. MUST be `"1.0"`. Has `x-lm.critical: true`. |
| `version` | `const "1.0"` | No | Fixed version identifier for this catalog edition. |
| `functions` | `array` of `FunctionEntry` | No | Ordered list of all built-in FEL functions with full metadata. |

- **`$schema`**: `https://json-schema.org/draft/2020-12/schema`
- **`$id`**: `https://formspec.org/specs/fel/functions/1.0`
- **`title`**: "FEL Function Catalog"
- **`type`**: `object`
- **`required`**: `["$formspecFelFunctions"]`

Note: The document itself instantiates `version` and `functions` at the top level (lines 116-993), making it both a schema and a data document.

## Function Catalog

61 functions total, organized into 9 categories.

### Aggregate Functions (6)

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `sum` | Sums all numeric elements in the array. Extracts `.amount` from money objects. Non-finite values treated as 0. | `values: array` | `number` | No | Null elements skipped. Null argument returns 0. |
| `count` | Returns the number of elements in the array, including nulls. | `values: array` | `number` | No | Null argument returns 0. Null elements ARE counted. |
| `countWhere` | Counts array elements for which the predicate evaluates to true. `$` is rebound per element. Short-circuits (predicate NOT pre-evaluated). | `values: array`, `predicate: boolean` | `number` | No | Null array returns 0. Null predicate result counts as false. |
| `avg` | Arithmetic mean of all finite numeric elements. Skips nulls and non-numeric values. | `values: array` | `number` | No | Null/non-numeric elements skipped. Empty array or all-null returns 0. |
| `min` | Returns the smallest finite numeric value in the array. | `values: array` | `number` | No | Null/non-numeric elements skipped. Empty array returns 0. |
| `max` | Returns the largest finite numeric value in the array. | `values: array` | `number` | No | Null/non-numeric elements skipped. Empty array returns 0. |

### String Functions (11)

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `length` | Returns the number of characters in the string. | `value: string` | `number` | No | Null returns 0. |
| `contains` | Returns true if haystack contains needle. Case-sensitive. | `haystack: string`, `needle: string` | `boolean` | No | Null haystack treated as empty string. |
| `startsWith` | Returns true if value starts with prefix. Case-sensitive. | `value: string`, `prefix: string` | `boolean` | No | Null value treated as empty string. |
| `endsWith` | Returns true if value ends with suffix. Case-sensitive. | `value: string`, `suffix: string` | `boolean` | No | Null value treated as empty string. |
| `substring` | Extracts substring from 1-based position. If length omitted, extracts to end. | `value: string`, `start: number`, `length?: number` | `string` | No | Null value treated as empty string. |
| `replace` | Replaces ALL occurrences of literal search string (NOT regex). | `value: string`, `search: string`, `replacement: string` | `string` | No | Null value treated as empty string. |
| `upper` | Converts string to uppercase. | `value: string` | `string` | No | Null treated as empty string, returns empty string. |
| `lower` | Converts string to lowercase. | `value: string` | `string` | No | Null treated as empty string, returns empty string. |
| `trim` | Removes leading and trailing whitespace. | `value: string` | `string` | No | Null treated as empty string, returns empty string. |
| `matches` | Returns true if string matches regex pattern. Pattern syntax follows host language (ECMA-262 for TS, Python `re` for Python). | `value: string`, `pattern: string` | `boolean` | No | Null value treated as empty string. |
| `format` | Positional string interpolation with `{0}`, `{1}`, etc. placeholders. Null args become empty string. Numbers strip trailing zeros. Booleans become 'true'/'false'. | `template: string`, `args: any...` | `string` | Yes | Null template returns empty string. Null arguments substituted as empty string. |

### Numeric Functions (5)

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `round` | Rounds to specified decimal places using banker's rounding (round half to even). | `value: number`, `precision?: number` | `number` | No | Null treated as 0. |
| `floor` | Returns the largest integer less than or equal to the value. | `value: number` | `number` | No | Null treated as 0. |
| `ceil` | Returns the smallest integer greater than or equal to the value. | `value: number` | `number` | No | Null treated as 0. |
| `abs` | Returns the absolute value of the number. | `value: number` | `number` | No | Null treated as 0. |
| `power` | Returns base raised to the power of exponent. | `base: number`, `exponent: number` | `number` | No | Null arguments treated as 0. |

### Date Functions (12)

| Function | Description | Parameters | Return Type | Variadic? | Deterministic? | Null Handling |
|----------|-------------|------------|-------------|-----------|----------------|---------------|
| `today` | Returns current date as ISO 8601 string (YYYY-MM-DD). | _(none)_ | `date` | No | **No** | N/A -- no parameters. |
| `now` | Returns current dateTime as ISO 8601 string. | _(none)_ | `dateTime` | No | **No** | N/A -- no parameters. |
| `year` | Extracts 4-digit year from a date. | `date: date` | `number` | No | Yes | Null returns null. |
| `month` | Extracts month (1-12) from a date. | `date: date` | `number` | No | Yes | Null returns null. |
| `day` | Extracts day of month (1-31) from a date. | `date: date` | `number` | No | Yes | Null returns null. |
| `hours` | Extracts hour (0-23) from a dateTime or time value. | `dateTime: dateTime` | `number` | No | Yes | Null returns null. |
| `minutes` | Extracts minute (0-59) from a dateTime or time value. | `dateTime: dateTime` | `number` | No | Yes | Null returns null. |
| `seconds` | Extracts second (0-59) from a dateTime or time value. | `dateTime: dateTime` | `number` | No | Yes | Null returns null. |
| `time` | Constructs HH:MM:SS time string from numeric components. | `hours: number`, `minutes: number`, `seconds: number` | `time` | No | Yes | Null components treated as 0. |
| `dateDiff` | Returns date1 - date2 in the specified unit. Positive when date1 > date2. Incomplete periods truncated for months/years. | `date1: date`, `date2: date`, `unit: string` (enum: `days`, `months`, `years`) | `number` | No | Yes | Null or invalid dates return null. |
| `dateAdd` | Adds specified units to a date. Negative values subtract. Month/year overflow per host Date implementation. | `date: date`, `amount: number`, `unit: string` (enum: `days`, `months`, `years`) | `date` | No | Yes | Null date returns null. |
| `timeDiff` | Returns absolute difference between two time values. Always non-negative. | `time1: time`, `time2: time`, `unit?: string` (enum: `seconds`, `minutes`, `hours`) | `number` | No | Yes | Null times produce error. |

### Logical Functions (6)

| Function | Description | Parameters | Return Type | Variadic? | Short-Circuit? | Null Handling |
|----------|-------------|------------|-------------|-----------|----------------|---------------|
| `if` | Conditional: returns thenValue when true, elseValue when false. Only selected branch evaluated. Also available as keyword syntax: `if cond then a else b`. `if` is a reserved word, special-cased in the parser. | `condition: boolean`, `thenValue: any`, `elseValue: any` | `any` | No | **Yes** | Null condition is an evaluation error. |
| `coalesce` | Returns first non-null, non-empty-string argument. | `values: any...` | `any` | **Yes** | No | Core purpose is null handling. |
| `empty` | Returns true if value is null, undefined, empty string, or empty array. | `value: any` | `boolean` | No | No | Null returns true. |
| `present` | Inverse of `empty()`. Returns true for non-null, non-empty values. | `value: any` | `boolean` | No | No | Null returns false. |
| `selected` | For multiChoice (array): checks if option is in array. For choice (string): checks equality. | `value: any`, `option: string` | `boolean` | No | No | Null value returns false. |
| `instance` | Retrieves data from a named secondary instance. Typically invoked via `@instance("name")` syntax. Optional path drills into instance data. | `name: string`, `path?: string` | `any` | No | No | Returns null/undefined if instance not found or path doesn't exist. |

### Type Functions (9)

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `isNumber` | Returns true if value is a finite number (not NaN). | `value: any` | `boolean` | No | Null returns false. |
| `isString` | Returns true if value is a string. | `value: any` | `boolean` | No | Null returns false. |
| `isDate` | Returns true if value can be parsed as a valid date. | `value: any` | `boolean` | No | Null returns false. |
| `isNull` | Returns true if value is null, undefined, or empty string. Broader than strict null check. | `value: any` | `boolean` | No | Null returns true. |
| `typeOf` | Returns FEL type name: 'string', 'number', 'boolean', 'array', 'object', or 'null'. | `value: any` | `string` | No | Null returns 'null'. |
| `number` | Explicit cast to number. Strings parsed as numbers. Returns null if coercion fails. | `value: any` | `number` | No | Null returns null. |
| `string` | Explicit cast to string. Numbers, booleans, dates stringified. | `value: any` | `string` | No | Null returns empty string ''. |
| `boolean` | Explicit cast to boolean. Numbers: 0=false, non-zero=true. Strings: 'true'/'false'. Other values produce evaluation error. | `value: any` | `boolean` | No | Null returns false. |
| `date` | Validates and returns input as ISO 8601 date string. Invalid input produces evaluation error. | `value: any` | `date` | No | Null returns null. |

### Money Functions (5)

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `money` | Constructs a money object `{amount, currency}` from amount and ISO 4217 currency code. | `amount: number`, `currency: string` | `money` | No | Null arguments produce money object with null/undefined fields. |
| `moneyAmount` | Extracts numeric amount from a money object. | `value: money` | `number` | No | Null or non-money value returns null. |
| `moneyCurrency` | Extracts ISO 4217 currency code from a money object. | `value: money` | `string` | No | Null or non-money value returns null. |
| `moneyAdd` | Adds two money objects. Uses currency from first non-null operand. Operands SHOULD share currency; implementations MAY error on mismatch. | `a: money`, `b: money` | `money` | No | Null operand returns null. |
| `moneySum` | Sums an array of money objects. Currency from first element. All elements SHOULD share currency. | `values: array` | `money` | No | Null elements skipped. Empty array returns null. |

### MIP (Model-in-Process) Functions (4)

These functions inspect the runtime state of the form engine -- they read computed binds rather than field values. Their arguments are literal field path references, not evaluated expressions.

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `valid` | Returns true if the field at the given path has zero validation errors. | `path: string` (literal ref) | `boolean` | No | N/A -- path is literal. |
| `relevant` | Returns the computed relevance (visibility) state of the field. | `path: string` (literal ref) | `boolean` | No | N/A -- path is literal. |
| `readonly` | Returns the computed readonly state of the field. | `path: string` (literal ref) | `boolean` | No | N/A -- path is literal. |
| `required` | Returns the computed required state of the field. | `path: string` (literal ref) | `boolean` | No | N/A -- path is literal. |

### Repeat Functions (3)

These functions operate within repeatable group contexts. They access sibling field values from adjacent or ancestor repeat instances.

| Function | Description | Parameters | Return Type | Variadic? | Null Handling |
|----------|-------------|------------|-------------|-----------|---------------|
| `prev` | Returns value of the named field from the previous repeat instance (index - 1). | `fieldName: string` | `any` | No | Returns null when no previous instance exists. |
| `next` | Returns value of the named field from the next repeat instance (index + 1). | `fieldName: string` | `any` | No | Returns null when no next instance exists. |
| `parent` | Walks up the path hierarchy and returns the value of the first ancestor field matching the given name. | `fieldName: string` | `any` | No | Returns null if no ancestor field found. |

## Key Type Definitions ($defs)

### FELType

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Description** | A FEL type identifier. `any` means the function accepts or returns multiple types. `array` means `array<T>` where T is specified in the description. |
| **Enum values** | `string`, `number`, `boolean`, `date`, `dateTime`, `time`, `money`, `array`, `any`, `null` |
| **Used by** | `Parameter.type`, `FunctionEntry.returns` |

### Parameter

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Parameter name. |
| `type` | `FELType` ($ref) | Yes | -- | Parameter type from the FELType enum. |
| `description` | `string` | No | -- | What this parameter represents. |
| `required` | `boolean` | No | `true` | Whether the parameter is required. |
| `variadic` | `boolean` | No | `false` | Whether this is a variadic (rest) parameter. Must be last in the parameter list. |
| `enum` | `array` of `string` | No | -- | When present, restricts the parameter to these literal values. |

- **additionalProperties**: `false`
- **Used by**: `FunctionEntry.parameters` (array items)

### FunctionEntry

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Function name as used in FEL expressions. |
| `category` | `string` (enum) | Yes | -- | Functional category for grouping. |
| `parameters` | `array` of `Parameter` ($ref) | Yes | -- | Ordered parameter list. Variadic parameters must be last. |
| `returns` | `FELType` ($ref) | Yes | -- | Return type of the function. |
| `returnDescription` | `string` | No | -- | Clarification of return value when `returns` alone is insufficient. |
| `description` | `string` | Yes | -- | Behavior description including edge cases and constraints. |
| `nullHandling` | `string` | No | -- | How the function behaves when arguments are null. |
| `deterministic` | `boolean` | No | `true` | False if the function can return different results for the same arguments. |
| `shortCircuit` | `boolean` | No | `false` | True if the function evaluates arguments lazily. |
| `examples` | `array` of `{expression, result, note?}` | No | -- | Usage examples with expected results. |
| `sinceVersion` | `string` | No | `"1.0"` | FEL version that introduced this function. |

- **additionalProperties**: `false`
- **Used by**: Top-level `functions` array items.

### Example (inline, not named in $defs)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `expression` | `string` | Yes | FEL expression demonstrating the function. |
| `result` | `any` | Yes | Expected result value. |
| `note` | `string` | No | Additional explanation. |

## Required Fields

- `$formspecFelFunctions` (top-level) -- must be the string `"1.0"`

## Enumerations

### FELType enum
`string`, `number`, `boolean`, `date`, `dateTime`, `time`, `money`, `array`, `any`, `null`

### FunctionEntry.category enum
`aggregate`, `string`, `numeric`, `date`, `logical`, `type`, `money`, `mip`, `repeat`

### Parameter.enum (per-parameter restrictions)
- `dateDiff` / `dateAdd` parameter `unit`: `days`, `months`, `years`
- `timeDiff` parameter `unit`: `seconds`, `minutes`, `hours`

## Cross-References

This schema is self-contained. All `$ref` references are internal:

| Reference | Target |
|-----------|--------|
| `#/$defs/FunctionEntry` | Used by `properties.functions.items` |
| `#/$defs/Parameter` | Used by `FunctionEntry.parameters.items` |
| `#/$defs/FELType` | Used by `Parameter.type` and `FunctionEntry.returns` |

No external `$ref` references to other schema files.

## Extension Points

The schema itself does not define an explicit extension mechanism for custom functions. Key observations:

- **`additionalProperties: false`** on both `FunctionEntry` and `Parameter` prevents adding custom metadata properties to function entries without schema modification.
- **`sinceVersion`** (default `"1.0"`) provides a versioning mechanism for introducing new functions in future catalog versions.
- **`category` is a closed enum**: adding a new function category requires updating the enum in the schema. Current categories: `aggregate`, `string`, `numeric`, `date`, `logical`, `type`, `money`, `mip`, `repeat`.
- **Custom functions are not specified here**: the FEL runtime supports function registration at the implementation level (see `FormEngine` in the TS engine), but this schema strictly catalogs the built-in standard library. Custom/extension functions are defined through the extension registry system (`schemas/registry.schema.json`), not through this catalog.
- **`x-lm` annotations**: The `$formspecFelFunctions` property carries `x-lm.critical: true` and `x-lm.intent`, used by LLM-facing tooling to flag critical version pins.

## Validation Constraints

### Structural constraints
- Top-level object requires `$formspecFelFunctions` (the version pin, const `"1.0"`).
- `FunctionEntry` requires all of: `name`, `category`, `parameters`, `returns`, `description`.
- `Parameter` requires: `name`, `type`.
- Both `FunctionEntry` and `Parameter` set `additionalProperties: false` -- no extra properties allowed.
- Example objects require: `expression`, `result`.

### Semantic constraints (normative, not schema-enforced)
- **Variadic parameters must be last** in the parameter list (stated in `FunctionEntry.parameters.description`).
- **`countWhere` and `if` are short-circuit functions**: their `shortCircuit` property is `true`, meaning not all arguments are eagerly evaluated.
- **`today` and `now` are non-deterministic**: their `deterministic` property is `false`.
- **`if` is a reserved word**: special-cased in the parser with both function syntax `if(cond, a, b)` and keyword syntax `if cond then a else b`.
- **MIP functions (`valid`, `relevant`, `readonly`, `required`) take literal path references**: the argument is extracted as a string path, not evaluated as a general expression.
- **Money operations require currency consistency**: `moneyAdd` and `moneySum` specify that operands SHOULD have the same currency; implementations MAY error on mismatch.
- **`substring` uses 1-based indexing**: the `start` parameter is 1-based, not 0-based.
- **`round` uses banker's rounding**: round-half-to-even, not the more common round-half-up.
- **`isNull` is broader than strict null**: it also returns true for empty string, matching FEL's treatment of empty string as null-equivalent.
- **`replace` is literal, not regex**: explicitly documented as literal string match only.

### Category distribution
| Category | Count | Functions |
|----------|-------|-----------|
| `aggregate` | 6 | sum, count, countWhere, avg, min, max |
| `string` | 11 | length, contains, startsWith, endsWith, substring, replace, upper, lower, trim, matches, format |
| `numeric` | 5 | round, floor, ceil, abs, power |
| `date` | 12 | today, now, year, month, day, hours, minutes, seconds, time, dateDiff, dateAdd, timeDiff |
| `logical` | 6 | if, coalesce, empty, present, selected, instance |
| `type` | 9 | isNumber, isString, isDate, isNull, typeOf, number, string, boolean, date |
| `money` | 5 | money, moneyAmount, moneyCurrency, moneyAdd, moneySum |
| `mip` | 4 | valid, relevant, readonly, required |
| `repeat` | 3 | prev, next, parent |
| **Total** | **61** | |

Note: The `instance` function is categorized as `logical` in the schema, not as its own category.
