# Theme Workspace Redesign — User-Intent Zones + Canvas-Integrated Overrides

## Context

The Theme tab is organized around JSON schema structure (6 tabs mapping 1:1 to `tokens`, `defaults`, `selectors`, `items`, `pages`, `breakpoints`). All sub-components except TokenEditor are read-only shells with dead "Add" buttons (TokenEditor has a working Add via `window.prompt`, but is equally worth replacing). Meanwhile, 28 fully-implemented handlers sit unused in `theme.ts` — 23 are covered by the new UI zones, and 5 are document-level metadata (`setPages`, `setStylesheets`, `setDocumentProperty`, `setExtension`, `setTargetCompatibility`) that are out of scope for this redesign.

The redesign reorganizes around **user intent** instead of schema structure, adds visual affordances for non-technical users, and moves per-field appearance editing into the editor canvas properties panel where it belongs.

**Two audiences:**
- **Form designers** (non-technical): think "my form should be blue", "labels on top", "date fields need a calendar"
- **Power users**: want raw token editing, custom CSS properties, `$token.key` references

---

## Architecture: 3 Zones + Canvas Integration

### Theme Workspace (3 zones, replacing 6 tabs)

```
Filter bar: [All Theme] [Brand & Colors] [Field Presentation] [Pages & Layout]

Zone 1: Brand & Colors
  ├── Color Palette       (visual swatches + pickers → theme.setToken color.*)
  ├── Typography & Spacing (font dropdown, spacing scale → theme.setToken typography.*/spacing.*)
  └── All Tokens          (collapsed, raw key-value → theme.setToken any key)

Zone 2: Field Presentation
  ├── Default Field Style  (label position wireframes, density → theme.setDefaults)
  └── Field Type Rules     (natural-language cards → theme.addSelector/setSelector/etc.)

Zone 3: Pages & Layout
  ├── Page Definitions     (12-col grid visual + region CRUD → theme.addPage/etc.)
  └── Screen Sizes         (breakpoint CRUD, collapsed → theme.setBreakpoint)
```

### Editor Canvas Properties Panel (per-field overrides)

New `AppearanceSection` in `SelectedItemProperties.tsx`, after `WidgetHintSection`:
- Shows resolved theme values with provenance labels
- Edits write to `theme.items[key]` (cascade level 3)
- Uses existing `Section`, `PropInput`, `AddPlaceholder` patterns

---

## Step 1: Shell cleanup + ThemeTab zone layout

**Files:**
- `packages/formspec-studio/src/components/Shell.tsx` (edit)
- `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx` (rewrite)
- `packages/formspec-studio/tests/workspaces/theme/theme-tab.test.tsx` (rewrite)

**Shell changes:**
- Remove `ThemeTabId` import and `activeThemeTab` state
- Remove `case 'Theme'` from `workspaceContent` switch — let ThemeTab render from `WORKSPACES` record
- Remove `setActiveThemeTab('tokens')` from `handleNewForm`
- Remove Theme subTab handling from `formspec:navigate-workspace` listener

**ThemeTab rewrite — pillar layout with 3-zone filter:**
- Self-contained, no props, internal `useState<'all' | 'brand' | 'presentation' | 'layout'>('all')`
- `WorkspacePage` + sticky filter bar (same pattern as LogicTab)
- `ThemePillar` inline component (identical pattern to `LogicPillar`)
- Reads theme from `useTheme()`, definition items from `useDefinition()` for item-key autocomplete

**Filter bar:**
```
[All Theme] [Brand & Colors] [Field Presentation] [Pages & Layout]
```

**7 pillars across 3 zones:**

| Pillar | Zone | Accent | Subtitle |
|--------|------|--------|----------|
| Color Palette | brand | `bg-accent` | "Your form's color identity" |
| Typography & Spacing | brand | `bg-logic` | "Fonts, sizes, and whitespace" |
| All Tokens | brand | `bg-muted` | "Full design token reference" (collapsed by default) |
| Default Field Style | presentation | `bg-green` | "Baseline look for every field" |
| Field Type Rules | presentation | `bg-amber` | "Automatic styling by field type" |
| Page Definitions | layout | `bg-accent` | "Multi-step form structure" |
| Screen Sizes | layout | `bg-logic` | "Responsive viewport breakpoints" |

**Tests (RED first):**
1. Renders all pillar headings when filter is "All Theme"
2. "Brand & Colors" shows only Color Palette, Typography & Spacing, All Tokens
3. "Field Presentation" shows only Default Field Style, Field Type Rules
4. "Pages & Layout" shows only Page Definitions, Screen Sizes
5. ThemeTab renders without props

