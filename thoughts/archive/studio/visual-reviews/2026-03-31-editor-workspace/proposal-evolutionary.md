# Editor Workspace Visual Design Proposal — Evolutionary

**Date:** 2026-03-31
**Scope:** Editor Build/Manage workspace visual hierarchy, component restructuring, typography system, interaction states
**Direction:** Moderate restructuring with design-system coherence focus
**Target files:**
- `packages/formspec-studio/src/components/Shell.tsx` (layout restructure)
- `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx` (identity hierarchy)
- `packages/formspec-studio/src/workspaces/editor/ItemRowContent.tsx` (identity & category markup)
- `packages/formspec-studio/src/index.css` (typography tokens, new animation)
- `packages/formspec-studio/src/workspaces/editor/ItemRowCategoryPanel.tsx` (category cell affordance)

---

## Design Rationale

The Editor workspace is the canonical authoring environment for form structure. Today, it presents the user with three parallel information hierarchies (identity, categories, supporting text) but the visual weight distribution doesn't match the cognitive priority: the machine key is larger and heavier than the human label; the sticky toggle consumes space for a single affordance; empty category cells are clickable but visually inert; and the master card shadow creates visual noise rather than clear spatial structure.

The proposal solves these problems via a single coherent principle: **structure follows cognitive priority**. Human-readable identity comes first and largest. Machine keys become supporting secondary information. Interaction states become unmistakable via background color + border + shadow (the "selection pyramid"). Empty states invite interaction through consistent visual cues (italic label + ring on hover). The sticky toggle moves into the card header where it logically belongs. The master card shadow lightens, reducing visual weight. And we introduce a formal type scale that enforces rhythm across the entire component.

This is not a redesign — it is a clarification of the existing design system's intent, with the markup restructured to make that intent visible.

---

## Visual Changes by Problem

### Problem 1: Sticky Build/Manage toggle wastes 48px

**Current state:** Shell.tsx lines 141–143 show the toggle in a sticky band with `px-6 py-3`, consuming premium vertical space on every Build view render.

**First domino:** The toggle is logically part of the editor view selector, but structurally separate from the content it controls. It should be a control *of* the view, not above it.

**Solution:** Move `BuildManageToggle` into the `DefinitionTreeEditor` card header, adjacent to the "Structure editor" label and summary. The toggle becomes a read-only affordance for the current view — colocated with the section title.

**Code location:**
- Remove the sticky band in Shell.tsx (lines 141–143)
- Add toggle rendering to DefinitionTreeEditor header section (after line 387)

**Result:** Canvas area begins immediately after app header. Saves 48px of persistent vertical waste.

---

### Problem 2: Machine key dominates human label

**Current state:** ItemRowContent.tsx identity column (lines 163–186):
- Field key: `text-[17px] font-semibold` (primary, mono, large)
- Field label: `text-[14px] font-normal` (secondary, below key, smaller)

This inverts user priority. Users author forms for humans, not machines. The human-readable label should be the primary focal point.

**First domino:** The markup order in IdentityColumn follows machine-first logic. We need to restructure the identity section as: icon, then human label (primary), then machine key (secondary).

**Solution:** Reorganize ItemRowContent.tsx identity rendering:
1. **Icon** (left, fixed 44px, unchanged)
2. **Label row** (primary section):
   - Display label: 16px, Space Grotesk 600, semibold, `text-ink`
   - When selected + no explicit label: italic placeholder "Add a display label…", `text-ink/50`
3. **Key row** (secondary section, below label):
   - Label: "Key", 11px, JetBrains Mono, uppercase, `text-ink/60`
   - Value: 12px, JetBrains Mono, medium, `text-ink/68`
   - Grouped prefix (if repeatable): `text-ink/35` dimmed

**Markup structure (fields only):**
```
<div className='flex min-w-0 gap-3'>
  {/* Icon */}
  <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85'>
    <FieldIcon dataType={dataType!} className={dt.color} />
  </div>

  {/* Identity column: label first, then key */}
  <div className='min-w-0'>
    {/* Primary: Label */}
    {activeIdentityField === 'label' ? (
      <input ... className='...' />
    ) : (
      <div className='text-[16px] font-semibold font-ui leading-6 text-ink {showEditMark ? "group cursor-text" : ""}'>
        <span className={labelForDescription ? '' : 'italic text-ink/50'}>
          {labelForDescription ?? 'Add a display label…'}
        </span>
        {showEditMark ? <EditMark /> : null}
      </div>
    )}

    {/* Secondary: Key + dataType */}
    <div className='mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
      {activeIdentityField === 'key' ? (
        <input ... className='...' />
      ) : (
        <>
          {groupPrefix && <span className='font-mono text-[11px] text-ink/35'>{groupPrefix}</span>}
          <span className='font-mono text-[12px] font-medium text-ink/68 {showEditMark ? "group cursor-text" : ""}'>
            {itemKey}
            {showEditMark ? <EditMark /> : null}
          </span>
        </>
      )}
      {dataType && (
        <span className='font-mono text-[11px] text-muted'>
          {dataType}
        </span>
      )}
    </div>
  </div>
</div>
```

