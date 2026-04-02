# Screener Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-bones ScreenerSection (116 lines, read-only) with a full screener authoring UI: question CRUD with expand/collapse cards, route CRUD with ordered list + fallback pinning + raw FEL editing, and spec compliance fixes.

**Architecture:** Three-phase approach. Phase A fixes the root domino (presence-based screener semantics + `destination`→`target` rename) across all packages. Phase B builds ScreenerAuthoring as the ManageView full editing surface following the OptionSets/DataSources card pattern. Phase C splits the sidebar component into a read-only ScreenerSummary. Each phase produces working, testable software.

**Tech Stack:** React 19, Tailwind CSS, Vitest + Testing Library, existing studio-core Project helpers + formspec-core handlers.

**Design doc:** `thoughts/studio/2026-03-30-screener-authoring-design.md`

---

## File Map

### Phase A: Spec Compliance (modify only)

| File | Change |
|------|--------|
| `packages/formspec-types/src/index.ts:105-110` | Remove `enabled?: boolean` from `FormScreener` |
| `packages/formspec-core/src/handlers/definition-screener.ts` | `setScreener(false)` deletes screener object; `getEnabledScreener` → presence check |
| `packages/formspec-core/src/queries/statistics.ts:46` | Simplify `screenerActive` to `Boolean(screener)` |
| `packages/formspec-webcomponent/src/rendering/screener.ts:138-141` | `hasActiveScreener` — remove `enabled` check |
| `packages/formspec-react/src/renderer.tsx:182` | Remove `enabled` check |
| `packages/formspec-core/tests/definition-screener.test.ts` | Rewrite `setScreener` tests for presence semantics |
| `packages/formspec-studio-core/tests/project-methods.test.ts` | Update screener helper tests |
| `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx` | Fix fixtures (`enabled`, `destination`) |
| `packages/formspec-studio/tests/workspaces/editor/manage-view.test.tsx:138-162` | Fix fixture (`enabled`, `destination` → `target`) |
| `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx` | Fix local interfaces: remove `enabled`, rename `destination`→`target` |

### Phase B: ScreenerAuthoring (ManageView surface)

| File | Change |
|------|--------|
| **Create:** `packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx` | Main orchestrator: presence toggle, questions section, routes section |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/ScreenerToggle.tsx` | Create/remove screener with confirmation |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/ScreenerQuestions.tsx` | Question list with empty state, add form, and cards |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/QuestionCard.tsx` | Expand/collapse card for one screening question |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/ScreenerRoutes.tsx` | Route list with info bar, cards, fallback, and add button |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/RouteCard.tsx` | Expand/collapse card for one routing rule |
| **Create:** `packages/formspec-studio/src/workspaces/editor/screener/FallbackRoute.tsx` | Pinned fallback route (distinct styling, edit target/message only) |
| **Modify:** `packages/formspec-studio/src/workspaces/editor/ManageView.tsx:12,186` | Import ScreenerAuthoring instead of ScreenerSection |
| **Create:** `packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx` | Integration tests for the full authoring surface |

### Phase C: Sidebar Summary

| File | Change |
|------|--------|
| **Create:** `packages/formspec-studio/src/components/blueprint/ScreenerSummary.tsx` | Read-only sidebar: "Active \| N questions, M routes" or "Not configured" |
| **Modify:** `packages/formspec-studio/src/components/Shell.tsx:27,50` | Import ScreenerSummary instead of ScreenerSection |
| **Modify:** `packages/formspec-studio/src/components/Blueprint.tsx:35` | Update countFn to show question+route count |
| **Delete:** `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx` | Replaced by ScreenerAuthoring + ScreenerSummary |
| **Rewrite:** `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx` | Rename to `screener-summary.test.tsx`, test new component |

---

## Task 1: Fix `enabled` property in formspec-types

**Files:**
- Modify: `packages/formspec-types/src/index.ts:99-110`
- Verify: `npm run build` in formspec-types (downstream packages depend on this type)

- [ ] **Step 1: Read the current FormScreener type**

The type at line 105-110 adds `enabled?: boolean` to the generated Screener type. This property is not in the schema (`additionalProperties: false`). Remove it.

- [ ] **Step 2: Remove `enabled` from FormScreener**

```ts
// BEFORE (lines 99-110):
// ─── Augmented Screener type ──────────────────────────────────────────
// The generated Screener requires routes as a non-empty tuple [Route, ...Route[]]
// per the schema's minItems: 1 constraint. During authoring, a screener starts
// with empty routes. The `enabled` flag is an authoring-layer soft-delete
// not present in the schema.

export type FormScreener = Omit<GeneratedScreener, 'items' | 'routes'> & {
  items: FormItem[];
  routes: Route[];
  binds?: FormBind[];
  enabled?: boolean;
};

// AFTER:
// ─── Augmented Screener type ──────────────────────────────────────────
// The generated Screener requires routes as a non-empty tuple [Route, ...Route[]]
// per the schema's minItems: 1 constraint. During authoring, a screener starts
// with empty routes before the first route is added.

