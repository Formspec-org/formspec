# ADR-0039: Seamless Page Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite page management in studio-core so Studio is the sole document author — eliminating tier cascades, fixing five known bugs, and generating schema-conformant page-aware component trees.

**Architecture:** Studio-core manages Definition, Theme, and Component documents coherently. `theme.pages` (conforming to `theme.schema.json#/$defs/Page`) is the canonical page structure. `resolvePageStructure` reads only from `theme.pages` — no tier cascade. The component tree is rebuilt from scratch on every relevant dispatch: `Wizard > Page[]` in wizard mode, `Tabs > Page[]` in tabs mode, `Stack > items[]` in single mode. All generated nodes conform to `component.schema.json`.

**Tech Stack:** TypeScript, Vitest, Preact Signals

**Spec:** `thoughts/adr/0039-seamless-page-management.md`

**Schema references:**
- `schemas/definition.schema.json` — `formPresentation.pageMode` (`single|wizard|tabs`), `Presentation.layout.page` (group page hint)
- `schemas/theme.schema.json` — `Page` (`id`, `title`, `description?`, `regions: Region[]`), `Region` (`key`, `span?` default 12, `start?`, `responsive?`)
- `schemas/component.schema.json` — `Wizard` (`showProgress?`, `allowSkip?`, children MUST be `Page`), `Tabs` (`position?`, `tabLabels?`, `defaultTab?`), `Page` (`title?`, `description?`, `children`), `Stack`

---

## File Structure

**Rewrite from scratch:**
- `packages/formspec-studio-core/src/page-resolution.ts` — New types (`ResolvedRegion` with `exists`, `itemPageMap`, `unassignedItems`), single-source resolution from `theme.pages`. Removes `controllingTier`, `wizardConfig`, `SHADOWED_THEME_PAGES`.
- `packages/formspec-studio-core/tests/page-resolution.test.ts` — Tests matching new interface.

**Modify:**
- `packages/formspec-studio-core/src/handlers/pages.ts` — Fix 5 bugs (destructive mode switch, mode reset on delete, mode override on add, wrong property path in autoGenerate, missing rebuild flag), add 2 new handlers (`reorderRegion`, `setRegionProperty`).
- `packages/formspec-studio-core/src/project.ts` — Extend `_rebuildComponentTree()` with page-aware distribution (lines 1900-1903).
- `packages/formspec-studio-core/src/index.ts` — Add `ResolvedRegion` to type exports.
- `packages/formspec-studio-core/tests/pages-handlers.test.ts` — Replace tests that verified wrong behavior, add new handler tests.

**Create:**
- `packages/formspec-studio-core/tests/page-aware-rebuild.test.ts` — Component tree rebuild tests.

---

## Known Limitations

**Layout wrappers + page distribution:** Phase 3 of `_rebuildComponentTree()` re-inserts layout wrappers (`_layout: true` nodes) by extracting their child items from `newRoot` and splicing them back in at their original position. When items have been distributed into `Page` nodes, this extraction pulls them *out* of their Page and places the wrapper at the root level alongside Pages. This is structurally imperfect but non-destructive. Fixing this requires making Phase 3 page-aware — deferred to a follow-on task.

---

## Follow-on: Studio UI Changes (Out of Scope)

This plan fixes studio-core. The following studio UI changes are **required afterward** but are not part of this implementation:

### `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx`

| Location | What | Action |
|----------|------|--------|
| Lines 9-32 | `TierStatusBanner` component | Remove entirely — sole-writer model has no tier conflicts |
| Line 246 | `<TierStatusBanner controllingTier={structure.controllingTier} />` | Delete — `controllingTier` no longer exists on the type |
| Line 250 | `structure.controllingTier !== 'component'` | Remove condition — always show editing UI when `isMultiPage` |
| Lines 287-298 | `controllingTier === 'component'` read-only branch | Delete — no "Wizard active in component tree" state |
| Line 85 | `page.regions ?? []` | Simplify to `page.regions` — now non-optional |
| — | Unassigned items UI | New: render `structure.unassignedItems` for drag-and-drop assignment (design TBD) |

### Authored tree diagnostic

ADR-0039 says "the UI should surface a diagnostic when theme.pages and an authored component tree coexist." This diagnostic is not implemented in this plan — it belongs in the studio UI follow-on.

---

## Chunk 1: Rewrite page-resolution.ts

### Task 1: Write new types and stub function

**Files:**
- Rewrite: `packages/formspec-studio-core/src/page-resolution.ts`

- [ ] **Step 1: Rewrite page-resolution.ts with new types and stub function**

Delete the entire file contents and replace with:

