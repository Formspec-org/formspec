# PR Review Remediation — `new` Branch

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 18 validated findings from the `new` branch PR review, ranked by outcome and tech debt reduction.

**Architecture:** 12 independent tasks across Rust crates, TypeScript engine, Tailwind adapter, Python tooling, and specs. No task depends on another unless noted. Each task is a self-contained commit.

**Tech Stack:** Rust (formspec-core, fel-core, formspec-py), TypeScript (formspec-engine, formspec-core tests), Playwright (E2E tests), CSS/Tailwind (formspec-adapters), Markdown (specs)

**Source:** `thoughts/archive/reviews/2026-03-23-validated-findings.md`

---

### Task 1: Fix lexicographic version sort in response migration [L4]

The version comparison in `apply_migrations_to_response_data` uses string ordering. `"9.0.0" > "10.0.0"` lexicographically, so migrations run in wrong order once any form hits version 10+.

**Files:**

- Modify: `crates/formspec-core/src/response_migration.rs:106-126`
- Test: `crates/formspec-core/src/response_migration.rs` (inline `mod tests`)

- [ ] **Step 1: Write failing test for multi-digit version ordering**

Add to the existing `mod tests` block (after line 269):

```rust
#[test]
fn multi_digit_versions_sort_numerically() {
    let def = json!({
        "items": [],
        "migrations": [
            { "fromVersion": "9.0.0", "changes": [{ "type": "rename", "from": "a", "to": "b" }] },
            { "fromVersion": "10.0.0", "changes": [{ "type": "rename", "from": "b", "to": "c" }] }
        ]
    });
    let data = json!({ "a": "value" });
    let out = apply_migrations_to_response_data(&def, data, "9.0.0", "2020-01-01T00:00:00Z");
    // If lex-sorted, 10.0.0 runs before 9.0.0 → "a" renamed to "b" by 9.0.0, then 10.0.0
    // fails to find "b". With numeric sort, 9.0.0 runs first → "a" → "b", then 10.0.0 → "b" → "c".
    assert_eq!(out["c"], json!("value"));
    assert_eq!(out.get("a"), None);
    assert_eq!(out.get("b"), None);
}

#[test]
fn multi_digit_version_filter_excludes_lower_versions() {
    let def = json!({
        "items": [],
        "migrations": [
            { "fromVersion": "2.0.0", "changes": [{ "type": "rename", "from": "a", "to": "b" }] },
            { "fromVersion": "10.0.0", "changes": [{ "type": "rename", "from": "b", "to": "c" }] }
        ]
    });
    let data = json!({ "b": "value" });
    // from_version "10.0.0" — only 10.0.0 should apply. With lexicographic filter,
    // "2.0.0" >= "10.0.0" is TRUE (wrong!), so the 2.0.0 migration runs first and
    // renames "b" → ... wait, no — "a" → "b" finds no "a", then 10.0.0 renames "b" → "c".
    // The filter bug means 2.0.0 is incorrectly included but its rename is a no-op here.
    // To truly exercise the filter bug, use data with a key the low-version migration would move:
    let data2 = json!({ "a": "low", "b": "high" });
    // from_version "10.0.0": only 10.0.0 should apply → "b" → "c", "a" untouched.
    // With lex filter bug: 2.0.0 also applies → "a" → "b" (overwrites "high"), then "b" → "c".
    let out = apply_migrations_to_response_data(&def, data2, "10.0.0", "2020-01-01T00:00:00Z");
    assert_eq!(out["a"], json!("low"), "2.0.0 migration should NOT have run");
    assert_eq!(out["c"], json!("high"));
    assert_eq!(out.get("b"), None);
}
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd /Users/mikewolfd/Work/formspec && cargo test -p formspec-core -- response_migration::tests::multi_digit`
Expected: FAIL — versions sort/filter lexicographically

- [ ] **Step 3: Add semver tuple parser and fix comparisons**

Add a helper function before `apply_migrations_to_response_data` (around line 82):