export type FormScreener = Omit<GeneratedScreener, 'items' | 'routes'> & {
  items: FormItem[];
  routes: Route[];
  binds?: FormBind[];
};
```

- [ ] **Step 3: Build formspec-types and check downstream compilation**

Run: `cd packages/formspec-types && npx tsc --noEmit`

Expected: Any files referencing `screener.enabled` will now show type errors. This is intentional — we fix those files in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-types/src/index.ts
git commit -m "fix(types): remove non-schema enabled property from FormScreener"
```

---

## Task 2: Fix handler — presence-based screener semantics

**Files:**
- Modify: `packages/formspec-core/src/handlers/definition-screener.ts`
- Test: `packages/formspec-core/tests/definition-screener.test.ts`

- [ ] **Step 1: Rewrite the `setScreener` tests for presence-based semantics**

The key behavioral changes:
- `setScreener({ enabled: false })` now **deletes** `definition.screener` (was: sets `enabled: false`)
- `setScreener({ enabled: true })` still creates `{ items: [], routes: [] }` if absent (unchanged)
- No more "preserves data when disabled" — disabling = deletion
- No more "re-enables without losing data" — re-enabling creates fresh empty screener
- Mutations on absent screener throw "Screener is not enabled"

```ts
// Replace the first three tests in describe('definition.setScreener'):

describe('definition.setScreener', () => {
  it('creates an empty screener when enabled', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(project.definition.screener).toBeDefined();
    expect(project.definition.screener!.items).toEqual([]);
    expect(project.definition.screener!.routes).toEqual([]);
  });

  it('deletes the screener object when disabled', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });

    expect(project.definition.screener).toBeUndefined();
  });

  it('re-enabling after disable creates a fresh empty screener', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(project.definition.screener).toBeDefined();
    expect(project.definition.screener!.items).toEqual([]);
  });

  it('is a no-op when enabling an already active screener', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    // Should NOT wipe existing data
    expect(project.definition.screener!.items).toHaveLength(1);
  });
});
```

Also update the disabled-mutation guard test in `describe('definition.addScreenerItem')`:

```ts
  it('rejects mutations when no screener exists', () => {
    const project = createRawProject();
    // No screener at all — should throw
    expect(() => {
      project.dispatch({
        type: 'definition.addScreenerItem',
        payload: { type: 'field', key: 'age', dataType: 'integer' },
      });
    }).toThrow(/not enabled/i);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd packages/formspec-core && npx vitest run tests/definition-screener.test.ts 2>&1 | tail -20`

Expected: The "deletes the screener object when disabled" test fails (handler still writes `enabled: false`). The "re-enabling after disable" test fails (handler preserves old data).

- [ ] **Step 3: Fix the handler**

In `packages/formspec-core/src/handlers/definition-screener.ts`:

```ts
// BEFORE getEnabledScreener (line 26-32):
function getEnabledScreener(state: { definition: FormDefinition }) {
  const screener = state.definition.screener;
  if (!screener || screener.enabled === false) {
    throw new Error('Screener is not enabled');
  }
  return screener;
}

// AFTER:
function getEnabledScreener(state: { definition: FormDefinition }) {
  const screener = state.definition.screener;
  if (!screener) {
    throw new Error('Screener is not enabled');
  }
  return screener;
}

// BEFORE 'definition.setScreener' handler (line 36-51):
  'definition.setScreener': (state, payload) => {
    const { enabled } = payload as { enabled: boolean };
    if (enabled) {
      if (!state.definition.screener) {
        state.definition.screener = { items: [], routes: [] };
      }
      delete state.definition.screener.enabled;
    } else {
      if (state.definition.screener) {
        state.definition.screener.enabled = false;
      }
    }
    return { rebuildComponentTree: false };
  },

// AFTER:
  'definition.setScreener': (state, payload) => {
    const { enabled } = payload as { enabled: boolean };
    if (enabled) {
      if (!state.definition.screener) {
        state.definition.screener = { items: [], routes: [] };
      }
    } else {
      delete state.definition.screener;
    }
    return { rebuildComponentTree: false };
  },
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd packages/formspec-core && npx vitest run tests/definition-screener.test.ts 2>&1 | tail -20`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/src/handlers/definition-screener.ts packages/formspec-core/tests/definition-screener.test.ts
git commit -m "fix(core): screener uses presence-based semantics per schema additionalProperties:false"
```

---

## Task 3: Fix `enabled` checks in statistics, webcomponent, react renderer

**Files:**
- Modify: `packages/formspec-core/src/queries/statistics.ts:45-46`
- Modify: `packages/formspec-webcomponent/src/rendering/screener.ts:138-141`
- Modify: `packages/formspec-react/src/renderer.tsx:182`

These are all one-line fixes — the `enabled !== false` guard becomes a simple presence check.

- [ ] **Step 1: Fix statistics.ts**

```ts
// BEFORE (line 45-46):
  const screener = def.screener;
  const screenerActive = screener && screener.enabled !== false;

// AFTER:
  const screener = def.screener;
  const screenerActive = Boolean(screener);
```

- [ ] **Step 2: Fix webcomponent hasActiveScreener**

```ts
// BEFORE (lines 138-141):
export function hasActiveScreener(definition: any): boolean {
    const screener = definition?.screener;
    return screener?.enabled !== false && Array.isArray(screener?.items) && screener.items.length > 0;
}

