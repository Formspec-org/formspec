# Editor Workspace Visual Design Handoff Brief

**Date:** 2026-03-31
**Target:** `packages/formspec-studio/src/workspaces/editor/`
**Reviewer:** Formspec Visual Designer agent
**Branch:** `feat/editor-layout-split`

---

## 1. Current State

The Editor workspace presents a three-column shell: a left Blueprint sidebar (~214px), a center canvas containing the `DefinitionTreeEditor`, and a right Form Health panel (~320px). The Build view renders definition fields and groups as stacked cards inside a floating card container (`max-w-[980px]`, 22px border-radius, drop shadow). Selected fields expand inline to show a 4-column category summary grid (Visibility / Validation / Value / Format) and a secondary description/hint section below the identity header.

Screenshots captured during review:
- `editor-initial.png` — default state, Build view, no selection
- `editor-field-selected.png` — "Full Legal Name" field selected, showing inline expansion
- `editor-category-expanded.png` — Visibility category panel expanded below summary
- `editor-manage-view.png` — Manage view showing Option Sets, Calculated Values sections

---

## 2. Verdict

**Component restructure + CSS fixes.** The design system token set is sound; the color palette, font families, and radius conventions are coherent. The problems are: (a) one layout mistake (sticky toggle bar that wastes vertical space), (b) an inverted type hierarchy (key visually dominates label), (c) selected-state tokens that are too subtle to be reliable, and (d) empty category cells that lack click affordance. No redesign is needed; the visual language is worth keeping and extending. The scope is targeted CSS value changes, one structural component change, and affordance additions.

---

## 3. Visual Problems

### Problem 1: The sticky Build/Manage bar wastes 48px of premium vertical space

**Symptom:** A `sticky top-0` header band sits between the main app header and the editor canvas. It contains exactly one thing: the Build/Manage segmented control. The band occupies ~48px of persistent vertical space above the scrollable canvas.

**Domino chain:** The Build/Manage toggle was designed as a page-level control and placed in a sticky chrome layer (pattern borrowed from a tab-switcher pattern). The toggle is ~34px tall; the band adds 14px of padding above and below, creating wasted vertical space that pushes the canvas content down and introduces a mid-UI horizontal divider that carries no semantic weight.

**First domino:** `Shell.tsx`, line 419-426:
```
<div className="sticky top-0 z-20 border-b border-border/70 bg-bg-default/80 backdrop-blur-md px-6 py-3">
  <BuildManageToggle ... />
</div>
```
The entire sticky band exists for one element. The toggle should live inside the canvas card header alongside the title and context badges, not in a separate sticky layer.

**Fix scope:** Component restructure. Move `BuildManageToggle` into the `DefinitionTreeEditor` card header section (alongside "Structure editor" label and context pills). Remove the sticky wrapper from Shell.tsx. The canvas content should begin immediately after the app header.

---

### Problem 2: Machine key visually dominates the human label

**Symptom:** Each field card shows the machine key (`app.name`) at 17-18px font-mono semibold in high-contrast ink. The human display label ("Full Legal Name") renders below it at 14-15px in `text-ink/72` (72% opacity). Authors of form definitions think and work in labels, not machine keys. The label is what form respondents see; the key is what developers see. The current treatment reverses the intended priority.

**Domino chain:** `ItemRowContent.tsx` `IdentityColumn` renders the key block first at lines 163-186 (large mono semibold), then the label at lines 205-226 (smaller, dimmed). Font sizes were chosen to distinguish key from label type, but the result gives key visual supremacy.

**First domino:** `ItemRowContent.tsx`, line 163:
```
<div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 md:text-[18px]'>
```
The primary identity slot is used for the key. The label is demoted below it.

**Fix scope:** CSS fix + minor structural change. Options in order of preference:
- (a) Swap the display hierarchy: render label as the primary heading (17-18px, semibold), key as a secondary descriptor below it (12-13px, mono, `text-ink/55`). This matches how all other professional form builders present field identity.
- (b) If the key must stay primary (for technical authoring), at minimum increase the label's contrast to `text-ink/85` and size to 15-16px so it reads as co-primary, not subordinate.

For display items (`isDisplayItem`), the current ordering (label primary, key secondary) is already correct — only the field item ordering needs reversal.

---

### Problem 3: Selected state is too subtle — confirmation ambiguity at a glance

