# Schema Coverage Audit: Grant Application vs Schemas

## definition.schema.json — COMPLETE

### Top-Level Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `$formspec` | `.properties.$formspec` | YES | `"1.0"` |
| `url` | `.properties.url` | YES | `"https://example.gov/forms/grant-application"` |
| `version` | `.properties.version` | YES | `"1.0.0"` |
| `versionAlgorithm` | `.properties.versionAlgorithm` | YES | `"semver"` — but only this value. Enum also supports: `date`, `integer`, `natural` |
| `status` | `.properties.status` | YES | `"active"` — Enum also supports: `draft`, `retired` |
| `title` | `.properties.title` | YES | `"Federal Grant Application"` |
| `description` | `.properties.description` | YES | Present |
| `date` | `.properties.date` | YES | `"2026-02-25"` |
| `name` | `.properties.name` | YES | `"grant-application"` |
| `derivedFrom` | `.properties.derivedFrom` | **NO** | Supports URI string or `{url, version}` object. Not used. |
| `items` | `.properties.items` | YES | Full item tree |
| `binds` | `.properties.binds` | YES | 24 bind entries |
| `shapes` | `.properties.shapes` | YES | 8 shape entries |
| `instances` | `.properties.instances` | YES | `agencyData` instance |
| `variables` | `.properties.variables` | YES | 4 variables |
| `nonRelevantBehavior` | `.properties.nonRelevantBehavior` | YES | `"remove"` — Enum also supports: `empty`, `keep` (form-level) |
| `optionSets` | `.properties.optionSets` | YES | `budgetCategories`, `orgTypes` |
| `screener` | `.properties.screener` | **NO** | Entire Screener + Route system unused |
| `migrations` | `.properties.migrations` | YES (empty) | `{"from": {}}` — skeleton only, no actual migration descriptors |
| `extensions` | `.properties.extensions` | **NO** | `x-` prefixed extension data not used |
| `formPresentation` | `.properties.formPresentation` | YES | All 4 sub-properties used |

### formPresentation Sub-Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `pageMode` | `.formPresentation.pageMode` | YES | `"wizard"` — Enum also supports: `single`, `tabs` |
| `labelPosition` | `.formPresentation.labelPosition` | YES | `"top"` — Enum also supports: `start`, `hidden` |
| `density` | `.formPresentation.density` | YES | `"comfortable"` — Enum also supports: `compact`, `spacious` |
| `defaultCurrency` | `.formPresentation.defaultCurrency` | YES | `"USD"` |

### Item Properties (all types)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `key` | `Item.key` | YES | All items have keys |
| `type` | `Item.type` | YES | Uses `"group"`, `"field"`, `"display"` — all three enum values |
| `label` | `Item.label` | YES | All items have labels |
| `description` | `Item.description` | **NO** | Item-level description (help text) not used on any item |
| `hint` | `Item.hint` | YES | Used on multiple fields (e.g., `ein`, `abstract`, `indirectRate`) |
| `labels` | `Item.labels` | YES | Used on `orgName` — `{"short": "Org", "aria": "..."}` |
| `extensions` | `Item.extensions` | **NO** | Item-level `x-` extensions not used |

### Group-Specific Item Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `children` | `Item(group).children` | YES | All groups have children |
| `repeatable` | `Item(group).repeatable` | YES | `lineItems`, `projectPhases`, `phaseTasks`, `subcontractors` |
| `minRepeat` | `Item(group).minRepeat` | YES | `1` on all repeatable groups |
| `maxRepeat` | `Item(group).maxRepeat` | YES | Various values (10, 20) |
| `$ref` | `Item(group).$ref` | **NO** | Modular composition via URI reference not used |
| `keyPrefix` | `Item(group).keyPrefix` | **NO** | Key collision prevention for `$ref` imports not used |
| `presentation` | `Item(group).presentation` | YES | `page` used on top-level groups |

### Field-Specific Item Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `dataType` | `Item(field).dataType` | YES | Uses: `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `choice`, `multiChoice`, `money`, `attachment` |
| `dataType: dateTime` | `Item(field).dataType` | **NO** | Not exercised |
| `dataType: time` | `Item(field).dataType` | **NO** | Not exercised |
| `dataType: uri` | `Item(field).dataType` | **NO** | Not exercised |
| `currency` | `Item(field).currency` | **NO** | Per-field currency override not used (relies on `defaultCurrency`) |
| `precision` | `Item(field).precision` | YES | `2` on `unitCost`, `subtotal`, `hours` |
| `prefix` | `Item(field).prefix` | YES | `"$"` on `unitCost` |
| `suffix` | `Item(field).suffix` | **NO** | Display suffix (e.g., `%`, `kg`) not used |
| `options` (inline array) | `Item(field).options` | YES | Inline on `focusAreas` (multiChoice) |
| `options` (URI) | `Item(field).options` | **NO** | External URI option source not used |
| `optionSet` | `Item(field).optionSet` | YES | `"budgetCategories"`, `"orgTypes"` |
| `initialValue` | `Item(field).initialValue` | YES | `"202-555-0100"` on `contactPhone` — but only literal value. Expression form (`"=today()"`, `"=@instance(...)"`) not used |
| `semanticType` | `Item(field).semanticType` | YES | `"email"`, `"phone"` |
| `prePopulate` | `Item(field).prePopulate` | YES | On `orgName` — `{instance: "agencyData", path: "orgName", editable: true}` |
| `prePopulate.editable: false` | `Item(field).prePopulate.editable` | **NO** | Only `editable: true` used; the `false` (locking) case not exercised |
| `children` (on field) | `Item(field).children` | YES | `orgType` has child `orgSubType` |
| `presentation` | `Item(field).presentation` | **NO** | Field-level presentation not used (only group-level `presentation.page`) |

### Presentation Object (`$defs/Presentation`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `widgetHint` | `Presentation.widgetHint` | **NO** | No widget hints declared |
| `layout.flow` | `Presentation.layout.flow` | **NO** | `stack`/`grid`/`inline` not used |
| `layout.columns` | `Presentation.layout.columns` | **NO** | Grid column count not used |
| `layout.colSpan` | `Presentation.layout.colSpan` | **NO** | Grid column span not used |
| `layout.newRow` | `Presentation.layout.newRow` | **NO** | Force new grid row not used |
| `layout.collapsible` | `Presentation.layout.collapsible` | **NO** | Collapsible groups not used |
| `layout.collapsedByDefault` | `Presentation.layout.collapsedByDefault` | **NO** | Initial collapsed state not used |
| `layout.page` | `Presentation.layout.page` | **YES** (via shortcut) | Grant-app uses `presentation.page` at the group item level (e.g., `"page": "Applicant Info"`). NOTE: In the schema, `page` is inside `Presentation.layout.page`, but the grant-app puts it directly in `presentation.page` — this may be a schema/app mismatch or the `additionalProperties: true` on Presentation allows it |
| `styleHints.emphasis` | `Presentation.styleHints.emphasis` | **NO** | `primary`/`success`/`warning`/`danger`/`muted` not used |
| `styleHints.size` | `Presentation.styleHints.size` | **NO** | `compact`/`default`/`large` not used |
| `accessibility.role` | `Presentation.accessibility.role` | **NO** | Semantic role hint not used |
| `accessibility.description` | `Presentation.accessibility.description` | **NO** | Screen-reader-only description not used |
| `accessibility.liveRegion` | `Presentation.accessibility.liveRegion` | **NO** | `off`/`polite`/`assertive` not used |

### Bind Properties (`$defs/Bind`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `path` | `Bind.path` | YES | All binds have paths |
| `calculate` | `Bind.calculate` | YES | 11 calculate binds (duration, subtotal, taskCost, phaseTotal, orgNameUpper, contactPhoneFallback, indirectRateRounded, projectYear, projectedEndDate, budgetDeviation, hasLineItems) |
| `relevant` | `Bind.relevant` | YES | 3 relevance binds (nonprofitPhoneHint, indirectRate, subcontractors) |
| `required` | `Bind.required` | YES | 11 required binds (orgName, ein, orgType, contactName, contactEmail, projectTitle, abstract, startDate, endDate, focusAreas, requestedAmount) |
| `readonly` | `Bind.readonly` | YES | `"true"` on duration, subtotal, taskCost, phaseTotal, projectedEndDate, budgetDeviation |
| `constraint` | `Bind.constraint` | YES | 4 constraint binds (ein, contactEmail, contactPhone, endDate) |
| `constraintMessage` | `Bind.constraintMessage` | YES | On all constraint binds |
| `default` | `Bind.default` | YES | `"'nonprofit'"` on orgType, `"money(0, 'USD')"` on requestedAmount |
| `whitespace` | `Bind.whitespace` | YES | `"normalize"` on ein, `"trim"` on contactEmail — Enum also supports: `preserve` (default), `remove` |
| `excludedValue` | `Bind.excludedValue` | YES | `"null"` on requestedAmount — Enum also supports: `preserve` (default) |
| `nonRelevantBehavior` | `Bind.nonRelevantBehavior` | YES | `"keep"` on subcontractors — Enum also supports: `remove`, `empty` |
| `disabledDisplay` | `Bind.disabledDisplay` | YES | `"protected"` on duration — Enum also supports: `hidden` (default) |
| `extensions` | `Bind.extensions` | **NO** | Bind-level `x-` extensions not used |

### Shape Properties (`$defs/Shape`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `id` | `Shape.id` | YES | All 8 shapes have IDs |
| `target` | `Shape.target` | YES | Various targets including `#` (form-level) |
| `severity` | `Shape.severity` | YES | Uses `"error"`, `"warning"`, `"info"` — all three values |
| `constraint` | `Shape.constraint` | YES | 4 shapes use `constraint` (abstractLength, budgetMatch, budgetReasonable, narrativeDocRequired) |
| `message` | `Shape.message` | YES | All shapes have messages |
| `code` | `Shape.code` | YES | All shapes have codes |
| `context` | `Shape.context` | YES | `budgetMatch` uses context with FEL expressions |
| `activeWhen` | `Shape.activeWhen` | YES | `subcontractorCap` and `subcontractorEntryRequired` use `activeWhen` |
| `timing` | `Shape.timing` | YES | `"continuous"` on abstractLength, `"submit"` on narrativeDocRequired — Enum value `"demand"` not used |
| `and` | `Shape.and` | YES | `subcontractorEntryRequired` uses `and` composition |
| `or` | `Shape.or` | YES | `contactProvided` uses `or` composition |
| `not` | `Shape.not` | YES | `abstractNotPlaceholder` uses `not` composition |
| `xone` | `Shape.xone` | **NO** | Exclusive-OR composition not used |
| `extensions` | `Shape.extensions` | **NO** | Shape-level `x-` extensions not used |