```rust
/// Parse "major.minor.patch" into a comparable tuple. Falls back to (0,0,0) on bad input.
fn parse_semver_tuple(v: &str) -> (u32, u32, u32) {
    let mut parts = v.splitn(3, '.');
    let major = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let patch = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (major, minor, patch)
}
```

Then fix the filter (line 112):

```rust
migration_from_version(obj)
    .is_some_and(|v| parse_semver_tuple(v) >= parse_semver_tuple(from_version))
```

And fix the sort (lines 116-126):

```rust
applicable.sort_by(|a, b| {
    let va = a
        .as_object()
        .and_then(migration_from_version)
        .map(parse_semver_tuple)
        .unwrap_or((0, 0, 0));
    let vb = b
        .as_object()
        .and_then(migration_from_version)
        .map(parse_semver_tuple)
        .unwrap_or((0, 0, 0));
    va.cmp(&vb)
});
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cargo test -p formspec-core -- response_migration::tests`
Expected: ALL PASS (including existing tests — they use "1.0.0"/"2.0.0" which sort identically either way)

- [ ] **Step 5: Commit**

```bash
git add crates/formspec-core/src/response_migration.rs
git commit -m "fix(formspec-core): use numeric semver comparison for migration ordering

Lexicographic string comparison sorted '10.0.0' before '9.0.0'. Parse
version strings into (major, minor, patch) tuples for correct numeric
ordering and filtering."
```

---

### Task 2: Restore ValidationReport shape assertions in export tests [M11]

Export tests use `not.toBeEmpty()` on deterministic mapping output. The original server-response tests verified the full ValidationReport schema shape; current tests only check existence.

**Files:**

- Modify: `tests/component/tools-dashboard/export.spec.ts`
- Reference: `schemas/validationReport.schema.json` (for expected shape)

- [ ] **Step 1: Read the test fixture to understand expected output**

Read `tests/component/tools-dashboard/` to find the mapping document and definition used by the export tests. Understand what JSON/CSV/XML output the mapping produces for the test input.

- [ ] **Step 2: Strengthen the JSON export assertion**

Replace the `not.toBeEmpty()` assertion (line 25) with content-specific checks:

```typescript
test('clicking JSON export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="json"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('JSON');
    const content = await page.locator('#export-result-content').textContent();
    expect(content).toBeTruthy();
    const parsed = JSON.parse(content!);
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe('object');
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Strengthen CSV and XML export assertions**

Replace CSV `not.toBeEmpty()` (line 32):

```typescript
test('clicking CSV export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="csv"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('CSV');
    const content = await page.locator('#export-result-content').textContent();
    expect(content).toBeTruthy();
    // CSV must have at least a header row and one data row
    const lines = content!.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
});
```

Replace XML `not.toBeEmpty()` (line 39):

```typescript
test('clicking XML export runs mapping and shows output', async ({ page }) => {
    await page.locator('button[data-format="xml"]').click();
    await expect(page.locator('#export-result')).toBeVisible();
    await expect(page.locator('#export-result-format')).toContainText('XML');
    const content = await page.locator('#export-result-content').textContent();
    expect(content).toBeTruthy();
    expect(content).toContain('<?xml');
});
```

- [ ] **Step 4: Run export tests**

Run: `npx playwright test tests/component/tools-dashboard/export.spec.ts --timeout 10000`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/component/tools-dashboard/export.spec.ts
git commit -m "test(tools-dashboard): strengthen export assertions from not.toBeEmpty to content checks

JSON: parse and verify non-empty object. CSV: verify header + data rows.
XML: verify XML declaration present."
```

---

### Task 3: Fix Tailwind CSS variable consistency [M7 + L8]

27 hardcoded color tokens across 8 widget files bypass the `--formspec-tw-*` CSS variable system, defeating themability. Also folds in L8 (dead `applyErrorStyling` parameter logic).

**Files:**