**Symptom:** Clicking a field card applies `bg-accent/[0.05]` (5% opacity blue) and `border-accent/30` (30% opacity). The visual difference from an unselected card is barely perceptible at normal viewing distance. In the screenshot (`editor-field-selected.png`), the selected card requires deliberate study to distinguish from its neighbors.

**Domino chain:** The selection treatment uses Tailwind opacity modifiers on the accent color. 5% opacity on a white/light surface is indistinguishable from the surface itself at normal contrast. The 30% border adds a slight blue tint to the border, but since all card borders are already `border-border/65` (a cool gray), the distinction is marginal.

**First domino:** `ItemRow.tsx`, line 546:
```
'border-accent/30 bg-accent/[0.05] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
```

**Fix scope:** Token tweak (CSS value change). Recommended values:
- Background: `bg-accent/[0.09]` — just enough to register as distinct from white without feeling heavy
- Border: `border-accent/50` — 50% opacity provides clear blue edge without shouting
- Shadow: the existing `shadow-[0_14px_34px_rgba(59,130,246,0.12)]` is fine, keep it

The goal is that a selected card reads as selected from 60cm away without squinting. Test at 100% zoom on a 1440px display against the default white surface.

For `GroupNode.tsx` line 237: same fix — `border-accent/40 bg-accent/[0.05]` → `border-accent/55 bg-accent/[0.09]`.

---

### Problem 4: Empty category cells have no click affordance

**Symptom:** The category summary grid (Visibility / Validation / Value / Format) shows `—` (em-dash) for all unset categories. There is no visual cue that these cells are interactive when the item is selected. The cursor changes to `cursor-pointer` on hover (CSS only), but there is no persistent affordance — no "+" button, no dashed border, no "Add..." prompt. A new user has no reason to believe these cells are clickable.

**Domino chain:** `ItemRowContent.tsx` `SummaryColumn` at line 342-367 renders categories as `<dl>` items. The click handler (`onClick`) is present on the containing `<div>`, but only when `selected`. The cell content is just the value string or an em-dash. No affordance pattern (dashed border, add icon, italic placeholder text) is applied to empty selected categories.

**First domino:** `ItemRowContent.tsx`, line 355-366: the `<dt>/<dd>` pair renders value or `—` with no conditional affordance pattern for `selected && !value` state.

**Fix scope:** CSS fix + micro-component change. When `selected` and value is `—` (or empty), replace the em-dash with an italic placeholder like "Add..." in `text-ink/40`, and add a subtle `ring-1 ring-accent/15 rounded` to the cell on hover. This matches the pattern already used in the `supportingText` section (lines 430-436: `'Click to add ${entry.label.toLowerCase()}'`). Make the category grid cells consistent with that pattern.

---

### Problem 5: Three-level card nesting creates hierarchy noise

**Symptom:** Visual inspection reveals: (1) the warm-gradient canvas shell, (2) the `bg-surface/96` rounded master card with 24px drop shadow, (3) the group node rounded card, (4) the field item rounded card inside the group. Four visual container layers are active simultaneously. The master card's shadow is extremely prominent (`0_24px_70px_rgba(30,24,16,0.08)`) — it looks like the card is floating an inch above the canvas, but everything inside it is just flat items.

**Domino chain:** `DefinitionTreeEditor.tsx` line 382-383 wraps the entire tree in a `rounded-[22px] border border-border/65 bg-surface/96 shadow-[0_24px_70px_...]` div. This was added as a "document" container to give the editor a distinct canvas feel. But the canvas already has a warm gradient background that creates separation. The master card's visual weight then makes the field cards (which have their own rounded corners and borders) feel redundant.

**First domino:** `DefinitionTreeEditor.tsx`, line 382. The master card container exists when it doesn't need to — the canvas background + field cards provide sufficient structure.

**Fix scope:** CSS fix. Two options:
- (a) Remove the master card's visible border and heavy shadow; keep the `rounded-[22px]` container for spacing/padding but use `bg-transparent` or just `bg-surface/60` without a shadow. The field and group cards will create their own visual rhythm without a container dominating them.
- (b) Keep the master card but reduce its shadow from `0_24px_70px_rgba(30,24,16,0.08)` to `0_4px_16px_rgba(30,24,16,0.04)` — enough to suggest containment without announcing it.

Option (b) is the safer one-line fix.

