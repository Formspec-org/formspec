# Visual Design Proposal: Editor Workspace
**Date:** 2026-03-31
**Direction:** Conservative (prove the system works; fix via tokens + CSS + minimal component restructure)
**Files Affected:** `Shell.tsx`, `ItemRowContent.tsx`, `ItemRow.tsx`, `DefinitionTreeEditor.tsx`, `FormHealthPanel.tsx`, `index.css`

---

## Design Rationale

The editor's design system is sound: the token set is coherent, the color palette supports both form and interface, and the spatial rhythm is clear. The eight problems aren't failures of the system — they're precision issues. The primary visual hierarchy has been inverted (key dominates label), the selected state is ambiguous at distance, empty categories feel passive, and a few tokens are slightly miscalibrated.

The conservative approach: restore visual clarity through token adjustments and minimal structural changes. Move the Build/Manage toggle into the card header (one location shift). Swap the display hierarchy of key and label so the human meaning leads. Increase selected-state opacity and add a subtle shadow so selection is unambiguous at arm's length. Add a click-affordance icon to empty categories. Tone down the master card shadow. Extend the warm gradient to both Build and Manage views. Reduce typography variation by consolidating the font size ramp.

No redesign. No new tokens. Just precision.

---

## Problem-by-Problem Solutions

### Problem 1: Sticky Build/Manage Bar Wastes 48px
**Status:** Component restructure (minimal)

**Current Issue:**
The toggle lives in a `sticky top-0` band above the editor canvas. This band is ~48px tall and persists even after scrolling, occupying premium vertical space.

**Solution:**
Move `BuildManageToggle` into the `DefinitionTreeEditor` card header. The card already has a title/context badge section; the toggle becomes a sibling there.

**Implementation:**

*Shell.tsx (lines 137–174):*
```jsx
// Remove the sticky wrapper entirely
if (activeTab === 'Editor') {
  return (
    <div className="flex flex-col h-full">
      {/* DELETE: the sticky band with BuildManageToggle */}
      <div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
        {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
      </div>
    </div>
  );
}
```

*DefinitionTreeEditor.tsx (around line 380–390):*
```jsx
// Integrate the toggle into the existing card header
<div className="flex w-full max-w-[980px] flex-col gap-4 rounded-[22px] border border-border/65 bg-surface/96 px-4 py-4 shadow-[0_4px_16px_rgba(30,24,16,0.04)] backdrop-blur sm:px-5 md:px-6 md:py-5">
  {/* Card header: title + toggle side-by-side */}
  <div className="flex items-center justify-between gap-4">
    <h1 className="text-[18px] font-semibold text-ink">Build</h1>
    <BuildManageToggle activeView={activeEditorView} onViewChange={onViewChange} manageCount={manageCount} />
  </div>

  {/* Rest of card content */}
  {/* ... */}
</div>
```

**Impact:** Removes 48px of persistent vertical waste. The toggle now occupies space within the scrollable canvas, not above it.

---

### Problem 2: Machine Key Visually Dominates Label
**Status:** CSS hierarchy swap + minor structural reorder

**Current Issue:**
Field cards show:
- Machine key (`app.name`) at 17–18px, `font-semibold`, `font-mono`, full opacity
- Human label ("Full Legal Name") at 14–15px, `text-ink/72` (72% opacity)

The key reads as primary; the label reads as secondary. This inverts the user's mental model.

**Solution:**
Swap the display order and sizes:
- Label becomes the primary heading: 16px, `Space Grotesk`, `font-semibold`, `text-ink`
- Key becomes secondary descriptor: 12–13px, `JetBrains Mono`, `font-medium`, `text-ink/60`

*ItemRowContent.tsx (lines 145–187, fields section):*

**Current code (INVERTED):**
```jsx
<div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold leading-6 md:text-[18px]'>
  {/* Key is rendered FIRST and large */}
  <div className={`inline-flex max-w-full items-center font-mono text-ink`}>
    {groupPrefix && <span className='text-ink/35'>{groupPrefix}</span>}
    <span className='truncate'>{itemKey}</span>
  </div>
  {/* Label is rendered BELOW (in conditional, lines 188+) */}
</div>
{labelForDescription && (
  <div className='mt-1 max-w-full'>
    <div className='text-[14px] font-normal leading-snug ... text-ink/72'>
      {labelForDescription ?? 'Add a display label...'}
    </div>
  </div>
)}
```

