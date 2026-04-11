# Formspec MCP Server — User Testing & Architectural Analysis

**Date:** 2026-03-16
**Method:** 5 parallel AI agents acting as first-time users, each building a form of increasing complexity. 5 code-explorer agents tracing P0/P1 issues through the full stack. 1 code-scout tracing P2 issues.

---

## Test Matrix

| # | Form | Complexity | Tool Calls | Errors Hit | Audit | Key Features Tested |
|---|------|-----------|-----------|-----------|-------|---------------------|
| 1 | Contact Us | Simple | 7 | 0 | Clean | Basic fields, required, submit button, content elements |
| 2 | Event RSVP | Low-Med | ~10 | 1 (FEL boolean) | Clean | Choice field, conditional show_when, nested conditions, branching |
| 3 | Employee Onboarding | Medium | ~10 | 2 (parentPath, validate) | 1 warning | Multi-page wizard, field placement, groups, progress indicator |
| 4 | Expense Report | Med-High | ~15 | 0 calls failed, 3 runtime | Clean | Repeating groups, FEL calculations, reusable choices, validation rules |
| 5 | Medical Intake | High | ~30 | 8 issues logged | 1 warning | Screener, branching, repeating groups, multi-page, cross-field validation, styling, variables, data instances, publish |

---

## What Works Great (Consistent Across All 5 Testers)

- **Batch operations** — every tester called this out as the #1 productivity feature. Adding 4-6 fields in one `items[]` call.
- **Preview with scenario injection** — universally praised. Testing form logic without a renderer.
- **FEL utilities** (check, context, functions) — excellent for discoverability and confidence before binding expressions.
- **Behavior system** (show_when, require, calculate, add_rule) — composable and intuitive.
- **Audit tool** — catches real issues, gives confidence.
- **Zero crashes** — no MCP call crashed across any of the 5 sessions (~100+ total tool calls).
- **Partial success in batch operations** — when 4/5 items succeed and 1 fails, the successful ones are kept.
- **FEL expression language** — readable (`$will_attend = 'yes' or $will_attend = 'maybe'`), 60+ stdlib functions.

---

## Complete Issue Registry

### P0: Bugs

#### P0-1: Repeating group preview ignores multi-instance scenario data

**Found by:** Tester 4 (Expense Report)

**Context:** When `previewForm` receives scenario data like `{"expenses[1].amount": 185}`, the value is silently dropped. Only `expenses[0]` is ever rendered. Calculated totals (e.g. `sum($expenses[*].amount)`) produce wrong results (750 instead of 1035.50).

**Stack trace:**
```
previewForm(project, scenario)                    [evaluation-helpers.ts:9]
  for (const [path, value] of Object.entries(scenario))
    engine.setValue("expenses[1].amount", 185)    [evaluation-helpers.ts:27]
      this.signals["expenses[1].amount"]          [index.ts:1991]
      → UNDEFINED (only [0].* initialized)
      → SILENT NO-OP
```

**Root cause:** `evaluation-helpers.ts:26` does `engine.setValue(path, value)` in a naive loop. The engine only initializes signals for `expenses[0].*` (repeat count = `max(minRepeat, 1)`). `setValue` at `index.ts:1991` checks `if (this.signals[name])` — undefined for `[1].*` — and silently no-ops. The engine already has `applyGroupChildrenSnapshot()` (line 1625) which correctly calls `addRepeatInstance()` to expand, but `previewForm` never uses it.

**Fix layer:** studio-core `evaluation-helpers.ts`

**Proposed fix:** Pre-process scenario data before calling `setValue`:
1. Parse indexed keys like `expenses[N].field` → compute max N per group
2. Call `engine.addRepeatInstance()` enough times to expand
3. Then call `setValue` for each key
- Alternatively, make `applyGroupChildrenSnapshot` public and convert scenario to nested format

**Effort:** Medium. Shares fix site with P0-3.

---

#### P0-2: Shape rules fire on template paths → false positives

**Found by:** Tester 4 (Expense Report)

**Context:** A validation rule targeting `expenses.receipt_available` fires even when `expenses[0].receipt_available = true`. The error says "Receipt is required for expenses over $500" when the receipt IS provided.

