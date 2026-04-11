# ADR 0012: JSON Schema Review — definition.schema.json & response.schema.json

## Status
Implemented — 3 spec example fixes remain in spec-part3.md (choices/targets/boolean binds)
**Method:** Full spec read via 8 parallel agents (§1–§9), cross-referenced against both schemas.  
**Source of truth priority:** §4 (Definition Schema) > §5 (Validation) > §2 (Conceptual Model) > §7 (Examples)

---

## Summary

| Category | Count |
|----------|-------|
| Spec-vs-Schema mismatches (schema must change) | 8 |
| Spec-vs-Example mismatches (examples must change) | 7 |
| Schema-vs-Schema issues (internal) | 2 |
| Missing schemas | 1 |
| **Total** | **18** |

---

## A. SCHEMA MUST CHANGE (spec is authoritative, schema is wrong)

### A1. Group Item missing `$ref` and `keyPrefix` — MEDIUM

**Spec §6.6.1** normatively declares two properties on Group Items:
- `$ref` — string (URI), 0..1, canonical reference to another Definition
- `keyPrefix` — string, 0..1, pattern `[a-zA-Z][a-zA-Z0-9_]*`

**Schema:** The Group `then` block lists `children`, `repeatable`, `minRepeat`, `maxRepeat` but omits `$ref` and `keyPrefix`. `additionalProperties: false` rejects them.

**Fix:** Add both properties to the Group `then.properties`.

### A2. Response schema uses `definitionUrl`+`definitionVersion` but spec §6.4 uses combined `definition` — HIGH

**Spec §2.1.6** defines separate `definitionUrl` and `definitionVersion` properties.  
**Spec §6.4** (normative, later section) uses a combined `"definition"` property with `url|version` syntax.  
**All §7 examples** use `"definition": "url|version"` (combined string).

This is a **spec-internal conflict** between §2.1.6 and §6.4. The schema currently follows §2.1.6. Two options:

1. **Keep schema as-is** (separate fields), fix §6.4 and all §7 examples. Separate fields are more machine-friendly (no parsing needed).
2. **Switch to combined `definition`** field per §6.4, fix §2.1.6 and schema.

**Recommendation:** Option 1 — keep separate fields, they're better for machine consumption. Fix spec §6.4 and examples.

### A3. `derivedFrom` type mismatch — MEDIUM

**Spec §4.1** (normative table): `derivedFrom` is `string (URI)`, cardinality 0..1.  
**Spec §7.5.2** examples: `"derivedFrom": ["url|version"]` — an array of strings.  
**Schema:** `{ "type": "string", "format": "uri" }` — matches §4.1.

The §7.5.2 examples are wrong per the normative spec. However, supporting multiple parents is useful.

**Recommendation:** Schema is correct per §4.1. Flag §7.5.2 examples as a spec bug (should be string, not array). Consider promoting to `oneOf [string, array]` in v1.1.

### A4. `source` enum on ValidationResult too restrictive — LOW

**Spec §5.3.1**: `source` is not in the base ValidationResult table — it's added only by §5.7.1 for external results with the literal value `"external"`. The base table doesn't define `source` with an enum.
**Schema:** `"source": { "type": "string", "enum": ["bind", "shape", "external"] }` — includes `"bind"` and `"shape"` which are not in the spec.