// AFTER:
export function hasActiveScreener(definition: any): boolean {
    const screener = definition?.screener;
    return Boolean(screener) && Array.isArray(screener?.items) && screener.items.length > 0;
}
```

- [ ] **Step 3: Fix React renderer**

At line 182, change `screener?.enabled !== false &&` to just remove that condition (the surrounding check `screener &&` already handles presence).

Read the file around line 182 to see the full context before editing.

- [ ] **Step 4: Run affected test suites**

Run: `cd packages/formspec-core && npx vitest run tests/queries.test.ts 2>&1 | tail -10`

Expected: PASS (the queries test creates screeners with `setScreener(true)`, not with `enabled: false`).

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-core/src/queries/statistics.ts packages/formspec-webcomponent/src/rendering/screener.ts packages/formspec-react/src/renderer.tsx
git commit -m "fix: remove non-schema enabled checks from statistics, webcomponent, react renderer"
```

---

## Task 4: Fix ScreenerSection interfaces and test fixtures

**Files:**
- Modify: `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx`
- Modify: `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx`
- Modify: `packages/formspec-studio/tests/workspaces/editor/manage-view.test.tsx:138-162`
- Modify: `packages/formspec-studio/tests/components/blueprint.test.tsx:78-86` (also has `enabled` + `destination`)

- [ ] **Step 1: Fix ScreenerSection.tsx local interfaces and logic**

Three changes:
1. Remove `enabled` from `Screener` interface (line 20)
2. Rename `destination` to `target` in `Route` interface (line 16) and template (line 106)
3. Simplify `isEnabled` check (line 31) to `Boolean(screener)`

```ts
// BEFORE interfaces (lines 14-23):
interface Route {
  condition: string;
  destination: string;
}

interface Screener {
  enabled?: boolean;
  items?: ScreenerItem[];
  routes?: Route[];
}

// AFTER:
interface Route {
  condition: string;
  target: string;
}

interface Screener {
  items?: ScreenerItem[];
  routes?: Route[];
}

// BEFORE isEnabled (line 31):
  const isEnabled = Boolean(screener) && screener?.enabled !== false;
// AFTER:
  const isEnabled = Boolean(screener);

// BEFORE route target display (line 106):
  {'\u2192'} <span className="text-ink">{route.destination}</span>
// AFTER:
  {'\u2192'} <span className="text-ink">{route.target}</span>
```

- [ ] **Step 2: Fix screener-section.test.tsx fixture**

```ts
// BEFORE (lines 14-23):
  screener: {
    enabled: true,
    items: [
      { key: 'age', type: 'field', dataType: 'integer' },
    ],
    routes: [
      { condition: '$age >= 18', destination: 'main' },
      { condition: 'true', destination: 'ineligible' },
    ],
  },

// AFTER:
  screener: {
    items: [
      { key: 'age', type: 'field', dataType: 'integer' },
    ],
    routes: [
      { condition: '$age >= 18', target: 'main' },
      { condition: 'true', target: 'ineligible' },
    ],
  },
```

Also update the test assertion at line 51 that checks for `main` — it should still find it since `target` is now rendered.

- [ ] **Step 3: Fix manage-view.test.tsx fixture**

```ts
// BEFORE (lines 140-148):
      screener: {
        enabled: true,
        items: [
          { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
        ],
        routes: [
          { condition: '$age >= 18', destination: 'adult-form' },
          { condition: 'true', destination: 'rejected' },
        ],
      },

// AFTER:
      screener: {
        items: [
          { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
        ],
        routes: [
          { condition: '$age >= 18', target: 'adult-form' },
          { condition: 'true', target: 'rejected' },
        ],
      },
```

Also update any assertion that looked for "Enabled" text — it will now need to match whatever the component renders for active state.

- [ ] **Step 4: Fix blueprint.test.tsx fixture**

The `blueprint.test.tsx` file also contains a screener fixture with `enabled: true` and `destination`. Apply the same fixes: remove `enabled`, rename `destination` to `target`.

- [ ] **Step 5: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint/screener-section.test.tsx tests/components/blueprint.test.tsx tests/workspaces/editor/manage-view.test.tsx 2>&1 | tail -20`

Expected: All PASS.

- [ ] **Step 6: Run full monorepo build check**

Run: `npm run build 2>&1 | tail -20`

Expected: All packages compile. This confirms the `enabled` removal doesn't break any downstream type references.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx packages/formspec-studio/tests/workspaces/editor/manage-view.test.tsx
git commit -m "fix(studio): remove enabled property, rename destination to target in screener UI"
```

---

## Task 5: Build ScreenerAuthoring orchestrator

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx`
- Create: `packages/formspec-studio/src/workspaces/editor/screener/ScreenerToggle.tsx`
- Create: `packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx`
- Modify: `packages/formspec-studio/src/workspaces/editor/ManageView.tsx:12,186`

The orchestrator composes ScreenerToggle + ScreenerQuestions + ScreenerRoutes. In this task we build the toggle and the outer shell. Questions and routes come in subsequent tasks.

- [ ] **Step 1: Write failing test for ScreenerAuthoring**

Create `packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx`:

```tsx
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerAuthoring } from '../../../src/workspaces/editor/ScreenerAuthoring';