- Modify: `packages/formspec-adapters/src/tailwind/slider.ts`
- Modify: `packages/formspec-adapters/src/tailwind/rating.ts`
- Modify: `packages/formspec-adapters/src/tailwind/money-input.ts`
- Modify: `packages/formspec-adapters/src/tailwind/file-upload.ts`
- Modify: `packages/formspec-adapters/src/tailwind/wizard.ts`
- Modify: `packages/formspec-adapters/src/tailwind/tabs.ts`
- Modify: `packages/formspec-adapters/src/tailwind/signature.ts`
- Modify: `packages/formspec-adapters/src/tailwind/text-input.ts` (prefix/suffix addons only)
- Modify: `packages/formspec-adapters/src/tailwind/shared.ts` (fix `applyErrorStyling`)
- Modify: `packages/formspec-adapters/src/tailwind/radio-group.ts` (use shared `applyErrorStyling`)
- Modify: `packages/formspec-adapters/src/tailwind/tailwind-formspec-core.css` (validation summary hex codes)
- Test: `packages/formspec-adapters/tests/tailwind/structural.test.ts`

- [ ] **Step 1: Fix `applyErrorStyling` in shared.ts**

Remove the dead `errorColor` parameter and identity ternary:

```typescript
export function applyErrorStyling(el: HTMLElement, hasError: boolean): void {
    el.classList.toggle('ring-2', hasError);
    el.classList.toggle('ring-[var(--formspec-tw-danger-ring)]', hasError);
    el.classList.toggle('rounded-xl', hasError);
}
```

Update all callers (checkbox.ts, toggle.ts, checkbox-group.ts) — drop the third argument if any pass it.

- [ ] **Step 2: Fix radio-group.ts to use shared function**

Replace the inline duplicate in `radio-group.ts` `onValidationChange`:

```typescript
onValidationChange: (hasError) => {
    applyErrorStyling(fieldset, hasError);
},
```

- [ ] **Step 3: Replace hardcoded tokens in each widget file**

For each of the 8 widget files, replace raw Tailwind color tokens with CSS variable equivalents. Use `style` properties for dynamic state where Tailwind JIT can't resolve variables:

| Raw Token | Replacement |
|-----------|-------------|
| `bg-zinc-700`, `bg-zinc-800`, `bg-zinc-900/80` | `bg-[var(--formspec-tw-surface-muted)]` |
| `border-zinc-700`, `border-gray-300`, `border-gray-200` | `border-[var(--formspec-tw-border)]` |
| `text-zinc-400`, `text-zinc-600`, `text-gray-400`, `text-gray-500` | `text-[var(--formspec-tw-muted)]` |
| `text-zinc-100`, `text-gray-700` | `text-[var(--formspec-tw-text)]` |
| `accent-teal-500`, `bg-blue-600`, `text-blue-600`, `border-blue-500` | `accent-[var(--formspec-tw-accent)]` or equivalent |
| `accent-rose-500`, `border-red-500`, `ring-red-500` | Use `applyErrorStyling` or `var(--formspec-tw-danger)` |
| `bg-green-500` (wizard completed step) | `bg-[var(--formspec-tw-success)]` (add variable if missing) |
| `bg-teal-900/40`, `ring-teal-500/20`, `focus:ring-teal-500/15` | `bg-[var(--formspec-tw-accent)]/40` or CSS variable with opacity |

For Wizard/Tabs MutationObserver callbacks that set `style.backgroundColor` directly, use:

```typescript
el.style.backgroundColor = 'var(--formspec-tw-accent)';
```

- [ ] **Step 4: Fix validation summary hex codes in CSS**

In `tailwind-formspec-core.css`, add missing semantic variables to the `:root` block (after line 29):

```css
  --formspec-tw-danger-bg: var(--formspec-color-error-bg, #fef2f2);
  --formspec-tw-danger-text: var(--formspec-color-error-text, #450a0a);
  --formspec-tw-danger-border: var(--formspec-color-error-border, #fecaca);
  --formspec-tw-warning-border: var(--formspec-color-warning-border, #f59e0b);
  --formspec-tw-warning-bg: var(--formspec-color-warning-bg, #fffbeb);
  --formspec-tw-warning-text: var(--formspec-color-warning-text, #451a03);
  --formspec-tw-info-border: var(--formspec-color-info-border, #0ea5e9);
  --formspec-tw-info-bg: var(--formspec-color-info-bg, #f0f9ff);
  --formspec-tw-info-text: var(--formspec-color-info-text, #0c4a6e);
  --formspec-tw-success: var(--formspec-color-success, #16a34a);
```

