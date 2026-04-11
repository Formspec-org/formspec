# addPage: Remove Paired Group Creation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `addPage` a pure layout operation — it creates only a component Page node, never a definition group. Pages are display vehicles; groups belong to the editor.

**Architecture:** Pages are component-document concepts (presentation). Groups are definition concepts (data model). The current `addPage` conflates these by creating a paired definition group alongside the Page node. This change removes the convenience path so `addPage` always creates only the Page node. The `standalone` option becomes unnecessary and is removed. Downstream methods that use `_resolvePageGroup` to auto-nest items under a page's group still work — they just return `undefined` when a page has no group, which is fine.

**Tech Stack:** TypeScript (Vitest tests)

---

### Task 1: Simplify `addPage` in project.ts

**Files:**
- Modify: `packages/formspec-studio-core/src/project.ts:2385-2474`
- Modify: `packages/formspec-studio-core/src/helper-types.ts:17`

- [ ] **Step 1: Update the `addPage` method**

Remove the convenience path (lines 2440-2473) and the `opts` parameter. The method becomes equivalent to the current `standalone` branch. Also remove `groupKey` from the return since it's never set.

```typescript
  /** Add a page — creates a Page node in the component tree. */
  addPage(title: string, description?: string, id?: string): HelperResult {
    // Validate custom ID format
    if (id !== undefined) {
      if (!/^[a-zA-Z][a-zA-Z0-9_\-]*$/.test(id)) {
        throw new HelperError('INVALID_PAGE_ID', `Page ID "${id}" is invalid. Must start with a letter and contain only letters, digits, underscores, or hyphens.`, { id });
      }
      // Check for duplicate page ID in the component tree
      const existing = this._getPageNodes().find((n: any) => n.nodeId === id);
      if (existing) {
        throw new HelperError('DUPLICATE_KEY', `A page with ID "${id}" already exists`, { id });
      }
    }

    // Pre-generate page ID
    const pageId = id ?? `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pageProps: Record<string, unknown> = { nodeId: pageId, title };
    if (description) pageProps.description = description;

    const pageModeCommand: AnyCommand | null =
      !this.definition.formPresentation?.pageMode || this.definition.formPresentation.pageMode === 'single'
        ? {
            type: 'definition.setFormPresentation',
            payload: { property: 'pageMode', value: 'wizard' },
          }
        : null;

    const addPageCommand: AnyCommand = {
      type: 'component.addNode',
      payload: {
        parent: { nodeId: 'root' },
        component: 'Page',
        props: pageProps,
      },
    };

    if (pageModeCommand) {
      this.core.dispatch([pageModeCommand, addPageCommand]);
    } else {
      this.core.dispatch(addPageCommand);
    }

    return {
      summary: `Added page '${title}'`,
      action: { helper: 'addPage', params: { title, description } },
      affectedPaths: [pageId],
      createdId: pageId,
    };
  }
```

- [ ] **Step 2: Remove `groupKey` from HelperResult**

In `packages/formspec-studio-core/src/helper-types.ts`, remove line 17:

```typescript
// Remove this line:
  groupKey?: string;
```

- [ ] **Step 3: Fix `addItemToLayout` — place fields/display items on page when no group exists**

In `packages/formspec-studio-core/src/project.ts`, method `addItemToLayout` (~line 2737). When `pageGroupPath` is `undefined` (no paired group on the page) and a `pageId` is provided, the method should `placeOnPage` after creating the field/display item so it appears on the correct page.

For the **field** branch (~line 2748), after `addField` returns, add a `placeOnPage` call:

```typescript
    if (spec.itemType === 'field') {
      const typeArg = spec.registryDataType ?? spec.dataType ?? 'string';
      const addResult = this.addField(key, spec.label, typeArg, {
        ...(parentPath ? { parentPath } : {}),
      });
      // Place the new field on the page if no page group auto-nests it
      if (pageId && !pageGroupPath) {
        const createdPath = addResult.affectedPaths[0] ?? fullPath;
        const leafKey = createdPath.split('.').pop()!;
        this.placeOnPage(leafKey, pageId);
      }
      return {
        summary: addResult.summary,
        action: { helper: 'addItemToLayout', params: { spec, pageId } },
        affectedPaths: addResult.affectedPaths,
        createdId: addResult.affectedPaths[0] ?? fullPath,
      };
    }
