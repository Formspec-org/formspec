# Design & UX Review Plan: Formspec Studio v2

## Context

Review plan for the Formspec Studio v2 implementation against `thoughts/PRD-v2.md`. Prioritizes design quality and user experience over code internals. The Studio must make ~373 spec properties feel approachable — the first 40 like writing a note, the next 110 through natural exploration, and the remaining 223 without making the simple path heavy.

---

## 1. Document-First Experience (Critical — Core Differentiator)

The PRD's central bet: the form **is** the editor. This must feel like Notion/Tally, not a tree+inspector IDE.

**Review:**
- [ ] Blank page state: Does it feel inviting? Title placeholder + blinking cursor + "Type / to add a field" — no chrome, no empty panels
- [ ] First interaction: Can a user add their first field within 5 seconds of opening?
- [ ] Inline editing: Click label → edit in place. Click description → edit in place. No modal, no panel switch
- [ ] Flow state: Adding 10 fields in a row should feel like typing, not clicking through menus
- [ ] The form surface must look like a **form**, not a wireframe or a JSON tree
- [ ] Inspector is **invisible** until you select something — verify the right panel doesn't show an empty state or placeholder

**Red flags:**
- Any moment where the user must look away from the form surface to accomplish a basic task
- Empty panels or "select something to begin" messages
- Form surface that looks like a code editor

---

## 2. Slash Command Menu (Critical — Primary Input)

The `/` menu is how 90% of fields get created. It must be as fast as Notion's slash menu.

**Review:**
- [ ] Appears instantly (<50ms) at cursor position — no layout shift
- [ ] Search is instant: `/em` narrows to Email immediately, no debounce visible
- [ ] Categories (Common / Structure / Display / Advanced) are scannable — Common items visible without scrolling
- [ ] Keyboard flow: type `/`, type letters to filter, arrow to select, Enter to insert — never need the mouse
- [ ] After insert: label is focused for immediate typing — zero extra clicks
- [ ] Add-between button (`+` on hover) opens the same menu — consistent entry point
- [ ] Menu dismisses on Escape, click-outside, or scroll away

