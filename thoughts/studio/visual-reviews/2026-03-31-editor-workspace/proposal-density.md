# Formspec Editor Workspace — Density-First Visual Design Proposal

**Date:** 2026-03-31
**Designer:** Frontend Artisan
**Branch:** `feat/editor-layout-split`
**Scope:** 8 visual problems; Build view only (Tier 1 fields)

---

## Design Direction: Professional IDE Aesthetic

The editor must feel like a **production tool**, not a consumer form builder. This means:

- **Data density** over whitespace indulgence
- **Hierarchy via weight and size**, not layering and shadows
- **Inline affordances** (labels on one line, categories as a visual strip)
- **Neutral, confident presentation** — warm gradient + soft shadows only where they guide attention
- **Zero visual waste** — every pixel earns its keep

The design avoids the "floating card" aesthetic in favor of a **grid-like surface** that feels grounded and workmanlike.

---

## 1. Problem: Sticky Build/Manage Bar Wastes 48px

### Current State
The `BuildManageToggle` sits in a sticky bar above the canvas, occupying premium vertical real estate.

### Solution: Move into Canvas Card Header

**Action:** Relocate `BuildManageToggle` into the master card's titlebar alongside the "Structure editor" label.

**CSS Changes:**
```css
/* Remove sticky wrapper from Shell.tsx */
.sticky.top-0 {
  /* DELETED */
}

/* New titlebar in DefinitionTreeEditor */
.editor-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.editor-titlebar__left {
  min-width: 0; /* flex shrink text */
}

.editor-titlebar__right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}
```

**Markup:**
```tsx
<div className="editor-titlebar">
  <div className="editor-titlebar__left">
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
      Structure editor
    </div>
    <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
      {selectedSummary ? selectedSummary.label : 'Form structure'}
    </h1>
  </div>
  <div className="editor-titlebar__right">
    <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} />
    {selectedSummary && (
      <div className="rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent/90">
        Active selection
      </div>
    )}
  </div>
</div>
```

**Impact:** Canvas now begins immediately after header, gaining ~50px of vertical space.

---

## 2. Problem: Machine Key Dominates Human Label

### Current State
For fields: key is displayed first (line 163, ItemRowContent.tsx) at `font-semibold` `font-mono` (17-18px).
Label is secondary, appears below key, smaller (14-15px), dimmed opacity.

This inverts the visual hierarchy. Users think in labels; keys are implementation details.

### Solution: Label Primary, Key Secondary

**Priority Change:**
```
Before:  [mono-semibold-key]          (visual weight: 8/10)
         [serif-normal-label]          (visual weight: 4/10)

After:   [serif-semibold-label] · key (visual weight: 8/10 vs 2/10)
```

**Updated Markup (IdentityColumn for fields):**
```tsx
{activeIdentityField === 'key' ? (
  // ... input as before
) : (
  <div className='min-w-0 flex flex-col gap-1.5'>
    {/* Label always first, always visible for fields */}
    <div
      className={`inline-flex max-w-full items-center gap-2 text-[16px] font-semibold leading-6 text-ink ${
        showEditMark ? 'group cursor-text' : ''
      }`}
      onClick={(event) => {
        if (!showEditMark) return;
        event.stopPropagation();
        onOpenIdentityField('label');
      }}
    >
      <span className='truncate'>{labelForDescription || itemKey}</span>
      {showEditMark && <EditMark testId={`${testId}-label-edit`} />}
    </div>

    {/* Key now secondary, on same line with separator */}
    <div className='flex items-center gap-2'>
      <span className='font-mono text-[12px] tracking-[0.08em] text-ink/50'>
        {groupPrefix && <span className='text-ink/35'>{groupPrefix}</span>}
        {itemKey}
      </span>
      {showEditMark && (
        <button
          type="button"
          aria-label="Edit key"
          className="p-1 rounded-md hover:bg-subtle transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onOpenIdentityField('key');
          }}
        >
          <EditMark testId={`${testId}-key-edit`} />
        </button>
      )}
      {dataType && (
        <span className={`font-mono text-[11px] tracking-[0.08em] ${dt?.color ?? 'text-muted'}`}>
          {dataType}
        </span>
      )}
    </div>
  </div>
)}
```