**Display items:** Similar structure, but label is primary and key is optional secondary (below, greyed).

**Result:** Users see human label first and largest. Key becomes supporting metadata. Visual hierarchy matches cognitive priority.

---

### Problem 3: Selected state is too subtle

**Current state:** ItemRow.tsx line 546-548 shows:
- `border-accent/30` — barely visible
- `bg-accent/[0.05]` — nearly transparent
- `shadow-[0_14px_34px_rgba(59,130,246,0.12)]` — soft, hard to detect at a glance

Selected rows are often not immediately obvious, especially in dense lists.

**First domino:** The selected state tokens (`border-accent/30`, `bg-accent/[0.05]`) are designed for subtlety, not clarity. We need a graduated response: quiet enough to not distract, but obvious enough to identify instantly.

**Solution:** Introduce a "selection pyramid" interaction state model:
| State | Background | Border | Shadow | Effect |
|-------|-----------|--------|--------|--------|
| **Default** | transparent | transparent | none | Minimal visual weight |
| **Hover** (unselected) | `bg-bg-default/56` | `border-border/70` | none | Soft feedback |
| **Selected** | `bg-accent/[0.09]` | `border-accent/50` | `0_8px_20px_rgba(37,99,235,0.18)` | Clear, unambiguous, not jarring |

The key change: `border-accent/50` (instead of `/30`) makes the border far more visible. The shadow lifts slightly but stays warm-toned (`rgba(37,99,235,0.18)` is the accent color desaturated and dimmed). This creates a "floating" effect without visual chaos.

**CSS in ItemRow.tsx:**
```tsx
className={[
  'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
  selected
    ? 'border-accent/50 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]'
    : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
].join(' ')}
```

**Result:** Selected cards are immediately obvious at arm's length without feeling garish. The selection state communicates "this is active" clearly.

---

### Problem 4: Empty category cells lack click affordance

**Current state:** ItemRowContent.tsx lines 343–365. Categories are rendered as:
```tsx
<div
  className={`min-w-0 border-l border-border/65 pl-3 ${selected ? 'cursor-pointer' : ''}`}
>
  <dt className='font-mono text-[11px] tracking-[0.14em] text-ink/62'>{category}</dt>
  <dd className='group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 text-ink/94'>
    <span className='truncate'>{value}</span>
  </dd>
</div>
```

When `value` is empty (e.g., no constraint for a Validation field), the cell shows no content and no visual cue that it's clickable. Users don't realize it's interactive.

**First domino:** We need a consistent empty-state pattern that visually invites interaction. The pattern should be reusable across category cells, supporting text, and any property that starts empty.

**Solution:** Introduce a `CategoryCell` micro-component with built-in empty-state rendering:

**New CategoryCell.tsx:**
```tsx
import type { ReactNode } from 'react';

interface CategoryCellProps {
  label: string;
  value: string;
  selected?: boolean;
  isExpanded?: boolean;
  onOpen?: () => void;
  children?: ReactNode;
}

export function CategoryCell({
  label,
  value,
  selected = false,
  isExpanded = false,
  onOpen,
}: CategoryCellProps) {
  const isEmpty = !value || value.trim() === '';
  const showAffordance = selected && isEmpty;

  return (
    <div
      className={`min-w-0 border-l border-border/65 pl-3 ${selected && onOpen ? 'cursor-pointer' : ''}`}
      onClick={(event) => {
        if (!selected || !onOpen || !isEmpty) return;
        event.stopPropagation();
        onOpen();
      }}
    >
      <dt className='font-mono text-[11px] tracking-[0.14em] text-ink/62'>
        {label}
      </dt>
      <dd
        className={`group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[14px] font-medium leading-5 ${
          isEmpty
            ? 'text-ink/35 italic'
            : 'text-ink/94'
        } ${
          showAffordance
            ? 'ring-1 ring-accent/15'
            : ''
        }`}
      >
        {isEmpty ? (
          <span className='truncate'>
            Add {label.toLowerCase()}…
          </span>
        ) : (
          <span className='truncate'>{value}</span>
        )}
      </dd>
    </div>
  );
}
```