### Instance Properties (`$defs/Instance`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `description` | `Instance.description` | YES | On `agencyData` |
| `source` | `Instance.source` | **NO** | External URL data source not used (only inline `data`) |
| `static` | `Instance.static` | **NO** | Static flag not used |
| `data` | `Instance.data` | YES | Inline data on `agencyData` |
| `schema` | `Instance.schema` | **NO** | Type declarations for instance fields not used |
| `readonly` | `Instance.readonly` | YES | `true` on `agencyData` |
| `extensions` | `Instance.extensions` | **NO** | Instance-level extensions not used |

### Variable Properties (`$defs/Variable`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `name` | `Variable.name` | YES | All 4 variables |
| `expression` | `Variable.expression` | YES | All 4 have expressions |
| `scope` | `Variable.scope` | **NO** | All variables use default `"#"` (definition-wide). Scoped variables not exercised |
| `extensions` | `Variable.extensions` | **NO** | Variable-level extensions not used |

### OptionSet Properties (`$defs/OptionSet`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `options` (inline) | `OptionSet.options` | YES | Both `budgetCategories` and `orgTypes` use inline options |
| `source` | `OptionSet.source` | **NO** | External endpoint for options not used |
| `valueField` | `OptionSet.valueField` | **NO** | Custom value field mapping not used |
| `labelField` | `OptionSet.labelField` | **NO** | Custom label field mapping not used |
| `extensions` | `OptionSet.extensions` | **NO** | OptionSet-level extensions not used |

### OptionEntry Properties (`$defs/OptionEntry`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `value` | `OptionEntry.value` | YES | All option entries |
| `label` | `OptionEntry.label` | YES | All option entries |
| `extensions` | `OptionEntry.extensions` | **NO** | OptionEntry-level extensions not used |

### Screener (`$defs/Screener`) — ENTIRELY UNUSED

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `items` | `Screener.items` | **NO** | No screener |
| `routes` | `Screener.routes` | **NO** | No routing rules |
| `extensions` | `Screener.extensions` | **NO** | — |

### Route (`$defs/Route`) — ENTIRELY UNUSED

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `condition` | `Route.condition` | **NO** | — |
| `target` | `Route.target` | **NO** | — |
| `label` | `Route.label` | **NO** | — |
| `extensions` | `Route.extensions` | **NO** | — |

### Migrations (`$defs/Migrations`) — SKELETON ONLY

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `from` | `Migrations.from` | YES (empty) | `{"from": {}}` — no actual migration descriptors |
| `extensions` | `Migrations.extensions` | **NO** | — |

### MigrationDescriptor (`$defs/MigrationDescriptor`) — ENTIRELY UNUSED

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `description` | `MigrationDescriptor.description` | **NO** | — |
| `fieldMap` | `MigrationDescriptor.fieldMap` | **NO** | — |
| `fieldMap[].source` | — | **NO** | — |
| `fieldMap[].target` | — | **NO** | — |
| `fieldMap[].transform` | — | **NO** | `preserve`/`drop`/`expression` |
| `fieldMap[].expression` | — | **NO** | — |
| `defaults` | `MigrationDescriptor.defaults` | **NO** | — |
| `extensions` | `MigrationDescriptor.extensions` | **NO** | — |

---

### Summary: Features Exercised by Grant Application (definition.schema.json)

**Top-level metadata (all exercised):**
- `$formspec: "1.0"`, `url`, `version: "1.0.0"`, `versionAlgorithm: "semver"`, `status: "active"`, `title`, `description`, `date: "2026-02-25"`, `name: "grant-application"`
- `nonRelevantBehavior: "remove"` (form-wide default)

**Item types — all three used:**
- `"group"` — e.g., `applicantInfo` (non-repeatable), `lineItems` (repeatable), `phaseTasks` (nested repeatable)
- `"field"` — e.g., `orgName` (string), `unitCost` (decimal), `orgType` (choice), `focusAreas` (multiChoice), `requestedAmount` (money), `usesSubcontractors` (boolean), `narrativeDoc` (attachment), `startDate` (date), `duration` (integer), `abstract` (text)
- `"display"` — `nonprofitPhoneHint`

**10 of 12 dataTypes exercised:**
- `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `choice`, `multiChoice`, `money`, `attachment`

**Field features:**
- `hint` — e.g., `"Format: XX-XXXXXXX"` on `ein`
- `labels` — `orgName` has `{"short": "Org", "aria": "Applying Organization Full Legal Name"}`
- `prefix` — `"$"` on `unitCost`
- `precision` — `2` on `unitCost`, `subtotal`, `hours`
- `initialValue` (literal) — `"202-555-0100"` on `contactPhone`
- `semanticType` — `"email"` on `contactEmail`, `"phone"` on `contactPhone`
- `prePopulate` — `orgName` pulls from `agencyData` instance: `{instance: "agencyData", path: "orgName", editable: true}`
- `options` (inline) — `focusAreas` has 5 inline options
- `optionSet` — `orgType` references `"orgTypes"`, `category` references `"budgetCategories"`
- Field `children` — `orgType` has child field `orgSubType`

**Repeatable groups:**
- `repeatable: true`, `minRepeat: 1`, `maxRepeat: 20` on `lineItems`
- Nested repeatables: `projectPhases` > `phaseTasks` (repeat within repeat)
- 4 repeatable groups total: `lineItems`, `projectPhases`, `phaseTasks`, `subcontractors`

**formPresentation (all 4 sub-properties):**
- `pageMode: "wizard"`, `labelPosition: "top"`, `density: "comfortable"`, `defaultCurrency: "USD"`

**Presentation:**
- `page` — e.g., `"Applicant Info"`, `"Budget"`, `"Review & Submit"` (used on 6 top-level groups)

**Binds (24 entries covering all behavioral properties):**
- `calculate` (11) — e.g., `"$unitCost * $quantity"` for subtotal, `"upper($applicantInfo.orgName)"` for orgNameUpper, `"money(sum($phaseTasks[*].taskCost), 'USD')"` for phaseTotal
- `relevant` (3) — e.g., `"$applicantInfo.orgType = 'nonprofit'"` for nonprofitPhoneHint, `"$budget.usesSubcontractors"` for subcontractors group
- `required` (11) — `"true"` on orgName, ein, orgType, contactName, contactEmail, projectTitle, abstract, startDate, endDate, focusAreas, requestedAmount
- `readonly` (6) — `"true"` on duration, subtotal, taskCost, phaseTotal, projectedEndDate, budgetDeviation
- `constraint` (4) — e.g., `"matches($applicantInfo.ein, '^[0-9]{2}-[0-9]{7}$')"` with `constraintMessage: "EIN must be in the format XX-XXXXXXX..."`
- `default` (2) — `"'nonprofit'"` on orgType, `"money(0, 'USD')"` on requestedAmount
- `whitespace` — `"normalize"` on ein, `"trim"` on contactEmail
- `excludedValue` — `"null"` on requestedAmount
- `nonRelevantBehavior` — `"keep"` on subcontractors (per-bind override)
- `disabledDisplay` — `"protected"` on duration
- Wildcard paths — `"budget.lineItems[*].subtotal"`, `"projectPhases[*].phaseTasks[*].taskCost"`

**Shapes (8 entries):**
- All 3 severities: `"error"` (budgetMatch, subcontractorCap, narrativeDocRequired, subcontractorEntryRequired), `"warning"` (budgetReasonable, contactProvided, abstractNotPlaceholder), `"info"` (abstractLength)
- `constraint` — e.g., `"abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1"`
- `context` — budgetMatch provides `{grandTotal, requested, difference}` as FEL expressions
- `activeWhen` — `"$budget.usesSubcontractors"` on subcontractorCap and subcontractorEntryRequired
- `timing` — `"continuous"` on abstractLength, `"submit"` on narrativeDocRequired
- `code` — e.g., `"BUDGET_MISMATCH"`, `"SUBCONTRACTOR_CAP_EXCEEDED"`, `"ABSTRACT_NEAR_LIMIT"`
- Composition operators: `and` (subcontractorEntryRequired), `or` (contactProvided), `not` (abstractNotPlaceholder)
- Form-level target `"#"` — budgetReasonable, subcontractorCap, subcontractorEntryRequired

**Variables (4):**
- `totalDirect` — `"money(sum($budget.lineItems[*].subtotal), 'USD')"`
- `indirectCosts` — complex conditional with money functions
- `grandTotal` — `"moneyAdd(@totalDirect, @indirectCosts)"`
- `projectPhasesTotal` — `"money(sum($projectPhases[*].phaseTotal), 'USD')"`
- All use default `"#"` (definition-wide) scope

**Instances (1):**
- `agencyData` — inline `data: {maxAward: 500000, fiscalYear: "FY2026"}`, `readonly: true`, with `description`

**OptionSets (2):**
- `budgetCategories` — 7 inline options (personnel through other)
- `orgTypes` — 4 inline options (nonprofit, university, government, forprofit)

**Migrations (skeleton):**
- `migrations: {from: {}}` — structure present but no actual descriptors

---

### Summary: Features NOT Exercised by Grant Application (definition.schema.json)

**Entirely unused subsystems:**
1. **Screener + Routes** — respondent routing/classification system
2. **MigrationDescriptor** — version-to-version response transformation rules (skeleton `from: {}` exists but no actual descriptors)
3. **Group `$ref` + `keyPrefix`** — modular composition by importing items from another Definition

**Unused top-level properties:**
4. **`derivedFrom`** — parent definition lineage tracking
5. **`extensions`** — definition-level `x-` extension data

**Unused dataTypes:**
6. **`dateTime`** — ISO 8601 date-time values
7. **`time`** — ISO 8601 time values
8. **`uri`** — URI/URL values

**Unused field properties:**
9. **`currency`** — per-field currency override (relies on `defaultCurrency` instead)
10. **`suffix`** — display suffix (e.g., `%`, `kg`)
11. **`options` as URI** — external option source via URI on a field
12. **`initialValue` as expression** — `"=today()"` or `"=@instance('x').y"` forms (only literal value used)
13. **`prePopulate.editable: false`** — locking pre-populated fields

**Unused item properties:**
14. **`description`** (on items) — help text / tooltip content on any item
15. **Field-level `presentation`** — no field has presentation hints

**Entire Presentation sub-objects unused:**
16. **`widgetHint`** — preferred UI control hints
17. **`layout.flow`** — `stack`/`grid`/`inline` arrangement
18. **`layout.columns`** — grid column count
19. **`layout.colSpan`** — grid column span
20. **`layout.newRow`** — force new row
21. **`layout.collapsible`** — collapsible groups
22. **`layout.collapsedByDefault`** — initial collapsed state
23. **`styleHints.emphasis`** — `primary`/`success`/`warning`/`danger`/`muted`
24. **`styleHints.size`** — `compact`/`default`/`large`
25. **`accessibility.role`** — semantic role hint
26. **`accessibility.description`** — screen-reader-only description
27. **`accessibility.liveRegion`** — dynamic announcement control

**Unused bind properties:**
28. **`whitespace: "remove"`** — strip all whitespace (only `normalize` and `trim` used)

**Unused shape properties:**
29. **`xone`** — exclusive-OR composition
30. **`timing: "demand"`** — on-demand validation (only `continuous` and `submit` used)

**Unused instance properties:**
31. **`source`** — external URL data source for instances
32. **`static`** — cache hint for instance data
33. **`schema`** — type declarations for instance fields
34. **`readonly: false`** — writable scratch-pad instances (only `true` used)

**Unused variable properties:**
35. **`scope`** — scoped variables (only definition-wide `#` scope used)