---

### Problem 6: Form Health panel competes for eye attention via persistent red error badges

**Symptom:** The right panel (`FormHealthPanel`) shows a "6 errors" badge in `text-error` red at the top of the response document JSON section. Below it, the JSON viewer uses `text-error` for constraint failures inline within the data. This creates a persistent red stream on the right edge of the viewport that competes with the canvas selection accent (blue). The eye constantly drifts right to "6 errors."

**Domino chain:** The panel combines two concepts in one scrolling view: (1) a form health check (structural/lint issues), and (2) a live response document with inline validation annotations. Concept 1 is about the form definition quality. Concept 2 is about runtime state. They use the same error color in the same visual region.

**First domino:** `FormHealthPanel` composition — the panel was designed to show "is the form valid to publish" alongside "what does a live response look like." These are distinct contexts with different urgency levels. The response document's inline error annotations (constraint failed, invalid choice) are the runtime execution results from the example data, not the form author's structural errors.

**Fix scope:** Component restructure (moderate). The "ISSUES — No issues found" section and the "RESPONSE DOCUMENT — 6 errors" section should be visually separated with a stronger header treatment. The error count badge on the response document section should use `text-amber` (warning-level) or be removed in favor of inline annotations, since these are data validation results from example values, not form design errors. The form health "issues" section should remain as the top-of-panel primary content with clear green/error treatment.

---

### Problem 7: The warm gradient background switches between Build and Manage views

**Symptom:** Build mode applies `bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)]` to the canvas shell. Manage view does not get this gradient — it defaults to flat `bg-bg-default`. This means switching between Build and Manage produces a visible background color shift in the canvas area.

**Domino chain:** `Shell.tsx` line 391: the gradient class is conditional on `activeTab === 'Editor' && activeEditorView === 'build'`. Manage view was added after the gradient, and the background was not extended to it.

**First domino:** `Shell.tsx`, line 391. The conditional was written for the original single-view Editor (Build-only) and was not updated when the Manage view was introduced.

**Fix scope:** Token tweak. Apply the warm gradient to both Build and Manage editor views: change the condition from `activeEditorView === 'build'` to `activeTab === 'Editor'`.

---

### Problem 8: Typography scale has too many sizes with no clear rhythm

**Symptom:** Active sizes in the editor: 11px (category labels, mono), 12px (data type tag, group key inline), 13px (panel headings), 14px (label, category values, inline inputs), 15px (label md, category values md), 17px (field key), 18px (field key md), 20px (group key), 22px (group key md). Nine distinct sizes in one view.

**Domino chain:** Each component independently chose a size that felt proportional to its context. There's no shared spacing/type scale being enforced — sizes are hardcoded at each declaration site.

**First domino:** No shared type scale utility. The design system tokens in `index.css` define color tokens but no font-size scale tokens. All sizes are hardcoded in component class strings.

**Fix scope:** Design system revision (lower priority, medium scope). The immediate actionable items are:
- Collapse the field key and label into a 2-level hierarchy (label primary at 17-18px, key secondary at 12-13px mono) — this simultaneously fixes Problem 2 and reduces the size count.
- Group key should use 18px, not 20-22px — groups and fields can live at the same key size since the group is visually distinguished by containment and the expand/collapse button, not size alone.
- After those changes, the active size count reduces to: 11px (categories), 13px (panel labels), 14px (inputs/values), 17-18px (primary identifiers). This is a 4-level scale — a manageable, intentional ramp.

---

## 4. Design Constraints

**Non-negotiable requirements any proposal must respect:**

### Formspec Spec Requirements
- The editor operates entirely at Tier 1 (definition items/binds) — no component tree or theme cascade is active in the Build view. Visual treatment must not imply theme-tier structure.
- Inline editing of key and label must preserve separate affordance paths — these are distinct concepts (machine identifier vs display label) even if they sometimes share the same value.
- Display items (`type: 'display'`) must be visually distinct from field items — they belong in the layout workspace but appear here for reference; the visual treatment must not suggest they are editable at the same tier as fields.
- Category panel (Visibility / Validation / Value / Format) maps directly to bind categories. Category headers must maintain their semantic groupings — do not rename or re-order them.

