# Plan: Fix MCP Spec — Rev 7 → Rev 8

**File:** `docs/superpowers/specs/2026-03-14-formspec-mcp.md`
**Date:** 2026-03-15
**Status:** Ready for implementation

---

## Context

Three review agents (product architecture, codebase alignment, MCP best practices) identified 17 issues in the Formspec MCP Server design spec. Seven validation agents confirmed each against the actual codebase. A code-architect agent then validated the plan against MCP protocol spec, SDK conventions, and real-world patterns — surfacing 3 required fixes and 5 gaps.

This is the corrected plan incorporating all validation feedback.

---

## Changes

### 1. Schema filenames: add `.schema` suffix (9 occurrences)

Replace all `schemas/definition.json` → `schemas/definition.schema.json`, same for `component` and `theme`. Affects Design Decision #2, bootstrap tool descriptions, and resources mention.

### 2. Tool names: add `formspec_` prefix

All 64 tool names get prefixed: `create` → `formspec_create`, `field` → `formspec_field`, `preview` → `formspec_preview`, etc. This affects:
- Tool catalog tables (all sections)
- Bootstrap flow numbered list
- Architecture file listing (tools/ filenames stay the same — prefix is only the MCP tool name, not the file)
- Verification section test references
- Any inline references to tool names in prose

Additionally, add a `title` field recommendation for each tool to provide human-readable display names in client UIs (e.g., `name: "formspec_field"`, `title: "Add Field"`). With 64+ `formspec_*` tools, bare names are unwieldy in tool pickers.

### 3. Add tool annotations table

Add a new "Tool Annotations" section after the Tool Catalog. Group by annotation profile.

