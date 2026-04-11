# Studio Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all verified bugs from the studio implementation review — correctness bugs first, then dead-control cleanup, then structural improvements.

**Architecture:** Fixes are organized into three tiers: (1) correctness bugs in the renderer and studio-core that affect end-user or project integrity, (2) dead UI controls that should be deleted, (3) structural improvements to path handling and state management. Each task is independently testable and commitable.

**Tech Stack:** TypeScript, Vitest (studio-core, webcomponent unit tests), Playwright (E2E), React (studio UI), Preact Signals (engine reactivity)

**Source:** `thoughts/formspec-studio/fix-implementation-review-2026-03-12.md` and `thoughts/formspec-studio/fix-implementation-review-addendum-2026-03-12.md`

---

## Chunk 1: Renderer Correctness Bugs

These are the highest-priority fixes. They affect form respondents (not just authors) or corrupt project data.

---

### Task 1: Fix repeat rendering stale indexes after non-tail deletion

The repeat renderer in `emit-node.ts` bakes `instancePrefix` and remove-button `idx` into closures at creation time. When a non-tail instance is removed, the engine shifts indexes but the DOM keeps stale prefixes. Surviving instances edit wrong fields and remove buttons target wrong indexes.

**Fix strategy:** When the repeat count changes, clear the container and rebuild all instances. Less efficient but correct.

**DOM structure note:** In the current code, `container` (the `.formspec-repeat` div) and `addBtn` are both children of `target` — they are siblings, not parent/child. The effect operates on `container`; the add button lives outside it.

**Cleanup note:** Each rebuild calls `emitNode` on children, which registers new effects in `host.cleanupFns`. To prevent memory leaks, the rebuild must track and dispose inner cleanup functions from the prior render pass before rebuilding.

**Files:**

- Modify: `packages/formspec-webcomponent/src/rendering/emit-node.ts:77-121`
- Test: `packages/formspec-webcomponent/tests/rendering/repeat-rekey.test.ts` (create)

**Status update (2026-03-12):** Landed. A focused definition-fallback repeat test now reproduces the real bug by checking shifted input values after middle-instance deletion. The fix fully rebuilds repeat instances on count changes and disposes per-instance cleanup functions between rebuilds.

- [x] **Step 1: Write the failing DOM-level test**

Create `packages/formspec-webcomponent/tests/rendering/repeat-rekey.test.ts`. Use the webcomponent's existing test helper (check `tests/` for `renderFormspec`, `renderWithTree`, or similar):

```ts
import { describe, it, expect } from 'vitest';
import { renderFormspec } from '../helpers/render.js';

describe('repeat DOM re-keying after non-tail deletion', () => {
  it('updates instance prefixes after removing a middle instance', async () => {
    const { element, engine } = await renderFormspec({
      definition: {
        title: 'Repeat Rekey',
        items: [{
          key: 'people',
          type: 'group',
          repeatable: true,
          children: [{ key: 'name', type: 'field', dataType: 'string' }],
        }],
      },
    });

    // Add 3 instances
    engine.addRepeatInstance('people');
    engine.addRepeatInstance('people');
    engine.addRepeatInstance('people');
    await new Promise(r => setTimeout(r, 50));

    // Set values
    engine.setValue('people[0].name', 'Alice');
    engine.setValue('people[1].name', 'Bob');
    engine.setValue('people[2].name', 'Charlie');

    const inputs = element.querySelectorAll('input[name]');
    expect(inputs.length).toBe(3);

    // Remove middle (index 1 — Bob)
    engine.removeRepeatInstance('people', 1);
    await new Promise(r => setTimeout(r, 50));

    // DOM should now have 2 instances with correct bindings
    const updatedInputs = element.querySelectorAll('input[name]');
    expect(updatedInputs.length).toBe(2);

    // The second input should be bound to people[1].name (Charlie, shifted down)
    // not still bound to people[2].name (the old stale prefix)
    const secondInput = updatedInputs[1] as HTMLInputElement;
    expect(secondInput.getAttribute('name')).toContain('people[1]');
  });
});
```

Note: Adapt the import and render helper to match the actual test infrastructure in the webcomponent package.

- [x] **Step 2: Run test to verify it fails (stale prefix bug)**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/rendering/repeat-rekey.test.ts`
Expected: FAIL — the second input still has `people[2]` in its name attribute because the DOM was only truncated from the tail.

- [x] **Step 3: Fix the repeat rendering in emit-node.ts**

In `packages/formspec-webcomponent/src/rendering/emit-node.ts`, replace the grow/shrink logic (lines ~86-111) with a full rebuild on count change. Key structural details:

- `container` is a child of `target`. The add button is also a child of `target`, appended after `container` (line 119: `target.appendChild(addBtn)`). They are siblings — do NOT try to use `addBtn` as an insertion reference inside `container`.
- Inner `emitNode` calls register effects in `host.cleanupFns`. Track the cleanup functions created during each rebuild and dispose them before the next rebuild to prevent memory leaks.

```ts
// Track cleanup functions from inner emitNode calls so we can dispose
// them on rebuild. Capture the current length before stamping children.
let innerCleanupStart = host.cleanupFns.length;