function renderScreener(def?: any) {
  const base = { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] };
  const project = createProject({ seed: { definition: def || base } });
  return { project, ...render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ScreenerAuthoring />
      </SelectionProvider>
    </ProjectProvider>,
  ) };
}

describe('ScreenerAuthoring', () => {
  describe('toggle', () => {
    it('shows empty state when no screener exists', () => {
      renderScreener();
      expect(screen.getByText(/set up screening/i)).toBeInTheDocument();
    });

    it('creates a screener when setup button is clicked', async () => {
      const { project } = renderScreener();
      await act(async () => {
        screen.getByRole('button', { name: /set up screening/i }).click();
      });
      expect(project.state.definition.screener).toBeDefined();
    });

    it('shows active authoring surface when screener exists', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });
      expect(screen.getByText(/screening questions/i)).toBeInTheDocument();
      expect(screen.getByText(/routing rules/i)).toBeInTheDocument();
    });

    it('removes screener with confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { project } = renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });

      await act(async () => {
        screen.getByRole('button', { name: /remove screener/i }).click();
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(project.state.definition.screener).toBeUndefined();
      confirmSpy.mockRestore();
    });

    it('does not remove screener when confirmation is cancelled', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { project } = renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });

      await act(async () => {
        screen.getByRole('button', { name: /remove screener/i }).click();
      });

      expect(project.state.definition.screener).toBeDefined();
      confirmSpy.mockRestore();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 3: Build ScreenerToggle**

Create `packages/formspec-studio/src/workspaces/editor/screener/ScreenerToggle.tsx`:

```tsx
/** @filedesc Presence toggle for the screener — creates or removes the screener object. */
import { useProject } from '../../../state/useProject';

interface ScreenerToggleProps {
  isActive: boolean;
  questionCount: number;
  routeCount: number;
}

export function ScreenerToggle({ isActive, questionCount, routeCount }: ScreenerToggleProps) {
  const project = useProject();

  if (!isActive) {
    return (
      <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-muted font-medium mb-2">No screening configured.</p>
        <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px] mb-4">
          Respondents answer screening questions before the main form.
          Answers are used for routing only and are not saved.
        </p>
        <button
          type="button"
          onClick={() => project.setScreener(true)}
          className="text-[11px] font-bold text-accent hover:text-accent-hover uppercase tracking-wider transition-colors"
          aria-label="Set up screening"
        >
          Set up screening
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-sm border font-ui bg-green/10 text-green border-green/20 text-xs px-1.5 py-0">Active</span>
        <span className="text-[12px] text-muted">
          {questionCount} question{questionCount !== 1 ? 's' : ''}, {routeCount} route{routeCount !== 1 ? 's' : ''}
        </span>
      </div>
      <button
        type="button"
        aria-label="Remove screener"
        onClick={() => {
          if (window.confirm('This will remove all screening questions and routing rules.')) {
            project.setScreener(false);
          }
        }}
        className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
      >
        Remove
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Build ScreenerAuthoring orchestrator**

Create `packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx`:

```tsx
/** @filedesc Full screener authoring surface for ManageView — questions, routes, and toggle. */
import { useDefinition } from '../../state/useDefinition';
import { ScreenerToggle } from './screener/ScreenerToggle';

export function ScreenerAuthoring() {
  const definition = useDefinition();
  const screener = definition?.screener;
  const isActive = Boolean(screener);
  const questionCount = screener?.items?.length ?? 0;
  const routeCount = screener?.routes?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted italic">
        Respondents answer these questions before the main form. Answers are used for routing only and are not saved.
      </div>

      <ScreenerToggle isActive={isActive} questionCount={questionCount} routeCount={routeCount} />

      {isActive && (
        <>
          {/* Screening Questions — Task 6 */}
          <section>
            <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">Screening Questions</h4>
            <p className="text-[12px] text-muted italic">Questions section coming in next task.</p>
          </section>

          {/* Routing Rules — Task 7 */}
          <section>
            <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">Routing Rules</h4>
            <p className="text-[12px] text-muted italic">Routes section coming in next task.</p>
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire into ManageView**

In `packages/formspec-studio/src/workspaces/editor/ManageView.tsx`:

```ts
// BEFORE (line 12):
import { ScreenerSection } from '../../components/blueprint/ScreenerSection';
// AFTER:
import { ScreenerAuthoring } from './ScreenerAuthoring';

// BEFORE (line 186):
          <ScreenerSection />
// AFTER:
          <ScreenerAuthoring />
```

- [ ] **Step 6: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx tests/workspaces/editor/manage-view.test.tsx 2>&1 | tail -20`

Expected: All PASS. The manage-view test for "renders screener section with routes and items" may need updating since it looked for "Enabled" text — it should now look for "Active" or the question/route content.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx packages/formspec-studio/src/workspaces/editor/screener/ScreenerToggle.tsx packages/formspec-studio/src/workspaces/editor/ManageView.tsx packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx
git commit -m "feat(studio): add ScreenerAuthoring orchestrator with presence toggle"
```

---

## Task 6: Build ScreenerQuestions — question CRUD with card pattern

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/screener/ScreenerQuestions.tsx`
- Create: `packages/formspec-studio/src/workspaces/editor/screener/QuestionCard.tsx`
- Modify: `packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx` (wire in)
- Test: `packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx` (add question tests)

- [ ] **Step 1: Write failing tests for question CRUD**

Add to the existing test file:

```tsx
describe('ScreenerAuthoring — questions', () => {
  const withScreener = {
    $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
    screener: {
      items: [
        { key: 'screen_age', type: 'field', dataType: 'boolean', label: 'Are you 18 or older?' },
      ],
      routes: [{ condition: 'true', target: 'urn:default' }],
    },
  };

  it('shows existing questions', () => {
    renderScreener(withScreener);
    expect(screen.getByText('Are you 18 or older?')).toBeInTheDocument();
  });

  it('shows add question button', () => {
    renderScreener(withScreener);
    expect(screen.getByRole('button', { name: /add question/i })).toBeInTheDocument();
  });

  it('opens inline add form when add is clicked', async () => {
    renderScreener(withScreener);
    await act(async () => {
      screen.getByRole('button', { name: /add question/i }).click();
    });
    expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument();
  });

  it('adds a question with the inline form', async () => {
    const { project } = renderScreener(withScreener);
    await act(async () => {
      screen.getByRole('button', { name: /add question/i }).click();
    });

    const labelInput = screen.getByPlaceholderText(/label/i);
    await act(async () => {
      fireEvent.change(labelInput, { target: { value: 'Annual income?' } });
    });

    await act(async () => {
      screen.getByRole('button', { name: /^add$/i }).click();
    });

    const items = project.state.definition.screener?.items ?? [];
    expect(items).toHaveLength(2);
    expect(items[1].label).toBe('Annual income?');
  });

  it('toggles required checkbox dispatching a screener bind', async () => {
    const { project } = renderScreener(withScreener);

    // Expand the card
    await act(async () => {
      screen.getByText('Are you 18 or older?').click();
    });

    const requiredCheckbox = screen.getByRole('checkbox', { name: /required/i });
    await act(async () => {
      fireEvent.click(requiredCheckbox);
    });

    const binds = project.state.definition.screener?.binds ?? [];
    expect(binds.some((b: any) => b.path === 'screen_age' && b.required)).toBe(true);
  });

  it('deletes a question with confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { project } = renderScreener(withScreener);

    // Expand the card first
    await act(async () => {
      screen.getByText('Are you 18 or older?').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /delete/i }).click();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(project.state.definition.screener?.items).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('shows empty state when no questions exist', () => {
    renderScreener({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
    });
    expect(screen.getByText(/no screening questions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx 2>&1 | tail -20`

Expected: FAIL — question-related text not found.

- [ ] **Step 3: Build QuestionCard**

Create `packages/formspec-studio/src/workspaces/editor/screener/QuestionCard.tsx`:

The card follows the OptionSets expand/collapse pattern. Collapsed shows: icon + label + key + type + required badge. Expanded shows: label input, help text input, required checkbox, type display, delete button. For choice type: inline options editing (defer to future task if complex).

Key behaviors:
- Click header to expand/collapse
- `expandedKey` is managed by parent (accordion — one at a time)
- Delete calls `project.removeScreenField(key)` with `window.confirm()`
- Label edit calls `project.updateScreenRoute` — wait, there's no `updateScreenField` helper. The handler `definition.addScreenerItem` doesn't support updates. We need to use the handler approach: delete + re-add, or add a `setScreenerItemProperty` if it exists.

**Check:** The handler layer has `addScreenerItem` and `deleteScreenerItem` but no `updateScreenerItem`. For label edits, we'll need to dispatch `setRouteProperty`-style commands. But there's no such handler for screener items. The simplest approach for this PR: delete and re-add the item when editing. Or: add a `definition.setScreenerItemProperty` handler.

**Decision:** For step 1-2 scope (functional CRUD), inline label editing can use a direct mutation pattern: read the item, modify it, delete + re-add. This is a known limitation — a proper `setScreenerItemProperty` handler is a follow-up.

Actually, looking at the formspec-core handler for items, the simplest path is: the screener items array is directly mutatable through the handler dispatch pattern. Let's add a minimal `definition.setScreenerItemProperty` handler alongside the existing ones.

- [ ] **Step 4: Add `definition.setScreenerItemProperty` and `definition.reorderScreenerItem` handlers**

In `packages/formspec-core/src/handlers/definition-screener.ts`, add both handlers:

```ts
  'definition.setScreenerItemProperty': (state, payload) => {
    const ALLOWED = new Set(['label', 'helpText', 'dataType', 'options', 'presentation']);
    const { key, property, value } = payload as { key: string; property: string; value: unknown };
    if (!ALLOWED.has(property)) throw new Error(`Cannot set screener item property: ${property}`);
    const screener = getEnabledScreener(state);
    const item = screener.items.find(it => it.key === key);
    if (!item) throw new Error(`Screener item not found: ${key}`);
    (item as any)[property] = value;
    return { rebuildComponentTree: false };
  },

  'definition.reorderScreenerItem': (state, payload) => {
    const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
    const screener = getEnabledScreener(state);
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= screener.items.length) return { rebuildComponentTree: false };
    [screener.items[index], screener.items[targetIdx]] = [screener.items[targetIdx], screener.items[index]];
    return { rebuildComponentTree: false };
  },
```

Add tests in `definition-screener.test.ts`:

```ts
describe('definition.setScreenerItemProperty', () => {
  it('updates a property on a screener item', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'age', label: 'Age' } });

    project.dispatch({
      type: 'definition.setScreenerItemProperty',
      payload: { key: 'age', property: 'label', value: 'Your age' },
    });

    expect(project.definition.screener!.items[0].label).toBe('Your age');
  });

  it('throws for unknown key', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(() => {
      project.dispatch({
        type: 'definition.setScreenerItemProperty',
        payload: { key: 'nope', property: 'label', value: 'x' },
      });
    }).toThrow(/not found/i);
  });
});

describe('definition.reorderScreenerItem', () => {
  it('swaps items by direction', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'a' } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'b' } });

    project.dispatch({ type: 'definition.reorderScreenerItem', payload: { index: 0, direction: 'down' } });

    expect(project.definition.screener!.items[0].key).toBe('b');
    expect(project.definition.screener!.items[1].key).toBe('a');
  });

  it('is a no-op at boundaries', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'a' } });

    project.dispatch({ type: 'definition.reorderScreenerItem', payload: { index: 0, direction: 'up' } });
    expect(project.definition.screener!.items[0].key).toBe('a');
  });
});
```

- [ ] **Step 5: Build ScreenerQuestions component**

Create `packages/formspec-studio/src/workspaces/editor/screener/ScreenerQuestions.tsx`.

Follow the OptionSets pattern:
- `expandedKey` state (accordion)
- `isAdding` state for inline form
- Empty state with dashed border
- "Add Question" button that shows inline form
- Inline form: type selector dropdown + label input + Cancel/Add buttons
- Key auto-generated from label via `sanitizeIdentifier` with `screen_` prefix
- List of `QuestionCard` components

The inline add form should offer the 6 types from the design doc:

| Display | type alias |
|---------|-----------|
| Yes / No | boolean |
| Choose One | choice |
| Number | integer |
| Dollar Amount | money |
| Short Text | string |
| Date | date |

- [ ] **Step 6: Wire ScreenerQuestions into ScreenerAuthoring**

Replace the placeholder `<section>` for questions with `<ScreenerQuestions />`.

- [ ] **Step 7: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx 2>&1 | tail -20`

