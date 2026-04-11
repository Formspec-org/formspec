# Validation Review: Spec/Schema/Code Findings
Date: 2026-03-23
Branch: `new`

---

### H1: Mapping Schema/Spec Divergence — `transform` required vs. optional in `innerRules`

**Status:** Partially confirmed (nuanced)

**Current state:**

Both `FieldRule` (line 221) and `InnerRule` (line 531) in `schemas/mapping.schema.json` have `"required": ["transform"]`. The spec at line 773 of `specs/mapping/mapping-spec.md` reads:

> When `array.innerRules` contains at least one nested rule, the parent rule SHOULD still declare `transform` (typically `"preserve"` when per-element work lives entirely in `innerRules`). The JSON Schema requires `transform` on every Field Rule for valid interchange. Conforming runtimes MAY accept a missing parent `transform` in that situation and treat it as `"preserve"` for execution; authors SHOULD not rely on that shorthand in documents that must validate everywhere.

This is not a divergence — it is an intentional two-layer design: the schema enforces strict interchange validity (transform always required), while the spec grants runtimes a MAY-level tolerance for the specific edge case of a parent rule whose `innerRules` do all the work. The spec text acknowledges the schema requirement explicitly and advises authors against relying on the relaxed behavior. The `InnerRule` schema definition, however, is correctly still `required: ["transform"]` because inner rules always need a transform too — the MAY clause applies only to the parent rule in the `innerRules` context.

The PR finding conflates two separate things: (1) whether `InnerFieldRule` (now called `InnerRule` in the schema) has `required: ["transform"]` — it does, and correctly so; and (2) whether the parent `FieldRule` wrapping the `array` descriptor should be allowed to omit `transform` — the spec says runtimes MAY accept this, but the schema keeps it required for validator conformance.

No actual bug. The design is intentional and the spec prose explains the layering clearly.

**Severity assessment:** Disagree with H1 classification. This is not a divergence requiring a fix — it is a documented two-layer policy. The spec text is the right place for the MAY tolerance; the schema is correct to keep required for interchange validity.

**Fix ranking:** 5 (backlog — not a bug)

**Fix effort:** trivial if pursued (add a spec note clarifying this is intentional, not erroneous)

**Recommended action:** Leave as-is. Optionally add a sentence to the spec clarifying that the schema-required/runtime-MAY split is intentional: strict for interchange, lenient for execution.

---

### H3: `e8fdcab` `loadDataIntoEngine` undefined guard — miscategorized fix

**Status:** Not found (finding is incorrect)

**Current state:**

Commit `e8fdcab` ("fix: preserve repeat required errors in previews") adds exactly this guard to `packages/formspec-studio-core/src/evaluation-helpers.ts`:

```
if (value === undefined) {
  continue;
}
```

The commit message is `fix:` not `test:`, and the diff includes both the guard (in `evaluation-helpers.ts`) and a new test (in `evaluation-helpers.test.ts`). The PR finding claims it was "miscategorized as test hardening" — but the commit is already categorized as `fix:`. The guard prevents `engine.setValue` from being called with `undefined`, which would suppress required-field errors inside repeat groups. This is a genuine behavioral fix: without the guard, an indexed repeat path (used to expand repeat counts) could be written back as `undefined`, silencing validation errors for required fields in trailing repeat instances. The accompanying test confirms a behavior regression existed.

**Severity assessment:** The finding is factually wrong — the commit is already correctly labeled `fix:`. There is no miscategorization to correct. The guard is a real behavioral change, not just defensive coding. The MEMORY.md note about this commit ("fix: preserve repeat required errors in previews") is accurate.

**Fix ranking:** N/A — already fixed and correctly categorized

**Fix effort:** N/A

**Recommended action:** No action. Finding is incorrect.

---

### M9: Project import stale-page logic drops ALL pages if one stale region key

**Status:** Confirmed

**Current state:**

In `packages/formspec-core/src/handlers/project.ts`, lines 46–56:

```typescript
const allRegionsValid = themePages.every((page: any) =>
  (page.regions ?? []).every((region: any) => {
    const k = region.key as string | undefined;
    return !k || flatKeys.has(k);
  }),
);
if (!allRegionsValid) {
  (state.theme as any).pages = [];
}
```