```

For the **display** branch (non-layout-component, ~line 2817), add a similar `placeOnPage`:

```typescript
    // After the dispatch for definition.addItem:
    this.core.dispatch({ type: 'definition.addItem', payload });
    if (pageId && !pageGroupPath) {
      this.placeOnPage(key, pageId);
    }
```

- [ ] **Step 4: Remove `{ standalone: true }` from LayoutCanvas.tsx callers**

In `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx`:

Line 210 — already changed from the earlier edit, now needs the standalone option removed:
```typescript
// Before:
const result = project.addPage(`Page ${pageNavItems.length + 1}`, undefined, undefined, { standalone: true });
// After:
const result = project.addPage(`Page ${pageNavItems.length + 1}`);
```

Line 372 — `materializePagedLayout` also passes standalone:
```typescript
// Before:
const result = project.addPage(page.title, undefined, page.id, { standalone: true });
// After:
const result = project.addPage(page.title, undefined, page.id);
```

- [ ] **Step 5: Verify the build compiles**

Run: `cd packages/formspec-studio-core && npx tsc --noEmit`
Then: `cd packages/formspec-studio && npx tsc --noEmit`
Then: `cd packages/formspec-mcp && npx tsc --noEmit`

Expected: No type errors (the `opts` param is removed, `groupKey` is removed from HelperResult).

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio-core/src/project.ts packages/formspec-studio-core/src/helper-types.ts packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx
git commit -m "refactor(studio-core): make addPage standalone-only — no paired definition group

Pages are presentation vehicles in the component document. Adding a page
should not create a definition group — groups belong in the editor workspace.

Removes the convenience path that auto-created a paired group, the standalone
option (now the only behavior), and groupKey from HelperResult."
```

---

### Task 2: Update `addPage` unit tests in project-methods.test.ts

**Files:**
- Modify: `packages/formspec-studio-core/tests/project-methods.test.ts`

These tests directly test the paired-group behavior of `addPage`. They need to be rewritten to match the new standalone-only behavior.

- [ ] **Step 1: Rewrite the `addPage` describe block (lines 1327-1415)**

Replace the entire `describe('addPage', ...)` block:

```typescript
describe('addPage', () => {
  it('creates a Page node in the component tree without a definition group', () => {
    const project = createProject();
    const result = project.addPage('Step 1');

    expect(result.createdId).toBeDefined();

    // Page node exists in component tree
    const pages = getPageNodes(project);
    expect(pages.length).toBe(1);
    expect(pages[0].title).toBe('Step 1');

    // No definition group created — pages are layout-only
    expect(project.definition.items.length).toBe(0);
  });

  it('sets wizard page mode on first page', () => {
    const project = createProject();
    project.addPage('Step 1');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
  });

  it('preserves existing page mode (tabs)', () => {
    const project = createProject();
    project.setFlow('tabs');
    project.addPage('Tab 1');
    expect(project.definition.formPresentation?.pageMode).toBe('tabs');
  });

  it('creates multiple pages', () => {
    const project = createProject();
    const r1 = project.addPage('Step 1');
    const r2 = project.addPage('Step 2');

    const pages = getPageNodes(project);
    expect(pages.length).toBe(2);

    // Different page IDs
    expect(r1.createdId).not.toBe(r2.createdId);
    // No definition items created
    expect(project.definition.items.length).toBe(0);
  });

  it('handles description parameter', () => {
    const project = createProject();
    const result = project.addPage('Step 1', 'First step');
    const page = findPageNode(project, result.createdId!);
    expect(page?.description).toBe('First step');
  });

  it('undoes in one step', () => {
    const project = createProject();
    project.addPage('Step 1');

    expect(getPageNodes(project).length).toBe(1);

    project.undo();

    expect(getPageNodes(project).length).toBe(0);
  });
});
```

- [ ] **Step 2: Remove the `addPage standalone option` describe block (lines 2134-2165)**

Delete the entire `describe('addPage standalone option', ...)` block — standalone is now the only behavior, already tested above.

- [ ] **Step 3: Update `addPage edge cases` block (lines 2167-2178)**

```typescript
describe('addPage edge cases', () => {
  it('does not re-dispatch pageMode when already wizard', () => {
    const project = createProject();
    project.addPage('Step 1');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');

    project.addPage('Step 2');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
    expect(getPageNodes(project).length).toBe(2);
  });
});
```