Expected: All question tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-core/src/handlers/definition-screener.ts packages/formspec-core/tests/definition-screener.test.ts packages/formspec-studio/src/workspaces/editor/screener/ScreenerQuestions.tsx packages/formspec-studio/src/workspaces/editor/screener/QuestionCard.tsx packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx
git commit -m "feat(studio): add ScreenerQuestions with card-based CRUD and inline add form"
```

---

## Task 7: Build ScreenerRoutes — route CRUD with ordering and fallback

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/screener/ScreenerRoutes.tsx`
- Create: `packages/formspec-studio/src/workspaces/editor/screener/RouteCard.tsx`
- Create: `packages/formspec-studio/src/workspaces/editor/screener/FallbackRoute.tsx`
- Modify: `packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx` (wire in)
- Test: `packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx` (add route tests)

- [ ] **Step 1: Write failing tests for route CRUD**

Add to the test file:

```tsx
describe('ScreenerAuthoring — routes', () => {
  const withRoutes = {
    $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
    screener: {
      items: [{ key: 'screen_age', type: 'field', dataType: 'boolean', label: 'Are you 18+?' }],
      routes: [
        { condition: '$screen_age = true', target: 'urn:adult-form', label: 'Adults' },
        { condition: 'true', target: 'urn:default', label: 'Everyone else' },
      ],
    },
  };

  it('shows the info bar about first-match-wins', () => {
    renderScreener(withRoutes);
    expect(screen.getByText(/first matching rule wins/i)).toBeInTheDocument();
  });

  it('renders numbered route cards', () => {
    renderScreener(withRoutes);
    expect(screen.getByText('Adults')).toBeInTheDocument();
  });

  it('renders the fallback route distinctly', () => {
    renderScreener(withRoutes);
    expect(screen.getByText(/everyone else/i)).toBeInTheDocument();
  });

  it('shows add rule button', () => {
    renderScreener(withRoutes);
    expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
  });

  it('adds a new route above the fallback', async () => {
    const { project } = renderScreener(withRoutes);
    await act(async () => {
      screen.getByRole('button', { name: /add rule/i }).click();
    });

    const routes = project.state.definition.screener?.routes ?? [];
    // New route inserted before fallback (last)
    expect(routes.length).toBe(3);
    // Fallback should still be last
    expect(routes[routes.length - 1].condition).toBe('true');
  });

  it('deletes a non-fallback route', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { project } = renderScreener(withRoutes);

    // Expand the first route card
    await act(async () => {
      screen.getByText('Adults').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /delete.*route/i }).click();
    });

    expect(project.state.definition.screener?.routes).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  it('does not show delete on fallback route', () => {
    renderScreener(withRoutes);
    // The fallback card should not have a delete button
    // We test this by checking the fallback section specifically
    const fallback = screen.getByTestId('fallback-route');
    expect(within(fallback).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('edits a route condition and target via inline expression', async () => {
    const { project } = renderScreener(withRoutes);

    // Expand the first route card
    await act(async () => {
      screen.getByText('Adults').click();
    });

    // Edit target — find the target input and change it
    const targetInput = screen.getByDisplayValue('urn:adult-form');
    await act(async () => {
      fireEvent.change(targetInput, { target: { value: 'urn:new-target' } });
      fireEvent.blur(targetInput);
    });

    expect(project.state.definition.screener?.routes[0].target).toBe('urn:new-target');
  });

  it('shows up/down reorder buttons on non-fallback routes', () => {
    const threeRoutes = {
      ...withRoutes,
      screener: {
        ...withRoutes.screener,
        routes: [
          { condition: '$a', target: 'urn:a', label: 'Route A' },
          { condition: '$b', target: 'urn:b', label: 'Route B' },
          { condition: 'true', target: 'urn:default', label: 'Default' },
        ],
      },
    };
    renderScreener(threeRoutes);

    // Expand route A to see reorder controls
    // The up/down buttons should be visible in the route cards
    expect(screen.getAllByRole('button', { name: /move.*up/i }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx --grep "routes" 2>&1 | tail -20`

