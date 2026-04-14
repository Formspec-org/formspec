# Pages E2E: Preview Integration and Round-Trip Export Validation

Two ways to make Pages E2E tests truly integrated: (1) **Preview integration** — assert that configured pages produce real wizard behavior in the form preview; (2) **Round-trip → export → validation** — get project state out and validate it with Python or the Node engine.

---

## 1. Preview integration (Playwright only)

**Idea:** After configuring pages in the Pages workspace (add page, assign items, or use a wizard seed), switch to Preview and assert the **runtime** form shows wizard behavior: first step visible, Next/Continue, second step after click, optional Submit on last step.

**Flow:**
1. Import project (e.g. wizard seed with 2 theme pages, definition with 2 fields).
2. Optional: in Pages tab, add a page or change assignments (to prove UI changes affect preview).
3. Switch to Preview tab.
4. Assert: first step content visible (e.g. field label "Name" or "Step 1" heading).
5. Click Next/Continue.
6. Assert: second step visible (e.g. "Email" or "Step 2").
7. Optional: click Next again; assert Submit button on last step.

**Selectors:** Preview uses `<formspec-render>` in the same document (no iframe). The existing `wizard-mode.spec.ts` already does:

- `workspace.getByLabel('Full Name')`, `workspace.getByRole('button', { name: /continue|next/i })`, `workspace.getByRole('button', { name: /submit/i })`.

So we reuse the same workspace locator and labels/roles that the rendered form exposes.

**Example test (pseudocode):**

```ts
test('Pages workspace wizard config is reflected in Preview', async ({ page }) => {
  await importProject(page, WIZARD_THEME_SEED);  // 2 pages, name on P1, email on P2
  await switchTab(page, 'Pages');
  await expect(page.locator('[data-testid="workspace-Pages"]').getByText('Step 1')).toBeVisible();

  await switchTab(page, 'Preview');
  const preview = page.locator('[data-testid="workspace-Preview"]');
  await expect(preview.getByLabel('Name')).toBeVisible();
  await expect(preview.getByRole('button', { name: /continue|next/i }).first()).toBeVisible();

  await preview.getByRole('button', { name: /continue|next/i }).first().click();
  await expect(preview.getByLabel('Email')).toBeVisible({ timeout: 2000 });

  await preview.getByRole('button', { name: /continue|next/i }).first().click();
  await expect(preview.getByRole('button', { name: /submit/i }).first()).toBeVisible();
});
```

**Dependencies:** None beyond current helpers. Preview and wizard rendering must already work (as in `wizard-mode.spec.ts`).

---

## 2. Round-trip → export → Python validation

**Idea:** Get the full project bundle (definition + theme + component + mapping) out of the app, write it to a temp directory as JSON files, then run `python3 -m formspec.validate <dir>` and assert exit code 0 (and optionally no errors in report).

**Challenges:**
- **Getting the bundle from the browser:** The UI currently only has "Export" which downloads **definition only** (`project.export().definition`). So we need a way to get the full `project.export()` in the test.
- **Where to run Python:** Playwright runs in Node. So after getting the bundle we run a shell command from Node (e.g. `child_process.spawnSync('python3', ['-m', 'formspec.validate', tempDir])`).

**Ways to get the bundle:**

| Approach | Pros | Cons |
|----------|------|------|
| **A. Test-only global** | No UI change; test calls `page.evaluate(() => window.__formspecExport())` and the app (in test env) exposes `project.export()`. | Requires app code to set `window.__formspecExport` when in test or NODE_ENV=test. |
| **B. Export all (new menu item)** | No test-only API; user can "Export project" and get a ZIP or multiple files. | UI change; test would need to intercept multiple downloads or one ZIP and unpack. |
| **C. Don’t round-trip from UI** | Test builds a bundle in Node (same shape as Pages would produce), writes to temp dir, runs Python. | Validates "artifact shape is valid" but not "what the studio produced is valid". |

**Recommended for E2E:** **A.** In test or development, expose something like:

```ts
// In Shell or StudioApp, when process.env.NODE_ENV === 'test' or import.meta.env?.TEST:
if (typeof window !== 'undefined' && (window as any).__FORMPEC_TEST_EXPORT) {
  (window as any).__FORMPEC_TEST_EXPORT = () => project.export();
}
```

