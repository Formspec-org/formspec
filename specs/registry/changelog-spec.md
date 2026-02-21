# Formspec Changelog Format v1.0

**Status:** Draft · **Companion to:** Formspec v1.0 · **Date:** 2025-07

---

## 1. Introduction

A **Changelog Document** is a JSON document that enumerates the differences
between two versions of a Formspec Definition. It supports:

- **Automated tooling** — migration generation, impact analysis, reviewer notifications.
- **Human review** — structured release notes for form authors.
- **Programmatic consumers** — CI/CD gates that reject breaking changes on minor branches.

Terminology and Definition structure (items, binds, shapes, etc.) follow Formspec v1.0.
Semver semantics follow §6.2; migration objects follow §6.7.

## 2. Changelog Document Schema

A Changelog Document is a JSON object at the top level.

| Property | Type | Req | Description |
|---|---|---|---|
| `$schema` | string (URI) | RECOMMENDED | URI of this specification's JSON Schema. |
| `definitionUrl` | string (URI) | REQUIRED | The `url` of the Definition this changelog describes. |
| `fromVersion` | string (semver) | REQUIRED | Base version being compared. |
| `toVersion` | string (semver) | REQUIRED | Target version being compared. |
| `generatedAt` | string (date-time) | RECOMMENDED | ISO 8601 timestamp of generation. |
| `semverImpact` | enum | REQUIRED | Computed overall impact: `"major"`, `"minor"`, or `"patch"`. |
| `summary` | string | OPTIONAL | Human-readable summary of the change set. |
| `changes` | array of Change | REQUIRED | Ordered list of Change objects (§3). |

`semverImpact` MUST equal the maximum impact across all entries in `changes`
(breaking → major, compatible → minor, cosmetic → patch).

### 2.1 Example

```json
{
  "$schema": "https://formspec.org/changelog/v1/schema.json",
  "definitionUrl": "https://example.org/forms/grant-application",
  "fromVersion": "2.1.0",
  "toVersion": "3.0.0",
  "generatedAt": "2025-07-10T14:30:00Z",
  "semverImpact": "major",
  "summary": "Removes legacy budget fields; adds new personnel section.",
  "changes": [
    {
      "type": "removed",
      "target": "item",
      "path": "items.budget.legacyCost",
      "key": "legacyCost",
      "impact": "breaking",
      "description": "Removed deprecated cost field.",
      "before": { "key": "legacyCost", "dataType": "currency" },
      "migrationHint": "drop"
    },
    {
      "type": "added",
      "target": "item",
      "path": "items.budget.personnel",
      "key": "personnel",
      "impact": "compatible",
      "description": "New personnel budget group.",
      "after": { "key": "personnel", "itemType": "group" }
    }
  ]
}
```

## 3. Change Object

Each Change describes a single atomic modification to a Definition element.

| Property | Type | Req | Description |
|---|---|---|---|
| `type` | enum | REQUIRED | `"added"`, `"removed"`, `"modified"`, `"moved"`, `"renamed"` |
| `target` | enum | REQUIRED | `"item"`, `"bind"`, `"shape"`, `"optionSet"`, `"dataSource"`, `"screener"`, `"migration"`, `"metadata"` |
| `path` | string | REQUIRED | Dot-path to the affected element (e.g., `"items.budget.personnel"`). |
| `key` | string | OPTIONAL | The item `key` when `target` is `"item"`. |
| `impact` | enum | REQUIRED | `"breaking"`, `"compatible"`, `"cosmetic"` |
| `description` | string | RECOMMENDED | Human-readable description of the change. |
| `before` | any | OPTIONAL | Previous value or structural fragment. Present for `modified`, `removed`, `renamed`, `moved`. |
| `after` | any | OPTIONAL | New value or structural fragment. Present for `added`, `modified`, `renamed`, `moved`. |
| `migrationHint` | string | OPTIONAL | Suggested transform: a FEL expression, `"drop"`, or `"preserve"`. See §6. |

### 3.1 Change Type Examples

**added** — a new item, bind, shape, or other element.

```json
{ "type": "added", "target": "item", "path": "items.contact.phone",
  "key": "phone", "impact": "compatible",
  "description": "Added optional phone field.",
  "after": { "key": "phone", "type": "field", "label": "Phone", "dataType": "phone" } }
```

**removed** — an element no longer present.

```json
{ "type": "removed", "target": "item", "path": "items.contact.fax",
  "key": "fax", "impact": "breaking",
  "description": "Removed fax field.",
  "before": { "key": "fax", "type": "field", "label": "Fax", "dataType": "phone" },
  "migrationHint": "drop" }
```

**modified** — a property of an existing element changed.

```json
{ "type": "modified", "target": "item", "path": "items.contact.email",
  "key": "email", "impact": "cosmetic",
  "description": "Updated label from 'E-mail' to 'Email address'.",
  "before": { "label": "E-mail" },
  "after": { "label": "Email address" } }
```

**renamed** — item key changed (detected heuristically).

```json
{ "type": "renamed", "target": "item", "path": "items.budget.totalCost",
  "key": "totalCost", "impact": "breaking",
  "description": "Renamed 'cost' → 'totalCost'.",
  "before": { "key": "cost" },
  "after": { "key": "totalCost" },
  "migrationHint": "$old.cost" }
```

