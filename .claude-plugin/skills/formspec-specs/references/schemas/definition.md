# Definition Schema Reference Map

> schemas/definition.schema.json -- 1729 lines -- Formspec Definition document per v1.0 specification

## Overview

The Definition schema describes a complete, self-contained JSON document that defines the structure, behavior, and constraints of a data-collection instrument (a form). It is the foundational Tier 1 artifact in Formspec: every form starts here. The tuple `(url, version)` uniquely identifies a Definition across all systems. Definitions are organized into three layers: Structure (Items), Behavior (Binds + Shapes), and Presentation (advisory hints), and conformant processors implement a four-phase processing cycle: Rebuild, Recalculate, Revalidate, Notify.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspec` | `string` (const `"1.0"`) | Yes | Specification version pin. Must be `"1.0"`. |
| `url` | `string` (format: `uri`) | Yes | Canonical URI identifier of the logical form. Stable across versions. |
| `version` | `string` (minLength: 1) | Yes | Version identifier of this specific document. Interpretation governed by `versionAlgorithm`. |
| `versionAlgorithm` | `string` (enum) | No | How version strings are compared. Default: `"semver"`. |
| `status` | `string` (enum) | Yes | Lifecycle state: `draft` -> `active` -> `retired`. Backward transitions forbidden for same version. |
| `derivedFrom` | `string` (uri) or `object` | No | Parent definition this form is derived from. Informational only, no behavioral inheritance. |
| `name` | `string` (pattern: `^[a-zA-Z][a-zA-Z0-9\-]*$`) | No | Machine-readable short name. Local identifier for tooling. |
| `title` | `string` | Yes | Human-readable definition title. |
| `description` | `string` | No | Human-readable description of the form's purpose. |
| `date` | `string` (format: `date`) | No | Publication or last-modified date (ISO 8601 YYYY-MM-DD). |
| `items` | `array` of `$ref: Item` | Yes | Root item tree defining the form's structural content. |
| `binds` | `array` of `$ref: Bind` | No | Reactive FEL expression declarations attached to data nodes by path. |
| `shapes` | `array` of `$ref: Shape` | No | Named, composable validation rule sets (cross-field/form-level). |
| `instances` | `object` (additionalProperties: `$ref: Instance`) | No | Named secondary data sources for FEL expressions via `@instance('name')`. |
| `variables` | `array` of `$ref: Variable` | No | Named computed values with lexical scoping. Referenced as `@varName` in FEL. |
| `nonRelevantBehavior` | `string` (enum) | No | Form-wide default for non-relevant field treatment. Default: `"remove"`. |
| `optionSets` | `object` (additionalProperties: `$ref: OptionSet`) | No | Named, reusable option lists for choice/multiChoice fields. |
| `screener` | `$ref: Screener` | No | Routing mechanism with screening questions and route rules. |
| `migrations` | `$ref: Migrations` | No | Version migration transforms for prior Response compatibility. |
| `extensions` | `object` (propertyNames: `^x-`) | No | Domain-specific extension data. All keys must start with `x-`. |
| `formPresentation` | `object` | No | Form-wide presentation defaults (advisory, Tier 1 hints). |

The root object has `additionalProperties: false` -- no unlisted properties are allowed.

### formPresentation Sub-Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `pageMode` | enum: `single`, `wizard`, `tabs` | `single` | How top-level groups are paginated. |
| `labelPosition` | enum: `top`, `start`, `hidden` | `top` | Default label placement for fields. |
| `density` | enum: `compact`, `comfortable`, `spacious` | `comfortable` | Spacing density hint. |
| `defaultCurrency` | `string` (pattern: `^[A-Z]{3}$`) | -- | ISO 4217 currency code for all money fields without explicit currency. |
| `direction` | enum: `ltr`, `rtl`, `auto` | `ltr` | Base text direction. `auto` derives from active locale code. |
| `showProgress` | `boolean` | `true` | Wizard mode: display a step progress indicator. |
| `allowSkip` | `boolean` | `false` | Wizard mode: allow navigating forward without validating the current page. |
| `sidenav` | `boolean` | `false` | Wizard mode: render vertical side navigation listing all steps instead of horizontal progress bar. |
| `defaultTab` | `integer` (minimum: 0) | `0` | Tabs mode: zero-based index of the initially selected tab. |
| `tabPosition` | enum: `top`, `bottom`, `left`, `right` | `top` | Tabs mode: position of the tab bar relative to content. |

`formPresentation` has `additionalProperties: false`.

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **Item** | A node in the form's structural tree. Uses `if/then` polymorphism based on `type` (`group`, `field`, `display`). | `key`, `type`, `label`, plus type-specific properties | `properties.items`, `Screener.items`, Group `children`, Field `children` (recursive) |
| **Bind** | Behavioral declaration attaching FEL expressions to data nodes by path. | `path`, `calculate`, `relevant`, `required`, `readonly`, `constraint`, `constraintMessage`, `default`, `whitespace`, `excludedValue`, `nonRelevantBehavior`, `disabledDisplay`, `extensions` | `properties.binds`, `Screener.binds` |
| **Shape** | Named, composable validation rule set (SHACL-inspired). Must have at least one of: `constraint`, `and`, `or`, `not`, `xone`. | `id`, `target`, `severity`, `constraint`, `message`, `code`, `context`, `activeWhen`, `timing`, `and`, `or`, `not`, `xone`, `extensions` | `properties.shapes` |
| **Instance** | Named secondary data source for FEL `@instance()`. Must have `source` or `data`. | `description`, `source`, `static`, `data`, `schema`, `readonly`, `extensions` | `properties.instances` (as additionalProperties) |
| **Variable** | Named computed value with lexical scoping. | `name`, `expression`, `scope`, `extensions` | `properties.variables` |
| **OptionSet** | Reusable option list for choice fields. Must have `options` or `source`. | `options`, `source`, `valueField`, `labelField`, `extensions` | `properties.optionSets` (as additionalProperties) |
| **OptionEntry** | Single permitted value for a choice/multiChoice field. | `value`, `label`, `keywords`, `extensions` | `OptionSet.options`, Field `options` (inline array) |
| **Screener** | Routing mechanism with screening questions and ordered routes. | `items`, `routes`, `binds`, `extensions` | `properties.screener` |
| **Route** | Single routing rule within a Screener. | `condition`, `target`, `label`, `message`, `extensions` | `Screener.routes` |
| **Migrations** | Container for version migration descriptors. | `from`, `extensions` | `properties.migrations` |
| **MigrationDescriptor** | Transform rules from a single prior version to current. | `description`, `fieldMap`, `defaults`, `extensions` | `Migrations.from` (as additionalProperties) |
| **Presentation** | Advisory presentation hints for an Item. | `widgetHint`, `layout`, `styleHints`, `accessibility` | Group items, Field items, Display items (via `$ref: Presentation`) |
| **FELExpression** | A FEL v1.0 expression string. | (string, minLength: 1) | `Bind.calculate`, `Bind.relevant`, `Bind.required`, `Bind.readonly`, `Bind.constraint`, `Shape.constraint`, `Shape.activeWhen`, `Shape.context` values, `Route.condition`, `Variable.expression`, `MigrationDescriptor.fieldMap[].expression` |

## Required Fields

### Top-Level (Definition Root)
- `$formspec`, `url`, `version`, `status`, `title`, `items`

### Item (all types)
- `key`, `type`, `label`

### Item (type: "field") -- additional
- `dataType`

### Item (type: "group") -- structural
- Must have either `children` OR `$ref` (anyOf constraint)

### Bind
- `path`

### Shape
- `id`, `target`, `message`
- Must have at least one of: `constraint`, `and`, `or`, `not`, `xone` (anyOf constraint)

### Instance
- Must have at least one of: `source`, `data` (anyOf constraint)

### Variable
- `name`, `expression`

### OptionSet
- Must have at least one of: `options`, `source` (anyOf constraint)

### OptionEntry
- `value`, `label`

### Screener
- `items`, `routes`

### Route
- `condition`, `target`

### MigrationDescriptor.fieldMap entries
- `source`, `target`, `transform`

### Field prePopulate
- `instance`, `path`

### derivedFrom (object form)
- `url`

## Enumerations

| Enum | Allowed Values | Used At |
|---|---|---|
| `versionAlgorithm` | `semver`, `date`, `integer`, `natural` | Top-level `versionAlgorithm` |
| `status` | `draft`, `active`, `retired` | Top-level `status` |
| Item `type` | `group`, `field`, `display` | `Item.type` |
| `dataType` | `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `time`, `uri`, `attachment`, `choice`, `multiChoice`, `money` | Field items only |
| `nonRelevantBehavior` | `remove`, `empty`, `keep` | Top-level `nonRelevantBehavior`, `Bind.nonRelevantBehavior` |
| `pageMode` | `single`, `wizard`, `tabs` | `formPresentation.pageMode` |
| `labelPosition` | `top`, `start`, `hidden` | `formPresentation.labelPosition` |
| `density` | `compact`, `comfortable`, `spacious` | `formPresentation.density` |
| `direction` | `ltr`, `rtl`, `auto` | `formPresentation.direction` |
| `tabPosition` | `top`, `bottom`, `left`, `right` | `formPresentation.tabPosition` |
| `whitespace` | `preserve`, `trim`, `normalize`, `remove` | `Bind.whitespace` |
| `excludedValue` | `preserve`, `null` | `Bind.excludedValue` |
| `disabledDisplay` | `hidden`, `protected` | `Bind.disabledDisplay` |
| Shape `severity` | `error`, `warning`, `info` | `Shape.severity` |
| Shape `timing` | `continuous`, `submit`, `demand` | `Shape.timing` |
| `emphasis` | `primary`, `success`, `warning`, `danger`, `muted` | `Presentation.styleHints.emphasis` |
| `size` | `compact`, `default`, `large` | `Presentation.styleHints.size` |
| `flow` | `stack`, `grid`, `inline` | `Presentation.layout.flow` |
| `liveRegion` | `off`, `polite`, `assertive` | `Presentation.accessibility.liveRegion` |
| `transform` (migration) | `preserve`, `drop`, `expression` | `MigrationDescriptor.fieldMap[].transform` |