Then replace the hex codes in the validation summary classes:

```css
  .formspec-validation-summary--visible {
    border: 1px solid var(--formspec-tw-danger-border);
  }
  .formspec-validation-summary-header {
    border-bottom: 1px solid var(--formspec-tw-danger-border);
    background: var(--formspec-tw-danger-bg);
    color: var(--formspec-tw-danger-text);
  }
  .formspec-shape-error {
    border-left-color: var(--formspec-tw-danger);
    background: var(--formspec-tw-danger-bg);
    color: var(--formspec-tw-danger-text);
  }
  .formspec-shape-warning {
    border-left-color: var(--formspec-tw-warning-border);
    background: var(--formspec-tw-warning-bg);
    color: var(--formspec-tw-warning-text);
  }
  .formspec-shape-info {
    border-left-color: var(--formspec-tw-info-border);
    background: var(--formspec-tw-info-bg);
    color: var(--formspec-tw-info-text);
  }
```

- [ ] **Step 5: Run structural tests**

Run: `cd packages/formspec-adapters && npx vitest run tests/tailwind/structural.test.ts`
Expected: PASS (tests verify DOM structure, not specific class names)

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-adapters/src/tailwind/ packages/formspec-adapters/src/tailwind/tailwind-formspec-core.css
git commit -m "fix(tailwind-adapter): replace 27 hardcoded color tokens with CSS variables

Slider, Rating, MoneyInput, FileUpload, Wizard, Tabs, Signature, and
TextInput prefix/suffix now use --formspec-tw-* variables for theming.
Also removes dead errorColor parameter from applyErrorStyling and has
radio-group use the shared function instead of inline duplicate."
```

---

### Task 4: Fix stale-page import logic — per-page filtering [M9]

A single stale region key across ANY page drops ALL pages. Should filter per-page instead.

**Files:**

- Modify: `packages/formspec-core/src/handlers/project.ts:41-57`
- Test: `packages/formspec-core/tests/project-commands.test.ts`

- [ ] **Step 1: Write failing test for partial stale pages**

Add to `project-commands.test.ts`:

```typescript
it('keeps valid pages when only some have stale regions', () => {
    const project = createRawProject();
    // Seed initial state: definition with 3 fields and theme with 2 pages
    project.dispatch({
        type: 'project.import',
        payload: {
            definition: {
                $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
                items: [
                    { key: 'name', type: 'text' },
                    { key: 'age', type: 'number' },
                    { key: 'deleted_field', type: 'text' },
                ],
            },
            theme: {
                pages: [
                    { title: 'Valid', regions: [{ key: 'name' }, { key: 'age' }] },
                    { title: 'Stale', regions: [{ key: 'deleted_field' }] },
                ],
            },
        },
    });
    // Now import a new definition that drops 'deleted_field' — no theme in payload
    project.dispatch({
        type: 'project.import',
        payload: {
            definition: {
                $formspec: '1.0', url: 'urn:test', version: '2.0.0', title: 'Updated',
                items: [
                    { key: 'name', type: 'text' },
                    { key: 'age', type: 'number' },
                ],
            },
        },
    });
    const pages = (project.state.theme as any).pages;
    // Valid page should survive; stale page should be dropped
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Valid');
});