### Accessibility Requirements
- All interactive affordances must have focus-visible states with `focus-visible:ring-2 focus-visible:ring-accent/35` or equivalent.
- `aria-hidden="true"` on decorative marks (EditMark, etc.) — preserve all existing ARIA attributes.
- When `labelPosition: 'hidden'` is used anywhere, the label must remain in accessible markup — not visually removed. The current inline editors all use `aria-label` attributes correctly; this constraint is about not breaking them.
- Color alone must not be the only indicator of interactive state — the selected state fix (Problem 3) must use border change + background change + shadow change, not color alone.
- WCAG AA: `text-ink/62` (category label) resolves to approximately `#8a9ab3` on white — contrast ratio ~3.2:1 for 11px text, which is below 4.5:1. This is a known gap. Any redesign that increases the contrast of category labels is an accessibility improvement, not a regression.

### Responsive Requirements
- The `compactLayout` breakpoint at ≤1024px produces a vertical stack (Blueprint + SidebarComponent + WorkspaceContent as three stacked cards). Changes to the desktop layout must not break the mobile stacking — the component structure in Shell.tsx that handles this must be preserved.
- Touch targets for all interactive elements must remain ≥44px tall (DragHandle, toggle expand, select buttons). The `h-11` constraint on the DragHandle is intentional — do not reduce it.
- Only presentation properties may vary at breakpoints — the structural change proposals (Problem 1: moving the toggle) must not change component hierarchies for mobile vs desktop.

