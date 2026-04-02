# Editor Workspace Visual Design — Service Designer Review

**Date:** 2026-03-31
**Reviewer:** Formspec Service Designer
**Proposal reviewed:** Evolutionary
**Verdict:** Conditional Endorsement — Safe to implement with three required modifications

---

## Endorsement

The Evolutionary proposal is safe to implement. Its changes resolve real user problems: the inverted identity hierarchy causes cognitive friction on every field interaction, the invisible selection state undermines the basic authoring loop, and the empty category cells are a discovery failure. These are not aesthetic problems — they are interaction problems, and the proposal fixes them correctly.

I endorse the proposal with three required modifications and several lower-priority suggestions. The modifications address interaction regressions introduced by the proposal that the visual-designer review did not surface.

---

## User Journey Impact

### Happy path: Author opens a form, selects a field, edits its label and a constraint

**Before this proposal:**
1. Author opens the editor. They scan field cards. Their eye lands on the large mono key (`app.name`) first — the machine identifier, not the human name. They have to consciously look below it to find the display label ("Full Legal Name") in smaller, dimmed text. Every field scan requires extra cognitive work to find the name they care about.
2. Author clicks a field. The selected state changes, but at normal viewing distance the card looks nearly identical to its unselected neighbors. The author may re-click, unsure the selection registered.
3. Author sees the Validation category showing "—". They hover over it. The cursor changes to a pointer (CSS only). They may or may not discover it is clickable; there is no textual affordance until hover.

**After this proposal:**
1. Author opens the editor. Their eye lands on the label at 16px semibold ("Full Legal Name") — then reads the smaller mono key below it. Scan cost drops because the hierarchy now matches the author's mental model: they named this field, they think of it by name.
2. Author clicks a field. The selected card has a clearly distinct blue-tinted background (`bg-accent/[0.09]`), a 50% opacity accent border, and a blue shadow. It reads as selected from across the room.
3. Author selects a field with an unconfigured constraint. They see "Add validation…" in italic below the "VALIDATION" category label — a persistent textual affordance. No hover required.

The proposal improves all three steps of the core authoring loop.

---

## Interaction Concerns

### Concern 1 (Required): Tab cycle direction is now reversed for keyboard users — REGRESSION

**Severity: Data-integrity risk / keyboard accessibility regression**

This is the most consequential interaction issue in the proposal.

The current implementation (line 113–121 of `ItemRowContent.tsx`) defines Tab cycling as:
- `Tab` while editing **key** → commits key, opens **label**
- `Shift-Tab` while editing **label** → commits label, opens **key**

This key-first Tab order matches the current DOM order: key renders above label.

The proposal inverts the DOM order — label now renders above key — but does not invert the Tab cycle logic. The `handleIdentityKeyDown` function in the proposal is copied verbatim from the current implementation (proposal lines 534–557):

```tsx
if (field === 'key' && !event.shiftKey) {      // Tab from key → opens label
  onCommitIdentityField('key');
  onOpenIdentityField('label');
} else if (field === 'label' && event.shiftKey) { // Shift-Tab from label → opens key
  onCommitIdentityField('label');
  onOpenIdentityField('key');
}
```

After the hierarchy swap, the label input renders first in the DOM. A keyboard user who opens the label editor and presses Tab should naturally advance to the key (the next field below). Instead, with the current Tab logic preserved, `Tab` from the label editor does nothing (falls through to browser default Tab behavior, which exits the field row entirely). `Shift-Tab` from the label editor correctly navigates to the key (which is now above in the current DOM, but below in the new DOM).

The user experience: a keyboard-first author opens the label editor, fills it in, presses Tab expecting to edit the key — and focus jumps out of the card. They lose their keyboard workflow. This is a regression from the current implementation where Tab correctly cycles both identity fields.

**Required fix:** Invert the Tab cycle logic to match the new DOM order:
- `Tab` while editing **label** → commits label, opens **key** (forward: label → key)
- `Shift-Tab` while editing **key** → commits key, opens **label** (backward: key → label)