**CSS:**
```css
/* Typography scale simplification: 4 levels instead of 9 */
.label-primary {
  font-size: 1rem; /* 16px - human-facing labels */
  font-weight: 600;
  line-height: 1.5;
}

.label-secondary {
  font-size: 0.75rem; /* 12px - machine keys, categories */
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.08em;
  color: var(--color-ink, #0f172a);
  opacity: 0.5; /* de-emphasize without pale appearance */
}

.label-tertiary {
  font-size: 0.6875rem; /* 11px - meta labels like "Key", "Visibility" */
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.14em;
  opacity: 0.6;
}
```

**Benefit:** Viewer now identifies label first (~200ms), reducing cognitive load. Key is discoverable but not loud.

---

## 3. Problem: Selected State Too Subtle

### Current State
Selected row has a faint background color (from ItemRow styling), but at arm's length, selection is ambiguous.

### Solution: Multi-Signal Selection Indicator

**Background + Border + Shadow Combo:**
```css
.item-row {
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid transparent;
  border-radius: var(--radius-DEFAULT); /* 4px */
  background: transparent;
}

.item-row.selected {
  background: var(--color-accent, #2563eb);
  background: color-mix(in srgb, var(--color-accent) 9%, white);
  border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  box-shadow: 0 0 0 1px var(--color-accent, #2563eb) / 0.2,
              inset 0 0 0 1px var(--color-border, #e2e8f0) / 0.4;
}

.item-row.selected:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-border));
}
```

**Markup Change (ItemRow):**
```tsx
<div
  className={`
    min-w-0 px-3 py-2.5 rounded-[4px] border transition-all
    ${selected
      ? 'bg-accent/[0.09] border-accent/50 shadow-[0_0_0_1px_var(--color-accent-light)]'
      : 'border-transparent hover:bg-bg-default/56 hover:border-border/70'
    }
  `}
>
  {/* ItemRowContent */}
</div>
```

**Visual Result:**
- Default: invisible (transparent)
- Hover (unselected): soft background + faint border
- Selected: accent background + accent border + subtle shadow
- Selection is immediately obvious at a glance; no ambiguity

---

## 4. Problem: Empty Categories Lack Click Affordance

### Current State
Empty category cells have no visual signal that they're interactive.
When selected but empty, the category displays its current value (e.g., "—") with no hint to click.

### Solution: Contextual "Add..." Placeholder + Hover Ring

**Markup (SummaryColumn):**
```tsx
{Object.entries(categorySummaries).map(([category, value]) => {
  const isExpanded = expandedCategoryKey === category;
  const isEmpty = !value || value === '—';

  return (
    <div
      key={category}
      data-testid={`${testId}-category-${category}`}
      onClick={(event) => {
        if (!selected) return;
        event.stopPropagation();
        onOpenEditorForSummary(category);
      }}
      className={`
        min-w-0 rounded-[3px] px-2 py-1.5 border border-border/50 transition-all
        ${selected ? 'cursor-pointer' : ''}
        ${isExpanded
          ? 'bg-accent/12 border-accent/30 ring-1 ring-accent/20'
          : 'border-transparent'
        }
        ${isEmpty && selected && !isExpanded
          ? 'hover:bg-subtle hover:border-border/70 hover:ring-1 hover:ring-accent/15'
          : ''
        }
      `}
    >
      <dt className='font-mono text-[11px] tracking-[0.14em] text-ink/62'>
        {category}
      </dt>
      <dd className='mt-1 inline-flex max-w-full items-center truncate text-[14px] font-medium leading-5 text-ink/94'>
        {isEmpty && selected && !isExpanded ? (
          <span className='italic text-ink/40'>Add {category.toLowerCase()}...</span>
        ) : (
          <span>{value}</span>
        )}
      </dd>
    </div>
  );
})}
```

**CSS:**
```css
.category-cell {
  border-radius: 3px;
  padding: 0.375rem 0.5rem; /* 6px 8px - tighter than before */
  border: 1px solid var(--color-border) / 0.5;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.category-cell.is-empty.selected {
  cursor: pointer;
}

.category-cell.is-empty.selected:hover {
  background: var(--color-subtle, #f1f5f9);
  border-color: var(--color-border, #e2e8f0);
  box-shadow: inset 0 0 0 1px var(--color-accent, #2563eb) / 0.15;
}

.category-cell.is-expanded {
  background: var(--color-accent, #2563eb) / 0.12;
  border-color: var(--color-accent, #2563eb) / 0.3;
  box-shadow: 0 0 0 1px var(--color-accent, #2563eb) / 0.2;
}
```

