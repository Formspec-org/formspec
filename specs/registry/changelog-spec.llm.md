# Formspec Changelog Format (LLM Reference)

A JSON document enumerating differences between two versions of a Formspec Definition. Supports automated migration generation, impact analysis, CI/CD gates, and human review.

## Document Structure

| Property | Required | Description |
|----------|----------|-------------|
| `$schema` | RECOMMENDED | URI of the JSON Schema |
| `definitionUrl` | REQUIRED | URL of the Definition |
| `fromVersion` | REQUIRED | Base semver version |
| `toVersion` | REQUIRED | Target semver version |
| `generatedAt` | RECOMMENDED | ISO 8601 timestamp |
| `semverImpact` | REQUIRED | Max impact: "major", "minor", or "patch" |
| `summary` | OPTIONAL | Human-readable summary |
| `changes` | REQUIRED | Ordered array of Change objects |

File extension: `.changelog.json`. Media type: `application/vnd.formspec.changelog+json`.

## Change Object

| Property | Required | Description |
|----------|----------|-------------|
| `type` | REQUIRED | "added", "removed", "modified", "moved", "renamed" |
| `target` | REQUIRED | "item", "bind", "shape", "optionSet", "dataSource", "screener", "migration", "metadata" |
| `path` | REQUIRED | Dot-path to affected element |
| `key` | OPTIONAL | Item key when target is "item" |
| `impact` | REQUIRED | "breaking", "compatible", "cosmetic" |
| `description` | RECOMMENDED | Human-readable description |
| `before` | OPTIONAL | Previous value/fragment (for modified, removed, renamed, moved) |
| `after` | OPTIONAL | New value/fragment (for added, modified, renamed, moved) |
| `migrationHint` | OPTIONAL | Suggested transform: FEL expression, "drop", or "preserve" |

## Impact Classification

**Breaking (→ major)**: Item removed, key renamed, dataType changed, required constraint added to existing field, repeat ↔ non-repeat, itemType changed, option removed from closed optionSet.

**Compatible (→ minor)**: Optional item added, required item added with default, option added, new shape/bind added, constraint relaxed, item moved (key preserved).

**Cosmetic (→ patch)**: Label/hint/help/description changed, display order changed, shape presentation property modified.

`semverImpact` = max across all changes (breaking > compatible > cosmetic).

## Generation Algorithm

1. Load both Definition versions
2. Index items by `key` (stable identifier)
3. Detect removals (key in old, absent in new)
4. Detect additions (key in new, absent in old)
5. Detect modifications (key in both, properties differ — separate Change per property)
6. Detect renames (optional heuristic: unmatched removed+added with same dataType/structure)
7. Detect moves (same key, different parent path)
8. Compute `semverImpact` as max impact

Repeat for binds, shapes, optionSets, dataSources, screeners.

## Migration Auto-Generation (→ §6.7)

Breaking changes with `migrationHint` can auto-generate §6.7 migration `fieldMap` entries:

| Change | migrationHint | Result |
|--------|--------------|--------|
| removed | "drop" | Omit (value discarded) |
| removed | "preserve" | Carry forward into extension data |
| renamed | FEL expr (e.g., `$old.cost`) | `{ newKey: "$old.cost" }` |
| modified (dataType) | FEL expr (e.g., `STRING($old.amount)`) | `{ amount: "STRING($old.amount)" }` |

Auto-generated migrations are advisory — should be reviewed before deployment.