host.cleanupFns.push(effect(() => {
  const count = host.engine.repeats[fullRepeatPath]?.value || 0;

  // Dispose cleanup functions from prior inner emitNode calls
  const innerCleanups = host.cleanupFns.splice(
    innerCleanupStart,
    host.cleanupFns.length - innerCleanupStart,
  );
  for (const cleanup of innerCleanups) {
    if (typeof cleanup === 'function') cleanup();
  }

  // Full rebuild: clear all instance wrappers from container
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Mark where new inner cleanups will start
  innerCleanupStart = host.cleanupFns.length;

  for (let idx = 0; idx < count; idx++) {
    const instanceWrapper = document.createElement('div');
    instanceWrapper.className = 'formspec-repeat-instance';

    const instancePrefix = `${fullRepeatPath}[${idx}]`;
    for (const child of node.children) {
      emitNode(host, child, instanceWrapper, instancePrefix);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'formspec-repeat-add';
    removeBtn.textContent = `Remove ${item?.label || bindKey}`;
    const removeIdx = idx;
    removeBtn.addEventListener('click', () => {
      host.engine.removeRepeatInstance(fullRepeatPath, removeIdx);
    });
    instanceWrapper.appendChild(removeBtn);

    container.appendChild(instanceWrapper);
  }
}));
```

Note: The add button (`addBtn`) stays on `target` outside `container` — no changes needed there.

- [x] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/rendering/repeat-rekey.test.ts`
Expected: PASS

- [x] **Step 5: Run full webcomponent test suite**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Run E2E tests that exercise repeats**

Status note: `cd packages/formspec-webcomponent && npx vitest run` passed. Repeat-specific Playwright coverage has not been run in this pass.

Run: `npx playwright test --grep "repeat|phase"`
Expected: No regressions.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-webcomponent/src/rendering/emit-node.ts packages/formspec-webcomponent/tests/rendering/repeat-rekey.test.ts
git commit -m "$(cat <<'EOF'
fix: rebuild repeat instances on count change to prevent stale indexes

Previously, repeat instances were only appended/truncated. Removing a
non-tail instance left surviving DOM nodes bound to wrong engine indexes.
Now the container is fully rebuilt on every count change.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fix wizard submit button disabled on last step

The wizard's "Next" button is relabeled to "Submit" on the last step but simultaneously disabled via `nextBtn.disabled = step === total - 1`. Users see "Submit" but cannot click it.

**Context:** The wizard render function signature is `render: (comp, parent, ctx) => { ... }`. The wizard root element is `el` (created as `document.createElement('div')` and appended to `parent`). The render context `ctx` has `ctx.submit({ mode, emitEvent })` which is the same submit mechanism used by `SubmitButtonPlugin`. The `nextBtn` click handler (line 179) currently only advances steps — it does not handle the last step at all.

**Files:**

- Modify: `packages/formspec-webcomponent/src/components/interactive.ts:179-189, 220-244`
- Test: `packages/formspec-webcomponent/tests/components/interactive-plugins.test.ts`

- [x] **Step 1: Write the failing test**

Add to `interactive-plugins.test.ts` in the Wizard describe block:

```ts
it('enables the submit button on the last wizard step', async () => {
  const { element } = await renderWithTree({
    definition: {
      title: 'Wizard Submit Test',
      items: [
        { key: 'page1', type: 'group', label: 'Step 1', children: [{ key: 'f1', type: 'field', dataType: 'string' }] },
        { key: 'page2', type: 'group', label: 'Step 2', children: [{ key: 'f2', type: 'field', dataType: 'string' }] },
      ],
    },
    tree: {
      component: 'Wizard',
      children: [
        { component: 'Page', bind: 'page1', children: [{ component: 'TextInput', bind: 'f1' }] },
        { component: 'Page', bind: 'page2', children: [{ component: 'TextInput', bind: 'f2' }] },
      ],
    },
  });

  const nextBtn = element.querySelector('.formspec-wizard-next') as HTMLButtonElement;

  // Navigate to last step
  nextBtn.click();
  await new Promise(r => setTimeout(r, 50));

  // On last step, button should say "Submit" and be ENABLED
  expect(nextBtn.textContent).toBe('Submit');
  expect(nextBtn.disabled).toBe(false);
});

it('dispatches formspec-submit event when clicking submit on last step', async () => {
  const { element } = await renderWithTree({
    definition: {
      title: 'Wizard Submit Test',
      items: [
        { key: 'page1', type: 'group', label: 'Step 1', children: [{ key: 'f1', type: 'field', dataType: 'string' }] },
        { key: 'page2', type: 'group', label: 'Step 2', children: [{ key: 'f2', type: 'field', dataType: 'string' }] },
      ],
    },
    tree: {
      component: 'Wizard',
      children: [
        { component: 'Page', bind: 'page1', children: [{ component: 'TextInput', bind: 'f1' }] },
        { component: 'Page', bind: 'page2', children: [{ component: 'TextInput', bind: 'f2' }] },
      ],
    },
  });

  const nextBtn = element.querySelector('.formspec-wizard-next') as HTMLButtonElement;

  // Navigate to last step
  nextBtn.click();
  await new Promise(r => setTimeout(r, 50));

  // Click submit and verify event fires
  let submitFired = false;
  element.addEventListener('formspec-submit', () => { submitFired = true; });
  nextBtn.click();
  await new Promise(r => setTimeout(r, 50));

  expect(submitFired).toBe(true);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/components/interactive-plugins.test.ts -t "submit"`
Expected: Both FAIL — button is disabled, and no submit event fires.

- [x] **Step 3: Fix the disabled condition and add submit behavior**

In `packages/formspec-webcomponent/src/components/interactive.ts`:

**Change 1 — the step effect** (around line 223):

Change:
```ts
nextBtn.disabled = step === total - 1;
```

To:
```ts
nextBtn.disabled = false;
```

**Change 2 — the click handler** (around line 179-189). Replace the existing `nextBtn.addEventListener('click', ...)` block:

```ts
nextBtn.addEventListener('click', () => {
  // Touch fields in current panel for validation feedback
  const currentPanel = panels[currentStep.value];
  if (currentPanel) {
    touchFieldsInContainer(currentPanel, ctx.touchedFields, ctx.touchedVersion);
  }

  if (currentStep.value < children.length - 1) {
    setStep(currentStep.value + 1);
  } else {
    // Last step: trigger submit through the standard ctx.submit() path
    ctx.submit({ mode: 'submit', emitEvent: true });
  }
});
```

Note: `ctx.submit()` is the same mechanism used by `SubmitButtonPlugin` (line 361). This ensures consistent submit behavior regardless of whether the user clicks a standalone submit button or the wizard's last-step button. The variable `el` (not `wizard`) is the wizard root element.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/components/interactive-plugins.test.ts -t "submit"`
Expected: PASS

- [x] **Step 5: Run full interactive-plugins test suite**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/components/interactive-plugins.test.ts`
Expected: All pass. Check if existing tests assert `disabled === true` on the last step — if so, update them to assert `disabled === false`.

- [ ] **Step 6: Run wizard E2E tests**

Status note: unit coverage is green via `cd packages/formspec-webcomponent && npx vitest run tests/components/interactive-plugins.test.ts`. Wizard-specific Playwright coverage has not been run yet in this pass.

Run: `npx playwright test tests/e2e/browser/grant-app/wizard-navigation.spec.ts`
Expected: No regressions.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-webcomponent/src/components/interactive.ts packages/formspec-webcomponent/tests/components/interactive-plugins.test.ts
git commit -m "$(cat <<'EOF'
fix: enable wizard submit button on last step and trigger ctx.submit()

The wizard next button was disabled on the last step while being
relabeled to "Submit". Now it stays enabled and calls ctx.submit()
on the last step, using the same submit path as SubmitButtonPlugin.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix screener toggle destructive delete

The screener enable/disable toggle deletes `definition.screener` entirely instead of marking it disabled. A single click wipes all screener items and routes with no recovery path besides undo.

**Fix strategy:** Change the handler to set `screener.enabled = false` instead of deleting. This preserves the data.

**Files:**
- Modify: `packages/formspec-studio-core/src/handlers/definition-screener.ts:37-48`
- Modify: `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx:29` (check `isEnabled` logic)
- Test: `packages/formspec-studio-core/tests/definition-screener.test.ts`

- [x] **Step 1: Write the failing test**

Add to `packages/formspec-studio-core/tests/definition-screener.test.ts`:

```ts
describe('definition.setScreener', () => {
  it('preserves screener data when disabling', () => {
    const project = createProject();

    // Enable screener
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    // Add items and a route
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: 'age >= 18', target: 'adult-form' },
    });

    expect(project.definition.screener.items).toHaveLength(1);
    expect(project.definition.screener.routes).toHaveLength(1);

    // Disable screener
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });

    // Screener should still exist with data, just disabled
    expect(project.definition.screener).toBeDefined();
    expect(project.definition.screener.items).toHaveLength(1);
    expect(project.definition.screener.routes).toHaveLength(1);
    expect(project.definition.screener.enabled).toBe(false);
  });

  it('re-enabling a disabled screener preserves existing data', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });

    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(project.definition.screener.items).toHaveLength(1);
    expect(project.definition.screener.enabled).not.toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/definition-screener.test.ts -t "preserves screener data"`
Expected: FAIL — screener is `undefined` after disable.

- [x] **Step 3: Fix the handler**

In `packages/formspec-studio-core/src/handlers/definition-screener.ts`, change the `definition.setScreener` handler:

```ts
registerHandler('definition.setScreener', (state, payload) => {
  const { enabled } = payload as { enabled: boolean };

  if (enabled) {
    if (!state.definition.screener) {
      state.definition.screener = { items: [], routes: [] };
    }
    // Remove disabled flag when enabling
    delete state.definition.screener.enabled;
  } else {
    if (state.definition.screener) {
      state.definition.screener.enabled = false;
    }
  }

  return { rebuildComponentTree: false };
});
```

- [x] **Step 4: Update ScreenerSection.tsx isEnabled check**

In `packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx`, line 29:

Change from:
```ts
const isEnabled = Boolean(screener);
```

To:
```ts
const isEnabled = Boolean(screener) && screener?.enabled !== false;
```

- [x] **Step 5: Add disabled-state guard to screener mutation handlers**

The other screener handlers (`addScreenerItem`, `addRoute`, etc.) currently guard on `!state.definition.screener`. After this fix, screener is preserved when disabled, so those guards will no longer prevent mutations to a disabled screener. Add a check to the shared guard pattern:

In `packages/formspec-studio-core/src/handlers/definition-screener.ts`, find the guard pattern used by `addScreenerItem`, `deleteScreenerItem`, `setScreenerBind`, `addRoute`, `setRouteProperty`, `deleteRoute`, and `reorderRoute`. Each throws if `!state.definition.screener`. Update these to also check the enabled flag:

```ts
// In each handler that mutates screener content:
if (!state.definition.screener || state.definition.screener.enabled === false) {
  throw new Error('Screener is not enabled');
}
```

- [x] **Step 6: Write test for disabled-state mutation guard**

Add to the same test file:

```ts
it('rejects mutations to a disabled screener', () => {
  const project = createProject();
  project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
  project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });

  expect(() => {
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
  }).toThrow(/not enabled/i);
});
```

- [x] **Step 7: Run tests to verify they pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/definition-screener.test.ts`
Expected: All pass.

