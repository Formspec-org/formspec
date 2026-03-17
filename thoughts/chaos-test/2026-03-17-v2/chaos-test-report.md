# MCP Chaos Test Report — 2026-03-17 (v2)

## Overview

5 personas with varying experience levels blind-tested the formspec-mcp server by building real forms from scratch using only MCP tools. All 5 completed their forms. ~229 tool calls, 150 fields created across 5 forms.

| Persona | Experience | Model | Form | Fields | Calls | Bugs | Result |
|---------|-----------|-------|------|--------|-------|------|--------|
| Priya | Beginner | haiku | Volunteer signup | 8 | ~24 | 1 | Completed |
| Marcus | Intermediate | sonnet | Exit interview (6-page wizard) | 22 | ~35 | 0 | Completed |
| Jade | Intermediate | sonnet | Grant application (7-page wizard) | 58 | ~75 | 2 | Completed |
| Tomas | Advanced | sonnet | Expense report (repeating items) | 29 | ~55 | 3 | Completed |
| Rin | Expert | opus | Research intake (screener + scoring) | 33 | ~40 | 2 | Completed |

---

## Issues Summary

### Priority Matrix

| Priority | Issues | Action |
|----------|--------|--------|
| **Ship now** | B1, B6/U5, U3 | Approved, scout-validated |
| **Ship soon** | B3, B4, U6 | Root cause confirmed, straightforward |
| **Needs design decision** | U2 | Spec is clear (isolation), but need to decide diagnostic approach |
| **Already fixed** | B2 | Commit 739f54f, needs dist rebuild |
| **Not a bug** | B5 | Spec-correct behavior, users need `moneyAmount()` |
| **UX improvements** | U1, U7-U9 | Tool description and documentation updates |
| **Feature gaps** | G1-G7 | Future roadmap items |

---

## BUGS

### B1. Dot-path + parentPath collision creates orphaned items [SHIP NOW]

**Severity:** High — silent data corruption, unreachable items
**Hit by:** Rin, Jade (2 personas)
**Root layer:** studio-core (`_resolvePath` in `project.ts:248`)

**Problem:** `_resolvePath("parent.child", "parent")` splits path on dots, pops last segment as key, then prepends remaining segments to parentPath: `effectiveParent = "parent.parent"`. Creates items at garbage paths that can't be addressed by any tool. Only recoverable via `formspec_undo`.

**Root cause:** The "relative addressing" feature (dot-path segments interpreted relative to parentPath) has no spec backing. The spec defines `key` as a simple identifier `[a-zA-Z][a-zA-Z0-9_]*`. Dot-notation is only for runtime references in binds/shapes, not item creation.

**Fix:** Reject the combination. If parentPath is provided AND path contains dots, throw `PATH_CONFLICT`:

```typescript
// packages/formspec-studio-core/src/project.ts, _resolvePath()
if (parentPath && segments.length > 0) {
  throw new HelperError(
    'PATH_CONFLICT',
    `Cannot combine dot-path "${path}" with parentPath "${parentPath}". ` +
    `Use either dot notation (e.g. "${parentPath}.${path}") or parentPath ` +
    `with a simple key (e.g. path="${key}", parentPath="${parentPath}")`,
    { path, parentPath }
  );
}
```

**Test cascade:** 4 tests in `path-resolution.test.ts` that exercise relative addressing must become negative tests (expect `PATH_CONFLICT`). All other tests unaffected.

**Scout validation:** Confirmed. No real consumers use relative addressing. Feature was invented in the helper layer with no spec mandate.

---

### B2. Multichoice required validation fails with valid values [ALREADY FIXED]

**Severity:** High — blocks most basic multichoice use case
**Hit by:** Priya (1 persona)
**Root layer:** studio-core (`flattenToSignalPaths` in `evaluation-helpers.ts`)

**Problem:** `flattenToSignalPaths` treated ALL arrays as repeat group data, expanding `["setup", "food"]` into indexed paths `tasks[0]`, `tasks[1]`. The engine had no signals for those indexed paths, so the `tasks` signal stayed empty and required validation fired.

**Status:** Fixed in commit `739f54f`. The fix uses `engine.repeats` to distinguish repeat group arrays from multichoice value arrays. **Needs dist rebuild to reach MCP server.**

---

### B3. Cannot update existing shape rules [SHIP SOON]

**Severity:** Medium — incorrect rules become permanent noise
**Hit by:** Tomas (1 persona)
**Root layer:** MCP (`behavior.ts` + `server.ts`)

**Problem:** `update_rule` exists in studio-core (`updateValidation` method at `project.ts:845`) but isn't wired through MCP. Users tried `formspec_edit(remove, "shape_1")` — shapes aren't items, so `PATH_NOT_FOUND`. The `remove_rule` action IS wired but users couldn't discover it.