## Cross-References

### Internal $refs (within definition.schema.json)
- `properties.items.items` -> `#/$defs/Item`
- `properties.binds.items` -> `#/$defs/Bind`
- `properties.shapes.items` -> `#/$defs/Shape`
- `properties.instances.additionalProperties` -> `#/$defs/Instance`
- `properties.variables.items` -> `#/$defs/Variable`
- `properties.optionSets.additionalProperties` -> `#/$defs/OptionSet`
- `properties.screener` -> `#/$defs/Screener`
- `properties.migrations` -> `#/$defs/Migrations`
- Group/Field/Display `presentation` -> `#/$defs/Presentation`
- Group `children.items` -> `#/$defs/Item` (recursive)
- Field `children.items` -> `#/$defs/Item` (recursive -- sub-questions)
- Field `options.oneOf[0].items` -> `#/$defs/OptionEntry`
- `OptionSet.options.items` -> `#/$defs/OptionEntry`
- `Screener.items.items` -> `#/$defs/Item`
- `Screener.routes.items` -> `#/$defs/Route`
- `Screener.binds.items` -> `#/$defs/Bind`
- `Migrations.from.additionalProperties` -> `#/$defs/MigrationDescriptor`
- All FEL expression slots -> `#/$defs/FELExpression`

### External $refs
- `FELExpression.x-lm.ref` -> `schemas/fel-functions.schema.json` (x-lm annotation, not a JSON Schema $ref)

