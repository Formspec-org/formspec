# Formspec-Org JSON Schema Authoring Guide

**Version:** 1.0.0-draft.1
**Date:** 2026-04-09
**Audience:** Schema authors, editors, and reviewers for the Formspec-org specification family

---

## 1. Purpose

This document defines the conventions, structural patterns, and annotation rules for authoring JSON Schemas that conform to Formspec-org standards. It is extracted from the 18 existing schemas in `schemas/` (totaling 10,130 lines) and codifies the patterns that make them a coherent, interoperable family.

A schema that follows this guide will be structurally consistent with every other Formspec-org schema, enabling tooling, validation, and LLM-based analysis to operate uniformly across the entire schema suite.

---

## 2. Schema Envelope

### 2.1 Required Meta-Properties

Every Formspec-org schema MUST begin with the following top-level properties, in this order:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://formspec.org/schemas/[name]/[version]",
  "title": "Formspec [Document Type Name]",
  "description": "A Formspec [Document Type] document per the [Spec Name]...",
  "type": "object"
}
```

**Property details:**

| Property | Required | Convention |
|----------|----------|------------|
| `$schema` | REQUIRED | Always `"https://json-schema.org/draft/2020-12/schema"`. All Formspec schemas use JSON Schema 2020-12. |
| `$id` | REQUIRED | URI identifier. See S2.2. |
| `title` | REQUIRED | Human-readable name, `"Formspec [Document Type]"`. |
| `description` | REQUIRED | One-paragraph description of the document type. See S2.3. |
| `type` | REQUIRED | Always `"object"` for top-level document schemas. |

### 2.2 The `$id` Convention

Schema `$id` values follow the pattern:

```
https://formspec.org/schemas/[name]/[version]
```

**Existing `$id` values:**

| Schema | `$id` |
|--------|-------|
| `definition.schema.json` | `https://formspec.org/schemas/definition/1.0` |
| `component.schema.json` | `https://formspec.org/schemas/component/1.0` |
| `theme.schema.json` | `https://formspec.org/schemas/theme/1.0` |
| `mapping.schema.json` | `https://formspec.org/schemas/mapping/v1` |
| `screener.schema.json` | `https://formspec.org/schemas/screener/1.0` |
| `locale.schema.json` | `https://formspec.org/schemas/locale/1.0` |
| `ontology.schema.json` | `https://formspec.org/schemas/ontology/1.0` |
| `references.schema.json` | `https://formspec.org/schemas/references/1.0` |
| `response.schema.json` | `https://formspec.org/schemas/response.schema.json` |
| `changelog.schema.json` | `https://formspec.org/schemas/changelog/v1` |
| `validationResult.schema.json` | `https://formspec.org/schemas/validationResult/1.0` |
| `validationReport.schema.json` | `https://formspec.org/schemas/validationReport/1.0` |

Some existing schemas use non-standard `$id` patterns — see `legacy-cleanup.md` for the list.

New schemas MUST use the `/1.0` pattern:

```
https://formspec.org/schemas/[name]/1.0
```

### 2.3 Description Quality

The top-level `description` should be a dense, single-paragraph summary that covers:

1. What the document type is.
2. Its relationship to the Formspec ecosystem (companion, sidecar, standalone).
3. Key structural concepts.
4. The additive invariant (for companion document types).
5. Processing semantics highlights.

**Example** (Ontology schema):

> A Formspec Ontology Document per the Ontology specification. A standalone sidecar that attaches semantic concept identifiers, cross-system equivalences, vocabulary bindings, and alignment metadata to a Formspec Definition. Like Theme, Component, and References documents, an Ontology Document targets a Definition but lives alongside it. Multiple Ontology Documents MAY target the same Definition (e.g., different domains, standards bodies, or interoperability contexts). Ontology metadata MUST NOT alter core behavioral semantics (required, relevant, readonly, calculate, validation). Ontology property values are static -- FEL expressions MUST NOT appear in any ontology property.

---

## 3. Document Type Marker

### 3.1 The `$formspec*` Convention

Every Formspec document type has a document type marker property that begins with `$formspec`. This is the first property in the `properties` object and is always in the `required` array.