The corrected `handleIdentityKeyDown` logic:
```tsx
if (field === 'label' && !event.shiftKey) {      // Tab from label → opens key
  event.preventDefault();
  onCommitIdentityField('label');
  onOpenIdentityField('key');
} else if (field === 'key' && event.shiftKey) {  // Shift-Tab from key → opens label
  event.preventDefault();
  onCommitIdentityField('key');
  onOpenIdentityField('label');
}
```

This also means the `aria-label` values on the two inputs are correct in the new order: `aria-label='Inline label'` on the first input and `aria-label='Inline key'` on the second. Screen reader users navigating by field order will encounter the label input first, which is correct.

---

### Concern 2 (Required): Label-only field has no path to the key editor when no label is set — REGRESSION

**Severity: Data-loss risk / orphaned field state**

The current implementation makes the label row conditionally visible: `{(labelForDescription || selected) && ...}`. An unselected field without a label simply does not render the label row at all. This is fine in the current DOM order because the key is still visible and selectable.

In the proposal, the label is always the primary displayed element. But the proposal uses `text-empty` italic placeholder text ("Add a display label…") as the label placeholder when `labelForDescription` is null. Look at the proposal's label rendering block (lines 607–611):
```tsx
<span className={labelForDescription ? '' : 'text-empty'}>
  {labelForDescription ?? 'Add a display label\u2026'}
</span>
```

The label placeholder is visible in all states, which is good for discoverability. However: what happens when a field has a label that matches exactly what the current item key shows? When the key is `name` and the label is "Name" (a common 1:1 case), the visual hierarchy shows "Name" prominently and `name` below it — this is correct behavior.

But there is a deeper issue: the proposal's secondary identity row for fields renders the key as a bare `<span>` — not inside a button or semantically interactive element in non-editing mode. The click target for opening the key editor is the `<span>` itself:

```tsx
<span
  className={`font-mono ... ${showEditMark ? 'group cursor-text' : ''}`}
  onClick={(event) => {
    if (!showEditMark) return;
    event.stopPropagation();
    onOpenIdentityField('key');
  }}
>
```

The current implementation wraps the same interaction in a `<div role="heading" aria-level={2}>` which, while semantically questionable for a key, at least gives it structural prominence. The proposal demotes the key to an inline `<span>` in a row that also contains the dataType badge. Both the key text and the dataType badge are in this same flex row. If the key is long (e.g., `respondentContactPreferences.primaryEmailAddress`), the dataType badge may be invisible due to truncation, and the click target for the key is the text itself — which may be a very small hit area.

**Required fix:** The key span should have a minimum click area. Either:
- Wrap it in an element with `min-h-[32px]` or `py-1` padding, or
- Keep the `role="heading" aria-level={2}` structure from the current implementation on the label (now the primary element), and confirm that the key click target meets the 44px touch minimum specified in the design constraints.

The simplest approach: ensure the secondary row div has `min-h-[32px]` so users can reliably click into key editing on touch devices.

---

### Concern 3 (Required): `CategoryCell` onClick fires on expanded categories — UNINTENDED ACTION

**Severity: Confusion risk / unexpected state change**

The `CategoryCell` component's `onClick` handler (proposal lines 194–199):
```tsx
onClick={(event) => {
  if (!selected || !onOpen || !isEmpty) return;
  event.stopPropagation();
  onOpen();
}}
```

The guard `!isEmpty` prevents the click from firing when a value is already set. But there is no guard for `isExpanded`. If a category is already expanded (the bind editor panel is open below the row), clicking on the category cell will call `onOpen()` again. Depending on the implementation of `onOpenEditorForSummary`, this may close and reopen the panel, causing a visible flicker — or it may open a second instance.

The current implementation has the same gap: it calls `onOpenEditorForSummary(category)` without checking expansion state. But in the current design, empty categories are visually inert when unexpanded, so users rarely click them accidentally. In the new design, empty categories have a persistent interactive affordance — they invite clicking. This makes the double-click scenario more likely for users who click once to expand and once more to "confirm."

**Required fix:** Add `!isExpanded` to the `CategoryCell` `onClick` guard:
```tsx
onClick={(event) => {
  if (!selected || !onOpen || !isEmpty || isExpanded) return;
  event.stopPropagation();
  onOpen();
}}
```

---

## Interaction Concerns (Advisory)