**Fix:** Either (a) keep the broader enum (it's useful even if not normative yet), or (b) remove the enum and just use `{ "type": "string" }`. The broader enum is forward-compatible and sensible.

**Recommendation:** Keep as-is — the enum is a reasonable extension of the spec's intent. Document in schema description.

### A5. Instance `description` property missing from schema — MEDIUM

**Spec §4.4** normative table does NOT list `description` on Instance. However:
- §7.1.1 example: `"main": { "description": "Primary form data" }`
- §7.4.1 example: `"prior_year": { "description": "Prior-year actuals..." }`

**Schema:** No `description` property on Instance `$def`.

This is ambiguous — the §4.4 normative table doesn't include it, but examples use it. Since §4.4 is normative and Instance has `additionalProperties: false`, this is an example bug.

**Recommendation:** Add `description` to Instance `$def` properties. It's clearly intended, just missed from the normative table.

### A6. Instance `source` format should be `uri-template` not `uri` — LOW

**Spec §4.4** example: `"source": "https://api.example.gov/responses/2024/{{entityId}}"`  
The `{{...}}` template syntax makes this a URI template, not a valid URI.

**Schema:** `"source": { "type": "string", "format": "uri" }`

**Fix:** Change to `"format": "uri-template"` or remove the format constraint.

### A7. Field `dataType: "choice"` but examples use `choices` not `options` — HIGH (spec fix)

**Spec §4.2.3** normatively declares the property name as `options`.  
**§7 examples** use `choices` in at least 3 places (§7.1.1, §7.5.1).  
**Schema:** Uses `options`. This matches the normative spec.

**Fix needed:** Fix §7 examples to use `options` instead of `choices`.

### A8. extensions object should enforce `x-` key prefix — LOW

**Spec §8.4 rule 1**: All keys within an `extensions` object MUST be prefixed with `x-`.  
**Schema:** `"extensions": { "type": "object" }` — no key validation.

**Fix:** Add `"propertyNames": { "pattern": "^x-" }` to all `extensions` properties.

---

## B. EXAMPLES MUST CHANGE (schema and normative spec are correct)

### B1. §7 uses `required: true` (boolean) — spec §4.3.1 says `string` (FEL expression)

The normative Bind table says `required` is `string (FEL expression → boolean)`. But §2 informally calls it `boolean`, and §7 examples all use `true` (boolean literal). Meanwhile §2's own conceptual example at line 384 uses `"required": "true"` (string).

**Assessment:** The spec is slightly inconsistent between §2 and §4. §4.3.1 is normative and says string. The schema correctly uses `{ "type": "string" }`. Examples should use `"true"` (string) not `true` (boolean). Alternatively, if we want to support both, the schema could use `oneOf [boolean, string]`, but this would be a spec change.

**Recommendation:** Defer to normative §4.3.1 — keep schema as string. Fix examples.

### B2. §7 uses `readonly: true` (boolean) — spec §4.3.1 says `string`

Same issue as B1. Schema is correct per §4.3.1.

### B3. §7 Response examples use `"definition": "url|version"` — see A2

Fix examples to use `definitionUrl` + `definitionVersion`.

### B4. §7.1.1 uses `initialValue` on a Bind — spec says it belongs on Field Item (§4.2.3)

`initialValue` is normatively a Field Item property (§4.2.3), not a Bind property. The §7.1.1 example puts it on a Bind object.

**Fix:** Move `initialValue` from the Bind to the Field Item definition in the example.

### B5. §7 Response examples use `"status": "complete"` — schema says `"completed"`

**Spec §2.1.6** normative table: `"completed"`.  
**Schema:** `"completed"`.  
**§7 examples:** `"complete"` (missing the 'd').

**Fix:** Change examples from `"complete"` to `"completed"`.

### B6. §7 Shape examples use `targets` (plural array) — spec §5.2.1 says `target` (singular string)

**Spec §5.2.1** normative table: `target`, type `string`, cardinality 1..1.  
**Schema:** `target` (string). Correct.  
**§7 examples:** `"targets": ["total_budget"]` — plural name, array type.

**Fix:** Change examples from `"targets": [...]` to `"target": "..."`.

### B7. §7 Shape examples use hyphens in `id` — spec pattern forbids them

**Spec §5.2.1**: `id` MUST match `[a-zA-Z][a-zA-Z0-9_]*` (no hyphens).  
**Schema:** Same pattern.  
**§7 examples:** `"budget-balances"`, `"personnel-concentration-warning"` etc.

**Options:**
1. Fix examples to use underscores: `budget_balances` etc.
2. Expand the pattern to allow hyphens: `[a-zA-Z][a-zA-Z0-9_\-]*`

**Recommendation:** Option 2 — hyphens are natural in identifiers. Expand both spec and schema pattern.

---

## C. SCHEMA INTERNAL ISSUES

### C1. `$formspec` required but absent from all §7 examples

**Known deferred issue.** §7 examples are illustrative fragments. Schema is correct to require it.

### C2. ValidationReport has no schema file

**Spec §5.4.1** defines a standalone ValidationReport object with `valid`, `results`, `counts`, `timestamp`. No `validationReport.schema.json` exists. The response schema only embeds `validationResults` (array) — it doesn't model the full standalone report.

**Recommendation:** Create `validationReport.schema.json` as a companion schema.

---

## D. CONFIRMED CORRECT (no change needed)

- ✅ `$formspec` required as const `"1.0"` — matches §4.1
- ✅ `url`, `version`, `status`, `title`, `items` required — matches §4.1
- ✅ `versionAlgorithm` enum `["semver", "date", "integer", "natural"]` with default `"semver"` — matches §6.2
- ✅ `status` enum `["draft", "active", "retired"]` — matches §6.3
- ✅ `dataType` enum (13 values including `time` and `money`) — matches §4.2.3
- ✅ Shape `anyOf` requiring one of `constraint/and/or/not/xone` — matches §5.2.1/§5.2.2
- ✅ Bind properties (all 12) match §4.3.1 normative table
- ✅ Variable properties (`name`, `expression`, `scope`) match §4.5.1
- ✅ OptionSet/OptionEntry structure matches §4.6
- ✅ Screener/Route structure matches §4.7
- ✅ Migrations/MigrationDescriptor structure matches §6.7
- ✅ Instance `anyOf [source, data]` — matches §4.4
- ✅ Instance `schema` as flat `{ field: type_string }` — matches §4.4
- ✅ Response `validationResults` array of ValidationResult — matches §2.1.6
- ✅ ValidationResult required fields (`path`, `severity`, `constraintKind`, `message`) — matches §5.3.1
- ✅ Extension model uses nested `extensions` sub-property — matches §8.4
- ✅ Item conditional schema (if/then) for group/field/display — correct approach
- ✅ `additionalProperties: false` on all objects — appropriate for strict validation

---

## Prioritized Action Items

| Priority | Item | Action |
|----------|------|--------|
| 1 | A1 | Add `$ref` and `keyPrefix` to Group Item schema |
| 2 | A5 | Add `description` to Instance schema |
| 3 | A6 | Change Instance `source` format to `uri-template` |
| 4 | A8 | Add `propertyNames` pattern to all `extensions` objects |
| 5 | B5 | Fix §7 examples: `"complete"` → `"completed"` |
| 6 | B6 | Fix §7 examples: `"targets"` → `"target"` |
| 7 | B7 | Expand Shape `id` pattern to allow hyphens (spec + schema) |
| 8 | B1/B2 | Fix §7 examples: `required: true` → `"true"`, `readonly: true` → `"true"` |
| 9 | B3/A2 | Fix §6.4 + §7 examples to use `definitionUrl`/`definitionVersion` |
| 10 | B4 | Fix §7.1.1: move `initialValue` from Bind to Field Item |
| 11 | A7 | Fix §7 examples: `choices` → `options` |
| 12 | C2 | Create `validationReport.schema.json` |