**Red flags:**
- Menu that requires scrolling to find "Short Answer" or "Dropdown"
- Any lag between typing and filter results
- Focus trap issues (can't escape the menu naturally)

---

## 3. Selection & Inspector Adaptation (Critical)

"Selection drives everything" — Figma's insight applied to forms.

**Review:**
- [ ] Click field → inspector shows field properties. Click group → group properties. Click nothing → form-level settings
- [ ] Selection highlight is visible but subtle — doesn't obscure the form content
- [ ] Inspector transitions feel immediate — no loading, no flicker
- [ ] Collapsible sections show summary pills when collapsed with content: `▸ LOGIC — ? Show when`
- [ ] Section expand/collapse is animated but fast (150ms max)
- [ ] Inspector scroll position resets sensibly when selection changes

**Red flags:**
- Inspector shows all sections expanded by default (information overload)
- Switching selection causes visible re-render or layout jump
- No visual indication of which item is selected on the form surface

---

## 4. Progressive Disclosure (Critical — The Complexity Problem)

Five patterns must compose correctly: smart defaults, collapsed sections, hover-to-reveal, mode switching, contextual surfacing.

**Review:**
- [ ] **Smart defaults:** New field has useful type, key derived from label, component selected — zero-config state works
- [ ] **Collapsed sections:** Basic expanded, Logic/Validation/Appearance/Advanced collapsed by default
- [ ] **Hover-to-reveal:** Drag handles, delete buttons, add-between — only appear on hover, don't shift layout
- [ ] **Mode switching:** Simple/Advanced toggle exists but is subtle — doesn't make the interface feel dual-mode
- [ ] **Logic badges:** ● ? = ! 🔒 badges are visible at a glance but don't clutter — verify they're small enough to not dominate but large enough to notice

**Red flags:**
- New user sees FEL syntax, JSON, bind paths, or "definition" anywhere in Phase 1 UI
- Advanced options visible by default
- Hover affordances that cause layout shift (elements jumping when handles appear)

---

## 5. Visual Logic Builders (High — Key Differentiator)

Non-technical users must set conditional logic without writing expressions.

**Review:**
- [ ] "Show when" builder: `[field ▼] [operator ▼] [value]` is immediately understandable
- [ ] Field dropdown shows fields by **label** (not key) grouped by section
- [ ] Operators adapt to field type — text gets "equals/contains/starts with", numbers get ">/</between"
- [ ] AND/OR connectors are obvious — not just text links
- [ ] Expression toggle (`⟨/⟩ Edit as expression`) is present but not prominent — positioned as escape hatch
- [ ] Calculate templates (Sum, Count, Average) are one-click — no configuration needed for common cases
- [ ] Constraint builder ("This value must be at least 0") reads as natural language
- [ ] Round-trip: visual → FEL → visual works for simple expressions. Complex FEL gracefully shows "too complex for visual builder" instead of breaking

**Red flags:**
- Builder that requires understanding FEL path syntax ($fieldName)
- Expression editor as the default (should be visual builder as default)
- AND/OR logic that's confusing — users should be able to build "show when budget type is 'detailed' AND amount > 0" without thinking

---

## 6. Form Rules (Shapes) — Phase 2

Cross-field validation presented as "Form Rules" — never as "Validation Shapes."

**Review:**
- [ ] Rule list shows name + severity icon + plain-English description
- [ ] "Applies to" picker: Entire form / Specific field / Each instance of — clear what each means
- [ ] Composition: "ALL of these must pass" / "ANY" / "EXACTLY ONE" — presented as checkboxes, not "and/or/xone"
- [ ] Message supports `{{expression}}` interpolation — typing `{{` shows field picker
- [ ] Advanced section (timing, code, context) stays hidden unless explicitly opened

**Red flags:**
- Exposing shape IDs, composition operators, or target syntax to the user
- Rule editor that requires understanding the Shape spec

---

## 7. Brand & Style Panel

Design token abstraction hidden behind color pickers and font selectors.

**Review:**
- [ ] Color pickers feel native — not a raw hex input
- [ ] Changing "Primary" color updates the preview immediately
- [ ] Layout controls (page mode, density, labels) use visual previews or clear labels
- [ ] Design tokens section is collapsed and clearly labeled as power-user territory
- [ ] Token editor shows category grouping (color.*, spacing.*, typography.*)

**Red flags:**
- Token syntax (`$token.color.primary`) visible in the basic brand panel
- No live preview feedback when changing colors
- Layout options that require understanding CSS grid

---

## 8. Responsive Design — Phase 2

Breakpoint slider for "design at this screen size."

**Review:**
- [ ] Slider is intuitive — dragging resizes the preview smoothly
- [ ] Named breakpoints (Mobile / Tablet / Desktop) snap with labels
- [ ] Per-field responsive overrides (span, visibility) are clear: "Hide on mobile" not "responsive.sm.hidden: true"
- [ ] Mobile preview doesn't break layout

---

## 9. Mapping Editor — Phase 3

Table-based data mapping — never expose the 60-property Mapping schema.

**Review:**
- [ ] Rules table is scannable: Source → Target → Transform → Reversible
- [ ] Transform types have human names: "Copy as-is" not "preserve", "Lookup table" not "valueMap"
- [ ] Round-trip test is one-click with clear pass/fail output
- [ ] Direction toggle (Forward / Reverse / Both) is clear

---

## 10. Command Palette

`Cmd+K` power-user entry point.

**Review:**
- [ ] Opens instantly, focused on search input
- [ ] Fuzzy search works: "budg" finds "Budget Total" field and "Budget must balance" rule
- [ ] Keyboard shortcuts displayed next to each action (passive learning)
- [ ] Recent commands ranked higher
- [ ] Escape closes cleanly

---

## 11. Preview Fidelity

Preview must be identical to deployed rendering.

**Review:**
- [ ] Uses `<formspec-render>` in iframe — verify CSS isolation (studio styles don't leak)
- [ ] All form interactions work: fill fields, wizard navigation, validation feedback
- [ ] Calculated values update in real-time
- [ ] Conditional fields show/hide correctly
- [ ] Diagnostics bar shows live error/warning/info counts

---

## 12. Structure Tree

Secondary navigation for complex forms.

**Review:**
- [ ] Hidden by default — doesn't intimidate simple form users
- [ ] Tree accurately reflects nesting hierarchy
- [ ] Logic badges inline (?, =, !, 🔒)
- [ ] Click navigates (scrolls form surface + opens inspector)
- [ ] Drag to reorder works without jank

---

## 13. Error States & Edge Cases

**Review:**
- [ ] Empty form: inviting, not barren
- [ ] Invalid FEL expression: inline error message, not modal or toast
- [ ] Schema validation errors: diagnostics bar shows count, detail panel has clickable links
- [ ] Rename field used in FEL: all references auto-update (verify no broken paths)
- [ ] Delete field used in other fields' logic: warning or auto-cleanup
- [ ] Very long form (100+ fields): form surface scrolls smoothly, tree stays useful
- [ ] Deeply nested groups (3+ levels): still readable

---

## 14. Accessibility

- [ ] All form surface actions keyboard-accessible
- [ ] Inspector sections navigable by keyboard
- [ ] Slash menu navigable by keyboard (arrow + enter)
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader announces selection changes
- [ ] Focus management: selecting an item moves focus logically

---

## 15. Performance Perception

- [ ] Slash menu appears in <50ms
- [ ] Inspector switch feels instant (<100ms)
- [ ] Preview update after edit <500ms
- [ ] No visible loading spinners for local operations
- [ ] Form surface scrolls at 60fps with 100 fields

---

## Review Priority Order

1. **Document-first experience** (§1) — if this doesn't feel right, nothing else matters
2. **Slash commands** (§2) — primary input method
3. **Selection + inspector** (§3) — core interaction loop
4. **Progressive disclosure** (§4) — the complexity management strategy
5. **Visual logic builders** (§5) — key differentiator from raw JSON
6. **Preview fidelity** (§11) — must match deployed behavior
7. **Error states** (§13) — graceful degradation
8. Everything else in listed order