These concerns do not block implementation but should be logged for follow-up.

### Advisory 1: Label placeholder text is editable but shows no affordance before selection

The label placeholder "Add a display label…" in `text-empty` italic is visible even when the field is not selected. This is correct for discoverability — it teaches new users that a label can be added. But unselected fields with no label will show italic placeholder text at 16px semibold weight (the full primary label size). This creates a mildly incongruous result: a large italic placeholder that looks like a heading-level affordance on an unselected item.

Compare: the current implementation only shows the label row when `selected`, so unselected fields without labels show only the key. After this change, the editor will display a sea of italic "Add a display label…" text for any new form with no labels set.

The mitigation is already partially in the proposal — `text-empty` renders the placeholder at `text-ink/35 italic`, which is visually subordinate. But the 16px size ensures it still occupies significant vertical space. Consider: only show the label placeholder when selected. When unselected and `labelForDescription` is null, show nothing (or just the key, as today). The interactive discovery happens at selection time, not on passive scan. This avoids visual clutter in a newly created form with 10 unlabeled fields.

### Advisory 2: The `color-mix()` CSS syntax in the Token section is not valid and will not compile

The proposal's "Token & CSS Changes" section (lines 372–417) defines interaction state tokens using syntax like:
```css
--state-selected-border: var(--color-accent) / 0.5;
```
This is not valid CSS. The `/` opacity modifier is a Tailwind class syntax shorthand, not a CSS `color-mix()` construct. The adjudication correctly flags this in the Implementation Notes. However, the same section also uses `color-mix()` for the `@utility text-empty` and `@utility ring-empty` utilities.

These token definitions will be inert — the browser will parse them as invalid declarations and silently ignore them. The component-level Tailwind opacity classes (`bg-accent/[0.09]`, `border-accent/50`) are correct and will work, but any component that tries to use `var(--state-selected-border)` will get nothing.

The adjudication catches this and recommends against `color-mix()`. The engineering note to "stick to Tailwind opacity modifiers throughout" is correct. The token section of the proposal should not be implemented as written; the component-level classes are the implementation, not the CSS custom properties.

### Advisory 3: `showAffordance` ring is always visible on selected empty cells — acknowledged, correction needed

The adjudication already surfaces this (Concern 2 in the adjudication). The proposal renders `ring-1 ring-accent/15` whenever `showAffordance` is true, which means all empty categories simultaneously show blue rings when a field is first selected. On a new field with four empty categories, the user sees four blue rings alongside the blue-bordered, blue-backgrounded card — potentially reading as "four errors" rather than "four empty cells."

The adjudication's recommended fix (apply the ring on `hover:ring-1 hover:ring-empty` only) is correct. The italic placeholder text "Add [category]…" already communicates the empty/interactive state without needing a persistent ring. The ring is appropriate as a hover refinement.

### Advisory 4: The `DefinitionTreeEditor` optional prop pattern creates a silent failure mode

The adjudication already surfaces this (Concern 3). If `onEditorViewChange` is not passed, the toggle silently disappears. The adjudication recommends making both props required. From a UX perspective, the consequence of the silent failure is that the Build/Manage toggle vanishes with no error — the author is stuck in whichever view the component was initialized in, with no affordance to switch.

Make `activeEditorView` and `onEditorViewChange` required props. If a future use case requires an editor without the toggle, add a separate `showToggle` boolean prop — do not rely on prop presence as the toggle signal.

### Advisory 5: Inline key editor styling inconsistency after hierarchy swap

The proposal updates the label input to use `text-[var(--font-size-label)]` (16px) to match the new primary display size. The key input updates to `text-[var(--font-size-key)]` (12px) to match the new secondary display size. This is correct for visual continuity: the editing input should match the display text size.

However, the key input in the proposal uses `letter-spacing-[var(--letter-spacing-wide)]` — a Tailwind arbitrary class. `letter-spacing-` is not a valid Tailwind arbitrary property name. The correct syntax is `tracking-[var(--letter-spacing-wide)]`. This will produce a silent CSS failure: the class name will be emitted but the browser will not apply the letter-spacing. Verify that the key input `<input>` receives visible letter-spacing in the implemented version.

