# Formspec Studio — Comprehensive Tightening Plan

All findings from three rounds of research and two scout validations integrated. File paths, line ranges, selectors, and dependencies are exact.

---

## Phase 0: Baseline

```bash
cd packages/formspec-studio
npm run build && npm test && npx playwright test
```

All green before starting. Re-run after every phase.

---

## Phase 1: `@utility` extraction — mechanical, zero behavioral change

**Target:** Every repeated inline style pattern becomes a named `@utility`. After this phase, `grep` for old patterns returns zero hits in `src/`.

### 1a. `focus-ring` (~91 replacements)

`src/index.css` — add after existing `@utility` block:

```css
@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--studio-color-accent);
    outline-offset: -2px;
  }
}
```

Replace every inline focus variant:
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/10`
- `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70` → unify to `focus-ring`
- All above with trailing `focus-visible:ring-inset` → drop `ring-inset`, keep `focus-ring`

Files hit (exhaustive):

```
src/studio-app/UnifiedStudio.tsx
src/components/Shell.tsx
src/components/Header.tsx
src/components/StatusBar.tsx
src/components/ModeToggle.tsx
src/components/AssistantEntryMenu.tsx
src/components/ImportDialog.tsx
src/components/AskAIContextMenu.tsx
src/components/AppSettingsDialog.tsx
src/components/PublishDialog.tsx
src/components/PreviewCompanionPanel.tsx
src/components/CommandPalette.tsx
src/components/ui/OptionsModal.tsx
src/components/ui/DragHandle.tsx
src/components/blueprint/StructureTree.tsx
src/components/blueprint/VariablesList.tsx
src/components/ui/FELAutocompleteMenu.tsx
src/components/ui/HelpTip.tsx
src/workspaces/editor/BuildManageToggle.tsx
src/workspaces/editor/GroupNode.tsx
src/workspaces/editor/ItemRow.tsx
src/workspaces/editor/ItemListEditor.tsx
src/workspaces/editor/WrapInGroupDialog.tsx
src/workspaces/editor/properties/EditorPropertiesPanel.tsx
src/workspaces/layout/LayoutStepNav.tsx
src/workspaces/layout/LayoutPageSection.tsx
src/workspaces/layout/LayoutContainer.tsx
src/workspaces/layout/DirtyGuardConfirm.tsx
src/workspaces/layout/PropertyPopover.tsx
src/workspaces/layout/ThemeOverridePopover.tsx
src/workspaces/layout/InlineToolbar.tsx
src/workspaces/layout/UnassignedTray.tsx
src/workspaces/layout/DefinitionCopyReadonlyPanel.tsx
src/workspaces/mapping/MappingConfig.tsx
src/workspaces/mapping/RuleCard.tsx
src/workspaces/preview/PreviewTab.tsx
src/workspaces/preview/ViewportSwitcher.tsx
src/workspaces/shared/SectionFilterBar.tsx
src/workspaces/shared/item-row-shared.tsx
src/workspaces/evidence/EvidenceWorkspace.tsx
src/workspaces/theme/ColorPalette.tsx
src/workspaces/design-system/BrandColorsSection.tsx
src/workspaces/design-system/TextSizesSection.tsx
src/components/chat/ChatMessageList.tsx
src/components/AddItemPalette.tsx
src/components/ProposedArtifactBlock.tsx
src/components/ChatPanel.tsx
src/components/SettingsDialog.tsx
```

### 1b. `panel-aside` (4 replacements)

```css
@utility panel-aside {
  @apply flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-surface;
}
```

| File:Line | Old | New |
|-----------|-----|-----|
| `Shell.tsx:322` | `className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-surface"` | `className="panel-aside"` |
| `Shell.tsx:358` | same | `className="panel-aside"` |
| `UnifiedStudio.tsx:657` | same | `className="panel-aside"` |
| `PreviewCompanionPanel.tsx:17` | same | `className="panel-aside"` |

### 1c. `panel-close-btn` (4 replacements)

```css
@utility panel-close-btn {
  @apply rounded p-1 text-muted hover:text-ink hover:bg-subtle transition-colors focus-ring;
}
```

| File:Line | Replace |
|-----------|---------|
| `Shell.tsx:331` | → `className="panel-close-btn"` |
| `Shell.tsx:367` | → `className="panel-close-btn"` |
| `UnifiedStudio.tsx:665` | → `className="panel-close-btn"` |
| `PreviewCompanionPanel.tsx:29` | → `className="panel-close-btn"` |