**Pattern:**

```json
{
  "properties": {
    "$formspec[Name]": {
      "type": "string",
      "const": "1.0",
      "description": "[Name] specification version. MUST be '1.0'.",
      "examples": ["1.0"],
      "x-lm": {
        "critical": true,
        "intent": "Version pin for [name] document compatibility."
      }
    }
  }
}
```

**Existing document type markers:**

| Schema | Property | Const |
|--------|----------|-------|
| Definition | `$formspec` | `"1.0"` |
| Theme | `$formspecTheme` | `"1.0"` |
| Component | `$formspecComponent` | `"1.0"` |
| Mapping | `$formspecMapping` | `"1.0"` |
| Screener | `$formspecScreener` | `"1.0"` |
| Locale | `$formspecLocale` | `"1.0"` |
| Ontology | `$formspecOntology` | `"1.0"` |
| References | `$formspecReferences` | `"1.0"` |
| Response | `$formspecResponse` | `"1.0"` |
| Changelog | `$formspecChangelog` | `"1.0"` |
| Validation Result | `$formspecValidationResult` | `"1.0"` |
| Validation Report | `$formspecValidationReport` | `"1.0"` |
| Respondent Ledger | `$formspecRespondentLedger` | `"0.1"` |
| Registry | `$formspecRegistry` | `"1.0"` |

**Rules:**

1. The Core Definition uses `$formspec` (no suffix). All other document types use `$formspec[PascalCaseName]`.
2. The `const` value pins the specification version. Use `"1.0"` for 1.x specs, `"0.1"` for pre-release add-ons.
3. The property MUST be in the `required` array.
4. The property MUST have `x-lm.critical: true`.

**Why `const` instead of `enum` or `pattern`:** The `const` constraint is intentionally strict. When the spec reaches v2.0, the schema MUST be updated — this forces schema updates on spec version bumps and prevents silent version drift. The trade-off: old validators cannot validate new-version documents. This is correct behavior — a v1.0 validator should not silently accept a v2.0 document, since the structural contract may have changed.

### 3.2 The `$schema` Property (Optional)

Many schemas include an optional `$schema` property for editor validation:

```json
"$schema": {
  "type": "string",
  "format": "uri",
  "description": "Optional JSON Schema URI for editor validation and autocompletion."
}
```

This is OPTIONAL and SHOULD NOT be in the `required` array. Include it for document types where authors commonly edit by hand.

---

## 4. Required Properties

### 4.1 The `required` Array

Every schema MUST declare a `required` array listing the minimum set of properties needed for a valid document. The document type marker is always first in the `required` array.

**Common required property patterns:**

| Schema | Required Properties |
|--------|-------------------|
| Definition | `$formspec`, `url`, `version`, `status`, `title`, `items` |
| Theme | `$formspecTheme`, `version`, `targetDefinition` |
| Component | `$formspecComponent`, `version`, `targetDefinition`, `tree` |
| Mapping | `$formspecMapping`, `version`, `definitionRef`, `definitionVersion`, `targetSchema`, `rules` |
| Screener | `$formspecScreener`, `url`, `version`, `title`, `items`, `evaluation` |
| Locale | `$formspecLocale`, `version`, `locale`, `targetDefinition`, `strings` |
| Ontology | `$formspecOntology`, `version`, `targetDefinition` |
| References | `$formspecReferences`, `version`, `targetDefinition`, `references` |
| Response | `$formspecResponse`, `definitionUrl`, `definitionVersion`, `status`, `data`, `authored` |
| Respondent Ledger | `$formspecRespondentLedger`, `ledgerId`, `responseId`, `definitionUrl`, `definitionVersion`, `status`, `createdAt`, `lastEventAt`, `eventCount` |

### 4.2 Identity Pattern

Documents that have their own identity (stable across versions) follow the `url` + `version` tuple pattern:

```json
"url": {
  "type": "string",
  "format": "uri",
  "description": "Canonical URI identifier for this [Document Type]. Stable across versions -- the pair (url, version) SHOULD be globally unique.",
  "examples": ["https://agency.gov/forms/budget/themes/web"],
  "x-lm": {
    "critical": true,
    "intent": "Stable identifier of the [document type] across versions."
  }
},
"version": {
  "type": "string",
  "minLength": 1,
  "description": "Version of this [Document Type]. SemVer is RECOMMENDED.",
  "examples": ["1.0.0"],
  "x-lm": {
    "critical": true,
    "intent": "[Document type] revision identifier."
  }
}
```

**Rules:**

- `url` uses `"format": "uri"`.
- `version` uses `"minLength": 1` (not a pattern constraint, since different version algorithms exist).
- Both SHOULD have `x-lm.critical: true` when they form part of the document's identity.

### 4.3 Target Definition Binding

Sidecar document types (Theme, Component, Locale, Ontology, References) bind to a target Definition. The pattern uses a `targetDefinition` object:

```json
"targetDefinition": {
  "$ref": "#/$defs/TargetDefinition"
}
```

Or, when shared across schemas:

```json
"targetDefinition": {
  "$ref": "https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition"
}
```

The `TargetDefinition` type typically includes:

- `url` (string, format: uri) -- The target Definition's canonical URL.
- `compatibleVersions` (string) -- A semver range expression for version compatibility.

The Component schema defines the canonical `TargetDefinition` type, and other schemas reference it via cross-schema `$ref`.

---

## 5. Property Conventions

### 5.1 Property Naming

All JSON property names use **camelCase**:

```json
"targetDefinition", "definitionUrl", "definitionVersion",
"semanticType", "widgetHint", "dataType", "minRepeat", "maxRepeat",
"evaluationBinding", "resultValidity"
```

**Exceptions:**

- The `$formspec*` document type markers use `$` prefix + PascalCase suffix.
- The `$schema` property follows JSON Schema convention.
- Extension properties use the `x-` prefix followed by camelCase: `x-respondentLedger`.

### 5.2 Property Description Quality

Every property SHOULD have a `description` that explains:

1. **What it is** -- the purpose of the property.
2. **Behavioral implications** -- how processors treat it (MUST, SHOULD, MAY behaviors).
3. **Relationship to other properties** -- what it interacts with.
4. **Constraints not expressible in JSON Schema** -- semantic constraints deferred to spec prose.

**Example** (from `definition.schema.json`, `version` property):

> Version identifier of this specific Definition document. Interpretation governed by versionAlgorithm (default: semver). Once a Definition reaches 'active' status, its content MUST NOT be modified -- any change requires a new version.

### 5.3 Property `examples`

Properties SHOULD include an `examples` array with 1-3 realistic values:

```json
"url": {
  "type": "string",
  "format": "uri",
  "examples": [
    "https://example.gov/forms/annual-report",
    "https://grants.example.gov/forms/sf-425"
  ]
}
```

For `x-lm.critical: true` properties, at least one `examples` entry is REQUIRED (enforced by `npm run docs:check`).

---

## 6. The `x-lm` Annotation System

### 6.1 Purpose

The `x-lm` (language model) annotation provides structured metadata for LLM-based tooling, documentation generation, and the `docs:check` pipeline. It is a Formspec-org custom extension namespace.

### 6.2 Properties

| Key | Type | Description |
|-----|------|-------------|
| `critical` | boolean | When `true`, this property is essential for understanding the document. Critical properties MUST have both a `description` and at least one `examples` entry. |
| `intent` | string | A concise, LLM-friendly summary of the property's purpose. Shorter and more focused than `description`. |

### 6.3 Pattern

```json
"propertyName": {
  "type": "string",
  "description": "Full description for human readers and tooling...",
  "examples": ["example-value"],
  "x-lm": {
    "critical": true,
    "intent": "Concise purpose statement for LLM context windows."
  }
}
```

### 6.4 When to Mark `critical: true`

Mark a property as critical when:

- It is part of the document's identity (`$formspec*`, `url`, `version`).
- It controls the document's lifecycle or processing (`status`, `targetDefinition`).
- It is the primary structural payload (`items`, `binds`, `tree`, `rules`, `evaluation`).
- It has complex behavioral implications that LLMs need to understand (`dataType`, `path`, `severity`).
- Misunderstanding it leads to incorrect processing (constraint kinds, conformance-affecting enums).