**Fix:** Add `update_rule` to MCP behavior action enum and switch:
- `packages/formspec-mcp/src/server.ts:81` — add `'update_rule'` to Zod enum
- `packages/formspec-mcp/src/tools/behavior.ts` — add `update_rule` case calling `project.updateValidation(target, { rule, message, ...options })`
- Update `formspec_edit` description to clarify shapes use `formspec_behavior`

**Scout finding:** `remove_rule` has a semantic mismatch — `target` param implies field path but `removeValidation` expects shape ID. MCP description says "shape ID" but param naming misleads LLMs.

**Workaround:** Remove rule via `remove_rule` + re-add via `add_rule`.

---

### B4. Variable trace `@var` shows no dependencies [SHIP SOON]

**Severity:** Medium — developer introspection tool broken
**Hit by:** Rin, Tomas (2 personas)
**Root layer:** MCP (`query.ts:108-121`) + studio-core (missing delegation)

**Problem:** `handleTrace` only has two branches: field path (`$`-prefix regex) or raw expression. `@grand_total` doesn't match the field regex, falls to expression branch. `expressionDependencies("@grand_total")` returns `[]` because the FEL parser only extracts `$`-prefixed refs, not `@`-prefixed variable refs.

**Fix (two parts):**

1. **Studio-core:** Add missing delegation in `project.ts`:
   ```typescript
   variableDependents(name: string): string[] { return this.core.variableDependents(name); }
   ```

2. **MCP:** Add third branch in `handleTrace` for `@`-prefix:
   ```typescript
   const variableMatch = raw.match(/^@([\w][\w\d]*)$/);
   if (variableMatch) {
     const varName = variableMatch[1];
     const varDef = project.state.definition.variables?.find(v => v.name === varName);
     if (!varDef) throw new HelperError('VARIABLE_NOT_FOUND', ...);
     return {
       type: 'variable',
       input: varName,
       expression: varDef.expression,
       dependencies: project.expressionDependencies(varDef.expression),
       usedBy: project.variableDependents(varName),
     };
   }
   ```

**Scout finding:** `analyzeFEL` already returns a separate `variables[]` array alongside `references[]`. The infrastructure exists, just isn't consumed.

---

### B5. Preview doesn't compute money comparisons [NOT A BUG]

**Severity:** N/A — spec-correct behavior
**Hit by:** Tomas (1 persona)
**Root layer:** Engine (`interpreter.ts:537`)

**Problem:** `$price > 5000` returns null when `$price` is a money object. User expected it to compare the amount.

**Spec verdict:** Core spec section 3.3 says comparison operators require "both operands MUST be of the same type" and lists only `number`, `string`, `date` as orderable types. Money is NOT listed. Both TS and Python implementations are consistent — both return null.

**Correct pattern:** `moneyAmount($price) > 5000`

**Possible future improvement:** FEL `check` tool could warn when comparing money to a number, similar to Python evaluator which emits a diagnostic. This would be a UX improvement, not a bug fix.

---

### B6. insertIndex silently ignored on content/group items [SHIP NOW]

**Severity:** Medium — silent data loss from Zod stripping
**Hit by:** Jade (1 persona)
**Root layer:** MCP (`server.ts` Zod schemas)

**Problem:** `insertIndex` exists in studio-core's `ContentProps` and `GroupProps` types, is handled by `addContent` and `addGroup`, and is tested — but the MCP Zod schemas for content and group props don't declare it. Zod's default strip mode silently removes the property. `fieldPropsSchema` has `insertIndex`; content and group schemas don't.

**Fix:** Add `insertIndex` to both schemas in `packages/formspec-mcp/src/server.ts`:

```typescript
// contentItemSchema.props (line 59-62):
insertIndex: z.number().optional().describe('Position within parent children. Omit to append.'),

// groupItemSchema.props (lines 68-77):
insertIndex: z.number().describe('Position within parent children. Omit to append.'),
```

**Scout validation:** Zero risk. All downstream layers handle `insertIndex` correctly and are tested. Pure Zod omission.

---

## UX ISSUES

### U1. Pages and groups are the same thing — not communicated [UX IMPROVEMENT]

**Severity:** High confusion factor — 3 of 5 personas hit this
**Hit by:** Marcus, Jade, Tomas
**Root layer:** MCP (tool descriptions)

**Problem:** `formspec_page(add)` creates both a theme page AND a definition group. Fields with `props: {page: "X"}` get nested inside this group, changing their data path to `X.fieldname`. This dual-role is never explained.

**Fix:** Update tool descriptions:
- `formspec_page` description: "Each page automatically creates a definition group. Fields on this page get data paths like `pageid.fieldname`."
- `formspec_field` `page` prop: "The field will be nested inside the page's definition group, affecting its data path."
- `addPage` return summary: Include group key in message.