- [ ] **Step 4: Update `addPage with custom ID` block (lines 2180-2228)**

Remove tests that assert group key derivation (lines 2188-2202). Keep ID validation and duplicate detection:

```typescript
describe('addPage with custom ID', () => {
  it('uses the provided custom ID', () => {
    const project = createProject();
    const result = project.addPage('Step 1', undefined, 'my-page');
    expect(result.createdId).toBe('my-page');
    expect(findPageNode(project, 'my-page')).toBeDefined();
  });

  it('rejects invalid custom ID (starts with number)', () => {
    const project = createProject();
    expect(() => project.addPage('Step 1', undefined, '1bad-id')).toThrow(/invalid/i);
  });

  it('rejects invalid custom ID (contains spaces)', () => {
    const project = createProject();
    expect(() => project.addPage('Step 1', undefined, 'bad id')).toThrow(/invalid/i);
  });

  it('rejects duplicate custom ID', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    expect(() => project.addPage('Step 2', undefined, 'step1')).toThrow(/already exists/);
  });

  it('accepts valid ID patterns', () => {
    const project = createProject();
    const r1 = project.addPage('Step 1', undefined, 'stepOne');
    expect(r1.createdId).toBe('stepOne');
    const r2 = project.addPage('Step 2', undefined, 'step_2');
    expect(r2.createdId).toBe('step_2');
    const r3 = project.addPage('Step 3', undefined, 'step-3');
    expect(r3.createdId).toBe('step-3');
  });
});
```

- [ ] **Step 5: Update `listPages` tests (lines 2231-2261)**

These tests check for `groupPath` which came from the paired group. After the change, pages won't have a groupPath unless items are explicitly placed on them:

```typescript
describe('listPages', () => {
  it('returns empty array for a fresh project', () => {
    const project = createProject();
    expect(project.listPages()).toEqual([]);
  });

  it('returns pages with id and title', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    project.addPage('Step 2', 'Second step', 'step2');
    const pages = project.listPages();
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ id: 'step1', title: 'Step 1' });
    expect(pages[1]).toEqual({ id: 'step2', title: 'Step 2', description: 'Second step' });
  });

  it('excludes description when not set', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    const pages = project.listPages();
    expect(pages[0]).not.toHaveProperty('description');
  });

  it('includes groupPath when a group is placed on the page', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    project.addGroup('contact', 'Contact');
    project.placeOnPage('contact', 'step1');
    const pages = project.listPages();
    expect(pages[0].groupPath).toBe('contact');
  });
});
```

- [ ] **Step 6: Run affected tests**

Run: `cd packages/formspec-studio-core && npx vitest run tests/project-methods.test.ts --reporter=verbose 2>&1 | head -200`