### 1d. `dropdown-panel` (4 replacements)

```css
@utility dropdown-panel {
  @apply absolute z-50 rounded border border-border bg-surface shadow-sm p-1;
}
```

| File:Line | Transform |
|-----------|-----------|
| `Header.tsx:181` | `"absolute right-0 top-full z-50 mt-2 w-64 p-1 rounded border border-border bg-surface shadow-sm"` → `"right-0 top-full mt-2 w-64 dropdown-panel"` |
| `StatusBar.tsx:165` | → `"bottom-full left-0 mb-2 w-64 dropdown-panel"` |
| `MappingConfig.tsx:95` | → `"right-0 top-full mt-1 min-w-[130px] shadow-md dropdown-panel"` |
| `RuleCard.tsx:118` | → `"right-0 top-full z-30 mt-1 min-w-[130px] shadow-md dropdown-panel"` (keep `z-30` override) |

### 1e. `status-chip` (3 replacements)

```css
@utility status-chip {
  @apply shrink-0 rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal shadow-sm transition-all duration-200;
}
```

Replace in `StatusBar.tsx:117`, `StatusBar.tsx:129`, `EvidenceWorkspace.tsx:180` — extract the common prefix, keep the tone/color class as a separate string.

### 1f. `field-input` (~15 replacements)

```css
@utility field-input {
  @apply rounded border border-border bg-surface text-ink outline-none focus:border-accent transition-colors;
}
```

Target: all `InlineToolbar.tsx` inputs (lines 72, 363, 387, 440), `ThemeOverridePopover.tsx` inputs (91, 108), `AppSettingsDialog.tsx` inputs (158, 171, 196), and matching patterns elsewhere. Each keeps its size-specific classes (`h-7`, `w-20`, `px-1`, `text-[12px] font-mono`); `field-input` absorbs the shared base.

### Phase 1 verify

```bash
rg 'focus-visible:ring' src/ --type tsx | wc -l  # target: 0
rg 'border-l border-border/70 bg-surface' src/    # only hits @utility definitions
npm run build && npm test
```

---

## Phase 2: Shell hooks → context providers

**Target:** `useShellLayout`, `useShellPanels`, `useEditorState`, `useColorScheme` become provider-backed. Hooks become thin `useContext` readers.

### Hook inventory (exact specs for provider extraction)

**`useShellLayout` (`hooks/useShellLayout.ts:19-82`)**

- State: `isTabletLayout`, `leftWidth` (init 214), `rightWidth` (init 320), `showBlueprintDrawer` (init false), `showLayoutPreviewPanel` (init true)
- Refs: `blueprintCloseRef`, `lastFocusRef`
- Derived: `compactLayout`, `overlayOpen`, `viewportWidth` (computed, not React state)
- Effects: resize listener (45-52), focus management on drawer open/close (54-61)
- Sub-hooks: `useEscapeKey` → close drawer when `overlayOpen` (63-67)
- `formspec:*` listeners: none
- Cross-hook deps: none

**`useShellPanels` (`hooks/useShellPanels.ts:36-79`)**

- State: `showPalette`, `showImport`, `showSettings`, `showAppSettings`, `assistantOpen` (all init false), `showPreview` (init from `readPreviewVisibility()`)
- Persistent: `showPreview` backed by `localStorage` via `readPreviewVisibility`/`writePreviewVisibility`
- Effects: one listener block (49-64) for `formspec:open-settings`, `formspec:open-app-settings`, `formspec:toggle-preview-companion`
- `formspec:*` listeners: 3
- Cross-hook deps: none

**`useEditorState` (`hooks/useEditorState.ts:15-46`)**

- Parameters: `activeTab: string`, `compactLayout: boolean`
- State: `showRightPanel` (init true), `showHealthSheet` (init false)
- Derived: `manageCount` via `useMemo` from `useProjectState().definition` (binds + shapes + variables + optionSets + instances)
- Effects: if `compactLayout && activeTab === 'Editor'` → `setShowHealthSheet(false)` (32-35)
- Sub-hooks: `useEscapeKey` → close health sheet when `showHealthSheet` (37)
- `formspec:*` listeners: none
- Cross-hook deps: `compactLayout` comes from `useShellLayout()` (caller wires it)