it('drops all pages when all have stale regions', () => {
    const project = createRawProject();
    project.dispatch({
        type: 'project.import',
        payload: {
            definition: {
                $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
                items: [{ key: 'old_field', type: 'text' }],
            },
            theme: {
                pages: [{ title: 'Page1', regions: [{ key: 'old_field' }] }],
            },
        },
    });
    project.dispatch({
        type: 'project.import',
        payload: {
            definition: {
                $formspec: '1.0', url: 'urn:test', version: '2.0.0', title: 'New',
                items: [{ key: 'new_field', type: 'text' }],
            },
        },
    });
    const pages = (project.state.theme as any).pages;
    expect(pages).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd packages/formspec-core && npx vitest run tests/project-commands.test.ts`
Expected: First test FAILS (all pages dropped when only one is stale)

- [ ] **Step 3: Change all-or-nothing to per-page filtering**

In `packages/formspec-core/src/handlers/project.ts`, replace lines 46-56:

```typescript
if (themePages && themePages.length > 0) {
    const flatKeys = collectDefinitionItemKeys((state.definition as any).items as FormItem[]);
    // Per-page filtering: drop only pages where ANY region key is stale.
    // A single accidental key match (shared field name) on a page must not
    // preserve that page if other regions are stale.
    (state.theme as any).pages = themePages.filter((page: any) =>
        (page.regions ?? []).every((region: any) => {
            const k = region.key as string | undefined;
            return !k || flatKeys.has(k);
        }),
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd packages/formspec-core && npx vitest run tests/project-commands.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/src/handlers/project.ts packages/formspec-core/tests/project-commands.test.ts
git commit -m "fix(formspec-core): per-page stale-region filtering on definition-only import

Previously one stale region key on any page dropped ALL pages. Now only
pages with stale region keys are removed; valid pages survive."
```

---

### Task 5: Add distinct error code for WASM-not-ready in RuntimeMappingEngine [M6]

`execute()` uses `COERCE_FAILURE` for both "WASM not loaded" and "execution error". Callers can't distinguish them.

**Files:**

- Modify: `packages/formspec-engine/src/mapping/RuntimeMappingEngine.ts:131-143`

- [ ] **Step 1: Fix the error code**

Change line 139 from `'COERCE_FAILURE'` to `'WASM_NOT_READY'`:

```typescript
private execute(direction: MappingDirection, source: any): RuntimeMappingResult {
    if (!isWasmToolsReady()) {
        return {
            direction,
            output: {},
            appliedRules: 0,
            diagnostics: [{
                ruleIndex: -1,
                errorCode: 'WASM_NOT_READY',
                message:
                    'RuntimeMappingEngine requires tools WASM. Call await initFormspecEngineTools() after await initFormspecEngine().',
            }],
        };
    }
```

- [ ] **Step 2: Run engine tests**

Run: `cd packages/formspec-engine && npx vitest run`
Expected: PASS (no test asserts on the specific error code string)

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-engine/src/mapping/RuntimeMappingEngine.ts
git commit -m "fix(engine): use WASM_NOT_READY error code in RuntimeMappingEngine

Replaces COERCE_FAILURE for the WASM-not-initialized case so callers
can distinguish initialization failures from execution errors."
```

---

### Task 6: Add `context=None` to TS stale-binary guard [H2]

The TS test helper `hasCurrentEvaluateDefSignature` doesn't check for the `context` parameter, so pre-parity binaries pass the guard and auto-rebuild doesn't trigger.

**Files:**

- Modify: `packages/formspec-core/tests/python.ts:32`

- [ ] **Step 1: Add the check**

Change line 32 from:

```typescript
return output.includes('registry_documents=None') && output.includes('instances=None');
```

to:

```typescript
return output.includes('registry_documents=None') && output.includes('instances=None') && output.includes('context=None');
```

- [ ] **Step 2: Run formspec-core tests**

Run: `cd packages/formspec-core && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-core/tests/python.ts
git commit -m "fix(formspec-core): check context param in stale-binary guard

hasCurrentEvaluateDefSignature now requires context=None in the
evaluate_def signature, triggering auto-rebuild for pre-parity binaries."
```

---

### Task 7: Remove unused test dependencies [L10]

`fastapi` and `httpx` in test extras have zero consumers.

**Files:**

- Modify: `pyproject.toml:13-14`

- [ ] **Step 1: Remove the two lines**

Delete lines 13-14 from `pyproject.toml`:

```diff
 test = [
     "jsonschema[format]>=4.20",
     "pytest>=9.0",
     "hypothesis>=6.0",
     "msgspec>=0.18",
     "referencing>=0.30",
-    "fastapi>=0.110",
-    "httpx>=0.27",
 ]
```

- [ ] **Step 2: Verify Python tests still run**

Run: `python3 -m pytest tests/ -x -q --co` (collect-only, verifying no import errors)
Expected: Tests collected successfully

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: remove unused fastapi/httpx test dependencies

No test file imports either package. They were added speculatively for
a planned API test suite that hasn't been written."
```

---

### Task 8: Fix broken RFC link references in mapping spec [L9]

Multiple `[RFC ...]` references have no link definitions: `[RFC 4180]` (3 refs), `[RFC 8174]` (1 ref), `[RFC 8259]` (4 refs), `[RFC 6901]` (1 ref), `[RFC 3986]` (1 ref).

**Files:**

- Modify: `specs/mapping/mapping-spec.md:47`

- [ ] **Step 1: Add link definitions**

After line 47 (`[rfc2119]: https://www.rfc-editor.org/rfc/rfc2119`), add:

```markdown
[RFC 3986]: https://www.rfc-editor.org/rfc/rfc3986
[RFC 4180]: https://www.rfc-editor.org/rfc/rfc4180
[RFC 6901]: https://www.rfc-editor.org/rfc/rfc6901
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[RFC 8259]: https://www.rfc-editor.org/rfc/rfc8259
```

- [ ] **Step 2: Regenerate spec artifacts**

Run: `npm run docs:generate`

- [ ] **Step 3: Run spec checks**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add specs/mapping/mapping-spec.md specs/mapping/mapping-spec.llm.md
git commit -m "docs(mapping-spec): add missing RFC link definitions

RFC 4180 (CSV), RFC 8174 (BCP 14 update), and RFC 8259 (JSON) were
referenced in body text but had no link definitions."
```

---

### Task 9: LazyLock for static regexes in prepare_host.rs [L5]

Five static regex patterns compiled on every function call. ~1,250 compilations per evaluation cycle for a 50-field form.

**Files:**

- Modify: `crates/fel-core/src/prepare_host.rs:42,50,57,93,109`

- [ ] **Step 1: Add LazyLock statics at module level**

Add after the imports (line 8):

```rust
use std::sync::LazyLock;

static RE_TRAILING_INDEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\d+\]$").expect("valid regex"));
static RE_PATH_SEGMENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([^\[.\]]+\[\d+\]|[^\[.\]]+)").expect("valid regex"));
static RE_REPEAT_SEG: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(.+)\[(\d+)\]$").expect("valid regex"));
static RE_INDEX_BRACKET: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[(\d+)\]").expect("valid regex"));
static RE_REPEAT_ALIAS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(.*)\[(\d+)\]\.([^\[.\]]+)$").expect("valid regex"));
```

- [ ] **Step 2: Replace inline Regex::new calls with static references**

Line 42: `Regex::new(r"\[\d+\]$").expect(...)` → `RE_TRAILING_INDEX.replace(last, "")`
Line 50: `Regex::new(r"([^\[.\]]+...").expect(...)` → `RE_PATH_SEGMENT.captures_iter(path)`
Line 57: `Regex::new(r"^(.+)\[(\d+)\]$").expect(...)` → `RE_REPEAT_SEG.captures(&segment)`
Line 93: `Regex::new(r"\[(\d+)\]").expect(...)` → `RE_INDEX_BRACKET.replace_all(path, ...)`
Line 109: `Regex::new(r"^(.*)\[(\d+)\]\.([^\[.\]]+)$").expect(...)` → `RE_REPEAT_ALIAS.captures(p)`

Note: The dynamic regex at line 194 (`Regex::new(&format!(...))`) cannot be cached — pattern depends on runtime group name. Leave it as-is.

- [ ] **Step 3: Run fel-core tests**

Run: `cargo test -p fel-core`
Expected: ALL PASS

- [ ] **Step 4: Run full workspace tests to check for regressions**

Run: `cargo test --workspace`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add crates/fel-core/src/prepare_host.rs
git commit -m "perf(fel-core): LazyLock static regexes in prepare_host

Five regex patterns were compiled on every call to
prepare_fel_expression_for_host. With ~250 calls per evaluation cycle
on a 50-field form, that's 1,250 unnecessary compilations. Use
std::sync::LazyLock (stable in Rust 2024 edition) for one-time init."
```

---

### Task 10: Add multi-level dot access test for let-binding fix [M4]

The PostfixAccess let-bound fix is structurally correct but only tested at one level of depth.

**Files:**

- Modify: `crates/fel-core/tests/evaluator_tests.rs:239`

- [ ] **Step 1: Add multi-level test**

After line 239 (`test_let_binding_property_access_on_bound_object`), add:

```rust
#[test]
fn test_let_binding_multi_level_property_access() {
    assert_eq!(eval("let x = {a: {b: 2}} in x.a.b"), num(2));
    assert_eq!(eval("let x = {a: {b: {c: 3}}} in x.a.b.c"), num(3));
}
```

- [ ] **Step 2: Run to confirm it passes** (this is a coverage test, not a red-green cycle — the fix already works)

Run: `cargo test -p fel-core -- test_let_binding_multi_level`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add crates/fel-core/tests/evaluator_tests.rs
git commit -m "test(fel-core): add multi-level dot access test for let-binding fix

Documents that the PostfixAccess let-bound guard generalizes to nested
property access (x.a.b, x.a.b.c), not just the one-level case."
```

---

### Task 11: Fix submodule path import in formspec-py [L1]

`formspec-py/src/document.rs` uses `types::EvalContext` instead of the crate-root re-export.

**Files:**

- Modify: `crates/formspec-py/src/document.rs:14-18`

- [ ] **Step 1: Fix the import**

Change line 14-18 from:

```rust
use formspec_eval::{
    eval_context_from_json_object, evaluate_definition_full_with_instances_and_context,
    evaluate_screener, evaluation_result_to_json_value_styled,
    extension_constraints_from_registry_documents, screener_route_to_json_value,
    types::EvalContext,
};
```

to:

```rust
use formspec_eval::{
    EvalContext, eval_context_from_json_object,
    evaluate_definition_full_with_instances_and_context, evaluate_screener,
    evaluation_result_to_json_value_styled, extension_constraints_from_registry_documents,
    screener_route_to_json_value,
};
```

- [ ] **Step 2: Run formspec-py tests**

Run: `cargo test -p formspec-py`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add crates/formspec-py/src/document.rs
git commit -m "refactor(formspec-py): use crate-root re-export for EvalContext

Decouples from formspec-eval's internal module layout."
```

---

### Task 12: Remove bundle-rustdoc-md timestamp [L6]

The `new Date().toISOString()` makes generated API.md files non-idempotent, blocking any future staleness gate.

**Files:**

- Modify: `scripts/bundle-rustdoc-md.mjs:70-74`

- [ ] **Step 1: Remove the timestamp**

Replace lines 70-74:

```javascript
const stamp = new Date().toISOString();
const pieces = [
  `# ${title} — generated API (Markdown)`,
  "",
  `Generated: ${stamp} (do not edit by hand; regenerate via npm script / cargo doc-md + this bundler)`,
```

with:

```javascript
const pieces = [
  `# ${title} — generated API (Markdown)`,
  "",
  `> Do not edit by hand; regenerate via npm script / cargo doc-md + this bundler.`,
```

- [ ] **Step 2: Regenerate to verify idempotence**

Run twice and diff:

```bash
npm run docs:fel-core && cp crates/fel-core/docs/rustdoc-md/API.md /tmp/api1.md
npm run docs:fel-core && diff /tmp/api1.md crates/fel-core/docs/rustdoc-md/API.md
```

Expected: No diff (idempotent)

- [ ] **Step 3: Commit**

```bash
git add scripts/bundle-rustdoc-md.mjs
git commit -m "chore: remove timestamp from bundle-rustdoc-md output

Makes API.md generation idempotent, unblocking future staleness checks."
```

---

## Task Dependency Notes

- All tasks are independent and can run in parallel.
- Task 3 (Tailwind CSS variables) is the largest; consider splitting into sub-PRs per widget if the diff is too large for comfortable review.
- Task 12 (timestamp removal) unblocks a future M5 staleness gate task (not included in this plan — that's new infrastructure work).
- Tasks 1, 5, 6, 7, 8, 10, 11, 12 are trivial/small and can be batched into a single commit session.