**Stack trace:**
```
addValidation("expenses.receipt_available", rule)  [project.ts:685]
  payload.target = "expenses.receipt_available"     ← stored VERBATIM, no [*] normalization
  → definition.addShape(payload)

evaluateShapeForPaths(shape)                        [index.ts:863]
  resolveWildcardPath("expenses.receipt_available") [index.ts:984]
    → no [*] found → returns ["expenses.receipt_available"] as-is

  isPathRelevant("expenses.receipt_available")      [index.ts:2053]
    → "expenses" has relevance signal (group-level) → truthy
    → "expenses.receipt_available" has NO signal (only [0].* exists)
    → no signal = assumed relevant → returns true    ← GHOST PATH

  evaluateShapeConstraints(shape, "expenses.receipt_available") [index.ts:930]
    compileFEL(constraint, "expenses.receipt_available")
    → $receipt_available → signals["expenses.receipt_available"] → undefined → null
    → null = true → false → CONSTRAINT FAILS → false positive
```

**Root cause:** Two gaps. (1) `addValidation` in `project.ts:685` passes the raw target without normalizing template paths to wildcard paths for repeatable groups. (2) `resolveWildcardPath` in `index.ts:986` returns non-`[*]` paths verbatim, even when they point into repeatable groups with no signals.

**Fix layer:** studio-core `project.ts` (primary), engine `index.ts` (defense)

**Proposed fix:**
1. `addValidation`: Detect when target traverses a repeatable group → auto-normalize `expenses.receipt_available` → `expenses[*].receipt_available`
2. `resolveWildcardPath`: If a non-wildcard path has no signal and no relevance signal, detect as ghost path → return `[]`

**Effort:** Medium

---

#### P0-3: `validateResponse` silently ignores nested response objects

**Found by:** Testers 3 (Onboarding), 5 (Medical Intake)

**Context:** Passing `{"patient_demographics": {"first_name": "John"}}` to validate mode results in ALL fields reported as missing. Only flat dot-paths like `{"patient_demographics.first_name": "John"}` work. No error, no hint.

**Stack trace:**
```
formspec_preview(mode="validate", response={"patient_demographics": {"first_name": "John"}})
  → handlePreview(registry, projectId, "validate", {response})  [query.ts:104]
    → validateResponse(project, {nested obj})                    [evaluation-helpers.ts:92]
      → Object.entries({nested obj}):
          path = "patient_demographics", value = {"first_name": "John"}
        → engine.setValue("patient_demographics", {...})          [index.ts:1952]
          → this.signals["patient_demographics"] is UNDEFINED (groups have no signal)
          → SILENT NO-OP
      → engine.getValidationReport({mode: 'submit'})
        → all fields null/empty → ALL REQUIRED FIELDS FIRE
```

**Root cause:** **Dependency inversion violation.** The spec (`specs/core/spec.llm.md` lines 44-52) and `response.schema.json` define response data as nested objects. `getResponse()` outputs nested JSON. But `validateResponse` at `evaluation-helpers.ts:101` iterates top-level keys and calls `engine.setValue(groupKey, nestedObj)`. No signal exists for group keys → silent no-op. The engine's flat dot-path signal keys are an internal detail leaking through the public API.

**Fix layer:** studio-core `evaluation-helpers.ts`

**Proposed fix:** Add a `flattenResponseData()` utility that recursively flattens nested objects (and unrolls arrays for repeating groups) into dot-path key-value pairs before calling `setValue`. Accept both nested and flat formats gracefully. This pairs with P0-1 — the same function needs repeat expansion.

**Effort:** Medium (shared with P0-1)

---

#### P0-4: FEL `check` false positive on scoped references

**Found by:** Tester 5 (Medical Intake)

**Context:** Checking `floor(dateDiff(today(), $date_of_birth, 'years'))` with `context_path: "patient_demographics"` reports `$date_of_birth` as unknown reference. But `patient_demographics.date_of_birth` exists, and the expression works fine when bound via `calculate`.

