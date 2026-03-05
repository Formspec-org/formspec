# Studio v2 Design & UX Review Findings

> Reviewed against `thoughts/PRD-v2.md` on 2026-03-05.
> Branch: `feat/unified-component-tree-editor`

---

## Blocker: App Won't Load (Fixed During Review)

All four Ajv import sites used `import Ajv from 'ajv'` but the schemas use JSON Schema 2020-12 draft. Ajv 8 requires `import Ajv2020 from 'ajv/dist/2020'` for this dialect. The `ajv.compile()` call at module top-level threw, crashing the entire app render.

**Files fixed:** `state/extensions.ts`, `state/derived.ts`, `state/versioning.ts`, `components/json/JsonEditorPane.tsx`.

---

## Executive Summary

The Studio has impressive functional coverage — slash menu, visual logic builders, condition/formula/constraint editors, mapping table, versioning, extensions, diagnostics, command palette, structure tree, and live preview all exist in some form. But the **core UX thesis from the PRD — "document-first, progressive disclosure, selection drives everything"** — is undermined by two critical bugs and several design decisions that expose complexity instead of hiding it.

**The form surface is 20% of the viewport. The inspector is 80%.** This single layout bug inverts the entire design intent.

---

## §1. Document-First Experience — FAIL

**Severity: Critical — blocks the core thesis**

### 1.1 Layout Bug: Form Surface Squeezed to ~240px

The CSS grid always declares 3 columns:

```css
/* app.css:179 */
.shell-grid {
  grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr) minmax(18rem, 21rem);
}
```

When the structure panel is hidden (the default), only 2 children exist in the grid. The form surface (`<main>`) lands in column 1 (15-18rem = ~240-288px). The inspector (`<aside>`) lands in column 2 (1fr = all remaining space). **The inspector gets ~75% of the viewport and the form surface gets ~20%.** This completely inverts the PRD's design: the form should be the hero, not the inspector.

**Fix:** The grid should adapt to panel visibility. When structure is hidden, use a 2-column layout with the form surface getting the `1fr` column and the inspector getting the fixed-width column.

### 1.2 Blank Page State Doesn't Match PRD

**Current:** "Start your form / Use add controls to insert the first item." + `[+ Add first field]` button.

**PRD (§3.1):**
```
┌──────────────────────────────────────────┐
│  Untitled Form                           │
│  Add a description...                    │
│                                          │
│  Type / to add a field                   │
└──────────────────────────────────────────┘
```

Missing: (a) no "Type / to add a field" hint, (b) no description placeholder, (c) no blinking cursor feel.

### 1.3 Inspector Always Visible

**PRD (§2.2):** "Nothing appears until you select something. The right panel is empty (or hidden) until you click a field."

**Current:** When nothing is selected, the Form Inspector shows with 12 expanded sections — Metadata, Import/Export, Version, Brand, Layout, Style Rules, Design Tokens, Variables, Form Rules, Sub-forms, Extensions, Mapping. This is the antithesis of "nothing appears until you select something."

### 1.4 Preview Width Slider Prominent by Default

The breakpoint slider bar takes ~90px of vertical space at the top. New users have no need for responsive breakpoint controls before adding their first field. This should be hidden by default and revealed when preview mode is active or via a toolbar control.

---

## §2. Slash Command Menu — PARTIAL PASS

### 2.1 Good

- Menu appears immediately when clicking `+ Add field` buttons
- Search input is focused, keyboard navigation works (arrows, Enter, Escape)
- All 6 "Common" templates visible without scrolling
- Categories present: Common, Structure, Display, Advanced

### 2.2 Missing Templates

Only 10 templates exist. The PRD (§3.2) specifies ~20+:

| PRD Template | Status |
|---|---|
| Short Answer | Present |
| Long Answer | Present |
| Number | Present |
| **Email** | **Missing** |
| Date | Present |
| Dropdown | Present |
| **Checkboxes** | Missing (have "Checkbox" singular) |
| **Yes / No** | **Missing** |
| **File Upload** | **Missing** |
| **Section** | Present (as "Section Group") |
| **Page Break** | **Missing** |
| **Repeating Group** | **Missing** |
| **Heading** | **Missing** |
| **Instructions** | **Missing** |
| **Divider** | **Missing** |
| **Rating** | **Missing** |
| **Signature** | **Missing** |
| Money | Present |
| **Slider** | **Missing** |
| **Likert Scale** | **Missing** |

### 2.3 No `/` Key Hint or Discoverability

The form surface has a keydown handler for `/` (FormSurface.tsx:159-174), but:
- The empty state doesn't mention `/` at all
- There's no visual affordance on the form surface showing that `/` works
- The handler only fires when the surface itself has focus and no input is active

### 2.4 Search Is Substring, Not Fuzzy