**Independent reviewer note:** "If 3/5 personas were confused, the problem might be the abstraction, not just the docs." Consider whether the page=group coupling is the right design long-term.

---

### U2. Screener fields silently unreferenceable from body FEL [NEEDS DESIGN DECISION]

**Severity:** High — fundamental gotcha
**Hit by:** Rin (1 persona)
**Root layer:** Core (`expression-index.ts`)

**Problem:** Screener fields live in a separate namespace. `$prior_diagnosis` silently resolves to null in body FEL. No warning from `formspec_fel(check)`.

**Spec position:** Explicit at `spec.md:2506`: "screener binds are evaluated in the screener's own scope — they do NOT interact with the main form's binds." Isolation is by design.

**Proposed fix:** Better diagnostic, not resolver change. In `parseFEL`, when a `$ref` is unknown, check if it matches a screener item key and emit `FEL_SCREENER_SCOPE` instead of generic `FEL_UNKNOWN_REFERENCE`.

**Independent reviewer pushback:** "Pick one — either screener fields are visible or they're not. Adding them to `FELReferenceSet` while also rejecting them contradicts itself." The fix should be diagnostic-only (better error message), NOT making screener fields appear resolvable.

**Decision needed:** Is a better error message sufficient, or should there be a mechanism to pass screener data into the form body?

---

### U3. Group `page` prop doesn't work [SHIP NOW]

**Severity:** Medium — inconsistent with field and content behavior
**Hit by:** Tomas (1 persona)
**Root layer:** MCP (Zod schema) + studio-core (`addGroup`)

**Problem (two bugs):**
1. **MCP:** `groupItemSchema.props` doesn't include `page` — Zod strips it
2. **Studio-core:** `addGroup` resolves `page` to `parentPath` but doesn't dispatch `pages.assignItem` like `addField` and `addContent` do

**Fix (two parts):**

1. **MCP:** Add `page: z.string()` to `groupItemSchema.props`

2. **Studio-core:** Add `pages.assignItem` to `addGroup`:
   ```typescript
   if (props?.page) {
     phase2.push({ type: 'pages.assignItem', payload: { pageId: props.page, key } });
   }
   ```

**Scout validation:** Both fixes confirmed necessary. The `GroupProps` type already includes `page`. `addGroup` already validates page existence and resolves parentPath. Only the Zod passthrough and page assignment are missing.

---

### U4. parentPath + dot-path interaction undocumented [COVERED BY B1]

**Hit by:** Rin, Jade (2 personas)
**Status:** Resolved by B1 fix (PATH_CONFLICT error makes the invalid combination impossible).

---

### U5. Content items placed after fields in groups [COVERED BY B6]

**Hit by:** Rin (1 persona)
**Status:** Resolved by B6 fix (insertIndex works once Zod stops stripping it).

---

### U6. No way to inspect shapes/variables after creation [SHIP SOON]

**Severity:** Low — developer ergonomics
**Hit by:** Tomas (1 persona)
**Root layer:** MCP (`query.ts:41-44`)

**Problem:** `handleDescribe` returns `{ item, bind }` for field targets. Shapes targeting the field and variables are not included. Overview mode shows counts but not actual data.

**Fix (pure MCP layer):**

For target mode:
```typescript
const shapes = (project.state.definition.shapes ?? [])
  .filter(s => s.target === target);
return { item, bind, shapes: shapes.length > 0 ? shapes : undefined };
```

For overview mode:
```typescript
const variables = project.variableNames();
const shapes = project.state.definition.shapes ?? [];
// Include in response alongside existing statistics
```

**Scout validation:** Data is already accessible. Just not included in the response.

---

### U7. FEL functions listing lacks parameter signatures [UX IMPROVEMENT]

**Severity:** Low
**Hit by:** Marcus (1 persona)

**Problem:** `formspec_fel(functions)` returns function names and categories but not parameter names, types, or argument order. Users can't tell if `dateDiff` is `(start, end)` or `(end, start)`.

---

### U8. Rating field scale not configurable [UX IMPROVEMENT]

**Severity:** Low
**Hit by:** Marcus, Rin (2 personas)

**Problem:** `type: "rating"` creates a rating widget with no way to configure range (1-5 vs 1-10).

---

### U9. Content `body` shows as `label` in describe output [UX IMPROVEMENT]

**Severity:** Low
**Hit by:** Jade (1 persona)

**Problem:** Display items show `"label": "text"` in describe output even though created with `body` parameter. Technically correct (body maps to label internally) but confusing.

---

## FEATURE GAPS