Do NOT mark as critical:

- Simple metadata properties (`name`, `title`, `description` at the document level).
- Optional convenience properties.
- Properties whose behavior is self-evident from the name and type.

### 6.5 The `intent` Value

The `intent` is distinct from `description`. `description` is the full behavioral contract (can be 2-3 sentences, references other properties and spec sections). `intent` is a single clause optimized for LLM context windows — max ~15 words, answering "why does this property exist?"

Write the `intent` as a single sentence (no period) that focuses on *purpose*, not *mechanics*:

- Good: `"Version pin for theme document compatibility"`
- Good: `"Stable identifier of the definition across versions"`
- Bad: `"A string that holds the version number."` (describes mechanics, not purpose)
- Bad: `"Version pin for theme document compatibility. Processors MUST reject themes with an unrecognized version."` (too long for intent — the MUST clause belongs in `description`)

---

## 7. Type Patterns

### 7.1 Enums

Enums MUST include a `description` that explains each value. Use inline explanation within the description string:

```json
"status": {
  "type": "string",
  "enum": ["draft", "active", "retired"],
  "description": "Definition lifecycle state. Transitions: draft -> active -> retired. 'draft': under development. 'active': in production, content is immutable. 'retired': no longer used for new data collection."
}
```

For enums with complex semantics, the description SHOULD include:

1. The meaning of each enum value.
2. Allowed transitions between values.
3. Behavioral implications of each value.

### 7.2 Arrays with Constraints

Arrays SHOULD include structural constraints where applicable:

```json
"rules": {
  "type": "array",
  "items": {
    "$ref": "#/$defs/FieldRule"
  },
  "minItems": 1,
  "description": "Ordered array of field mapping rules..."
}
```

Common array constraints:

- `minItems` -- Minimum cardinality. Use `1` when the array must be non-empty.
- `maxItems` -- Maximum cardinality. Use sparingly.
- `uniqueItems` -- When array entries must be distinct.

### 7.3 String Patterns

Use `pattern` for strings with a defined format that is not covered by the standard `format` keywords:

```json
"key": {
  "type": "string",
  "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$",
  "description": "Stable identifier for this Item. MUST be unique across the entire Definition."
}
```

Use `format` for standard formats recognized by JSON Schema validators:

```json
"url": {
  "type": "string",
  "format": "uri"
}
```

Use `minLength: 1` when a string must be non-empty but has no specific format:

```json
"version": {
  "type": "string",
  "minLength": 1
}
```

### 7.4 Object Types with `additionalProperties`

Top-level document schemas use `"additionalProperties": false` to enforce strict property sets:

```json
{
  "type": "object",
  "required": ["$formspecTheme", "version", "targetDefinition"],
  "additionalProperties": false,
  "properties": { ... }
}
```