**Unused optionSet properties:**
36. **`source`** — external endpoint for option lists
37. **`valueField`** — custom value field mapping
38. **`labelField`** — custom label field mapping

**Unused `labels` contexts:**
39. **`pdf`** label context — only `short` and `aria` used
40. **`csv`** label context — not used

**Display item properties unused:**
41. Display items only use `key`, `type`, `label`. The `description`, `hint`, `labels`, `extensions`, and `presentation` properties are all available on display items but none are used.

**Group item properties unused:**
42. No group uses `description` (help text) or `hint` — only fields have hints in the grant-app.
43. No group uses `labels` (alternative labels).

**All `extensions` properties unused** (at every level: Item, Bind, Shape, Instance, Variable, OptionSet, OptionEntry, Screener, Route, Migrations, MigrationDescriptor, Presentation)

**Unused enum values (partially exercised properties):**
- `versionAlgorithm`: `date`, `integer`, `natural` (only `semver` used)
- `status`: `draft`, `retired` (only `active` used)
- `formPresentation.pageMode`: `single`, `tabs` (only `wizard` used)
- `formPresentation.labelPosition`: `start`, `hidden` (only `top` used)
- `formPresentation.density`: `compact`, `spacious` (only `comfortable` used)
- `Bind.required` dynamic expression: only `"true"` literal used; no conditional required (e.g., `"$awardType = 'grant'"`)
- `Bind.readonly` dynamic expression: only `"true"` literal used; no conditional readonly (e.g., `"$status = 'submitted'"`)
- `Bind.nonRelevantBehavior`: only `"keep"` used; `"remove"` and `"empty"` per-bind overrides not exercised
- `Bind.whitespace`: `"remove"` not used (only `"normalize"` and `"trim"`)
- `Bind.default` as raw JSON literal: only FEL expression strings used (`"'nonprofit'"`, `"money(0, 'USD')"`); bare JSON values like `0` or `""` not used
- `Shape.message` with `{{expression}}` interpolation: all shape messages are plain strings; template interpolation not exercised
- Shape composition via shape ID references: `and`/`or`/`not` only use inline FEL expressions, never reference other shape IDs (e.g., `["dateRangeValid", "dateRangeReasonable"]`)

**NOTE on `presentation.page`:** The grant-app places `page` directly inside `presentation` (e.g., `"presentation": {"page": "Applicant Info"}`), but the schema defines `page` inside `Presentation.layout.page`. This works because `Presentation` has `additionalProperties: true`, but it's technically at a different path than the schema intends. The engine reads it from the `presentation.page` path directly.

---

## response.schema.json — COMPLETE

### Top-Level Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `definitionUrl` | `.properties.definitionUrl` | YES | `"https://example.gov/forms/grant-application"` |
| `definitionVersion` | `.properties.definitionVersion` | YES | `"1.0.0"` |
| `status` | `.properties.status` | YES | `"completed"` — Enum also supports: `in-progress`, `amended`, `stopped` |
| `data` | `.properties.data` | YES | Full response data object |
| `authored` | `.properties.authored` | YES | `"2026-02-25T12:00:00.000Z"` |
| `id` | `.properties.id` | **NO** | Response UUID not used |
| `author` | `.properties.author` | YES | `{"id": "user-001", "name": "Jane Smith"}` |
| `author.id` | `.properties.author.id` | YES | `"user-001"` |
| `author.name` | `.properties.author.name` | YES | `"Jane Smith"` |
| `subject` | `.properties.subject` | **NO** | Subject entity (grant, patient, project) not used |
| `subject.id` | `.properties.subject.id` | **NO** | — |
| `subject.type` | `.properties.subject.type` | **NO** | — |
| `validationResults` | `.properties.validationResults` | **NO** | No validation results included in sample |
| `extensions` | `.properties.extensions` | **NO** | Response-level `x-` extensions not used |

### ValidationResult Properties (referenced via `$ref`)

The response schema references `validationResult.schema.json` in the `validationResults` array. Since the sample submission includes NO validation results, none of these are exercised:

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `path` | `ValidationResult.path` | **NO** | — |
| `severity` | `ValidationResult.severity` | **NO** | — |
| `constraintKind` | `ValidationResult.constraintKind` | **NO** | All 6 kinds unused: `required`, `type`, `cardinality`, `constraint`, `shape`, `external` |
| `message` | `ValidationResult.message` | **NO** | — |
| `code` | `ValidationResult.code` | **NO** | — |
| `shapeId` | `ValidationResult.shapeId` | **NO** | — |
| `source` | `ValidationResult.source` | **NO** | All 3 sources unused: `bind`, `shape`, `external` |
| `sourceId` | `ValidationResult.sourceId` | **NO** | — |
| `value` | `ValidationResult.value` | **NO** | — |
| `constraint` | `ValidationResult.constraint` | **NO** | — |
| `context` | `ValidationResult.context` | **NO** | — |
| `extensions` | `ValidationResult.extensions` | **NO** | — |

### Response Data Observations

The `data` object in the sample submission exercises:
- **Flat fields** in groups (orgName, ein, etc.)
- **Repeatable groups as arrays** (lineItems, subcontractors)
- **Money values** as `{amount, currency}` objects
- **Non-relevant field omission** (no `orgSubType`, no `nonprofitPhoneHint`, no `projectPhases` etc.)
- **Calculated fields included** (duration, subtotal)

The `data` object does NOT exercise:
- **`nonRelevantBehavior: "empty"`** — would show null values for non-relevant fields
- **`nonRelevantBehavior: "keep"`** — would show last values for non-relevant fields
- **Attachment values** — narrativeDoc, budgetJustification, approverSignature are all absent
- **Nested repeatable groups** — projectPhases with phaseTasks not in sample data
- **multiChoice values** — focusAreas not in sample data
- **boolean values** — usesSubcontractors is present but `true`; no `false` case shown in data

---

### Summary: Features Exercised by Sample Submission (response.schema.json)

**Top-level properties (5 of 8 used):**
- `definitionUrl: "https://example.gov/forms/grant-application"` — pinned to definition
- `definitionVersion: "1.0.0"` — exact version reference
- `status: "completed"` — 1 of 4 enum values used
- `authored: "2026-02-25T12:00:00.000Z"` — ISO 8601 date-time
- `author: {id: "user-001", name: "Jane Smith"}` — both `id` and `name` sub-properties used
- `data` — full response data object

**Data representation patterns exercised:**
- Nested objects for non-repeatable groups: `{applicantInfo: {orgName: "...", ein: "...", ...}}`
- Arrays for repeatable groups: `lineItems: [{category: "personnel", ...}, {category: "travel", ...}]`
- Money values as structured objects: `{amount: "100000.00", currency: "USD"}`
- String fields: `orgName: "Community Health Partners, Inc."`
- Integer fields: `duration: 12`
- Decimal fields: `indirectRate: 20`
- Boolean fields: `usesSubcontractors: true`
- Choice fields as string values: `orgType: "nonprofit"`, `category: "personnel"`
- Non-relevant field omission (`nonRelevantBehavior: "remove"`): orgSubType, focusAreas, projectPhases all absent
- Calculated field values preserved in response: `duration: 12`, `subtotal` values

---

### Summary: Features NOT Exercised by Sample Submission (response.schema.json)

**Unused top-level properties:**
1. **`id`** — globally unique response identifier (UUID)
2. **`subject`** — the entity the response is about (grant, patient, etc.)
3. **`validationResults`** — entire validation results array absent
4. **`extensions`** — response-level `x-` extension data

**Unused status values:**
5. **`in-progress`** — active editing state
6. **`amended`** — reopened after completion
7. **`stopped`** — abandoned state

**Entire `validationResult.schema.json` unused** — since no validationResults are included:
8. All 12 properties of ValidationResult (path, severity, constraintKind, message, code, shapeId, source, sourceId, value, constraint, context, extensions)
9. All 6 constraintKind values (required, type, cardinality, constraint, shape, external)
10. All 3 source values (bind, shape, external)

**Data representation gaps:**
11. **Attachment field values** — no attachment data in sample
12. **multiChoice field values** — no array-of-strings values in sample
13. **Nested repeat data** — no projectPhases/phaseTasks in sample
14. **Non-relevant field representations** — only `remove` behavior shown (fields simply absent)

---

## theme.schema.json — COMPLETE