`filterTemplates` uses `.includes()` (field-templates.ts:128). Typing "em" won't find "Email" because it's not in the template list, but even for existing templates, there's no fuzzy matching — "shrt" won't find "Short Answer".

---

## §3. Selection & Inspector — SIGNIFICANT ISSUES

### 3.1 All Inspector Sections Default to Open

```ts
// FieldInspector.tsx:65
const isSectionOpen = (sectionId: string) =>
  props.project.value.uiState.inspectorSections[`field:${sectionId}`] ?? true;
```

The `?? true` fallback means **every section is expanded by default**: Basics, Logic, Validation, Appearance, Advanced. The PRD explicitly says: "Basic (expanded), Validation (collapsed), Behavior (collapsed), Layout (collapsed)."

Same pattern in FormInspector.tsx:42 — all 12 form-level sections default open.

### 3.2 Empty Logic Builders Pre-render With Confusing Defaults

When a new field has no logic configured, the Logic section still shows:
- **Show when:** a row with the field's own name selected + "equals" operator + empty value input
- **Required when:** same pre-populated empty row
- **Readonly when:** same

This is confusing. A user sees "Show when: [Full Name] [equals] [____]" and thinks conditional logic is already configured. The empty state should show nothing (or "No condition set" + "Add condition" button), not a pre-populated empty condition.

### 3.3 No Summary Pills on Collapsed Sections

PRD: "▸ LOGIC — ? Show when" pills showing summary of what's configured. Not implemented.

### 3.4 Inline Edit Doesn't Sync to Inspector Until Blur

When editing a label inline on the form surface, the inspector's Label field shows the old value until the inline edit is committed (on blur). This is technically correct (commit-on-blur design) but creates a jarring disconnect — two UI elements showing different values for the same property.

---

## §4. Progressive Disclosure — PARTIALLY IMPLEMENTED

### 4.1 Good

- Smart defaults work: new field gets type, key derived from template name, component auto-selected
- Logic badges (●, ?, =, !, 🔒) appear only when logic is configured and are clickable
- Formula templates (Sum, Count, Average) are one-click

### 4.2 Spec Internals Leak Through

| Location | Exposed Internal | Should Be |
|---|---|---|
| Field block top row | `string` data type pill | Hidden or friendlier name ("Text") |
| Inspector field | "Non-relevant behavior" | "When hidden" |
| Inspector field | "Excluded value" | "Empty value handling" |
| Inspector field | "Whitespace" / "Normalize" / "Remove" | Human-friendly labels or hidden |
| Inspector field | "Disabled display" / "Protected" | Friendlier names |
| Version panel | `items.shortAnswer` path notation | Just field label |
| Sub-form import | "$ref" and "engine assembler" | Just "Import sub-form" |
| Command palette | Key name shown alongside field label | Just the label |
| Mapping editor | "preserve", "valueMap", "flatten", "nest" | Human names per PRD §9 |

### 4.3 Hover-to-Reveal Partially Working

The `+ Add field` buttons appear between items — good. Drag handles are always visible (the `⋮⋮` button shows regardless of hover state). The PRD says handles should only appear on hover.

---

## §5. Visual Logic Builders — GOOD FOUNDATION

### 5.1 Good

- Condition builder present for Show when / Required when / Readonly when
- Field dropdown shows field labels (not keys)
- Operators adapt: text gets "equals/contains/starts with/is empty", etc.
- Visual/FEL toggle is present and non-prominent
- Constraint builder uses natural language: "This value must be [not empty]"
- Formula templates: Sum, Count, Average, Custom

### 5.2 Issues

- AND/OR connectors not visually distinct — just a `+ Add condition` button, no AND/OR label between rows
- Pre-populated empty conditions (§3.2 above) undermine the visual builder's clarity
- Can't test round-trip (visual → FEL → visual) without adding actual logic

---

## §6. Form Rules (Shapes) — PRESENT BUT UNTESTED

The section exists with `+ Add rule` button. Would need to add rules to fully test composition UI, severity icons, "Applies to" picker, and `{{expression}}` interpolation.

---

## §7. Brand & Style Panel — GOOD

- Color pickers present (hex input + native color swatch)
- Layout controls clear: Page mode, Label position, Density dropdowns
- Design Tokens section collapsed by default (the only section that defaults collapsed!)
- Style Rules section present with "Add style rule" button

---

## §8. Responsive Design — PRESENT

- Breakpoint slider in toolbar with named breakpoints (sm/md/lg/xl)
- Per-field responsive overrides in Appearance section: Span, Start, Hidden at breakpoint
- Clear breakpoint button present

---

## §9. Mapping Editor — FUNCTIONAL BUT EXPOSES RAW SPEC