---

## Step 2: Color Palette — visual swatches with pickers

**Files:**
- `packages/formspec-studio/src/workspaces/theme/ColorPalette.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/color-palette.test.tsx` (create)

**Dispatches:** `theme.setToken` → `{ key: string, value: string|null }`

**UX design:**
- **Standard palette**: Grid of named color swatches for well-known categories:
  - Primary, Error, Warning, Success, Surface, Text, Border
  - Each: color circle swatch + semantic label + hex value
  - Click swatch → native `<input type="color">` picker opens
  - Hex value also click-to-edit (text input) for precise values
- **"+ Add Color"** button for custom colors (prompts for key suffix, e.g. `color.brand-secondary`)
- Each swatch hover-reveals Delete (dispatches `{ key, value: null }`)
- Swatches map to `color.*` tokens: `color.primary`, `color.error`, etc.
- Non-color tokens are NOT shown here (they go in Typography & Spacing or All Tokens)

**Tests (RED first):**
1. Renders color swatches for existing `color.*` tokens
2. Shows color picker on swatch click
3. Color change dispatches `theme.setToken` with `{ key: 'color.primary', value: '#newcolor' }`
4. Hex edit dispatches on blur
5. Delete dispatches with `{ key, value: null }`
6. Add creates new `color.*` token
7. Shows empty state when no color tokens

---

## Step 3: Typography & Spacing section

**Files:**
- `packages/formspec-studio/src/workspaces/theme/TypographySpacing.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/typography-spacing.test.tsx` (create)

**Dispatches:** `theme.setToken` → `{ key: string, value: string|null }`

**UX design — structured editors for known token categories:**

**Typography sub-section:**
- Font Family: text input with preview rendered in that font (maps to `typography.fontFamily`)
- Mono Font: text input (maps to `typography.monoFamily`)
- Base Font Size: text input with "px"/"rem" suffix (maps to `typography.fontSize`)

**Spacing sub-section:**
- Visual scale showing xs/sm/md/lg/xl as proportional bars
- Each value editable (click the bar or the px value)
- Maps to `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, `spacing.xl`

**Borders sub-section:**
- Border radius: slider/input (maps to `border.radius`)
- Border width: input (maps to `border.width`)
- Visual preview showing a small rounded box at current radius

**Tests (RED first):**
1. Renders font family input with current value
2. Font change dispatches `theme.setToken` with `{ key: 'typography.fontFamily', value }`
3. Spacing values render as scale
4. Spacing edit dispatches correctly
5. Border radius slider dispatches
6. Shows defaults/placeholders when tokens not set

---

## Step 4: All Tokens — raw key-value editor (power users)

**Files:**
- `packages/formspec-studio/src/workspaces/theme/AllTokens.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/all-tokens.test.tsx` (create)

**Dispatches:** `theme.setToken` → `{ key, value }`, `theme.setToken` → `{ key, value: null }`

**UX — collapsed by default, raw access for power users:**
- Section starts collapsed (pillar can use `defaultCollapsed` prop)
- Header shows token count badge: "12 tokens"
- Expanded: flat list of ALL tokens (including color.*, spacing.*, and any custom ones)
- Each row: key (mono, bold), value (click-to-edit), color swatch if hex, hover-reveal Delete
- "+ New Token" inline add form: key input + value input, Enter/Escape
- Grouped by dot-prefix with collapsible group headers
- Search/filter input at top for large token sets

**Tests (RED first):**
1. Renders all tokens grouped by prefix
2. Shows token count in header
3. Starts collapsed
4. Add dispatches `theme.setToken`
5. Edit value on blur dispatches
6. Delete dispatches with `{ key, value: null }`
7. Color swatch appears for hex values

---

## Step 5: Default Field Style — visual property editors

**Files:**
- `packages/formspec-studio/src/workspaces/theme/DefaultFieldStyle.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/default-field-style.test.tsx` (create)

**Dispatches:** `theme.setDefaults` → `{ property: string, value: unknown|null }`

**UX — visual controls, not raw key-value:**

**Label Position** (most important default):
- 3 clickable wireframe thumbnails side by side:
  - **Top**: label above input box (visual)
  - **Start**: label left of input box (visual)
  - **Hidden**: input box with dotted label indicator (visual)
- Active selection highlighted with accent border
- Dispatches `{ property: 'labelPosition', value: 'top'|'start'|'hidden' }`

**Default Widget**: dropdown (same pattern as WidgetHintSection but for form-wide default)

**Default CSS Class**: text input for base CSS class

**Style Properties** (advanced, starts collapsed):
- Key-value editor for arbitrary style properties
- Hint: "Use $token.key to reference design tokens"

**Tests (RED first):**
1. Renders label position wireframes
2. Clicking "Top" dispatches `theme.setDefaults` with `{ property: 'labelPosition', value: 'top' }`
3. Active position shows accent border
4. Shows current position from theme defaults
5. Default widget dropdown dispatches correctly
6. Advanced style editor dispatches on blur

---

## Step 6: Field Type Rules — natural-language selector cards

**Files:**
- `packages/formspec-studio/src/workspaces/theme/FieldTypeRules.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/field-type-rules.test.tsx` (create)

**CRITICAL FIX:** Uses `apply` (not `properties`) to match handler contract.

**Dispatches:**
- `theme.addSelector` → `{ match, apply }`
- `theme.setSelector` → `{ index, match?, apply? }`
- `theme.deleteSelector` → `{ index }`
- `theme.reorderSelector` → `{ index, direction: 'up'|'down' }`

**UX — natural-language rule cards:**

Each selector displays as a readable rule card:
```
When [field ▾] type is [money ▾]
  → show as [moneyInput ▾]
  → with style { fontFamily: "$token.typography.monoFamily" }