### Top-Level Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `$formspecTheme` | `.properties.$formspecTheme` | YES | `"1.0"` |
| `url` | `.properties.url` | **NO** | Canonical theme URI not provided |
| `version` | `.properties.version` | YES | `"1.0.0"` |
| `name` | `.properties.name` | YES | `"grant-application-theme"` |
| `title` | `.properties.title` | YES | `"Grant Application Theme"` |
| `description` | `.properties.description` | **NO** | No description of the theme's purpose |
| `targetDefinition` | `.properties.targetDefinition` | YES | Full object with `url` and `compatibleVersions` |
| `platform` | `.properties.platform` | YES | `"web"` — other well-known values (`mobile`, `pdf`, `print`, `kiosk`, `universal`) not used |
| `tokens` | `.properties.tokens` | YES | 26 tokens defined across color, space, type, radius, focusRing, and uswds categories |
| `defaults` | `.properties.defaults` | YES | PresentationBlock with `labelPosition` and `widgetConfig` |
| `selectors` | `.properties.selectors` | YES | 3 selectors (money, choice, boolean) |
| `items` | `.properties.items` | **NO** | Cascade level 3 per-item overrides not used |
| `pages` | `.properties.pages` | **NO** | Theme-level page layout (12-column grid) entirely unused |
| `breakpoints` | `.properties.breakpoints` | **NO** | Theme-level responsive breakpoints not defined (note: component.json defines its own) |
| `extensions` | `.properties.extensions` | **NO** | Theme-level `x-` extensions not used |
| `stylesheets` | `.properties.stylesheets` | YES | 2 stylesheet URIs (USWDS bridge + grant-bridge CSS) |

### TargetDefinition (`$defs/TargetDefinition`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `url` | `TargetDefinition.url` | YES | `"https://example.gov/forms/grant-application"` |
| `compatibleVersions` | `TargetDefinition.compatibleVersions` | YES | `">=1.0.0 <2.0.0"` |

### Tokens (`$defs/Tokens`)

| Token Category | Schema Description | Grant-App Uses? | Details |
|----------------|-------------------|-----------------|---------|
| `color.*` | Hex/rgb/hsl color values | YES | 12 color tokens: `color.primary`, `color.primaryDark`, `color.primaryLight`, `color.success`, `color.warning`, `color.error`, `color.neutral50/100/200/400/700`, `color.text`, `color.textMuted` |
| `spacing.*` / `space.*` | CSS lengths | YES (as `space.*`) | 5 space tokens: `space.xs`–`space.xl`. Note: schema RECOMMENDS `spacing.*` prefix but grant-app uses `space.*` |
| `typography.*` / `type.*` | Font properties | YES (as `type.*`) | 3 type tokens: `type.fontFamily`, `type.baseSize`, `type.lineHeight`. Schema RECOMMENDS `typography.*` prefix |
| `border.*` / `radius.*` | Border properties | YES (as `radius.*`) | 2 radius tokens: `radius.sm`, `radius.md`. Schema RECOMMENDS `border.*` prefix |
| `elevation.*` | Shadow values | **NO** | No elevation tokens defined |
| `x-*` (custom/vendor) | Custom tokens | **NO** | No vendor-prefixed tokens |
| Numeric token values | `type: "number"` | **NO** | All token values are strings; no numeric token values used (schema allows `number` type) |
| Non-standard categories | — | YES | `focusRing` (standalone, no dotted prefix), `uswds.*` (5 tokens for CSS class names — creative use of token system for class injection) |

### PresentationBlock (`$defs/PresentationBlock`) — used in `defaults`, `selectors[].apply`, and `items`

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `widget` | `PresentationBlock.widget` | YES | `"MoneyInput"`, `"RadioGroup"`, `"Toggle"` in selectors |
| `widgetConfig` | `PresentationBlock.widgetConfig` | YES | Used in `defaults` (x-classes structure) and selectors (x-classes overrides with `null` values) |
| `labelPosition` | `PresentationBlock.labelPosition` | YES | `"top"` in defaults, `"start"` in boolean selector — all 3 enum values available: `top`, `start`, `hidden` |
| `style` | `PresentationBlock.style` | **NO** | No style overrides in any PresentationBlock |
| `accessibility` | `PresentationBlock.accessibility` | **NO** | No accessibility block in any PresentationBlock |
| `fallback` | `PresentationBlock.fallback` | **NO** | No fallback widget chains defined |
| `cssClass` | `PresentationBlock.cssClass` | **NO** | Not used in theme (but `cssClass` IS used in component.json) |

### AccessibilityBlock (`$defs/AccessibilityBlock`) — ENTIRELY UNUSED in theme

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `role` | `AccessibilityBlock.role` | **NO** | — |
| `description` | `AccessibilityBlock.description` | **NO** | — |
| `liveRegion` | `AccessibilityBlock.liveRegion` | **NO** | `off`/`polite`/`assertive` — none used |

### Selector (`$defs/Selector`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `match` | `Selector.match` | YES | All 3 selectors have match criteria |
| `apply` | `Selector.apply` | YES | All 3 selectors have PresentationBlocks |

### SelectorMatch (`$defs/SelectorMatch`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `type` | `SelectorMatch.type` | **NO** | None of the 3 selectors match by item type (`group`, `field`, `display`). Only `dataType` is used |
| `dataType` | `SelectorMatch.dataType` | YES | `"money"`, `"choice"`, `"boolean"` — 3 of 13 dataTypes used as selector criteria |
| Combined `type` + `dataType` match (AND) | — | **NO** | No selector uses both criteria simultaneously |

#### Unused `dataType` values in selectors:
`string`, `text`, `integer`, `decimal`, `date`, `dateTime`, `time`, `uri`, `attachment`, `multiChoice` — 10 of 13 dataTypes never used as selector match criteria.

### Page (`$defs/Page`) — ENTIRELY UNUSED

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `id` | `Page.id` | **NO** | — |
| `title` | `Page.title` | **NO** | — |
| `description` | `Page.description` | **NO** | — |
| `regions` | `Page.regions` | **NO** | — |

### Region (`$defs/Region`) — ENTIRELY UNUSED

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `key` | `Region.key` | **NO** | — |
| `span` | `Region.span` | **NO** | — |
| `start` | `Region.start` | **NO** | — |
| `responsive` | `Region.responsive` | **NO** | — |
| `responsive[bp].span` | — | **NO** | — |
| `responsive[bp].start` | — | **NO** | — |
| `responsive[bp].hidden` | — | **NO** | — |

### Breakpoints (`$defs/Breakpoints`) — UNUSED in theme

Not defined in theme.json (though component.json has its own breakpoints).

---

### Summary: Features Exercised by Grant Application (theme.schema.json)

**Top-level metadata:**
- `$formspecTheme: "1.0"`, `version: "1.0.0"`, `name: "grant-application-theme"`, `title: "Grant Application Theme"`, `platform: "web"`
- `targetDefinition: {url, compatibleVersions}` — both sub-properties used

**Tokens (26 defined):**
- Color tokens (12): primary, primaryDark, primaryLight, success, warning, error, neutral50/100/200/400/700, text, textMuted
- Spacing tokens (5): space.xs–space.xl (using non-standard `space.*` instead of recommended `spacing.*`)
- Typography tokens (3): type.fontFamily, type.baseSize, type.lineHeight (using `type.*` instead of recommended `typography.*`)
- Border tokens (2): radius.sm, radius.md (using `radius.*` instead of recommended `border.*`)
- Special tokens (4): `focusRing` (no category prefix), `uswds.formGroup/label/input/hint/error` (CSS class name injection via token system)

**Cascade system (2 of 3 levels used):**
- **Level 1 (defaults):** `labelPosition: "top"`, `widgetConfig` with `x-classes` structure for USWDS class injection
- **Level 2 (selectors):** 3 selectors by `dataType`: money→MoneyInput, choice→RadioGroup, boolean→Toggle with label+config overrides
- **Level 3 (items):** NOT used

**Stylesheets:** 2 external CSS URIs (USWDS bridge + grant-bridge)

---

### Summary: Features NOT Exercised by Grant Application (theme.schema.json)

**Unused top-level properties:**
1. **`url`** — canonical theme URI identifier
2. **`description`** — human-readable description of the theme
3. **`items`** — cascade level 3 per-item presentation overrides (entire highest-specificity cascade level unused)
4. **`pages`** — theme-level page layout system with 12-column grid (entire Page/Region subsystem unused)
5. **`breakpoints`** — theme-level responsive breakpoint definitions
6. **`extensions`** — theme-level `x-` extension data

**Unused PresentationBlock properties:**
7. **`style`** — flat style overrides with `$token` references (no PresentationBlock uses `style`)
8. **`accessibility`** — accessibility metadata (role, description, liveRegion) — not used in any PresentationBlock
9. **`fallback`** — fallback widget chains (e.g., `["camera", "fileUpload"]`)
10. **`cssClass`** — CSS class assignment in theme PresentationBlocks (union merge semantics)

**Unused SelectorMatch patterns:**
11. **`type` matching** — no selector matches by structural type (`group`, `field`, `display`)
12. **Combined `type` + `dataType`** — AND-logic matching not exercised
13. **10 of 13 dataType selectors** — only `money`, `choice`, `boolean` used; `string`, `text`, `integer`, `decimal`, `date`, `dateTime`, `time`, `uri`, `attachment`, `multiChoice` never used as selector criteria

**Unused enum values:**
14. **`labelPosition: "hidden"`** — only `top` and `start` used
15. **`platform`** — only `"web"` used; `mobile`, `pdf`, `print`, `kiosk`, `universal` not used

**Entire subsystems unused:**
16. **Page layout** — `Page` ($defs/Page) with `id`, `title`, `description`, `regions`
17. **Region** — grid positioning (`key`, `span`, `start`, `responsive`) — the 12-column grid layout system is entirely unexercised
18. **Breakpoints** — responsive breakpoint definitions (referenced by Region `responsive`)
19. **AccessibilityBlock** — `role`, `description`, `liveRegion` within PresentationBlocks

**Token coverage gaps:**
20. **`elevation.*`** — shadow/elevation tokens not defined
21. **`x-*` vendor tokens** — custom vendor-prefixed tokens not used
22. **Numeric token values** — all values are strings; `type: "number"` token values not exercised
23. **Standard category prefixes** — theme uses non-standard prefixes (`space.*` instead of `spacing.*`, `type.*` instead of `typography.*`, `radius.*` instead of `border.*`)

---

## component.schema.json — COMPLETE