### No external schema $refs
The definition schema is self-contained. It does not `$ref` any other schema files at the JSON Schema level. The connection to `response.schema.json` is semantic (Responses reference Definitions via `definitionUrl`), not structural.

## Extension Points

### Extension Objects (propertyNames pattern: `^x-`)
Extensions are supported at twelve levels, each with `propertyNames: { pattern: "^x-" }`:

1. **Top-level** `extensions` -- form-wide domain-specific data
2. **Item-level** `extensions` -- per-item metadata (on all three item types)
3. **Bind-level** `extensions` -- per-bind metadata
4. **Shape-level** `extensions` -- per-shape metadata
5. **Instance-level** `extensions` -- per-instance metadata
6. **Variable-level** `extensions` -- per-variable metadata
7. **OptionEntry-level** `extensions` -- per-option metadata
8. **OptionSet-level** `extensions` -- per-option-set metadata
9. **Screener-level** `extensions` -- screener metadata
10. **Route-level** `extensions` -- per-route metadata
11. **Migrations-level** `extensions` -- migration metadata
12. **MigrationDescriptor-level** `extensions` -- per-descriptor metadata

All extension keys MUST be prefixed with `x-`. Processors MUST ignore unrecognized extensions without error. Extensions MUST NOT alter core semantics.

### Presentation additionalProperties
`Presentation` has `additionalProperties: true` -- unknown top-level keys are allowed for forward compatibility. However, its nested sub-objects (`layout`, `styleHints`, `accessibility`) have `additionalProperties: false`.

### Custom widgetHint Values
Custom widget hints MUST be prefixed with `x-` (e.g., `"x-my-custom-widget"`).