**`useColorScheme` (`hooks/useColorScheme.ts:37-63`)**

- State: `theme` (init from `getStoredPreference()`), `systemTheme` (init from `getSystemPreference()`)
- Derived: `resolvedTheme` = `theme === 'system' ? systemTheme : theme`
- Effects: `applyTheme(resolvedTheme)` on `<html>` class toggle (44-46); `matchMedia` change listener (48-56)
- Persistent: `theme` → `localStorage('formspec-studio:theme')`
- `formspec:*` listeners: none
- Cross-hook deps: none

### Implementation

**2a. Create provider files:**

```
src/providers/ShellLayoutProvider.tsx    ← lift from useShellLayout.ts:19-82
src/providers/ShellPanelsProvider.tsx    ← lift from useShellPanels.ts:36-79
src/providers/EditorStateProvider.tsx    ← lift from useEditorState.ts:15-46
src/providers/ColorSchemeProvider.tsx    ← lift from useColorScheme.ts:37-63
```

Each provider follows the same pattern:

1. Move all `useState`/`useEffect`/`useRef`/`useCallback`/`useMemo` from the hook body into the provider component.
2. Create a `createContext` + `Provider` wrapping `{children}`.
3. Rewrite the original hook as a thin `useContext` reader with the null-check + throw pattern.

`EditorStateProvider` takes `activeTab` and `compactLayout` as props (same as current hook params).

**2b. Rewrite hooks as context readers:**

```tsx
// Example: useShellLayout.ts after refactor
export function useShellLayout(): ShellLayoutState {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) throw new Error('useShellLayout must be used within ShellLayoutProvider');
  return ctx;
}
```

Keep the same export signatures. Consumers don't change.

**2c. Create composition root:**

`src/providers/ShellProviders.tsx`:

```tsx
interface ShellProvidersProps {
  activeTab: string;
  compactLayout: boolean;
  children: ReactNode;
}

export function ShellProviders({ activeTab, compactLayout, children }: ShellProvidersProps) {
  return (
    <ColorSchemeProvider>
      <ShellLayoutProvider>
        <ShellPanelsProvider>
          <EditorStateProvider activeTab={activeTab} compactLayout={compactLayout}>
            {children}
          </EditorStateProvider>
        </ShellPanelsProvider>
      </ShellLayoutProvider>
    </ColorSchemeProvider>
  );
}
```

**2d. Wire into StudioApp.tsx:**

StudioApp.tsx currently wraps: `ProjectProvider` → `SelectionProvider` → `ModeProvider` → `UnifiedStudio`.

Add `ShellProviders` inside `ModeProvider`. Since `activeTab`/`compactLayout` are computed inside UnifiedStudio, the cleanest path is Phase 3's `WorkspaceRouterProvider`. For Phase 2, keep `ShellProviders` inside `UnifiedStudio` wrapping the shell div, with `activeTab`/`compactLayout` derived locally (same as today, just lifted one level).

**2e. Wire into Shell.tsx:**

Shell.tsx wraps its content with `<ShellProviders activeTab={activeTab} compactLayout={compactLayout}>`. Tests continue to work unchanged.

### Phase 2 verify

```bash
npm run build && npm test  # Shell tests must still pass
npx playwright test
```

---

## Phase 3: `WorkspaceRouterProvider` — kill prop drilling

**Target:** `WorkspaceContent`'s 14 props → 0. All workspace routing state in context.

### Current state inventory

**UnifiedStudio `useState` cluster (lines 74-87, 10 calls):**

| Line | State | Init | Used by |
|------|-------|------|---------|
| 74 | `showOnboarding` | `shouldShowOnboarding()` | OnboardingOverlay |
| 78 | `advancedTab` | `null` | activeTab derivation, mode logic |
| 79 | `activeSection` | `'Structure'` | BlueprintSidebar |
| 80 | `activeMappingTab` | `'all'` | MappingTab |
| 81 | `mappingConfigOpen` | `true` | MappingTab |
| 82 | `previewViewport` | `'desktop'` | PreviewTab |
| 83 | `previewMode` | `'form'` | PreviewTab |
| 84 | `activeEditorView` | `'build'` | BuildManageToggle, WorkspaceContent |
| 85 | `leftTab` | `'blueprint'` | Left sidebar tab |
| 86 | `leftCollapsed` | `false` | Left sidebar collapse |
| 87 | `chatRailElement` | `null` | Chat portal ref |