**moved** — item relocated to a different parent group.

```json
{ "type": "moved", "target": "item", "path": "items.personnel.salary",
  "key": "salary", "impact": "compatible",
  "description": "Moved from 'budget' group to 'personnel' group.",
  "before": { "path": "items.budget.salary" },
  "after": { "path": "items.personnel.salary" } }
```

## 4. Impact Classification Rules

A conformant generator MUST classify each change per the table below.
Unlisted changes default to **cosmetic**.

### 4.1 Breaking (→ major)

| Change | Rationale |
|---|---|
| Item removed | Existing responses lose a field. |
| Item key renamed | Stored response keys no longer match. |
| `dataType` changed | Stored values may be invalid under new type. |
| `required` constraint added to existing field | Previously valid responses may fail. |
| `repeat` → non-repeat (or vice versa) | Structural change to stored data. |
| `itemType` changed (e.g., group → field) | Structural change to stored data. |
| Option removed from closed optionSet | Existing selections become invalid. |

### 4.2 Compatible (→ minor)

| Change | Rationale |
|---|---|
| Item added (optional) | No impact on existing responses. |
| Item added (required) with default | Fillable from default; no data loss. |
| Option added to optionSet | Existing selections remain valid. |
| New shape added | Presentation only; additive. |
| New bind added | Additive data mapping. |
| Constraint relaxed (e.g., maxLength increased) | Existing data still valid. |
| Item moved between groups (key preserved) | Data intact; layout change only. |

### 4.3 Cosmetic (→ patch)

| Change | Rationale |
|---|---|
| `label` changed | Display-only. |
| `hint` changed | Display-only. |
| `help` changed | Display-only. |
| `description` changed | Display-only. |
| Display order changed within a group | No data impact. |
| Shape property modified (e.g., width) | Presentation-only. |

## 5. Generation Algorithm

A conformant changelog generator MUST perform the following steps:

1. **Load** both Definition versions (identified by `fromVersion` and `toVersion`).
2. **Index items by `key`** — the `key` property is the stable identifier across versions.
3. **Detect removals** — for each key present in the old Definition but absent in the new,
   emit a Change with `type: "removed"`.
4. **Detect additions** — for each key present in the new Definition but absent in the old,
   emit a Change with `type: "added"`.
5. **Detect modifications** — for each key present in both versions, compare all properties.
   Emit a separate Change with `type: "modified"` for each differing property.
6. **Detect renames** (OPTIONAL heuristic) — among unpaired removed/added keys, if two
   items share the same `dataType`, child structure, and binds, emit `type: "renamed"`
   instead and remove them from the added/removed sets.
7. **Detect moves** — for keys present in both versions whose parent path differs,
   emit `type: "moved"`.
8. **Compute `semverImpact`** — take the maximum impact across all changes:
   breaking > compatible > cosmetic → major > minor > patch.

Repeat steps 3–7 for `binds`, `shapes`, `optionSets`, `dataSources`, and `screeners`
using their respective identifiers.

## 6. Relationship to §6.7 Migrations

A Changelog Document with `migrationHint` entries on breaking changes provides
sufficient information to **auto-generate** a §6.7 `migration` object.

### 6.1 Mapping Rules

| Change type | `migrationHint` | Generated `fieldMap` entry |
|---|---|---|
| `removed` | `"drop"` | *(omit key — value is discarded)* |
| `removed` | `"preserve"` | `{ "oldKey": "oldKey" }` — carry forward into extension data |
| `renamed` | FEL expression (e.g., `$old.cost`) | `{ "newKey": "$old.cost" }` |
| `modified` (dataType change) | FEL expression (e.g., `STRING($old.amount)`) | `{ "amount": "STRING($old.amount)" }` |
| `modified` (added required + default) | `"preserve"` | `{ "field": "$old.field ?? 'default'" }` |

### 6.2 Generation Procedure

Given a Changelog Document `C` for `fromVersion` → `toVersion`:

1. Create a new migration object: `{ "fromVersion": C.fromVersion, "fieldMap": {} }`.
2. For each change in `C.changes` where `impact` is `"breaking"` and `migrationHint`
   is present:
   - If `migrationHint` is `"drop"`, skip (no fieldMap entry needed).
   - Otherwise, add `{ [change.key]: change.migrationHint }` to `fieldMap`.
3. For each change where `type` is `"renamed"`, add
   `{ [after.key]: migrationHint }` to `fieldMap`.
4. The resulting migration object is valid per §6.7 and can be inserted into the
   new Definition's `migrations` array.

> **Note:** Auto-generated migrations SHOULD be reviewed by a form author before
> deployment. The `migrationHint` is advisory, not normative.

## 7. Media Type and File Extension

- Media type: `application/vnd.formspec.changelog+json`
- File extension: `.changelog.json`
- A changelog file SHOULD be named `{definitionSlug}-{fromVersion}..{toVersion}.changelog.json`
  (e.g., `grant-application-2.1.0..3.0.0.changelog.json`).

---

*End of Formspec Changelog Format v1.0.*