### Field semanticType
Open-ended string for domain meaning annotation. No validation beyond being a string. Namespaced identifiers recommended (e.g., `"us-gov:ein"`).

## x-lm Annotations

### x-lm.critical = true

| Property Path | Intent |
|---|---|
| `$formspec` | Version pin for definition schema compatibility. |
| `url` | Stable identifier of the form across versions. |
| `version` | Version component of the immutable (url, version) identity tuple. |
| `status` | Controls publication lifecycle and authoring/production usage. |
| `title` | Display name used by authoring and rendering tools. |
| `items` | Primary structural definition of the form content. |
| `binds` | Reactive behavioral layer -- all form logic is expressed here. |
| `Field.dataType` | Determines JSON representation, FEL type, validation behavior, and default widget selection. |
| `Bind.path` | Determines which data nodes this Bind's expressions apply to. |
| `formPresentation.defaultCurrency` | Prevents authors from repeating currency code in every money expression/component. |
| `FELExpression` ($defs) | The language for all form logic. |

### x-lm.ref

| Property Path | Reference |
|---|---|
| `FELExpression` | `schemas/fel-functions.schema.json` |

### x-lm.intent
Every `x-lm.critical` node also has an `x-lm.intent` string explaining why that property is critical. See the table above for the intent values.

## Validation Constraints

### Structural Polymorphism (Item)
The `Item` definition uses `allOf` with three `if/then` blocks to enforce type-specific property rules:

- **type: "group"**: Allows `children`, `repeatable`, `minRepeat`, `maxRepeat`, `$ref`, `keyPrefix`, `presentation`. Has `additionalProperties: false`. Must have either `children` or `$ref` (anyOf).
- **type: "field"**: Allows `dataType`, `currency`, `precision`, `prefix`, `suffix`, `options`, `optionSet`, `initialValue`, `semanticType`, `prePopulate`, `children`, `presentation`. Has `additionalProperties: false`. Requires `dataType`.
- **type: "display"**: Allows only common properties plus `presentation`. Has `additionalProperties: false`.

### Field dataType-Conditional Property Restrictions
Within the field `then` block, three nested `if/then` blocks use `allOf` to restrict properties by dataType:

1. **`currency` only allowed when `dataType: "money"`**: If dataType is NOT `money`, `currency: false`.
2. **`precision` only allowed when `dataType: "decimal"` or `"money"`**: If dataType is NOT `decimal` or `money`, `precision: false`.
3. **`options` and `optionSet` only allowed when `dataType: "choice"` or `"multiChoice"`**: If dataType is NOT `choice` or `multiChoice`, `options: false` and `optionSet: false`.

### Pattern Constraints
| Pattern | Applied To | Meaning |
|---|---|---|
| `^[a-zA-Z][a-zA-Z0-9_]*$` | `Item.key`, `Variable.name`, `Group.keyPrefix` | Identifier: letter start, alphanumeric + underscore |
| `^[a-zA-Z][a-zA-Z0-9\-]*$` | `name` (top-level) | Short name: letter start, alphanumeric + hyphen |
| `^[a-zA-Z][a-zA-Z0-9_\-]*$` | `Shape.id` | Shape ID: letter start, alphanumeric + underscore + hyphen |
| `^x-` | All `extensions` propertyNames | Extension key prefix requirement |
| `^[A-Z]{3}$` | `currency`, `formPresentation.defaultCurrency` | ISO 4217 currency code (3 uppercase letters) |

### Format Constraints
| Format | Applied To |
|---|---|
| `uri` | `url`, `derivedFrom` (string form), `derivedFrom.url`, `Route.target`, `Group.$ref`, `OptionSet.source`, Field `options` (URI alternative) |
| `date` | `date` (top-level) |
| `uri-template` | `Instance.source` |

### Numeric Constraints
| Constraint | Applied To |
|---|---|
| `minLength: 1` | `version`, `Bind.path`, `Shape.target`, `FELExpression`, `Presentation.layout.page` |
| `minimum: 0` | `Group.minRepeat`, `Field.precision`, `formPresentation.defaultTab` |
| `minimum: 1` | `Group.maxRepeat`, `Presentation.layout.columns`, `Presentation.layout.colSpan` |
| `maximum: 12` | `Presentation.layout.columns`, `Presentation.layout.colSpan` |
| `minItems: 1` | `Screener.routes` (must have at least one route) |

### anyOf Discriminators (at least one required)
| Definition | At Least One Of |
|---|---|
| Group item | `children` or `$ref` |
| Shape | `constraint`, `and`, `or`, `not`, or `xone` |
| Instance | `source` or `data` |
| OptionSet | `options` or `source` |