```typescript
import type { ProjectState } from './types.js';

// ── Public types ─────────────────────────────────────────────────────

/**
 * Enriched region from theme.schema.json Region with existence check.
 * Schema source: theme.schema.json#/$defs/Region
 */
export interface ResolvedRegion {
  key: string;
  span: number;       // default 12 per schema
  start?: number;
  exists: boolean;     // key exists in definition items?
}

/**
 * Resolved page from theme.schema.json Page with enriched regions.
 * Schema source: theme.schema.json#/$defs/Page
 */
export interface ResolvedPage {
  id: string;
  title: string;
  description?: string;
  regions: ResolvedRegion[];
}

export interface PageDiagnostic {
  code: 'UNKNOWN_REGION_KEY' | 'PAGEMODE_MISMATCH';
  severity: 'warning' | 'error';
  message: string;
}

export interface ResolvedPageStructure {
  mode: 'single' | 'wizard' | 'tabs';
  pages: ResolvedPage[];
  diagnostics: PageDiagnostic[];
  unassignedItems: string[];
  itemPageMap: Record<string, string>;
}

/**
 * Resolves the current page structure from studio-managed internal state.
 *
 * Reads `theme.pages` as the canonical source. No tier cascade —
 * Studio is the sole writer and keeps all documents consistent.
 */
export function resolvePageStructure(
  state: ProjectState,
  definitionItemKeys: string[],
): ResolvedPageStructure {
  throw new Error('Not implemented');
}
```

**What changed from old types:**
- Removed `controllingTier` — no tier conflict when Studio is sole writer
- Removed `wizardConfig` — `showProgress`/`allowSkip` are `Wizard` component props (component.schema.json), not page resolution concerns. Set on the generated Wizard node during `_rebuildComponentTree()`.
- Removed `SHADOWED_THEME_PAGES` diagnostic — no Wizard/theme conflict
- `regions` is now non-optional with `exists` flag
- Added `unassignedItems` and `itemPageMap`

- [ ] **Step 2: Verify the project compiles**

Run: `cd packages/formspec-studio-core && npx tsc --noEmit`
Expected: Compile errors in files that reference `controllingTier`, `wizardConfig`, or `SHADOWED_THEME_PAGES`. Note these for follow-on (Task 11).

### Task 2: Write core resolution tests (RED)

**Files:**
- Rewrite: `packages/formspec-studio-core/tests/page-resolution.test.ts`

- [ ] **Step 1: Write test file with core test cases**

Delete old test file and replace with:

```typescript
import { describe, it, expect } from 'vitest';
import { resolvePageStructure } from '../src/page-resolution.js';
import type { ProjectState } from '../src/types.js';

/** Minimal state factory — only the fields resolvePageStructure reads. */
function makeState(overrides: {
  definition?: Record<string, unknown>;
  theme?: Record<string, unknown>;
} = {}): ProjectState {
  return {
    definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
      items: [],
      ...overrides.definition,
    } as any,
    theme: { ...overrides.theme } as any,
    component: {} as any,
    generatedComponent: { 'x-studio-generated': true } as any,
    mapping: {} as any,
    extensions: { registries: [] },
    versioning: { baseline: {} as any, releases: [] },
  };
}

describe('resolvePageStructure', () => {
  // Note: the old makeState had a `component` override for Wizard-in-component-tree
  // tests. Removed — Studio manages the component tree, so resolution never reads it.
  //
  // Note: ADR Section 6 lists "attach to preceding page" under Resolution tests,
  // but resolvePageStructure reads only from theme.pages (already structured).
  // The attach-to-preceding rule is tested in autoGenerate (Task 6).

  it('returns single mode with empty pages when nothing is configured', () => {
    const result = resolvePageStructure(makeState(), []);

    expect(result.mode).toBe('single');
    expect(result.pages).toEqual([]);
    expect(result.unassignedItems).toEqual([]);
    expect(result.itemPageMap).toEqual({});
    expect(result.diagnostics).toEqual([]);
  });

  it('builds pages from theme.pages with enriched regions', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 6 }] },
          { id: 'p2', title: 'Step 2', regions: [{ key: 'age', span: 12 }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'age']);

    expect(result.mode).toBe('wizard');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].id).toBe('p1');
    expect(result.pages[0].title).toBe('Step 1');
    expect(result.pages[0].regions).toEqual([
      { key: 'name', span: 6, exists: true },
    ]);
    expect(result.pages[1].regions).toEqual([
      { key: 'age', span: 12, exists: true },
    ]);
  });

  it('builds itemPageMap from region assignments', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
          { id: 'p2', title: 'B', regions: [{ key: 'email' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'email']);

    expect(result.itemPageMap).toEqual({ name: 'p1', email: 'p2' });
  });

  it('reports unassigned items not in any page region', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name', 'email', 'age']);

    expect(result.unassignedItems).toEqual(['email', 'age']);
  });

  it('marks region exists=false when key is not a known definition item', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }, { key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0].exists).toBe(true);
    expect(result.pages[0].regions[1].exists).toBe(false);
  });

  it('emits UNKNOWN_REGION_KEY for non-existent region keys', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'Page', regions: [{ key: 'ghost' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_REGION_KEY',
        message: expect.stringContaining('ghost'),
      }),
    );
  });

  it('emits PAGEMODE_MISMATCH when pages exist but pageMode is single', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'single' } },
      theme: {
        pages: [{ id: 'p1', title: 'Orphan', regions: [] }],
      },
    });

    const result = resolvePageStructure(state, []);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PAGEMODE_MISMATCH' }),
    );
  });

  it('returns wizard mode with empty pages when pageMode is wizard and no pages exist', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
    });

    const result = resolvePageStructure(state, []);

    expect(result.mode).toBe('wizard');
    expect(result.pages).toEqual([]);
  });

  it('returns tabs mode when pageMode is tabs', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'tabs' } },
      theme: {
        pages: [
          { id: 't1', title: 'Tab 1', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.mode).toBe('tabs');
  });

  it('defaults region span to 12 when not specified (per theme.schema.json Region.span default)', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name' }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0].span).toBe(12);
  });

  it('preserves region start when specified', () => {
    const state = makeState({
      definition: { formPresentation: { pageMode: 'wizard' } },
      theme: {
        pages: [
          { id: 'p1', title: 'A', regions: [{ key: 'name', span: 6, start: 4 }] },
        ],
      },
    });

    const result = resolvePageStructure(state, ['name']);

    expect(result.pages[0].regions[0]).toEqual({
      key: 'name', span: 6, start: 4, exists: true,
    });
  });

  it('all items are unassigned when no pages exist', () => {
    const result = resolvePageStructure(makeState(), ['name', 'email']);

    expect(result.unassignedItems).toEqual(['name', 'email']);
  });

  it('does not include wizardConfig (component concern, not resolution)', () => {
    const result = resolvePageStructure(makeState(), []);

    expect(result).not.toHaveProperty('wizardConfig');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/page-resolution.test.ts`