---

## Edge Case Analysis

### Edge: Field with a very long label (70+ characters)

With label as the primary element at 16px semibold, a 70-character label wraps to two lines. The key then renders on the third line. The identity column now occupies significantly more vertical space than in the current design (where the key at 17px dominated).

This is the intended behavior — the label is the primary identity. But two things to verify at implementation:
- The DragHandle is `h-11` (44px). With a two-line label plus the key row below it, the card height may be 80-90px. The DragHandle's vertical alignment (`items-start` in ItemRow.tsx line 554) keeps it aligned to the top, which is correct. Confirm the handle doesn't appear to float or be misaligned when the identity column is taller than 44px.
- The 4-column category grid in the SummaryColumn may feel cramped when its left-side identity column is now taller. The categories render in a separate column on desktop (the layout is `flex items-start gap-3`). The mismatch in height between the identity column (tall) and the category grid (fixed) creates a vertical alignment tension. Consider `items-baseline` or `items-start` alignment at the flex container level.

### Edge: Field with no label and no key (new, unsaved field)

A brand-new field may have an empty key (or a generated key like `field_1`) and no label. After this change:
- The label row shows "Add a display label…" in large italic at 16px — visually prominent even when unselected (per Advisory 1 above).
- The key row shows the generated key `field_1` at 12px mono.
- The dataType badge shows the default type.

This is a discoverable, correct state. The only issue is the large italic placeholder creating visual noise across multiple new fields.

### Edge: Display items (non-field items) after hierarchy swap

Display items currently use label as their primary identity (the handoff brief confirms "the current ordering (label primary, key secondary) is already correct" for display items). The proposal preserves this correctly — the `!isField` path in the proposal's IdentityColumn renders label first, with the `widgetHint` badge below it and the key last.

The proposal introduces one new element for display items: a `widgetHint` badge rendered between the label and the key:
```tsx
{widgetHint && (
  <span className='font-mono text-[var(--font-size-key)] text-accent/80'>
    {widgetHint}
  </span>
)}
```

This is a reasonable addition — it communicates the display item type (heading, paragraph, divider). But `text-accent/80` (80% opacity blue) on a 12px mono label is visually indistinguishable from the key below it if the widgetHint value is short (e.g., "heading"). Consider using the existing type badge pattern (smaller, different color family) rather than full-accent text.

### Edge: Deeply nested group fields (depth > 2)

The `style={{ paddingLeft: depth * 20 + 14 }}` in ItemRow.tsx creates depth-based left indentation. At depth 3, a field is indented 74px. With the identity column now label-first, the user sees a large indented label with no visual group context until they notice the group border-left pattern. The current design shows the large mono key first, which often includes the group prefix (rendered in `text-ink/35`).

The proposal preserves the `groupPrefix` display in the secondary (key) row. After the hierarchy swap, users scanning deeply nested fields see: (indent) → large label → small key with dim prefix. The prefix is now visually buried. For deeply nested forms, consider whether the group prefix should appear on the label row as well, or whether the indentation alone communicates hierarchy. This is not a blocker — it is a depth-of-hierarchy question worth testing with forms that have 3+ nesting levels.

### Edge: Form with 20+ fields and all selected (bulk selection scenario)

If the editor supports bulk selection (not visible in the current implementation, but not ruled out), the new selected state with `bg-accent/[0.09]` on all visible cards simultaneously could create a heavily blue-tinted canvas. Single-field selection is the intended use case and the current implementation confirms this (no bulk selection visible in the code). Mark as a constraint for future feature work: bulk selection will need a different visual treatment than the `bg-accent/[0.09]` individual selection state.

### Edge: RTL layout

No RTL-specific changes are made in the proposal. The `border-l border-border/65 pl-3` left border on CategoryCells will flip to right-border in RTL browsers (via CSS logical properties or RTL transforms). The flex direction and `gap-3` spacing should also flip correctly under RTL. No regression is expected here, but RTL has not been validated in the current implementation — this proposal does not improve or worsen the situation.

### Edge: Category grid with only 1 active category (unusual but valid)

