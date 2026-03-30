# Editor Workspace Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Studio's Logic and Data workspaces into the Editor workspace with a Build/Manage toggle, and replace the EditorPropertiesPanel right rail with a Form Health panel — per ADR 0055.

**Architecture:** Shell-owned `activeEditorView` state drives a binary toggle between Build view (existing DefinitionTreeEditor) and Manage view (new compositor absorbing LogicTab + DataTab content). The right rail switches from EditorPropertiesPanel to FormHealthPanel (Issues + Response Inspector + Simulation). Blueprint becomes context-aware and auto-switches views. Navigate-workspace event payloads extend to `{ tab, view?, section? }`.

**Tech Stack:** React, TypeScript, Vitest, Playwright, Tailwind CSS, @formspec-org/studio-core

**Spec:** `thoughts/adr/0055-studio-semantic-workspace-consolidation.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/workspaces/editor/BuildManageToggle.tsx` | Accessible `role="radiogroup"` segmented control for Build/Manage |
| `src/workspaces/editor/ManageView.tsx` | Scrollable page compositor: Option Sets, Variables, Data Sources, Screener, Binds Index, Shapes |
| `src/workspaces/editor/FormHealthPanel.tsx` | Right rail: Issues, Response Inspector (collapsible), Simulation (collapsible) |
| `tests/workspaces/editor/build-manage-toggle.test.tsx` | Unit tests for toggle ARIA, keyboard nav, state |
| `tests/workspaces/editor/manage-view.test.tsx` | Integration tests for Manage view sections rendering |
| `tests/workspaces/editor/form-health-panel.test.tsx` | Unit tests for Form Health panel sections |

### Major Edits
| File | Changes |
|------|---------|
| `src/components/Header.tsx` | Remove Logic and Data from TABS array (7→5 tabs) |
| `src/components/Shell.tsx` | Add `activeEditorView` state; remove Logic/Data from WORKSPACES + BLUEPRINT_SECTIONS_BY_TAB; swap right rail from EditorPropertiesPanel to FormHealthPanel; update navigate-workspace handler |
| `src/components/Blueprint.tsx` | Add `activeEditorView` prop; update link targets for Variables/DataSources/OptionSets to dispatch `{ tab: 'Editor', view: 'manage' }`; context-aware link rendering |
| `src/components/blueprint/VariablesList.tsx` | Update navigate-workspace dispatch from `{ tab: 'Logic' }` to `{ tab: 'Editor', view: 'manage' }` |

### Test Updates
| File | Action |
|------|--------|
| `tests/components/header.test.tsx:109` | Change `Logic` tab assertion to `Layout` |
| `tests/integration/editor-layout-split.test.tsx:252-286` | Rewrite EditorPropertiesPanel tests → Form Health panel |
| `tests/integration/logic-workflow.test.tsx` | Rewrite to test sections in ManageView context |
| `tests/integration/data-workflow.test.tsx` | Rewrite to test sections split across ManageView + FormHealthPanel |
| `tests/workspaces/editor/properties/editor-properties-panel.test.tsx` | Delete (component removed from Editor) |
| `tests/e2e/playwright/workspace-navigation.spec.ts` | Remove Logic/Data tab tests, add Build/Manage toggle tests |
| `tests/e2e/playwright/data-workspace.spec.ts` | Delete (Data tab no longer exists) |
| `tests/e2e/playwright/logic-authoring.spec.ts` | Rewrite as Manage view tests |
| `tests/e2e/playwright/workspace-state-persistence.spec.ts` | Rewrite Data persistence → Manage view persistence |
| `tests/e2e/playwright/cross-workspace-authoring.spec.ts` | Update Logic/Data steps to use Editor Manage view |

### Files NOT Deleted (components reused)
The individual section components (`VariablesSection`, `BindsSection`, `ShapesSection`, `DataSources`, `OptionSets`, `ResponseSchema`, `TestResponse`, `FilterBar`) stay in their current directories but are imported by the new ManageView and FormHealthPanel compositors. Only the *Tab* compositors (`LogicTab.tsx`, `DataTab.tsx`) are superseded. We leave the old files in place for now and can clean them up later — they remain valid standalone components.

---

## Task 1: Header — Remove Logic and Data Tabs