When extension properties are allowed, combine with `patternProperties`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "patternProperties": {
    "^x-": {}
  },
  "properties": { ... }
}
```

**Why `additionalProperties: false`:** This catches typos (a misspelled property name is rejected rather than silently ignored), enforces completeness (every accepted property is documented), and makes the structural contract explicit. The trade-off: when a new spec version adds a property, old validators reject new documents. This is the correct behavior — old validators should not silently accept documents with unknown properties, since those properties may carry behavioral semantics the old validator cannot enforce.

### 7.5 Composition: `oneOf`, `anyOf`, `allOf`

Use these composition keywords when a property can take multiple shapes:

- **`oneOf`** -- Exactly one of the sub-schemas must match. Use for discriminated unions.
- **`anyOf`** -- At least one sub-schema must match. Use for flexible type alternatives.
- **`allOf`** -- All sub-schemas must match. Use for combining base types with extensions.

When using `oneOf` with a discriminator, include a `description` that explains the discrimination logic:

```json
"reference": {
  "oneOf": [
    { "$ref": "#/$defs/Reference" },
    { "$ref": "#/$defs/RefPointer" }
  ],
  "description": "Either a full inline Reference object, or a $ref pointer to a referenceDefs entry with optional property overrides."
}
```

### 7.6 The `default` Keyword

Use `default` to declare the assumed value when a property is omitted:

```json
"versionAlgorithm": {
  "type": "string",
  "enum": ["semver", "date", "integer", "natural"],
  "default": "semver",
  "description": "Controls how version strings are interpreted..."
}
```

The `default` value MUST match one of the allowed values (enum members, type constraints).

---

## 8. The `$defs` Section

### 8.1 Structure

All shared type definitions live in a top-level `$defs` object (not the deprecated `definitions` keyword). Formspec schemas use `$defs` consistently:

```json
{
  "$schema": "...",
  "$id": "...",
  "type": "object",
  "properties": { ... },
  "$defs": {
    "Item": { ... },
    "Bind": { ... },
    "Shape": { ... }
  }
}
```

### 8.2 Naming Convention

`$defs` keys use **PascalCase** for type names:

```
Item, Bind, Shape, FieldRule, TargetSchema, OptionSet, OptionEntry,
FELExpression, Presentation, ValidationResult, TargetDefinition,
BoundReference, Reference, ReferenceOrRef, ReferenceDefs,
ConceptBinding, VocabularyBinding, Alignment
```

### 8.3 When to Extract to `$defs`

Extract a type to `$defs` when:

- It is referenced 2+ times within the schema (DRY).
- It represents a concept with its own identity that a reader would look up by name (FieldRule, TargetDefinition, ValidationResult).
- It is referenced by other schemas via cross-schema `$ref`.

Keep inline when:

- It is a one-off structural constraint used in exactly one place.
- It is a simple `oneOf`/`anyOf` that is more readable inline than as a named type.

### 8.4 Cross-Schema References

Schemas reference types in other schemas using full `$ref` URIs:

```json
{
  "targetDefinition": {
    "$ref": "https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition"
  }
}
```

The Component schema defines the canonical `TargetDefinition` type. Other sidecar schemas (References, Locale, Ontology) reference it rather than duplicating it.

**Rules:**

- Use `#/$defs/TypeName` for references within the same schema.
- Use the full `$id` URI with `#/$defs/TypeName` for cross-schema references.
- Never duplicate a type definition that belongs in another schema. Reference the canonical source.

### 8.5 Internal `$ref` Usage

Within a schema, properties that reference a defined type use `$ref`:

```json
"items": {
  "type": "array",
  "items": {
    "$ref": "#/$defs/Item"
  }
}
```

For frequently referenced types (like `FELExpression`), define them once in `$defs` and reference everywhere:

```json
"$defs": {
  "FELExpression": {
    "type": "string",
    "minLength": 1,
    "description": "FEL expression -- the language for all form logic...",
    "x-lm": {
      "critical": true,
      "intent": "FEL expression..."
    }
  }
}
```

Then reference:

```json
"calculate": {
  "$ref": "#/$defs/FELExpression",
  "description": "FEL expression that computes this field's value..."
}
```

---

## 9. Extension Model

### 9.1 The `x-` Property Convention

Extension properties in Formspec documents use the `x-` prefix. In schemas, this is expressed via `patternProperties`:

```json
{
  "additionalProperties": false,
  "patternProperties": {
    "^x-": {}
  }
}
```

The `{}` (empty schema) means any value is accepted for extension properties. This allows extensions to carry any JSON value without schema validation.

### 9.2 Extension Points at Different Levels

Extensions can appear at multiple levels within a document:

**Top-level document extensions:**

```json
{
  "additionalProperties": false,
  "patternProperties": {
    "^x-": {}
  },
  "properties": {
    "extensions": {
      "type": "object",
      "propertyNames": {
        "pattern": "^x-"
      },
      "description": "Extension properties. All keys MUST be prefixed with 'x-'."
    }
  }
}
```

**Default:** Use a dedicated `extensions` property for document-level extensions. It cleanly separates extension data from regular properties and makes extension content discoverable.

Use `patternProperties` on the object itself only for nested objects (e.g., within `$defs` types) where a dedicated `extensions` property would add unnecessary nesting.