Derived `activeTab` (line 106): `advancedTab ?? modeToWorkspaceTab(mode)` where `modeToWorkspaceTab` maps `chat→'Editor'`, `edit→'Editor'`, `design→'Design'`, `preview→'Preview'`.

**`formspec:navigate-workspace` handler (lines 243-297):**

- Reads `detail.tab`, `.view`, `.subTab`, `.section`
- Routes: `Theme/Design/Layout` → `setMode('design')` + section; `Preview/Playthrough` → `setMode('preview')`; `Editor` → `setMode('edit')` + view + section; advanced tabs → `setAdvancedTab()` + subTab
- Uses constants: `ADVANCED_WORKSPACE_TABS`, `VALID_EDITOR_VIEWS`, `VALID_MAPPING_TAB_IDS`, `BLUEPRINT_SECTIONS_BY_TAB.Editor`

**WorkspaceContent props (14, `WorkspaceContent.tsx:12-27`):**

| Prop | Maps to |
|------|---------|
| `activeTab` | Routes to Editor/Mapping/Preview/default workspace |
| `activeEditorView` + `setActiveEditorView` | BuildManageToggle |
| `manageCount` + `hasScreener` | BuildManageToggle |
| `activeMappingTab` + `setActiveMappingTab` | MappingTab |
| `mappingConfigOpen` + `setMappingConfigOpen` | MappingTab |
| `previewViewport` + `setPreviewViewport` | PreviewTab |
| `previewMode` + `setPreviewMode` | PreviewTab |
| `appearance` | `'light' | 'dark'` from colorScheme |

**3 call sites in UnifiedStudio:**

| Line | Branch | Notes |
|------|--------|-------|
| 576-591 | `isEditMode` | Full real state |
| 598-613 | `isAdvancedWorkspace` | Same prop bundle |
| 632-647 | `isPreviewMode` | Stubs: `activeTab="Preview"`, `activeEditorView="build"`, `setActiveEditorView={noop}`, `manageCount={0}`, `hasScreener={false}` |
| 617-628 | `isDesignMode` | LayoutCanvas only, no WorkspaceContent |

### Implementation

**3a. Create `src/providers/WorkspaceRouterProvider.tsx`:**

Lift from UnifiedStudio:

- All 10 `useState` calls (lines 74-87)
- `modeToWorkspaceTab()` function (lines 58-66)
- `ADVANCED_WORKSPACE_TABS`, `VALID_EDITOR_VIEWS`, `VALID_MAPPING_TAB_IDS` constants (lines 68-70)
- The `formspec:navigate-workspace` effect (lines 243-297)
- The `activeTab` derivation: `advancedTab ?? modeToWorkspaceTab(mode)` (line 106)
- `setStudioMode` callback (lines 141-144)

Context exposes:

```ts
interface WorkspaceRouterState {
  activeTab: string;
  activeSection: string;
  setActiveSection: (s: string) => void;
  activeEditorView: EditorView;
  setActiveEditorView: (v: EditorView) => void;
  activeMappingTab: MappingTabId;
  setActiveMappingTab: (t: MappingTabId) => void;
  mappingConfigOpen: boolean;
  setMappingConfigOpen: (o: boolean) => void;
  previewViewport: Viewport;
  setPreviewViewport: (v: Viewport) => void;
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  advancedTab: string | null;
  setStudioMode: (mode: StudioMode) => void;
  leftTab: 'blueprint' | 'chat' | 'history';
  setLeftTab: (t: ...) => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (c: boolean) => void;
}
```

Provider needs `mode` + `setMode` from `useMode()` — read from ModeProvider context.

**3b. Rewrite `WorkspaceContent.tsx`:**

Remove all 14 props. Component body reads from context:

```tsx
export function WorkspaceContent() {
  const { activeTab, activeEditorView, setActiveEditorView, ... } = useWorkspaceRouter();
  const { manageCount } = useEditorState();
  const hasScreener = useProjectState().screener !== null;
  const { resolvedTheme } = useColorScheme();
  // ...
}
```

`manageCount` is already inside `EditorStateProvider` (derived from `useProjectState`). `hasScreener` reads from `useProjectState().screener`. `appearance` comes from `useColorScheme().resolvedTheme`.

**3c. Clean UnifiedStudio:**

Replace 10 `useState` calls + `formspec:navigate-workspace` effect + `setStudioMode` with:

```tsx
const router = useWorkspaceRouter();
```

3 `<WorkspaceContent>` calls become `<WorkspaceContent />` (zero props).

`handleNewForm` (lines 215-231) calls `setActiveSection`, `setActiveEditorView`, etc. — these become `router.setActiveSection(...)`, etc.

**3d. Delete `useWorkspaceRouter.ts`:**

Functionality absorbed into `WorkspaceRouterProvider`. Dead code.

**3e. Handle `formspec:scroll-to-section`:**

`useWorkspaceRouter.ts:59,75` dispatches this event. With the file deleted, the dispatch disappears. The listener exists only in tests (`shell.test.tsx`). Do not port `scroll-to-section` dispatch to `WorkspaceRouterProvider`. The event was orphaned in production (no listener in `src/`).

### Phase 3 verify

```bash
npm run build
npm test  # shell.test.tsx scroll-to-section tests will break; accept this (dead code)
npx playwright test
```

---

## Phase 4: Type the event bus

**Target:** All `formspec:*` events have typed constants. Zero behavioral change.

### Complete event inventory

| Event | Dispatchers | Listeners |
|-------|-------------|-----------|
| `formspec:navigate-workspace` | Blueprint.tsx, FELEditor.tsx, VariablesList.tsx, CommandPalette.tsx, ManageView.tsx | WorkspaceRouterProvider (after Phase 3) |
| `formspec:scroll-to-section` | **Dead** (was useWorkspaceRouter.ts) | **Tests only** |
| `formspec:set-mode` | CommandPalette.tsx | ModeProvider.tsx:77 |
| `formspec:mode-changed` | ModeProvider.tsx:60 | telemetry-adapter.ts:73 |
| `formspec:open-settings` | CommandPalette.tsx, StatusBar.tsx:87 | ShellPanelsProvider (after Phase 2) |
| `formspec:open-app-settings` | ChatMessageList.tsx:74 | ShellPanelsProvider |
| `formspec:toggle-preview-companion` | UnifiedStudio.tsx:173 | ShellPanelsProvider |
| `formspec:restart-onboarding` | UnifiedStudio.tsx:229/303, Shell.tsx:130 | UnifiedStudio.tsx:303 |
| `formspec:publish-project` | Header.tsx:296, StatusBar.tsx:145 | UnifiedStudio.tsx:332 |
| `formspec:open-assistant-workspace` | StatusBar.tsx:94 | AppSettingsDialog.tsx:18 |
| `formspec:assistant-prompt` | AuthoringOverlay.tsx:516 | chat internals |
| `formspec:authoring-telemetry` | authoring-method-telemetry.ts:35 | telemetry |
| `formspec:onboarding-telemetry` | onboarding-telemetry.ts:53 | telemetry |
| `formspec:model-routing` | authoring-model-routing.ts:35 | routing internals |

Note: `formspec:provider-config` is a `localStorage` key, not a DOM event.

### Implementation

**4a. Create `src/studio-events.ts`:**

```ts
export const STUDIO_EVENTS = {
  NAVIGATE_WORKSPACE: 'formspec:navigate-workspace',
  SET_MODE: 'formspec:set-mode',
  MODE_CHANGED: 'formspec:mode-changed',
  OPEN_SETTINGS: 'formspec:open-settings',
  OPEN_APP_SETTINGS: 'formspec:open-app-settings',
  TOGGLE_PREVIEW_COMPANION: 'formspec:toggle-preview-companion',
  RESTART_ONBOARDING: 'formspec:restart-onboarding',
  PUBLISH_PROJECT: 'formspec:publish-project',
  OPEN_ASSISTANT_WORKSPACE: 'formspec:open-assistant-workspace',
  ASSISTANT_PROMPT: 'formspec:assistant-prompt',
  AUTHORING_TELEMETRY: 'formspec:authoring-telemetry',
  ONBOARDING_TELEMETRY: 'formspec:onboarding-telemetry',
  MODEL_ROUTING: 'formspec:model-routing',
} as const;

export type StudioEventName = typeof STUDIO_EVENTS[keyof typeof STUDIO_EVENTS];

export function dispatchStudioEvent<T = undefined>(
  name: StudioEventName,
  detail?: T,
): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function addStudioEventListener<T = undefined>(
  name: StudioEventName,
  handler: (e: CustomEvent<T>) => void,
): () => void {
  const wrapped = ((e: Event) => handler(e as CustomEvent<T>)) as EventListener;
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}
```