**Usage in ItemRowContent.tsx SummaryColumn:**
```tsx
{Object.entries(categorySummaries).map(([category, value]) => (
  <CategoryCell
    key={category}
    label={category}
    value={value}
    selected={selected}
    isExpanded={expandedCategoryKey === category}
    onOpen={() => onOpenEditorForSummary(category)}
  />
))}
```

**Result:** Empty categories show "Add [category]…" in italic, with a subtle ring on hover when selected. Users immediately understand the cell is interactive.

---

### Problem 5: Master card shadow is too heavy

**Current state:** DefinitionTreeEditor.tsx line 382 shows:
```tsx
className="... shadow-[0_24px_70px_rgba(30,24,16,0.08)] ..."
```

This 70px blur radius and 24px vertical offset creates a deep, recessive shadow that makes the card feel distant and adds visual noise to the canvas.

**First domino:** The shadow size suggests a card floating far above the surface. We want the card to feel present and grounded, not dramatically elevated. A smaller shadow creates a cleaner, more refined appearance.

**Solution:** Reduce to `shadow-[0_4px_16px_rgba(30,24,16,0.04)]` — a compact, close-proximity shadow that reads as "slightly elevated" without visual drama.

**CSS in DefinitionTreeEditor.tsx:**
```tsx
className="... shadow-[0_4px_16px_rgba(30,24,16,0.04)] ..."
```

**Result:** The card sits confidently on the canvas without creating a visual hierarchy that competes with the content. The gradient background becomes more prominent.

---

### Problem 6: Form Health panel competes for attention via red error badges

**Current state:** FormHealthPanel.tsx lines 73 shows:
```tsx
className="... border-amber-500/35 bg-amber-500/5 ..."
```

The issue is not the amber color itself (which is correct for warnings), but the visual weight when the panel is in the right rail. Red or dark error colors in persistent panels create visual tension.

**Solution:** Form Health currently shows "Issues" (which are advisory warnings, not errors). Keep the amber treatment, but ensure the panel is visually calm and doesn't scream for attention. The current implementation already uses amber, which is appropriate. No change needed here — the issue was a red herring in the brief. Confirm: amber is the right color for advisory issues.

**Result:** The panel maintains its role as a reference, not an alarm.

---

### Problem 7: Warm gradient missing in Manage view

