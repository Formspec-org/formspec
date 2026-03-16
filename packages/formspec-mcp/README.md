# formspec-mcp

MCP server that exposes Formspec form authoring as 65 tools. Thin wrapper around `formspec-studio-core` — all business logic lives there; this package adapts it to the [Model Context Protocol](https://modelcontextprotocol.io/) over stdio.

## Quick Start

```bash
# Build
npm run build

# Run (stdio transport)
npm start
# or
npx formspec-mcp
```

The server locates `schemas/` at startup (tries cwd, then `../../schemas` for monorepo layout). Fatal exit if not found.

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "formspec": {
      "command": "node",
      "args": ["/path/to/formspec/packages/formspec-mcp/dist/index.js"]
    }
  }
}
```

## Architecture

```
MCP Client (Claude)
    |
    v
server.ts          65 tool registrations + 3 schema resources
    |
    v
ProjectRegistry    Session manager (max 20 projects, two-phase lifecycle)
    |
    v
tools/*.ts         Thin handlers — parse input, delegate, format output
    |
    v
formspec-studio-core   51 authoring methods (Project class)
    |
    v
formspec-engine    FEL evaluation, validation, schema checking
```

### Two-Phase Projects

1. **Bootstrap** — submit raw JSON artifacts (`draft_definition`, `draft_component`, `draft_theme`), validate against JSON Schema, then `load_draft` to transition.
2. **Authoring** — structured tools (`field`, `page`, `group`, `show_when`, `add_rule`, etc.) that mutate the project through studio-core helpers.

Once loaded, a project cannot return to bootstrap. The registry enforces phase isolation — calling an authoring tool on a bootstrap project (or vice versa) returns a `WRONG_PHASE` error.

## Tools (65)

### Bootstrap (5)

| Tool | Purpose |
|------|---------|
| `formspec_draft_definition` | Submit definition JSON for schema validation |
| `formspec_draft_component` | Submit component JSON for schema validation |
| `formspec_draft_theme` | Submit theme JSON for schema validation |
| `formspec_validate_draft` | Check all drafts for unresolved errors |
| `formspec_load_draft` | Transition bootstrap -> authoring |

### Lifecycle (8)

| Tool | Purpose |
|------|---------|
| `formspec_create` | New project in bootstrap phase |
| `formspec_open` | Load from disk (`{name}.definition.json` + siblings) |
| `formspec_save` | Write all artifacts to disk |
| `formspec_list` | List open projects |
| `formspec_list_autosaved` | List autosaved snapshots (`~/.formspec/autosave/`) |
| `formspec_publish` | Export versioned bundle (blocked if errors exist) |
| `formspec_undo` / `formspec_redo` | History navigation |

### Structure (14)

| Tool | Purpose |
|------|---------|
| `formspec_field` | Add data field (string, number, choice, date, etc.) |
| `formspec_content` | Add display element (heading, paragraph, divider, alert, banner) |
| `formspec_group` | Add logical group container |
| `formspec_repeat` | Make group repeatable with min/max cardinality |
| `formspec_page` / `remove_page` / `move_page` | Page management (theme-tier) |
| `formspec_place` / `unplace` | Assign/remove items on pages |
| `formspec_update` | Update item properties |
| `formspec_remove` | Delete item and descendants |
| `formspec_copy` | Duplicate (shallow or deep) |
| `formspec_metadata` | Update form title, description, version |
| `formspec_submit_button` | Add submit button |

### Flow (4)

`formspec_flow` (single/wizard/tabs), `formspec_branch` (conditional routing), `formspec_move` (reorder items), `formspec_rename` (change key, updates refs).

### Behavior (5)

`formspec_show_when`, `formspec_readonly_when`, `formspec_require`, `formspec_calculate`, `formspec_add_rule` — all accept FEL expressions for reactive logic.

### Presentation (3)

`formspec_layout` (columns-2/3/4, card, sidebar, inline), `formspec_style` (per-item), `formspec_style_all` (bulk by type/dataType filter).

### Data (9)

`formspec_define_choices` (reusable option sets), `formspec_variable` / `update_variable` / `remove_variable` / `rename_variable` (computed variables with FEL), `formspec_instance` / `update_instance` / `rename_instance` / `remove_instance` (external data sources).

### Screener (7)

`formspec_screener` (enable/disable), `formspec_screen_field` / `remove_screen_field`, `formspec_screen_route` / `update_screen_route` / `reorder_screen_route` / `remove_screen_route` — pre-form qualification and routing.

### Query (7)

| Tool | Purpose |
|------|---------|
| `formspec_preview` | Render form state with optional scenario data |
| `formspec_audit` | Run diagnostics (structural, expressions, consistency) |
| `formspec_describe` | Introspect structure or a specific item |
| `formspec_trace` | Trace FEL dependencies for a field or expression |
| `formspec_validate_response` | Validate submission against form rules |
| `formspec_search` | Find items by type, dataType, label, or extension |
| `formspec_changelog` | Generate changelog from operation history |

### FEL (3)

`formspec_fel_context` (available refs at a path), `formspec_fel_functions` (list ~40 stdlib functions), `formspec_fel_check` (parse/validate expression, return errors + deps).

## Resources

Three MCP resources expose the Formspec JSON Schemas:

| URI | Schema |
|-----|--------|
| `formspec://schema/definition` | Definition schema |
| `formspec://schema/component` | Component schema |
| `formspec://schema/theme` | Theme schema |

## Error Handling

All tools return structured errors:

```json
{
  "code": "ITEM_NOT_FOUND",
  "message": "No item at path 'foo.bar'",
  "detail": { "path": "foo.bar" }
}
```

Error codes by category:

- **Bootstrap**: `DRAFT_SCHEMA_ERROR`, `DRAFT_INVALID`, `DRAFT_INCOMPLETE`
- **Lifecycle**: `PROJECT_NOT_FOUND`, `WRONG_PHASE`, `TOO_MANY_PROJECTS`, `LOAD_FAILED`, `SAVE_FAILED`, `PUBLISH_BLOCKED`
- **Authoring**: `ITEM_NOT_FOUND`, `FIELD_NOT_FOUND`, `GROUP_NOT_FOUND`, `VARIABLE_NOT_FOUND`, `INSTANCE_NOT_FOUND`, `DUPLICATE_KEY`, `INVALID_PATH`, `PARENT_NOT_GROUP`, `ROUTE_OUT_OF_BOUNDS`, `ROUTE_MIN_COUNT`, `INVALID_WIDGET`
- **General**: `COMMAND_FAILED`

## Testing

```bash
npm test              # vitest run
npm run test:watch    # vitest (watch mode)
```

7 test files covering bootstrap, lifecycle, structure, behavior, query, and registry. Tests use helper factories (`registryWithProject()`, `registryInBootstrap()`) and minimal document fixtures.

## File Structure

```
src/
  index.ts              Shebang entry point
  server.ts             Tool registrations + stdio transport (1,018 lines)
  registry.ts           ProjectRegistry — session management
  schemas.ts            Schema loading singleton
  errors.ts             Error formatting + wrapHelperCall
  annotations.ts        Tool hint constants (READ_ONLY, DESTRUCTIVE, etc.)
  tools/
    bootstrap.ts        Draft submission + validation (5 tools)
    lifecycle.ts        Create, open, save, publish (8 tools)
    structure.ts        Fields, groups, pages, placement (14 tools)
    flow.ts             Navigation mode, branching (4 tools)
    behavior.ts         Visibility, required, calculate, rules (5 tools)
    presentation.ts     Layout, styling (3 tools)
    data.ts             Choices, variables, instances (9 tools)
    screener.ts         Pre-form qualification (7 tools)
    query.ts            Preview, audit, describe, trace (7 tools)
    fel.ts              Expression language support (3 tools)
tests/
  helpers.ts            Test utilities + fixtures
  bootstrap.test.ts
  lifecycle.test.ts
  structure.test.ts
  behavior.test.ts
  query.test.ts
  registry.test.ts
```

## Graceful Shutdown

SIGTERM/SIGINT triggers best-effort autosave of all authoring projects to `~/.formspec/autosave/`, then exits cleanly.
