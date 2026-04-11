# Proposal: Evolutionary

## Design rationale

Introduce a **`LayoutCanvasSurface`** visual contract: **structural nodes** (containers) use **outline + header bar**; **content nodes** (fields/displays) use **filled cards**. Unify **selection** into **left accent rail** (2px) + **subtle** background, shared across container and field, and **retain** ItemRow typography inside the card **without** duplicating the heavy outer glow.

## Visual changes

1. **Dialect clash**: Replace dashed full-border with **`border-l-4 border-l-accent/40` + `border-y border-r border-border/50` rounded-r-lg** for containers (still reads as “frame”). Fields keep rounded cards but **drop** diffuse shadow for **same left-rail + bg** pattern when selected.  
2. **Competing selection**: **One rule**: selected = `bg-accent/[0.06]` + `border-l-accent` (solid) on any node type; no second `shadow-[0_14px…]`.  
3. **Vertical rhythm**: **Collapse** description/hint behind a **`Details ▾`** disclosure inside the card (button toggles `renderSummaryStrip`); default closed when toolbar open.  
4. **Toolbar**: Move toolbar into **`border-t border-border/40 pt-2 mt-2`** “footer” region with **muted background** `bg-subtle/30 rounded-b-[16px] -mx-px` (optical attachment to card).  
5. **Container menu**: **Split control**: primary click adds default **Stack**; chevron opens menu (pattern from split buttons).  
6. **Resize**: Show **corner tick** (4px square) at bottom-right on grid cells when selected.

## Token/CSS

- New utility class in studio (e.g. `layout-node-selected`): `border-l-accent bg-accent/[0.06]`.  
- Remove hard-coded `shadow-[0_14px_34px_rgba(59,130,246,0.12)]` from field/display shells.

## Component changes

- `FieldBlock.tsx`, `DisplayBlock.tsx`, `LayoutContainer.tsx`: extract shared `layoutNodeSelectedClasses`.  
- `FieldBlock.tsx`: disclosure state for summary strip.  
- `LayoutCanvas.tsx`: split button for container add.

## Implementation sketch

```tsx
const LAYOUT_SELECTED =
  'border-l-4 border-l-accent bg-accent/[0.06] border-y border-r border-border/60';
```

```tsx
// FieldBlock outer div
className={cn(shellBase, selected ? LAYOUT_SELECTED : 'border border-transparent')}
```

## Success criteria check

| Criterion | Addressed |
|-----------|-----------|
| Single selection dialect | Yes |
| Grid balance | Yes (collapsible details) |
| Primary action | Yes (split button) |
| Focus visible | Verify ring against new borders |
| No regression | Medium — disclosure adds interaction |