The behavior is exactly as alleged: if any region key across any page does not match a key in the new definition's item tree, the entire `state.theme.pages` array is wiped. A single stale key on page 1 of a 5-page form nukes all 5 pages.

There is also a separate `UNKNOWN_REGION_KEY` diagnostic path in `page-resolution.ts` (line 91) that emits a warning at runtime — but that path is a read-query path, not the import handler. The import handler does not use it; it implements its own all-or-nothing check.

Tests in `project-commands.test.ts` do not cover this stale-page scenario at all — there are no tests for definition-only import with existing pages.

**Severity assessment:** Agree with M9 severity. The all-or-nothing behavior is documented in the comment ("A single accidental key match (e.g. shared field name 'name') must not preserve an entire stale page graph") but the rationale is backwards — it says a shared field name should not *preserve* a stale page graph, implying the whole graph gets dropped when any key is stale. This is a data-loss foot-gun: importing an updated definition with one renamed field destroys all page layout, including the pages with perfectly valid regions. The correct behavior would be to drop only the pages that have stale regions (or emit a diagnostic and let the caller decide).

**Fix ranking:** 2 (fix soon)

**Fix effort:** small — replace the all-or-nothing wipe with per-page filtering and add a covering test

**Recommended action:**

Replace the all-or-nothing wipe with per-page filtering:

```typescript
if (themePages && themePages.length > 0) {
  const flatKeys = collectDefinitionItemKeys((state.definition as any).items as FormItem[]);
  (state.theme as any).pages = themePages.filter((page: any) =>
    (page.regions ?? []).every((region: any) => {
      const k = region.key as string | undefined;
      return !k || flatKeys.has(k);
    }),
  );
}
```

Add tests: (1) definition-only import where one page has stale regions — that page is dropped, others survive; (2) all pages valid — all survive; (3) all pages stale — all dropped (same as current).

---

### L9: Broken `[RFC 4180]` link references in mapping spec

**Status:** Confirmed

**Current state:**

`specs/mapping/mapping-spec.md` contains three inline uses of `[RFC 4180]`:
- Line 256 (CSV adapter description)
- Line 1614 (adapter table)
- Line 1681 (CSV adapter section prose)

There is no link definition (`[RFC 4180]: https://...`) anywhere in the file. `grep -n "^\[RFC"` finds only `[RFC 8174]` on line 37 (a normative language boilerplate reference, inline, not a link definition). `[RFC 8259]` is also used (line 1612) and also has no definition.

In Markdown renderers that require explicit link definitions (including most static site generators and GitHub's renderer), these render as literal text `[RFC 4180]` rather than hyperlinks. Whether this matters depends on the renderer — some treat bare `[label]` as link-definition lookups and fall back to plain text, others treat them as broken links.

**Severity assessment:** Agree with L9 (low). Cosmetic. No behavioral impact.

**Fix ranking:** 4 (nice-to-have)

**Fix effort:** trivial — add two link definitions to the end of the file

**Recommended action:** Add to the end of `specs/mapping/mapping-spec.md`:

```markdown
[RFC 4180]: https://www.rfc-editor.org/rfc/rfc4180
[RFC 8259]: https://www.rfc-editor.org/rfc/rfc8259
```

Note: after adding, run `npm run docs:generate` since `*.llm.md` files are generated from the canonical spec.

---

### L10: Premature `fastapi` and `httpx` dependencies in `pyproject.toml`

**Status:** Confirmed

**Current state:**

`pyproject.toml` lists under `[project.optional-dependencies] test`:

```toml
"fastapi>=0.110",
"httpx>=0.27",
```

A search of all `.py` files in the repository finds zero imports of `fastapi` or `httpx`. These packages have no consumers anywhere in `tests/`, `src/`, or any other Python source. They are dead dependencies installed for every `pip install formspec[test]` invocation.

**Severity assessment:** Agree with L10 (low). No functional impact. `fastapi` and `httpx` are non-trivial packages (fastapi pulls in starlette, pydantic; httpx pulls in httpcore, certifi, h2) — they add unnecessary installation weight and potential version-conflict surface for CI and contributors.

**Fix ranking:** 3

**Fix effort:** trivial — delete two lines

**Recommended action:** Remove both lines from `pyproject.toml`. If a future HTTP-layer test harness is planned, add the deps back at that point with the first actual test that uses them.