### Top-Level Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `$formspecComponent` | `.properties.$formspecComponent` | YES | `"1.0"` |
| `url` | `.properties.url` | **NO** | Canonical component document URI not provided |
| `name` | `.properties.name` | YES | `"grant-application-component"` |
| `title` | `.properties.title` | YES | `"Grant Application Layout"` |
| `description` | `.properties.description` | **NO** | No human-readable description |
| `version` | `.properties.version` | YES | `"1.0.0"` |
| `targetDefinition` | `.properties.targetDefinition` | YES | `{url, compatibleVersions}` — both sub-properties |
| `breakpoints` | `.properties.breakpoints` | YES | `{sm: 576, md: 768, lg: 1024}` — 3 named breakpoints |
| `tokens` | `.properties.tokens` | YES | 3 tokens: `space.lg`, `color.accent`, `border.card` |
| `components` | `.properties.components` | YES | 2 custom components: `ContactField`, `SummaryRow` |
| `tree` | `.properties.tree` | YES | Full presentation tree with Wizard root |
| `^x-` (patternProperties) | `.patternProperties` | **NO** | No top-level extension properties |

### ComponentBase — Shared Properties on All Components

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `component` | `ComponentBase.component` | YES | Every node has a component type |
| `when` | `ComponentBase.when` | YES | Used on ConditionalGroup, Text, Slider, Badge (FEL conditions) |
| `responsive` | `ComponentBase.responsive` | YES | Used on Grid components (e.g., `{ "sm": { "columns": 1 } }`) |
| `style` | `ComponentBase.style` | YES | Used on Text, Grid children (e.g., `{ "fontWeight": "bold", "textAlign": "right" }`) |
| `accessibility` | `ComponentBase.accessibility` | YES | Used on Stack in Review page: `{ "role": "region", "description": "Application review and submission" }` |
| `cssClass` | `ComponentBase.cssClass` | YES | Used on Alert: `"review-alert"` (string form only) |
| `cssClass` (array form) | — | **NO** | Only string form used; array form `["class1", "class2"]` not exercised |

### Built-in Components — Exercised

#### Layout Components

| Component | Level | Grant-App Uses? | Props Exercised | Props NOT Exercised |
|-----------|-------|-----------------|-----------------|---------------------|
| `Page` | core | YES | `title`, `children` | `description` |
| `Stack` | core | YES | `gap`, `children` | `direction` (only default `vertical`), `align`, `wrap` |
| `Grid` | core | YES | `columns` (integer), `responsive`, `children` | `columns` (string/CSS value), `gap`, `rowGap` |
| `Wizard` | core | YES | `showProgress`, `allowSkip`, `children` | (all props exercised) |
| `Spacer` | core | YES | `size` (with `$token` ref and without) | (all used forms exercised) |
| `Columns` | progressive | YES | `widths`, `gap`, `children` | (all props exercised) |
| `Tabs` | progressive | YES | `tabLabels`, `children` | `position`, `defaultTab` |
| `Accordion` | progressive | YES | `bind`, `allowMultiple`, `defaultOpen`, `labels`, `children` | (all props exercised) |

#### Input Components

| Component | Level | Grant-App Uses? | Props Exercised | Props NOT Exercised |
|-----------|-------|-----------------|-----------------|---------------------|
| `TextInput` | core | YES | `bind`, `placeholder` | `maxLines`, `inputMode`, `prefix`, `suffix` |
| `NumberInput` | core | YES | `bind` | `step`, `min`, `max`, `showStepper`, `locale` |
| `DatePicker` | core | YES | `bind`, `format` | `minDate`, `maxDate`, `showTime` |
| `Select` | core | **NO** | — | `bind`, `searchable`, `placeholder`, `clearable` — entire component unused |
| `CheckboxGroup` | core | YES | `bind`, `columns`, `selectAll` | (all props exercised) |
| `Toggle` | core | YES | `bind`, `onLabel`, `offLabel` | (all props exercised) |
| `FileUpload` | core | YES | `bind`, `accept`, `maxSize`, `dragDrop` | `multiple` |
| `RadioGroup` | progressive | YES | `bind`, `orientation`, `columns` | (all props exercised) |
| `MoneyInput` | progressive | YES | `bind`, `currency`, `showCurrency` | `locale` |
| `Slider` | progressive | YES | `bind`, `min`, `max`, `step`, `showValue`, `showTicks`, `when` | (all props exercised) |
| `Rating` | progressive | YES | `bind`, `max` | `icon`, `allowHalf` |
| `Signature` | progressive | YES | `bind`, `strokeColor`, `height`, `penWidth`, `clearable` | (all props exercised) |

#### Display Components

| Component | Level | Grant-App Uses? | Props Exercised | Props NOT Exercised |
|-----------|-------|-----------------|-----------------|---------------------|
| `Heading` | core | YES | `level`, `text` | (all required props exercised) |
| `Text` | core | YES | `bind` (data-bound), `text` (static), `format: "markdown"` | `format: "plain"` (default, implicit) |
| `Divider` | core | YES | `label` | (no label on some, label on "Supporting Documents" divider) |
| `Alert` | progressive | YES | `severity` (`info`, `warning`), `text`, `dismissible` | `severity: "success"`, `severity: "error"` |
| `Badge` | progressive | YES | `text`, `variant: "warning"`, `when` | `variant: "default"`, `variant: "primary"`, `variant: "success"`, `variant: "error"` |
| `ProgressBar` | progressive | YES | `value`, `max`, `label`, `showPercent` | `bind` (data-bound progress) |
| `Summary` | progressive | YES | `items[].label`, `items[].bind`, `items[].optionSet` | (all Summary item props exercised) |
| `DataTable` | progressive | YES | `bind`, `columns`, `allowAdd`, `allowRemove`, `showRowNumbers` | (all props exercised across 3 DataTable instances) |

#### Container Components

| Component | Level | Grant-App Uses? | Props Exercised | Props NOT Exercised |
|-----------|-------|-----------------|-----------------|---------------------|
| `Card` | core | YES | `title`, `elevation`, `children` | `subtitle` |
| `Collapsible` | core | YES | `title`, `defaultOpen` (both true and false), `children` | (all props exercised) |
| `ConditionalGroup` | core | YES | `when`, `fallback`, `children` | (all props exercised) |
| `Panel` | progressive | YES | `position: "right"`, `title`, `width`, `children` | `position: "left"` (default) |
| `Modal` | progressive | YES | `title`, `trigger: "button"`, `triggerLabel`, `size: "md"`, `closable`, `children` | `trigger: "auto"`, `size: "sm"/"lg"/"xl"/"full"` |
| `Popover` | progressive | YES | `triggerLabel`, `placement: "bottom"`, `children` | `triggerBind`, `placement: "top"/"right"/"left"` |

### Custom Components (`components` registry)

| Feature | Schema Path | Grant-App Uses? | Details |
|---------|-------------|-----------------|---------|
| Custom component definitions | `components` | YES | 2 defined: `ContactField`, `SummaryRow` |
| `params` | `CustomComponentDef.params` | YES | `ContactField: ["field"]`, `SummaryRow: ["label", "field"]` |
| `tree` | `CustomComponentDef.tree` | YES | Both have component subtrees |
| `{param}` interpolation in `bind` | — | YES | `ContactField` uses `bind: "{field}"` |
| `{param}` interpolation in `text` | — | YES | `SummaryRow` uses `text: "{label}"` |
| Custom component instantiation | — | YES | `ContactField` used 3 times with `params: { "field": "..." }` |

**Note on `SummaryRow`:** Defined in `components` but never instantiated in the tree. It exists as a template definition only.

### AccessibilityBlock in Components

| Property | Schema Path | Grant-App Uses? | Details |
|---------|-------------|-----------------|---------|
| `role` | `AccessibilityBlock.role` | YES | `"region"` on Review page Stack |
| `description` | `AccessibilityBlock.description` | YES | `"Application review and submission"` |
| `liveRegion` | `AccessibilityBlock.liveRegion` | **NO** | `off`/`polite`/`assertive` not used |

### ResponsiveOverrides

| Feature | Schema Path | Grant-App Uses? | Details |
|---------|-------------|-----------------|---------|
| Breakpoint-keyed prop overrides | `ResponsiveOverrides` | YES | `{ "sm": { "columns": 1 } }` on Grid, `{ "sm": { "columns": 1 }, "md": { "columns": 2 } }` on another Grid |
| Multiple breakpoints in one override | — | YES | 2-breakpoint override on contact info Grid |

---

### Summary: Features Exercised by Grant Application (component.schema.json)

**Top-level metadata:**
- `$formspecComponent: "1.0"`, `version: "1.0.0"`, `name`, `title`, `targetDefinition` (with `url` and `compatibleVersions`)
- `breakpoints: {sm: 576, md: 768, lg: 1024}` — 3 responsive breakpoints
- `tokens` — 3 tokens overriding/supplementing theme tokens

**Custom components (2):**
- `ContactField` — reusable wrapper accepting `field` param, used 3 times
- `SummaryRow` — defined but never instantiated (dead template)

**Component tree coverage — 30 of 33 built-in components used:**
- **Layout (8/8):** Page, Stack, Grid, Wizard, Spacer, Columns, Tabs, Accordion
- **Input (11/12):** TextInput, NumberInput, DatePicker, CheckboxGroup, Toggle, FileUpload, RadioGroup, MoneyInput, Slider, Rating, Signature — all except **Select**
- **Display (7/7):** Heading, Text, Divider, Alert, Badge, ProgressBar, Summary, DataTable
- **Container (6/6):** Card, Collapsible, ConditionalGroup, Panel, Modal, Popover

**ComponentBase properties:**
- `when` (conditional rendering), `responsive` (breakpoint overrides), `style` (inline styles), `accessibility` (role + description), `cssClass` (string form)

**Notable patterns:**
- Data-bound and static Text components (both `bind` and `text` props)
- Markdown rendering (`format: "markdown"`)
- DataTable for repeatable groups with add/remove controls
- Nested usage: Accordion > Card > DataTable
- Collapsible for review page sections
- Modal and Popover for supplementary content
- Custom component with parameter interpolation (`{field}`)

---

### Summary: Features NOT Exercised by Grant Application (component.schema.json)