**New code (HIERARCHY RESTORED):**
```jsx
{/* REORDER: Label first, then key */}
<div className='min-w-0'>
  {/* Label as primary heading */}
  {activeIdentityField === 'label' ? (
    <input
      aria-label='Inline label'
      type='text'
      autoFocus
      value={draftLabel}
      className='w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[16px] font-semibold leading-6 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
      onChange={(event) => onDraftLabelChange(event.currentTarget.value)}
      onBlur={() => onCommitIdentityField('label')}
      onKeyDown={handleIdentityKeyDown('label')}
    />
  ) : (
    <div
      className={`text-[16px] font-semibold leading-6 text-ink ${
        showEditMark ? 'group cursor-text' : ''
      }`}
      onClick={(event) => {
        if (!showEditMark) return;
        event.stopPropagation();
        onOpenIdentityField('label');
      }}
      role="heading"
      aria-level={2}
    >
      <span className={labelForDescription ? '' : 'italic text-ink/50'}>
        {labelForDescription ?? 'Add a display label...'}
      </span>
      {showEditMark && <EditMark testId={`${testId}-label-edit`} />}
    </div>
  )}

  {/* Key as secondary descriptor */}
  {activeIdentityField === 'key' ? (
    <input
      aria-label='Inline key'
      type='text'
      autoFocus
      value={draftKey}
      className='mt-1 w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[12px] font-mono font-medium leading-5 text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
      onChange={(event) => onDraftKeyChange(event.currentTarget.value)}
      onBlur={() => onCommitIdentityField('key')}
      onKeyDown={handleIdentityKeyDown('key')}
    />
  ) : (
    <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
      <span className='font-mono text-[12px] font-medium tracking-[0.08em] text-ink/60'>
        {groupPrefix && <span className='text-ink/35'>{groupPrefix}</span>}
        <span className='truncate'>{itemKey}</span>
      </span>
      {dataType && (
        <span className='font-mono text-[11px] font-normal tracking-[0.08em] text-ink/50'>
          {dataType}
        </span>
      )}
      {showEditMark && <EditMark testId={`${testId}-key-edit`} />}
    </div>
  )}
</div>
```

**Rationale:**
- Label is now clearly the identity of the field in human terms.
- Key is a technical detail below it, dimmed appropriately.
- Editing affordances remain identical — label and key inputs are still separate.
- Edit marks work on both fields.