Expected: All tests FAIL with `Error: Not implemented`

### Task 3: Implement resolvePageStructure (GREEN)

**Files:**
- Modify: `packages/formspec-studio-core/src/page-resolution.ts`

- [ ] **Step 1: Replace the stub with the implementation**

Replace `throw new Error('Not implemented');` with:

```typescript
  const diagnostics: PageDiagnostic[] = [];
  const def = state.definition as any;
  const themePages = (state.theme.pages ?? []) as any[];
  const pageMode: string = def.formPresentation?.pageMode ?? 'single';
  const knownKeys = new Set(definitionItemKeys);

  // Build resolved pages from theme.pages (canonical source)
  // Maps theme.schema.json Page/Region to enriched ResolvedPage/ResolvedRegion
  const pages: ResolvedPage[] = themePages.map((p: any) => ({
    id: p.id ?? '',
    title: p.title ?? '',
    description: p.description,
    regions: (p.regions ?? []).map((r: any) => ({
      key: r.key ?? '',
      span: r.span ?? 12,  // Region.span default per schema
      start: r.start,
      exists: knownKeys.has(r.key ?? ''),
    })),
  }));

  // Build itemPageMap and emit diagnostics for unknown keys
  const itemPageMap: Record<string, string> = {};
  for (const page of pages) {
    for (const region of page.regions) {
      if (region.exists) {
        itemPageMap[region.key] = page.id;
      } else if (region.key) {
        diagnostics.push({
          code: 'UNKNOWN_REGION_KEY',
          severity: 'warning',
          message: `Region key "${region.key}" on page "${page.title || page.id}" does not match any definition item.`,
        });
      }
    }
  }

  // Compute unassigned items
  const unassignedItems = definitionItemKeys.filter(k => !(k in itemPageMap));

  // Emit PAGEMODE_MISMATCH
  if (pages.length > 0 && pageMode === 'single') {
    diagnostics.push({
      code: 'PAGEMODE_MISMATCH',
      severity: 'warning',
      message: 'Theme pages exist but definition pageMode is "single". Pages may not render.',
    });
  }

  // Determine effective mode (definition.schema.json formPresentation.pageMode enum)
  const mode: 'single' | 'wizard' | 'tabs' =
    pageMode === 'tabs' ? 'tabs' : pageMode === 'wizard' ? 'wizard' : 'single';

  return {
    mode,
    pages,
    diagnostics,
    unassignedItems,
    itemPageMap,
  };
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/page-resolution.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-studio-core/src/page-resolution.ts packages/formspec-studio-core/tests/page-resolution.test.ts
git commit -m "feat: rewrite resolvePageStructure — sole-writer model, no tier cascade

Removes controllingTier, wizardConfig, SHADOWED_THEME_PAGES.
theme.pages is the canonical source. Adds unassignedItems,
itemPageMap, and enriched regions with exists flag."
```

---

## Chunk 2: Fix and extend pages handlers

### Task 4: Write tests for non-destructive behavior (RED)

**Files:**
- Modify: `packages/formspec-studio-core/tests/pages-handlers.test.ts`

- [ ] **Step 1: Replace destructive-mode-switching tests with non-destructive ones**

Replace the `pages.setMode` test "clears theme.pages when setting single mode" (currently lines 57-66) with:

```typescript
  it('preserves theme.pages when setting single mode', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'X' } });
    expect(project.theme.pages as any[]).toHaveLength(1);

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('single');
    expect(project.theme.pages as any[]).toHaveLength(1); // preserved, not cleared
  });
```

Replace the `pages.deletePage` test "resets pageMode to single when deleting the last page" (currently lines 34-44) with:

```typescript
  it('preserves pageMode when deleting the last page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Only' } });
    const pages = project.theme.pages as any[];
    const id = pages[0].id;

    project.dispatch({ type: 'pages.deletePage', payload: { id } });

    expect(project.theme.pages as any[]).toHaveLength(0);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard'); // preserved
  });
```

- [ ] **Step 2: Add test for addPage preserving tabs mode**

Add to the `pages.addPage` describe block:

```typescript
  it('preserves tabs mode when adding a page (does not force wizard)', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'tabs' } });

    project.dispatch({ type: 'pages.addPage', payload: { title: 'Tab 1' } });

    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });
```

- [ ] **Step 3: Add round-trip test**

Add to the `pages.setMode` describe block:

```typescript
  it('round-trips wizard → single → wizard preserving pages', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'wizard' } });

    expect(project.theme.pages as any[]).toHaveLength(2);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
```

- [ ] **Step 4: Run tests to verify the new/changed tests fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: 3 tests FAIL — setMode clears pages, deletePage resets mode, addPage forces wizard over tabs

### Task 5: Fix setMode, deletePage, addPage handlers (GREEN)

**Files:**
- Modify: `packages/formspec-studio-core/src/handlers/pages.ts`

- [ ] **Step 1: Fix pages.addPage — preserve existing mode**

Replace lines 37-51 (`pages.addPage` handler) with:

```typescript
registerHandler('pages.addPage', (state, payload) => {
  const { title, description } = payload as { title?: string; description?: string };
  const pages = ensurePages(state);
  const fp = ensureFormPresentation(state);

  pages.push({
    id: generatePageId(),
    title: title ?? `Page ${pages.length + 1}`,
    description,
    regions: [],
  });

  // Only promote to wizard if currently single or unset.
  // Preserve tabs mode — mode is rendering style, not structure.
  if (!fp.pageMode || fp.pageMode === 'single') {
    fp.pageMode = 'wizard';
  }

  return { rebuildComponentTree: true };
});
```

- [ ] **Step 2: Fix pages.deletePage — remove mode reset**

Replace lines 55-69 (`pages.deletePage` handler) with:

```typescript
registerHandler('pages.deletePage', (state, payload) => {
  const { id } = payload as { id: string };
  const pages = ensurePages(state);
  const index = pages.findIndex((p: any) => p.id === id);
  if (index === -1) throw new Error(`Page not found: ${id}`);

  pages.splice(index, 1);
  // Do NOT reset pageMode — empty page list means "ready to add pages",
  // not "switch to single." Use pages.setMode('single') explicitly.

  return { rebuildComponentTree: true };
});
```

- [ ] **Step 3: Fix pages.setMode — remove page destruction**

Replace lines 73-87 (`pages.setMode` handler) with:

```typescript
registerHandler('pages.setMode', (state, payload) => {
  const { mode } = payload as { mode: 'single' | 'wizard' | 'tabs' };
  const fp = ensureFormPresentation(state);
  fp.pageMode = mode;

  // Pages are preserved in single mode (dormant, not destroyed).
  // Ensure pages array exists for wizard/tabs.
  if (mode !== 'single') {
    ensurePages(state);
  }

  return { rebuildComponentTree: true };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/pages.ts packages/formspec-studio-core/tests/pages-handlers.test.ts
git commit -m "fix: non-destructive mode switching in pages handlers

setMode preserves theme.pages (dormant in single mode, not destroyed).
deletePage does not reset pageMode. addPage preserves tabs mode."
```

### Task 6: Fix autoGenerate property path and add attach-to-preceding (RED → GREEN)

**Files:**
- Modify: `packages/formspec-studio-core/src/handlers/pages.ts`
- Modify: `packages/formspec-studio-core/tests/pages-handlers.test.ts`

- [ ] **Step 1: Fix the autoGenerate test fixture to use correct property path**

The correct schema path is `Presentation.layout.page` (definition.schema.json line 1580). Replace the `pages.autoGenerate` test "creates pages from definition groups with layout.page hints" (currently lines 144-171) with:

```typescript
  it('creates pages from definition groups with presentation.layout.page hints', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            {
              key: 'personal', type: 'group', label: 'Personal',
              presentation: { layout: { page: 'page1' } },
              children: [{ key: 'name', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'contact', type: 'group', label: 'Contact',
              presentation: { layout: { page: 'page2' } },
              children: [{ key: 'email', type: 'field', dataType: 'string', label: '' }],
            },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe('Personal');
    expect(pages[1].title).toBe('Contact');
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });
```

- [ ] **Step 2: Add test for attach-to-preceding rule**

Per definition.schema.json Presentation.layout.page description: "Groups without a page attach to the preceding page."

```typescript
  it('attaches groups without page hint to the preceding page', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          items: [
            {
              key: 'basic', type: 'group', label: 'Basic',
              presentation: { layout: { page: 'page1' } },
              children: [{ key: 'name', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'extra', type: 'group', label: 'Extra',
              // No page hint — should attach to page1 (preceding)
              children: [{ key: 'notes', type: 'field', dataType: 'string', label: '' }],
            },
            {
              key: 'contact', type: 'group', label: 'Contact',
              presentation: { layout: { page: 'page2' } },
              children: [{ key: 'email', type: 'field', dataType: 'string', label: '' }],
            },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    const pages = project.theme.pages as any[];
    expect(pages).toHaveLength(2);
    expect(pages[0].regions.map((r: any) => r.key)).toEqual(['name', 'notes']);
    expect(pages[1].regions.map((r: any) => r.key)).toEqual(['email']);
  });
```