```

- **"When" clause**: type dropdown (`field`/`group`/`display`) + dataType dropdown (13 core types). Both optional but at least one required.
- **"Show as" clause**: widget dropdown populated from compatible widgets
- **"With style" clause**: expandable key-value style editor
- **Order badge**: #1, #2, #3... with reorder up/down buttons (later rules override earlier)
- **Cascade hint**: small text "Rules apply in order — later rules override earlier ones for the same property"

**Expand/collapse**: Click card to expand for editing. Collapsed shows summary: "Money fields → moneyInput"

**Add flow**: "+ New Rule" button, creates empty rule, auto-expands

**Tests (RED first):**
1. Renders rules with match summary ("field + money → moneyInput")
2. Shows empty state with explanation
3. Add dispatches `theme.addSelector` with `{ match: {}, apply: {} }`
4. Edit type dropdown dispatches `theme.setSelector` with `{ index, match: { type: 'field' } }`
5. Edit dataType dispatches similarly
6. Edit widget in apply dispatches `theme.setSelector` with `{ index, apply: { widget: 'moneyInput' } }`
7. Delete dispatches `theme.deleteSelector` with `{ index }`
8. Up dispatches `theme.reorderSelector` `{ index, direction: 'up' }`
9. Down dispatches `theme.reorderSelector` `{ index, direction: 'down' }`
10. Up disabled on first, down disabled on last

---

## Step 7: Page Definitions — 12-column grid visual + region CRUD

**Files:**
- `packages/formspec-studio/src/workspaces/theme/PageDefinitions.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/page-definitions.test.tsx` (create)

**Page dispatches:**
- `theme.addPage` → `{ title? }`
- `theme.setPageProperty` → `{ index, property, value }`
- `theme.deletePage` → `{ index }` (≥1 must remain)
- `theme.reorderPage` → `{ index, direction }`
- `theme.renamePage` → `{ pageId, newId }`

**Region dispatches:**
- `theme.addRegion` → `{ pageId, span?, key? }`
- `theme.setRegionProperty` → `{ pageId, regionIndex, property, value }`
- `theme.setRegionKey` → `{ pageId, regionIndex, newKey }`
- `theme.deleteRegion` → `{ pageId, regionIndex }`
- `theme.reorderRegion` → `{ pageId, regionIndex, direction }`

**UX — expand/collapse page cards with visual grid:**

Each page as an expand/collapse card:
- **Collapsed**: page title, region count, mini 12-col grid bar showing colored regions at proportional widths
- **Expanded**:
  - Page ID (click-to-edit, monospace)
  - Title input
  - Description textarea
  - **12-column grid visual**: `grid-cols-12` div with colored region blocks showing key names
  - **Region list** below grid: each row has key dropdown (populated from `useDefinition().items`), span number input (1-12), up/down reorder, delete
  - "+ Add Region" button (defaults to span 12, empty key)
  - Page reorder up/down + Delete (disabled if last page)

**Tests (RED first):**
1. Renders pages with grid visual
2. Shows empty state
3. Add page dispatches `theme.addPage`
4. Edit title dispatches `theme.setPageProperty`
5. Delete page dispatches `theme.deletePage`
6. Cannot delete last page
7. Reorder page dispatches `theme.reorderPage`
8. Add region dispatches `theme.addRegion` with `pageId`
9. Edit region span dispatches `theme.setRegionProperty`
10. Set region key dispatches `theme.setRegionKey`
11. Delete region dispatches `theme.deleteRegion`
12. Reorder region dispatches `theme.reorderRegion`

---

## Step 8: Screen Sizes — breakpoint CRUD

**Files:**
- `packages/formspec-studio/src/workspaces/theme/ScreenSizes.tsx` (create)
- `packages/formspec-studio/tests/workspaces/theme/screen-sizes.test.tsx` (create)

**Dispatches:**
- Add/Edit: `theme.setBreakpoint` → `{ name, minWidth }`
- Delete: `theme.setBreakpoint` → `{ name, minWidth: null }`

**UX — simple, collapsed by default:**
- Starts collapsed (this is a power-user feature)
- Header shows count: "3 breakpoints"
- Sorted by minWidth ascending
- Each breakpoint: name (bold), width with "px" suffix, visual width bar, hover-reveal Delete
- "+ New Breakpoint" inline add form
- **Preset suggestion** when empty: "Common presets: mobile (0px), tablet (768px), desktop (1024px)" with one-click apply

**Tests (RED first):**
1. Renders breakpoints sorted by width
2. Shows empty state with preset suggestion
3. Add dispatches `theme.setBreakpoint` with `{ name, minWidth }`
4. Edit dispatches on blur
5. Delete dispatches with `{ name, minWidth: null }`
6. Preset apply creates all 3 breakpoints

---

## Step 9: AppearanceSection — per-field theme overrides in canvas properties

**Files:**
- `packages/formspec-studio/src/workspaces/editor/properties/AppearanceSection.tsx` (create)
- `packages/formspec-studio/src/workspaces/editor/properties/SelectedItemProperties.tsx` (edit — add AppearanceSection)
- `packages/formspec-studio/tests/workspaces/editor/properties/appearance-section.test.tsx` (create)

**Dispatches (to theme, not definition):**
- Widget override: `theme.setItemOverride` → `{ itemKey, property: 'widget', value }`
- Label position: `theme.setItemOverride` → `{ itemKey, property: 'labelPosition', value }`
- CSS class: `theme.setItemOverride` → `{ itemKey, property: 'cssClass', value }`
- Style property: `theme.setItemStyle` → `{ itemKey, property, value }`
- Widget config: `theme.setItemWidgetConfig` → `{ itemKey, property, value }`
- Accessibility: `theme.setItemAccessibility` → `{ itemKey, property, value }`
- Remove all overrides: `theme.deleteItemOverride` → `{ itemKey }`

**Integration point** — add after `WidgetHintSection` in `SelectedItemProperties.tsx`:
```tsx
<WidgetHintSection ... />
<AppearanceSection itemKey={currentKey} dispatch={dispatch} />
<FieldConfigSection ... />
```

**UX — collapsible Section using existing patterns:**

```
▼ APPEARANCE
  Label Position: [Top ▾]           [from: Default]
  CSS Class:      formspec-field     [from: Default]
  ─────────────────────────────
  + Add style override
  + Add widget config
  + Add accessibility hint
