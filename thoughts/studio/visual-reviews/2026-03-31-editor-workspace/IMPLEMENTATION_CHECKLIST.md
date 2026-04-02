# Implementation Checklist

## Problem 1: Sticky Build/Manage Bar (48px waste)

**Files:** `Shell.tsx`, `DefinitionTreeEditor.tsx`

- [ ] In Shell.tsx (lines 137–174): Remove the `sticky top-0` wrapper div that holds the BuildManageToggle
- [ ] Pass `activeEditorView` and `onViewChange` props to DefinitionTreeEditor
- [ ] In DefinitionTreeEditor.tsx: Add a header div with `flex justify-between items-center` containing the title and BuildManageToggle
- [ ] Test: Canvas should start immediately below the app header with no sticky bar

## Problem 2: Machine Key Dominates Label

**Files:** `ItemRowContent.tsx`

- [ ] Reorder the IdentityColumn JSX so label renders first (lines 145–187 for fields)
- [ ] Change label size to 16px, semibold, `text-ink`
- [ ] Change key size to 12px, medium, `text-ink/60`
- [ ] Update input field styles (label input: 16px semibold; key input: 12px mono)
- [ ] For groups (lines 228–312), apply the same hierarchy
- [ ] Test: Label should be the first thing you read; key should be visibly secondary

## Problem 3: Selected State Too Subtle

**Files:** `ItemRow.tsx`

- [ ] Line 546: Update selected state classes:
  - Old: `border-accent/30 bg-accent/[0.05] shadow-[0_14px_34px_rgba(59,130,246,0.12)]`
  - New: `border-accent/50 bg-accent/[0.09] shadow-[0_8px_24px_rgba(59,130,246,0.18)]`
- [ ] Test: At arm's length (1m away), selected cards should be visibly blue and distinct

## Problem 4: Empty Category Cells Lack Affordance

**Files:** `ItemRowContent.tsx` (SummaryColumn)

- [ ] Lines 338–367: Update the `<dd>` rendering logic
- [ ] When `selected && value === '—'`:
  - Render "Add…" with a plus SVG icon
  - Color: `text-accent/40`
  - Hover: `text-accent/60` + `ring-1 ring-accent/15`
- [ ] Non-selected empty cells still show "—"
- [ ] Test: Click an empty category cell when selected; "Add…" should appear and be clickable

## Problem 5: Master Card Shadow Too Prominent

**Files:** `DefinitionTreeEditor.tsx`

- [ ] Line 382: Update shadow from `shadow-[0_24px_70px_rgba(30,24,16,0.08)]` to `shadow-[0_4px_16px_rgba(30,24,16,0.04)]`
- [ ] Test: Card shadow should be subtle, not attention-grabbing

## Problem 6: Form Health Panel Badges

**Files:** `FormHealthPanel.tsx`

- [ ] Line 73: Verify `border-amber-500/35 bg-amber-500/5` is applied (already correct)
- [ ] Search for any `text-error` badges in the header and change to `text-amber-600` if found
- [ ] Test: Issue badges should use warm amber, not red

## Problem 7: Warm Gradient Missing in Manage View

**Files:** `Shell.tsx`

- [ ] Line 391: Update the conditional from `activeTab === 'Editor' && activeEditorView === 'build'` to just `activeTab === 'Editor'`
- [ ] Test: Manage view should have the same warm gradient background as Build view

## Problem 8: Typography Scale (Self-Correcting)

**Files:** Multiple (auto-corrects via Problems 2–4)

- [ ] After implementing Problems 2–4, the type ramp should be correct
- [ ] Verify: Field label 16px, field key 12px, group label 18px, group key 13px
- [ ] No additional changes needed if hierarchy changes are complete

---

## Testing Checklist

### Visual Tests
- [ ] Screenshot: unselected field card
- [ ] Screenshot: selected field card (all four category states)
- [ ] Screenshot: empty category cell (selected vs unselected)
- [ ] Screenshot: Manage view with gradient
- [ ] Screenshot: Form Health panel with issue badges

### Interaction Tests
- [ ] Keyboard navigation through field cards (Tab, Enter)
- [ ] Click to edit label; cancel with Escape
- [ ] Click to edit key; cancel with Escape
- [ ] Click empty category cell when selected → "Add…" appears
- [ ] Focus ring visible on all interactive elements

### Accessibility Tests
- [ ] Screen reader reads label before key
- [ ] Contrast check: all text ≥ WCAG AA
- [ ] Focus outline always visible

### Responsive Tests
- [ ] Desktop (≥1024px): all three columns visible
- [ ] Tablet (≤1024px): compact layout triggers, no regressions