- [x] **Step 8: Run studio unit tests**

Status note: focused runs passed for `packages/formspec-studio-core/tests/definition-screener.test.ts` and `packages/formspec-studio/tests/components/blueprint/screener-section.test.tsx`, and full `cd packages/formspec-studio && npx vitest run` passed. Full `packages/formspec-studio-core` Vitest still has unrelated pre-existing E2E/environment failures in this workspace, including missing Python `jsonschema`.

Run: `cd packages/formspec-studio && npx vitest run`
Expected: No regressions.

- [ ] **Step 9: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/definition-screener.ts packages/formspec-studio/src/components/blueprint/ScreenerSection.tsx packages/formspec-studio-core/tests/definition-screener.test.ts
git commit -m "$(cat <<'EOF'
fix: screener toggle sets enabled flag instead of deleting data

Previously, disabling the screener deleted the entire screener object,
destroying items and routes. Now it sets screener.enabled = false,
preserving all configuration for re-enablement.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Drop orphaned display nodes instead of preserving them

The component-tree rebuild appends unmatched display nodes to root. These ghosts survive after their definition items are deleted or moved.

**Files:**
- Modify: `packages/formspec-studio-core/src/project.ts:1772-1778`
- Test: `packages/formspec-studio-core/tests/component-tree.test.ts`

- [x] **Step 1: Write the failing test**

Add to `packages/formspec-studio-core/tests/component-tree.test.ts`:

```ts
describe('component tree rebuild — orphaned display nodes', () => {
  it('drops display nodes whose definition items no longer exist', () => {
    const project = createProject();

    // Add a display item, then delete it
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'notice', type: 'display', label: 'Important notice' },
    });

    // Verify it's in the tree by checking children nodeIds
    const treeBefore = project.component.tree;
    const hasNoticeBefore = treeBefore.children?.some(
      (n: any) => n.nodeId === 'notice'
    );
    expect(hasNoticeBefore).toBe(true);

    // Delete the item
    project.dispatch({ type: 'definition.deleteItem', payload: { path: 'notice' } });

    // The display node should NOT survive in the tree
    const treeAfter = project.component.tree;
    const hasNoticeAfter = treeAfter.children?.some(
      (n: any) => n.nodeId === 'notice'
    );
    expect(hasNoticeAfter).toBeFalsy();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/component-tree.test.ts -t "drops display nodes"`
Expected: FAIL — the orphaned display node is still in the tree's children array.

- [x] **Step 3: Remove the orphan-preservation loop and update the comment**

In `packages/formspec-studio-core/src/project.ts`, around line 1772:

1. Update the comment from `"Append preserved unbound layout nodes and unconsumed nodeId nodes at root"` to `"Append preserved unbound layout nodes at root"` (remove the "unconsumed nodeId nodes" part since we're deleting that behavior).

2. Delete the `existingDisplay` loop:

```ts
// DELETE THIS BLOCK:
for (const node of existingDisplay.values()) {
  newRoot.children!.push(node);
}
```

Keep the `unboundNodes` loop (layout nodes without bind or nodeId) — those are intentional author-placed layout wrappers.

- [x] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio-core && npx vitest run tests/component-tree.test.ts -t "drops display nodes"`
Expected: PASS

- [x] **Step 5: Run full component-tree test suite**

Run: `cd packages/formspec-studio-core && npx vitest run tests/component-tree.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

Status note: `cd packages/formspec-studio-core && npx vitest run tests/component-tree.test.ts` passed after dropping orphaned display-node preservation.

```bash
git add packages/formspec-studio-core/src/project.ts packages/formspec-studio-core/tests/component-tree.test.ts
git commit -m "$(cat <<'EOF'
fix: drop orphaned display nodes during component tree rebuild

Unmatched display nodes (whose definition items were deleted or moved)
were being appended to the tree root as ghosts. Now they are dropped.
Intentional unbound layout nodes are still preserved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Remove bind lookup leaf-key fallback

`arrayBindsFor()` falls back to `path.split('.').pop()` which causes `app.name` and `household.name` to collide on the leaf key `name`.

**Files:**
- Modify: `packages/formspec-studio/src/lib/field-helpers.ts:48-50`
- Test: `packages/formspec-studio/tests/lib/field-helpers.test.ts` (create or add to existing)

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { arrayBindsFor } from '../../src/lib/field-helpers.js';

describe('arrayBindsFor', () => {
  it('does not resolve a bind by leaf key when full path does not match', () => {
    const binds = [
      { path: 'name', required: 'true()' },
    ];
    // Full path is 'household.name' — should NOT match bind with path 'name'
    const result = arrayBindsFor(binds, 'household.name');
    expect(result).toEqual({});
  });

  it('resolves a bind by exact full path', () => {
    const binds = [
      { path: 'household.name', required: 'true()' },
    ];
    const result = arrayBindsFor(binds, 'household.name');
    expect(result).toEqual({ required: 'true()' });
  });
});
```

- [x] **Step 2: Run test to verify the first case fails**

Run: `cd packages/formspec-studio && npx vitest run tests/lib/field-helpers.test.ts -t "does not resolve a bind by leaf key"`
Expected: FAIL — returns `{ required: 'true()' }` because of the fallback.

- [x] **Step 3: Remove the fallback**

In `packages/formspec-studio/src/lib/field-helpers.ts`, change:

```ts
const fallbackPath = path.split('.').pop();
const bind = binds.find(b => b.path === path)
  ?? binds.find(b => fallbackPath && b.path === fallbackPath);
```

To:

```ts
const bind = binds.find(b => b.path === path);
```

Delete the `fallbackPath` variable entirely.

- [x] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/lib/field-helpers.test.ts`
Expected: PASS

- [x] **Step 5: Run full studio test suite to check for regressions**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass. If any tests relied on the fallback behavior, they reveal forms with incorrectly stored bind paths — fix the test fixtures, not the function.

- [ ] **Step 6: Commit**

Status note: one `ItemProperties` test fixture was updated to assert exact-path bind behavior instead of the removed leaf-key fallback. Full `cd packages/formspec-studio && npx vitest run` remained green.

```bash
git add packages/formspec-studio/src/lib/field-helpers.ts packages/formspec-studio/tests/lib/field-helpers.test.ts
git commit -m "$(cat <<'EOF'
fix: remove ambiguous leaf-key fallback from arrayBindsFor

The fallback matched binds by leaf key only (e.g. 'name'), causing
collisions when multiple groups reuse the same leaf key. Now only
exact full-path matches are accepted.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Fix planner scoped item lookup

The layout planner computes `fullBindPath` but passes bare `bindKey` to `ctx.findItem()`. In nested scopes, this resolves the wrong item.

**Context:** `PlanContext.findItem` is documented as "supports dotted paths" in `packages/formspec-layout/src/types.ts:98`. However, the existing test helper `findItems()` in `packages/formspec-layout/tests/planner.test.ts:18-27` does a **flat recursive key search** (`item.key === key`) — it does NOT walk dotted paths. The fix requires both: (1) passing `fullBindPath` to `findItem`, and (2) ensuring the `findItem` implementation used in tests supports dotted path resolution.

**Files:**

- Modify: `packages/formspec-layout/src/planner.ts:185`
- Modify: `packages/formspec-layout/tests/planner.test.ts` (add test and update `findItems` helper)

- [x] **Step 1: Update the test helper to support dotted paths**

The existing `findItems` helper in `planner.test.ts` only matches by leaf key. Add a dotted-path-aware version:

```ts
/** Resolve an item by dotted path (e.g. 'organization.name'). */
function findItemByPath(items: any[], path: string): any | null {
  const segments = path.split('.');
  let current = items;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const found = current.find((item: any) => item.key === seg);
    if (!found) return null;
    if (i === segments.length - 1) return found;
    current = found.children || [];
  }
  return null;
}
```

- [x] **Step 2: Write the failing test**

Add to the `planComponentTree` describe block in `planner.test.ts`:

```ts
it('resolves scoped items by full path, not leaf key', () => {
  const items = [
    {
      key: 'applicant',
      type: 'group',
      children: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Applicant Name' },
      ],
    },
    {
      key: 'organization',
      type: 'group',
      children: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Org Name' },
      ],
    },
  ];

  const tree = {
    component: 'Stack',
    children: [
      {
        component: 'Stack',
        bind: 'organization',
        children: [
          { component: 'TextInput', bind: 'name' },
        ],
      },
    ],
  };

  const ctx = makeCtx({
    items,
    findItem: (k) => findItemByPath(items, k) ?? findItems(items, k),
  });

  const node = planComponentTree(tree, ctx);
  // The TextInput bound to 'name' inside 'organization' scope should
  // resolve to the organization.name item (label: 'Org Name'),
  // not applicant.name (label: 'Applicant Name')
  const orgGroup = node.children[0];
  const nameField = orgGroup.children[0];
  expect(nameField.fieldItem?.label).toBe('Org Name');
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `cd packages/formspec-layout && npx vitest run tests/planner.test.ts -t "resolves scoped items by full path"`
Expected: FAIL — `nameField.fieldItem?.label` is `'Applicant Name'` because `findItem('name')` does a flat search and finds `applicant.name` first.

- [x] **Step 4: Fix the lookup**

In `packages/formspec-layout/src/planner.ts`, around line 185, change:

```ts
const item = bindKey ? ctx.findItem(bindKey) : null;
```

To:

```ts
const item = (fullBindPath ?? bindKey) ? ctx.findItem(fullBindPath ?? bindKey) : null;
```

This is equivalent to always passing `fullBindPath` when available (which it is whenever `bindKey` exists, since `fullBindPath = prefix ? prefix.bindKey : bindKey`). At root scope, `fullBindPath === bindKey`, so behavior is unchanged. In nested scopes, the full dotted path is now passed.

- [x] **Step 5: Run test to verify it passes**

Run: `cd packages/formspec-layout && npx vitest run tests/planner.test.ts -t "resolves scoped items by full path"`
Expected: PASS

- [x] **Step 6: Run full planner test suite and E2E tests**

Run: `cd packages/formspec-layout && npx vitest run`
Run: `npx playwright test`
Expected: No regressions. If any existing tests fail, they are using a `findItem` that doesn't support dotted paths — update them to use the new `findItemByPath` helper.

- [ ] **Step 7: Commit**

Status note: `cd packages/formspec-layout && npx vitest run` passed. The Playwright command listed in the original step was not run as part of this scoped planner change.

```bash
git add packages/formspec-layout/src/planner.ts packages/formspec-layout/tests/planner.test.ts
git commit -m "$(cat <<'EOF'
fix: planner resolves items by full scoped path instead of leaf key

In nested component scopes, duplicate leaf keys could resolve to the
wrong item. Now the planner passes fullBindPath to ctx.findItem when
a scope prefix is present. Updated test helper to support dotted paths.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Dead Control Cleanup

Delete every UI control that has no write-back path. Per CLAUDE.md: "delete, don't preserve."

---

### Task 7: Remove dead "New Form" and "Export" buttons from Header

**Files:**
- Modify: `packages/formspec-studio/src/components/Header.tsx:12-13, 25-26, 100-116`
- Modify: `packages/formspec-studio/tests/components/header.test.tsx` (delete 2 tests)

- [x] **Step 1: Delete the tests that assert dead buttons exist**

In `packages/formspec-studio/tests/components/header.test.tsx`, delete the two tests:
- `it('renders an Export action in the primary header controls', ...)`
- `it('renders a New Form action in the primary header controls', ...)`

- [x] **Step 2: Remove buttons and props from Header.tsx**

In `packages/formspec-studio/src/components/Header.tsx`:
- Remove `onNew?: () => void;` and `onExport?: () => void;` from `HeaderProps`
- Remove `onNew,` and `onExport,` from the destructuring
- Remove the entire `{!isCompact && (<> ... New Form ... Export ... </>)}` block (lines 100-116), keeping the Metadata button if it's outside that block

- [x] **Step 3: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/components/header.test.tsx`
Expected: All remaining tests pass.

- [ ] **Step 4: Commit**

Status note: `cd packages/formspec-studio && npx vitest run tests/components/header.test.tsx tests/components/shell.test.tsx` passed after removing the dead Header controls.

```bash
git add packages/formspec-studio/src/components/Header.tsx packages/formspec-studio/tests/components/header.test.tsx
git commit -m "$(cat <<'EOF'
fix: remove dead New Form and Export buttons from Header

These buttons were never wired — Shell never passed onNew or onExport.
Removed the buttons, props, and tests that asserted their presence.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Remove cosmetic inputs from ItemProperties

Remove: cardinality inputs (Min/Max Repeat), choice option value/label inputs, disconnected rule expression input.

Remove the `+ Add Rule` button too — the review flags it as "worse than the original dead button because it now mutates state in a misleading way" (silently adds `required: 'true()'` regardless of context).

**Files:**

- Modify: `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:184-265`
- Modify: `packages/formspec-studio/tests/workspaces/editor/item-properties.test.tsx` (update affected tests)

- [x] **Step 1: Update tests first**

In `item-properties.test.tsx`:
- The cardinality test (`shows cardinality controls for repeatable groups`) — delete it or change it to assert the section does NOT render.
- The options test (`shows options editing controls for choice fields`) — delete it or change it to assert options are displayed read-only (no inputs).
- The `+ Add Rule` dispatch test (`dispatches a rule action when + Add Rule is clicked`) — delete it.

- [x] **Step 2: Remove the dead inputs and the misleading Add Rule button from ItemProperties.tsx**

- Delete the entire Cardinality `<Section>` block (lines 184-211) — the two `<input>` elements with no handlers.
- Replace the choice options `<Section>` (lines 213-234) with a read-only display: show option values as text/chips, not editable `<input>` elements.
- Delete the `+ Add Rule` button (lines 248-258) and the disconnected expression input below it (lines 259-264). The button silently adds `required: 'true()'` without reading user intent — this is a misleading mutation, not a useful shortcut.

- [x] **Step 3: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/item-properties.test.tsx`
Expected: All pass.

- [ ] **Step 4: Commit**

Status note: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/item-properties.test.tsx` passed, and the full `formspec-studio` suite remained green after the inspector cleanup.

```bash
git add packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx packages/formspec-studio/tests/workspaces/editor/item-properties.test.tsx
git commit -m "$(cat <<'EOF'
fix: remove cosmetic-only inputs from ItemProperties inspector

Removed Min/Max Repeat inputs and choice option edit inputs that had
no event handlers. Options are now displayed as read-only text. The
disconnected rule expression input is also removed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Remove dead buttons from Theme, Data, and Logic workspaces

Batch removal of all remaining dead controls across multiple workspace files.

**Files:**
- Modify: `packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx` (remove both `+ Add Token` buttons)
- Modify: `packages/formspec-studio/src/workspaces/data/OptionSets.tsx` (revert cards from `<button>` to `<div>`)
- Modify: `packages/formspec-studio/src/workspaces/data/DataSources.tsx` (remove `Add Data Source` button)
- Modify: `packages/formspec-studio/src/workspaces/data/TestResponse.tsx` (remove `Run Test Response` button)
- Modify: `packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx` (remove fake edit mode)
- Update corresponding test files that assert dead button presence

- [x] **Step 1: Update tests that assert dead controls**

For each file, find the test that asserts the dead button exists and either delete the test or change it to assert the button does NOT exist:
- `token-editor.test.tsx` — check for `+ Add Token` assertions
- `option-sets.test.tsx` — change `getByRole('button')` to `getByTestId` or check for `<div>` instead
- `data-sources.test.tsx` — delete `shows a creation affordance` test
- `test-response.test.tsx` — delete button presence assertion
- `logic-workflow.test.tsx` — check for edit mode assertions

- [x] **Step 2: Remove dead controls**

**TokenEditor.tsx:** Delete both `<button type="button">+ Add Token</button>` elements.

**OptionSets.tsx:** Change `<button key={name} type="button" ...>` to `<div key={name} ...>` (and closing tag). Remove `hover:bg-subtle` since it's no longer interactive.

**DataSources.tsx:** Delete the `<button>Add Data Source</button>` block. Keep the empty-state message.

**TestResponse.tsx:** Delete the `<button>Run Test Response</button>` block. Keep any descriptive text. If the component is now empty, replace it with a simple "Test Response — not yet implemented" text.

**VariablesSection.tsx:** Remove the `editingName` state, the `readOnly` `<input>`, and the `onDoubleClick` handler. Keep the expression display as plain read-only text (the `<div>` branch).

**CommandPalette.tsx (variable hits):** Variable results' `onSelect` only closes the palette — they don't navigate, select, or open an editor (`CommandPalette.tsx:75-81`). Since there's no variable editor to navigate to yet, change the variable hit rendering to make it clear these are informational (e.g., remove the clickable row styling, or add a "(read-only)" label). Do NOT leave them looking like actionable navigation targets.

**VariablesList.tsx (blueprint variable rows):** Every variable row dispatches the same `openLogicWorkspace()` action without carrying the clicked variable name (`VariablesList.tsx:27`). Since the logic workspace has no per-variable selection yet, change the click handler to at minimum pass the variable name through for future use, or remove the click handler and leave rows as informational display.

- [x] **Step 3: Run all studio tests**

Status note: `cd packages/formspec-studio && npx vitest run` passed. Targeted Playwright coverage for the affected surfaces also passed:
- `tests/e2e/playwright/header-actions.spec.ts`
- `tests/e2e/playwright/data-workspace.spec.ts`
- `tests/e2e/playwright/blueprint-sidebar.spec.ts`
- `tests/e2e/playwright/logic-authoring.spec.ts`
- `tests/e2e/playwright/theme-workspace.spec.ts`

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx packages/formspec-studio/src/workspaces/data/OptionSets.tsx packages/formspec-studio/src/workspaces/data/DataSources.tsx packages/formspec-studio/src/workspaces/data/TestResponse.tsx packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx
git add packages/formspec-studio/tests/
git commit -m "$(cat <<'EOF'
fix: remove dead buttons and cosmetic controls across studio workspaces

Deleted: Add Token buttons (TokenEditor), Add Data Source button
(DataSources), Run Test Response button (TestResponse), fake edit
mode (VariablesSection). Reverted OptionSets cards from button to div.
None of these had event handlers or write-back paths.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: Structural Improvements

Path handling, state management, and catalog fixes.

---

### Task 10: Widen dispatch return type to expose handler results

Before fixing the path-guessing bugs, the dispatch return type needs to expose `insertedPath` and `newPath` that handlers already return at runtime.

**Files:**
- Modify: `packages/formspec-studio-core/src/types.ts` (widen `CommandResult`)
- Modify: `packages/formspec-studio-core/src/project.ts` (return type of `dispatch`)
- Modify: `packages/formspec-studio/src/context/useDispatch.ts` (return type)

**Status update (2026-03-12):** `CommandResult` is widened and chunk 3 callers now consume `insertedPath`/`newPath` without casts. Both `npx tsc --noEmit` verification steps are still blocked by pre-existing screener and unrelated studio typing failures outside this chunk.

- [x] **Step 1: Widen CommandResult**

In `packages/formspec-studio-core/src/types.ts`, change:

```ts
export interface CommandResult {
  rebuildComponentTree: boolean;
  clearHistory?: boolean;
}
```

To:

```ts
export interface CommandResult {
  rebuildComponentTree: boolean;
  clearHistory?: boolean;
  /** Canonical path of a newly inserted item, returned by addItem handlers. */
  insertedPath?: string;
  /** Canonical path after a move operation, returned by moveItem. */
  newPath?: string;
  /** Allow handlers to return additional domain-specific fields. */
  [key: string]: unknown;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/formspec-studio-core && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify StructureTree.handleAddPage no longer needs a type guard**

The existing `typeof result.insertedPath === 'string'` guard in `StructureTree.tsx` line 179 should now be recognized by TypeScript. Verify no type errors.

Run: `cd packages/formspec-studio && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio-core/src/types.ts
git commit -m "$(cat <<'EOF'
refactor: widen CommandResult to expose insertedPath and newPath

Handler return values like insertedPath and newPath were already
returned at runtime but invisible to TypeScript. Now they are
declared on CommandResult so callers can consume them without casts.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Fix path guessing — consume dispatch results in EditorCanvas and StructureTree

Replace local path computation in `handleAddItem` and `wrapInGroup` (EditorCanvas) and `handleAddFromPalette` (StructureTree) with canonical paths from dispatch results.

**Files:**

- Modify: `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx:179-196, 261-280`
- Modify: `packages/formspec-studio/src/components/blueprint/StructureTree.tsx:197-214`
- Test: `packages/formspec-studio/tests/workspaces/editor/editor-canvas.test.tsx` (add or modify)

**Status update (2026-03-12):** `EditorCanvas` now uses canonical dispatch results for add and wrap flows, and `StructureTree` uses canonical inserted paths for palette adds and page adds. Collision-path regression tests and the full `packages/formspec-studio` Vitest suite pass.

- [x] **Step 1: Write failing test for handleAddItem path accuracy**

The test should verify that after adding an item, the selection targets the canonical inserted path (not a locally guessed one). If a key collision occurs, the selection should still be correct.

```ts
it('selects the canonical inserted path after adding an item', () => {
  // Setup: render EditorCanvas with an existing item that causes a key collision
  // Add an item whose key would collide
  // Verify select() was called with the insertedPath from dispatch, not the local guess
});
```

Exact test shape depends on how EditorCanvas is tested (may need a mock dispatch that returns `{ insertedPath: 'field_1' }` when the requested key was `'field'`).

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Fix handleAddItem**

In `EditorCanvas.tsx`, change `handleAddItem` to capture and use the dispatch result:

```ts
const handleAddItem = (opt: FieldTypeOption) => {
  const key = uniqueKey(opt.dataType ?? opt.itemType);
  const activeGroup = hasPaged ? topLevelGroups[activePageIndex] : null;
  const result = dispatch({
    type: 'definition.addItem',
    payload: {
      key,
      type: opt.itemType,
      ...(activeGroup ? { parentPath: activeGroup.key } : {}),
      ...opt.extra,
    },
  });
  const insertedPath = result.insertedPath ?? (activeGroup ? `${activeGroup.key}.${key}` : key);
  selectAndFocusInspector(insertedPath, opt.itemType);
  setShowPicker(false);
};
```

- [x] **Step 4: Fix wrapInGroup**

```ts
case 'wrapInGroup': {
  const location = findItemLocation(items, path);
  if (!location) break;
  const wrapperKey = uniqueKey('group');
  const addResult = dispatch({
    type: 'definition.addItem',
    payload: { key: wrapperKey, type: 'group', insertIndex: location.index },
  });
  const canonicalWrapperPath = addResult.insertedPath ?? wrapperKey;
  dispatch({
    type: 'definition.moveItem',
    payload: { sourcePath: path, targetParentPath: canonicalWrapperPath, targetIndex: 0 },
  });
  break;
}
```

- [x] **Step 5: Fix StructureTree.handleAddFromPalette**

In `packages/formspec-studio/src/components/blueprint/StructureTree.tsx`, `handleAddFromPalette` (around line 197) discards the dispatch result entirely. `handleAddPage` in the same file (line 175) already correctly consumes `result.insertedPath` — follow the same pattern:

```ts
const handleAddFromPalette = useCallback(
  (opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);
    const result = dispatch({
      type: 'definition.addItem',
      payload: {
        key,
        type: opt.itemType,
        dataType: opt.dataType,
        label: opt.label,
        ...(hasPages && activePageKey ? { parentPath: activePageKey } : {}),
        ...opt.extra,
      },
    });
    // Use canonical inserted path for selection
    const insertedPath = result.insertedPath ?? key;
    select(insertedPath, opt.itemType === 'group' ? 'group' : 'field');
  },
  [dispatch, hasPages, activePageKey, select],
);
```

- [x] **Step 6: Run tests**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx packages/formspec-studio/src/components/blueprint/StructureTree.tsx packages/formspec-studio/tests/
git commit -m "$(cat <<'EOF'
fix: consume canonical paths from dispatch in EditorCanvas and StructureTree

handleAddItem, wrapInGroup (EditorCanvas), and handleAddFromPalette
(StructureTree) were computing paths locally or discarding dispatch
results. Now all three consume result.insertedPath for canonical
path identity after mutations.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Hoist workspace tab state for Theme, Mapping, and Preview

Apply the same controlled/uncontrolled pattern used by DataTab. This prevents tab state from resetting when switching workspaces.

**Files:**
- Modify: `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx`
- Modify: `packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx`
- Modify: `packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx`
- Modify: `packages/formspec-studio/src/components/Shell.tsx`

**Status update (2026-03-12):** Theme, Mapping, and Preview now follow the same controlled/uncontrolled pattern as Data, and `Shell` hoists their state so workspace switches preserve the active sub-view. Shell persistence coverage passes for Data, Theme, Mapping, and Preview.

- [x] **Step 1: Add controlled props to ThemeTab**

Follow the DataTab pattern:

```ts
interface ThemeTabProps {
  activeTab?: TabId;
  onActiveTabChange?: (tab: TabId) => void;
}

export function ThemeTab({ activeTab, onActiveTabChange }: ThemeTabProps = {}) {
  const [internalActive, setInternalActive] = useState<TabId>('tokens');
  const active = activeTab ?? internalActive;
  const setActive = onActiveTabChange ?? setInternalActive;
  // ... use active/setActive instead of activeTab/setActiveTab
}
```

- [x] **Step 2: Add controlled props to MappingTab**

Same pattern for `activeTab` and `configOpen`.

- [x] **Step 3: Add controlled props to PreviewTab**

Same pattern for `viewport` and `mode`.

- [x] **Step 4: Hoist state in Shell.tsx**

Add `useState` calls in Shell for each workspace's persisted state. Update the `WorkspaceComponent` selection to render these inline with props, same as DataTab.

- [x] **Step 5: Run tests**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx packages/formspec-studio/src/components/Shell.tsx
git commit -m "$(cat <<'EOF'
fix: hoist workspace tab state to Shell to prevent reset on switch

Theme, Mapping, and Preview tabs now accept optional controlled props
for their sub-tab state, matching the DataTab pattern. Shell owns
the state and passes it down, so switching workspaces preserves
the user's last active sub-tab.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Fix mapping direction inconsistent defaults

**Files:**
- Modify: `packages/formspec-studio/src/workspaces/mapping/MappingPreview.tsx:12`

**Status update (2026-03-12):** `MappingPreview` now defaults to `'unset'`, matching `MappingConfig`, and mapping workspace tests pass.

- [x] **Step 1: Fix the default**

In `MappingPreview.tsx`, change:

```ts
const direction = mapping?.direction ?? 'outbound';
```

To:

```ts
const direction = mapping?.direction ?? 'unset';
```

This matches `MappingConfig.tsx`.

- [x] **Step 2: Run tests**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-studio/src/workspaces/mapping/MappingPreview.tsx
git commit -m "$(cat <<'EOF'
fix: align mapping direction default to 'unset' in MappingPreview

MappingConfig defaulted to 'unset' while MappingPreview defaulted to
'outbound'. Now both use 'unset' when no direction is set.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Replace hardcoded FEL catalog with engine export

**Files:**
- Modify: `packages/formspec-studio/src/components/ui/FELReferencePopup.tsx`

**Status update (2026-03-12):** `FELReferencePopup` now derives its catalog from `getBuiltinFELFunctionCatalog()`, keeps display metadata locally for signature/description parity, and has dedicated popup coverage on top of the full studio suite.

- [x] **Step 1: Check the engine export shape**

Read `packages/formspec-engine/src/index.ts` to confirm `getBuiltinFELFunctionCatalog()` is exported and understand its return type (`FELBuiltinFunctionCatalogEntry[]`).

- [x] **Step 2: Replace the hardcoded catalog**

In `FELReferencePopup.tsx`:
- Remove the hardcoded `FEL_CATALOG` constant
- Import `getBuiltinFELFunctionCatalog` from `formspec-engine`
- Transform the engine catalog into the shape the popup expects (category → functions)
- Memoize the transformation with `useMemo`

- [x] **Step 3: Run tests**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [x] **Step 4: Verify visually or with a snapshot test that the popup renders function names correctly**

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/src/components/ui/FELReferencePopup.tsx
git commit -m "$(cat <<'EOF'
fix: replace hardcoded FEL catalog with engine's live function list

The popup was using XForms-heritage function names that didn't match
the engine's actual implementations. Now it imports the catalog from
getBuiltinFELFunctionCatalog() so it stays in sync automatically.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Path Reference Integrity

The addendum review surfaced that `moveItem` silently orphans every bind, shape, mapping rule, and FEL expression that references the old path. This was initially scoped as a large architectural lift — but the existing `renameItem` handler already implements the full cross-artifact rewriting loop using `rewritePathPrefix()` and `rewriteFieldRef()` helpers (both in `definition-items.ts`). Adding the same to `moveItem` is ~30-50 lines reusing existing infrastructure, not a new framework.

Path normalization for bind/command palette/logic navigation also becomes actionable once path identity is reliable after mutations.

---

### Task 15: Add path reference rewriting to moveItem

When an item moves from one parent to another, its canonical path changes (e.g. `applicant.name` → `organization.name`). The `moveItem` handler currently returns the new path but does not rewrite any references. The `renameItem` handler (lines 389-539 of `definition-items.ts`) already implements the complete rewriting pattern — this task adds the same to `moveItem`.

**Existing infrastructure to reuse:**

- `rewritePathPrefix(path, oldPath, newPath)` — handles dot-notation paths with `[*]` and `[N]` array suffixes (lines 190-216)
- `rewriteFieldRef(expr, oldPath, newPath)` — wraps `rewriteFELReferences()` from `formspec-engine` (lines 218-224)

**Artifacts that hold path references (from schema analysis):**

| Artifact | Properties with paths | Rewrite type |
|----------|----------------------|-------------|
| `definition.binds[].path` | Full dot-path | `rewritePathPrefix` |
| `definition.binds[].(calculate\|relevant\|required\|readonly\|constraint)` | FEL expression | `rewriteFieldRef` |
| `definition.shapes[].target` | Full dot-path | `rewritePathPrefix` |
| `definition.shapes[].(constraint\|activeWhen)` | FEL expression | `rewriteFieldRef` |
| `definition.shapes[].context.*` | FEL expression values | `rewriteFieldRef` |
| `definition.variables[].expression` | FEL expression | `rewriteFieldRef` |
| Items inline: `.relevant/.required/.readonly/.calculate/.constraint` | FEL expression | `rewriteFieldRef` |
| `definition.screener.routes[].condition` | FEL expression | `rewriteFieldRef` |
| `mapping.rules[].sourcePath` | Full dot-path | `rewritePathPrefix` |
| `mapping.rules[].(expression\|condition)` | FEL expression | `rewriteFieldRef` |
| `component.tree.*.bind` | Item key only | **No rewrite** (key unchanged by move) |
| `theme.items` keys | Item key only | **No rewrite** (key unchanged by move) |

**Files:**

- Modify: `packages/formspec-studio-core/src/handlers/definition-items.ts:565-590` (moveItem handler)
- Test: `packages/formspec-studio-core/tests/definition-items.test.ts`

- [ ] **Step 1: Write the failing test — bind path rewriting**

Add to `definition-items.test.ts`:

```ts
describe('definition.moveItem — reference rewriting', () => {
  it('rewrites bind paths when an item moves to a new parent', () => {
    const project = createProject();

    // Build: group "a" with child "name", plus empty group "b"
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'a', type: 'group' },
    });
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'name', type: 'field', dataType: 'string', parentPath: 'a' },
    });
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'b', type: 'group' },
    });

    // Add a bind referencing a.name
    project.dispatch({
      type: 'definition.setBind',
      payload: { path: 'a.name', properties: { required: 'true()' } },
    });

    // Move "name" from group "a" to group "b"
    project.dispatch({
      type: 'definition.moveItem',
      payload: { sourcePath: 'a.name', targetParentPath: 'b' },
    });

    // The bind should now reference b.name, not a.name
    const binds = project.definition.binds;
    const bind = binds?.find((b: any) => b.path === 'b.name');
    expect(bind).toBeDefined();
    expect(bind?.required).toBe('true()');

    // Old path should not exist
    const oldBind = binds?.find((b: any) => b.path === 'a.name');
    expect(oldBind).toBeUndefined();
  });

  it('rewrites FEL expressions referencing the moved item', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'a', type: 'group' },
    });
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'age', type: 'field', dataType: 'integer', parentPath: 'a' },
    });
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'b', type: 'group' },
    });

    // Add a variable that references a.age
    project.dispatch({
      type: 'definition.setVariable',
      payload: { name: 'isAdult', expression: '$a.age >= 18' },
    });

    // Move "age" from group "a" to group "b"
    project.dispatch({
      type: 'definition.moveItem',
      payload: { sourcePath: 'a.age', targetParentPath: 'b' },
    });

    // Variable expression should now reference b.age
    const variable = project.definition.variables?.find(
      (v: any) => v.name === 'isAdult'
    );
    expect(variable?.expression).toBe('$b.age >= 18');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/definition-items.test.ts -t "reference rewriting"`
Expected: FAIL — bind still references `a.name`, variable still has `$a.age`.

- [ ] **Step 3: Add path rewriting to the moveItem handler**

In `packages/formspec-studio-core/src/handlers/definition-items.ts`, after the existing `moveItem` handler computes `newPath` (line ~588), add a rewriting pass. Model it on the `renameItem` handler's rewriting section (lines ~440-539):

```ts
registerHandler('definition.moveItem', (state, payload) => {
  const { sourcePath, targetParentPath, targetIndex } = payload as { ... };

  const loc = resolveItemLocation(state, sourcePath);
  if (!loc) throw new Error(`Item not found: ${sourcePath}`);

  // Remove from source
  const [item] = loc.parent.splice(loc.index, 1);

  // Insert into target
  const targetItems = resolveParentItems(state, targetParentPath);
  if (!targetItems) throw new Error(`Target parent not found: ${targetParentPath}`);

  if (targetIndex !== undefined) {
    targetItems.splice(targetIndex, 0, item);
  } else {
    targetItems.push(item);
  }

  const newPath = targetParentPath ? `${targetParentPath}.${item.key}` : item.key;

  // Rewrite path references if the canonical path actually changed
  if (newPath !== sourcePath) {
    rewriteAllPathReferences(state, sourcePath, newPath);
  }

  return { rebuildComponentTree: true, newPath };
});
```

- [ ] **Step 4: Extract rewriting into a shared helper**

The rewriting logic from `renameItem` should be extracted into a shared function that both handlers can call. Create or add to a helpers file:

```ts
/**
 * Rewrite all path references across definition artifacts when an item's
 * canonical path changes (due to move or rename).
 */