### oneOf Discriminators
| Location | Options |
|---|---|
| `derivedFrom` | URI string OR `{url, version?}` object |
| Field `options` | Array of OptionEntry OR URI string |

### Const Values
| Property | Const |
|---|---|
| `$formspec` | `"1.0"` |

### Default Values
| Property | Default |
|---|---|
| `versionAlgorithm` | `"semver"` |
| `nonRelevantBehavior` | `"remove"` |
| `formPresentation.pageMode` | `"single"` |
| `formPresentation.labelPosition` | `"top"` |
| `formPresentation.density` | `"comfortable"` |
| `formPresentation.direction` | `"ltr"` |
| `formPresentation.showProgress` | `true` |
| `formPresentation.allowSkip` | `false` |
| `formPresentation.sidenav` | `false` |
| `formPresentation.defaultTab` | `0` |
| `formPresentation.tabPosition` | `"top"` |
| `Group.repeatable` | `false` |
| `Bind.whitespace` | `"preserve"` |
| `Bind.excludedValue` | `"preserve"` |
| `Bind.disabledDisplay` | `"hidden"` |
| `Shape.severity` | `"error"` |
| `Shape.timing` | `"continuous"` |
| `Instance.static` | `false` |
| `Instance.readonly` | `true` |
| `Variable.scope` | `"#"` |
| `OptionSet.valueField` | `"value"` |
| `OptionSet.labelField` | `"label"` |
| `Field.prePopulate.editable` | `true` |
| `Presentation.layout.flow` | `"stack"` |
| `Presentation.layout.newRow` | `false` |
| `Presentation.layout.collapsible` | `false` |
| `Presentation.layout.collapsedByDefault` | `false` |
| `Presentation.styleHints.size` | `"default"` |
| `Presentation.accessibility.liveRegion` | `"off"` |

### additionalProperties Restrictions
Most definitions use `additionalProperties: false`, meaning only declared properties are allowed:
- Root Definition object
- `formPresentation`
- Group items (via `then`)
- Field items (via `then`)
- Display items (via `then`)
- `Bind`
- `Shape`
- `Instance`
- `Variable`
- `OptionSet`
- `OptionEntry`
- `Screener`
- `Route`
- `Migrations`
- `MigrationDescriptor`
- `MigrationDescriptor.fieldMap[]` entries
- `Field.prePopulate`
- `derivedFrom` (object form)
- `Presentation.layout`
- `Presentation.styleHints`
- `Presentation.accessibility`

**Exception**: `Presentation` itself has `additionalProperties: true` for forward-compatibility (unknown top-level keys are ignored).

### Non-Obvious Behavioral Rules (from descriptions, not schema-enforceable)
- `status` transitions are one-way: `draft` -> `active` -> `retired`. No backward transitions for the same version.
- Once `active`, Definition content is immutable -- any change requires a new version.
- `Item.key` must be unique across the entire Definition, not just among siblings.
- `Bind.relevant` is AND-inherited (parent non-relevant makes all descendants non-relevant).
- `Bind.readonly` is OR-inherited (parent readonly makes all descendants readonly).
- `Bind.required` and `Bind.constraint` are NOT inherited.
- Fields with a `calculate` Bind are implicitly readonly (unless `readonly` explicitly set to `"false"`).
- When both `options` and `optionSet` are present on a field, `optionSet` takes precedence.
- When both `prePopulate` and `initialValue` are present, `prePopulate` takes precedence.
- FEL `$` (bare dollar) in constraint expressions binds to the current node's value.
- Integer/decimal fields always trim whitespace regardless of the `whitespace` bind setting.
- Screener items are NOT part of the form's instance data.
- `Group.maxRepeat`, when present, MUST be >= `minRepeat`.
- Migration target can be `null` (meaning the field is dropped) -- `target` type is `["string", "null"]`.
- `Variable` dependencies MUST NOT form circular references.
- `formPresentation.direction` `auto` derives direction from the active locale code (RTL for ar, he, fa, ur, ps, sd, yi).
- `formPresentation.showProgress`, `allowSkip`, and `sidenav` are only meaningful when `pageMode` is `wizard`.
- `formPresentation.defaultTab` and `tabPosition` are only meaningful when `pageMode` is `tabs`.
- Processors that do not support a declared `pageMode` SHOULD fall back to `single`.
- `OptionEntry.keywords` are matched case-insensitively in addition to label and value for combobox/searchable filtering.