- Rules table present: Source / Target / Transform / Reversible / Actions
- Transform dropdown shows raw spec values: "preserve", "drop", "expression", "coerce", "valueMap", "flatten", "nest", "constant", "concat", "split"
- PRD says: "Copy as-is" not "preserve", "Lookup table" not "valueMap"
- Round-trip test section present with "Run round-trip" button

---

## §10. Command Palette — GOOD FOUNDATION

- Opens with Cmd+K, shows search input
- Navigation commands: Go to form settings, Go to page, Go to field
- Action commands: Add field, Toggle preview, Toggle structure panel, etc.
- Issues:
  - **No keyboard shortcuts displayed** next to actions (PRD §2.3: "shortcuts displayed next to each action")
  - **No recent commands ranking**
  - **Field key shown** alongside label ("Go to field: Full Name / shortAnswer")

---

## §11. Preview Fidelity — BROKEN

- Preview uses iframe with `preview-frame.html` — correct architecture
- But iframe renders at only **150px tall** — the preview is barely visible
- In preview view mode, the layout bug (§1.1) also applies — preview gets squeezed
- `<formspec-render>` inside iframe appears to initialize but content is minimal

---

## §12. Structure Tree — FUNCTIONAL BUT LAYOUT ISSUE

- Shows field list with type icon and label
- Has drag-and-drop reorder support
- **Opening the structure panel with the inspector also open makes the form surface invisible** — the 3-column grid allocates structure (15-18rem) + form surface (1fr) + inspector (18-21rem), but with all three columns, the 1fr middle column collapses to near-zero

---

## §13. Error States & Edge Cases

- "No matches found" in slash menu on empty search results — good
- Diagnostics bar shows counts (0 errors / 0 warnings / 0 info) with "Show details" toggle
- "Selected item no longer exists" fallback in inspector — good
- Inline field rename: key stays as original template key ("shortAnswer") when label is changed to "Full Name" — key is not auto-derived from label changes (only from initial template)

---

## §14. Accessibility — PARTIAL

- Slash menu keyboard navigable (arrows + enter + escape)
- Form surface has `tabIndex={0}` for keyboard focus
- Logic badges have `aria-label` attributes
- `.sr-only` class defined
- Screen reader announcements for selection changes: not implemented
- Focus management on selection change: not implemented (focus stays where user clicked)

---

## §15. Performance Perception

- Interactions feel responsive — no visible lag
- Signal-based reactivity avoids unnecessary re-renders
- No loading spinners observed for local operations
- Can't test 100-field form scroll performance without more fields

---

## Priority Fix List

### P0 — Must Fix (Breaks Core Thesis)

1. ~~**Fix CSS grid layout** — form surface must be the 1fr column, inspector the fixed-width column. Adapt grid-template-columns based on which panels are visible.~~ DONE
2. ~~**Default inspector sections to collapsed** — change `?? true` to `?? false` for Logic, Validation, Appearance, Advanced (field inspector) and all non-Metadata sections (form inspector).~~ DONE
3. ~~**Hide inspector when nothing is selected** — or show a minimal "Select a field to edit its properties" message, not the full Form Inspector.~~ DONE
4. ~~**Fix empty logic builder state** — don't pre-render condition rows when no logic is configured. Show "+ Add condition" as the default.~~ DONE

### P1 — Should Fix (Significant UX Gaps)

5. ~~**Blank page state** — add "Type / to add a field" hint, match PRD's mockup.~~ DONE
6. ~~**Hide breakpoint slider by default** — only show when preview is active or user explicitly opens it.~~ DONE
7. ~~**Add missing slash menu templates** — Email, Yes/No, File Upload, Page Break, Repeating Group, Heading, Instructions, Divider at minimum.~~ DONE — added Email, Yes/No, File Upload, Repeating Group, Heading, Instructions, Slider (17 total)
8. ~~**Preview iframe sizing** — make it fill available height, not 150px.~~ DONE — added grid-template-rows to workspace
9. **Human-friendly labels** — replace spec terminology in mapping editor, inspector advanced fields, version panel.
10. ~~**Add summary pills to collapsed inspector sections** — "▸ LOGIC — ? Show when" pattern.~~ ALREADY WORKS — Collapsible summary prop + LogicSection summaryTokens were already wired up.

### P2 — Should Fix (Polish)

11. **Command palette keyboard shortcuts** — show shortcut keys next to each action.
12. **Fuzzy search** in slash menu and command palette.
13. **Drag handles hover-only** — don't show until hover.
14. **Key auto-derivation from label** — when user edits label, update key if it still matches the template default.
15. **Hide spec internals** — "string" type pill, "$ref", "items.shortAnswer" paths, "Non-relevant behavior" labels.

### P3 — Nice to Have

16. Field key shown in command palette — just show label.
17. AND/OR visual connectors between condition rows.
18. Screen reader selection announcements.
19. Focus management on selection change.