**Unused top-level properties:**
1. **`url`** — canonical component document URI
2. **`description`** — human-readable description
3. **`^x-` extensions** — top-level extension properties

**Unused built-in component:**
4. **`Select`** — dropdown selection component (all choice fields use RadioGroup instead)

**Unused ComponentBase properties:**
5. **`cssClass` (array form)** — only string form used; `["class1", "class2"]` not exercised

**Unused component-specific props:**

*Layout:*
6. **`Page.description`** — page subtitle/description text
7. **`Stack.direction`** — only default `vertical` used; `horizontal` not exercised
8. **`Stack.align`** — cross-axis alignment (`start`/`center`/`end`/`stretch`)
9. **`Stack.wrap`** — horizontal wrapping
10. **`Grid.columns` (string form)** — CSS grid-template-columns (e.g. `'1fr 2fr 1fr'`); only integer form used
11. **`Grid.gap`** — spacing between grid cells (Grid instances don't specify gap)
12. **`Grid.rowGap`** — vertical spacing between rows
13. **`Tabs.position`** — tab bar position (`top`/`bottom`/`left`/`right`); only default used
14. **`Tabs.defaultTab`** — initially active tab index

*Input:*
15. **`TextInput.maxLines`** — multi-line textarea mode
16. **`TextInput.inputMode`** — virtual keyboard hints (`text`/`email`/`tel`/`url`/`search`)
17. **`TextInput.prefix`** — static text before input (e.g., `'https://'`)
18. **`TextInput.suffix`** — static text after input (e.g., `'.com'`)
19. **`NumberInput.step/min/max/showStepper/locale`** — all NumberInput-specific props unused
20. **`DatePicker.minDate/maxDate`** — date range constraints
21. **`DatePicker.showTime`** — time selection for dateTime
22. **`FileUpload.multiple`** — multi-file upload
23. **`MoneyInput.locale`** — locale for formatting
24. **`Rating.icon`** — icon type (`star`/`heart`/`circle`)
25. **`Rating.allowHalf`** — half-value ratings (e.g., 3.5)

*Display:*
26. **`Alert.severity: "success"`** — only `info` and `warning` used
27. **`Alert.severity: "error"`** — not used
28. **`Badge.variant: "default"/"primary"/"success"/"error"`** — only `warning` used
29. **`ProgressBar.bind`** — data-bound progress (only static `value` used)

*Container:*
30. **`Card.subtitle`** — card header subtitle
31. **`Panel.position: "left"`** — only `"right"` used
32. **`Modal.trigger: "auto"`** — auto-open based on `when` condition
33. **`Modal.size`** — only `"md"` used; `"sm"/"lg"/"xl"/"full"` not used
34. **`Popover.triggerBind`** — dynamic trigger text from data binding
35. **`Popover.placement`** — only `"bottom"` used; `"top"/"right"/"left"` not used

**Accessibility gaps:**
36. **`AccessibilityBlock.liveRegion`** — `off`/`polite`/`assertive` not used in any component

**Custom component gaps:**
37. **`SummaryRow`** — defined in `components` registry but never instantiated in the tree (dead template)

**Unused `Select` component props (component entirely unused):**
38. All `Select` props: `bind`, `searchable`, `placeholder`, `clearable`

---

## mapping.schema.json — COMPLETE

### Top-Level Properties

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `$schema` | `.properties.$schema` | **NO** | No `$schema` URI in the mapping file |
| `version` | `.properties.version` | YES | `"1.0.0"` |
| `definitionRef` | `.properties.definitionRef` | YES | `"https://example.gov/forms/grant-application"` |
| `definitionVersion` | `.properties.definitionVersion` | YES | `">=1.0.0 <2.0.0"` |
| `targetSchema` | `.properties.targetSchema` | YES | `{format: "json", name: "Grants Management System Payload"}` |
| `direction` | `.properties.direction` | YES | `"forward"` — only `"forward"` used; `"reverse"` and `"both"` not exercised |
| `defaults` | `.properties.defaults` | **NO** | No target-document defaults defined |
| `autoMap` | `.properties.autoMap` | **NO** | Auto-mapping synthetic rules not used |
| `conformanceLevel` | `.properties.conformanceLevel` | **NO** | No conformance level declared (`core`/`bidirectional`/`extended`) |
| `rules` | `.properties.rules` | YES | 14 rules defined |
| `adapters` | `.properties.adapters` | **NO** | No adapter configuration (json/xml/csv) |
| `^x-` (patternProperties) | — | **NO** | No top-level extensions |

### TargetSchema (`$defs/TargetSchema`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `format` | `TargetSchema.format` | YES | `"json"` — only JSON format used; `"xml"`, `"csv"`, `"x-*"` (custom) not used |
| `name` | `TargetSchema.name` | YES | `"Grants Management System Payload"` |
| `url` | `TargetSchema.url` | **NO** | No target schema URL |
| `rootElement` | `TargetSchema.rootElement` | **NO** | XML-only; N/A for JSON |
| `namespaces` | `TargetSchema.namespaces` | **NO** | XML-only; N/A for JSON |
| `^x-` (patternProperties) | — | **NO** | No TargetSchema extensions |

### FieldRule (`$defs/FieldRule`) — Features Exercised

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `sourcePath` | `FieldRule.sourcePath` | YES | 13 of 14 rules have sourcePath |
| `targetPath` | `FieldRule.targetPath` | YES | All 14 rules have targetPath |
| `transform: "preserve"` | `FieldRule.transform` | YES | 9 rules use `preserve` |
| `transform: "valueMap"` | `FieldRule.transform` | YES | 1 rule (`orgType` → `type_code`) |
| `transform: "concat"` | `FieldRule.transform` | YES | 1 rule (contact display) |
| `transform: "expression"` | `FieldRule.transform` | YES | 3 rules (indirectRate, requestedAmount, currency) |
| `transform: "coerce"` | `FieldRule.transform` | YES | 1 rule (duration → number) |
| `transform: "drop"` | `FieldRule.transform` | **NO** | Not used |
| `transform: "flatten"` | `FieldRule.transform` | **NO** | Not used |
| `transform: "nest"` | `FieldRule.transform` | **NO** | Not used |
| `transform: "constant"` | `FieldRule.transform` | **NO** | Not used |
| `transform: "split"` | `FieldRule.transform` | **NO** | Not used |
| `expression` | `FieldRule.expression` | YES | 4 rules use FEL expressions |
| `coerce` (shorthand) | `FieldRule.coerce` | YES | `"number"` shorthand on duration rule |
| `coerce` (object form) | `FieldRule.coerce` | **NO** | `{from, to, format}` object form not used |
| `valueMap` (shorthand) | `FieldRule.valueMap` | YES | Flat object `{nonprofit: "NPO", ...}` |
| `valueMap` (full form) | `FieldRule.valueMap` | **NO** | `{forward, reverse, unmapped, default}` not used |
| `reverse` | `FieldRule.reverse` | **NO** | No reverse overrides (forward-only mapping) |
| `bidirectional` | `FieldRule.bidirectional` | **NO** | Not specified on any rule (default `true` for all) |
| `condition` | `FieldRule.condition` | YES | 1 rule uses condition: `"$budget.usesSubcontractors = true"` |
| `default` | `FieldRule.default` | **NO** | No fallback values |
| `array` | `FieldRule.array` | YES | 2 rules use array handling |
| `separator` | `FieldRule.separator` | **NO** | No delimiter for flatten/nest |
| `description` | `FieldRule.description` | **NO** | No human-readable descriptions on rules |
| `priority` | `FieldRule.priority` | YES | Values: 100, 90, 80, 70, 60, 50 — all rules have explicit priority |
| `reversePriority` | `FieldRule.reversePriority` | **NO** | No reverse priority (forward-only) |
| `^x-` (patternProperties) | — | **NO** | No rule-level extensions |

### ArrayDescriptor (`$defs/ArrayDescriptor`)

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `mode: "each"` | `ArrayDescriptor.mode` | YES | `lineItems` rule uses `each` mode |
| `mode: "whole"` | `ArrayDescriptor.mode` | YES | `subcontractors` rule uses `whole` mode |
| `mode: "indexed"` | `ArrayDescriptor.mode` | **NO** | Positional indexing not used |
| `separator` | `ArrayDescriptor.separator` | **NO** | No array-level separator |
| `innerRules` | `ArrayDescriptor.innerRules` | **NO** | Grant-app uses `rules` key (not the schema's `innerRules`); this may be a grant-app bug or a schema discrepancy — grant-app line items array uses `"rules"` instead of `"innerRules"` |

**NOTE:** The grant-app mapping.json uses `"rules"` (line 67) inside the `array` descriptor, but the schema defines this as `"innerRules"`. This is either a schema/app mismatch or suggests the app predates the schema's naming convention.

### InnerRule (`$defs/InnerRule`)

The grant-app's `array.rules` (effectively `innerRules`) exercises:

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `sourcePath` | `InnerRule.sourcePath` | YES | `category`, `description`, `quantity`, `unitCost`, `subtotal` |
| `targetPath` | `InnerRule.targetPath` | YES | `cat`, `desc`, `qty`, `unit_cost`, `line_total` |
| `transform: "preserve"` | `InnerRule.transform` | YES | 4 inner rules |
| `transform: "coerce"` | `InnerRule.transform` | YES | 1 inner rule (`quantity` → number) |
| `coerce` (shorthand) | `InnerRule.coerce` | YES | `"number"` |
| All other InnerRule props | — | **NO** | `expression`, `valueMap`, `reverse`, `bidirectional`, `condition`, `default`, `array` (nested), `separator`, `description`, `priority`, `reversePriority`, `index` — all unused |

### Coerce (`$defs/Coerce`) — Object Form UNUSED

Only shorthand string form `"number"` is used. The full object form `{from, to, format}` is never exercised.

### ValueMap (`$defs/ValueMap`) — Full Form UNUSED

Only shorthand flat-object form is used. The full form with `forward`, `reverse`, `unmapped`, `default` properties is never exercised:

| Property | Schema Path | Grant-App Uses? | Details |
|----------|-------------|-----------------|---------|
| `forward` | `ValueMap.forward` | **NO** (implicit via shorthand) | — |
| `reverse` | `ValueMap.reverse` | **NO** | — |
| `unmapped` | `ValueMap.unmapped` | **NO** | `error`/`drop`/`passthrough`/`default` — none used explicitly |
| `default` | `ValueMap.default` | **NO** | — |

### ReverseOverride (`$defs/ReverseOverride`) — ENTIRELY UNUSED

Forward-only mapping — no reverse overrides of any kind.

### Adapter Configurations — ENTIRELY UNUSED

| Adapter | Schema Path | Grant-App Uses? | Details |
|---------|-------------|-----------------|---------|
| `JsonAdapter` | `$defs/JsonAdapter` | **NO** | `pretty`, `sortKeys`, `nullHandling` — none configured |
| `XmlAdapter` | `$defs/XmlAdapter` | **NO** | `declaration`, `indent`, `cdata` — entire XML adapter unused |
| `CsvAdapter` | `$defs/CsvAdapter` | **NO** | `delimiter`, `quote`, `header`, `encoding`, `lineEnding` — entire CSV adapter unused |

---

### Summary: Features Exercised by Grant Application (mapping.schema.json)

**Top-level metadata:**
- `version: "1.0.0"`, `definitionRef`, `definitionVersion: ">=1.0.0 <2.0.0"`
- `direction: "forward"` — forward-only mapping
- `targetSchema: {format: "json", name: "Grants Management System Payload"}`

**14 rules exercising 5 of 10 transform types:**
- `preserve` (9 rules) — identity copy for simple fields
- `valueMap` (1 rule) — shorthand flat-object form for org type codes
- `concat` (1 rule) — FEL expression joining contact name + email
- `expression` (3 rules) — FEL for indirect rate formatting, money field decomposition
- `coerce` (1 rule) — shorthand `"number"` for integer-to-number conversion

**Rule features used:**
- `priority` — explicit integer priorities on all rules (100, 90, 80, 70, 60, 50)
- `condition` — FEL guard on subcontractors rule: `"$budget.usesSubcontractors = true"`
- `array` — two array handling modes: `each` (line items with per-element inner rules) and `whole` (subcontractors as complete array)

**FEL expressions in mapping context:**
- `@source.propertyPath` — full-document reference syntax
- `string()` & `&` — type coercion and concatenation
- `$variable.path` — source variable reference

---

### Summary: Features NOT Exercised by Grant Application (mapping.schema.json)

**Unused top-level properties:**
1. **`$schema`** — JSON Schema self-reference URI
2. **`defaults`** — target document leaf defaults before rules execute
3. **`autoMap`** — synthetic preserve rules for uncovered fields
4. **`conformanceLevel`** — declared minimum conformance level
5. **`adapters`** — adapter-specific configuration object

**Unused direction values:**
6. **`direction: "reverse"`** — external→Response mapping
7. **`direction: "both"`** — bidirectional execution

**Unused transform types (5 of 10):**
8. **`drop`** — field discard
9. **`flatten`** — nested/array collapse to flat representation
10. **`nest`** — flat expansion to nested form
11. **`constant`** — fixed value injection
12. **`split`** — single value decomposition to multiple targets

**Unused FieldRule properties:**
13. **`reverse`** — explicit reverse-direction override block
14. **`bidirectional`** — per-rule reverse participation control
15. **`default`** — fallback when sourcePath is absent/null
16. **`separator`** — delimiter for flatten/nest
17. **`description`** — human-readable rule description
18. **`reversePriority`** — reverse-direction precedence
19. **`^x-` extensions** — rule-level extensions

**Unused Coerce features:**
20. **Object form `{from, to, format}`** — explicit source/target type with format pattern
21. **`format` property** — date/number formatting pattern (e.g., `"MM/DD/YYYY"`)
22. **All type pairs except integer→number** — `string<->boolean`, `date<->string`, `money->number`, etc.

**Unused ValueMap features:**
23. **Full form with `forward`/`reverse`** — only shorthand flat object used
24. **`unmapped` strategy** — `error`/`drop`/`passthrough`/`default` — none specified
25. **`reverse` map** — explicit reverse lookup table
26. **`default`** — fallback for unmapped values

**Unused ArrayDescriptor features:**
27. **`mode: "indexed"`** — positional array element access
28. **`separator`** — array-level delimiter
29. **`innerRules`** — schema's named property (grant-app uses `rules` instead — possible schema/app naming mismatch)

**Unused InnerRule features:**
30. **`index`** — positional index for `indexed` mode
31. **Nested `array`** — multi-level array structures
32. **`condition`** — per-inner-rule FEL guard
33. **`reverse`** — inner-rule reverse override
34. **`priority`/`reversePriority`** — inner-rule execution ordering

**Entire subsystems unused:**
35. **ReverseOverride** — all properties: `transform`, `expression`, `coerce`, `valueMap`, `condition`, `default`, `bidirectional`, `array`, `separator`, `priority`, `reversePriority`, `description`
36. **JsonAdapter** — `pretty`, `sortKeys`, `nullHandling`
37. **XmlAdapter** — `declaration`, `indent`, `cdata`
38. **CsvAdapter** — `delimiter`, `quote`, `header`, `encoding`, `lineEnding`

**Unused TargetSchema properties:**
39. **`url`** — canonical target schema URL
40. **`rootElement`** — XML root element name
41. **`namespaces`** — XML namespace mappings
42. **`format: "xml"`** — XML output format
43. **`format: "csv"`** — CSV output format
44. **`format: "x-*"`** — custom format extensions

---

## validationReport.schema.json — COMPLETE

This schema describes the standalone Validation Report structure. There is no `validationReport.json` in the grant-application examples. The engine's `getValidationReport()` method returns this structure at runtime.

### Top-Level Properties

| Property | Schema Path | Engine Produces? | Details |
|----------|-------------|-----------------|---------|
| `definitionUrl` | `.properties.definitionUrl` | **NO** | Not included in engine's `getValidationReport()` output — the engine returns `{valid, results, counts, timestamp}` without definition metadata |
| `definitionVersion` | `.properties.definitionVersion` | **NO** | Not included in engine output |
| `valid` | `.properties.valid` | YES | Engine computes `counts.error === 0` |
| `results` | `.properties.results` | YES | Array of ValidationResult objects |
| `counts` | `.properties.counts` | YES | `{error, warning, info}` breakdown |
| `timestamp` | `.properties.timestamp` | YES | ISO 8601 date-time of validation run |
| `extensions` | `.properties.extensions` | **NO** | No `x-` extensions in engine output |

### Counts Object

| Property | Schema Path | Engine Produces? | Details |
|----------|-------------|-----------------|---------|
| `error` | `counts.error` | YES | Error-severity count |
| `warning` | `counts.warning` | YES | Warning-severity count |
| `info` | `counts.info` | YES | Info-severity count |

### ValidationResult Properties (referenced via `$ref` to validationResult.schema.json)

The engine produces ValidationResult objects with varying completeness depending on constraint kind:

| Property | Schema Path | Engine Produces? | Details |
|----------|-------------|-----------------|---------|
| `path` | `ValidationResult.path` | YES | Field path for all results |
| `severity` | `ValidationResult.severity` | YES | `"error"`, `"warning"`, `"info"` — all three exercised via shapes and binds |
| `constraintKind` | `ValidationResult.constraintKind` | YES (partial) | `"required"`, `"constraint"`, `"shape"`, `"cardinality"` — exercised; `"type"` and `"external"` not exercised |
| `message` | `ValidationResult.message` | YES | Human-readable messages on all results |
| `code` | `ValidationResult.code` | YES | `"REQUIRED"`, `"CONSTRAINT_FAILED"`, shape codes like `"BUDGET_MISMATCH"`, `"MIN_REPEAT"` |
| `shapeId` | `ValidationResult.shapeId` | YES | Present on shape-sourced results (e.g., `"budgetMatch"`, `"subcontractorCap"`) |
| `source` | `ValidationResult.source` | YES (partial) | `"bind"` and `"shape"` exercised; `"external"` not exercised |
| `sourceId` | `ValidationResult.sourceId` | **UNCERTAIN** | May be present on shape results; not confirmed in engine source for all paths |
| `value` | `ValidationResult.value` | YES | Current field value included in constraint results |
| `constraint` | `ValidationResult.constraint` | YES | FEL expression string on constraint results (e.g., `"matches($, '^[0-9]{2}-[0-9]{7}$')"`) |
| `context` | `ValidationResult.context` | YES | Shape context object (e.g., `{grandTotal, requested, difference}` on budgetMatch) |
| `extensions` | `ValidationResult.extensions` | **NO** | No `x-` extensions on results |

---

### Summary: Features Exercised at Runtime (validationReport.schema.json)

**Core report structure:**
- `valid` — boolean conformance flag
- `results` — array of ValidationResult objects
- `counts` — `{error, warning, info}` severity breakdown
- `timestamp` — ISO 8601 validation time

**ValidationResult properties exercised:**
- `path` — field paths including wildcard-resolved paths (e.g., `"budget.lineItems[0].subtotal"`)
- `severity` — all three values: `"error"`, `"warning"`, `"info"`
- `constraintKind` — 4 of 6 kinds: `"required"`, `"constraint"`, `"shape"`, `"cardinality"`
- `message` — human-readable descriptions
- `code` — machine-readable codes: `"REQUIRED"`, `"CONSTRAINT_FAILED"`, shape-specific codes, `"MIN_REPEAT"`, `"MAX_REPEAT"`
- `source` — `"bind"` and `"shape"`
- `shapeId` — links shape results to their shape definitions
- `value` — current field value at validation time
- `constraint` — FEL constraint expression string
- `context` — shape context with computed values

---

### Summary: Features NOT Exercised (validationReport.schema.json)

**Unused report-level properties:**
1. **`definitionUrl`** — definition identity metadata (engine omits)
2. **`definitionVersion`** — definition version metadata (engine omits)
3. **`extensions`** — report-level `x-` extensions

**Unused constraintKind values:**
4. **`"type"`** — type-mismatch validation (e.g., string where integer expected)
5. **`"external"`** — server-side/external validation results

**Unused source values:**
6. **`"external"`** — externally-injected validation results

**Unused ValidationResult properties:**
7. **`sourceId`** — external system identifier (e.g., `"x-irs-validation"`)
8. **`extensions`** — result-level `x-` extensions

**NOTE:** The engine does produce `definitionUrl` and `definitionVersion` in the Response object (via `getResponse()`), but they are NOT included in the standalone ValidationReport from `getValidationReport()`. This may be a gap between the schema's intent (standalone report with full provenance) and the engine's implementation (report as a sub-object of a larger context).

---

## registry.schema.json — COMPLETE — ENTIRELY UNUSED BY GRANT-APP

There is no registry document in `examples/grant-application/`. The entire Extension Registry system has zero coverage in the reference application.

### Full Feature Surface

**Top-level properties (5):**
1. **`$formspecRegistry`** — const `"1.0"` version pin
2. **`$schema`** — optional JSON Schema URI
3. **`publisher`** — `Publisher` object (name, url, contact) — required
4. **`published`** — ISO 8601 publication timestamp — required
5. **`entries`** — array of `RegistryEntry` objects — required
6. **`extensions`** — `x-` prefixed registry-level metadata

**Publisher (`$defs/Publisher`) — 3 properties:**
- `name` (required) — organization name
- `url` (required) — organization URI
- `contact` — email or URI for inquiries

**RegistryEntry (`$defs/RegistryEntry`) — 16 properties:**

| Property | Required? | Details |
|----------|-----------|---------|
| `name` | YES | `x-` prefixed extension identifier, pattern: `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$` |
| `category` | YES | Enum: `dataType`, `function`, `constraint`, `property`, `namespace` (5 categories) |
| `version` | YES | Semver pattern: `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$` |
| `status` | YES | Enum: `draft`, `stable`, `deprecated`, `retired` (4-stage lifecycle) |
| `description` | YES | Human-readable summary |
| `compatibility` | YES | Object with `formspecVersion` (required) and `mappingDslVersion` (optional) — semver ranges |
| `publisher` | NO | Entry-level publisher override (multi-org registries) |
| `specUrl` | NO | URI to full extension documentation |
| `schemaUrl` | NO | URI to JSON Schema for extension validation |
| `license` | NO | SPDX license identifier pattern |
| `deprecationNotice` | conditional | Required when `status: "deprecated"` |
| `examples` | NO | Array of JSON usage examples |
| `extensions` | NO | Entry-level `x-` metadata |
| `baseType` | conditional | Required when `category: "dataType"` — enum of 8 core types |
| `constraints` | NO | Default constraints for custom dataTypes |
| `metadata` | NO | Presentation-layer metadata for custom dataTypes |
| `parameters` | conditional | Required for `function` and `constraint` — array of `{name, type, description}` objects |
| `returns` | conditional | Required for `function` — FEL type name |
| `members` | NO | Array of extension names for `namespace` category |

**Conditional validation (allOf/if-then):**
- `category: "dataType"` → requires `baseType`
- `category: "function"` → requires `parameters` and `returns`
- `category: "constraint"` → requires `parameters`
- `status: "deprecated"` → requires `deprecationNotice`

**5 extension categories:**
1. **`dataType`** — custom data types extending core types (with `baseType`, `constraints`, `metadata`)
2. **`function`** — custom FEL functions (with `parameters`, `returns`)
3. **`constraint`** — custom validation constraints (with `parameters`)
4. **`property`** — custom definition properties (no additional required props)
5. **`namespace`** — logical grouping of related extensions (with `members`)

---

## changelog.schema.json — COMPLETE — ENTIRELY UNUSED BY GRANT-APP

There is no changelog document in `examples/grant-application/`. The entire Changelog system for tracking version-to-version definition differences has zero coverage.

### Full Feature Surface

**Top-level properties (7):**
1. **`$schema`** — optional JSON Schema URI
2. **`definitionUrl`** (required) — canonical definition URL
3. **`fromVersion`** (required) — base version (before changes)
4. **`toVersion`** (required) — target version (after changes)
5. **`generatedAt`** — ISO 8601 generation timestamp
6. **`semverImpact`** (required) — enum: `major`, `minor`, `patch` — maximum impact across all changes
7. **`summary`** — human-readable summary for release notes
8. **`changes`** (required) — array of `Change` objects

**Change (`$defs/Change`) — 9 properties:**

| Property | Required? | Details |
|----------|-----------|---------|
| `type` | YES | Enum: `added`, `removed`, `modified`, `moved`, `renamed` (5 change types) |
| `target` | YES | Enum: `item`, `bind`, `shape`, `optionSet`, `dataSource`, `screener`, `migration`, `metadata` (8 element categories) |
| `path` | YES | Dot-path to affected element (e.g., `items.budget.personnel`, `shapes.budgetBalance`) |
| `key` | NO | Item key when `target: "item"` |
| `impact` | YES | Enum: `breaking`, `compatible`, `cosmetic` (3 severity levels) |
| `description` | NO | Human-readable change description |
| `before` | NO | Previous value/fragment (present for `modified`, `removed`, `renamed`, `moved`) |
| `after` | NO | New value/fragment (present for `added`, `modified`, `renamed`, `moved`) |
| `migrationHint` | NO | Transform suggestion: `"drop"`, `"preserve"`, or FEL expression referencing `$old` |

**Impact classification rules (from description):**
- **`breaking` → major:** item removed, key renamed, dataType changed, required added, repeat toggled, itemType changed, option removed from closed set
- **`compatible` → minor:** optional item added, option added, constraint relaxed, item moved, new shape/bind
- **`cosmetic` → patch:** label/hint/description/help changed, display order changed

---

## fel-functions.schema.json — COMPLETE — ENTIRELY UNUSED BY GRANT-APP

This schema is both a schema AND a data document — it defines the `FunctionEntry` schema AND contains the actual `functions` array with all 40+ built-in FEL function definitions. There is no grant-app counterpart; this is a normative catalog.

### Schema Structure

**Top-level properties:**
- `version` — const `"1.0"`
- `functions` — array of `FunctionEntry` objects

**FELType (`$defs/FELType`) — 10 type values:**
`string`, `number`, `boolean`, `date`, `dateTime`, `time`, `money`, `array`, `any`, `null`

**Parameter (`$defs/Parameter`) — 6 properties:**
- `name` (required) — parameter name
- `type` (required) — `FELType` reference
- `description` — human-readable explanation
- `required` — boolean, default `true`
- `variadic` — boolean, default `false`
- `enum` — array of allowed literal values

**FunctionEntry (`$defs/FunctionEntry`) — 10 properties:**
- `name` (required) — function name in FEL
- `category` (required) — enum: `aggregate`, `string`, `numeric`, `date`, `logical`, `type`, `money`, `mip`, `repeat` (9 categories)
- `parameters` (required) — array of `Parameter` objects
- `returns` (required) — `FELType` return type
- `returnDescription` — clarification of return value
- `description` (required) — behavior documentation
- `nullHandling` — how null arguments are handled
- `deterministic` — boolean, default `true` (false for `today()`, `now()`)
- `shortCircuit` — boolean, default `false` (true for `if()`, `countWhere()`)
- `examples` — array of `{expression, result, note}` objects
- `sinceVersion` — version introduced, default `"1.0"`

### Complete Function Catalog (40 functions across 9 categories)

**Aggregate (6):** `sum`, `count`, `countWhere`, `avg`, `min`, `max`

**String (11):** `length`, `contains`, `startsWith`, `endsWith`, `substring`, `replace`, `upper`, `lower`, `trim`, `matches`, `format`

**Numeric (5):** `round`, `floor`, `ceil`, `abs`, `power`

**Date (10):** `today`, `now`, `year`, `month`, `day`, `hours`, `minutes`, `seconds`, `time`, `dateDiff`, `dateAdd`, `timeDiff`

**Logical (4):** `if`, `coalesce`, `empty`, `present`, `selected`

**Type (7):** `isNumber`, `isString`, `isDate`, `isNull`, `typeOf`, `number`, `string`, `boolean`, `date`

**Money (4):** `money`, `moneyAmount`, `moneyCurrency`, `moneyAdd`, `moneySum`

**MIP — Model Item Properties (4):** `valid`, `relevant`, `readonly`, `required`

**Repeat (3):** `prev`, `next`, `parent`

**Instance (1):** `instance` (categorized as `logical` in schema)

---

## Cross-Schema Coverage Summary — COMPLETE

### Schemas with grant-app counterparts (coverage audited):

| Schema | Grant-App File | Coverage Status |
|--------|---------------|-----------------|
| `definition.schema.json` | `definition.json` | **GOOD** — exercises most features; notable gaps: Screener, Presentation layout subsystem, 3 unused dataTypes |
| `response.schema.json` | `submission.json` | **PARTIAL** — exercises core structure; no validationResults, only `completed` status |
| `theme.schema.json` | `theme.json` | **MODERATE** — exercises tokens, defaults, selectors; no items (L3 cascade), no pages, no breakpoints |
| `component.schema.json` | `component.json` | **EXCELLENT** — 30 of 33 built-in components used; custom components defined; responsive, accessibility, conditional rendering all exercised |
| `mapping.schema.json` | `mapping.json` | **PARTIAL** — 5 of 10 transforms used; forward-only; no reverse, no adapters, no full-form coerce/valueMap |
| `validationReport.schema.json` | (engine runtime) | **MODERATE** — core structure produced; 4 of 6 constraintKinds; no external validation, no report-level metadata |

### Schemas with NO grant-app counterparts:

| Schema | Coverage |
|--------|----------|
| `registry.schema.json` | **ENTIRELY UNUSED** — no extension registry exists |
| `changelog.schema.json` | **ENTIRELY UNUSED** — no version changelog exists |
| `fel-functions.schema.json` | **ENTIRELY UNUSED** — normative function catalog, not a user-authored document |

### Top gaps by impact:

1. **Screener + Routes** (definition) — entire respondent-routing subsystem
2. **Theme Pages + Regions** (theme) — 12-column grid layout system
3. **Reverse/bidirectional mapping** (mapping) — entire reverse execution path
4. **XML/CSV adapters** (mapping) — non-JSON output formats
5. **Extension Registry** (registry) — custom dataTypes, functions, constraints, namespaces
6. **Changelog** (changelog) — version diff tracking and migration hints
7. **External validation** (validationReport/validationResult) — server-side injected results
8. **Presentation subsystem** (definition) — widgetHint, layout.flow/grid, collapsible, styleHints, accessibility in Tier 1
9. **Select component** (component) — dropdown alternative to RadioGroup
10. **Theme cascade level 3** (theme) — per-item overrides