Then in the test:

```ts
const bundle = await page.evaluate(() => (window as any).__FORMPEC_TEST_EXPORT());
```

**Writing the bundle for Python:** `formspec.validate` discovers artifacts by scanning a directory for `*.json` and classifying each file by document type (definition, theme, component, mapping) from content. So we write:

- `definition.json` ← `bundle.definition`
- `theme.json`     ← `bundle.theme`
- `component.json` ← `bundle.component`
- `mapping.json`    ← `bundle.mapping`

into a temp dir (e.g. `path.join(os.tmpdir(), 'formspec-e2e-export-XXXX')`), then:

```ts
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function validateBundleWithPython(bundle: ProjectBundle): { exitCode: number; stdout: string; stderr: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formspec-e2e-'));
  try {
    fs.writeFileSync(path.join(dir, 'definition.json'), JSON.stringify(bundle.definition, null, 2));
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(bundle.theme, null, 2));
    fs.writeFileSync(path.join(dir, 'component.json'), JSON.stringify(bundle.component, null, 2));
    fs.writeFileSync(path.join(dir, 'mapping.json'), JSON.stringify(bundle.mapping, null, 2));
    const result = spawnSync('python3', ['-m', 'formspec.validate', dir, '--registry', 'registries/formspec-common.registry.json'], {
      encoding: 'utf-8',
      cwd: path.resolve(process.cwd(), '../..'), // repo root if test runs from packages/formspec-studio
    });
    return { exitCode: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
```

**Example test (pseudocode):**

```ts
test('exported project bundle validates with Python formspec.validate', async ({ page }) => {
  await importProject(page, WIZARD_THEME_SEED);
  await switchTab(page, 'Pages');
  await expect(page.locator('[data-testid="workspace-Pages"]').getByText('Step 1')).toBeVisible();

  const bundle = await page.evaluate(() => (window as any).__FORMPEC_TEST_EXPORT());
  const { exitCode, stderr } = validateBundleWithPython(bundle);
  expect(exitCode, stderr).toBe(0);
});
```

**Registry path:** Python needs the registry path; the test runner’s cwd may be `packages/formspec-studio`, so resolve to repo root for `registries/formspec-common.registry.json` (or pass an absolute path). Skip `--registry` if the project uses no extensions.

---

## 3. Round-trip → Node/engine validation (no Python)

**Idea:** Same as above, but instead of calling Python we use the **studio-core** project in Node: create a project from the exported bundle and run `project.diagnose()` (or the same schema validators the project uses). That checks schema and optionally FEL/extension issues without leaving Node.

**Flow:**
1. Get bundle from browser (same as A above).
2. In Node: `createProject({ seed: bundle })` (or equivalent).
3. Call `project.diagnose()` and assert no errors (or specific error count).
4. Optionally: run the TS FormEngine with the definition and assert it doesn’t throw (e.g. setDefinition(bundle.definition)).

**Example (pseudocode):**

```ts
import { createProject } from 'formspec-studio-core';

const bundle = await page.evaluate(() => (window as any).__FORMPEC_TEST_EXPORT());
const project = createProject({ seed: bundle });
const diagnostics = project.diagnose();
const errors = diagnostics.filter(d => d.severity === 'error');
expect(errors).toHaveLength(0);
```

**Pros:** No Python, no temp files, same process as Playwright. **Cons:** Only exercises the same validation logic that runs in the studio (schema + diagnose), not the full Python validator (FEL, mapping, registry, etc.).

---

## 4. Summary

| Test | Where it runs | What it proves |
|------|----------------|----------------|
| **Preview integration** | Playwright only | Pages config (theme.pages + formPresentation) drives the actual wizard in the form preview. |
| **Export → Python validate** | Playwright + Node (get bundle) + shell (Python) | Exported artifacts pass the full Python validation pipeline (schema, FEL, mapping, registry, etc.). |
| **Export → Node diagnose** | Playwright + Node only | Exported bundle is accepted by studio-core and has no diagnose errors. |

**Suggested order:** Implement (1) Preview integration first (no new app hooks). Then add (2) or (3) once a test-only export hook or "Export project" exists; (2) is stronger if we want to assert conformance with the Python toolchain.