Expected: FAIL.

- [ ] **Step 3: Build RouteCard**

Create `packages/formspec-studio/src/workspaces/editor/screener/RouteCard.tsx`:

Each route card follows the expand/collapse pattern:
- **Collapsed:** `[number badge] IF [condition preview] → [target] [message preview]`
- **Expanded:** label input, condition via `InlineExpression`, target URI input, message textarea, up/down/delete buttons
- Number badge: amber circle with route index + 1
- Condition preview: FEL expression in `code` styling, or label if available

Key props: `route`, `index`, `isExpanded`, `onToggle`, `isFirst`, `isLast`, `onDelete`, `onMoveUp`, `onMoveDown`.

- [ ] **Step 4: Build FallbackRoute**

Create `packages/formspec-studio/src/workspaces/editor/screener/FallbackRoute.tsx`:

Visually distinct from regular routes:
- `bg-amber/5 border-amber/20` background
- Label: "Everyone else" (not the raw `condition: "true"`)
- No delete button, no reorder buttons
- Editable: target URI and message only
- `data-testid="fallback-route"`

- [ ] **Step 5: Build ScreenerRoutes**

Create `packages/formspec-studio/src/workspaces/editor/screener/ScreenerRoutes.tsx`:

Composes:
- Info bar: "(i) Routes are checked in order. The first matching rule wins."
- `expandedIndex` state (accordion)
- List of `RouteCard` for non-fallback routes (all routes where `condition !== 'true'`)
- `FallbackRoute` at the bottom (last route where `condition === 'true'`)
- "Add Rule" button: **dispatches the raw `definition.addRoute` handler directly** (NOT `project.addScreenRoute`) because the helper validates FEL and an empty condition throws `INVALID_FEL`. Use `insertIndex = routes.length - 1` to insert above fallback. New route gets `condition: 'false', target: ''` as placeholder (`false` is a valid FEL boolean literal that clearly communicates "this route doesn't match yet" and prompts the user to set a real condition).
- If no routes exist and user clicks "Add Rule": dispatch two raw `definition.addRoute` commands — a conditional route (`condition: 'false', target: ''`) AND a fallback (`condition: 'true', target: ''`). Use `project.core.dispatch()` for raw handler access.