`scroll-to-section` intentionally excluded. Comment in file:

```ts
// Removed: scroll-to-section was orphaned in production (dispatch from dead
// useWorkspaceRouter, no listener in src/). Do not reintroduce without a
// production consumer.
```

**4b. Mechanical replace across all files:**

Every `new CustomEvent('formspec:…')` → `dispatchStudioEvent(STUDIO_EVENTS.…)`.
Every `addEventListener('formspec:…', …)` → `addStudioEventListener(STUDIO_EVENTS.…)`.
Every `removeEventListener('formspec:…', …)` → use the returned cleanup function.

### Phase 4 verify

```bash
rg "new CustomEvent\('formspec:" src/ | wc -l   # target: 0
rg "addEventListener\('formspec:" src/ | wc -l   # target: 0
npm run build && npm test
```

---

## Phase 5: Test migration + dead code deletion

**Target:** Remove `Shell.tsx`, `useWorkspaceRouter.ts`. ~620 lines gone.

### Test files that must change

| File | Lines | What it imports | Key remapping needed |
|------|:-----:|-----------------|---------------------|
| `tests/components/shell.test.tsx` | 906 | `<Shell />` from `'…/Shell'` | Full rewrite: replace Shell mount with UnifiedStudio |
| `tests/components/blueprint-layout-mode.test.tsx` | 191 | `<Shell />` from `'…/Shell'` | Replace `renderLayoutShell()` with UnifiedStudio harness |