**Stack trace:**
```
parseFEL(expression, {targetPath: "patient_demographics"})   [expression-index.ts:37]
  analyzeFEL → references = ["date_of_birth"]
  availableReferences(state) → walks all items
    → knownFieldPaths = {"patient_demographics.date_of_birth", ...}
  knownFieldPaths.has("date_of_birth") → FALSE               ← no scope expansion
  → emits FEL_UNKNOWN_REFERENCE

vs. runtime:
  compileFEL(expr, "patient_demographics.age")                [index.ts:1741]
    → parentPath = "patient_demographics"
    → dep "date_of_birth" → prefixed to "patient_demographics.date_of_birth"
  interpreter → candidateLookupPaths("date_of_birth")         [interpreter.ts:239]
    → ["patient_demographics.date_of_birth", "date_of_birth"]
    → finds signal → RESOLVES ✓
```

**Root cause:** `parseFEL` in `expression-index.ts:58-67` does a flat equality check of bare references against absolute paths. The runtime interpreter uses `candidateLookupPaths` which prepends the parent scope. The checker has no equivalent scope expansion. The MCP layer passes `context_path` correctly — the bug is in the core query layer.

**Fix layer:** formspec-core `expression-index.ts`

**Proposed fix:** When validating references in `parseFEL`, apply scope expansion:
```typescript
function expandReference(ref: string, contextPath: string): string[] {
  const candidates = [];
  if (!ref.includes('.') && contextPath) {
    const parent = contextPath.includes('.')
      ? contextPath.split('.').slice(0, -1).join('.')
      : contextPath;
    candidates.push(`${parent}.${ref}`);
  }
  candidates.push(ref);
  return candidates;
}
// Check if ANY candidate matches knownFieldPaths
```

**Effort:** Low-medium

---

### P1: Design Gaps

#### P1-1: `parentPath` missing on content and group MCP tools

**Found by:** Testers 3 (Onboarding), 5 (Medical Intake)

**Context:** `formspec_field` has `parentPath` in props; `formspec_content` and `formspec_group` do not. Users hit "Cannot add at root in a paged definition — provide a parentPath" with no prop available to set it. The dot-notation workaround (`section.my_heading`) works but is undiscoverable. Groups require a 3-step create+move+place workaround.