- [ ] **Step 3: Add test for autoGenerate preserving tabs mode**

```typescript
  it('preserves tabs mode when auto-generating pages', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Test',
          formPresentation: { pageMode: 'tabs' },
          items: [
            { key: 'f1', type: 'field', dataType: 'string', label: '' },
          ],
        } as any,
      },
    });

    project.dispatch({ type: 'pages.autoGenerate', payload: {} });

    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });
```

- [ ] **Step 4: Run tests to verify the new tests fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: autoGenerate tests FAIL (wrong property path, no attach-to-preceding, mode forced to wizard)

- [ ] **Step 5: Fix autoGenerate handler**

Replace lines 151-197 (`pages.autoGenerate` handler) in `handlers/pages.ts` with:

```typescript
registerHandler('pages.autoGenerate', (state, payload) => {
  const pages = ensurePages(state);
  const fp = ensureFormPresentation(state);
  const items = state.definition.items ?? [];

  // Clear existing pages
  pages.length = 0;

  // Walk definition items looking for groups with presentation.layout.page hints
  // Schema path: definition.schema.json Presentation.layout.page
  const pageMap = new Map<string, any>();
  const pageOrder: string[] = [];
  let lastPageHint: string | null = null;

  for (const item of items) {
    if ((item as any).type !== 'group') continue;

    const pageHint = (item as any).presentation?.layout?.page;

    if (pageHint) {
      lastPageHint = pageHint;
      if (!pageMap.has(pageHint)) {
        pageMap.set(pageHint, {
          id: generatePageId(),
          title: (item as any).label ?? (item as any).key,
          regions: [],
        });
        pageOrder.push(pageHint);
      }
    }

    // Attach to current page (if has hint) or preceding page (if no hint)
    // Per schema: "Groups without a page attach to the preceding page"
    const targetHint = pageHint ?? lastPageHint;
    if (targetHint && pageMap.has(targetHint)) {
      const page = pageMap.get(targetHint)!;
      const children = (item as any).children ?? [];
      for (const child of children) {
        page.regions.push({ key: child.key, span: 12 });
      }
    }
  }

  if (pageMap.size > 0) {
    for (const hint of pageOrder) {
      pages.push(pageMap.get(hint)!);
    }
  } else {
    // Fallback: single page with all root items
    const fallbackPage: any = {
      id: generatePageId(),
      title: 'Page 1',
      regions: [],
    };
    for (const item of items) {
      fallbackPage.regions.push({ key: (item as any).key, span: 12 });
    }
    pages.push(fallbackPage);
  }

  // Only promote to wizard if currently single or unset
  if (!fp.pageMode || fp.pageMode === 'single') {
    fp.pageMode = 'wizard';
  }

  return { rebuildComponentTree: true };
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/pages.ts packages/formspec-studio-core/tests/pages-handlers.test.ts
git commit -m "fix: autoGenerate uses correct property path and attach-to-preceding rule"
```

### Task 7: Add new handlers (reorderRegion, setRegionProperty)

**Files:**
- Modify: `packages/formspec-studio-core/src/handlers/pages.ts`
- Modify: `packages/formspec-studio-core/tests/pages-handlers.test.ts`

- [ ] **Step 1: Write tests for new handlers**

Add to `tests/pages-handlers.test.ts`:

```typescript
describe('pages.reorderRegion', () => {
  it('moves a region to a target index within a page', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'c' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'c', targetIndex: 0 },
    });

    const regions = (project.theme.pages as any[])[0].regions;
    expect(regions.map((r: any) => r.key)).toEqual(['c', 'a', 'b']);
  });

  it('clamps targetIndex to valid range', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'a' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'b' } });

    project.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: 'a', targetIndex: 99 },
    });

    const regions = (project.theme.pages as any[])[0].regions;
    expect(regions.map((r: any) => r.key)).toEqual(['b', 'a']);
  });
});

describe('pages.setRegionProperty', () => {
  it('sets span on a region', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: 6 },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect(region.span).toBe(6);
  });

  it('removes property when value is undefined', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name', span: 6 } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'span', value: undefined },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect('span' in region).toBe(false);
  });

  it('sets start on a region', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;
    project.dispatch({ type: 'pages.assignItem', payload: { pageId, key: 'name' } });

    project.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: 'name', property: 'start', value: 4 },
    });

    const region = (project.theme.pages as any[])[0].regions[0];
    expect(region.start).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: New tests FAIL with `Unknown command type: pages.reorderRegion`

- [ ] **Step 3: Implement new handlers**

Add to the end of `handlers/pages.ts`:

```typescript
// ── pages.reorderRegion ────────────────────────────────────────────