**Files:**
- Modify: `packages/formspec-studio/src/components/Header.tsx:7-15`
- Test: `packages/formspec-studio/tests/components/header.test.tsx`

- [ ] **Step 1: Write failing test — header renders 5 tabs, not 7**

In `tests/components/header.test.tsx`, add before the closing `});`:

```tsx
it('renders exactly 5 workspace tabs (Editor, Layout, Theme, Mapping, Preview)', () => {
  renderHeader();
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(5);
  expect(tabs.map(t => t.textContent)).toEqual(['Editor', 'Layout', 'Theme', 'Mapping', 'Preview']);
});

it('does not render Logic or Data tabs', () => {
  renderHeader();
  expect(screen.queryByRole('tab', { name: 'Logic' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Data' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/components/header.test.tsx --reporter=verbose`
Expected: FAIL — currently 7 tabs, Logic and Data exist.

- [ ] **Step 3: Remove Logic and Data from TABS array**

In `src/components/Header.tsx`, change lines 7-15 from:

```tsx
const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Definition tree — items, types, and data binds' },
  { name: 'Logic', help: 'Binds, shapes, and variables — all form logic lives here' },
  { name: 'Data', help: 'Response schema, data sources, option sets, and test data' },
  { name: 'Layout', help: 'Visual form builder — pages, layout containers, and widget selection' },
  { name: 'Theme', help: 'Visual tokens, defaults, selectors, and widget policy' },
  { name: 'Mapping', help: 'Bidirectional data transforms for import/export formats' },
  { name: 'Preview', help: 'Live form preview and JSON document view' },
];
```

To:

```tsx
const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Build your form structure and manage shared resources' },
  { name: 'Layout', help: 'Visual form builder — pages, layout containers, and widget selection' },
  { name: 'Theme', help: 'Visual tokens, defaults, selectors, and widget policy' },
  { name: 'Mapping', help: 'Bidirectional data transforms for import/export formats' },
  { name: 'Preview', help: 'Live form preview and JSON document view' },
];
```

- [ ] **Step 4: Fix existing test that references Logic tab**

In `tests/components/header.test.tsx`, update the test at line 105-115:

Change `const logicTab = screen.getByRole('tab', { name: 'Logic' });` to `const layoutTab = screen.getByRole('tab', { name: 'Layout' });` and update the assertion from `expect(logicTab)` to `expect(layoutTab)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/components/header.test.tsx --reporter=verbose`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-studio/src/components/Header.tsx packages/formspec-studio/tests/components/header.test.tsx
git commit -m "feat(studio): remove Logic and Data from header tab bar (ADR 0055)"
```

---

## Task 2: BuildManageToggle Component

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/BuildManageToggle.tsx`
- Create: `packages/formspec-studio/tests/workspaces/editor/build-manage-toggle.test.tsx`

- [ ] **Step 1: Write failing tests for the toggle**

Create `tests/workspaces/editor/build-manage-toggle.test.tsx`:

```tsx
/** @filedesc Unit tests for the Build/Manage segmented control. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildManageToggle } from '../../../src/workspaces/editor/BuildManageToggle';

describe('BuildManageToggle', () => {
  it('renders a radiogroup with Build and Manage options', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: /editor view/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Manage' })).toBeInTheDocument();
  });

  it('marks Build as checked when activeView is build', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks Manage as checked when activeView is manage', () => {
    render(<BuildManageToggle activeView="manage" onViewChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onViewChange when clicking the other option', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Manage' }));
    expect(onChange).toHaveBeenCalledWith('manage');
  });

  it('does not call onViewChange when clicking the already-active option', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Build' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports arrow key navigation between options', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    const buildRadio = screen.getByRole('radio', { name: 'Build' });
    fireEvent.keyDown(buildRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('manage');
  });

  it('wraps around with arrow keys', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="manage" onViewChange={onChange} />);
    const manageRadio = screen.getByRole('radio', { name: 'Manage' });
    fireEvent.keyDown(manageRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('build');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/build-manage-toggle.test.tsx --reporter=verbose`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BuildManageToggle**

Create `src/workspaces/editor/BuildManageToggle.tsx`:

```tsx
/** @filedesc Accessible Build/Manage segmented control for the Editor workspace (role="radiogroup"). */

export type EditorView = 'build' | 'manage';

interface BuildManageToggleProps {
  activeView: EditorView;
  onViewChange: (view: EditorView) => void;
}

const OPTIONS: { id: EditorView; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'manage', label: 'Manage' },
];

export function BuildManageToggle({ activeView, onViewChange }: BuildManageToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent, current: EditorView) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const next: EditorView = current === 'build' ? 'manage' : 'build';
    onViewChange(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Editor view"
      className="inline-flex items-center gap-1 rounded-[14px] border border-border bg-subtle/50 p-1"
    >
      {OPTIONS.map(({ id, label }) => {
        const isActive = activeView === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => { if (!isActive) onViewChange(id); }}
            onKeyDown={(e) => handleKeyDown(e, id)}
            className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
              isActive
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/build-manage-toggle.test.tsx --reporter=verbose`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/BuildManageToggle.tsx packages/formspec-studio/tests/workspaces/editor/build-manage-toggle.test.tsx
git commit -m "feat(studio): add BuildManageToggle component with radiogroup a11y (ADR 0055)"
```

---

## Task 3: ManageView Compositor

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/ManageView.tsx`
- Create: `packages/formspec-studio/tests/workspaces/editor/manage-view.test.tsx`

- [ ] **Step 1: Write failing tests for ManageView rendering sections**

Create `tests/workspaces/editor/manage-view.test.tsx`:

```tsx
/** @filedesc Integration tests for the Manage view compositor. */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { ManageView } from '../../../src/workspaces/editor/ManageView';

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>{children}</ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}

const RICH_DEF = {
  $formspec: '1.0', url: 'urn:manage-test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
  ],
  variables: [{ name: 'total', expression: '42' }],
  optionSets: { colors: { options: [{ value: 'r', label: 'Red' }] } },
  instances: { lookup: { source: 'https://example.com' } },
  binds: [{ path: 'name', required: 'true' }],
  shapes: [{ id: 'shape1', severity: 'error', constraint: '$name != ""' }],
};

describe('ManageView', () => {
  it('renders section anchors for all Manage sections', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);

    expect(screen.getByTestId('manage-section-option-sets')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-variables')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-data-sources')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-screener')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-binds-index')).toBeInTheDocument();
    expect(screen.getByTestId('manage-section-shapes')).toBeInTheDocument();
  });

  it('renders variables from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('@total')).toBeInTheDocument();
  });

  it('renders option sets from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('colors')).toBeInTheDocument();
  });

  it('renders data sources from definition', () => {
    const project = createProject({ seed: { definition: RICH_DEF } });
    render(<Providers project={project}><ManageView /></Providers>);
    expect(screen.getByText('lookup')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/manage-view.test.tsx --reporter=verbose`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ManageView**

Create `src/workspaces/editor/ManageView.tsx`:

```tsx
/** @filedesc Manage view compositor — shared resources and cross-cutting logic views. */
import { useMemo } from 'react';
import { normalizeBindsView, buildDefLookup } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { VariablesSection } from '../logic/VariablesSection';
import { BindsSection } from '../logic/BindsSection';
import { ShapesSection } from '../logic/ShapesSection';
import { FilterBar } from '../logic/FilterBar';
import { OptionSets } from '../data/OptionSets';
import { DataSources } from '../data/DataSources';
import { ScreenerSection } from '../../components/blueprint/ScreenerSection';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { HelpTip } from '../../components/ui/HelpTip';
import { useState } from 'react';

function ManagePillar({
  id,
  title,
  subtitle,
  helpText,
  children,
  accentColor = 'bg-accent',
}: {
  id: string;
  title: string;
  subtitle: string;
  helpText: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <section
      id={id}
      data-testid={`manage-section-${id}`}
      className="mb-12 last:mb-0 scroll-mt-20"
    >
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-1 h-5 rounded-full ${accentColor}`} />
          <h3 className="font-mono text-[13px] font-bold tracking-[0.2em] uppercase text-ink">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <HelpTip text={helpText}>
            <span className="text-[12px] text-muted italic tracking-tight">{subtitle}</span>
          </HelpTip>
        </div>
      </header>
      <div className="pl-6 border-l border-border/60 ml-0.5 mt-4">
        {children}
      </div>
    </section>
  );
}