The SummaryColumn renders `grid-cols-2` when `<= 2` categories, `grid-cols-4` when `<= 4`. A field with exactly 1 category summary would render in a 2-column grid with one empty column. This is the current behavior and is not changed by the proposal. The single CategoryCell would show its affordance, but the grid would have visual asymmetry (one cell, one blank space).

---

## Cognitive Load Assessment

The proposal reduces cognitive load in two significant ways and does not introduce new load in any direction that would require users to re-learn patterns.

**Reduction 1: Identity hierarchy now matches mental model.** The single most expensive cognitive operation in a form editor is "find the field I want to work on." Today that requires suppressing the visually dominant key and reading the subordinate label. After this change, the label IS the dominant element — the scan pattern matches how authors think about their fields. This is a daily-use improvement that compounds with form size.

**Reduction 2: Selection state removes confirmation uncertainty.** Today authors occasionally double-click a field because they aren't sure the first click registered. The new selection state eliminates this — the arm's-length test passes. This reduces a small but persistent interruption in the authoring flow.

**No new load:** The proposal introduces no new interaction patterns. The category affordance ("Add validation…") is an extension of the existing supportingText pattern already present in the editor. The toggle moving into the card header is a more logical location — users looking for a view switch will look at the content header before scanning for a sticky band above it. The type scale tokens are an implementation artifact, invisible to users.

---

## Progressive Disclosure Assessment

The proposal supports the form's information architecture well.

The visual hierarchy after the change, from most to least prominent:

1. Label (16px semibold) — the human identity of the field
2. Machine key (12px mono, ink/68) — the developer identifier
3. Category values (14px, ink/94 when set; italic placeholder when empty) — behavioral configuration
4. Status pills (below categories) — behavioral summary tags
5. Category editor panel (below status pills when expanded) — detailed bind configuration

This is the correct priority order for form authoring. Field identity → behavior summary → behavior detail. The proposal does not change the information architecture itself — it makes the existing architecture visible by correcting the weights.

The one area where progressive disclosure could be stronger: the category editor panel (bind editor) is "below the fold" inside the card. When a long field card expands a bind editor panel, the total card height may push subsequent fields off-screen. This is a pre-existing issue not introduced by this proposal, but worth noting that the label-first hierarchy adds approximately 8-12px to card height (the label was conditionally hidden before for unselected fields without labels; now it is always present). For a form with 15 fields all showing placeholder labels, total scroll depth increases slightly.

---

## Summary of Required Modifications

| # | Concern | Type | Change Required |
|---|---------|------|-----------------|
| 1 | Tab cycle direction regression | Interaction regression | Invert `handleIdentityKeyDown` Tab/Shift-Tab logic to match new label-first DOM order |
| 2 | Key editor click target too small | Accessibility regression | Add `min-h-[32px]` or equivalent touch target to the secondary (key) row div |
| 3 | CategoryCell onClick fires on expanded categories | Unexpected action | Add `!isExpanded` guard to `CategoryCell` onClick handler |

## Summary of Advisory Items

| # | Concern | Priority | Action |
|---|---------|----------|--------|
| A1 | Label placeholder visible on unselected unlabeled fields | Medium | Show label placeholder only when selected |
| A2 | CSS token `color-mix()` syntax is invalid | Engineering | Do not implement token section as written; use Tailwind opacity modifiers at call sites |
| A3 | Ring visible on all empty categories simultaneously | Low | Apply ring on hover only (`hover:ring-1 hover:ring-empty`) |
| A4 | Optional toggle props create silent failure mode | Medium | Make `activeEditorView` and `onEditorViewChange` required props |
| A5 | `letter-spacing-` is invalid Tailwind arbitrary syntax | Engineering | Change to `tracking-[var(--letter-spacing-wide)]` |

---

## Final Verdict

**Conditional endorsement.** Implement the Evolutionary proposal with the three required modifications applied before merge. The advisory items are improvements, not blockers — schedule A1 and A4 for the same implementation sprint, and A2/A5 for the engineering pass when implementing the token section.

The visual direction is sound, the interaction model is correct, and the changes are proportionate to the problems they solve. The required modifications are narrow surgical fixes that do not alter the proposal's direction — they correct interaction regressions introduced when the DOM order changed but the keyboard logic did not follow.