Expected: The updated addPage / listPages / edge-case tests pass. Other tests in this file may still fail — those are addressed in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio-core/tests/project-methods.test.ts
git commit -m "test(studio-core): update addPage tests for standalone-only behavior"
```

---

### Task 3: Update page-dependent tests that use addPage for setup

**Files:**
- Modify: `packages/formspec-studio-core/tests/project-methods.test.ts`

Many tests use `addPage` as setup and then reference the paired group via `result.affectedPaths[0]` or `result.groupKey`. These need to explicitly create a group, then place it on the page.

**Helper pattern:** Where tests previously did:
```typescript
const result = project.addPage('Step 1');
const groupKey = result.affectedPaths[0];
project.addField(`${groupKey}.name`, 'Name', 'text');
```

They should now do:
```typescript
const pageId = project.addPage('Step 1').createdId!;
project.addGroup('step_1', 'Step 1');
project.placeOnPage('step_1', pageId);
project.addField('step_1.name', 'Name', 'text');
```

- [ ] **Step 1: Update `removePage` tests (lines 1424-1511)**

The `removePage` tests create pages and check group preservation. Update them to create groups explicitly:

```typescript
describe('removePage', () => {
  it('removes a page by ID', () => {
    const project = createProject();
    const { createdId } = project.addPage('Page 1');
    project.addPage('Page 2');
    project.removePage(createdId!);
    expect(findPageNode(project, createdId!)).toBeUndefined();
  });

  it('preserves the definition group when page is deleted', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1').createdId!;
    project.addPage('Page 2');
    project.addGroup('contact', 'Contact');
    project.placeOnPage('contact', p1);

    project.removePage(p1);
    // Group survives — deleting a presentation surface does not destroy response structure
    expect(project.itemAt('contact')).toBeDefined();
  });

  it('preserves children of the definition group when page is deleted', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1').createdId!;
    project.addPage('Page 2');
    project.addGroup('contact', 'Contact');
    project.placeOnPage('contact', p1);
    project.addField('contact.name', 'Name', 'text');

    project.removePage(p1);
    // Fields survive — presentation changes must not destroy data
    expect(project.itemAt('contact.name')).toBeDefined();
  });

  it('is atomic — single undo restores just the page', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1').createdId!;
    project.addPage('Page 2');

    project.removePage(p1);
    expect(findPageNode(project, p1)).toBeUndefined();

    project.undo();
    expect(findPageNode(project, p1)).toBeDefined();
  });

  it('does not delete group if page has no region pointing to a root group', () => {
    const project = createProject();
    project.addPage('Page 1');
    project.setFlow('wizard');
    const itemsBefore = project.definition.items.length;
    (project as any).core.dispatch({
      type: 'component.addNode',
      payload: {
        parent: { nodeId: 'root' },
        component: 'Page',
        props: { nodeId: 'orphan-page', title: 'Orphan' },
      },
    });
    expect(project.definition.items.length).toBe(itemsBefore);
    project.removePage('orphan-page');
    expect(project.definition.items.length).toBe(itemsBefore);
  });

  it('removes only the Page node, groups become unassigned', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1').createdId!;
    project.addPage('Page 2');
    project.addGroup('contact', 'Contact');
    project.placeOnPage('contact', p1);
    project.addField('contact.name', 'Name', 'text');

    const itemsBefore = project.definition.items.length;
    project.removePage(p1);

    expect(findPageNode(project, p1)).toBeUndefined();
    expect(project.definition.items.length).toBe(itemsBefore);
    expect(project.itemAt('contact')?.type).toBe('group');
    expect(project.itemAt('contact.name')).toBeDefined();
  });
});
```

- [ ] **Step 2: Update `reorderPage` and `movePageToIndex` tests (lines 1514-1556)**

These just create pages and reorder — no group dependency. They should work as-is. Verify by running them.

- [ ] **Step 3: Update `pageStructure` test (line 2263)**

Read the test and update it to create groups explicitly before placing on pages.

- [ ] **Step 4: Update `behavioral page methods` helper and tests (lines 3220-3374)**

The `projectWithPageAndItems()` helper at line 3224 uses `result.groupKey`. Rewrite it:

```typescript
function projectWithPageAndItems() {
  const project = createProject();
  const pageId = project.addPage('Test Page').createdId!;
  project.addGroup('test_page', 'Test Page');
  project.placeOnPage('test_page', pageId);
  project.addField('test_page.name', 'Name', 'text');
  project.addField('test_page.email', 'Email', 'email');
  project.placeOnPage('name', pageId);
  project.placeOnPage('email', pageId);
  return { project, pageId, groupKey: 'test_page' };
}
```

Delete the `addPage returns groupKey` sub-describe at lines 3365-3374.

- [ ] **Step 5: Update `addContent page placement` tests (lines 2747-2788)**

Rewrite to explicitly create a group, place it on the page, then add content under the group:

```typescript
describe('addContent page placement', () => {
  it('adds content under a group placed on a page', () => {
    const project = createProject();
    const pageId = project.addPage('Page One').createdId!;
    project.addGroup('main', 'Main');
    project.placeOnPage('main', pageId);

    project.addContent('main.intro', 'Welcome', 'heading');

    const item = project.itemAt('main.intro');
    expect(item?.type).toBe('display');
    expect(item?.label).toBe('Welcome');
  });

  it('throws PAGE_NOT_FOUND when page does not exist', () => {
    const project = createProject();
    expect(() =>
      project.addContent('intro', 'Welcome', 'heading', { page: 'nonexistent' }),
    ).toThrow(HelperError);
  });
});
```

- [ ] **Step 6: Update `page prop auto-resolves to parentPath` tests (lines 2790-2832)**

These tests rely on the page having a paired group. They test the `{ page }` prop convenience which depends on `_resolvePageGroup`. Rewrite them to explicitly create a group on the page:

```typescript
describe('page prop auto-resolves to parentPath', () => {
  it('addField with props.page nests field under the page group', () => {
    const project = createProject();
    const pageId = project.addPage('Basics', undefined, 'basics').createdId!;
    project.addGroup('basics_group', 'Basics');
    project.placeOnPage('basics_group', pageId);

    project.addField('name', 'Full Name', 'text', { page: pageId });

    const item = project.itemAt('basics_group.name');
    expect(item).toBeDefined();
    expect(item?.label).toBe('Full Name');
  });

  it('explicit parentPath takes precedence over page prop', () => {
    const project = createProject();
    const pageId = project.addPage('Basics', undefined, 'basics').createdId!;
    project.addGroup('basics_group', 'Basics');
    project.placeOnPage('basics_group', pageId);
    project.addGroup('basics_group.contact', 'Contact');

    project.addField('phone', 'Phone', 'phone', { page: pageId, parentPath: 'basics_group.contact' });

    expect(project.itemAt('basics_group.contact.phone')).toBeDefined();
    expect(project.itemAt('basics_group.phone')).toBeUndefined();
  });

  it('addContent with props.page nests content under the page group', () => {
    const project = createProject();
    const pageId = project.addPage('Info', undefined, 'info').createdId!;
    project.addGroup('info_group', 'Info');
    project.placeOnPage('info_group', pageId);

    project.addContent('intro', 'Welcome', 'heading', { page: pageId });

    const item = project.itemAt('info_group.intro');
    expect(item).toBeDefined();
    expect(item?.type).toBe('display');
  });
});
```

- [ ] **Step 7: Update `addPage with layout items` test (line 3507-3519)**

```typescript
  it('adds a new field directly from the Layout workspace and places it on the active page', () => {
    const project = createProject();
    const pageId = project.addPage('Basics', undefined, 'basics').createdId!;

    const result = project.addItemToLayout({
      itemType: 'field',
      label: 'Email',
      dataType: 'string',
    }, pageId);

    expect(result.createdId).toBeDefined();
    expect(project.itemAt('email')?.type).toBe('field');
  });
