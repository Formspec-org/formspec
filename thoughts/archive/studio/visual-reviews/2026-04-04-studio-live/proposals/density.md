# Proposal: Density-focused

> Live capture shows **narrow-viewport stacking** and **ellipsis on keys/steps**; this direction optimizes for that stress case at the cost of some ItemRow parity in grid contexts.

## Design rationale

Layout authoring is **operator work** — maximize **structure per viewport**. Reduce **card padding**, **shadow**, and **stacked chrome**; push low-frequency edits (description/hint) to **inspector** or **popover**, keep canvas for **placement, span, and component type**.

## Visual changes

1. **Dialect clash**: Unify on **flat** surfaces — `bg-subtle/20` for containers, `bg-surface` fields with **`border border-border/60`** only; **no** 18px radius on fields in grid — use **`rounded-md`** in grid context only (detect `layoutContext.parentContainerType === 'grid'`).  
2. **Competing selection**: Selected = **`outline outline-2 outline-offset-[-1px] outline-accent/70`** (no fill glow) for all node types.  
3. **Vertical rhythm**: Remove **inline Description/Hint** from `FieldBlock` when `parentContainerType === 'grid'`; always show in **properties panel** only. Keep in Stack/Card context if space allows.  
4. **Toolbar**: Convert to **single-row icon strip** (icons + tooltips) for common props; overflow for rest — **height cap 28px**.  
5. **Container menu**: **Dropdown always visible** as compact **segmented** list in header row (overflow-x scroll on narrow).  
6. **Resize**: Merge col/row handles into **one corner grip** icon.

## Token/CSS

- Grid context: `rounded-md`, `py-1.5`, `px-2`.  
- Non-grid: keep `rounded-[18px]` for parity with editor when field is **not** in grid.

## Component changes

- `FieldBlock.tsx`: branch styling on `layoutContext?.parentContainerType === 'grid'`.  
- `FieldBlock.tsx`: `renderSummaryStrip` gated.  
- `InlineToolbar.tsx`: compact variant prop `density="compact"`.  
- `LayoutCanvas.tsx`: horizontal scroll container presets.

## Implementation sketch

```tsx
const inGrid = layoutContext?.parentContainerType === 'grid';
const shellRadius = inGrid ? 'rounded-md' : 'rounded-[18px]';
const shellPad = inGrid ? 'px-2 py-2' : 'px-3 py-3 md:px-4 md:py-3.5';
```

## Success criteria check

| Criterion | Addressed |
|-----------|-----------|
| Single selection dialect | Yes (outline system) |
| Grid balance | Strong |
| Primary action | Partial — segmented row may crowd |
| Focus visible | Must test outline vs high contrast mode |
| No regression | Risk — removing inline summary changes workflow |