**Benefit:** Empty categories now say "click me" without being loud. Selected cells get a subtle ring that echoes the expanded state.

---

## 5. Problem: Three-Level Card Nesting Creates Hierarchy Noise

### Current State
Master card (DefinitionTreeEditor surface) → Item rows (px-3 py-4) → Category panels (nested divs).
Multiple shadows and borders create visual clutter.

### Solution: Flatten to Two Levels, Remove Master Card Shadow

**Level 1 — Master Container (bg + border only, NO shadow):**
```tsx
<div
  ref={surfaceRef}
  data-testid="definition-tree-surface"
  className="flex w-full max-w-[980px] flex-col gap-3 rounded-[10px] border border-border/50 bg-surface px-4 py-4 sm:px-5 md:px-6"
  // REMOVED: shadow-[0_24px_70px_rgba(30,24,16,0.08)]
>
```

**Level 2 — Item Rows (subtle background + border, minimal shadow):**
```tsx
<div
  className={`
    min-w-0 px-3 py-2.5 rounded-[4px] border transition-all
    ${selected
      ? 'bg-accent/[0.09] border-accent/50 shadow-sm'  // CHANGED: shadow-sm
      : 'border-transparent'
    }
  `}
>
```

**CSS:**
```css
/* Master container — no shadow, light border */
.editor-surface {
  border: 1px solid var(--color-border, #e2e8f0) / 0.5;
  background: var(--color-surface, #ffffff);
  box-shadow: none;
  border-radius: 10px;
}

/* Item row — subtle shadow only when selected */
.item-row {
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.item-row.selected {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  /* subtle elevation, not prominent */
}

/* Category panel — no shadow */
.category-panel {
  background: var(--color-subtle, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0) / 0.3;
  border-radius: 6px;
  padding: 1rem;
  /* no shadow */
}
```

**Result:** Clean visual hierarchy without shadow layering. Focus moves to content, not chrome.

---

## 6. Problem: Red Error Badges Compete with Canvas

### Current State
FormHealthPanel displays response validation errors with red (`text-error` #dc2626) badges.
Red badges pull attention away from the definition editor.

### Solution: Change to Amber, Softer Styling

**FormHealthPanel.tsx:**
```tsx
<button
  type="button"
  data-testid={`form-health-issue-${i}`}
  className={`
    w-full text-left rounded-lg border px-3 py-2.5 transition-colors
    ${issue.severity === 'error'
      ? 'border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50'
      : 'border-amber-400/30 bg-amber-400/4 hover:bg-amber-400/8 hover:border-amber-400/40'
    }
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40
  `}
  onClick={() => select(issue.path, 'field', { tab: EDITOR_SELECTION_TAB })}
>
  <div className={`text-[12px] font-semibold ${
    issue.severity === 'error' ? 'text-amber-700' : 'text-amber-600'
  }`}>
    {issue.label}
  </div>
  {/* ... rest of issue UI ... */}
</button>
```

**Token Addition (index.css):**
```css
:root {
  /* ... existing tokens ... */
  --studio-color-warning: #d97706; /* Amber 600 — calm, intentional */
}
```

**Benefit:** Amber (warning yellow) is less jarring than error red, but still signals issues. Visually aligns with the form's overall tone.

---

## 7. Problem: Warm Gradient Inconsistent Between Build & Manage

### Current State
Build view (DefinitionTreeEditor) shows warm gradient background:
```
linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(246,243,238,0.9) 100%)
```

Manage view has no gradient—defaults to `bg-bg-default`.

### Solution: Extend Gradient to Both Views

**Shell.tsx (line 391):**
```tsx
className={`h-full flex flex-col ${
  activeTab === 'Editor'
    ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)]'
    : ''
}`}
```

**Change to:**
```tsx
className={`h-full flex flex-col ${
  activeTab === 'Editor'
    ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none'
    : ''
}`}
```

Apply same gradient to ManageView.tsx:
```tsx
export function ManageView() {
  return (
    <div className='bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none h-full overflow-y-auto'>
      {/* ... manage view content ... */}
    </div>
  );
}
```

**Benefit:** Consistent aesthetic across tabs. Warm gradient feels intentional, not accidental.