Some existing schemas use top-level `patternProperties` instead — see `legacy-cleanup.md`.

**Item-level extensions:**

```json
"extensions": {
  "type": "object",
  "propertyNames": {
    "pattern": "^x-"
  },
  "description": "Item-level extension data. All keys MUST be prefixed with 'x-'."
}
```

### 9.3 `propertyNames` Enforcement

When using a dedicated `extensions` object, enforce the `x-` prefix using `propertyNames`:

```json
"extensions": {
  "type": "object",
  "propertyNames": {
    "pattern": "^x-"
  }
}
```

When using `patternProperties` at the object level, the `^x-` pattern in the key achieves the same constraint implicitly.

---

## 10. Status and Lifecycle

### 10.1 The Status Enum

Documents with a lifecycle use a `status` enum:

```json
"status": {
  "type": "string",
  "enum": ["draft", "active", "retired"],
  "description": "Lifecycle state. Transitions: draft -> active -> retired. Backward transitions are forbidden."
}
```

This three-value lifecycle appears in: Definition, Response (with `in-progress`, `completed`, `amended`), Registry entries, and Respondent Ledger (with `in-progress`, `completed`, `amended`, `stopped`).

The specific enum values vary by document type, but the pattern of an ordered lifecycle with forbidden backward transitions is consistent.

---

## 11. Versioning Properties

### 11.1 The Identity Tuple

The `(url, version)` tuple is the Formspec identity model. Both properties SHOULD be `x-lm.critical: true`.

For document types with strict versioning:

```json
"version": {
  "type": "string",
  "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$",
  "description": "Semantic version...",
  "x-lm": { "critical": true, "intent": "..." }
}
```

For document types with flexible versioning (supporting multiple algorithms):

```json
"version": {
  "type": "string",
  "minLength": 1,
  "description": "Version identifier. Interpretation governed by versionAlgorithm (default: semver).",
  "x-lm": { "critical": true, "intent": "..." }
},
"versionAlgorithm": {
  "type": "string",
  "enum": ["semver", "date", "integer", "natural"],
  "default": "semver"
}
```

### 11.2 Compatible Version Ranges

Sidecar documents express version compatibility using semver range syntax:

```json
"compatibleVersions": {
  "type": "string",
  "description": "Semver range expression for compatible Definition versions.",
  "examples": [">=1.0.0 <2.0.0", "1.x"]
}
```

Or at the mapping level:

```json
"definitionVersion": {
  "type": "string",
  "description": "Semver range of compatible Definition versions. An implementation MUST refuse to execute when the resolved version does not satisfy this range."
}
```

### 11.3 Schema Evolution

When a spec reaches a new major version (e.g., v2.0), the schema evolves as follows:

1. **New `$id`:** The schema gets a new `$id` with the new version segment (`https://formspec.org/schemas/[name]/2.0`).
2. **New file (optional):** For major versions, consider a new file (`[name]-v2.schema.json`) alongside the old one. The old schema remains available for validating documents pinned to the old version (VP-01).
3. **New `const`:** The `$formspec*` marker updates from `"1.0"` to `"2.0"`.
4. **Old schema preserved:** Formspec's version pinning rule (Core S6.4, VP-01) means old documents must remain validatable against the schema version they were created with. Do not delete or modify the old schema in ways that break existing documents.

For minor/patch schema changes within a major version (adding an optional property, relaxing a constraint), update the schema in place. The `$id` does not change for non-breaking additions.

---

## 12. Schema-Spec Alignment

### 12.1 Co-Authoritative Model

Schemas and spec prose are **co-authoritative** in Formspec. Neither is assumed more correct:

- **Schemas** define structural truth: property existence, types, required fields, enums, patterns, constraints.
- **Specs** define behavioral truth: processing semantics, evaluation order, null handling, precedence, error behavior.

When authoring a schema, ensure it accurately captures the structural contract of the spec. When authoring spec prose, ensure behavioral rules that can be structurally enforced are reflected in the schema.

### 12.2 Schema Reference Markers in Specs

The spec prose pulls generated tables from schemas using the `schema-ref` marker system:

```markdown
<!-- schema-ref:start id=theme-top-level schema=schemas/theme.schema.json pointers=# -->
<!-- generated:schema-ref id=theme-top-level -->
| Pointer | Field | Type | Required | Notes | Description |
|---|---|---|---|---|---|
... (generated rows) ...
<!-- schema-ref:end -->
```

**How to add a schema reference:**

1. In the spec prose, at the point where you describe the document structure, add the start marker:

   ```markdown
   <!-- schema-ref:start id=[unique-id] schema=schemas/[name].schema.json pointers=[json-pointer] -->
   ```

2. The `id` must be unique within the spec document.
3. The `schema` path is relative to the repository root.
4. The `pointers` value determines what gets included:
   - `#` -- All top-level properties.
   - `#/$defs/FieldRule` -- A specific `$defs` type.
   - Comma-separated: `#/properties/url,#/$defs/TargetDefinition` -- Multiple targets.
5. Run `npm run docs:generate` to populate the generated table.
6. The generated table between `<!-- generated:schema-ref ... -->` and `<!-- schema-ref:end -->` is machine-maintained. NEVER hand-edit it.

### 12.3 Synchronization Workflow

For any schema change:

1. Edit `schemas/[name].schema.json`.
2. If the change affects structural properties documented in the spec, verify the spec prose still aligns.
3. Run `npm run docs:generate` to regenerate schema reference tables and BLUF injections.
4. Run `npm run docs:check` to verify:
   - All `x-lm.critical: true` properties have `description` and `examples`.
   - Generated artifacts are not stale.
   - Cross-spec contracts are satisfied.

### 12.4 Handling Disagreements

If you discover a disagreement between schema and spec:

- **Schema says required, spec doesn't mention it:** Verify the intent. If the spec should require it, update the spec. If it should be optional, update the schema.
- **Schema allows values the spec prohibits:** The spec may define semantic constraints that JSON Schema cannot express. Add a comment in the schema `description` noting the spec constraint.
- **Spec describes a property the schema doesn't have:** Either add it to the schema or remove it from the spec. Do not leave phantom properties.

In all cases, surface the disagreement explicitly rather than silently picking one source as "more correct."

---

## 13. File Organization

### 13.1 File Naming

Schema files live in `schemas/` and follow the naming convention:

```
schemas/[name].schema.json
```

Where `[name]` matches the document type in lowercase:

- `definition.schema.json`
- `theme.schema.json`
- `component.schema.json`
- `mapping.schema.json`
- `screener.schema.json`
- `locale.schema.json`
- `ontology.schema.json`
- `references.schema.json`
- `response.schema.json`
- `changelog.schema.json`
- `registry.schema.json`
- `validationResult.schema.json`
- `validationReport.schema.json`
- `respondent-ledger.schema.json`
- `determination.schema.json`
- `conformance-suite.schema.json`
- `fel-functions.schema.json`
- `core-commands.schema.json`

Some existing schemas use camelCase — see `legacy-cleanup.md` for the rename list. New schemas MUST use hyphen-case (`respondent-ledger.schema.json`).

### 13.2 Property Ordering Within a Schema

Follow this ordering for the top-level schema object:

1. `$schema`
2. `$id`
3. `title`
4. `description`
5. `type`
6. `required`
7. `additionalProperties`
8. `patternProperties` (if applicable)
9. `properties`
10. `$defs`

Within `properties`, order properties as follows:

1. Document type marker (`$formspec*`)
2. `$schema` (optional)
3. Identity properties (`url`, `version`, `name`)
4. Metadata properties (`title`, `description`)
5. Binding/reference properties (`targetDefinition`, `definitionRef`)
6. Primary payload properties (`items`, `binds`, `rules`, `tree`)
7. Configuration properties
8. Extensions

---

## 14. Validation Patterns

### 14.1 Structural vs. Behavioral Validation

JSON Schema handles **structural** validation: property existence, types, enums, patterns, cardinality.

**Behavioral** validation -- processing order, expression evaluation, cross-document consistency, semantic correctness -- is deferred to the spec prose and runtime validation.

When a constraint cannot be expressed in JSON Schema, document it in the property `description`:

```json
"calculate": {
  "$ref": "#/$defs/FELExpression",
  "description": "FEL expression that computes this field's value. The expression MUST NOT reference the field's own value (no self-reference in calculate). Evaluated during Phase 2 (Recalculate) of the processing model."
}
```

### 14.2 Cross-Property Constraints

JSON Schema 2020-12 supports `if`/`then`/`else` for conditional constraints. Use these for discriminated types:

```json
{
  "if": {
    "properties": { "type": { "const": "field" } }
  },
  "then": {
    "required": ["dataType"]
  }
}
```

For constraints that span properties but cannot be expressed in JSON Schema (e.g., "if X is present then Y must reference a valid path in X"), document them in the spec prose and note the limitation in the schema description.

### 14.3 Nullable Properties

JSON Schema 2020-12 does not have OpenAPI's `nullable` keyword. To express "this property can be null," use an array type:

```json
"calculate": {
  "type": ["string", "null"],
  "description": "FEL expression or null. When null, the field has no calculated value."
}
```

This matters for FEL null propagation semantics (Core S3.8). Properties that participate in FEL evaluation and can legitimately be absent should use `["type", "null"]` rather than omitting the property entirely — these are semantically different. A missing property means "not declared"; a null-valued property means "declared but empty."

### 14.4 Format Validation

Use the `format` keyword for standard string formats:

| Format | Usage |
|--------|-------|
| `"uri"` | URL/URI properties |
| `"date-time"` | ISO 8601 timestamps |
| `"date"` | ISO 8601 dates |
| `"email"` | Email addresses |
| `"uri-reference"` | Relative URI references |

Note: JSON Schema `format` is an annotation by default in 2020-12 -- it does not enforce validation unless the validator is configured to do so. Include format for documentation value even if enforcement is not guaranteed.

---

## 15. Common Property Catalog

The following properties recur across multiple schemas. Reuse the same type, description pattern, and `x-lm` annotation when applicable:

### 15.1 Metadata Properties

```json
"name": {
  "type": "string",
  "pattern": "^[a-zA-Z][a-zA-Z0-9_\\-]*$",
  "description": "Machine-readable short name...",
  "examples": ["budget-web"]
},
"title": {
  "type": "string",
  "description": "Human-readable display name.",
  "examples": ["Budget Form -- Web Theme"]
},
"description": {
  "type": "string",
  "description": "Human-readable description of purpose and audience."
}
```

### 15.2 Timestamp Properties

```json
"authored": {
  "type": "string",
  "format": "date-time",
  "description": "ISO 8601 timestamp...",
  "examples": ["2025-07-15T10:30:00Z"]
}
```

### 15.3 Extension Properties

```json
"extensions": {
  "type": "object",
  "propertyNames": {
    "pattern": "^x-"
  },
  "description": "Extension data. All keys MUST be prefixed with 'x-'."
}
```

---

## 16. Checklist for New Schemas

When creating a new Formspec-org schema, verify the following:

- [ ] `$schema` is `"https://json-schema.org/draft/2020-12/schema"`.
- [ ] `$id` follows the `https://formspec.org/schemas/[name]/1.0` pattern.
- [ ] `title` starts with `"Formspec "`.
- [ ] `description` is a dense paragraph covering purpose, ecosystem relationship, and invariants.
- [ ] `type` is `"object"`.
- [ ] `required` array includes the `$formspec*` document type marker.
- [ ] The `$formspec*` marker property has `const`, `x-lm.critical: true`, `examples`, and a description.
- [ ] All `x-lm.critical: true` properties have both `description` and `examples`.
- [ ] `additionalProperties: false` is set (with `patternProperties` for `x-` extensions if needed).
- [ ] `$defs` keys use PascalCase.
- [ ] Cross-schema references use the full `$id` URI.
- [ ] Property names use camelCase.
- [ ] Enums include per-value documentation in their description.
- [ ] A corresponding `schema-ref` marker exists in the spec prose.
- [ ] `npm run docs:generate` succeeds.
- [ ] `npm run docs:check` passes.

---

*End of Formspec-Org JSON Schema Authoring Guide.*