### Design System Elements to Preserve
- The accent color (#2563eb blue) as the primary interactive color for selection, actions, and FEL expression indicators.
- Logic color (#7c3aed purple) for bind/expression elements — this is the semantic encoding for "this is a behavior/logic element."
- Green (#059669) for "value" category (calculate, initial value) semantic color.
- The JetBrains Mono font for machine keys, category labels, and FEL expressions — this is a deliberate monospace semantic.
- The Space Grotesk UI font for all prose content — do not mix with mono in prose contexts.
- The `rounded-[10px]` border radius on interactive buttons and inputs — this is the component-level radius convention.
- The focus ring pattern: `focus-visible:ring-2 focus-visible:ring-accent/35` — inset per the global `:focus-visible` rule in `index.css`.

---

## 5. Design Direction

### Visual Hierarchy Goals
- **Primary:** Human label ("Full Legal Name") — what respondents see, what authors name their fields by.
- **Secondary:** Machine key (`name`) — identifiers shown at smaller size, mono, dimmed.
- **Tertiary:** Category summary values (Always, —, formula) — meta-information subordinate to identity.
- **Quaternary:** Status pills (Required, Calculated) — behavioral badges shown after the summary.

The eye should land on the label first, then the key, then the category grid. This is the reverse of the current implementation.

### Spacing and Density Intent
The current density is "comfortable" (visible in the status bar). This is the right call — form definition authoring requires legible, spacious cards. The goal is consistent internal padding within cards, not reduction. Specific fixes:
- Field cards: `px-3 py-4 md:px-4` is appropriate, keep it.
- The `gap-4` between the identity block and the summary block (line 571 in ItemRow) could reduce to `gap-3` — the current spacing feels slightly loose when a field has four empty category columns below a 2-line identity.
- The category grid `gap-y-3` is appropriate for 2-3 categories; `gap-y-2` would be tighter but may feel cramped. Keep `gap-y-3`.
- Group node children: `ml-5 mt-2 gap-1 border-l border-border/55 pb-1 pl-4` — the left border treatment is good. `gap-1` (4px) between children is very tight. Consider `gap-2` (8px) for breath between sibling fields.

### Color and Contrast Guidance
- Selected card background: `bg-accent/[0.09]` (increase from 0.05 — 9% opacity on white = ~#eef3fd, WCAG pass as a background)
- Selected card border: `border-accent/50` (increase from 0.30 — 50% opacity provides clear blue without saturation)
- Category label text: increase from `text-ink/62` to `text-ink/72` — this brings the 11px mono from ~3.2:1 to ~3.8:1 on white, closer to AA for non-critical UI text. This is the minimum acceptable; increasing to 80% would be AA-compliant.
- Empty category values ("—"): render as `text-ink/35 italic` to signal emptiness, change to `text-ink/55 italic "Add..."` when selected. The "Add..." state should also add `rounded-[4px] ring-1 ring-dashed ring-accent/20 px-1 -mx-1 hover:ring-accent/40` on the DD element to signal interactivity.
- Form Health panel: change the "6 errors" response document badge from `text-error` to `text-amber` — these are data validation results, not structural form errors. Reserve `text-error` for the ISSUES section above it.

### Typography Guidance
After fixing Problem 2 (key/label hierarchy), the intended type ramp for field cards:
- Field label: 16px, Space Grotesk, semibold, `text-ink` (primary identity)
- Field key: 12px, JetBrains Mono, medium, `text-ink/60` (secondary identity)
- Data type badge: 11px, JetBrains Mono, normal, `{dt.color}` (unchanged)
- Category DT label: 11px, JetBrains Mono, normal, `text-ink/72` (increased from 62)
- Category DD value: 14px, Space Grotesk, medium, `text-ink/90` (unchanged)

For group cards:
- Group label: 18px, Space Grotesk, semibold, `text-ink` (equal size to field label, distinguished by containment)
- Group key: 13px, JetBrains Mono, medium, `text-ink/60`
- "group" type badge: 11px, JetBrains Mono, `text-accent` (unchanged — this is correct)

### Interaction State Treatment
Define a clear visual state ladder for field cards:

| State | Background | Border | Shadow |
|-------|-----------|--------|--------|
| Default | transparent | transparent | none |
| Hover | `bg-bg-default/56` | `border-border/70` | none |
| Selected | `bg-accent/[0.09]` | `border-accent/50` | `0_14px_34px_rgba(59,130,246,0.16)` |
| Selected + category expanded | `bg-accent/[0.09]` | `border-accent/50` | same |
| Editing identity | `bg-surface` | `border-accent/40` | same |

The currently collapsed "editing identity" state is handled by `activeIdentityField` — when active, the card shows inline inputs. This state should visually read as "more focused" than just selected, not less. Consider a slightly stronger background (`bg-surface` = white) to make the editing context feel grounded.

---

## 6. Scope Boundaries

### In Scope
- Fix the Build/Manage toggle placement (remove sticky band, integrate into canvas card header)
- Fix key/label visual hierarchy (label primary, key secondary)
- Fix selected state opacity values (3 Tailwind class changes)
- Fix empty category affordance (add "Add..." placeholder and dashed ring on hover)
- Fix master card shadow (reduce from 70px to 16px blur)
- Fix Manage view background (extend warm gradient to Manage view)
- Fix category label contrast (62% → 72%)
- Reduce group key font size from 20-22px to 18-20px to align with field row scale
- Form Health panel: change response document error badge color

### Out of Scope
- Redesigning the category system (Visibility / Validation / Value / Format are spec-tied)
- Changing the Form Health panel's information architecture substantially
- Responsive/mobile layout changes beyond ensuring the sticky band removal doesn't break mobile
- The left Blueprint sidebar (not part of the editor workspace being assessed)
- The Screener authoring view (`ScreenerAuthoring.tsx`)
- Any changes to FEL expression editors (`InlineExpression`, `BindCard`) — these are correct as-is
- Changes to the Properties Panel (Layout tab) — different workspace
- Dark mode (a follow-up; the current dark mode is functional, not the review focus)

---

## 7. Success Criteria

A successful redesign of the editor workspace satisfies all of the following:

1. **Label first:** On any field card (selected or not), a viewer identifies the human label ("Full Legal Name") before the machine key (`name`) without conscious effort. The label must be visually dominant — larger, heavier, or more saturated than the key.

2. **Selection is unambiguous at arm's length:** A selected field card is instantly distinguishable from its unselected neighbors at normal viewing distance (1 meter from a 1440×900 display at 100% zoom). No squinting required.

3. **Empty categories invite interaction:** When a field is selected and a category (e.g., Validation) shows no configured value, the cell communicates "this is empty and clickable" through a persistent visual affordance, not just a hover state. A new user who has never used the editor can discover category editing within 5 seconds of selecting a field.

4. **The canvas area begins immediately after the app header:** No intermediate sticky chrome band exists between the header and the scrollable canvas. The Build/Manage toggle is reachable from the canvas without scrolling.

5. **The Form Health right panel does not distract from the canvas:** Viewing a Form Health panel where "ISSUES: No issues found" and the response document has validation annotations, the primary visual signal from the panel is "form is healthy" (green checkmark dominant) — not "6 errors" in red. The canvas selection accent (blue) remains the most salient color on screen when a field is selected.