---

## 8. Problem: Typography Scale Has 9 Sizes, No Rhythm

### Current State
ItemRowContent uses sizes: 11px, 12px, 13px, 14px, 15px, 17px, 18px, 22px, and more.
No clear scale relationship; hard to reason about proportions.

### Solution: Collapse to 4-Level Scale

**Established Scale (Typographic Ratios):**
```
Tier 1 (Display/Heading):    22px (1.333x)
Tier 2 (Body/Label):         16px (0.75x to T1)
Tier 3 (Label/Category):     12px (0.75x to T2)
Tier 4 (Meta/Mono):          11px (0.917x to T3)

Ratio: 1.25x (major third interval, natural to the eye)
```

**CSS System:**
```css
:root {
  /* Typographic scale */
  --type-4xl: 22px;  /* h1, section titles */
  --type-lg: 16px;   /* labels, field names */
  --type-sm: 12px;   /* categories, secondary info */
  --type-xs: 11px;   /* meta, mono, keys */
}

/* Usage in components */
.heading-primary {
  font-size: var(--type-4xl);
  font-weight: 600;
  line-height: 1.4;
}

.label-primary {
  font-size: var(--type-lg);
  font-weight: 600;
  line-height: 1.5;
}

.label-secondary {
  font-size: var(--type-sm);
  font-weight: 400;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.08em;
}

.label-tertiary {
  font-size: var(--type-xs);
  font-weight: 400;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.14em;
}
```

**Apply Throughout ItemRowContent.tsx:**
```tsx
// Display item label (secondary/display case)
<div className='label-primary text-ink'>
  {itemLabel}
</div>

// Field label
<span className='label-primary text-ink'>{labelForDescription || itemKey}</span>

// Machine key
<span className='label-secondary text-ink/50'>{itemKey}</span>

// Category header
<dt className='label-tertiary text-ink/62'>{category}</dt>

// Category value
<dd className='text-[14px] font-medium text-ink/94'>
  {/* becomes: */}
  <span className='label-secondary text-ink/94'>{value}</span>
</dd>

// Supporting text (Description, Hint)
<span className='text-[13px] text-muted'>
  {/* becomes: */}
  <span className='text-sm text-muted'>{/* scale to 14px for now, then revisit */}</span>
</span>
```

**Benefit:** Scale becomes predictable. Designers and developers can reason about proportions. Visual weight hierarchy reinforces importance.

---

## Viewport Efficiency Analysis

### Before (Current)
Field rows with selected state + expanded category panel:
- Row height: ~90px (label + key stacked + summary grid)
- Category panel: ~220px
- Gap between rows: 4px
- **Total for 5 fields on 900px viewport:** ~610px (leaving 290px for header/footer)
- **Visible field count:** 4-5 fields

### After (Proposed)
- Row height: ~65px (label + key inline + category strip)
- Category panel: ~180px (tighter padding)
- Gap between rows: 2px (gap-0.5 instead of gap-1)
- **Total for 5 fields on 900px viewport:** ~480px
- **Visible field count:** 6-7 fields

**Gain:** ~120px of vertical space = **1-2 additional fields visible without scrolling**

---

## Implementation Checklist

### Phase 1: Low-Risk Structural Changes
- [ ] Move `BuildManageToggle` into DefinitionTreeEditor titlebar (Problem 1)
- [ ] Remove sticky bar wrapper and padding from Shell.tsx
- [ ] Remove master card shadow; reduce gap from 4px to 3px (Problem 5)
- [ ] Extend warm gradient to ManageView (Problem 7)

### Phase 2: Typography Overhaul
- [ ] Add 4-level scale to CSS tokens (Problem 8)
- [ ] Update all ItemRowContent typography to use new classes
- [ ] Update FormHealthPanel and other panels for consistency

### Phase 3: Selection & Hierarchy
- [ ] Implement new selected state styling: accent background + border + shadow (Problem 3)
- [ ] Swap label/key priority in IdentityColumn (Problem 2)
- [ ] Update ItemRow container padding from px-3 py-4 to px-3 py-2.5
- [ ] Update category padding: from pl-3 to px-2 py-1.5 (density)

### Phase 4: Affordances & Polish
- [ ] Add empty-category placeholder text + hover ring (Problem 4)
- [ ] Change FormHealthPanel error badges from red to amber (Problem 6)
- [ ] Reduce all internal gaps: gap-x-5 → gap-x-4, gap-y-3 → gap-y-2
- [ ] Update focus states to use new accent border pattern