Reorder calls `project.reorderScreenRoute(index, direction)`. Up/down buttons:
- "Move up" hidden on first route
- "Move down" hidden on last non-fallback route (can't move below fallback)
- Delete hidden when only 1 non-fallback route remains (fallback + 1 = minItems)

- [ ] **Step 6: Wire ScreenerRoutes into ScreenerAuthoring**

Replace the placeholder routes section with `<ScreenerRoutes />`.

- [ ] **Step 7: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/screener-authoring.test.tsx 2>&1 | tail -20`

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/screener/ScreenerRoutes.tsx packages/formspec-studio/src/workspaces/editor/screener/RouteCard.tsx packages/formspec-studio/src/workspaces/editor/screener/FallbackRoute.tsx packages/formspec-studio/src/workspaces/editor/ScreenerAuthoring.tsx packages/formspec-studio/tests/workspaces/editor/screener-authoring.test.tsx
git commit -m "feat(studio): add ScreenerRoutes with route CRUD, ordering, and fallback pinning"
```

---

## Task 8: Build ScreenerSummary for sidebar + cleanup

**Files:**
- Create: `packages/formspec-studio/src/components/blueprint/ScreenerSummary.tsx`
- Modify: `packages/formspec-studio/src/components/Shell.tsx:27,50`
- Modify: `packages/formspec-studio/src/components/Blueprint.tsx:35`
- Rewrite: `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx` → rename to `screener-summary.test.tsx`
- Delete: `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx`

- [ ] **Step 1: Write tests for ScreenerSummary**

Rename `screener-section.test.tsx` to `screener-summary.test.tsx` and rewrite:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerSummary } from '../../../src/components/blueprint/ScreenerSummary';

function renderSummary(def?: any) {
  const base = { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] };
  const project = createProject({ seed: { definition: def || base } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ScreenerSummary />
      </SelectionProvider>
    </ProjectProvider>,
  );
}