No change needed (don't import Shell):

- `tests/smoke.test.tsx` — already mounts UnifiedStudio directly
- `tests/components/blueprint.test.tsx` — no Shell import
- `tests/components/blueprint/sidebar-panels.test.tsx` — no Shell import
- `tests/workspaces/editor/manage-view.test.tsx` — no Shell import
- E2E tests — reference Shell in comments only; selectors may need updating but no import changes

### Selectors/testids to remap

| Shell selector | UnifiedStudio equivalent | Status |
|----------------|--------------------------|--------|
| `data-testid="shell"` | `data-testid="shell"` (UnifiedStudio:371) | Same |
| `workspace-Editor`, `workspace-Design`, etc. | Same in UnifiedStudio | Same |
| `workspace-Preview` | Same in UnifiedStudio | Same |
| `workspace-Design` → child `design-canvas-shell` | UnifiedStudio:620 | Same |
| `workspace-Layout` | UnifiedStudio:623 | Same |
| `id="studio-panel-editor"` + `aria-labelledby="studio-tab-editor"` | **Not present in UnifiedStudio** | Must remap |
| `blueprint-sidebar`, `blueprint-section-*` | Same components used | Same |
| `properties-panel` | UnifiedStudio:659 | Same |
| `layout-preview-panel` | UnifiedStudio:685 | Same |
| `editor-canvas-shell` | Check — UnifiedStudio uses `editor-deselect-hitbox` (569) | Verify |
| `mobile-editor-chrome` | Defined in Shell:269 | **Not in UnifiedStudio** |
| `mobile-selection-context` | Shell:271 | **Not in UnifiedStudio** |
| `mobile-editor-structure` | Shell:300 | **Not in UnifiedStudio** |
| Tab roles: `getByRole('tab', { name: 'Editor' })` | UnifiedStudio uses `ModeToggle` | Must remap to mode assertions |
| `getByRole('tab', { name: 'Design' })` | UnifiedStudio mode toggle | Must remap |

### `formspec:scroll-to-section` test coverage

Tested exclusively in `shell.test.tsx`:

1. "responds to `formspec:navigate-workspace` event with section parameter" — asserts `scroll-to-section` fires.
2. "does not dispatch `scroll-to-section` when section is not provided" — asserts it doesn't fire.

Action: Delete these tests. The event was orphaned in production. If scroll-to-section behavior is needed later, reimplement inside `WorkspaceRouterProvider` with a production listener.

### Other tests using `formspec:navigate-workspace`

- `tests/components/blueprint.test.tsx` — dispatches it (still valid, listener moves to WorkspaceRouterProvider)
- `tests/components/blueprint/sidebar-panels.test.tsx` — same
- `tests/workspaces/editor/manage-view.test.tsx` — same

These don't need changes if `WorkspaceRouterProvider` registers the same listener. Verify post-Phase-3.

### Implementation

**5a. Migrate `tests/components/blueprint-layout-mode.test.tsx` (191 lines):**

Replace `renderLayoutShell()` (renders providers + `<Shell />`) with providers + `<UnifiedStudio />`.

Key change: `goToLayoutTab()` currently clicks `getByRole('tab', { name: 'Design' })`. UnifiedStudio uses `ModeToggle`. Remap to:

```tsx
fireEvent.click(screen.getByRole('button', { name: /design/i }));
// Or dispatch formspec:set-mode with detail { mode: 'design' }
```

**5b. Migrate `tests/components/shell.test.tsx` (906 lines):**

Strategy:

1. Replace `renderShell()` (renders ProjectProvider → SelectionProvider → ActiveGroupProvider → ChatSessionControllerProvider → `<Shell />`) with same provider stack wrapping `<UnifiedStudio />`.
2. Replace all tab-role assertions with mode-toggle assertions or `formspec:set-mode` dispatches.
3. Remove `studio-panel-*` / `studio-tab-*` assertions (UnifiedStudio doesn't generate these IDs).
4. Remove `mobile-editor-chrome`, `mobile-selection-context`, `mobile-editor-structure` assertions.
5. Remove `scroll-to-section` test cases.
6. Keep all `formspec:navigate-workspace` dispatch tests — they route through `WorkspaceRouterProvider` with the same contract.

**5c. Delete dead files:**

```
rm src/components/Shell.tsx           # 518 lines
rm src/hooks/useWorkspaceRouter.ts    # 101 lines
```

**5d. Clean imports:**

```bash
rg 'from.*Shell' src/ tests/           # verify zero hits
rg 'useWorkspaceRouter' src/ tests/    # verify zero hits
```

**5e. E2E follow-up:**

Check for comment references or selectors that assumed Shell:

- `tests/e2e/playwright/shell-responsive.spec.ts` — may reference old chrome
- `tests/e2e/playwright/helpers.ts` — comment "Shell visible"
- `tests/e2e/playwright/blueprint-layout-mode.spec.ts` — Shell section references

These run against the full app (UnifiedStudio already mounted). If selectors match, no change needed.

### Phase 5 verify

```bash
npm run build
npm test
npx playwright test
rg 'Shell' src/ --type tsx               # only "shell" as data-testid string
rg 'useWorkspaceRouter' src/ tests/      # zero hits
```

---

## Phase 6: Remaining style centralization

**Target:** Every remaining inline style pattern appearing 3+ times has a named abstraction.

### 6a. Extend `item-row-shared.tsx`

Already has `EDITOR_DASH_BUTTON`, `summaryInputClassName`, `lowerEditorInputClassName`. Audit `ItemRow.tsx`, `GroupNode.tsx`, `ItemListEditor.tsx` for 3+ repeated `className` patterns. Extract as named constants.

### 6b. Audit `btn-premium*` usage

The `btn-premium`/`primary`/`secondary`/`ghost` utilities exist but aren't used everywhere. Find buttons matching the shape but using inline classes. Replace where the match is exact. Don't force-migrate buttons with different shapes.

### 6c. Input variants

After `field-input` from Phase 1f, audit remaining `<input>`/`<textarea>` elements for inline patterns appearing 3+ times.

### Phase 6 verify

```bash
npm run build && npm test && npx playwright test
```

---

## Phase dependency graph

```
Phase 1 (utilities)     ←── independent, start here
Phase 2 (providers)     ←── independent, can parallel with 1
Phase 3 (router)        ←── depends on 2
Phase 4 (event typing)  ←── independent, can parallel with 1-3
Phase 5 (test + delete) ←── depends on 2, 3, 4
Phase 6 (style audit)   ←── depends on 1, independent of 2-5
```

## What this delivers

| Metric | Before | After |
|--------|--------|-------|
| Inline focus-ring copies | ~91 | 0 |
| Right-panel aside copies | 4 | 0 |
| Panel close btn copies | 4 | 0 |
| `WorkspaceContent` props | 14 | 0 |
| Dead code lines | ~620 | 0 |
| Untyped DOM events | 15 | 0 (all constants) |
| Orphaned events | 1 (`scroll-to-section`) | 0 |
| Shell hooks injectable for testing | No | Yes |
| Duplicate navigation implementations | 2 | 1 (provider) |
| Duplicate shell files | 2 | 1 |
