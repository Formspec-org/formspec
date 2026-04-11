# Proposal: Evolutionary — Stepper + frame system realignment

## Design rationale

**Containers** and **leaves** now share `layout-node-styles`, but **wizard navigation** still uses a **marketing-style solid pill** left over from an earlier pattern. The **STACK** region is still a **second dialect** inside a **first-class frame**. Evolve a **three-tier chrome model**: **nav** (muted), **page frame** (structural), **stack/grid** (organizational interior), each with **one** accent application rule.

## Visual changes (per handoff problems)

1. **Dual hero** — Stepper becomes **underline + text** active state (bottom border `border-b-2 border-accent`, transparent background); canvas keeps rail+tint.  
2. **STACK** — Replace large “STACK” badge with **small caps pill** `text-[10px] tracking-widest` on **one edge** only; border `border-dashed border-border/40` → **`border-border/30` solid** when any child selected.  
3. **Truncation** — Step row: **two lines** allowed (`max-w-[8rem] whitespace-normal text-left leading-tight`); keys: second line for `bindPath` when `truncate` fires (detect `scrollWidth > clientWidth` or CSS `-webkit-line-clamp` with expand).  
4. **Toolbar** — Footer becomes **`bg-subtle/40`** full bleed with **12px** type; add **4px top inner shadow** to “attach” visually to card body.  
5. **Adds** — **`+ Item` primary** (filled subtle); `+ Page` and **split stack** as **ghost** buttons in a **ButtonGroup** divider.  
6. **Drag handle** — Always **`opacity-100`** on **focus-within** the card; minimum **32×44** touch zone (already have touch zone spans — verify width).

## Token/CSS changes

- Introduce **layout semantic** classes in one module, e.g. `layoutNavTabActive`, `layoutStackShell`, exported from `layout-node-styles.ts` or new `layout-chrome.ts`.  
- Map to existing `border-border`, `bg-subtle`, `accent` — no new palette colors.

## Component changes

- `LayoutStepNav.tsx` — active styling refactor (structure unchanged).  
- `LayoutContainer.tsx` — stack header/badge markup slimmed; conditional classes when `selected`.  
- `LayoutCanvas.tsx` — button variant props or class composition for add cluster.  
- `FieldBlock.tsx` — footer wrapper box-shadow + toolbar typography.

## Implementation sketch

```tsx
// layout-node-styles.ts
export const LAYOUT_NAV_TAB_ACTIVE =
  'rounded-t-lg border-b-2 border-accent bg-transparent px-3 py-1.5 text-[12px] font-semibold text-ink';
```

```tsx
// LayoutCanvas.tsx — visual hierarchy (conceptual)
<button className="rounded-lg bg-subtle px-3 py-2 text-sm font-medium">+ Item</button>
<button className="rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-subtle/60">+ Page</button>
```

## Success criteria check

| Criterion | Pass? |
|-----------|-------|
| Single accent hero | Pass |
| Nesting deliberate | Pass |
| Truncation recoverable | Pass (2-line / measure) |
| Toolbar legibility | Pass |
| No regression | Pass with QA |

## Bonus findings

- **Theme mode** overlay may need the same **nav demotion** so toggling Layout/Theme does not reintroduce a second “solid pill” language in `LayoutThemeToggle` — audit siblings.