| ID | Description | Hit by | Notes |
|----|-------------|--------|-------|
| **G1** | No `sumWhere` / conditional aggregate function | Tomas | Workaround: `sum(if(cond, val, 0))` — verbose for many categories |
| **G2** | No conditional page skip in wizard progress | Marcus, Jade | Hidden pages still show as steps in progress bar |
| **G3** | No "other, please specify" pattern | Rin | Requires manual field + show_when. Common survey pattern |
| **G4** | No soft calculate / editable default from expression | Jade | `calculate` locks value. No way to pre-populate but allow override |
| **G5** | No dynamic text interpolation in content items | Rin | Content body is static. Can't embed `{@variable}` references |
| **G6** | No field reordering within group after creation | Rin | `formspec_edit(move)` moves between parents, not within |
| **G7** | Money field comparison no FEL warning | Tomas | `$amount > 0` silently returns null. Python emits diagnostic, TS doesn't |

---

## SYSTEMIC ISSUES

### 1. MCP Zod Schema Drift

**Pattern:** Three separate Zod schemas (`fieldPropsSchema`, `contentItemSchema.props`, `groupItemSchema.props`) hand-duplicate properties from studio-core TypeScript interfaces. When properties are added to studio-core, only some schemas get updated.

**Evidence:** B6 (`insertIndex`), U3 (`page`), and U5 are all the same bug class.

**Recommendation:** Write a conformance test that extracts property keys from studio-core prop types and asserts MCP Zod schemas accept them. Or extract shared props into a base Zod object and compose.

### 2. Shapes/Variables as Second-Class MCP Citizens

**Pattern:** Shapes and variables can be created via `formspec_behavior`/`formspec_data` but lack inspection (U6), modification (B3), and tracing (B4) support. The MCP layer was designed primarily around the item tree.

**Evidence:** B3, B4, U6 all stem from incomplete MCP wiring of existing studio-core capabilities.

### 3. Studio-Core Delegation Gaps

**Pattern:** The `Project` class in studio-core uses composition (delegates to `this.core`). B4 revealed `variableDependents` is not delegated despite being in `IProjectCore`.

**Recommendation:** Audit all `IProjectCore` methods and verify `Project` delegates each one.

---

## PRAISE (What's Working Well)

These features received consistent praise across multiple personas:

| Feature | Personas | Representative Quote |
|---------|----------|---------------------|
| **Batch `items[]` array** | All 5 | "Being able to add 14 fields in a single call saved enormous time" |
| **FEL check tool** | 4/5 | "This is the best design decision in the tool" |
| **Preview with scenarios** | 3/5 | "Testing $5000 vs $15000 and instantly seeing which fields appear" |
| **Audit tool** | 3/5 | "Zero errors on a complex form felt genuinely reassuring" |
| **show_when + required suppression** | 3/5 | "The conditional logic just works" |
| **Type aliases** (email, phone, rating) | 2/5 | "These aliases demonstrate good API taste" |
| **Nested dot-path groups** | 2/5 | "The dot notation did exactly what I expected" |
| **Screener feature** | 1/5 | "I didn't expect pre-form qualification screening to be first-class" |
| **Undo/redo** | 1/5 | "Having a reliable undo on a stateful form builder is essential" |
| **Changelog with semver** | 1/5 | "For research instruments where version tracking matters, genuinely useful" |

---

## Implementation Plan

### Phase 4a: Ship Now (3 fixes)

| Fix | Layer | File(s) | Lines | Risk |
|-----|-------|---------|-------|------|
| **B1** | studio-core | `project.ts` (_resolvePath) | ~10 | Medium |
| **B6/U5** | MCP | `server.ts` (Zod schemas) | ~3 | Zero |
| **U3** | MCP + studio-core | `server.ts` + `project.ts` (addGroup) | ~15 | Low |

### Phase 4b: Ship Soon (3 fixes)

| Fix | Layer | File(s) | Lines | Risk |
|-----|-------|---------|-------|------|
| **B3** | MCP | `behavior.ts` + `server.ts` | ~15 | Low |
| **B4** | MCP + studio-core | `query.ts` + `project.ts` | ~25 | Low-Med |
| **U6** | MCP | `query.ts` | ~20 | Low |

### Phase 4c: Needs Decision

| Fix | Decision | Options |
|-----|----------|---------|
| **U2** | Screener namespace semantics | A) Better diagnostic only, B) Namespace bridge mechanism |
| **B5** | Money comparison spec gap | A) Update spec to add money as orderable, B) Improve FEL check diagnostic, C) Leave as-is |

### Phase 4d: UX Polish

| Fix | Effort |
|-----|--------|
| **U1** (page/group descriptions) | Text-only |
| **U7** (FEL function signatures) | Small |
| **U8** (rating scale config) | Needs design |
| **U9** (body/label in describe) | Trivial |

### Prerequisite: Rebuild dist

B2 (multichoice required) is already fixed in source but the MCP server imports from `dist/`. Run `npm run build` to make the fix live.

### Systemic: Zod conformance test

Write a test that validates MCP Zod schemas cover all properties from studio-core TypeScript interfaces. Prevents B6/U3/U5 class from recurring.