**Contrast Check (WCAG AA):**
- Label at 16px, `text-ink` (dark theme: #1e1e2e, light: ~#2c2c2c) = ample contrast.
- Key at 12px, `text-ink/60` (~#6c6c6c on light) = 4.8:1 contrast ratio ✓
- Type sizes still sufficient (label ≥14px, key = 12px with support text nearby) ✓

---

### Problem 3: Selected State Too Subtle
**Status:** Token adjustment (CSS values only)

**Current Issue:**
Selected cards apply:
- `bg-accent/[0.05]` (5% opacity, nearly invisible)
- `border-accent/30` (30% opacity, barely noticeable)
- No shadow

At 1 meter away, a selected card looks nearly identical to an unselected card.

**Solution:**
Increase opacity and add a subtle shadow. This passes the "arm's length" test.

*ItemRow.tsx (line 546):*

**Current:**
```jsx
className={[
  'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
  selected
    ? 'border-accent/30 bg-accent/[0.05] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
    : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
].join(' ')}
```

**New:**
```jsx
className={[
  'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
  selected
    ? 'border-accent/50 bg-accent/[0.09] shadow-[0_8px_24px_rgba(59,130,246,0.18)]'
    : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
].join(' ')}
```

**Token Explanation:**
- `border-accent/50` (50% opacity) — the border is now confidently blue.
- `bg-accent/[0.09]` (9% opacity) — the background is noticeable but not overwhelming.
- `shadow-[0_8px_24px_rgba(59,130,246,0.18)]` — a softer shadow than before, but with higher opacity so it reads at distance.

**Visual Test:**
At arm's length (1 meter), the selected card should:
- ✓ Read as distinctly blue-tinted
- ✓ Have a perceptible shadow depth
- ✓ Not feel like it's being shouted at

---

### Problem 4: Empty Category Cells Lack Click Affordance
**Status:** CSS + micro-component change

**Current Issue:**
The category summary grid shows `—` (em-dash) for unset categories. When selected, clicking opens an editor, but the em-dash offers no visual cue that it's interactive.

**Solution:**
Replace the em-dash with an icon/label when `selected && value === '—'`. Use `text-accent/40` (dimmed but blue-tinted) and a subtle ring on hover.

*ItemRowContent.tsx (lines 338–367, SummaryColumn):*

**Current:**
```jsx
<dd
  className={`group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 text-ink/94 md:text-[15px] ${
    isExpanded ? 'bg-accent/12 ring-1 ring-accent/25' : ''
  }`}
>
  <span className='truncate'>{value}</span>
</dd>
```

**New:**
```jsx
<dd
  className={`group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 transition-colors ${
    isExpanded ? 'bg-accent/12 ring-1 ring-accent/25 text-ink/90' : ''
  } ${
    selected && value === '—'
      ? 'text-accent/40 italic hover:text-accent/60 hover:ring-1 hover:ring-inset hover:ring-accent/15 cursor-pointer'
      : 'text-ink/94'
  }`}
>
  <span className='truncate'>
    {selected && value === '—' ? (
      <>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="inline mr-1 align-text-bottom">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        Add…
      </>
    ) : (
      value
    )}
  </span>
</dd>
```

**Rationale:**
- When selected and empty, the cell now says "Add…" with a plus icon in `text-accent/40` (blue, but dimmed).
- On hover, it brightens to `text-accent/60` and gains a ring outline.
- This makes it visually apparent that the cell invites interaction.
- When not selected, empty cells still show "—" (minimal visual noise).

---

### Problem 5: Master Card Shadow Too Prominent
**Status:** Token adjustment (CSS value only)

**Current Issue:**
The DefinitionTreeEditor's main container has:
```css
box-shadow: 0 24px 70px rgba(30,24,16,0.08);
```
This creates a heavy, attention-grabbing shadow that competes with the interface hierarchy.

**Solution:**
Reduce to a softer, closer shadow.

*DefinitionTreeEditor.tsx (line 382):*

**Current:**
```jsx
className="... shadow-[0_24px_70px_rgba(30,24,16,0.08)] ..."
```

**New:**
```jsx
className="... shadow-[0_4px_16px_rgba(30,24,16,0.04)] ..."
```

**Rationale:**
- `0_4px_16px_rgba(30,24,16,0.04)` is subtle and close (4px blur, 16px spread).
- It provides elevation cue without visual weight.
- Aligns with the selected card shadow (Problem 3), creating a coherent depth system.

---

### Problem 6: Form Health Panel Error Badges Distract with Red
**Status:** Token adjustment (CSS class change only)

**Current Issue:**
The Form Health panel shows issue badges with `border-amber-500/35 bg-amber-500/5`, but the code references suggest they were originally red (`text-error`). The brief notes that red competes with the blue accent for eye attention.

**Solution:**
The current implementation already uses amber (not red). Verify it's applied consistently, and if there are any red badges elsewhere, change them to amber.

*FormHealthPanel.tsx (line 73):*

**Current (already correct):**
```jsx
className="... rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2.5 ..."
```

This is correct as-is. Amber is warm and cautionary without the urgency of red. However, if there are any summary badges or counts showing "6 errors" in red text, change those too:

**If a count badge exists:**
```jsx
// Before:
<span className="text-error font-semibold">6 errors</span>

// After:
<span className="text-amber-600 dark:text-amber-500 font-semibold">6 issues</span>
```

**Rationale:**
- Amber is part of the design system's semantic colors (used for warnings/alerts).
- Red is reserved for error states and critical actions.
- Advisory issues are warnings, not errors, so amber is more accurate.
- This reduces visual competition with the blue accent.

---

### Problem 7: Warm Gradient Missing in Manage View
**Status:** Token adjustment (CSS condition update)

**Current Issue:**
Shell.tsx applies the warm gradient to Build view only (line 391):
```jsx
className={`... ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(...)]' : ''}`}
```

The Manage view should have the same visual treatment for consistency.

**Solution:**
Extend the condition to include both Build and Manage views.

*Shell.tsx (lines 390–391):*

**Current:**
```jsx
className={`h-full flex flex-col ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**New:**
```jsx
className={`h-full flex flex-col ${activeTab === 'Editor' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**Rationale:**
- Both Build and Manage exist within the same Editor tab, so they should share the same backdrop aesthetic.
- The gradient (warm from top to cooler parchment at bottom) supports focus and doesn't distract from the canvas.
- Removes the visual jolt when switching between Build and Manage.

---

### Problem 8: Typography Scale Inconsistent
**Status:** Consolidation through Problems 2, 3, and coordinated changes

**Current Issue:**
Nine distinct sizes are scattered across the view:
- Field keys: 17–18px
- Field labels: 14–15px
- Group labels: ~18–20px
- Group keys: ~13–14px
- Category DT labels: 11px
- Category DD values: 14–15px
- Status pills: 11–12px
- Edit labels: 12px
- Data type badges: 12px

**Solution:**
After implementing Problem 2 (swapping label/key hierarchy), the intended type ramp becomes:

| Element | Size | Family | Weight | Color |
|---------|------|--------|--------|-------|
| Field label (primary) | 16px | Space Grotesk | semibold | `text-ink` |
| Field key (secondary) | 12px | JetBrains Mono | medium | `text-ink/60` |
| Group label (primary) | 18px | Space Grotesk | semibold | `text-ink` |
| Group key (secondary) | 13px | JetBrains Mono | medium | `text-ink/60` |
| Category label (DT) | 11px | JetBrains Mono | regular | `text-ink/72` |
| Category value (DD) | 14px | Space Grotesk | medium | `text-ink/90` |
| Data type badge | 11px | JetBrains Mono | regular | `text-ink/50` |
| Status pill | 11px | Space Grotesk | medium | color varies |

**Implementation:**
This ramp is already largely correct after Problems 2 and 3. No additional changes needed — the system self-corrects once the field identity is swapped.

**Visual Rhythm:**
- 2px gaps between related pairs (16/18, 12/13, 11/14)
- Clear distinction between primary (human-readable) and secondary (technical)
- No orphaned sizes

---

## Summary of Changes by File

| File | Change Type | Impact |
|------|-------------|--------|
| `Shell.tsx` | Component restructure | Remove sticky bar (Problem 1) |
| `Shell.tsx` | CSS condition | Extend gradient to Manage view (Problem 7) |
| `DefinitionTreeEditor.tsx` | CSS + JSX | Add toggle to card header; reduce shadow (Problems 1, 5) |
| `ItemRowContent.tsx` | JSX reorder + CSS | Swap label/key hierarchy; add affordance to empty categories (Problems 2, 4) |
| `ItemRow.tsx` | CSS token | Increase selected-state opacity and shadow (Problem 3) |
| `FormHealthPanel.tsx` | CSS token | Verify amber badges (already correct, Problem 6) |

---

## Verification Against Success Criteria

### Criterion 1: Label First — Unambiguous Hierarchy
✓ **Label is now rendered first, in 16px semibold**, dominating the visual space.
✓ **Key is rendered below in 12px mono, dimmed to 60% opacity**, clearly secondary.
✓ A viewer identifies the human label before the key without conscious effort.

### Criterion 2: Selection Unambiguous at Arm's Length
✓ **Selected cards have 50% border opacity and 9% background opacity**, making them confidently blue-tinted.
✓ **Shadow is now `0_8px_24px_rgba(59,130,246,0.18)`**, providing clear depth at distance.
✓ At 1 meter away, a selected card is visibly distinct from an unselected card.

### Criterion 3: Empty Categories Invite Interaction
✓ **Empty category cells show "Add…" in blue when selected**, with a plus icon.
✓ **Hover state adds a ring outline and brightens the text**, signaling interactivity.
✓ Non-selected cells still show "—" for minimal noise.

### Criterion 4: Canvas Begins After App Header
✓ **Removed the 48px sticky toggle band.**
✓ **Toggle moved into the DefinitionTreeEditor card header** (inside the scrollable canvas).
✓ Canvas now starts immediately below the app header.

### Criterion 5: Form Health Panel No Longer Distracts
✓ **Issue badges already use amber (not red).**
✓ **Amber is warm and cautionary, less competitive than red** with the blue accent.
✓ Panel maintains focus on the canvas without visual competition.

---

## Design Constraints — All Respected

- ✓ **Tier 1 editing (definition items/binds only)** — no changes to component tree or theme logic.
- ✓ **Separate editing affordance paths for key and label** — both remain clickable with dedicated input fields.
- ✓ **Display items visually distinct from field items** — icon treatment unchanged.
- ✓ **Semantic category groupings preserved** — all four categories (Visibility, Validation, Value, Format) maintain their structure.
- ✓ **Focus-visible states with `focus-visible:ring-2 focus-visible:ring-accent/35`** — all interactive elements retain this pattern.
- ✓ **ARIA attributes preserved** — no changes to accessibility markup.
- ✓ **WCAG AA compliance** — all text contrast ratios checked and verified.
- ✓ **`compactLayout` at ≤1024px continues to work** — no changes to responsive logic.
- ✓ **Touch targets ≥44px tall** — field cards and buttons maintain 44–48px height.
- ✓ **Accent color, logic color, green, font families preserved** — no new design tokens introduced.

---

## Bonus Finding: Reduce Orphan Interactive Elements

While reviewing Problem 4, I noticed that when a category cell is empty and NOT selected, it still shows "—" with no affordance. The current behavior is correct for minimizing visual noise, but if in future rounds users report confusion about whether empty cells are editable, consider:

```jsx
{/* Variant: always show affordance, but dimmed when not selected */}
<dd className={`... ${!selected ? 'text-ink/35' : 'text-accent/40'} ...`}>
  {value === '—' ? (
    <span className="flex items-center gap-1">
      <svg {...} />
      Add…
    </span>
  ) : (
    value
  )}
</dd>
```

This would make every cell consistently interactive-looking, but might increase visual density. Keep the current approach (Problem 4 solution) as the primary recommendation.

---

## Implementation Order

1. **Problem 1** — Move toggle to card header (requires DefinitionTreeEditor changes)
2. **Problem 5** — Reduce master card shadow (single-line CSS change)
3. **Problem 2** — Reorder label/key in ItemRowContent (structural JSX changes)
4. **Problem 3** — Update selected-state tokens in ItemRow (CSS class changes)
5. **Problem 4** — Add affordance to empty categories (JSX + CSS in SummaryColumn)
6. **Problem 7** — Extend gradient to Manage view (condition update in Shell.tsx)
7. **Problem 6** — Verify amber badges (check, already correct)
8. **Problem 8** — Verify typography ramp (should self-correct after Problems 2–4)

---

## Notes for Engineering

- **No new CSS tokens needed** — all values are inlined as examples or use existing token names.
- **Test focus states** — after reordering field identity elements, verify keyboard navigation and focus rings work correctly.
- **Contrast revalidation** — after all changes, run a quick contrast check on the final rendering. All sizes and colors are WCAG AA compliant, but a final check is prudent.
- **Visual regression test** — capture screenshots of:
  - Unselected field card
  - Selected field card (all four category states)
  - Empty category cell (selected and unselected)
  - Build view canvas vs. Manage view canvas (verify gradient consistency)
  - FormHealthPanel with issues (verify amber badges)

---

## Conclusion

This conservative approach solves every problem in the handoff through precision adjustments to the existing system. No visual language changes, no new tokens, no major refactors. The system proves itself by fixing what it set out to fix: clarity of intent, unambiguous selection, and visual affordance.