```

- [ ] **Step 8: Run full project-methods test suite**

Run: `cd packages/formspec-studio-core && npx vitest run tests/project-methods.test.ts --reporter=verbose 2>&1 | tail -50`

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/formspec-studio-core/tests/project-methods.test.ts
git commit -m "test(studio-core): update page-dependent tests for standalone addPage"
```

---

### Task 4: Update remaining test files

**Files:**
- Modify: `packages/formspec-studio-core/tests/evaluation-helpers.test.ts`
- Modify: `packages/formspec-studio-core/tests/path-resolution.test.ts`
- Modify: `packages/formspec-studio-core/tests/schema-cross-ref.test.ts`
- Modify: `packages/formspec-studio/tests/workspaces/layout/layout-canvas.test.tsx`
- Modify: `packages/formspec-studio/tests/workspaces/layout/layout-dnd-provider.test.tsx`
- Modify: `packages/formspec-mcp/tests/structure.test.ts`
- Modify: `packages/formspec-mcp/tests/query.test.ts`

- [ ] **Step 1: Update evaluation-helpers.test.ts**

The `buildWizardForm` helper (line 627) and all `previewForm — per-page validation counts` tests create pages and add fields nested under the paired group. Each test needs: create group → addPage → placeOnPage → addField.

Example — rewrite `buildWizardForm`:
```typescript
  function buildWizardForm() {
    const project = createProject();
    project.addGroup('personal', 'Personal Info');
    project.addGroup('address', 'Address');
    const personalPage = project.addPage('Personal Info', undefined, 'personal').createdId!;
    const addressPage = project.addPage('Address', undefined, 'address').createdId!;
    project.placeOnPage('personal', personalPage);
    project.placeOnPage('address', addressPage);

    project.addField('personal.first_name', 'First Name', 'text');
    project.addField('personal.last_name', 'Last Name', 'text');
    project.require('personal.first_name');
    project.require('personal.last_name');

    project.addField('address.street', 'Street', 'text');
    project.addField('address.city', 'City', 'text');
    project.require('address.street');

    return project;
  }
```

Apply the same pattern to each individual test in that describe block (lines 671-793). Each test that calls `project.addPage('Title', undefined, 'id')` and then adds fields under `id.*` needs to:
1. `project.addGroup('id', 'Title')` before or after addPage
2. `project.placeOnPage('id', pageId)` to bind the group to the page