**Critical corrections applied from validation:**
- All annotation field names use `Hint` suffix per MCP spec: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- `formspec_save` / `formspec_open` use `openWorldHint: true` (they do filesystem I/O outside the server's control)
- `formspec_move_page` / `formspec_reorder_screen_route` use `idempotentHint: false` (order-dependent mutations — calling twice changes result)

| Profile | Annotations | Tools |
|---------|------------|-------|
| Read-only query | `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false` | `formspec_preview`, `formspec_audit`, `formspec_describe`, `formspec_trace`, `formspec_validate_response`, `formspec_search`, `formspec_changelog`, `formspec_fel_context`, `formspec_fel_functions`, `formspec_fel_check`, `formspec_list`, `formspec_validate_draft`, `formspec_list_autosaved` |
| Non-destructive mutation | `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false` | `formspec_create`, `formspec_field`, `formspec_content`, `formspec_group`, `formspec_repeat`, `formspec_page`, `formspec_place`, `formspec_update`, `formspec_copy`, `formspec_metadata`, `formspec_submit_button`, `formspec_flow`, `formspec_branch`, `formspec_move`, `formspec_move_page`, `formspec_rename`, `formspec_show_when`, `formspec_readonly_when`, `formspec_require`, `formspec_calculate`, `formspec_add_rule`, `formspec_layout`, `formspec_style`, `formspec_style_all`, `formspec_define_choices`, `formspec_variable`, `formspec_update_variable`, `formspec_rename_variable`, `formspec_instance`, `formspec_update_instance`, `formspec_rename_instance`, `formspec_screener`, `formspec_screen_field`, `formspec_screen_route`, `formspec_update_screen_route`, `formspec_reorder_screen_route`, `formspec_draft_definition`, `formspec_draft_component`, `formspec_draft_theme`, `formspec_load_draft`, `formspec_undo`, `formspec_redo`, `formspec_publish` |
| Destructive mutation | `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false` | `formspec_remove`, `formspec_remove_page`, `formspec_unplace`, `formspec_remove_variable`, `formspec_remove_instance`, `formspec_remove_screen_field`, `formspec_remove_screen_route` |
| Filesystem I/O | `readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true` | `formspec_save`, `formspec_open` |

### 4. Fix `load_draft` description

Remove "Calls `normalizeDefinition()` and `project.loadBundle()`" → "Calls `project.loadBundle()` (which normalizes internally)."

### 5. Replace error codes `NOT_IN_BOOTSTRAP` / `NOT_IN_DRAFT` with `WRONG_PHASE`

Replace both with single `WRONG_PHASE` error code:
- Error table entry: `WRONG_PHASE` — "Tool called in wrong project phase. `detail.currentPhase` is `'bootstrap'` or `'authoring'`; `detail.expectedPhase` indicates which phase the tool requires."
- Remove `NOT_IN_BOOTSTRAP` and `DRAFT_MISSING` from error table (covered by `WRONG_PHASE`)

**Cascade targets** (from validation):
- Session Model code block: `getProject()` JSDoc/comments must reference `WRONG_PHASE` with `currentPhase: 'bootstrap'`
- Session Model code block: `getDraft()` JSDoc/comments must reference `WRONG_PHASE` with `currentPhase: 'authoring'`
- Verification section: update test assertion references from old codes to `WRONG_PHASE`

### 6. Fix auto-save: remove `isDirty` reference

Change "all projects where `project.isDirty === true` are saved" → "all projects in the authoring phase are saved" (20 max, cost is negligible).

### 7. Specify `validate_draft` implementation

Change description to: "Assembles all submitted drafts into a `Partial<ProjectBundle>`, creates a temporary `Project` via `createProject({ seed: bundle })`, calls `project.diagnose()`, and returns the results. Requires at least a definition draft. If any draft has pre-existing schema validation errors, returns those errors immediately without creating a temporary project."

### 8. Remove `format` ghost property

- Remove `format` from `field()` props list
- Remove `format` from `update()` accepted keys list
- Remove `INVALID_FORMAT` error code row from error table
- Remove `validFormats` from `ToolError` detail interface

### 9. Fix `update()` key list

- Change `choices_from` → `choicesFrom`
- Add missing keys: `prePopulate`, `default`, `repeatable`, `minRepeat`, `maxRepeat`
- Verify the final enumerated list matches all 24 keys from `_VALID_UPDATE_KEYS` in the codebase: `label`, `hint`, `description`, `placeholder`, `ariaLabel`, `options`, `choicesFrom`, `currency`, `precision`, `initialValue`, `prePopulate`, `dataType`, `required`, `constraint`, `constraintMessage`, `calculate`, `relevant`, `readonly`, `default`, `repeatable`, `minRepeat`, `maxRepeat`, `widget`, `style`, `page`

### 10. Replace `ajv` with `createSchemaValidator`

- Dependencies: remove `ajv`, note that `formspec-engine` exports `createSchemaValidator` for schema validation
- `DraftState` types: change `object` → `unknown`, change `any[]` → `SchemaValidationError[]` (from formspec-engine)
- Bootstrap tool descriptions: reference `createSchemaValidator` instead of "JSON Schema validation"
- Document that `createSchemaValidator` requires schema objects loaded from disk at startup. If schema files are missing, the server should fail at startup (fatal), not at first tool call.

### 11. Add proper Resources section

Add new section after Tool Catalog:

```
formspec://schema/definition  → schemas/definition.schema.json  (application/schema+json)
formspec://schema/component   → schemas/component.schema.json   (application/schema+json)
formspec://schema/theme       → schemas/theme.schema.json       (application/schema+json)
```

Role: LLM reads these as guidance when generating artifacts. Server validates internally — LLM does not need to fetch schemas to use `draft_*` tools.

Additionally, document the `resources` capability declaration: the server must include `resources: {}` in its `initialize` handshake response alongside `tools: {}`. These resources are static (`listChanged: false`). Show the `resources/read` handler pattern returning `{ contents: [{ uri, mimeType: "application/schema+json", text }] }`.

### 12. Document "no way back to bootstrap"

Add note after bootstrap flow: "To start over, close the project and call `formspec_create()` for a new one. There is no `reset` tool — bootstrap is one-way by design."

### 13. Update error wire format to include `structuredContent`

**Corrected from validation:** `content[0].text` must remain `JSON.stringify(toolError)` (the full structured object) for backward compatibility with clients that don't support `structuredContent`.

Change error format from:
```typescript
{ isError: true, content: [{ type: 'text', text: JSON.stringify(toolError) }] }
```
To:
```typescript
{
  isError: true,
  content: [{ type: 'text', text: JSON.stringify(toolError) }],
  structuredContent: toolError
}
```

Note: the `content` array preserves the full JSON for clients that only read `content`. The `structuredContent` field provides typed access for clients that support it.

### 14. Document `open()` trust model

Add to `open()` description: "Assumes artifacts on disk are schema-valid and semantically correct (no schema validation on load — only parse validity is checked). Call `formspec_audit()` after opening untrusted bundles to check schema and semantic validity."

### 15. Add `formspec_list_autosaved()` tool

Add tool to lifecycle section: "List auto-saved projects from `~/.formspec/autosave/`."

Return shape:
```typescript
{ autosaved: Array<{ project_id: string, path: string, lastModified: string }> }
```

When `~/.formspec/autosave/` doesn't exist or is empty, returns `{ autosaved: [] }` (not an error).

Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false` (reads a well-known local path under the server's control).

This brings the tool count to 65.

### 16. Strengthen `branch()` otherwise warning

Expand the `otherwise` note in `formspec_branch` description: "NOTE: `otherwise` targets are also visible when the source field is empty or unset — the negation of all branch conditions is true when no value exists. To hide `otherwise` targets until the user makes a choice, chain with `formspec_show_when(target, 'string-length(on) > 0')`."

### 17. Fix `DraftState` types

```typescript
import type { SchemaValidationError } from 'formspec-engine';

interface DraftState {
  definition?: unknown;
  component?: unknown;
  theme?: unknown;
  errors: Map<string, SchemaValidationError[]>;
}
```

### 18. Update revision history

Add rev 8 entry dated 2026-03-15 summarizing: MCP annotation hints, `WRONG_PHASE` error unification, schema filename corrections, `update()` key list alignment, `structuredContent` error format, `formspec_` tool prefix, resources section, `list_autosaved` tool, and miscellaneous documentation fixes.

---

## Deferred (Future Work)

These gaps were identified during validation but are out of scope for rev 8:

| ID | Gap | Rationale for deferral |
|----|-----|----------------------|
| M3 | `outputSchema` on query tools (`preview`, `describe`, `audit`) | Useful for client-side response validation but requires defining JSON Schema for every tool's success response. Do after the tool implementations stabilize. |
| M4 | Pagination for `list_autosaved()` | With the 20-project autosave cap, pagination won't be needed. Revisit if the cap is removed. |

---

## Verification

After all changes are applied:

1. Read through the final spec end-to-end and confirm all 18 fixes are present
2. Grep for any remaining `schemas/definition.json` (without `.schema`) — expect 0 matches
3. Grep for any remaining bare tool names without `formspec_` prefix in tool catalog / prose — expect 0 matches
4. Grep for `isDirty` — expect 0 matches
5. Grep for `NOT_IN_BOOTSTRAP` or `DRAFT_MISSING` — expect 0 matches
6. Grep for `INVALID_FORMAT` — expect 0 matches
7. Grep for `readOnly:` without `Hint` suffix in annotations — expect 0 matches
8. Confirm tool count is 65 (5 bootstrap + 8 lifecycle + 14 structure + 4 flow + 5 behavior + 3 presentation + 9 data + 7 screener + 7 understanding + 3 FEL)
9. Confirm `formspec_list_autosaved` appears in both tool catalog and annotations table