```

- Each property shows its **resolved value** (merged from all cascade levels)
- **Provenance label** (muted text): "from: Default", "from: Field Type Rule", "from: This Field"
- Editing creates/updates a level-3 item override
- Provenance updates to "from: This Field" after edit
- "Clear override" button appears when a property has a per-field override (reverts to cascade resolution)
- Uses `AddPlaceholder` pattern for optional sub-sections (style, widgetConfig, accessibility)
- **Note on PropInput**: The existing `PropInput` in `shared.tsx` hardcodes `definition.setItemProperty` as its dispatch target. AppearanceSection dispatches `theme.*` commands, so it needs its own input component (or a `ThemePropInput` variant). `AddPlaceholder` is reusable as-is.

**Cascade resolution helper** (new utility in studio-core):
- Reads `theme.defaults`, `theme.selectors`, `theme.items[key]`
- Resolves effective value for each property with source attribution
- Lives in studio-core because it's pure data logic over `FormspecThemeDocument` types, no React dependencies
- File: `packages/formspec-studio-core/src/theme-cascade.ts`

**Tests (RED first):**
1. Renders resolved label position from theme defaults
2. Shows provenance "from: Default" for inherited values
3. Editing dispatches `theme.setItemOverride`
4. After edit, provenance shows "from: This Field"
5. "Clear override" dispatches `theme.deleteItemOverride`
6. Style sub-section dispatches `theme.setItemStyle`
7. Shows `AddPlaceholder` for optional sub-sections
8. Section hidden when no theme is configured

---

## Step 10: Delete old files + cleanup

**Delete:**
- `packages/formspec-studio/src/workspaces/theme/TokenEditor.tsx` (replaced by ColorPalette + TypographySpacing + AllTokens)
- `packages/formspec-studio/src/workspaces/theme/DefaultsEditor.tsx` (replaced by DefaultFieldStyle)
- `packages/formspec-studio/src/workspaces/theme/SelectorList.tsx` (replaced by FieldTypeRules)
- `packages/formspec-studio/src/workspaces/theme/ItemOverrides.tsx` (replaced by AppearanceSection in canvas)
- `packages/formspec-studio/src/workspaces/theme/PageLayouts.tsx` (replaced by PageDefinitions)
- `packages/formspec-studio/src/workspaces/theme/BreakpointEditor.tsx` (replaced by ScreenSizes)

**Keep:** Handler file `packages/formspec-studio-core/src/handlers/theme.ts` — all 25 handlers are correct and unchanged.

---

## Step 11: Verify

- `npx tsc --noEmit` — no type errors
- `npx vitest run packages/formspec-studio/tests/workspaces/theme/` — all pass
- `npx vitest run packages/formspec-studio/tests/workspaces/editor/properties/` — AppearanceSection passes
- `npx vitest run packages/formspec-studio/tests/components/shell.test.tsx` — Shell still works
- `npx vitest run` — full suite, zero regressions

---

## Key Files

| File | Action |
|---|---|
| `packages/formspec-studio/src/components/Shell.tsx` | Edit: remove ThemeTabId + controlled state |
| `packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx` | Rewrite: 3-zone pillar layout |
| `packages/formspec-studio/src/workspaces/theme/ColorPalette.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/TypographySpacing.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/AllTokens.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/DefaultFieldStyle.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/FieldTypeRules.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/PageDefinitions.tsx` | Create |
| `packages/formspec-studio/src/workspaces/theme/ScreenSizes.tsx` | Create |
| `packages/formspec-studio/src/workspaces/editor/properties/AppearanceSection.tsx` | Create |
| `packages/formspec-studio/src/workspaces/editor/properties/SelectedItemProperties.tsx` | Edit: add AppearanceSection |
| `packages/formspec-studio-core/src/theme-cascade.ts` | Create: cascade resolution utility (pure data, no React) |
| Old theme sub-components (6 files) | Delete |
| `packages/formspec-studio/tests/workspaces/theme/*.test.tsx` | Rewrite all + create new |

## Reference files

| File | Why |
|---|---|
| `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx` | Pillar+filter layout pattern |
| `packages/formspec-studio/src/workspaces/logic/VariablesSection.tsx` | CRUD + inline editing |
| `packages/formspec-studio/src/workspaces/logic/ShapesSection.tsx` | Expand/collapse + reorder |
| `packages/formspec-studio/src/workspaces/editor/properties/WidgetHintSection.tsx` | Properties panel pattern |
| `packages/formspec-studio/src/workspaces/editor/properties/shared.tsx` | PropInput + AddPlaceholder |
| `packages/formspec-studio/src/components/ui/Section.tsx` | Collapsible section |
| `packages/formspec-studio-core/src/handlers/theme.ts` | All 25 handler contracts |

## Handler Quick Reference

```
Tokens:     theme.setToken        { key, value }          (null removes)
            theme.setTokens       { tokens: Record }      (batch merge)
Defaults:   theme.setDefaults     { property, value }     (null removes)
Selectors:  theme.addSelector     { match, apply, insertIndex? }
            theme.setSelector     { index, match?, apply? }
            theme.deleteSelector  { index }
            theme.reorderSelector { index, direction }
Items:      theme.setItemOverride      { itemKey, property, value }
            theme.deleteItemOverride   { itemKey }
            theme.setItemStyle         { itemKey, property, value }
            theme.setItemWidgetConfig  { itemKey, property, value }
            theme.setItemAccessibility { itemKey, property, value }
Pages:      theme.addPage         { id?, title?, description?, insertIndex? }
            theme.setPageProperty { index, property, value }
            theme.deletePage      { index }
            theme.reorderPage     { index, direction }
            theme.renamePage      { pageId, newId }
Regions:    theme.addRegion       { pageId, key?, span?, start?, insertIndex? }
            theme.setRegionProperty { pageId, regionIndex, property, value }
            theme.setRegionKey    { pageId, regionIndex, newKey }
            theme.deleteRegion    { pageId, regionIndex }
            theme.reorderRegion   { pageId, regionIndex, direction }
Breakpts:   theme.setBreakpoint   { name, minWidth }      (null removes)
```