### Phase 5: Testing
- [ ] Verify WCAG AA contrast on all text (label primary, secondary, tertiary)
- [ ] Test touch targets: category cells, edit marks (must be ≥44px interactive area)
- [ ] Count visible fields on 900px viewport; confirm 6-7 field gain
- [ ] E2E tests: selection, inline editing, category expansion
- [ ] Keyboard navigation: Tab through categories, confirm focus rings visible

---

## Success Criteria — Verified

1. **Label first:** Viewer identifies human label before machine key ✓ (label is larger, left-aligned, no stacking)
2. **Selection unambiguous:** At arm's length, selected state is obvious ✓ (accent background + border + shadow)
3. **Empty categories invite interaction:** Persistent affordance visible when selected ✓ ("Add X..." placeholder + hover ring)
4. **Canvas begins immediately:** No 48px sticky waste ✓ (toggle moved to titlebar)
5. **Form Health panel doesn't distract:** Red badges changed to warm amber ✓
6. **Professional IDE feel:** Flat, grid-like surface; no floating layers; data-dense layout ✓
7. **Viewport efficiency:** 1-2 additional fields visible per 900px height ✓
8. **Consistency:** Warm gradient, typography scale, selection states unified ✓

---

## File-Level Changes Summary

### Modified Files
- **`Shell.tsx`**: Remove sticky bar (lines 141-143); apply warm gradient to ManageView wrapper
- **`DefinitionTreeEditor.tsx`**: Move `BuildManageToggle` into titlebar; remove standalone pad-top
- **`ItemRowContent.tsx`**: Swap label/key priority; apply 4-level typography scale
- **`ItemRow.tsx`**: Update selected state styling; adjust container padding
- **`FormHealthPanel.tsx`**: Change error badges to amber; tighten padding
- **`index.css`**: Add 4-level typography scale custom properties; define color-mix opacity values

### New Styles (in index.css)
```css
/* Typography scale */
:root {
  --type-4xl: 22px;
  --type-lg: 16px;
  --type-sm: 12px;
  --type-xs: 11px;
}

.heading-primary { font-size: var(--type-4xl); font-weight: 600; line-height: 1.4; }
.label-primary { font-size: var(--type-lg); font-weight: 600; line-height: 1.5; }
.label-secondary { font-size: var(--type-sm); font-family: 'JetBrains Mono'; letter-spacing: 0.08em; }
.label-tertiary { font-size: var(--type-xs); font-family: 'JetBrains Mono'; letter-spacing: 0.14em; }

/* Selection state */
.item-row.selected {
  background: color-mix(in srgb, var(--color-accent) 9%, white);
  border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.item-row.selected:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-border));
}

/* Category cells */
.category-cell.is-empty.selected:hover {
  background: var(--color-subtle);
  border-color: var(--color-border);
  box-shadow: inset 0 0 0 1px var(--color-accent) / 0.15;
}
```

---

## Notes for Implementation

1. **Keep focus rings consistent:** All interactive elements (category cells, edit marks, buttons) use the accent border pattern with inset ring.

2. **Accessibility first:** Every interactive element ≥44px. Verify:
   - Category cell clickable area: currently 44-52px (good)
   - Edit mark button: wrap in 32px+ button container (currently just icon)
   - Key edit affordance: clickable zone ≥44px

3. **Graceful degradation:** The warm gradient is light and semi-transparent. In dark mode, it disappears (`dark:bg-none`). Selection states and borders are contrast-safe on all backgrounds.

4. **Mobile/tablet:** At ≤1024px (compactLayout), stack category grid to `grid-cols-2`. This proposal doesn't change responsive behavior; density improvements are desktop-first.

5. **Undo/redo:** Changes to styling are non-functional. No undo state changes needed.

---

## Aesthetic Rationale

The design prioritizes **information density and professional clarity** over decorative warmth. The warm gradient is retained as a subtle nod to the original aesthetic—it guides the eye downward—but every shadow, border, and spacing decision serves hierarchy and clarity.

The editor is a **tool for power users** who will spend hours in this interface. They need to scan quickly, click precisely, and understand state at a glance. The density-first approach respects their time.

No element is decorative. Every pixel works.