- [ ] **Step 2: Update path-resolution.test.ts**

The `addGroup page prop` tests (line 82) assume addPage creates a group with the given ID. Rewrite:

```typescript
describe('addGroup page prop', () => {
  it('places group on specified page via parentPath resolution', () => {
    const project = createProject();
    project.addGroup('page_1', 'Page 1');
    const pageId = project.addPage('Details', undefined, 'page_1').createdId!;
    project.placeOnPage('page_1', pageId);

    project.addGroup('details', 'Service Details', { page: pageId });

    const child = project.itemAt('page_1')?.children?.find((c: any) => c.key === 'details');
    expect(child).toBeDefined();
    expect(child?.type).toBe('group');
  });

  it('page prop with dot-path uses parentPath for nesting under page group', () => {
    const project = createProject();
    project.addGroup('page_1', 'Page 1');
    const pageId = project.addPage('Details', undefined, 'page_1').createdId!;
    project.placeOnPage('page_1', pageId);

    project.addGroup('parent', 'Parent', { page: pageId });
    project.addGroup('child', 'Child', { parentPath: 'page_1.parent' });
    expect(project.itemAt('page_1.parent.child')).toBeDefined();
  });
});
```

- [ ] **Step 3: Update schema-cross-ref.test.ts**

The `L7: addPage atomicity` test (line 276) asserts `definition.items.length > 0` after addPage. Update to only check the page node:

```typescript
describe('L7: addPage atomicity', () => {
  it('addPage undoes in one step', () => {
    const project = createProject();
    project.addPage('Step 1');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
    const comp = project.component as any;
    const pageNodes = (comp.tree?.children ?? []).filter((n: any) => n.component === 'Page');
    expect(pageNodes.length).toBe(1);
    // Single undo reverses the page + pageMode
    project.undo();
    const compAfter = project.component as any;
    const pageNodesAfter = (compAfter.tree?.children ?? []).filter((n: any) => n.component === 'Page');
    expect(pageNodesAfter.length).toBe(0);
  });
});
```

- [ ] **Step 4: Update layout-dnd-provider.test.tsx (line 29)**

```typescript
// Before:
const pageId = project.addPage('Step 1').createdId!;
// After (same — no group dependency):
const pageId = project.addPage('Step 1').createdId!;
```

This test only uses the pageId, so it should work as-is. Verify.

- [ ] **Step 5: Update MCP structure.test.ts (line 132-153)**

The test creates a page and uses its group to nest content. Rewrite:

```typescript
  it('places content on a page when props.page is provided', () => {
    const { registry, projectId, project } = registryWithProject();
    const pageId = project.addPage('Page One').createdId!;
    project.addGroup('main', 'Main');
    project.placeOnPage('main', pageId);

    const result = handleContent(registry, projectId, {
      path: 'main.intro',
      body: 'Welcome',
      kind: 'heading',
      props: { page: pageId },
    });

    expect(result.isError).toBeUndefined();
    const def = (project.core as any).state.definition;
    const group = (def.items ?? []).find((i: any) => i.key === 'main');
    expect(group).toBeDefined();
    const contentItem = (group.children ?? []).find((c: any) => c.key === 'intro');
    expect(contentItem).toBeDefined();
  });
```

- [ ] **Step 6: Update MCP query.test.ts (lines 76-90)**

Check if these tests rely on paired groups. If they just use the page IDs, they may work as-is. If they reference groups created by addPage, update similarly.

- [ ] **Step 7: Run all test suites**

```bash
cd packages/formspec-studio-core && npx vitest run --reporter=verbose 2>&1 | tail -30
cd packages/formspec-studio && npx vitest run tests/workspaces/layout/ --reporter=verbose 2>&1 | tail -30
cd packages/formspec-mcp && npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-studio-core/tests/ packages/formspec-studio/tests/ packages/formspec-mcp/tests/
git commit -m "test: update all page-dependent tests for standalone addPage"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: Clean build.

- [ ] **Step 2: Full test suite**

Run: `cd packages/formspec-studio-core && npx vitest run`

Run: `cd packages/formspec-mcp && npx vitest run`

Run: `cd packages/formspec-studio && npx vitest run`

Expected: All tests pass.

- [ ] **Step 3: Commit (if any fixups needed)**