registerHandler('pages.reorderRegion', (state, payload) => {
  const { pageId, key, targetIndex } = payload as { pageId: string; key: string; targetIndex: number };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  if (!page.regions) return { rebuildComponentTree: true };

  const regions = page.regions as any[];
  const fromIndex = regions.findIndex((r: any) => r.key === key);
  if (fromIndex === -1) throw new Error(`Region not found: ${key}`);

  const [region] = regions.splice(fromIndex, 1);
  const clampedIndex = Math.min(targetIndex, regions.length);
  regions.splice(clampedIndex, 0, region);

  return { rebuildComponentTree: true };
});

// ── pages.setRegionProperty ────────────────────────────────────────

registerHandler('pages.setRegionProperty', (state, payload) => {
  const { pageId, key, property, value } = payload as {
    pageId: string; key: string; property: 'span' | 'start'; value: number | undefined;
  };
  const pages = ensurePages(state);
  const page = findPageById(pages, pageId);
  const region = (page.regions ?? []).find((r: any) => r.key === key);
  if (!region) throw new Error(`Region not found: ${key}`);

  if (value === undefined) {
    delete region[property];
  } else {
    region[property] = value;
  }

  return { rebuildComponentTree: true };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/pages.ts packages/formspec-studio-core/tests/pages-handlers.test.ts
git commit -m "feat: add pages.reorderRegion and pages.setRegionProperty handlers"
```

### Task 8: Set rebuildComponentTree: true on remaining handlers (RED → GREEN)

**Files:**
- Modify: `packages/formspec-studio-core/src/handlers/pages.ts`
- Modify: `packages/formspec-studio-core/tests/pages-handlers.test.ts`

The handlers fixed in Task 5 and added in Task 7 already return `{ rebuildComponentTree: true }`. These remaining handlers still return `false`:

| Handler | Current line |
|---------|-------------|
| `pages.reorderPages` | ~line 101 |
| `pages.setPageProperty` | ~line 111 |
| `pages.assignItem` | ~line 134 |
| `pages.unassignItem` | ~line 146 |

- [ ] **Step 1: Write a test asserting rebuild triggers (RED)**

Add to `tests/pages-handlers.test.ts`:

```typescript
describe('pages.* handlers trigger rebuild', () => {
  it('pages.assignItem returns rebuildComponentTree: true', () => {
    const project = createProject();
    project.dispatch({ type: 'pages.addPage', payload: { title: 'P' } });
    const pageId = (project.theme.pages as any[])[0].id;

    const result = project.dispatch({
      type: 'pages.assignItem',
      payload: { pageId, key: 'name' },
    });

    expect(result.rebuildComponentTree).toBe(true);
  });
});
```

Run: `cd packages/formspec-studio-core && npx vitest run tests/pages-handlers.test.ts`
Expected: FAIL — `pages.assignItem` currently returns `{ rebuildComponentTree: false }`

- [ ] **Step 2: Change all remaining `rebuildComponentTree: false` to `true`**

Find and replace in `handlers/pages.ts`: every remaining instance of `rebuildComponentTree: false` → `rebuildComponentTree: true`.

- [ ] **Step 3: Run full test suite to verify the new test passes and no regressions**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: All tests PASS (rebuild now fires more often, but still generates a flat Stack — harmless until Task 10)

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/pages.ts packages/formspec-studio-core/tests/pages-handlers.test.ts
git commit -m "fix: all pages.* handlers trigger component tree rebuild"
```

---

## Chunk 3: Extend _rebuildComponentTree() for page-aware generation

### Task 9: Write tests for page-aware component tree (RED)

**Files:**
- Create: `packages/formspec-studio-core/tests/page-aware-rebuild.test.ts`

- [ ] **Step 1: Write tests for page-aware component tree generation**

The generated tree must conform to `component.schema.json`:
- `Wizard` children MUST be `Page` (`x-lm.childConstraint: "Page only"`)
- `Tabs` component exists for tabbed navigation (reads tab labels from child Page titles)
- `Page` has `title`, `description`, `children`

```typescript
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('page-aware component tree rebuild', () => {
  it('generates flat Stack when no pages exist', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].bind).toBe('name');
  });

  it('generates flat Stack in single mode even when pages exist (dormant)', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    // Switch to single — pages dormant
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children.every((c: any) => c.component !== 'Page')).toBe(true);
  });

  // component.schema.json: Wizard children MUST be Page (childConstraint: "Page only")
  it('generates Wizard root with Page children in wizard mode', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 2' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[1].id, key: 'email' } });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].component).toBe('Page');
    expect(tree.children[0].title).toBe('Step 1');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].bind).toBe('name');
    expect(tree.children[1].component).toBe('Page');
    expect(tree.children[1].title).toBe('Step 2');
    expect(tree.children[1].children[0].bind).toBe('email');
  });

  // component.schema.json: Tabs component — "Tab labels from child Page titles"
  it('generates Tabs root with Page children in tabs mode', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.setMode', payload: { mode: 'tabs' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Tab 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Tabs');
    const pageNodes = tree.children.filter((c: any) => c.component === 'Page');
    expect(pageNodes).toHaveLength(1);
    expect(pageNodes[0].title).toBe('Tab 1');
    expect(pageNodes[0].children[0].bind).toBe('name');
  });

  // Wizard childConstraint: "Page only" — unassigned items must be wrapped in a Page
  it('wraps unassigned items in an auto-generated Page (Wizard child constraint)', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'extra' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });
    // 'extra' is unassigned

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');
    // All children must be Page (schema constraint)
    expect(tree.children.every((c: any) => c.component === 'Page')).toBe(true);
    // Should have 2 pages: the assigned one + an auto-generated one for unassigned items
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].title).toBe('Step 1');
    expect(tree.children[0].children[0].bind).toBe('name');
    expect(tree.children[1].children[0].bind).toBe('extra');
  });

  it('sets Page title and description from theme page', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'My Step', description: 'Do this' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = (project as any)._state.generatedComponent.tree;
    const page = tree.children.find((c: any) => c.component === 'Page');
    expect(page.title).toBe('My Step');
    expect(page.description).toBe('Do this');
  });

  it('reverts to flat Stack when switching from wizard to single', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    let tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Wizard');

    project.dispatch({ type: 'pages.setMode', payload: { mode: 'single' } });
    tree = (project as any)._state.generatedComponent.tree;
    expect(tree.component).toBe('Stack');
    expect(tree.children.every((c: any) => c.component !== 'Page')).toBe(true);
    expect(tree.children.some((c: any) => c.bind === 'name')).toBe(true);
  });

  it('generates empty Page when no items are assigned to it', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Empty Page' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Full Page' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[1].id, key: 'name' } });

    const tree = (project as any)._state.generatedComponent.tree;
    const assignedPages = tree.children.filter((c: any) => c.component === 'Page');
    const emptyPage = assignedPages.find((c: any) => c.title === 'Empty Page');
    const fullPage = assignedPages.find((c: any) => c.title === 'Full Page');
    expect(emptyPage.children).toEqual([]);
    expect(fullPage.children).toHaveLength(1);
  });

  it('does not rebuild component tree when an authored tree exists', () => {
    const project = createProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          tree: { component: 'Stack', nodeId: 'custom-root', children: [] },
        },
      },
    });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });

    // Authored tree is preserved — rebuild skipped
    const tree = (project as any)._state.component.tree;
    expect(tree.nodeId).toBe('custom-root');
  });

  it('does not generate unassigned Page when all items are assigned', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'pages.addPage', payload: { title: 'Step 1' } });
    const pages = project.theme.pages as any[];
    project.dispatch({ type: 'pages.assignItem', payload: { pageId: pages[0].id, key: 'name' } });

    const tree = (project as any)._state.generatedComponent.tree;
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].title).toBe('Step 1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/page-aware-rebuild.test.ts`
Expected: Tests FAIL — tree is always flat Stack, never Wizard/Tabs/Page

### Task 10: Implement page-aware _rebuildComponentTree() (GREEN)

**Files:**
- Modify: `packages/formspec-studio-core/src/project.ts`

- [ ] **Step 1: Replace the flat-Stack root creation with page-aware distribution**

In `_rebuildComponentTree()` at `project.ts`, find the section (currently ~lines 1900-1903):

```typescript
    const newRoot: TreeNode = { component: 'Stack', nodeId: 'root', children: [] };
    for (const item of this._state.definition.items) {
      newRoot.children!.push(buildNode(item));
    }
```

Replace with:

```typescript
    // Build all item nodes
    const builtNodes: TreeNode[] = this._state.definition.items.map(item => buildNode(item));

    // ── Page-aware distribution ──
    // Reads formPresentation.pageMode (definition.schema.json) and theme.pages
    // (theme.schema.json) to generate schema-conformant component trees:
    //   wizard → Wizard > Page[] (component.schema.json: Wizard childConstraint "Page only")
    //   tabs   → Tabs > Page[]   (component.schema.json: Tabs reads tab labels from Page titles)
    //   single → Stack > items[] (flat, current behavior)
    const def = this._state.definition as any;
    const pageMode: string = def.formPresentation?.pageMode ?? 'single';
    const themePages = (this._state.theme.pages ?? []) as any[];

    let newRoot: TreeNode;

    if (themePages.length > 0 && (pageMode === 'wizard' || pageMode === 'tabs')) {
      // Build key → node lookup (bind for fields/groups, nodeId for display items)
      const nodeByKey = new Map<string, TreeNode>();
      for (const node of builtNodes) {
        const key = node.bind ?? node.nodeId;
        if (key) nodeByKey.set(key, node);
      }

      // Create Page nodes and distribute items by region assignment
      const pageNodes: TreeNode[] = [];
      const assigned = new Set<string>();

      for (const themePage of themePages) {
        const pageNode: TreeNode = {
          component: 'Page',
          nodeId: (themePage as any).id,
          title: (themePage as any).title,
          description: (themePage as any).description,
          children: [],
        };

        for (const region of ((themePage as any).regions ?? []) as any[]) {
          if (region.key && nodeByKey.has(region.key)) {
            pageNode.children!.push(nodeByKey.get(region.key)!);
            assigned.add(region.key);
          }
        }

        pageNodes.push(pageNode);
      }

      // Unassigned items: collect those not placed in any page
      const unassigned = builtNodes.filter(n => {
        const key = n.bind ?? n.nodeId;
        return key && !assigned.has(key);
      });

      // Wizard childConstraint: "Page only" — wrap unassigned in auto-generated Page
      if (pageMode === 'wizard') {
        if (unassigned.length > 0) {
          pageNodes.push({
            component: 'Page',
            nodeId: '_unassigned',
            title: 'Other',
            children: unassigned,
          });
        }
        newRoot = { component: 'Wizard', nodeId: 'root', children: pageNodes };
      } else {
        // Tabs mode: component.schema.json Tabs reads tab labels from child Page titles
        if (unassigned.length > 0) {
          pageNodes.push({
            component: 'Page',
            nodeId: '_unassigned',
            title: 'Other',
            children: unassigned,
          });
        }
        newRoot = { component: 'Tabs', nodeId: 'root', children: pageNodes };
      }
    } else {
      // Flat Stack (current behavior — single mode or no pages)
      newRoot = { component: 'Stack', nodeId: 'root', children: builtNodes };
    }
```

**Known limitation:** Phase 3 (layout wrapper re-insertion) runs after this block and may extract items from Page children back to root level. See "Known Limitations" section. Phase 3 is unmodified.

- [ ] **Step 2: Run page-aware tests**

Run: `cd packages/formspec-studio-core && npx vitest run tests/page-aware-rebuild.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio-core/src/project.ts packages/formspec-studio-core/tests/page-aware-rebuild.test.ts
git commit -m "feat: page-aware component tree rebuild

Wizard > Page[] in wizard mode (schema childConstraint satisfied).
Tabs > Page[] in tabs mode (self-describing, no pageMode cross-ref).
Stack > items[] in single mode.
Unassigned items wrapped in auto-generated Page."
```

### Task 11: Final verification, exports, and consumer documentation

- [ ] **Step 1: Add `ResolvedRegion` to exports**

In `packages/formspec-studio-core/src/index.ts`, update the type export line:

```typescript
export type { ResolvedPageStructure, ResolvedPage, ResolvedRegion, PageDiagnostic } from './page-resolution.js';
```

- [ ] **Step 2: Run full studio-core test suite**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: All tests PASS, zero regressions

- [ ] **Step 3: Type-check studio-core**

Run: `cd packages/formspec-studio-core && npx tsc --noEmit`
Expected: No type errors within studio-core.

- [ ] **Step 4: Search for consumers of removed types and document what needs to change**

Run: `grep -r "controllingTier\|SHADOWED_THEME_PAGES\|wizardSynced\|wizardConfig" packages/ --include="*.ts" --include="*.tsx"`

Known consumers (do NOT fix here — see "Follow-on: Studio UI Changes" section):
- `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx` — uses `controllingTier` in 3 places
- `packages/formspec-studio/src/workspaces/pages/usePageStructure.ts` — imports `ResolvedPageStructure` (type change is compatible, no fix needed)

If any studio-core internal files reference removed types, fix those here.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/index.ts
git commit -m "feat: export ResolvedRegion type, complete ADR-0039 studio-core changes"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | New types + stub | `page-resolution.ts` |
| 2 | Resolution tests (RED) | `page-resolution.test.ts` |
| 3 | Resolution impl (GREEN) | `page-resolution.ts` |
| 4 | Non-destructive handler tests (RED) | `pages-handlers.test.ts` |
| 5 | Fix setMode, deletePage, addPage (GREEN) | `handlers/pages.ts` |
| 6 | Fix autoGenerate + attach-to-preceding | `handlers/pages.ts`, `pages-handlers.test.ts` |
| 7 | New handlers: reorderRegion, setRegionProperty | `handlers/pages.ts`, `pages-handlers.test.ts` |
| 8 | rebuildComponentTree: true on all handlers (RED → GREEN) | `handlers/pages.ts`, `pages-handlers.test.ts` |
| 9 | Page-aware rebuild tests (RED) | `page-aware-rebuild.test.ts` |
| 10 | Page-aware _rebuildComponentTree (GREEN) | `project.ts` |
| 11 | Final verification, exports, consumer docs | `index.ts` |

### Schema alignment verified
- `Wizard` children are all `Page` (childConstraint satisfied)
- `Tabs` used for tabs mode (self-describing tree, no `pageMode` cross-ref needed)
- `Page` nodes carry `title` and `description` per component.schema.json
- `Region.span` defaults to 12 per theme.schema.json
- `Presentation.layout.page` path matches definition.schema.json
- `wizardConfig` removed — `showProgress`/`allowSkip` are Wizard component props, not resolution concerns

### Known limitations (deferred)
- Layout wrappers + page distribution interaction (Phase 3 is not page-aware)

### Required follow-on (out of scope)
- `PagesTab.tsx`: Remove `TierStatusBanner`, `controllingTier` guards, read-only Wizard branch
- Unassigned items UI (drag-and-drop assignment using `unassignedItems` / `itemPageMap`)
- Authored tree + theme.pages coexistence diagnostic