describe('ScreenerSummary', () => {
  it('shows not configured when no screener', () => {
    renderSummary();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it('shows active status with counts', () => {
    renderSummary({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      screener: {
        items: [
          { key: 'age', type: 'field', dataType: 'integer' },
          { key: 'income', type: 'field', dataType: 'money' },
        ],
        routes: [
          { condition: '$age >= 18', target: 'urn:adult' },
          { condition: 'true', target: 'urn:default' },
        ],
      },
    });
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/2 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/2 routes/i)).toBeInTheDocument();
  });

  it('shows singular form for 1 question', () => {
    renderSummary({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      screener: {
        items: [{ key: 'age', type: 'field', dataType: 'integer' }],
        routes: [{ condition: 'true', target: 'urn:default' }],
      },
    });
    expect(screen.getByText(/1 question/)).toBeInTheDocument();
    expect(screen.getByText(/1 route/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint/screener-summary.test.tsx 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 3: Build ScreenerSummary**

Create `packages/formspec-studio/src/components/blueprint/ScreenerSummary.tsx`:

```tsx
/** @filedesc Read-only screener summary for the Blueprint sidebar. */
import { useDefinition } from '../../state/useDefinition';
import { Pill } from '../ui/Pill';

export function ScreenerSummary() {
  const definition = useDefinition();
  const screener = definition?.screener;

  if (!screener) {
    return (
      <div className="px-2 py-1 text-[12px] text-muted italic">
        Not configured
      </div>
    );
  }

  const qCount = screener.items?.length ?? 0;
  const rCount = screener.routes?.length ?? 0;

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <div className="flex items-center gap-2">
        <Pill text="Active" color="green" size="sm" />
        <span className="text-[12px] text-muted">
          {qCount} question{qCount !== 1 ? 's' : ''}, {rCount} route{rCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into Shell.tsx**

```ts
// BEFORE (line 27):
import { ScreenerSection } from './blueprint/ScreenerSection';
// AFTER:
import { ScreenerSummary } from './blueprint/ScreenerSummary';

// BEFORE (line 50):
  'Screener': ScreenerSection,
// AFTER:
  'Screener': ScreenerSummary,
```

- [ ] **Step 5: Delete the old ScreenerSection**

Delete `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx` — it is fully replaced by `ScreenerAuthoring` (ManageView) + `ScreenerSummary` (sidebar).

Also delete `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx` — replaced by `screener-summary.test.tsx`.

- [ ] **Step 6: Update Blueprint.tsx countFn and fix blueprint.test.tsx assertion**

The current `countFn` at line 35 only shows route count. For better info, show combined count:

```ts
// BEFORE:
{ name: 'Screener', countFn: (s) => (s.definition.screener as any)?.routes?.length ?? 0, ... }
// AFTER:
{ name: 'Screener', countFn: (s) => {
  const scr = s.definition.screener;
  return scr ? (scr.items?.length ?? 0) + (scr.routes?.length ?? 0) : 0;
}, ... }
```

Also update the assertion in `blueprint.test.tsx` that checks the count badge — it was `'2'` (route count only) and now becomes `items.length + routes.length` based on the fixture data.

- [ ] **Step 7: Run all affected tests**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint/screener-summary.test.tsx tests/workspaces/editor/screener-authoring.test.tsx tests/workspaces/editor/manage-view.test.tsx 2>&1 | tail -20`

Expected: All PASS.

- [ ] **Step 8: Run full build to confirm no broken imports**

Run: `npm run build 2>&1 | tail -20`

Expected: PASS — no remaining imports of `ScreenerSection`.

- [ ] **Step 9: Commit**

```bash
git add packages/formspec-studio/src/components/blueprint/ScreenerSummary.tsx packages/formspec-studio/src/components/Shell.tsx packages/formspec-studio/src/components/Blueprint.tsx packages/formspec-studio/tests/components/blueprint/screener-summary.test.tsx
git rm packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx
git commit -m "feat(studio): add ScreenerSummary sidebar, remove old ScreenerSection"
```

---

## Task 9: Final verification pass

- [ ] **Step 1: Run full test suites**

```bash
cd packages/formspec-core && npx vitest run 2>&1 | tail -5
cd packages/formspec-studio-core && npx vitest run 2>&1 | tail -5
cd packages/formspec-studio && npx vitest run 2>&1 | tail -5
```

Expected: All three suites PASS with zero failures.

- [ ] **Step 2: Run monorepo build**

Run: `npm run build 2>&1 | tail -10`

Expected: Clean build across all packages.

- [ ] **Step 3: Run dep fence check**

Run: `npm run check:deps 2>&1 | tail -5`

Expected: No layer violations — all new files are within `formspec-studio` (layer 6) importing from `formspec-studio-core` (layer 3) and `formspec-core` (layer 2).

- [ ] **Step 4: Verify no `enabled` or `destination` references remain**

```bash
grep -r "\.enabled" packages/formspec-studio/src/workspaces/editor/screener/ packages/formspec-studio/src/components/blueprint/Screener* || echo "Clean"
grep -r "destination" packages/formspec-studio/src/workspaces/editor/screener/ packages/formspec-studio/src/components/blueprint/Screener* || echo "Clean"
```

Expected: "Clean" for both.

- [ ] **Step 5: Commit any final fixups, then squash or rebase if desired**

The branch should now have ~8 clean commits representing the implementation arc.