export function rewriteAllPathReferences(
  state: ProjectState,
  oldPath: string,
  newPath: string,
): void {
  // 1. Rewrite binds — path + FEL properties
  if (Array.isArray(state.definition.binds)) {
    for (const bind of state.definition.binds) {
      bind.path = rewritePathPrefix(bind.path, oldPath, newPath);
      for (const prop of ['calculate', 'relevant', 'required', 'readonly', 'constraint'] as const) {
        if (typeof bind[prop] === 'string') {
          bind[prop] = rewriteFieldRef(bind[prop], oldPath, newPath);
        }
      }
    }
  }

  // 2. Rewrite shapes — target + FEL properties
  if (Array.isArray(state.definition.shapes)) {
    for (const shape of state.definition.shapes) {
      if (shape.target) shape.target = rewritePathPrefix(shape.target, oldPath, newPath);
      if (shape.constraint) shape.constraint = rewriteFieldRef(shape.constraint, oldPath, newPath);
      if (shape.activeWhen) shape.activeWhen = rewriteFieldRef(shape.activeWhen, oldPath, newPath);
      if (shape.context) {
        for (const [k, v] of Object.entries(shape.context)) {
          if (typeof v === 'string') shape.context[k] = rewriteFieldRef(v, oldPath, newPath);
        }
      }
    }
  }

  // 3. Rewrite variables
  if (Array.isArray(state.definition.variables)) {
    for (const v of state.definition.variables) {
      if (v.expression) v.expression = rewriteFieldRef(v.expression, oldPath, newPath);
    }
  }

  // 4. Rewrite inline item expressions (recursive walk)
  function walkItems(items: any[]) {
    for (const item of items) {
      for (const prop of ['relevant', 'required', 'readonly', 'calculate', 'constraint'] as const) {
        if (typeof item[prop] === 'string') {
          item[prop] = rewriteFieldRef(item[prop], oldPath, newPath);
        }
      }
      if (item.children) walkItems(item.children);
    }
  }
  walkItems(state.definition.items);

  // 5. Rewrite screener routes
  if (state.definition.screener?.routes) {
    for (const route of state.definition.screener.routes) {
      if (route.condition) route.condition = rewriteFieldRef(route.condition, oldPath, newPath);
    }
  }

  // 6. Rewrite mapping rules (if mapping artifact exists)
  if (state.mapping?.rules) {
    for (const rule of state.mapping.rules) {
      if (rule.sourcePath) rule.sourcePath = rewritePathPrefix(rule.sourcePath, oldPath, newPath);
      if (rule.expression) rule.expression = rewriteFieldRef(rule.expression, oldPath, newPath);
      if (rule.condition) rule.condition = rewriteFieldRef(rule.condition, oldPath, newPath);
    }
  }
}
```

The key insight: this is NOT new infrastructure. It reuses `rewritePathPrefix` and `rewriteFieldRef` that already exist. The `renameItem` handler should be refactored to call this same function instead of inlining the walk.

- [ ] **Step 5: Refactor renameItem to use the shared helper**

Replace the inline rewriting section in `renameItem` (lines ~440-539) with a call to `rewriteAllPathReferences(state, oldPath, newPath)`. This ensures both handlers stay in sync.

- [ ] **Step 6: Run tests**

Run: `cd packages/formspec-studio-core && npx vitest run tests/definition-items.test.ts`
Expected: All pass, including the new `moveItem` reference rewriting tests and all existing `renameItem` tests.

- [ ] **Step 7: Run full studio-core suite**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-studio-core/src/handlers/definition-items.ts packages/formspec-studio-core/tests/definition-items.test.ts
git commit -m "$(cat <<'EOF'
fix: rewrite path references when moveItem changes canonical paths

Extracted the cross-artifact path rewriting logic from renameItem into
a shared rewriteAllPathReferences helper. moveItem now calls it after
computing the new path. Binds, shapes, variables, inline FEL
expressions, screener routes, and mapping rules are all rewritten.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Normalize bind paths for command palette and logic workspace navigation

Multiple UI surfaces pass raw `bind.path` values to `select(path, 'field')` without normalization. After Task 15 ensures paths are canonical after mutations, these call sites can trust the stored paths — but array-form binds may still store relative keys. This task adds a normalization pass where raw bind paths are consumed.

**Affected call sites:**

- `packages/formspec-studio/src/components/CommandPalette.tsx:97` — bind hits call `select(bind.path, 'field')`
- `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx:47` → `BindsSection.tsx:30` — bind rows call `select(path, 'field')`

**Files:**

- Modify: `packages/formspec-studio/src/components/CommandPalette.tsx`
- Modify: `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx`
- Test: existing studio tests

- [ ] **Step 1: Investigate the actual bind path format**

Before writing code, read several fixture definitions to understand whether binds in practice use full paths or relative keys. Check:
- `tests/e2e/fixtures/` — look at `binds` arrays in definition fixtures
- `examples/` — real-world definitions

If all stored bind paths are already full canonical paths (after the renameItem/moveItem rewriting from Task 15), then the normalization pass may be unnecessary — the raw paths are already correct. If some use relative keys, determine whether the fix belongs in the storage layer (ensure binds always store full paths) or the consumption layer (normalize at read time).

- [ ] **Step 2: If normalization is needed, add it at the consumption points**

The simplest approach: when building the command palette index and when `BindsSection` renders rows, resolve relative bind paths against the definition tree to produce full canonical paths before passing to `select()`.

- [ ] **Step 3: Run tests**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/src/components/CommandPalette.tsx packages/formspec-studio/src/workspaces/logic/LogicTab.tsx
git commit -m "$(cat <<'EOF'
fix: normalize bind paths before passing to select() in palette and logic

Command palette bind hits and logic workspace bind rows now resolve
paths to canonical form before navigating, preventing failed selection
when binds store relative keys.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 5: Deferred Items (documented, not implemented)

These are documented here for future reference. They should NOT be implemented in this pass.

### Deferred: duplicateItem internal reference rewriting (Review Addendum Claim B)

`duplicateItem` renames child keys with `_copy` suffix but doesn't rewrite FEL expressions inside the clone. The `_copy` suffix makes breakage visible. Defer until deep-subtree duplication with internal FEL references is a real workflow. When it is, the fix is to call `rewriteAllPathReferences` on the cloned subtree (now available from Task 15).

### Deferred: Paged preview component-tree bypass (Review Claim 7)

`normalizeComponentDoc()` strips `component.tree` for wizard/tabs forms. The proper fix is in the planner/rendering path. Defer until layout overrides in paged forms are a real use case.

### Deferred: Paged fallback orphan ordering (Review Addendum Claim D)

The planner hoists orphan items ahead of the wizard node. This is a design choice — debatable but not broken. Revisit when paged authoring patterns are better defined.

---

## Verification Gate

After all tasks in Chunks 1-4 are complete:

- [ ] **Run full studio-core test suite:** `cd packages/formspec-studio-core && npx vitest run`
- [ ] **Run full studio test suite:** `cd packages/formspec-studio && npx vitest run`
- [ ] **Run full webcomponent test suite:** `cd packages/formspec-webcomponent && npx vitest run`
- [ ] **Run full layout test suite:** `cd packages/formspec-layout && npx vitest run`
- [ ] **Run full E2E suite:** `npx playwright test`
- [ ] **Run TypeScript type check:** `npm run build`
- [ ] **All green. Ready for review.**