**Current state:** Shell.tsx line 391 shows the gradient is applied only when `activeEditorView === 'build'`:
```tsx
className={`h-full flex flex-col ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(...)]' : ''}`}
```

The Manage view (edit binds, shapes, variables) deserves the same visual treatment for consistency.

**Solution:** Extend the gradient to both editor views:
```tsx
className={`h-full flex flex-col ${activeTab === 'Editor' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**Result:** Both Build and Manage views share a cohesive aesthetic.

---

### Problem 8: Typography scale is incoherent

**Current state:** Scattered font sizes with no clear system:
- Field label: 14px (current), should be 16px
- Field key: 17px (current), should be 12px
- Category DT: 11px ✓
- Category DD: 14px ✓
- Group label: 18px ✓
- Group key: 13px (current for display), ✓
- Inline edit inputs: 17px/18px (should match the display they're editing)

The scale lacks rhythm. Every heading-like element has a different size.

**Solution:** Introduce a formal type-scale token system in `index.css` using CSS custom properties. This makes the system explicit, testable, and reusable across the studio.

**New CSS in index.css (after the color tokens):**
```css
@theme inline {
  /* Type Scale — enforces visual rhythm */
  --font-size-label: 16px;           /* Field/group display label */
  --font-size-label-sm: 15px;        /* Alternative for dense layouts */
  --font-size-label-xs: 14px;        /* Secondary labels */
  --font-size-key: 12px;             /* Machine key / mono identifier */
  --font-size-category-label: 11px;  /* Category header (DT) */
  --font-size-category-value: 14px;  /* Category value (DD) */
  --font-size-hint: 13px;            /* Supporting text */
  --font-size-caption: 11px;         /* Wordmarks, badges */

  /* Font weights */
  --font-weight-semibold: 600;
  --font-weight-medium: 500;
  --font-weight-normal: 400;

  /* Line heights — logical property values */
  --line-height-tight: 1.4;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;

  /* Letter spacing */
  --letter-spacing-tight: 0;
  --letter-spacing-normal: 0.01em;
  --letter-spacing-wide: 0.08em;
}
```

**Updated typography in ItemRowContent.tsx (identity column, fields):**
```tsx
/* Primary: Label */
className='text-[var(--font-size-label)] font-semibold font-ui leading-[var(--line-height-tight)] text-ink'

/* Secondary: Key */
className='font-mono text-[var(--font-size-key)] font-medium letter-spacing-[var(--letter-spacing-wide)] text-ink/68'

/* DataType badge */
className='font-mono text-[var(--font-size-key)] text-muted'
```

**Ratios:**
- Label (16px) : Key (12px) = 1.33:1 (major third — classical proportion)
- Label (16px) : Category Label (11px) = 1.45:1
- Label (16px) : Group Label (18px) = 0.89:1 (groups are slightly larger — intentional hierarchy)

**Result:** Type scale is systematic, memorable, and scales smoothly across all component sizes.

---

## Token & CSS Changes

### New Design Tokens in index.css

**Interaction state tokens** (add after color definitions):
```css
/* Interaction State Tokens */
--state-selected-border: var(--color-accent) / 0.5;        /* 50% opacity */
--state-selected-bg: var(--color-accent) / 0.09;           /* 9% opacity */
--state-selected-shadow: 0 8px 20px rgba(37, 99, 235, 0.18);
--state-hover-border: var(--color-border) / 0.7;
--state-hover-bg: var(--color-bg-default) / 0.56;
--state-empty-text: var(--color-ink) / 0.35;
--state-empty-ring: var(--color-accent) / 0.15;            /* Subtle ring for empty cells */
```

**Typography tokens** (as above):
```css
--font-size-label: 16px;
--font-size-key: 12px;
--font-size-category-label: 11px;
--font-size-category-value: 14px;
--letter-spacing-wide: 0.08em;
```

### CSS Utility Classes for Reuse

Add to `index.css` after the tokens:
```css
/* Text utilities — use for consistent empty state styling */
@utility text-empty {
  color: color-mix(in srgb, var(--color-ink) 35%, transparent);
  font-style: italic;
}

@utility ring-empty {
  border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
  border-radius: 0.375rem; /* 6px */
}

/* Selection state shorthand */
@utility state-selected {
  border-color: var(--state-selected-border);
  background-color: var(--state-selected-bg);
  box-shadow: var(--state-selected-shadow);
}

@utility state-hover {
  border-color: var(--state-hover-border);
  background-color: var(--state-hover-bg);
}
```

---

## Component Changes

### 1. Shell.tsx

**Change:** Remove sticky toggle band; extend gradient to Manage view.

```tsx
// Line 138-149: OLD
<div className="flex flex-col h-full">
  <div className="sticky top-0 z-20 border-b border-border/70 bg-bg-default/80 backdrop-blur-md px-6 py-3">
    <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} manageCount={manageCount} />
  </div>
  <div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
    {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
  </div>
</div>

// NEW
<div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
  {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
</div>

// Line 391: OLD
className={`h-full flex flex-col ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}

// NEW
className={`h-full flex flex-col ${activeTab === 'Editor' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**Pass toggle to DefinitionTreeEditor as prop:**
```tsx
// Line 145: Pass view control
<DefinitionTreeEditor
  activeEditorView={activeEditorView}
  onEditorViewChange={setActiveEditorView}
  manageCount={manageCount}
/>
```

### 2. DefinitionTreeEditor.tsx

**Change:** Accept toggle props; render toggle in header; reduce card shadow.

```tsx
// Add props
interface DefinitionTreeEditorProps {
  activeEditorView?: EditorView;
  onEditorViewChange?: (view: EditorView) => void;
  manageCount?: number;
}

export function DefinitionTreeEditor({
  activeEditorView = 'build',
  onEditorViewChange,
  manageCount,
}: DefinitionTreeEditorProps) {
  // ... existing code ...

  // Line 387: Update header to include toggle
  <div className="flex flex-col gap-3 border-b border-border/65 pb-4 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      {/* ... existing title block ... */}
    </div>
    <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
      {/* BuildManageToggle moved here */}
      {onEditorViewChange && (
        <BuildManageToggle
          activeView={activeEditorView}
          onViewChange={onEditorViewChange}
          manageCount={manageCount}
        />
      )}
      {/* ... existing status pills ... */}
    </div>
  </div>

  // Line 382: Reduce shadow
  className="... shadow-[0_4px_16px_rgba(30,24,16,0.04)] ..."
}
```

### 3. ItemRowContent.tsx

**Change:** Restructure identity column; label first, key second; introduce CategoryCell.

**IdentityColumn for fields (lines 72–316):**
```tsx
function IdentityColumn({ identity, editState, actions, layout }: ItemRowContentProps) {
  const {
    testId,
    itemKey,
    itemLabel,
    isField,
    selected,
    editable,
    dataType,
    widgetHint,
    dt,
    labelForDescription,
    groupPrefix,
  } = identity;
  const { activeIdentityField, draftKey, draftLabel } = editState;
  const {
    onDraftKeyChange,
    onDraftLabelChange,
    onCommitIdentityField,
    onCancelIdentityField,
    onOpenIdentityField,
  } = actions;

  const insideButton = layout === 'identity';
  const showEditMark = selected && editable;

  const handleIdentityKeyDown =
    (field: 'label' | 'key') => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onCommitIdentityField(field);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelIdentityField();
      }
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (isField) {
          if (field === 'key' && !event.shiftKey) {
            event.preventDefault();
            onCommitIdentityField('key');
            onOpenIdentityField('label');
          } else if (field === 'label' && event.shiftKey) {
            event.preventDefault();
            onCommitIdentityField('label');
            onOpenIdentityField('key');
          }
        }
      }
    };

  return (
    <div className='flex min-w-0 gap-3'>
      {isField && dt && (
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85'>
          <FieldIcon dataType={dataType!} className={`shrink-0 ${dt.color}`} />
        </div>
      )}
      {!isField && (
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-bg-default/85'>
          <span className='text-accent font-mono shrink-0'>
            {widgetHint === 'heading'
              ? 'H'
              : widgetHint === 'divider'
                ? '\u2014'
                : '\u2139'}
          </span>
        </div>
      )}

      <div className='min-w-0'>
        {isField ? (
          <>
            {/* PRIMARY: Label */}
            {activeIdentityField === 'label' ? (
              <input
                aria-label='Inline label'
                type='text'
                autoFocus
                value={draftLabel}
                className='w-full rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 text-[var(--font-size-label)] font-semibold font-ui leading-[var(--line-height-tight)] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftLabelChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('label')}
                onKeyDown={handleIdentityKeyDown('label')}
              />
            ) : (
              <div
                className={`text-[var(--font-size-label)] font-semibold font-ui leading-[var(--line-height-tight)] text-ink ${
                  showEditMark ? 'group cursor-text' : ''
                }`}
                onClick={(event) => {
                  if (!showEditMark) return;
                  event.stopPropagation();
                  onOpenIdentityField('label');
                }}
              >
                <span className={labelForDescription ? '' : 'text-empty'}>
                  {labelForDescription ?? 'Add a display label\u2026'}
                </span>
                {showEditMark ? <EditMark testId={`${testId}-label-edit`} /> : null}
              </div>
            )}

            {/* SECONDARY: Key + DataType */}
            <div className='mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
              {activeIdentityField === 'key' ? (
                <input
                  aria-label='Inline key'
                  type='text'
                  autoFocus
                  value={draftKey}
                  className='w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 font-mono text-[var(--font-size-key)] font-medium letter-spacing-[var(--letter-spacing-wide)] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onDraftKeyChange(event.currentTarget.value)
                  }
                  onBlur={() => onCommitIdentityField('key')}
                  onKeyDown={handleIdentityKeyDown('key')}
                />
              ) : (
                <>
                  {groupPrefix && (
                    <span className='font-mono text-[var(--font-size-key)] text-ink/35'>
                      {groupPrefix}
                    </span>
                  )}
                  <span
                    className={`font-mono text-[var(--font-size-key)] font-medium letter-spacing-[var(--letter-spacing-wide)] text-ink/68 ${
                      showEditMark ? 'group cursor-text' : ''
                    }`}
                    onClick={(event) => {
                      if (!showEditMark) return;
                      event.stopPropagation();
                      onOpenIdentityField('key');
                    }}
                  >
                    {itemKey}
                    {showEditMark ? <EditMark testId={`${testId}-key-edit`} /> : null}
                  </span>
                </>
              )}
              {dataType && (
                <span className='font-mono text-[var(--font-size-key)] text-muted'>
                  {dataType}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Display items: Label is primary, Key is optional secondary */}
            {activeIdentityField === 'label' ? (
              <input
                aria-label='Inline label'
                type='text'
                autoFocus
                value={draftLabel}
                className='w-full rounded-[6px] border border-accent/30 bg-surface px-2 py-1.5 text-[var(--font-size-label)] font-semibold font-ui leading-[var(--line-height-tight)] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onDraftLabelChange(event.currentTarget.value)
                }
                onBlur={() => onCommitIdentityField('label')}
                onKeyDown={handleIdentityKeyDown('label')}
              />
            ) : (
              <>
                <div className='text-[var(--font-size-label)] font-semibold font-ui leading-[var(--line-height-tight)] text-ink'>
                  <span
                    className={showEditMark ? 'group inline-flex cursor-text' : 'inline-flex'}
                    onClick={(event) => {
                      if (!showEditMark) return;
                      event.stopPropagation();
                      onOpenIdentityField('label');
                    }}
                  >
                    <span className='truncate'>{itemLabel || 'Untitled'}</span>
                    {showEditMark ? (
                      <EditMark testId={`${testId}-label-edit`} />
                    ) : null}
                  </span>
                </div>
                {widgetHint && (
                  <span className='font-mono text-[var(--font-size-key)] text-accent/80'>
                    {widgetHint}
                  </span>
                )}
                <div className='mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
                  {activeIdentityField === 'key' ? (
                    <input
                      aria-label='Inline key'
                      type='text'
                      autoFocus
                      value={draftKey}
                      className='w-full max-w-[16rem] rounded-[6px] border border-border/80 bg-surface px-2 py-1.5 font-mono text-[var(--font-size-key)] font-medium letter-spacing-[var(--letter-spacing-wide)] text-ink outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onDraftKeyChange(event.currentTarget.value)
                      }
                      onBlur={() => onCommitIdentityField('key')}
                      onKeyDown={handleIdentityKeyDown('key')}
                    />
                  ) : (
                    <span className='inline-flex items-baseline gap-1.5'>
                      <span className='font-mono text-[var(--font-size-caption)] uppercase letter-spacing-[var(--letter-spacing-wide)] text-ink/60'>
                        Key
                      </span>
                      <span
                        className={`font-mono text-[var(--font-size-key)] font-medium letter-spacing-[var(--letter-spacing-wide)] text-ink/68 ${
                          showEditMark ? 'group cursor-text' : ''
                        }`}
                        onClick={(event) => {
                          if (!showEditMark) return;
                          event.stopPropagation();
                          onOpenIdentityField('key');
                        }}
                      >
                        {groupPrefix && (
                          <span className='text-ink/35'>{groupPrefix}</span>
                        )}
                        {itemKey}
                        {showEditMark ? (
                          <EditMark testId={`${testId}-key-edit`} />
                        ) : null}
                      </span>
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

**SummaryColumn: Use CategoryCell (lines 318–450):**
```tsx
import { CategoryCell } from './CategoryCell';

function SummaryColumn({
  identity,
  editState,
  actions,
  categoryEditor,
  statusPills = [],
}: ItemRowContentProps) {
  const { testId, selected, editable } = identity;
  const showEditMark = selected && editable;
  const {
    activeInlineSummary,
    supportingText,
    categorySummaries,
    expandedCategoryKey,
    summaryInputValue,
  } = editState;
  const { onOpenEditorForSummary, onCloseInlineSummary, onCancelInlineSummary, onUpdateSummaryValue } =
    actions;

  return (
    <div className='min-w-0 flex flex-col gap-3'>
      <dl
        data-testid={`${testId}-summary`}
        className={`grid gap-x-5 gap-y-3 ${
          Object.keys(categorySummaries).length <= 2
            ? 'grid-cols-2'
            : Object.keys(categorySummaries).length <= 4
              ? 'grid-cols-4'
              : 'grid-cols-5'
        }`}
      >
        {Object.entries(categorySummaries).map(([category, value]) => (
          <CategoryCell
            key={category}
            label={category}
            value={value}
            selected={selected}
            isExpanded={expandedCategoryKey === category}
            onOpen={() => onOpenEditorForSummary(category)}
          />
        ))}
      </dl>

      {statusPills.length > 0 && (
        <div
          data-testid={`${testId}-status`}
          className='flex flex-wrap items-center gap-2'
        >
          {statusPills.map((pill) => (
            <Pill
              key={`${testId}-pill-${pill.text}-${pill.specTerm}`}
              text={pill.text}
              color={pill.color}
              size='sm'
              title={pill.specTerm}
              warn={pill.warn}
            />
          ))}
        </div>
      )}

      {categoryEditor}

      {supportingText.length > 0 && (
        <dl className='grid gap-x-5 gap-y-3 sm:grid-cols-2'>
          {supportingText.map((entry) => (
            <div
              key={entry.label}
              className='min-w-0 border-l border-border/65 pl-3'
            >
              <dt className='font-mono text-[var(--font-size-caption)] tracking-[var(--letter-spacing-wide)] uppercase text-ink/62'>
                {entry.label}
              </dt>
              {activeInlineSummary === entry.label ? (
                <input
                  aria-label={summaryInputLabel(entry.label)}
                  type={summaryInputType(entry.label)}
                  autoFocus
                  className={summaryInputClassName}
                  value={summaryInputValue(entry.label)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onUpdateSummaryValue(entry.label, event.currentTarget.value)
                  }
                  onBlur={onCloseInlineSummary}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCloseInlineSummary();
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onCancelInlineSummary();
                    }
                  }}
                />
              ) : (
                <dd
                  className={`group mt-1 inline-flex max-w-full items-center truncate text-[var(--font-size-category-value)] font-medium leading-5 ${
                    showEditMark ? 'cursor-text' : ''
                  } ${entry.value ? 'text-ink/94' : 'text-empty'}`}
                  onClick={(event) => {
                    if (!showEditMark) return;
                    event.stopPropagation();
                    onOpenEditorForSummary(entry.label);
                  }}
                >
                  <span className='truncate'>
                    {entry.value ||
                      (selected
                        ? `Click to add ${entry.label.toLowerCase()}`
                        : '\u2014')}
                  </span>
                  {showEditMark ? (
                    <EditMark
                      testId={`${testId}-summary-edit-${entry.label}`}
                    />
                  ) : null}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
```

### 4. ItemRow.tsx

**Change:** Update selected state to use new tokens.

```tsx
// Line 544-549: OLD
className={[
  'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
  selected
    ? 'border-accent/30 bg-accent/[0.05] shadow-[0_14px_34px_rgba(59,130,246,0.12)]'
    : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
].join(' ')}

// NEW
className={[
  'group rounded-[18px] border px-3 py-4 transition-[border-color,background-color,box-shadow] md:px-4',
  selected
    ? 'border-accent/50 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]'
    : 'border-transparent hover:border-border/70 hover:bg-bg-default/56',
].join(' ')}
```

### 5. CategoryCell.tsx (NEW)

Create new file at `/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/CategoryCell.tsx`:

```tsx
/** @filedesc Reusable category cell component with built-in empty state affordance. */

interface CategoryCellProps {
  label: string;
  value: string;
  selected?: boolean;
  isExpanded?: boolean;
  onOpen?: () => void;
}

export function CategoryCell({
  label,
  value,
  selected = false,
  isExpanded = false,
  onOpen,
}: CategoryCellProps) {
  const isEmpty = !value || value.trim() === '';
  const showAffordance = selected && isEmpty;

  return (
    <div
      className={`min-w-0 border-l border-border/65 pl-3 ${
        selected && onOpen ? 'cursor-pointer' : ''
      }`}
      onClick={(event) => {
        if (!selected || !onOpen || !isEmpty) return;
        event.stopPropagation();
        onOpen();
      }}
    >
      <dt className='font-mono text-[var(--font-size-caption)] tracking-[var(--letter-spacing-wide)] uppercase text-ink/62'>
        {label}
      </dt>
      <dd
        className={`group mt-1 inline-flex max-w-full items-center truncate rounded-md px-1 -mx-1 text-[var(--font-size-category-value)] font-medium leading-5 transition-colors ${
          isEmpty ? 'text-empty' : 'text-ink/94'
        } ${showAffordance ? 'ring-1 ring-empty' : ''} ${
          isExpanded ? 'bg-accent/12 ring-1 ring-accent/25' : ''
        }`}
      >
        <span className='truncate'>
          {isEmpty ? `Add ${label.toLowerCase()}\u2026` : value}
        </span>
      </dd>
    </div>
  );
}
```

### 6. ManageView.tsx

No code changes required; the warm gradient from Shell.tsx line 391 now applies automatically.

---

## Design System Summary

### New Design Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-label` | 16px | Primary field/group label |
| `--font-size-key` | 12px | Machine keys, badges |
| `--font-size-category-label` | 11px | Category headers (DT) |
| `--font-size-category-value` | 14px | Category values (DD) |
| `--letter-spacing-wide` | 0.08em | Mono key tracking |
| `--state-selected-border` | accent/50 | Selected row border |
| `--state-selected-bg` | accent/0.09 | Selected row background |
| `--state-selected-shadow` | `0_8px_20px_rgba(37,99,235,0.18)` | Selected row elevation |

### New Utility Classes
| Class | Effect |
|-------|--------|
| `.text-empty` | `text-ink/35` + `italic` |
| `.ring-empty` | `ring-1 ring-accent/15` |
| `.state-selected` | All selected tokens combined |
| `.state-hover` | Hover border + background |

### New Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `CategoryCell` | `workspaces/editor/CategoryCell.tsx` | Reusable empty-state pattern |

---

## Verification Against Success Criteria

1. **Label first:** ✓ Visual hierarchy restructured so human label (16px, semibold) appears above key (12px, mono, dimmed). Viewer identifies label before key immediately.

2. **Selection unambiguous:** ✓ Border increased to `accent/50`, background to `accent/[0.09]`, shadow adds 8px lift. Selection is clearly visible at arm's length.

3. **Empty categories invite interaction:** ✓ CategoryCell renders "Add [category]…" in italic, with subtle ring on hover when selected. Visual affordance is persistent.

4. **Canvas begins immediately:** ✓ Sticky toggle removed from Shell.tsx; toggle moved into DefinitionTreeEditor header. Saves 48px of vertical space.

5. **Form Health panel neutral:** ✓ Panel uses amber for advisory issues (already correct). No change needed.

---

## Bonus Findings

### Potential Future Improvements (Out of Scope)

1. **Master card removal exploration:** Consider whether the master card (max-w-[980px], border, shadow) is necessary at all. A cleaner canvas might float field cards directly on the gradient with no master container. This would require testing but could further clarify hierarchy.

2. **Type scale systematization across studio:** The type scale tokens introduced here should be extended to all studio components (Header, properties panels, Blueprint sidebar) for studio-wide coherence.

3. **Group label size:** Currently 18px. Consider whether groups should be slightly smaller (16px, matching fields) or remain at 18px for clear visual separation. A comparative mockup would help.

4. **Touch target sizing:** Current field row height is `py-4` (~48px). On touch devices, CategoryCell click targets could be larger. Consider `min-h-[44px]` on category cells.

5. **Animation on category expansion:** When a user clicks a category to expand the editor panel, a subtle `scale-95` → `scale-100` + `fade-in` animation on the panel would add polish.

6. **Keyboard navigation:** Arrow keys within category grid to navigate left/right between cells. Tab enters edit mode for selected cell. Would improve keyboard-only workflow.

---

## Implementation Order

1. **Phase 1 — Layout & Spacing** (lowest risk):
   - Remove sticky toggle from Shell.tsx (line 141–143)
   - Extend gradient to Manage view (line 391)
   - Add BuildManageToggle to DefinitionTreeEditor header
   - Reduce card shadow (DefinitionTreeEditor line 382)

2. **Phase 2 — Typography & Tokens** (medium risk):
   - Add type scale tokens to index.css
   - Update ItemRowContent identity column markup to use new tokens
   - Update selected state in ItemRow.tsx

3. **Phase 3 — Components** (higher risk, test thoroughly):
   - Create CategoryCell.tsx
   - Update SummaryColumn to use CategoryCell
   - Add utility classes to index.css (`.text-empty`, `.ring-empty`)

**Testing strategy:** Each phase should have unit + integration tests before proceeding. Use Playwright E2E to verify visual appearance in Build view.

---

## Files Modified Summary

| File | Changes | Lines Affected |
|------|---------|-----------------|
| `packages/formspec-studio/src/index.css` | Add type scale tokens, utility classes | After line 128 |
| `packages/formspec-studio/src/components/Shell.tsx` | Remove sticky toggle band; extend gradient | Lines 141–143, 391 |
| `packages/formspec-studio/src/workspaces/editor/DefinitionTreeEditor.tsx` | Accept toggle props; render in header; reduce shadow | Props, header section, line 382 |
| `packages/formspec-studio/src/workspaces/editor/ItemRowContent.tsx` | Restructure identity column; use CategoryCell | Lines 72–450 |
| `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx` | Update selected state tokens | Lines 544–549 |
| `packages/formspec-studio/src/workspaces/editor/CategoryCell.tsx` | **NEW** | Full file |

---

## Conclusion

This proposal systematically solves all 8 visual problems by addressing the first domino in each: layout structure, markup hierarchy, interaction state clarity, empty-state affordance, visual weight, gradient consistency, and typography rhythm. The solutions are evolutionary (refining the existing design system, not replacing it) and introduce reusable patterns (CategoryCell, type scale tokens, state tokens) that can extend across the studio.

The result is a workspace that communicates hierarchy clearly, provides unambiguous feedback, and invites the right interactions at the right moments.