**Analysis:** Accidental asymmetry. The core handler `definition.addItem` + `resolveParentItems` in `definition-items.ts:58-72` supports `parentPath` for ALL item types uniformly. `FieldProps` got `parentPath` during incremental development; `ContentProps` and `GroupProps` never got it. The dot-notation workaround is reliable (keys can't contain dots per schema pattern `^[a-zA-Z][a-zA-Z0-9_]*$`).

**Key files:**
- `packages/formspec-studio-core/src/helper-types.ts` — `ContentProps` and `GroupProps` missing `parentPath`
- `packages/formspec-studio-core/src/project.ts` — `addContent`/`addGroup` only use dot-split, no `props.parentPath` override
- `packages/formspec-mcp/src/server.ts` — Zod schemas for content/group missing `parentPath`
- `packages/formspec-core/src/handlers/definition-items.ts` — core handler ALREADY supports it (no change needed)

**Fix layer:** studio-core types + methods, MCP schemas

**Proposed fix:**
1. `helper-types.ts`: Add `parentPath?: string` to `ContentProps` and `GroupProps`
2. `project.ts`: Wire `props.parentPath` override in `addContent`/`addGroup` (mirror `addField` pattern)
3. `server.ts`: Add `parentPath` to content/group Zod schemas (inline + batch)
- **Bonus:** Add parent-type validation — reject `parentPath` pointing at a `display` item (schema forbids `children` on display items per `definition.schema.json` lines 741-767)

**Effort:** Low

---

#### P1-2: Page IDs are opaque with no lookup mechanism

**Found by:** Testers 3 (Onboarding), 5 (Medical Intake)

**Context:** Auto-generated IDs like `page-1773700278600-ggfcu9`. No way to list pages, no custom IDs, `formspec_describe` doesn't show them. If the LLM loses the `createdId` from the add response, the page ID is unrecoverable.

**Analysis:** The infrastructure is all there but not wired through:
- Core handler (`pages.ts:38`): `id: id || generatePageId()` — already accepts optional user-provided ID
- Spec (`theme-spec.md` lines 695-700): Pattern `^[a-zA-Z][a-zA-Z0-9_\-]*$` — supports human-readable slugs like `"info"`, `"budget-details"`
- Studio-core (`project.ts:1604`): `addPage(title, description?)` generates random ID internally, no `id?` param
- No `listPages()` method anywhere in core, studio-core, or `IProjectCore`
- MCP: No `list` action on `formspec_page`, no `page_id` on `add`

**Fix layer:** studio-core, core queries, MCP

**Proposed fix:**
1. `project.ts`: Add `id?` parameter to `addPage(title, description?, id?)`
2. `IProjectCore` / `statistics.ts`: Add `listPages()` returning `{id, title, description, regionCount}[]`
3. `server.ts` + `structure.ts`: Add `page_id` on `formspec_page(action="add")`, add `action: "list"`, include pages in `formspec_describe` output

**Effort:** Low

---

#### P1-3: Bootstrap→authoring phase transition unclear

**Found by:** Testers 1 (Contact), 2 (RSVP)

**Context:** After `formspec_create`, users don't know they must call `formspec_load` to start building. The two-phase model requires careful reading of tool descriptions.

**Analysis:** MCP description issue only. The `formspec_create` description does mention the workflow but isn't prominent enough.

**Fix layer:** MCP tool description / response message

**Proposed fix:** Improve `formspec_create` return message to explicitly say "Call `formspec_load` next to start authoring." Consider auto-loading when no drafts are submitted.

**Effort:** Trivial

---

### P2: Papercuts

#### P2-1: Email shows "Invalid" not "Required" when empty

**Found by:** Tester 1 (Contact)

**Context:** Empty required email field shows "Invalid" instead of "Required" in preview.

**Analysis — Two bugs:**
- **Bug A (engine, spec violation):** The spec says (line 1575): "A constraint that cannot be evaluated due to null inputs is not considered violated. The `required` Bind, not the `constraint` Bind, is responsible for ensuring the field has a value." The engine evaluates `matches($, '.*@.*')` on empty string → false → "Invalid" even when the field is empty.
  - Fix: Add emptiness guard in engine before constraint evaluation (`index.ts` ~line 1410)
- **Bug B (previewForm):** When both REQUIRED and CONSTRAINT_FAILED exist for the same path at error severity, the `previewForm` priority logic at `evaluation-helpers.ts:61-69` (`if (!existing || result.severity === 'error' || existing.severity !== 'error')`) always evaluates to true when both are errors → last write wins → CONSTRAINT_FAILED overwrites REQUIRED.
  - Fix: Prefer `constraintKind: "required"` over `"constraint"` when both are same severity

**Fix layer:** Engine (Bug A), studio-core (Bug B)
**Effort:** Medium

---

#### P2-2: FEL `true()` error message unhelpful

**Found by:** Tester 2 (RSVP)

**Context:** Users try `$field = true()` — Chevrotain says "Redundant input, expecting EOF but found: (" with no hint. Correct syntax is `$field` or `$field = true`.

**Analysis:** `true` is a keyword literal (lexer pattern `/true\b/`), not a function. The `()` after `true` is unexpected tokens. Error comes from Chevrotain's generic recovery.

**Proposed fix:** In `analyzeFEL` or `_validateFEL`, detect `true(` or `false(` pattern and prepend hint: "In FEL, `true` and `false` are literals, not functions."

**Fix layer:** Engine FEL analysis or studio-core
**Effort:** Low

---

#### P2-3: Three path syntaxes undocumented

**Found by:** Tester 4 (Expense Report)

**Context:** Authoring=dot (`expenses.amount`), runtime=indexed (`expenses[0].amount`), FEL=$-prefix (`$expenses.amount`). Users discover mapping by trial and error.

**Analysis:** Inherent architectural complexity — three views of the same data (template, instance, expression). Cannot be unified without fundamental changes.

**Proposed fix:** Update MCP tool descriptions to explain path conventions. Add note to `formspec_guide`.

**Fix layer:** MCP tool descriptions
**Effort:** Trivial

---

#### P2-4: `formspec_place` existence confuses users

**Found by:** Tester 3 (Onboarding)

**Context:** Dot-path implicit placement works. But `formspec_place`'s description ("Assign or unassign items to/from pages") implies explicit placement is the primary mechanism.

**Analysis:** `formspec_place` is for: (1) span control via `options: {span: N}`, (2) reassigning items between pages. Legitimate but niche. Description overpromises.

**Proposed fix:** Rewrite description: "Control layout options (column span) or reassign existing items between pages. Most items are auto-placed via dot-path hierarchy."

**Fix layer:** MCP tool description
**Effort:** Trivial

---

#### P2-5: Branch overwrites show_when

**Found by:** Tester 5 (Medical Intake)

**Context:** `formspec_flow(branch)` replaces existing `show_when` with `RELEVANT_OVERWRITTEN` warnings. Users expected merge.

**Analysis:** Working as designed. Merging FEL expressions is semantically ambiguous. The warning is intentional and correct.

**Proposed fix:** Improve `formspec_flow(branch)` description: "Branch replaces any existing show_when conditions. Use show_when afterward to layer additional conditions."

**Fix layer:** MCP tool description
**Effort:** Trivial

---

#### P2-6: Submit button invisible in preview/describe

**Found by:** Tester 1 (Contact)

**Context:** After adding a submit button, it appears nowhere in preview or structure output. No confirmation besides the success message.

**Analysis:** Submit buttons are component-tier nodes (`component.addNode` with `component: 'SubmitButton'`), not definition items. `previewForm` and `formspec_describe` only cover definition-tier signals/items.

**Proposed fix:** Include component-tier elements in `formspec_describe(mode="structure")` output — add a `componentNodes` section listing non-data elements.

**Fix layer:** Studio-core / MCP query handler
**Effort:** Low-medium

---

#### P2-7: `STALE_THEME_REGION_KEY` false positive on submit buttons

**Found by:** Testers 3 (Onboarding), 5 (Medical Intake)

**Context:** Every form with a submit button gets this audit warning. Noisy, appears on every non-trivial form.

**Analysis:** Diagnostics in `diagnostics.ts:233-251` checks region keys against definition item keys. "submit" is a component node, not a definition item → false positive. The component tree walk already happens earlier in the same function — bind keys could be collected there.

**Proposed fix:** In the diagnostics function, also check region keys against component tree node IDs/binds before emitting `STALE_THEME_REGION_KEY`.

**Fix layer:** formspec-core `diagnostics.ts`
**Effort:** Low

---

## Architecture Verdict: Where Does Each Fix Belong?

```
              SPEC → SCHEMA → TYPES → ENGINE → CORE → STUDIO-CORE → MCP

P0-1 Repeat preview   ·    ·       ·       ·      ·    ← FIX HERE    ·
P0-2 Shape false pos   ·    ·       ·    defense    ·    ← FIX HERE    ·
P0-3 Validate format   ·    ·       ·       ·      ·    ← FIX HERE    ·
P0-4 FEL check scope   ·    ·       ·       ·   ← FIX HERE            ·
P1-1 parentPath        ·    ·       ·       ·      ·    ← FIX HERE → FIX HERE
P1-2 Page IDs          ·    ·       ·       ·      ·    ← FIX HERE → FIX HERE
P1-3 Bootstrap UX      ·    ·       ·       ·      ·        ·       ← FIX HERE
P2-1 Invalid/Required  ·    ·       ·    ← FIX A   ·    ← FIX B      ·
P2-2 true() message    ·    ·       ·    ← FIX     ·        ·         ·
P2-3 Path syntax docs  ·    ·       ·       ·      ·        ·       ← FIX HERE
P2-4 Place description ·    ·       ·       ·      ·        ·       ← FIX HERE
P2-5 Branch overwrites ·    ·       ·       ·      ·        ·       ← FIX HERE
P2-6 Submit in preview ·    ·       ·       ·      ·    ← FIX HERE → FIX HERE
P2-7 Stale region key  ·    ·       ·       ·   ← FIX HERE            ·
```

**No spec or schema changes needed for any issue.** The engine is correct for its abstraction level in all but two cases (P2-1 Bug A spec conformance, P2-2 error message quality). Issues cluster at the **studio-core evaluation helper layer** (P0-1, P0-2, P0-3, P2-1B) and **MCP description layer** (P1-3, P2-3, P2-4, P2-5).

---

## Priority & Effort Matrix

| ID | Issue | Layer | Type | Effort | Suggested Order |
|----|-------|-------|------|--------|-----------------|
| **P0-1** | Repeat preview ignores multi-instance | studio-core | Bug | Med | 1 (batch w/ P0-3) |
| **P0-3** | Validate ignores nested responses | studio-core | DI violation | Med | 1 (batch w/ P0-1) |
| **P0-2** | Shape false positives on template paths | studio-core + engine | Bug | Med | 2 |
| **P0-4** | FEL check scoped reference false positive | formspec-core | Bug | Low-Med | 3 |
| **P1-1** | parentPath on content/group | studio-core + MCP | Omission | Low | 4 (batch w/ P2-7) |
| **P2-7** | STALE_THEME_REGION_KEY false positive | formspec-core | False positive | Low | 4 (batch w/ P1-1) |
| **P1-2** | Page ID management | core + studio-core + MCP | Incomplete | Low | 5 |
| **P2-1** | Email Invalid vs Required | engine + studio-core | Spec violation | Med | 6 |
| **P2-6** | Submit not in preview | studio-core + MCP | Incomplete | Low-Med | 7 |
| **P1-3** | Bootstrap→authoring unclear | MCP description | DX | Trivial | 8 |
| **P2-2** | FEL true() error message | engine/studio-core | DX | Low | 9 |
| **P2-3** | Path syntax docs | MCP description | Docs | Trivial | 10 |
| **P2-4** | formspec_place confusion | MCP description | Docs | Trivial | 10 |
| **P2-5** | Branch overwrites show_when | MCP description | By design | Trivial | 10 |

---

## Key Files Referenced

| File | Issues |
|------|--------|
| `packages/formspec-studio-core/src/evaluation-helpers.ts` | P0-1, P0-3, P2-1B |
| `packages/formspec-studio-core/src/project.ts` | P0-2 (addValidation), P1-1, P1-2 |
| `packages/formspec-studio-core/src/helper-types.ts` | P1-1 |
| `packages/formspec-studio-core/tests/evaluation-helpers.test.ts` | P0-1, P0-3 (zero repeat/nested coverage) |
| `packages/formspec-engine/src/index.ts` | P0-1 (setValue), P0-2 (resolveWildcardPath, isPathRelevant), P2-1A |
| `packages/formspec-core/src/queries/expression-index.ts` | P0-4 (parseFEL) |
| `packages/formspec-core/src/queries/diagnostics.ts` | P2-7 |
| `packages/formspec-core/src/handlers/pages.ts` | P1-2 |
| `packages/formspec-core/src/project-core.ts` | P1-2 (IProjectCore) |
| `packages/formspec-mcp/src/server.ts` | P1-1, P1-2, P1-3, P2-3, P2-4, P2-5 |
| `packages/formspec-mcp/src/tools/query.ts` | P0-3, P2-6 |
| `packages/formspec-engine/src/fel/interpreter.ts` | P0-4 (candidateLookupPaths — correct reference) |

---

## Feature Requests from Testers

These were requested by testers but are not bugs or design gaps:

1. **Page-level validation gating** — wizard: "complete this page before proceeding"
2. **Custom screener rejection message** — currently route target is just `"reject"` with no customizable message
3. **FEL examples for repeating group aggregation** — no discoverable examples for `sum($group.field)` syntax
4. **Quick-start example in tool descriptions** — create→load→add fields pipeline
5. **Reorder items within a group** — `formspec_edit move` works between groups but within-parent reorder is unclear
6. **Custom/human-friendly page IDs** — covered by P1-2
7. **Duplicate/copy a field** — `formspec_edit copy` exists but wasn't tested

---

## Test Observations

- Simple forms (Contact, RSVP) can be built in 7-10 tool calls with zero errors
- The **complexity cliff** hits at repeating groups and wizard mode
- All 5 testers independently praised batch operations and preview+audit as standout features
- The `formspec_fel` utilities (check, context, functions) were used heavily and valued
- Medical Intake tester rated the experience **7.5/10**, noting the tool set is "genuinely comprehensive" but wizard/paged mode has a steep learning curve