export function ManageView() {
  const definition = useDefinition();
  const { select } = useSelection();
  const [activeBindFilter, setActiveBindFilter] = useState<
    'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly' | 'pre-populate' | null
  >(null);

  const binds = normalizeBindsView(definition?.binds, definition?.items ?? []);
  const shapes = Array.isArray(definition?.shapes)
    ? definition.shapes.map((s: any) => ({ name: s.id, ...s }))
    : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  const fieldPaths = useMemo(() => {
    if (!definition?.items) return [];
    const lookup = buildDefLookup(definition.items);
    return Array.from(lookup.keys());
  }, [definition?.items]);

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection className="flex-1 py-10">
        <ManagePillar
          id="option-sets"
          title="Option Sets"
          subtitle="Shared choice lists referenced by fields"
          helpText="Reusable lists of options that multiple choice/multiChoice fields can reference."
          accentColor="bg-logic"
        >
          <OptionSets />
        </ManagePillar>

        <ManagePillar
          id="variables"
          title="Calculated Values"
          subtitle="Form-level constants and expressions"
          helpText="Global variables and reusable FEL expressions. Reference them anywhere using the @ prefix."
          accentColor="bg-accent"
        >
          <VariablesSection variables={variables} />
        </ManagePillar>

        <ManagePillar
          id="data-sources"
          title="Data Sources"
          subtitle="External data references for lookups"
          helpText="External data sources (Instances) that FEL expressions @instance('name') can reference."
          accentColor="bg-green"
        >
          <DataSources />
        </ManagePillar>

        <ManagePillar
          id="screener"
          title="Screener & Routes"
          subtitle="Pre-qualification routing"
          helpText="Routing mechanism with screening items and ordered route rules."
          accentColor="bg-amber"
        >
          <ScreenerSection />
        </ManagePillar>

        <ManagePillar
          id="binds-index"
          title="Field Behaviors"
          subtitle="All behavior rules across the form"
          helpText="Cross-cutting index of all field-level behavior rules. Click a row to jump to the field in Build view."
          accentColor="bg-logic"
        >
          <div className="mb-6">
            <FilterBar binds={binds} activeFilter={activeBindFilter} onFilterSelect={setActiveBindFilter} />
          </div>
          <BindsSection
            binds={binds}
            activeFilter={activeBindFilter}
            allPaths={fieldPaths}
            onSelectPath={(path) => select(path, 'field', { tab: 'editor' })}
          />
        </ManagePillar>

        <ManagePillar
          id="shapes"
          title="Validation Rules"
          subtitle="Cross-field constraints"
          helpText="Advanced form-wide constraints that validate relationships between fields."
          accentColor="bg-error"
        >
          <ShapesSection shapes={shapes} />
        </ManagePillar>
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/manage-view.test.tsx --reporter=verbose`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/ManageView.tsx packages/formspec-studio/tests/workspaces/editor/manage-view.test.tsx
git commit -m "feat(studio): add ManageView compositor absorbing Logic + Data sections (ADR 0055)"
```

---

## Task 4: FormHealthPanel Stub

**Files:**
- Create: `packages/formspec-studio/src/workspaces/editor/FormHealthPanel.tsx`
- Create: `packages/formspec-studio/tests/workspaces/editor/form-health-panel.test.tsx`

- [ ] **Step 1: Write failing tests for Form Health panel**

Create `tests/workspaces/editor/form-health-panel.test.tsx`:

```tsx
/** @filedesc Unit tests for the Form Health panel (right rail). */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { FormHealthPanel } from '../../../src/workspaces/editor/FormHealthPanel';

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>{children}</ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}

describe('FormHealthPanel', () => {
  it('renders Issues section by default', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText(/issues/i)).toBeInTheDocument();
  });

  it('renders Response Inspector section (collapsed)', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText(/response inspector/i)).toBeInTheDocument();
  });

  it('renders Simulation section (collapsed)', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText(/simulation/i)).toBeInTheDocument();
  });

  it('shows "No issues found" when form is valid', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('expands Response Inspector when clicked', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    fireEvent.click(screen.getByText(/response inspector/i));
    expect(screen.getByTestId('response-inspector-content')).toBeInTheDocument();
  });

  it('expands Simulation when clicked', () => {
    const project = createProject();
    render(<Providers project={project}><FormHealthPanel /></Providers>);
    fireEvent.click(screen.getByText(/simulation/i));
    expect(screen.getByTestId('simulation-content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/form-health-panel.test.tsx --reporter=verbose`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement FormHealthPanel**

Create `src/workspaces/editor/FormHealthPanel.tsx`:

```tsx
/** @filedesc Form Health panel — Issues, Response Inspector, and Simulation in the Editor right rail. */
import { useState } from 'react';
import { ResponseSchema } from '../data/ResponseSchema';
import { TestResponse } from '../data/TestResponse';

function CollapsibleSection({
  title,
  testId,
  defaultOpen = false,
  children,
}: {
  title: string;
  testId: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-[13px] font-semibold text-ink transition-colors hover:bg-subtle/50"
        aria-expanded={open}
      >
        {title}
        <span className={`text-[10px] text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {open && (
        <div data-testid={testId} className="px-5 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function FormHealthPanel() {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
        <h2 className="text-[15px] font-semibold text-ink tracking-tight font-ui">
          Form Health
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Is your form ready to publish?
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Issues — always visible */}
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">
            Issues
          </h3>
          <div className="text-[13px] text-muted italic">
            No issues found. Your form looks good.
          </div>
        </div>

        {/* Response Inspector — collapsible */}
        <CollapsibleSection title="Response Inspector" testId="response-inspector-content">
          <ResponseSchema />
        </CollapsibleSection>

        {/* Simulation — collapsible */}
        <CollapsibleSection title="Simulation" testId="simulation-content">
          <TestResponse />
        </CollapsibleSection>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/form-health-panel.test.tsx --reporter=verbose`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio/src/workspaces/editor/FormHealthPanel.tsx packages/formspec-studio/tests/workspaces/editor/form-health-panel.test.tsx
git commit -m "feat(studio): add FormHealthPanel stub with Issues, Response Inspector, Simulation (ADR 0055)"
```

---

## Task 5: Shell — Wire Everything Together

This is the structural hub. Add `activeEditorView` state, remove Logic/Data from WORKSPACES, swap the right rail, and render the Build/Manage toggle + conditional content.

**Files:**
- Modify: `packages/formspec-studio/src/components/Shell.tsx`
- Test: run full existing test suite to verify no regressions

- [ ] **Step 1: Run existing Shell/smoke tests to establish baseline**

Run: `cd packages/formspec-studio && npx vitest run tests/smoke.test.tsx tests/integration/editor-layout-split.test.tsx --reporter=verbose`
Expected: PASS — clean baseline.

- [ ] **Step 2: Update Shell.tsx — imports**

In `Shell.tsx`, replace the LogicTab, DataTab, and EditorPropertiesPanel imports:

Remove:
```tsx
import { LogicTab } from '../workspaces/logic/LogicTab';
import { DataTab, type DataSectionFilter } from '../workspaces/data/DataTab';
import { EditorPropertiesPanel } from '../workspaces/editor/properties/EditorPropertiesPanel';
```

Add:
```tsx
import { ManageView } from '../workspaces/editor/ManageView';
import { FormHealthPanel } from '../workspaces/editor/FormHealthPanel';
import { BuildManageToggle, type EditorView } from '../workspaces/editor/BuildManageToggle';
```

- [ ] **Step 3: Update WORKSPACES and BLUEPRINT_SECTIONS_BY_TAB**

Replace the `WORKSPACES` constant (lines 40-48):

```tsx
const WORKSPACES: Record<string, React.FC> = {
  Editor: DefinitionTreeEditor,
  Layout: LayoutCanvas,
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};
```

Replace `BLUEPRINT_SECTIONS_BY_TAB` (lines 62-70):

```tsx
const BLUEPRINT_SECTIONS_BY_TAB: Record<string, string[]> = {
  Editor: ['Structure', 'Variables', 'Data Sources', 'Option Sets', 'Screener', 'Settings'],
  Layout: ['Structure', 'Component Tree', 'Screener', 'Variables', 'Data Sources', 'Option Sets', 'Mappings', 'Settings', 'Theme'],
  Theme: ['Theme', 'Structure', 'Settings'],
  Mapping: ['Mappings', 'Structure', 'Data Sources', 'Option Sets', 'Settings'],
  Preview: ['Structure', 'Component Tree', 'Theme', 'Settings'],
};
```

- [ ] **Step 4: Add activeEditorView state and remove DataSectionFilter state**

In the Shell function, after line 77 (`const [activeTab, setActiveTab] = ...`), add:

```tsx
const [activeEditorView, setActiveEditorView] = useState<EditorView>('build');
```

Remove the `activeDataFilter` state line:
```tsx
// DELETE: const [activeDataFilter, setActiveDataFilter] = useState<DataSectionFilter>('all');
```

- [ ] **Step 5: Update workspaceContent switch to handle Editor Build/Manage**

Replace the `workspaceContent` block (lines 122-154):

```tsx
const workspaceContent = (() => {
  if (activeTab === 'Editor') {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/80 backdrop-blur-md px-6 py-3">
          <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
        </div>
      </div>
    );
  }
  switch (activeTab) {
    case 'Mapping':
      return (
        <MappingTab
          activeTab={activeMappingTab}
          onActiveTabChange={setActiveMappingTab}
          configOpen={mappingConfigOpen}
          onConfigOpenChange={setMappingConfigOpen}
        />
      );
    case 'Preview':
      return (
        <PreviewTab
          viewport={previewViewport}
          onViewportChange={setPreviewViewport}
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
      );
    default: {
      const WorkspaceComponent = WORKSPACES[activeTab];
      return WorkspaceComponent ? <WorkspaceComponent /> : activeTab;
    }
  }
})();
```

- [ ] **Step 6: Update right rail — FormHealthPanel replaces EditorPropertiesPanel**

Replace the right rail aside (lines 403-412):

```tsx
{activeTab === 'Editor' && (
  <aside
    className={`w-[320px] border-l border-border/80 bg-surface overflow-y-auto shrink-0 ${compactLayout || showChatPanel ? 'hidden' : ''}`}
    data-testid="properties-panel"
    data-responsive-hidden={compactLayout ? 'true' : 'false'}
    aria-label="Form health panel"
  >
    <FormHealthPanel />
  </aside>
)}
{activeTab === 'Layout' && (
  <aside
    className={`w-[320px] border-l border-border/80 bg-surface overflow-y-auto shrink-0 ${compactLayout || showChatPanel ? 'hidden' : ''}`}
    data-testid="properties-panel"
    data-responsive-hidden={compactLayout ? 'true' : 'false'}
    aria-label="Properties panel"
  >
    <ComponentProperties />
  </aside>
)}
```

- [ ] **Step 7: Update handleNewForm to reset activeEditorView**

In `handleNewForm` (line 275-286), add `setActiveEditorView('build');` and remove `setActiveDataFilter('all');`.

- [ ] **Step 8: Update navigate-workspace event handler**

Replace the event handler (lines 204-216):

```tsx
useEffect(() => {
  const onNavigateWorkspace = (event: Event) => {
    const detail = (event as CustomEvent<{ tab?: string; subTab?: string; view?: EditorView; section?: string }>).detail ?? {};
    const { tab, subTab, view } = detail;
    // Editor is special-cased in render (not in WORKSPACES map), so accept it explicitly
    if (tab && (tab === 'Editor' || WORKSPACES[tab])) {
      setActiveTab(tab);
      if (tab === 'Editor' && view) {
        setActiveEditorView(view);
      }
      if (subTab) {
        if (tab === 'Mapping') setActiveMappingTab(subTab as MappingTabId);
      }
    }
  };
  window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
}, []);
```

- [ ] **Step 9: Update compact layout properties modal**

Update the compact properties modal section (lines 459-499) to only show for Layout tab (since Editor no longer has a properties panel — it has the Form Health panel, which can stay in the right rail or become a bottom sheet later):

Change `{compactLayout && (activeTab === 'Editor' || activeTab === 'Layout') && showPropertiesModal && selectedKey && (` to `{compactLayout && activeTab === 'Layout' && showPropertiesModal && selectedKey && (`.

Remove `{activeTab === 'Editor' ? <EditorPropertiesPanel showActions={false} /> : <ComponentProperties />}` and replace with just `<ComponentProperties />`.

- [ ] **Step 10: Run tests to verify**

Run: `cd packages/formspec-studio && npx vitest run tests/smoke.test.tsx --reporter=verbose`
Expected: PASS or known failures from tests that still reference Logic/Data tabs (will be fixed in Task 7).

- [ ] **Step 11: Commit**

```bash
git add packages/formspec-studio/src/components/Shell.tsx
git commit -m "feat(studio): wire Build/Manage toggle, ManageView, and FormHealthPanel into Shell (ADR 0055)"
```

---

## Task 6: Blueprint — Context-Aware Navigation

**Files:**
- Modify: `packages/formspec-studio/src/components/Blueprint.tsx`
- Modify: `packages/formspec-studio/src/components/blueprint/VariablesList.tsx`
- Modify: `packages/formspec-studio/src/components/Shell.tsx` (pass `activeEditorView` to Blueprint)

- [ ] **Step 1: Update Blueprint to accept activeEditorView prop**

In `Blueprint.tsx`, update the interface and component:

```tsx
interface BlueprintProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  sections?: readonly string[];
  activeEditorView?: 'build' | 'manage';
}
```

- [ ] **Step 2: Update SECTIONS link targets**

In `Blueprint.tsx`, change the `link` properties on SECTIONS:

```tsx
{ name: 'Variables', countFn: (s) => s.definition.variables?.length ?? 0, help: 'Named computed values reusable across expressions', link: { tab: 'Editor', view: 'manage' } },
{ name: 'Data Sources', countFn: (s) => Object.keys(s.definition.instances ?? {}).length, help: 'Secondary data instances for lookups and reference data', link: { tab: 'Editor', view: 'manage' } },
{ name: 'Option Sets', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length, help: 'Reusable option lists for choice and multiChoice fields', link: { tab: 'Editor', view: 'manage' } },
```

Update the `SectionDef` interface:

```tsx
interface SectionDef {
  name: string;
  countFn: ((state: ReturnType<typeof useProjectState>) => number) | null;
  help: string;
  link?: { tab: string; subTab?: string; view?: string };
}
```

- [ ] **Step 3: Hide link icon when already in the target view**

In the link button rendering (line 103-117), add a condition:

```tsx
{link && !(activeEditorView === link.view && link.tab === 'Editor') && (
```

This hides the external-link icon when the user is already in the Manage view and the link points to Manage.

- [ ] **Step 4: Pass activeEditorView from Shell to Blueprint**

In `Shell.tsx`, update all three `<Blueprint ...>` render sites to add `activeEditorView={activeEditorView}`.

- [ ] **Step 5: Update VariablesList.tsx navigate dispatch**

In `src/components/blueprint/VariablesList.tsx`, find the `formspec:navigate-workspace` dispatch and change `{ tab: 'Logic' }` to `{ tab: 'Editor', view: 'manage' }`.

- [ ] **Step 6: Run Blueprint tests**

Run: `cd packages/formspec-studio && npx vitest run tests/components/blueprint.test.tsx --reporter=verbose`
Expected: PASS (or adjust if tests assert on old link targets).

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-studio/src/components/Blueprint.tsx packages/formspec-studio/src/components/blueprint/VariablesList.tsx packages/formspec-studio/src/components/Shell.tsx
git commit -m "feat(studio): Blueprint context-aware navigation for Build/Manage views (ADR 0055)"
```

---

## Task 7: Fix Broken Tests

This task systematically fixes all tests broken by the structural changes in Tasks 1-6.

**Files:** Multiple test files (see list below)

- [ ] **Step 1: Fix editor-layout-split.test.tsx**

In `tests/integration/editor-layout-split.test.tsx`:
- Remove the import of `EditorPropertiesPanel` (line 10)
- Rewrite the `"Editor properties shows only definition props"` describe block (lines 252-286) to test that `FormHealthPanel` renders in the right rail instead. Or simply delete those tests — the FormHealthPanel has its own test file now.

```tsx
// Remove import: import { EditorPropertiesPanel } from '../../src/workspaces/editor/properties/EditorPropertiesPanel';
// Add import:
import { FormHealthPanel } from '../../src/workspaces/editor/FormHealthPanel';

// Replace the "Editor properties" describe block:
describe('Editor right rail shows Form Health panel', () => {
  it('shows Issues and Response Inspector sections', () => {
    render(
      <Providers project={makeProject(BOUND_DEF)}>
        <FormHealthPanel />
      </Providers>,
    );
    expect(screen.getByText(/issues/i)).toBeInTheDocument();
    expect(screen.getByText(/response inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fix logic-workflow.test.tsx**

Replace `<LogicTab />` with `<ManageView />` in the render calls. The ManageView compositor contains all the same sections (VariablesSection, BindsSection, ShapesSection) so the same assertions should work. Update the import from `'../../src/workspaces/logic/LogicTab'` to `'../../src/workspaces/editor/ManageView'`. If the test used LogicTab-specific filter UI (the "All Logic / Values / Behaviors / Rules" segmented control), remove those assertions — ManageView renders all sections in a single scroll.

```tsx
// Replace:
import { LogicTab } from '../../src/workspaces/logic/LogicTab';
// With:
import { ManageView } from '../../src/workspaces/editor/ManageView';

// In each test, replace:
render(<Providers project={project}><LogicTab /></Providers>);
// With:
render(<Providers project={project}><ManageView /></Providers>);
```

- [ ] **Step 3: Fix data-workflow.test.tsx**

Replace `<DataTab />` renders with the appropriate new host component. Tests that verify OptionSets or DataSources rendering should render `<ManageView />`. Tests that verify ResponseSchema or TestResponse should render `<FormHealthPanel />`.

```tsx
// Replace:
import { DataTab } from '../../src/workspaces/data/DataTab';
// With:
import { ManageView } from '../../src/workspaces/editor/ManageView';
import { FormHealthPanel } from '../../src/workspaces/editor/FormHealthPanel';

// For option set / data source tests:
render(<Providers project={project}><ManageView /></Providers>);

// For response schema / simulation tests:
render(<Providers project={project}><FormHealthPanel /></Providers>);
// Note: Response Inspector and Simulation are collapsed by default —
// click the section header to expand before asserting on content.
```

- [ ] **Step 4: Delete editor-properties-panel.test.tsx**

The EditorPropertiesPanel is no longer rendered in the Editor workspace. Delete `tests/workspaces/editor/properties/editor-properties-panel.test.tsx`.

- [ ] **Step 5: Run full unit/integration test suite**

Run: `cd packages/formspec-studio && npx vitest run --reporter=verbose`
Expected: PASS — all tests green (E2E tests are separate).

- [ ] **Step 6: Commit**

```bash
git add -u packages/formspec-studio/tests/
git commit -m "test(studio): fix broken tests after workspace consolidation (ADR 0055)"
```

---

## Task 8: Fix E2E Tests

**Files:** Multiple E2E test files

- [ ] **Step 1: Update workspace-navigation.spec.ts**

Remove tests that navigate to Logic or Data tabs. Add tests for Build/Manage toggle visibility within Editor.

- [ ] **Step 2: Update workspace-state-persistence.spec.ts**

Rewrite Data workspace persistence tests to verify Build/Manage view persistence: switch to Manage, go to Layout, come back to Editor — should still show Manage.

- [ ] **Step 3: Rewrite logic-authoring.spec.ts → editor-manage-authoring.spec.ts**

Replace `switchTab(page, 'Logic')` with navigating to Editor and clicking Manage toggle. Update all assertions from `workspace-Logic` to `workspace-Editor` with Manage view active.

- [ ] **Step 4: Rewrite data-workspace.spec.ts → editor-form-health.spec.ts**

Replace Data tab tests with Form Health panel tests (Response Inspector, Simulation sections).

- [ ] **Step 5: Update cross-workspace-authoring.spec.ts**

Replace Logic/Data tab navigation steps with Editor Manage view navigation.

- [ ] **Step 6: Run full E2E suite**

Run: `cd packages/formspec-studio && npx playwright test --timeout=5000`
Expected: PASS — all E2E tests green.

- [ ] **Step 7: Commit**

```bash
git add -u packages/formspec-studio/tests/e2e/
git commit -m "test(studio): update E2E tests for workspace consolidation (ADR 0055)"
```

---

## Task 9: Final Verification and Cleanup

- [ ] **Step 1: Run full unit/integration suite**

Run: `cd packages/formspec-studio && npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 2: Run full E2E suite**

Run: `cd packages/formspec-studio && npx playwright test --timeout=5000`
Expected: PASS

- [ ] **Step 3: Run dependency fence check**

Run: `npm run check:deps`
Expected: PASS — no new violations.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS — TypeScript compiles cleanly.

- [ ] **Step 5: Final commit with any remaining fixes**

```bash
git add -A
git commit -m "chore(studio): final cleanup for workspace consolidation (ADR 0055)"
```
